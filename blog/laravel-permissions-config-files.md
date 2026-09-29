---
title: "Laravel Permissions Seeder with Config Files"
description: "Build a Laravel permissions seeder driven by config files: file layout, idempotent seeding, role defaults, pruning old permissions, tenants and safe deploys."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Permissions, Database]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-permissions-config-files.html
  - - meta
    - property: og:title
      content: "Laravel Permissions Seeder with Config Files"
  - - meta
    - property: og:description
      content: "Build a Laravel permissions seeder driven by config files: file layout, idempotent seeding, role defaults, pruning old permissions, tenants and safe deploys."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-permissions-config-files.html
  - - meta
    - name: twitter:title
      content: "Laravel Permissions Seeder with Config Files"
  - - meta
    - name: twitter:description
      content: "Build a Laravel permissions seeder driven by config files: file layout, idempotent seeding, role defaults, pruning old permissions, tenants and safe deploys."
---

# Config-Driven Permissions in Laravel: A Permissions Seeder That Scales

<BlogPostMeta />

Most apps start with a seeder full of `Permission::create()` calls. It works for ten permissions and becomes a mess at sixty. A **Laravel permissions seeder** that reads config files keeps the full list in one reviewable place, runs safely on every deploy and tells you at a glance which role gets what.

This guide walks through the file layout, the seeder itself, granting defaults to roles, removing permissions you no longer need, tenants, deploys and a test that keeps routes and config in sync. It uses `spatie/laravel-permission`; the basics of the package are in [Laravel Roles and Permissions with Spatie](/blog/laravel-roles-permissions-spatie.html).

## Why hard-coded permission seeders stop scaling

A hand-written seeder has a few predictable problems:

- **It isn't idempotent.** `Permission::create()` throws `PermissionAlreadyExists` the second time it runs, so the seeder only works on an empty database.
- **Names are scattered.** The same string appears in the seeder, in route middleware and in the frontend. One typo creates a permission nobody has.
- **Role grants are hard to read.** A long list of `givePermissionTo()` calls doesn't show at a glance what a manager may do.
- **Everyone edits one file.** Two features that add permissions in the same week collide in the same seeder.

Moving the *data* into config files and keeping the *logic* in one small seeder fixes all four.

## Designing the permission config files

Create one file per feature in `config/permissions/`. Each entry maps a permission name to the roles that get it by default:

```php
// config/permissions/projects.php
return [
    'View Projects' => ['admin', 'manager', 'member'],
    'Create Project' => ['admin', 'manager'],
    'Archive Project' => ['admin', 'manager'],
    'Delete Project' => ['admin'],
];
```

A feature's permissions now live in one short file that shows up in the pull request that adds the feature. A few design choices are worth making on purpose:

| Decision | Option A | Option B |
| --- | --- | --- |
| Entry shape | Name ⇒ roles map (compact) | List of arrays (room for a description or guard) |
| Role reference | Role name, e.g. `admin` | Display label, e.g. `Admin` |
| Permission naming | Human-readable, e.g. `Create Project` | Dotted, e.g. `projects.create` |

Referencing roles by their stored **name** is the safer default: labels are for people and tend to be translated or reworded later. Whatever you pick for naming, pick it once. Mixing styles makes permissions hard to find.

### Reading nested config directories

Laravel loads config files in subdirectories too. `config/permissions/projects.php` becomes `config('permissions.projects')`, and `config/permissions/tenant/projects.php` becomes `config('permissions.tenant.projects')`. Because they're normal config, `php artisan config:cache` includes them.

One thing to watch: `config('permissions')` returns the `tenant` folder as a nested key as well, so exclude it when you loop over the central groups. The file name doubles as a group name, which is handy for grouping checkboxes in an "assign permissions" dialog.

## Writing the Laravel permissions seeder

The seeder only has to turn every entry into a database row for the right guard:

```php
class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $groups = Arr::except(config('permissions', []), ['tenant']);

        foreach (collect($groups)->collapse()->keys() as $name) {
            Permission::findOrCreate($name, 'web');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
```

- **`findOrCreate()`** makes the seeder idempotent. Run it on every deploy and it only adds what's new.
- **`collapse()`** merges all feature files into one name ⇒ roles map. If two files define the same name, you have a naming conflict to fix, not a feature.
- **The explicit guard** avoids surprises when your app has more than one guard.
- **The cache reset** matters because seeders often run without model events. If your `DatabaseSeeder` uses Laravel's `WithoutModelEvents` trait, the package's automatic cache flush (which listens to model events) never fires. Without the reset, a new permission can look "missing" until the cache expires.

## Granting default permissions to roles

Creating permissions is half the job; roles need their defaults too. Build the matrix once and sync each role:

```php
$matrix = collect($groups)->collapse();

Role::query()->where('guard_name', 'web')->get()->each(function (Role $role) use ($matrix): void {
    $role->syncPermissions(
        $matrix->filter(fn (array $roles) => in_array($role->name, $roles, true))->keys()->all()
    );
});
```

Before you ship this, decide **who owns role permissions** after the first deploy:

