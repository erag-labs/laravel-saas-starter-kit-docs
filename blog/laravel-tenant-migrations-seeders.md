---
title: "Tenant Migrations and Seeders in Laravel"
description: "Laravel tenant migrations and seeders with stancl/tenancy: central vs tenant folders, tenants:migrate, safe deployments, idempotent seeders and fixing failures."
pageClass: blog-page
date: 2026-09-29
author: erag
category: multi-tenancy
tags: [Multi-tenancy, Database]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-tenant-migrations-seeders.html
  - - meta
    - property: og:title
      content: "Tenant Migrations and Seeders in Laravel"
  - - meta
    - property: og:description
      content: "Laravel tenant migrations and seeders with stancl/tenancy: central vs tenant folders, tenants:migrate, safe deployments, idempotent seeders and fixing failures."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-tenant-migrations-seeders.html
  - - meta
    - name: twitter:title
      content: "Tenant Migrations and Seeders in Laravel"
  - - meta
    - name: twitter:description
      content: "Laravel tenant migrations and seeders with stancl/tenancy: central vs tenant folders, tenants:migrate, safe deployments, idempotent seeders and fixing failures."
---

# Laravel Tenant Migrations and Seeders: Keeping Every Tenant Database in Sync

<BlogPostMeta />

Once each tenant has its own database, a schema change stops being a single `php artisan migrate`. You run it once for the central database and once for every tenant database, and all of them have to end up in the same state. In our experience, **Laravel tenant migrations** and seeders are where database-per-tenant apps most often break during a deploy.

