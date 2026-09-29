---
title: "How to Build a Multi-Tenant SaaS with Laravel"
description: "Single database, schema or database per tenant? How database-per-tenant multi-tenancy works in Laravel with stancl/tenancy, plus the pitfalls to avoid."
pageClass: blog-page
date: 2026-09-29
author: erag
category: multi-tenancy
tags: [Multi-tenancy, Architecture]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/multi-tenant-saas-laravel-database-per-tenant.html
  - - meta
    - property: og:title
      content: "How to Build a Multi-Tenant SaaS with Laravel"
  - - meta
    - property: og:description
      content: "Single database, schema or database per tenant? How database-per-tenant multi-tenancy works in Laravel with stancl/tenancy, plus the pitfalls to avoid."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/multi-tenant-saas-laravel-database-per-tenant.html
  - - meta
    - name: twitter:title
      content: "How to Build a Multi-Tenant SaaS with Laravel"
  - - meta
    - name: twitter:description
      content: "Single database, schema or database per tenant? How database-per-tenant multi-tenancy works in Laravel with stancl/tenancy, plus the pitfalls to avoid."
---

# How to Build a Multi-Tenant SaaS with Laravel: Database-per-Tenant Explained

<BlogPostMeta />

Almost every SaaS product is multi-tenant. One application serves many customers, and each customer (a company, a school, a team) only ever sees its own data. Those customers are your tenants, and when you build a multi-tenant SaaS with Laravel, the first big question is how to keep their data apart.

It's one of the earliest decisions you'll make, and one of the hardest to change later. We'll compare the three common approaches, show how the database-per-tenant model works in Laravel, and go through the pitfalls that catch most teams.

## The three ways to separate tenant data

| Approach | How it works | Strengths | Trade-offs |
| --- | --- | --- | --- |
| Single database | Every table has a `tenant_id` column and every query filters by it | Simplest to start, one migration run, cheap to host | One missing `where tenant_id = …` leaks data; large tables grow fast; hard to give one customer its own backup |
| Schema per tenant | One database, a separate schema per tenant (mainly PostgreSQL) | Strong separation inside one server | Tied to databases that support schemas; migrations run per schema |
| Database per tenant | A central database for the platform, plus one database per tenant | Strongest isolation; per-tenant backups, restores and exports; no `tenant_id` in your queries | More databases to create, migrate and back up; needs automation |

No option is right for everyone. A single database is fine for a small product with lots of tiny tenants. But if your customers are businesses that care about **data isolation, compliance or exporting their own data**, we'd go with database-per-tenant. It gives you the cleanest story, and with the right tooling the extra work is automated.

## How database-per-tenant works in Laravel

The idea is simple. Your application holds two kinds of data.

Central data covers the tenants themselves, their domains, your admin users and platform settings. It lives in the central database. Tenant data is everything a customer creates inside their workspace: their users, roles, projects and so on. Each tenant gets its own database with the same tables.

When a request comes in, the application works out which tenant it belongs to and switches every connection to that tenant's database before your code runs:

```text
acme.your-saas.com → find the tenant for this domain → switch to the tenant database → run the app
```

Your controllers and models never notice. `User::all()` just returns Acme's users, because it's reading Acme's database.

## Setting it up in Laravel with stancl/tenancy

