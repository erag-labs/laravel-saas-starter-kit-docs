---
title: "Tenant Migrations and Seeders in Laravel"
description: "Laravel tenant migrations and seeders with stancl/tenancy: central vs tenant folders, tenants:migrate, safe deployments, idempotent seeders and fixing failures."
pageClass: blog-page
date: 2026-09-29
author: erag
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

With a database per tenant, a schema change is no longer one `php artisan migrate`. It is one run for the central database and one for every tenant database, and they all need to end up in the same state. **Laravel tenant migrations** and seeders are where database-per-tenant apps most often break during a deployment.

This guide uses [stancl/tenancy](https://tenancyforlaravel.com) version 3. It covers which folder a migration belongs in, how `tenants:migrate` works, how to deploy schema changes to many tenants safely, how to write tenant seeders you can run again, and what to do when a migration fails halfway. If you have not installed the package yet, start with the [stancl/tenancy tutorial](/blog/stancl-tenancy-tutorial.html).

## Central or tenant: choosing the right folder

stancl/tenancy uses two folders:

- `database/migrations` runs on the central database with `php artisan migrate`.
- `database/migrations/tenant` runs on every tenant database with `php artisan tenants:migrate`.

A migration in the wrong folder does not fail. It creates the table in the wrong place, and you only notice when a query cannot find it. Ask one question per table: **does this data belong to the platform or to a customer?**

| Table | Folder | Why |
| --- | --- | --- |
| `tenants`, `domains`, plans | Central | Describes customers, not their data |
| Projects, invoices, customer users | Tenant | Owned by one customer |
| Platform admin users | Central | Your staff, not a customer's |
| Roles and permissions, cache, sessions | Often both | Both contexts use them |

Tables that both contexts need must exist in **both** folders. A copy of the migration in each folder is normal, not duplication to clean up.

## How Laravel tenant migrations run with tenants:migrate

`tenants:migrate` extends Laravel's own `migrate` command. For each tenant it initializes tenancy, which switches the default connection to that tenant's database, and then runs a normal migration. Each tenant database has its own `migrations` table, so every tenant tracks its own progress.

The options come from `migration_parameters` in `config/tenancy.php`:

```php
'migration_parameters' => [
    '--force' => true, // needed to run in production
    '--path' => [database_path('migrations/tenant')],
    '--realpath' => true,
],
```

`--path` is an array, so a modular app can add one tenant migration folder per module. The commands you will use most:

| Command | What it does |
| --- | --- |
| `php artisan tenants:migrate` | Migrate every tenant |
| `php artisan tenants:migrate --tenants=acme` | Migrate one tenant (repeat the option for more) |
| `php artisan tenants:migrate --tenants=acme --pretend` | Print the SQL without running it |
| `php artisan tenants:rollback --step=1` | Roll back the last migration in every tenant |
| `php artisan tenants:migrate-fresh --tenants=acme` | Wipe the tenant database and migrate it again |
| `php artisan tenants:run your:command` | Run any Artisan command once per tenant |

`tenants:migrate-fresh` drops every table in the tenant database. Treat it like `migrate:fresh`: fine on your laptop, never on a customer's database.

New tenants do not need a manual run. The default `TenantCreated` pipeline includes a `MigrateDatabase` job that calls `tenants:migrate` for the new tenant.

## Deploying schema changes to many tenants

On deploy, migrate the central database first, then the tenants:

```bash
php artisan migrate --force
php artisan tenants:migrate
```

The tenant command works through tenants **one at a time**, and an exception stops the loop. If tenant 40 of 200 fails, tenants 1 to 39 are migrated and 41 to 200 are not. Your app is now running new code against two different schemas. Plan for that:

- **Make migrations backwards compatible.** New code should work with the old schema and old code with the new one. To rename a column, add the new column, deploy code that writes to both, backfill, and drop the old column in a later release.
- **Avoid long locks.** Adding an index to a large table can block writes. With many tenants, a slow migration is slow many times over.
- **Try it on real data first.** Run `--pretend` against one tenant, then run the migration on a copy of your largest tenant database.
- **Re-run after a fix.** Migrations that already ran are skipped, so after fixing the problem you can run `tenants:migrate` again for all tenants.

Covering both schemas in your test suite is easier with a few tenant-aware tests, which [Testing Multi-Tenant Laravel Apps with Pest](/blog/test-multi-tenant-laravel-pest.html) walks through.

## Tenant seeders

`tenants:seed` runs a seeder in every tenant database. The class comes from `seeder_parameters` in `config/tenancy.php`, which defaults to `DatabaseSeeder`. Most apps point it at a separate tenant seeder so central and tenant data stay apart:

```php
'seeder_parameters' => [
    '--class' => \Database\Seeders\TenantDatabaseSeeder::class,
    '--force' => true,
],
```

Do not skip that `--force` line. In the `production` environment, Laravel's seed command asks for confirmation. When nobody can answer, for example inside the tenant creation pipeline, the answer is "no" and the seeding is cancelled without an exception. The package's published config has this line commented out with a note that it is needed in production.

To seed new tenants automatically, uncomment `Jobs\SeedDatabase::class` after `Jobs\MigrateDatabase::class` in the `TenantCreated` pipeline of `TenancyServiceProvider`. You can also run a single seeder for every tenant with `php artisan tenants:seed --class="Database\Seeders\PermissionSeeder"`.

### Write seeders you can run twice

Tenant seeders run when a tenant is created, and again whenever you add reference data for existing tenants. Write them so a second run changes nothing:

```php
public function run(): void
{
    foreach (['admin', 'member', 'viewer'] as $name) {
        Role::findOrCreate($name, 'web');
    }

    Setting::updateOrCreate(['key' => 'timezone'], ['value' => 'UTC']);
}
```

`findOrCreate`, `firstOrCreate` and `updateOrCreate` are safe to repeat. A plain `create()` will either fail on a unique index or insert duplicates.

### One seeder for both contexts

Some seeders make sense centrally and in tenants, but with small differences. `tenancy()->initialized` tells you which context you are in:

```php
$guard = tenancy()->initialized ? 'tenant' : 'web';

Permission::findOrCreate('View Reports', $guard);
```

### Reference data, not demo data

Keep demo users and sample records out of the seeder that runs for real customers. A seeded `admin@example.com` with a known password in every production tenant is a security hole. Put demo data in a separate seeder you only call locally, or guard it with `app()->environment('local')`.

## Adding data to tenants that already exist

Say a new release adds a permission every tenant needs. You have two options:

| Option | Good for | Watch out for |
| --- | --- | --- |
| Run `tenants:seed --class=...` in your deploy script | Reference data such as roles, permissions, menus | You must remember to run it once |
| A migration in `database/migrations/tenant` that inserts the rows | Data that must exist before the new code runs | Keep it idempotent, just like a seeder |

A data migration has one big advantage: it runs exactly once per tenant and is tracked in that tenant's `migrations` table. New tenants get the data from the seeder, existing tenants from the migration.

## When a migration fails during tenant creation

`TenantCreated` fires **after** the tenant row is saved. If `CreateDatabase` succeeds but a migration then throws, you have a tenant row, a half-migrated database and a failed request.

Fix the migration, then finish the job for that tenant:

```bash
php artisan tenants:migrate --tenants=acme
php artisan tenants:seed --tenants=acme
```

If the tenant should not exist at all, delete it through the model so the database is dropped as well. If you queue the pipeline, remember that jobs and seeders then run in a worker without the HTTP request, so they cannot read form input. [Queued Jobs in a Multi-Tenant Laravel App](/blog/laravel-multi-tenant-queues.html) covers that in detail.

## Frequently asked questions

### Do tenant migrations run automatically for new tenants?

Yes, as long as the `TenantCreated` pipeline in `TenancyServiceProvider` includes `MigrateDatabase`, which the published provider does by default. Existing tenants still need `php artisan tenants:migrate` on every deploy.

### Why does tenants:seed do nothing in production?

The seed command asks for confirmation when `APP_ENV` is `production`. Without an interactive terminal it is cancelled. Add `'--force' => true` to `seeder_parameters` in `config/tenancy.php`, or pass `--force` on the command line.

### Can I keep tenant migrations inside my modules?

Yes. Add each module's tenant migration folder to the `--path` array in `migration_parameters`. `tenants:migrate` then runs all of them.

### How do I see which migrations a tenant is missing?

Use `tenants:run` to call Laravel's status command per tenant: `php artisan tenants:run migrate:status --option="path=database/migrations/tenant"`. Each tenant's output starts with its ID.

## How SaaS Laravel handles tenant migrations and seeders

In the [SaaS Laravel starter kits](/), tenant migrations live in `database/migrations/tenant` and cover tenant users, passkeys, menus and layouts, cache, jobs and the permission tables. Tables both contexts need exist in both folders. Creating a tenant runs a pipeline that creates the database, migrates it, runs `TenantDatabaseSeeder` (roles, tenant permissions, tenant menus and default users) and creates the tenant's first admin. `RoleSeeder` and `PermissionSeeder` check `tenancy()->initialized` to pick the `web` or `tenant` guard, so the same seeders serve both contexts. The details are in the [central and tenant database docs](/docs/core/database.html), and the [multi-tenant SaaS overview](/blog/multi-tenant-saas-laravel-database-per-tenant.html) shows where this fits.

<BlogPostCta title="Tenant databases that set themselves up" text="SaaS Laravel creates, migrates and seeds every new tenant database with roles, permissions, menus and a first admin, in Vue, React or Svelte." />