| Model | What the seeder does | Good for |
| --- | --- | --- |
| Config owns them | `syncPermissions()` on every run; UI changes are overwritten | Fixed roles that customers can't customize |
| The database owns them | Grants defaults only for permissions created in this run | Admins who tweak roles in a UI |
| Users own them | Defaults are copied to the user when a role is assigned | Fine-tuning single users without new roles |

The first model is the simplest and the most predictable. The second needs the seeder to remember which permissions are new, for example by checking `wasRecentlyCreated` on the model that `findOrCreate()` returns. The third assigns permissions directly to users; changing the config then only affects users whose role is assigned again.

## Removing permissions you no longer need

A seeder that only adds never cleans up. When a feature is removed, its permissions stay behind and keep appearing in your UI. Prune them in a separate, deliberate step, such as an Artisan command that asks for confirmation:

```php
$known = collect(Arr::except(config('permissions', []), ['tenant']))->collapse()->keys();

Permission::query()
    ->where('guard_name', 'web')
    ->whereNotIn('name', $known)
    ->get()
    ->each->delete();

app(PermissionRegistrar::class)->forgetCachedPermissions();
```

The package's migration adds cascading foreign keys to its pivot tables, so a deleted permission also disappears from roles and users.

**Renaming is not the same as removing.** Changing a name in config and re-running the seeder creates a new permission and orphans the old one, and every user loses access until someone grants the new name. Rename with a migration that updates the `name` column instead, then reset the cache.

## Tenants and multiple guards

With a database per tenant, keep tenant permissions in their own folder, `config/permissions/tenant/`, and let the seeder pick the folder and guard based on context. With stancl/tenancy you can check `tenancy()->initialized` and then seed every tenant at once:

```bash
php artisan tenants:seed --class="Database\Seeders\PermissionSeeder"
```

Keeping the seeder separate from your full tenant seeder means adding a permission never re-runs demo data or other seeders. More on this in [tenant migrations and seeders](/blog/laravel-tenant-migrations-seeders.html).

## Seeding permissions on deploy

Add the seeder to your deployment script, after migrations:

```bash
php artisan migrate --force
php artisan config:cache
php artisan db:seed --class=PermissionSeeder --force
```

The order matters. If the seeder reads permissions through `config()`, cache the new config *before* seeding, or it will read the list from the previous release. `--force` is required because Laravel asks for confirmation before seeding in production. The rest of the server setup is covered in [deploying a Laravel SaaS](/blog/deploy-laravel-saas.html).

## A test that keeps routes and config in sync

The config files are your source of truth, so check that every route uses a permission that exists in them:

```php
it('only protects routes with configured permissions', function () {
    $known = collect(Arr::except(config('permissions'), ['tenant']))->collapse()->keys();

    collect(Route::getRoutes())
        ->flatMap(fn ($route) => $route->gatherMiddleware())
        ->filter(fn ($m) => is_string($m) && str_starts_with($m, 'permission:'))
        ->flatMap(fn ($m) => explode('|', Str::before(Str::after($m, 'permission:'), ',')))
        ->each(fn ($name) => expect($known)->toContain($name));
});
```

A typo in `permission:Creat Project` now fails CI instead of locking out every user.

## Frequently asked questions

### Should permissions live in config files or in the database?

Both. Config files define which permissions *exist*, because your code depends on those names. The database stores them so Spatie can check them and so admins can assign them. The seeder is the bridge between the two.

### Do I need to re-run the seeder after adding a permission?

Yes. Adding a line to a config file doesn't create a database row. Run the seeder locally, include it in your deploy script, and run it for every tenant if the permission is tenant-level.

### How do I rename a permission without breaking users?

Write a migration that updates the `name` in the `permissions` table, change the config and every place that uses the old name in the same release, and reset the permission cache. Existing role and user assignments keep working because they point to the permission's ID.

### Does config caching affect permission config files?

Yes, in the good way: nested config files are part of the cached config. Just re-run `php artisan config:cache` on deploy before seeding, so the seeder sees the new files.

## How SaaS Laravel seeds permissions from config

The [SaaS Laravel starter kits](/) keep permissions in `config/permissions/*.php` for the central app and `config/permissions/tenant/*.php` for tenants, with one file per group. Each entry has a `permission_name` and `associated_roles` (system role labels). `PermissionService::getGroupedPermissions()` reads the right folder for the current context and groups permissions by file name, with translated group labels for the **Assign permissions** dialog. `PermissionSeeder` calls `findOrCreate()` with the `web` or `tenant` guard and resets the cache, and when a system role is assigned, its defaults are given to the user directly. The steps for adding a permission are in the [users, roles and permissions docs](/docs/core/users-roles-permissions.html#adding-a-permission), and the [super admin guide](/blog/laravel-super-admin-role.html) explains how the bypass role fits in.

<BlogPostCta title="Permissions defined in one place" text="SaaS Laravel ships config-driven Spatie permissions for the central app and every tenant, with an idempotent seeder, in Vue, React or Svelte." />
