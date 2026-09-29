---
title: "Laravel Permissions Seeder with Config Files"
description: "Build a Laravel permissions seeder driven by config files: file layout, idempotent seeding, role defaults, pruning old permissions, tenants and safe deploys."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: permissions
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

Most apps start with a seeder full of `Permission::create()` calls. That's fine at ten permissions. At sixty it's a mess. I much prefer a Laravel permissions seeder that reads config files: the full list sits in one place you can review, it runs safely on every deploy, and you can see at a glance which role gets what.

Below is the file layout I use, the seeder, how to grant defaults to roles, how to remove permissions you don't need anymore, tenants, deploys, and a test that keeps routes and config in sync. It's all built on `spatie/laravel-permission`. If you need the package basics first, read [Laravel Roles and Permissions with Spatie](/blog/laravel-roles-permissions-spatie.html).

## Why hard-coded permission seeders stop scaling

The first problem is that a hand-written seeder isn't idempotent. `Permission::create()` throws `PermissionAlreadyExists` the second time it runs, so the seeder only works against an empty database.

Then the names get scattered. The same string shows up in the seeder, in route middleware and in the frontend, and one typo creates a permission that nobody has. Role grants are hard to read too, because a long run of `givePermissionTo()` calls doesn't tell you what a manager is allowed to do. And everybody edits the same file, so two features that add permissions in the same week collide in one seeder.

Move the *data* into config files, keep the *logic* in one small seeder, and all four problems go away.

## Designing the permission config files

I create one file per feature in `config/permissions/`. Each entry maps a permission name to the roles that get it by default:

```php
// config/permissions/projects.php
return [
    'View Projects' => ['admin', 'manager', 'member'],
    'Create Project' => ['admin', 'manager'],
    'Archive Project' => ['admin', 'manager'],
    'Delete Project' => ['admin'],
];
```

Now a feature's permissions live in one short file, and that file shows up in the same pull request as the feature. There are a few choices you should make on purpose rather than by accident:

| Decision | Option A | Option B |
| --- | --- | --- |
| Entry shape | Name ⇒ roles map (compact) | List of arrays (room for a description or guard) |
| Role reference | Role name, e.g. `admin` | Display label, e.g. `Admin` |
| Permission naming | Human-readable, e.g. `Create Project` | Dotted, e.g. `projects.create` |

I'd reference roles by their stored **name**. Labels are for people, and people translate and reword them later. For permission naming, either style works, but pick one and stick to it. Mixed styles make permissions hard to find.

### Reading nested config directories

Laravel loads config files from subdirectories as well. `config/permissions/projects.php` becomes `config('permissions.projects')`, and `config/permissions/tenant/projects.php` becomes `config('permissions.tenant.projects')`. They're normal config files, so `php artisan config:cache` picks them up.

Watch out for one thing: `config('permissions')` also returns the `tenant` folder as a nested key, so exclude it when you loop over the central groups. The file name doubles as a group name, which comes in handy when you group checkboxes in an "assign permissions" dialog.

## Writing the Laravel permissions seeder

All the seeder has to do is turn each entry into a database row for the right guard:

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

`findOrCreate()` is what makes it idempotent. Run it on every deploy and it only adds what's new. `collapse()` merges all the feature files into one name ⇒ roles map; if two files define the same name, that's a naming conflict you need to fix, not a feature. Passing the guard explicitly saves you from surprises once the app has more than one guard.

The cache reset at the end is the part people usually leave out. Seeders often run without model events. If your `DatabaseSeeder` uses Laravel's `WithoutModelEvents` trait, the package's automatic cache flush (which listens to model events) never fires, and a brand-new permission can look "missing" until the cache expires.

## Granting default permissions to roles

Creating permissions is only half the job. Roles need their defaults too. Build the matrix once and sync each role:

```php
$matrix = collect($groups)->collapse();

Role::query()->where('guard_name', 'web')->get()->each(function (Role $role) use ($matrix): void {
    $role->syncPermissions(
        $matrix->filter(fn (array $roles) => in_array($role->name, $roles, true))->keys()->all()
    );
});
```

Before shipping this, decide **who owns role permissions** after the first deploy:

| Model | What the seeder does | Good for |
| --- | --- | --- |
| Config owns them | `syncPermissions()` on every run; UI changes are overwritten | Fixed roles that customers can't customize |
| The database owns them | Grants defaults only for permissions created in this run | Admins who tweak roles in a UI |
| Users own them | Defaults are copied to the user when a role is assigned | Fine-tuning single users without new roles |

