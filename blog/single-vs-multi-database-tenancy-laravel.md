---
title: "Single vs Multi-Database Tenancy in Laravel"
description: "Single database vs multi database tenancy in Laravel: the decision factors, costs, scaling, cross-tenant reporting and how to move between models later."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: multi-tenancy
tags: [Multi-tenancy, Architecture]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/single-vs-multi-database-tenancy-laravel.html
  - - meta
    - property: og:title
      content: "Single vs Multi-Database Tenancy in Laravel"
  - - meta
    - property: og:description
      content: "Single database vs multi database tenancy in Laravel: the decision factors, costs, scaling, cross-tenant reporting and how to move between models later."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/single-vs-multi-database-tenancy-laravel.html
  - - meta
    - name: twitter:title
      content: "Single vs Multi-Database Tenancy in Laravel"
  - - meta
    - name: twitter:description
      content: "Single database vs multi database tenancy in Laravel: the decision factors, costs, scaling, cross-tenant reporting and how to move between models later."
---

# Single Database vs Multi-Database Tenancy in Laravel: How to Choose

<BlogPostMeta />

If you're starting a multi-tenant Laravel app, you'll hit this question in the first week: do all your customers share one database, or does each one get their own? The **single database vs multi database tenancy** decision isn't just a config setting. It changes how you write queries, how you run migrations, how you take backups and what you can honestly tell a customer about where their data lives.

I'm going to skip the textbook definitions and walk through the decision itself: which factors matter, what each model costs to run, how each one scales, how you report across tenants and what switching later really involves. If you'd like the big-picture overview of all three approaches first, start with [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html) and come back.

## The two models in one paragraph each

With a single database, every tenant-owned table has a `tenant_id` column. The app knows who the current tenant is and adds `where tenant_id = ?` to every query, usually through a global scope. You have one schema, one migration run and one backup.

With multiple databases, a central database holds tenants, domains and platform data. Each tenant then gets a database of its own with the same tables and no `tenant_id` column at all. When a request comes in, the app switches the default connection to that tenant's database.

