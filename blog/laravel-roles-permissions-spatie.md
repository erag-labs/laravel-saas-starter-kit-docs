---
title: "Laravel Roles and Permissions with Spatie"
description: "A practical Laravel Spatie permission guide: roles, permissions and guards, assigning and checking them, super admins, caching, seeding and Inertia UI checks."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: permissions
tags: [Permissions, Security]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-roles-permissions-spatie.html
  - - meta
    - property: og:title
      content: "Laravel Roles and Permissions with Spatie"
  - - meta
    - property: og:description
      content: "A practical Laravel Spatie permission guide: roles, permissions and guards, assigning and checking them, super admins, caching, seeding and Inertia UI checks."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-roles-permissions-spatie.html
  - - meta
    - name: twitter:title
      content: "Laravel Roles and Permissions with Spatie"
  - - meta
    - name: twitter:description
      content: "A practical Laravel Spatie permission guide: roles, permissions and guards, assigning and checking them, super admins, caching, seeding and Inertia UI checks."
---

# Laravel Roles and Permissions with Spatie: A Practical Guide

<BlogPostMeta />

Every SaaS app ends up asking the same thing on every request: *is this user allowed to do this?* For most Laravel apps, the answer comes from the Laravel Spatie permission package, `spatie/laravel-permission`. It keeps roles and permissions in your database and hooks into Laravel's own authorization, so `can()`, `@can` and the `can` middleware keep working the way you're used to.

I'll go through the concepts, assigning and checking roles and permissions, building a super admin, how the cache behaves, and showing or hiding buttons in an Inertia frontend. Everything here uses version 8 of the package.

## Roles, permissions and guards

There are three building blocks:

| Concept | What it is | Example |
| --- | --- | --- |
| Permission | A single thing a user may do | `Edit User`, `View Invoices` |
| Role | A named group of permissions | `admin`, `manager` |
| Guard | The auth guard a role or permission belongs to | `web`, `api` |

A user can get a permission through a role, directly, or both. My strong advice: **check permissions in your code, not roles**. "Can this user edit users?" still makes sense after you reorganize your roles. "Is this user an admin?" doesn't.

## Installing Laravel Spatie permission

Install the package, publish its config and migration, and migrate:

```bash
composer require spatie/laravel-permission
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
php artisan migrate
```

You get five tables: `permissions`, `roles`, `model_has_permissions`, `model_has_roles` and `role_has_permissions`. Next, add the `HasRoles` trait to your user model:

```php
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasRoles;
}
```

`HasRoles` pulls in `HasPermissions` as well, so the user gets both sets of methods.

### Register the middleware aliases

The package ships `RoleMiddleware`, `PermissionMiddleware` and `RoleOrPermissionMiddleware`, but it doesn't register short aliases for them. On Laravel 11 and later, add them in `bootstrap/app.php`:

```php
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;

->withMiddleware(function (Middleware $middleware): void {
    $middleware->alias([
        'permission' => PermissionMiddleware::class,
        'role' => RoleMiddleware::class,
    ]);
})
```

## Creating and assigning roles and permissions

You can create records through the models. I use `findOrCreate()` so seeders can run more than once without blowing up:

```php
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

$edit = Permission::findOrCreate('Edit User', 'web');
$admin = Role::findOrCreate('admin', 'web');

$admin->givePermissionTo($edit);
```

Then give them to users:

| Method | What it does |
| --- | --- |
| `$user->assignRole('admin')` | Adds a role, keeping existing ones |
| `$user->removeRole('admin')` | Removes one role |
| `$user->syncRoles(['manager'])` | Replaces all roles with the given list |
| `$user->givePermissionTo('Edit User')` | Adds a direct permission |
| `$user->revokePermissionTo('Edit User')` | Removes a direct permission |
| `$user->syncPermissions([...])` | Replaces all direct permissions |

Behind an "edit user" form, reach for the `sync*` methods. Whatever the admin ticked becomes the new state, and nothing from before is left lying around.

## Checking roles and permissions in PHP, routes and Blade

In PHP you have a handful of methods:

```php
$user->can('Edit User');              // through Laravel's Gate
$user->hasPermissionTo('Edit User');  // direct or via a role
$user->hasRole('admin');
$user->hasAnyRole(['admin', 'manager']);
$user->getAllPermissions();           // collection of Permission models
```

`can()` works because the package registers a `Gate::before` callback. That's controlled by `register_permission_check_method` in `config/permission.php` and it's on by default. One difference catches people out: `hasPermissionTo()` throws a `PermissionDoesNotExist` exception for a name that isn't in the database, while `can()` just returns `false`.

Routes use the aliases you registered. Separate alternatives with `|`, and the user needs any one of them:

```php
Route::get('users', [UserController::class, 'index'])
    ->middleware('permission:View Users|Edit User');

Route::get('reports', [ReportController::class, 'index'])
    ->middleware('role:admin|manager');
```

When a check fails, you get `Spatie\Permission\Exceptions\UnauthorizedException`, which renders as a 403.

In Blade you have Laravel's `@can` plus the package's own directives, like `@role`, `@hasrole`, `@hasanyrole` and `@haspermission`:

```blade
@can('Edit User')
    <button type="button">Edit user</button>
@endcan
```

## A super admin with Gate::before

Don't give a super admin every permission and then try to remember each new one you add. Let them pass every check instead. Register your own `Gate::before` in `AppServiceProvider::boot()`:

```php
use Illuminate\Support\Facades\Gate;

Gate::before(function (User $user): ?bool {
    return $user->hasRole('super-admin') ? true : null;
});
```

Return `null` for everyone else, not `false`. A `false` there would deny every ability to every normal user. The `permission` middleware checks through the Gate (it calls `canAny()`), so super admins pass it. The `role` middleware **doesn't use the Gate**, though, so `role:admin` still turns away a super admin who doesn't have the `admin` role.

## Caching and resetting the permission cache

The package caches all roles and permissions so it doesn't query the database on every check. The default `expiration_time` in `config/permission.php` is 24 hours.

It flushes that cache on its own when a `Role` or `Permission` model is saved or deleted, and when you give a permission to a role. It won't notice raw queries or a database import, though. After those, reset it yourself:

```bash
php artisan permission:cache-reset
```

Or from code, say at the end of a seeder:

```php
app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
```

::: warning Stale permissions after deploying
If a new permission "doesn't work" in production but works locally, a stale cache is the usual cause. Reset it as part of your deployment after seeding.
:::

## Seeding permissions from config files

Hard-coded permission names in a seeder get messy as the app grows. I'd rather have one config file per feature that lists its permissions and the roles that get them by default:

```php
// config/permissions/users.php
return [
    [
        'permission_name' => 'View Users',
        'associated_roles' => ['Super Admin', 'Admin', 'Manager', 'Employee'],
    ],
    [
        'permission_name' => 'Delete User',
        'associated_roles' => ['Super Admin', 'Admin'],
    ],
];
```

The seeder loops over the files, calls `Permission::findOrCreate()` for each entry and resets the cache. Adding a permission is then one line of config plus a seeder run, and the whole list is easy to review in a pull request.

## Multiple guards

Every role and permission has a `guard_name`. As far as a user on an `admin` or `api` guard is concerned, a permission created for `web` doesn't exist. Leave the guard out and the package uses the model's `guard_name` property if it has one. If not, it looks at the guards whose provider uses that model, preferring your default guard.

Once you have more than one guard, I'd be explicit everywhere. Pass the guard when creating, as in `Permission::findOrCreate('Edit User', 'admin')`, and pass it to the middleware after a comma: `permission:Edit User,admin`. Only reuse the same permission name across guards when it really means the same thing.

Separate guards are also how you keep platform admins and customer users apart in a multi-tenant app. [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html) goes into that.

## Showing and hiding UI in Inertia

Inertia has no Blade, so share the user's permission names as props in `HandleInertiaRequests`:

```php
'auth' => [
    'user' => $request->user(),
    'permissions' => fn (): array => $request->user()
        ?->getAllPermissions()->pluck('name')->values()->all() ?? [],
    'isSuperAdmin' => fn (): bool => (bool) $request->user()?->hasRole('super-admin'),
],
```

Then add a tiny helper on the frontend. In Vue:

```ts
export function usePermission() {
    const page = usePage<PageProps>();

    const can = (...permissions: string[]): boolean =>
        page.props.auth.isSuperAdmin ||
        permissions.some((p) => page.props.auth.permissions.includes(p));

    return { can };
}
```

Use it as `v-if="can('Create User')"`. The same approach works in [React and Svelte](/blog/vue-react-or-svelte-laravel-saas.html), since the props come from the same Laravel backend. If you want to build whole menus from permissions, that's in the [SaaS Laravel docs](/docs/core/users-roles-permissions.html#checking-permissions).

::: tip Hiding is not securing
Frontend checks only hide buttons. Always protect the route or controller with middleware or a policy as well.
:::

## Frequently asked questions

### Should I check roles or permissions?

Permissions. Check them in your code and use roles to hand out groups of them. Then you can change what a role is allowed to do without touching a single controller, route or component.

### Why does my new permission return false?

Usually it's a stale cache (run `php artisan permission:cache-reset`), a guard mismatch between the permission and the user, or a typo in the name. Keep in mind that `hasPermissionTo()` throws for unknown names while `can()` returns `false`.

### Can a user have permissions without a role?

Yes. `givePermissionTo()` and `syncPermissions()` attach permissions straight to the user, and `getAllPermissions()` returns the direct and role-based ones together.

### Does Spatie permission work with multi-tenancy?

Yes. With a database per tenant, every tenant database has its own permission tables, so roles and permissions are separated per customer without any extra work.

## Spatie permissions in the SaaS Laravel kits

I set the [SaaS Laravel starter kits](/) up this way: they use `spatie/laravel-permission` 8 with the `permission` and `role` aliases registered in `bootstrap/app.php`. Permissions live in `config/permissions/*.php` (and `config/permissions/tenant/` for tenants) and are seeded by a `PermissionSeeder` that resets the cache. Five system roles (super-admin, admin, manager, employee and user) are seeded from the start, a `Gate::before` lets `super-admin` pass every check, and `auth.permissions` plus `auth.isSuperAdmin` drive a `can()` helper in the Vue, React and Svelte kits. The central app uses the `web` guard and each tenant uses a `tenant` guard. You can also onboard new users with [signed invitation links](/blog/laravel-user-invitations-signed-urls.html). The full setup is in the [users, roles and permissions docs](/docs/core/users-roles-permissions.html).

<BlogPostCta title="Roles and permissions, already wired up" text="SaaS Laravel ships config-driven Spatie permissions, seeded system roles, a super admin and permission-aware menus and buttons in Vue, React or Svelte." />