If your roles are fixed, go with the first one. It's the simplest and the most predictable. The second needs the seeder to remember which permissions are new, for example by checking `wasRecentlyCreated` on the model `findOrCreate()` returns. The third assigns permissions straight to users, which means a config change only reaches users whose role gets assigned again.

## Removing permissions you no longer need

A seeder that only adds never cleans up. Remove a feature and its permissions hang around in your UI. I prune them in a separate, deliberate step, like an Artisan command that asks for confirmation:

```php
$known = collect(Arr::except(config('permissions', []), ['tenant']))->collapse()->keys();

Permission::query()
    ->where('guard_name', 'web')
    ->whereNotIn('name', $known)
    ->get()
    ->each->delete();

app(PermissionRegistrar::class)->forgetCachedPermissions();
```

The package's migration puts cascading foreign keys on its pivot tables, so a deleted permission also disappears from roles and users.

**Renaming isn't the same as removing.** Change a name in config, re-run the seeder, and you get a new permission plus an orphaned old one. Every user loses access until somebody grants the new name. Rename with a migration that updates the `name` column instead, then reset the cache.

## Tenants and multiple guards

With a database per tenant, I keep tenant permissions in their own folder, `config/permissions/tenant/`, and let the seeder choose the folder and guard based on context. With stancl/tenancy you can check `tenancy()->initialized`, then seed every tenant in one go:

```bash
php artisan tenants:seed --class="Database\Seeders\PermissionSeeder"
```

Keep this seeder separate from your full tenant seeder. That way adding a permission never re-runs demo data or anything else. There's more on this in [tenant migrations and seeders](/blog/laravel-tenant-migrations-seeders.html).

## Seeding permissions on deploy

Add the seeder to your deploy script, after migrations:

```bash
php artisan migrate --force
php artisan config:cache
php artisan db:seed --class=PermissionSeeder --force
```

Order matters here. If the seeder reads permissions through `config()`, cache the new config *before* seeding, or it'll read the list from the previous release. You need `--force` because Laravel asks for confirmation before seeding in production. The rest of the server setup is in [deploying a Laravel SaaS](/blog/deploy-laravel-saas.html).

## Catching permission typos in CI

Since the config files are your source of truth, test that every route uses a permission that exists in them:

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

Now a typo like `permission:Creat Project` fails CI instead of locking every user out.

## Frequently asked questions

### Should permissions live in config files or in the database?

Both. Config files define which permissions *exist*, because your code depends on those names. The database stores them so Spatie can check them and admins can assign them. The seeder connects the two.

### Do I need to re-run the seeder after adding a permission?

Yes. A new line in a config file doesn't create a database row. Run the seeder locally, put it in your deploy script, and run it for every tenant if it's a tenant-level permission.

### How do I rename a permission without breaking users?

Write a migration that updates the `name` in the `permissions` table. In the same release, change the config and every place that uses the old name, then reset the permission cache. Existing role and user assignments keep working because they point at the permission's ID.

### Does config caching affect permission config files?

Yes, and that's a good thing: nested config files are part of the cached config. Just re-run `php artisan config:cache` on deploy before seeding so the seeder sees the new files.

## How SaaS Laravel seeds permissions from config

If you'd rather not build this yourself, the [SaaS Laravel starter kits](/) already keep permissions in `config/permissions/*.php` for the central app and `config/permissions/tenant/*.php` for tenants, one file per group. Each entry has a `permission_name` and `associated_roles` (system role labels). `PermissionService::getGroupedPermissions()` reads the right folder for the current context and groups permissions by file name, with translated group labels for the Assign permissions dialog. `PermissionSeeder` calls `findOrCreate()` with the `web` or `tenant` guard and resets the cache, and when a system role is assigned, its defaults go to the user directly. The steps for adding a permission are in the [users, roles and permissions docs](/docs/core/users-roles-permissions.html#adding-a-permission), and the [super admin guide](/blog/laravel-super-admin-role.html) explains where the bypass role fits.

<BlogPostCta title="Permissions defined in one place" text="SaaS Laravel ships config-driven Spatie permissions for the central app and every tenant, with an idempotent seeder, in Vue, React or Svelte." />