[stancl/tenancy](https://tenancyforlaravel.com) version 3 supports both. In its docs you'll see them called single-database and multi-database tenancy.

## Single database vs multi database tenancy: the decision factors

Here are the questions that usually settle it. Try to answer them for the product you're actually building, not the one you imagine having in five years.

| Question | Points to single database | Points to multi-database |
| --- | --- | --- |
| Who are your customers? | Individuals, small teams, free plans | Businesses with security reviews and contracts |
| How many tenants do you expect? | Many thousands of small ones | Hundreds to a few thousand larger ones |
| Will a customer ask for their data or a restore? | Rarely | Often: exports, restores, "delete everything we own" |
| Do you need reports across all tenants? | Constantly, in the product itself | Mostly internal and occasional |
| How much ops work can you take on? | Minimal | You can automate provisioning, migrations and backups |
| Could one tenant grow much larger than the rest? | Unlikely | Likely, and you may want to move it to its own server |

When most of your answers fall in one column, that's your answer. If they're split down the middle, don't worry. The rest of this post is about weighing exactly that kind of split.

## How single-database tenancy works in stancl/tenancy

To run in single-database mode, you remove `DatabaseTenancyBootstrapper` from the bootstrappers in `config/tenancy.php` and add the `BelongsToTenant` trait to each tenant-owned model:

```php
use Stancl\Tenancy\Database\Concerns\BelongsToTenant;

class Project extends Model
{
    use BelongsToTenant;
}
```

The trait adds a global scope that filters by `tenant_id`, and it fills in `tenant_id` for you when a model is created. That handles most everyday queries. Before you commit, though, it helps to know where it stops.

The scope only applies while tenancy is initialized. If you're wondering how data leaks happen in practice, this is usually it: in an Artisan command, a scheduled task or a job that didn't restore the tenant, `Project::all()` quietly returns every tenant's projects.

It also only covers Eloquent. `DB::table('projects')` and raw SQL ignore the global scope completely, so you have to add the filter yourself.

Uniqueness needs care too. A plain `unique:projects,slug` rule checks across all tenants. Your tenant model can use the `HasScopedValidationRules` trait, which gives you `tenant()->unique('projects', 'slug')`, and your indexes need the same idea: a composite unique index on `tenant_id` and `slug`.

Finally, getting out of the scope is easy. It adds a `withoutTenancy()` query macro, which is handy on admin screens and risky anywhere else.

None of this means you should avoid a single database. It means **your isolation is only as good as your code**, every single time, so your tests have to look for leaks.

## What multi-database tenancy costs

When each tenant has its own database, isolation comes from the database server rather than your queries. A forgotten `where` clause can't leak anything, because the other tenants' rows simply aren't on that connection. The cost doesn't disappear, though. It moves into operations.

Provisioning is the first thing you'll notice. Your database user needs permission to create and drop databases, and creating a tenant runs `CREATE DATABASE` followed by every tenant migration.

Migrations are the next. Each deployment runs every tenant migration against every tenant database, one after another, so the time grows with your tenant count. [Tenant Migrations and Seeders in Laravel](/blog/laravel-tenant-migrations-seeders.html) explains how to keep that safe.

Then there are backups: one per database, plus the central one. The nice part is that you can restore a single customer without touching anybody else, as covered in [Backups for a Multi-Database Laravel SaaS](/blog/laravel-multi-database-backups.html). Monitoring spreads out in the same way, since disk usage, slow queries and table sizes now live across many databases.

What you get back is real: per-tenant exports and restores, a simple answer to "where is our data?", and a clean way to remove a customer completely by dropping one database.

## Scaling each model

A single database scales the way any Laravel app does. You add good indexes (with `tenant_id` first in most of them), caching and eventually a bigger server. The weak spot is the noisy neighbour. One tenant importing a million rows slows everyone else down, and one very large tenant makes every table large for all of them.

Multi-database tenancy scales sideways instead. Tenant databases are small and independent, and you can put them on different servers. stancl/tenancy reads an internal `tenancy_db_connection` attribute to decide which connection to use as the template for a tenant's database:

```php
// config/database.php has a second MySQL connection named 'mysql_large'
$tenant = Tenant::create([
    'tenancy_db_connection' => 'mysql_large',
]);
```

This part tripped me up at first: the attribute has to be set before the database is created, because that's the server the database gets created on. Moving an existing tenant later means copying its database to the new server and only then updating the attribute.

## Reporting across tenants

Here a single database is clearly easier. "Active projects per tenant" is one query:

```php
Project::withoutTenancy()
    ->selectRaw('tenant_id, count(*) as total')
    ->groupBy('tenant_id')
    ->get();
```

With a database per tenant, there's no single table to ask. For occasional internal reports you can loop over the tenants:

```php
$totals = [];

tenancy()->runForMultiple(null, function (Tenant $tenant) use (&$totals) {
    $totals[$tenant->id] = Project::count();
});
```

Passing `null` walks through every tenant with a cursor. That's fine for a nightly job, but far too slow for a dashboard that loads on every request. If your product needs cross-tenant numbers regularly, I'd write a small summary to a central table (whenever something changes, or on a schedule) and report from that table instead.

## Moving between models later

You can switch, but treat it as a migration project rather than a config change.

Going from single to multi-database is the more common direction. For each tenant you create its database, run the tenant migrations and copy over the rows where `tenant_id` matches. After that you drop the `tenant_id` columns and the `BelongsToTenant` trait. You can move tenants one at a time, which keeps the risk small.

Going the other way, from multi to single, is harder, and the reason is IDs. Every tenant database has its own auto-increment sequence, so tenant A and tenant B both have a project with ID 1. Merging them means rewriting primary keys and every foreign key that points at them.

Two habits make either move cheaper. If you think you might ever switch, use ULIDs or UUIDs for tenant-owned records, so IDs from different tenants can never collide. And keep tenant-specific logic in services rather than controllers, so a switch touches one layer instead of the whole app.

## A quick way to decide

- Customers are businesses that ask about data isolation → multi-database
- You need per-customer restores or exports → multi-database
- You expect a very large number of tiny or free tenants → single database
- Cross-tenant analytics is a core product feature → single database, or multi-database plus a central summary table
- You can automate provisioning, migrations and backups → multi-database is realistic
- You're unsure → pick the model that matches your first paying customers, and use ULIDs so a later move stays possible

If you want my own leaning: for a B2B product I'd go multi-database, because the isolation and per-customer restores are hard to add later. For a free or consumer-style app with lots of tiny accounts, a single database is simpler to live with.

## Frequently asked questions

### Is multi-database tenancy slower than a single database?

Not per request. Each request only talks to one tenant database, and those are smaller than one shared database would be. The extra cost sits in operations: creating databases, running migrations on each one and backing them all up.

### How many tenant databases can one server handle?

There's no single number, because it depends on your database server, how it's configured and how big each tenant is. Keep an eye on disk usage, open files and migration time as you grow, and move large tenants to another server when you need to.

### Can I mix both models in one Laravel app?

Yes. Central data like plans, tenants and domains lives in the central database anyway. Some teams also keep shared or analytics tables central and put everything customer-owned in tenant databases. Just be deliberate about which models use the central connection.

### Does schema-per-tenant count as multi-database tenancy?

It sits somewhere in between. stancl/tenancy ships a PostgreSQL manager that creates a schema per tenant instead of a whole database. You get separation without separate databases, but it ties you to PostgreSQL.

## How SaaS Laravel handles tenancy

If you'd rather not set this up from scratch, the [SaaS Laravel starter kits](/) already use stancl/tenancy 3 in multi-database mode. The central database holds tenants, domains, central users, global settings and the queue. Each tenant gets its own database, named from the prefix `tenant` and the tenant's auto-increment ID (`tenant1`, `tenant2`, and so on), with that tenant's users, roles, menus and sessions inside. Tenant code doesn't need any `tenant_id` filters. Tenant migrations live in `database/migrations/tenant`, and deleting a tenant in the admin drops its database. The full layout is in [Central and tenant databases](/docs/core/database.html), or you can follow the [stancl/tenancy tutorial](/blog/stancl-tenancy-tutorial.html) to build it yourself.

<BlogPostCta title="Database-per-tenant, ready to build on" text="SaaS Laravel gives every tenant its own database with automatic provisioning, tenant migrations and seeders, in Vue, React or Svelte on one Laravel backend." />
