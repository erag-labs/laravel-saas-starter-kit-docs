---
title: "Single vs Multi-Database Tenancy in Laravel"
description: "Single database vs multi database tenancy in Laravel: the decision factors, costs, scaling, cross-tenant reporting and how to move between models later."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
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

Every multi-tenant Laravel app has to answer one question early: do all customers share one database, or does each customer get their own? The **single database vs multi database tenancy** choice shapes your queries, your migrations, your backups and what you can promise customers about their data.

This guide skips the basic definitions and goes straight to the decision: the factors that matter, what each model costs to run, how each one scales, how you report across tenants, and what it takes to switch later. If you want the overview of all three approaches first, read [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## The two models in one paragraph each

**Single database:** every tenant-owned table has a `tenant_id` column. The app knows the current tenant and adds `where tenant_id = ?` to every query, usually through a global scope. There is one schema, one migration run and one backup.

**Multi-database:** a central database holds tenants, domains and platform data. Each tenant gets its own database with the same tables and no `tenant_id` column. When a request arrives, the app switches the default connection to that tenant's database.

Both are fully supported by [stancl/tenancy](https://tenancyforlaravel.com) version 3. The package calls them single-database and multi-database tenancy.

## Single database vs multi database tenancy: the decision factors

These are the questions that usually decide it. Answer them for your product, not for an imagined future one.

| Question | Points to single database | Points to multi-database |
| --- | --- | --- |
| Who are your customers? | Individuals, small teams, free plans | Businesses with security reviews and contracts |
| How many tenants do you expect? | Many thousands of small ones | Hundreds to a few thousand larger ones |
| Will a customer ask for their data or a restore? | Rarely | Often: exports, restores, "delete everything we own" |
| Do you need reports across all tenants? | Constantly, in the product itself | Mostly internal and occasional |
| How much ops work can you take on? | Minimal | You can automate provisioning, migrations and backups |
| Could one tenant grow much larger than the rest? | Unlikely | Likely, and you may want to move it to its own server |

If most of your answers land in one column, you have your answer. If they are split, the next sections should help you weigh the trade-offs.

## How single-database tenancy works in stancl/tenancy

In single-database mode you remove `DatabaseTenancyBootstrapper` from the bootstrappers in `config/tenancy.php` and add the `BelongsToTenant` trait to each tenant-owned model:

```php
use Stancl\Tenancy\Database\Concerns\BelongsToTenant;

class Project extends Model
{
    use BelongsToTenant;
}
```

The trait adds a global scope that filters by `tenant_id` and fills `tenant_id` automatically when a model is created. That covers most day-to-day queries, but it has limits you should know before you commit:

- **The scope only applies while tenancy is initialized.** In a command, a scheduled task or a job that did not restore the tenant, `Project::all()` returns every tenant's projects.
- **Only Eloquent is scoped.** `DB::table('projects')` and raw SQL ignore the global scope, so you must add the filter yourself.
- **Uniqueness is per tenant.** A plain `unique:projects,slug` rule checks all tenants. The tenant model can use the `HasScopedValidationRules` trait, which gives you `tenant()->unique('projects', 'slug')`. Your database indexes need the same thinking: a composite unique index on `tenant_id` and `slug`.
- **Escaping the scope is easy.** The scope adds a `withoutTenancy()` query macro, which is useful for admin screens and dangerous anywhere else.

None of this is a reason to avoid a single database. It means data isolation depends on your code being correct every time, and your tests need to check for leaks.

## What multi-database tenancy costs

With a database per tenant, isolation comes from the database server instead of your queries. Forgetting a `where` clause cannot leak data, because the other tenants' rows are not on the connection. The costs move to operations:

- **Provisioning.** The database user needs permission to create and drop databases. Creating a tenant runs `CREATE DATABASE`, then every tenant migration.
- **Migrations.** Each deployment runs every tenant migration against every tenant database, one after another. Time grows with the number of tenants. [Tenant Migrations and Seeders in Laravel](/blog/laravel-tenant-migrations-seeders.html) covers how to keep that safe.
- **Backups.** One backup per database, plus the central one. The upside is that you can restore one customer without touching anyone else, which is covered in [Backups for a Multi-Database Laravel SaaS](/blog/laravel-multi-database-backups.html).
- **Monitoring.** Disk usage, slow queries and table sizes are now spread over many databases.

In return you get per-tenant exports and restores, a simple answer to "where is our data?", and the ability to delete a customer completely by dropping one database.

## Scaling each model

A single database scales like any other Laravel app: good indexes (with `tenant_id` first in most of them), caching and a bigger server. The problem is the **noisy neighbour**. One tenant importing a million rows slows every other tenant, and a very large tenant makes every table large for everyone.

Multi-database tenancy scales sideways. Tenant databases are small and independent, and you can place them on different servers. stancl/tenancy reads an internal `tenancy_db_connection` attribute to decide which connection is used as the template for a tenant's database:

```php
// config/database.php has a second MySQL connection named 'mysql_large'
$tenant = Tenant::create([
    'tenancy_db_connection' => 'mysql_large',
]);
```

Set it before the database is created, because the database is created on that connection's server. Moving an existing tenant later means copying its database to the new server and then updating the attribute.

## Reporting across tenants

This is where a single database is clearly easier. "Active projects per tenant" is one query:

```php
Project::withoutTenancy()
    ->selectRaw('tenant_id, count(*) as total')
    ->groupBy('tenant_id')
    ->get();
```

With a database per tenant there is no single table to query. For occasional internal reports you can loop over tenants:

```php
$totals = [];

tenancy()->runForMultiple(null, function (Tenant $tenant) use (&$totals) {
    $totals[$tenant->id] = Project::count();
});
```

Passing `null` walks every tenant with a cursor. That is fine for a nightly job, but too slow for a dashboard that loads on every request. If your product needs cross-tenant numbers regularly, write a small summary to a central table whenever something changes, or on a schedule, and report from that table instead.

## Moving between models later

Switching is possible, but it is a migration project, not a config change.

**Single to multi-database** is the more common direction. For each tenant, you create its database, run the tenant migrations and copy the rows where `tenant_id` matches. Then you remove the `tenant_id` columns and the `BelongsToTenant` trait. You can move tenants one at a time, which keeps the risk small.

**Multi to single database** is harder, mostly because of IDs. Every tenant database has its own auto-increment sequence, so tenant A and tenant B both have a project with ID 1. Merging them means rewriting primary keys and every foreign key that points at them.

Two habits make either move cheaper:

- Use ULIDs or UUIDs for tenant-owned records if you think you might switch. IDs from different tenants then never collide.
- Keep tenant-specific logic out of controllers and in services, so the switch touches one layer instead of the whole app.

## A quick way to decide

- Customers are businesses that ask about data isolation → multi-database
- You need per-customer restores or exports → multi-database
- You expect a very large number of tiny or free tenants → single database
- Cross-tenant analytics is a core product feature → single database, or multi-database plus a central summary table
- You can automate provisioning, migrations and backups → multi-database is realistic
- You are unsure → pick the model that matches your first paying customers, and use ULIDs so a later move stays possible

## Frequently asked questions

### Is multi-database tenancy slower than a single database?

Not per request. Each request only uses one tenant database, and those databases are smaller than one shared database would be. The extra cost is in operations: creating databases, running migrations on each one and backing them all up.

### How many tenant databases can one server handle?

It depends on your database server, its configuration and the size of each tenant, so there is no single number. Watch disk usage, open files and migration time as you grow, and move large tenants to another server when needed.

### Can I mix both models in one Laravel app?

Yes. Central data such as plans, tenants and domains lives in the central database anyway. Some teams keep shared or analytics tables central and everything customer-owned in tenant databases. Be deliberate about which models use the central connection.

### Does schema-per-tenant count as multi-database tenancy?

It sits in between. stancl/tenancy includes a PostgreSQL manager that creates a schema per tenant instead of a database. You get separation without separate databases, but you are tied to PostgreSQL.

## How SaaS Laravel handles tenancy

The [SaaS Laravel starter kits](/) use stancl/tenancy 3 in multi-database mode. The central database holds tenants, domains, central users, global settings and the queue. Each tenant gets its own database, named from the prefix `tenant` and the tenant's auto-increment ID (`tenant1`, `tenant2`, and so on), holding that tenant's users, roles, menus and sessions. Tenant code needs no `tenant_id` filters. Tenant migrations live in `database/migrations/tenant`, and deleting a tenant in the admin drops its database. See [Central and tenant databases](/docs/core/database.html) for the full layout, or follow the [stancl/tenancy tutorial](/blog/stancl-tenancy-tutorial.html) to set it up yourself.

<BlogPostCta title="Database-per-tenant, ready to build on" text="SaaS Laravel gives every tenant its own database with automatic provisioning, tenant migrations and seeders, in Vue, React or Svelte on one Laravel backend." />