We use [stancl/tenancy](https://tenancyforlaravel.com) version 3 throughout. Below we look at which folder a migration belongs in, how `tenants:migrate` works, how to roll schema changes out to many tenants safely, how to write tenant seeders you can run again, and what to do when a migration fails halfway. Haven't installed the package yet? Start with our [stancl/tenancy tutorial](/blog/stancl-tenancy-tutorial.html).

## Central or tenant: choosing the right folder

stancl/tenancy splits migrations across two folders. `database/migrations` runs on the central database with `php artisan migrate`, and `database/migrations/tenant` runs on every tenant database with `php artisan tenants:migrate`.

Putting a migration in the wrong folder doesn't fail. It quietly creates the table in the wrong place, and you only find out when a query can't see it. So for each table we ask one question: **does this data belong to the platform or to a customer?**

| Table | Folder | Why |
| --- | --- | --- |
| `tenants`, `domains`, plans | Central | Describes customers, not their data |
| Projects, invoices, customer users | Tenant | Owned by one customer |
| Platform admin users | Central | Your staff, not a customer's |
| Roles and permissions, cache, sessions | Often both | Both contexts use them |

A table that both contexts need has to exist in both folders. Having a copy of the migration in each is normal. It isn't duplication you need to clean up.

## How Laravel tenant migrations run with tenants:migrate

`tenants:migrate` extends Laravel's own `migrate` command. For each tenant it initializes tenancy, which switches the default connection to that tenant's database, and then runs an ordinary migration. Every tenant database has its own `migrations` table, so each tenant tracks its own progress.

Its options come from `migration_parameters` in `config/tenancy.php`:

```php
'migration_parameters' => [
    '--force' => true, // needed to run in production
    '--path' => [database_path('migrations/tenant')],
    '--realpath' => true,
],
```

Because `--path` is an array, a modular app can add one tenant migration folder per module. These are the commands you'll reach for most often:

| Command | What it does |
| --- | --- |
| `php artisan tenants:migrate` | Migrate every tenant |
| `php artisan tenants:migrate --tenants=acme` | Migrate one tenant (repeat the option for more) |
| `php artisan tenants:migrate --tenants=acme --pretend` | Print the SQL without running it |
| `php artisan tenants:rollback --step=1` | Roll back the last migration in every tenant |
| `php artisan tenants:migrate-fresh --tenants=acme` | Wipe the tenant database and migrate it again |
| `php artisan tenants:run your:command` | Run any Artisan command once per tenant |

Be careful with `tenants:migrate-fresh`. It drops every table in the tenant database, so treat it like `migrate:fresh`: fine on your laptop, never on a customer's database.

New tenants don't need a manual run. The default `TenantCreated` pipeline includes a `MigrateDatabase` job that calls `tenants:migrate` for the new tenant.

## Rolling out schema changes across tenants

On deploy, migrate the central database first and the tenants second:

```bash
php artisan migrate --force
php artisan tenants:migrate
```

The tenant command works through tenants one at a time, and an exception stops the loop. If tenant 40 of 200 fails, tenants 1 to 39 are migrated and 41 to 200 aren't. **Your app is now running new code against two different schemas**, and you need to plan for that.

The main defence is making migrations backwards compatible, so new code works with the old schema and old code works with the new one. Renaming a column, for example, becomes a sequence: add the new column, deploy code that writes to both, backfill, and drop the old column in a later release. It's slower, but we think it's the only approach that holds up when a deploy stops halfway.

Watch out for long locks as well. Adding an index to a large table can block writes, and with many tenants a slow migration is slow many times over. Try changes on real data before they go out: run `--pretend` against one tenant, then run the migration on a copy of your largest tenant database.

If something does fail, fix it and run `tenants:migrate` again for all tenants. Migrations that already ran are skipped.

A few tenant-aware tests make it easier to cover both schemas in your test suite. [Testing Multi-Tenant Laravel Apps with Pest](/blog/test-multi-tenant-laravel-pest.html) walks through how to write them.

## Tenant seeders

`tenants:seed` runs a seeder in every tenant database. Which class it runs comes from `seeder_parameters` in `config/tenancy.php`, and the default is `DatabaseSeeder`. We point it at a separate tenant seeder so central and tenant data stay apart, and most apps do the same:

```php
'seeder_parameters' => [
    '--class' => \Database\Seeders\TenantDatabaseSeeder::class,
    '--force' => true,
],
```

Don't skip that `--force` line. In the `production` environment, Laravel's seed command asks for confirmation. When nobody's there to answer, as inside the tenant creation pipeline, the answer is "no" and seeding is cancelled without an exception. The package's published config ships with this line commented out, along with a note saying it's needed in production.

To seed new tenants automatically, uncomment `Jobs\SeedDatabase::class` after `Jobs\MigrateDatabase::class` in the `TenantCreated` pipeline of `TenancyServiceProvider`. You can also run one specific seeder for every tenant with `php artisan tenants:seed --class="Database\Seeders\PermissionSeeder"`.

### Write seeders you can run twice

Tenant seeders run when a tenant is created, and again whenever you add reference data for existing tenants. Write them so that a second run changes nothing:

```php
public function run(): void
{
    foreach (['admin', 'member', 'viewer'] as $name) {
        Role::findOrCreate($name, 'web');
    }

    Setting::updateOrCreate(['key' => 'timezone'], ['value' => 'UTC']);
}
```

`findOrCreate`, `firstOrCreate` and `updateOrCreate` are all safe to repeat. A plain `create()` will either fail on a unique index or insert duplicates.

### One seeder for both contexts

Some seeders make sense both centrally and inside tenants, with small differences. `tenancy()->initialized` tells you which context you're in:

```php
$guard = tenancy()->initialized ? 'tenant' : 'web';

Permission::findOrCreate('View Reports', $guard);
```

### Reference data, not demo data

Keep demo users and sample records out of the seeder that runs for real customers. A seeded `admin@example.com` with a known password in every production tenant is a security hole. Put demo data in its own seeder that you only call locally, or guard it with `app()->environment('local')`.

## Adding data to tenants that already exist

Say a new release adds a permission that every tenant needs. There are two ways to get it into existing tenant databases:

| Option | Good for | Watch out for |
| --- | --- | --- |
| Run `tenants:seed --class=...` in your deploy script | Reference data such as roles, permissions, menus | You must remember to run it once |
| A migration in `database/migrations/tenant` that inserts the rows | Data that must exist before the new code runs | Keep it idempotent, just like a seeder |

We usually prefer the data migration, for one reason: it runs exactly once per tenant and is tracked in that tenant's `migrations` table. New tenants then get the data from the seeder, and existing tenants get it from the migration.

## When a migration fails during tenant creation

`TenantCreated` fires **after** the tenant row is saved. If `CreateDatabase` succeeds but a migration then throws, you're left with a tenant row, a half-migrated database and a failed request.

Fix the migration first, then finish the job for that tenant:

```bash
php artisan tenants:migrate --tenants=acme
php artisan tenants:seed --tenants=acme
```

If the tenant shouldn't exist at all, delete it through the model so its database gets dropped too. And if you queue the pipeline, keep in mind that jobs and seeders then run in a worker without the HTTP request, so they can't read form input. Our post on [queued jobs in a multi-tenant Laravel app](/blog/laravel-multi-tenant-queues.html) goes into that in detail.

## Frequently asked questions

### Do tenant migrations run automatically for new tenants?

Yes, as long as the `TenantCreated` pipeline in `TenancyServiceProvider` includes `MigrateDatabase`, which the published provider does by default. Existing tenants still need `php artisan tenants:migrate` on every deploy.

### Why does tenants:seed do nothing in production?

When `APP_ENV` is `production`, the seed command asks for confirmation, and without an interactive terminal it's cancelled. Add `'--force' => true` to `seeder_parameters` in `config/tenancy.php`, or pass `--force` on the command line.

### Can I keep tenant migrations inside my modules?

Yes. Add each module's tenant migration folder to the `--path` array in `migration_parameters`, and `tenants:migrate` will run all of them.

### How do I see which migrations a tenant is missing?

Use `tenants:run` to call Laravel's status command for each tenant: `php artisan tenants:run migrate:status --option="path=database/migrations/tenant"`. Each tenant's output starts with its ID.

## How SaaS Laravel handles tenant migrations and seeders

In the [SaaS Laravel starter kits](/), tenant migrations live in `database/migrations/tenant` and cover tenant users, passkeys, menus and layouts, cache, jobs and the permission tables. Tables that both contexts need exist in both folders. Creating a tenant runs a pipeline that creates the database, migrates it, runs `TenantDatabaseSeeder` (roles, tenant permissions, tenant menus and default users) and creates the tenant's first admin. `RoleSeeder` and `PermissionSeeder` check `tenancy()->initialized` to pick the `web` or `tenant` guard, so the same seeders work in both contexts. You'll find the details in the [central and tenant database docs](/docs/core/database.html), and the [multi-tenant SaaS overview](/blog/multi-tenant-saas-laravel-database-per-tenant.html) shows where this fits in the whole app.

<BlogPostCta title="Tenant databases that set themselves up" text="SaaS Laravel creates, migrates and seeds every new tenant database with roles, permissions, menus and a first admin, in Vue, React or Svelte." />
