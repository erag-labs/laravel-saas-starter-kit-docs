---
title: "stancl/tenancy Tutorial: Getting Started"
description: "A hands-on stancl tenancy tutorial: install stancl/tenancy 3, create a Tenant model, add tenant migrations and routes, and create your first tenant database."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: multi-tenancy
tags: [Multi-tenancy, Tutorial]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/stancl-tenancy-tutorial.html
  - - meta
    - property: og:title
      content: "stancl/tenancy Tutorial: Getting Started"
  - - meta
    - property: og:description
      content: "A hands-on stancl tenancy tutorial: install stancl/tenancy 3, create a Tenant model, add tenant migrations and routes, and create your first tenant database."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/stancl-tenancy-tutorial.html
  - - meta
    - name: twitter:title
      content: "stancl/tenancy Tutorial: Getting Started"
  - - meta
    - name: twitter:description
      content: "A hands-on stancl tenancy tutorial: install stancl/tenancy 3, create a Tenant model, add tenant migrations and routes, and create your first tenant database."
---

# stancl/tenancy Tutorial: Build Your First Multi-Database Tenant in Laravel

<BlogPostMeta />

[stancl/tenancy](https://tenancyforlaravel.com) is the package most Laravel teams reach for when they need multi-tenancy. This **stancl tenancy tutorial** takes a fresh Laravel app to a working multi-database setup: install the package, register it, create a `Tenant` model, add tenant migrations and routes, then create a tenant and watch its database appear.

It uses version 3 of the package (3.10 at the time of writing), which supports Laravel 10 through 13. For the bigger picture of how the pieces fit together, see [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## What you will have at the end

- A central app on `localhost` for your marketing site, sign-up and admin
- Tenants on their own hosts, such as `acme.localhost`
- One database per tenant, created and migrated automatically when you create the tenant
- A clear split between central and tenant migrations and routes

## Step 1: Install stancl/tenancy

Require the package and run its installer:

```bash
composer require stancl/tenancy
php artisan tenancy:install
```

The installer publishes everything you need and creates one folder:

| File or folder | Purpose |
| --- | --- |
| `config/tenancy.php` | Tenant model, central domains, bootstrappers, database naming |
| `routes/tenant.php` | Routes that run inside a tenant |
| `app/Providers/TenancyServiceProvider.php` | Event listeners, including the tenant creation pipeline |
| Two migrations | The central `tenants` and `domains` tables |
| `database/migrations/tenant` | Migrations that run in every tenant database |

## Step 2: Register the service provider

The installer creates `TenancyServiceProvider` but does not register it. On Laravel 11 and later, add it to `bootstrap/providers.php`:

```php
return [
    App\Providers\AppServiceProvider::class,
    App\Providers\TenancyServiceProvider::class,
];
```

Skipping this step is the most common reason nothing happens when you create a tenant: the provider is what listens for `TenantCreated` and creates the database.

## Step 3: Create your Tenant model

The package ships a base `Tenant` model, but for database-per-tenant you want your own model that knows about databases and domains:

```php
namespace App\Models;

use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains;
}
```

Then point the config at it:

```php
// config/tenancy.php
'tenant_model' => \App\Models\Tenant::class,
```

The `tenants` table has an `id`, timestamps and a `data` JSON column. Attributes that are not real columns are stored in `data` automatically, so `Tenant::create(['plan' => 'pro'])` just works. If you add real columns to the migration (for example `company`), list them in a static `getCustomColumns()` method on the model, including `id`.

## Step 4: Check the database settings

stancl/tenancy creates tenant databases on the same server as your central connection, using that connection as a template. Two settings in `config/tenancy.php` matter:

- `database.central_connection` defaults to `env('DB_CONNECTION', 'central')`. It must be the name of the connection your central app uses, for example `mysql` or `pgsql`.
- `database.prefix` and `database.suffix` build the database name: prefix + tenant ID + suffix. With the default prefix, tenant `acme` gets the database `tenantacme`.

The database user in your `.env` needs permission to create and drop databases. If two apps share one server, give each a different prefix before you create the first tenant, so their tenant databases never clash.

MySQL, MariaDB, PostgreSQL and SQLite are supported out of the box. With SQLite, each tenant database is a file in the `database` folder.

## Step 5: Run the central migrations

```bash
php artisan migrate
```

This creates the `tenants` and `domains` tables, along with your normal central tables, in the central database.

## Step 6: Add tenant migrations

Anything in `database/migrations/tenant` runs in every tenant database. Most apps want users inside the tenant, so copy Laravel's users migration there:

```bash
cp database/migrations/0001_01_01_000000_create_users_table.php database/migrations/tenant/
```

Keep the original too if your central app has its own users, such as platform admins. From now on, decide for every new migration whether it belongs to the central app or to tenants. [Tenant Migrations and Seeders in Laravel](/blog/laravel-tenant-migrations-seeders.html) goes deeper into that split, seeding and deployments.

## Step 7: Add a tenant route

`routes/tenant.php` already contains an example group with `InitializeTenancyByDomain` and `PreventAccessFromCentralDomains`. Replace the example route with something that proves which database you are in:

```php
Route::get('/', function () {
    return 'Tenant '.tenant('id').' has '.\App\Models\User::count().' users';
});
```

`tenant('id')` reads an attribute of the current tenant. How the domain lookup works, and which identification middleware to choose, is covered in [Laravel Multi-Tenancy with Subdomains](/blog/laravel-multi-tenancy-subdomains.html).

## Step 8: Create your first tenant

Open Tinker and create a tenant with a domain:

```php
$tenant = App\Models\Tenant::create(['id' => 'acme']);

$tenant->domains()->create(['domain' => 'acme.localhost']);
```

Creating the tenant fires `TenantCreated`. In the published provider, that event runs a job pipeline:

```php
Events\TenantCreated::class => [
    JobPipeline::make([
        Jobs\CreateDatabase::class,
        Jobs\MigrateDatabase::class,
        // Jobs\SeedDatabase::class,
    ])->send(fn (Events\TenantCreated $event) => $event->tenant)
      ->shouldBeQueued(false),
],
```

So the `tenantacme` database now exists and has a `users` table. If you leave out the `id`, the default `id_generator` gives the tenant a UUID instead.

Start the dev server with `php artisan serve` and open `http://acme.localhost:8000`. Chrome and Firefox resolve `*.localhost` to your own machine, so you should see "Tenant acme has 0 users". If your browser does not, add the host to `/etc/hosts` or use a local tool with wildcard subdomains. `http://localhost:8000` is a central domain in the default config, so tenant routes return a 404 there.

## Step 9: Run code in a tenant from anywhere

Outside a tenant request, for example in a command or on an admin page, use `run()` to execute code inside a tenant:

```php
$tenant->run(function () {
    \App\Models\User::factory()->create(); // written to tenantacme
});
```

`run()` initializes tenancy, calls your closure and then returns to the previous context. The reverse also exists: `tenancy()->central(fn () => ...)` runs a closure in the central context while you are inside a tenant.

## What the bootstrappers switch for you

When tenancy starts, the bootstrappers listed in `config/tenancy.php` make parts of Laravel tenant-aware. By default that is the database connection, the cache, the `local` and `public` disks, and queued jobs. The Redis bootstrapper is available but commented out. Each one has its own behaviour and pitfalls, which [Tenant-Aware Cache and File Storage](/blog/laravel-tenant-cache-filesystem.html) explains in detail.

## Common mistakes when following a stancl/tenancy tutorial

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Creating a tenant creates no database | Provider not registered | Add `TenancyServiceProvider` to `bootstrap/providers.php` |
| `CREATE DATABASE` permission error | Database user lacks privileges | Grant create and drop rights to the app's user |
| Tenant tables are missing | Migration is in `database/migrations` | Move it to `database/migrations/tenant` and run `php artisan tenants:migrate` |
| Your central home page returns a 404 | The tenant `/` route replaces the central `/` route, which has no domain | Wrap central routes in `Route::domain()` for each central domain |
| Production shows your real domain as a tenant | `central_domains` still lists only `127.0.0.1` and `localhost` | Add your production domain |

For the central route fix, a small loop in `routes/web.php` is enough:

```php
foreach (config('tenancy.central_domains') as $domain) {
    Route::domain($domain)->group(function () {
        Route::get('/', fn () => view('welcome'));
    });
}
```

## Frequently asked questions

### Does stancl/tenancy work with Laravel 13?

Yes. Version 3.10 of the package supports Laravel 10, 11, 12 and 13. Install it with Composer as shown above; no extra configuration is needed for the Laravel version.

### Can tenants use auto-increment IDs instead of UUIDs?

Yes. Set `id_generator` to `null` in `config/tenancy.php` and change the `id` column in the tenants migration, and `tenant_id` in the domains migration, to integers. Database names then become `tenant1`, `tenant2` and so on.

### Should the tenant creation pipeline be queued?

The published provider runs it synchronously, and its comment suggests queuing it in production. Queuing keeps sign-up fast, but the tenant is only usable once the worker has finished, and jobs must not rely on the HTTP request.

### Can each tenant have its own database user?

Yes. For MySQL, switch the `mysql` manager in `config/tenancy.php` to `PermissionControlledMySQLDatabaseManager`. It creates a database user per tenant with grants limited to that tenant's database.

## How SaaS Laravel sets this up

The [SaaS Laravel starter kits](/) run stancl/tenancy 3 in multi-database mode with everything from this tutorial already done. The `App\Models\Tenant` model uses auto-increment IDs with real columns for company and contact details, tenant domains are subdomains of `APP_DOMAIN`, and the creation pipeline creates the database, runs the tenant migrations, seeds roles, permissions and menus, and creates the tenant's first admin. Tenants are created and managed from a central admin screen. See the [multi-tenancy documentation](/docs/core/multi-tenancy.html) for the details.

<BlogPostCta title="Skip the setup, keep the control" text="SaaS Laravel ships stancl/tenancy already configured: database per tenant, subdomain identification, provisioning pipeline and tenant admin, in Vue, React or Svelte." />
