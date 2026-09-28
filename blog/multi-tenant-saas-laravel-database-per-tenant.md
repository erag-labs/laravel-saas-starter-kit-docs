---
title: "How to Build a Multi-Tenant SaaS with Laravel"
description: "Single database, schema or database per tenant? How database-per-tenant multi-tenancy works in Laravel with stancl/tenancy, plus the pitfalls to avoid."
date: 2026-09-29
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

Almost every SaaS product is **multi-tenant**: one application serves many customers, and each customer — a company, a school, a team — only ever sees its own data. Those customers are your **tenants**.

How you separate tenant data is one of the earliest decisions you make, and one of the hardest to change later. This guide compares the three common approaches, explains how the **database-per-tenant** model works in Laravel, and lists the pitfalls that catch most teams.

## The three ways to separate tenant data

| Approach | How it works | Strengths | Trade-offs |
| --- | --- | --- | --- |
| **Single database** | Every table has a `tenant_id` column and every query filters by it | Simplest to start, one migration run, cheap to host | One missing `where tenant_id = …` leaks data; large tables grow fast; hard to give one customer its own backup |
| **Schema per tenant** | One database, a separate schema per tenant (mainly PostgreSQL) | Strong separation inside one server | Tied to databases that support schemas; migrations run per schema |
| **Database per tenant** | A central database for the platform, plus one database per tenant | Strongest isolation; per-tenant backups, restores and exports; no `tenant_id` in your queries | More databases to create, migrate and back up; needs automation |

There is no universally right answer. A single database is fine for a small product with lots of tiny tenants. But if your customers are businesses that care about **data isolation, compliance or exporting their own data**, database-per-tenant gives you the cleanest story — and with the right tooling, the extra work is automated.

## How database-per-tenant works

The idea is simple: your application has two kinds of data.

- **Central data** — the tenants themselves, their domains, your admin users and platform settings. It lives in the central database.
- **Tenant data** — everything a customer creates inside their workspace: their users, roles, projects and so on. Each tenant gets its own database with the same tables.

When a request comes in, the application works out **which tenant it belongs to** and switches every connection to that tenant's database before your code runs:

```text
acme.your-saas.com → find the tenant for this domain → switch to the tenant database → run the app
```

Your controllers and models don't know any of this happened. `User::all()` simply returns Acme's users, because it's reading Acme's database.

## Setting it up in Laravel with stancl/tenancy

[stancl/tenancy](https://tenancyforlaravel.com) is one of the most widely used packages for this in Laravel. It handles identification, database switching and the lifecycle of tenant databases.

### 1. Identify the tenant

The most common method is **by domain or subdomain**. Tenant routes go through two middleware: one to initialize tenancy for the current domain, and one to stop tenant routes being reached from your central domain.

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

Your central routes (marketing site, sign-up, platform admin) stay in `routes/web.php` and use the central database.

### 2. Switch everything, not just the database

When tenancy starts, "bootstrappers" move each part of Laravel into the tenant's context:

| Bootstrapper | What it isolates |
| --- | --- |
| Database | The default connection points to the tenant database |
| Cache | Cache keys are separated per tenant |
| Filesystem | Uploaded files are stored per tenant |
| Queue | Queued jobs remember which tenant they belong to |

Forgetting one of these is a classic source of bugs — for example, a cached value from one tenant showing up for another.

### 3. Create a tenant — and its database — automatically

Creating a tenant is just creating a model and attaching a domain:

```php
$tenant = Tenant::create(['id' => 'acme']);

$tenant->domains()->create(['domain' => 'acme.your-saas.com']);
```

The heavy lifting happens in an event listener. When the `TenantCreated` event fires, a job pipeline creates the database, runs the tenant migrations and seeds it:

```php
Events\TenantCreated::class => [
    JobPipeline::make([
        Jobs\CreateDatabase::class,
        Jobs\MigrateDatabase::class,
        Jobs\SeedDatabase::class,
    ])->send(fn (Events\TenantCreated $event) => $event->tenant),
],
```

Add your own job to the end of the pipeline to create the tenant's first admin user or default settings.

### 4. Keep two sets of migrations

Central migrations stay in `database/migrations`. Tenant migrations live in `database/migrations/tenant` and run against every tenant database:

```bash
php artisan tenants:migrate
```

## Authentication: central users vs tenant users

In a database-per-tenant app you usually have **two kinds of users**: your own platform administrators (central database) and each customer's users (tenant database). Give them **separate guards and user providers**, so a tenant user can never sign in to the platform admin area and vice versa. It also means a customer's users only exist inside that customer's database.

## Pitfalls to plan for

- **Queued jobs lose their tenant.** A job dispatched inside a tenant must run inside the same tenant. Use the queue bootstrapper, and keep in mind that data read from the current request (like form input) isn't available to a queue worker.
- **Database name clashes.** Tenant databases are usually named from a prefix and the tenant ID, such as `tenant` + `1`. Two apps on the same database server will both try to create `tenant1` — give each app its own prefix.
- **Migrations take longer as you grow.** Every tenant database needs every migration. Keep migrations fast and backwards compatible, and run them as part of your deployment.
- **Backups multiply.** One database per tenant means one backup per tenant. Automate it — and enjoy being able to restore a single customer without touching anyone else.
- **Local subdomains.** You need wildcard subdomains on your machine (for example `*.your-saas.test`). Tools like Laravel Herd handle this for `.test` domains.
- **Deleting a tenant.** Decide what happens to its database when a tenant is removed, and make sure it's deliberate — dropping a database can't be undone.

## A quick checklist

1. Decide how tenants are identified (subdomain, custom domain or both).
2. Split routes, migrations and users into central and tenant.
3. Automate tenant creation: database, migrations, seeders, first admin.
4. Isolate cache, files and queues — not just the database.
5. Plan backups, deletion and migration runs for many databases.
6. Add the SaaS features every tenant needs: roles and permissions, invitations, per-tenant settings and a way to suspend or pause a workspace.

## How SaaS Laravel handles this for you

The [SaaS Laravel starter kits](/) are built on exactly this model. Each tenant gets its own database, identified by its subdomain. Creating a tenant runs a pipeline that creates the database, runs the tenant migrations, seeds roles, permissions and menus, and creates the tenant's first administrator. Central and tenant users use separate guards, and you also get per-domain settings, workspace status, suspension and global maintenance mode. Read more in the [multi-tenancy documentation](/docs/core/multi-tenancy).

<BlogPostCta />