[stancl/tenancy](https://tenancyforlaravel.com) is one of the most widely used Laravel packages for this, and it's the one we'd reach for. It handles identification, database switching and the lifecycle of tenant databases.

### 1. Identify the tenant

Identifying tenants by domain or subdomain is the most common method. Tenant routes go through two middleware: one initializes tenancy for the current domain, and the other stops tenant routes being reached from your central domain.

```php
// routes/tenant.php
Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
])->group(function () {
    // Every route here runs inside the tenant's database.
});
```

Central routes (marketing site, sign-up, platform admin) stay in `routes/web.php` and use the central database.

### 2. Switch everything, not just the database

When tenancy starts, "bootstrappers" move each part of Laravel into the tenant's context:

| Bootstrapper | What it isolates |
| --- | --- |
| Database | The default connection points to the tenant database |
| Cache | Cache keys are separated per tenant |
| Filesystem | Uploaded files are stored per tenant |
| Queue | Queued jobs remember which tenant they belong to |

Leave one of these out and you get the classic multi-tenancy bugs, like a cached value from one tenant showing up for another.

### 3. Create a tenant and its database automatically

Creating a tenant is just creating a model and attaching a domain:

```php
$tenant = Tenant::create(['id' => 'acme']);

$tenant->domains()->create(['domain' => 'acme.your-saas.com']);
```

The real work happens in an event listener. When the `TenantCreated` event fires, a job pipeline creates the database, runs the tenant migrations and seeds it:

```php
Events\TenantCreated::class => [
    JobPipeline::make([
        Jobs\CreateDatabase::class,
        Jobs\MigrateDatabase::class,
        Jobs\SeedDatabase::class,
    ])->send(fn (Events\TenantCreated $event) => $event->tenant),
],
```

To create the tenant's first admin user or default settings, add your own job to the end of the pipeline.

### 4. Keep two sets of migrations

Central migrations stay in `database/migrations`. Tenant migrations live in `database/migrations/tenant` and run against every tenant database:

```bash
php artisan tenants:migrate
```

## Authentication: central users vs tenant users

A database-per-tenant app usually has two kinds of users: your own platform administrators in the central database, and each customer's users in their tenant database. Give them **separate guards and user providers**. That way a tenant user can never sign in to the platform admin area (or the other way round), and a customer's users only exist inside that customer's database.

## Pitfalls to plan for

### Queued jobs and tenant context

A job dispatched inside a tenant has to run inside that same tenant. Use the queue bootstrapper, and remember that anything read from the current request (form input, for example) isn't available to a queue worker.

### Database name clashes

Tenant databases are usually named from a prefix plus the tenant ID, such as `tenant` + `1`. Put two apps on the same database server and both will try to create `tenant1`, so give each app its own prefix.

### Migration runs grow with you

Every tenant database needs every migration. Keep migrations fast and backwards compatible, and run them as part of your deployment.

### Backups multiply

One database per tenant means one backup per tenant, so automate it. In return, you can restore a single customer without touching anyone else, which is a genuinely nice position to be in.

### Local subdomains

You'll need wildcard subdomains on your machine (for example `*.your-saas.test`). Tools like Laravel Herd handle this for `.test` domains.

### Deleting a tenant

Decide what happens to a tenant's database when the tenant is removed, and make it a deliberate step. **Dropping a database can't be undone.**

## A quick checklist

1. Decide how tenants are identified (subdomain, custom domain or both).
2. Split routes, migrations and users into central and tenant.
3. Automate tenant creation: database, migrations, seeders, first admin.
4. Isolate cache, files and queues as well as the database.
5. Plan backups, deletion and migration runs for many databases.
6. Add the SaaS features every tenant needs: roles and permissions, invitations, per-tenant settings and a way to suspend or pause a workspace.

## Go deeper: the multi-tenancy series

We've written a separate guide for each part of a multi-tenant Laravel app:

| Topic | Guide |
| --- | --- |
| Choosing a data model | [Single vs multi-database tenancy in Laravel](/blog/single-vs-multi-database-tenancy-laravel.html) |
| Installing the package | [stancl/tenancy tutorial: getting started](/blog/stancl-tenancy-tutorial.html) |
| Identifying tenants | [Laravel multi-tenancy with subdomains](/blog/laravel-multi-tenancy-subdomains.html) and [custom domains for tenants](/blog/laravel-tenant-custom-domains.html) |
| Schema changes | [Tenant migrations and seeders](/blog/laravel-tenant-migrations-seeders.html) |
| Background work | [Queued jobs in a multi-tenant Laravel app](/blog/laravel-multi-tenant-queues.html) |
| Isolation beyond the database | [Tenant-aware cache and file storage](/blog/laravel-tenant-cache-filesystem.html) |
| Tests | [Testing multi-tenant Laravel apps with Pest](/blog/test-multi-tenant-laravel-pest.html) |
| Offboarding | [Deleting tenants safely](/blog/delete-tenant-laravel-safely.html) |
| Operations | [Backups for a multi-database Laravel SaaS](/blog/laravel-multi-database-backups.html) |

## Frequently asked questions

### Is database-per-tenant slower than a single database?

Not per request. Each request still talks to one database, and tenant databases stay small, so queries are often faster. The cost shows up in operations instead: more databases to migrate, back up and monitor.

### How many tenant databases can one MySQL server hold?

There's no fixed limit you'll run into early. The practical limits are open files, memory, and how long a migration run across every tenant takes. When one server gets busy, tenancy packages let you put new tenant databases on another server.

### Can I report across all tenants?

Yes, though not with a single SQL query, because the data lives in separate databases. Loop over tenants with a command such as `tenants:run`, or copy the figures you need into a central reporting table. For regular reports, we'd lean towards the central table.

### Do I need a separate domain for every tenant?

No. Most SaaS apps give each tenant a subdomain of one wildcard domain, such as `acme.your-saas.com`. Custom domains are an optional extra for customers who want their own address.

## How SaaS Laravel handles this for you

If you'd rather not build all of this from scratch, the [SaaS Laravel starter kits](/) use exactly this model. Each tenant gets its own database and is identified by its subdomain. Creating a tenant runs a pipeline that creates the database, runs the tenant migrations, seeds roles, permissions and menus, and creates the tenant's first administrator. Central and tenant users use separate guards, and you also get per-domain settings, workspace status, suspension and global maintenance mode. The [multi-tenancy documentation](/docs/core/multi-tenancy.html) covers the details.

<BlogPostCta />
