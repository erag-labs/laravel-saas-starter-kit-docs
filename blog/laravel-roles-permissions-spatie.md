---
title: "Laravel Roles and Permissions with Spatie"
description: "A practical Laravel Spatie permission guide: roles, permissions and guards, assigning and checking them, super admins, caching, seeding and Inertia UI checks."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
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

Almost every SaaS app needs to answer the same question on every request: *is this user allowed to do this?* The **Laravel Spatie permission** package (`spatie/laravel-permission`) is the most common way to answer it. It stores roles and permissions in your database and plugs straight into Laravel's own authorization, so `can()`, `@can` and the `can` middleware keep working as you expect.

This guide covers the concepts, how to assign and check roles and permissions, how to build a super admin, how caching works, and how to show or hide buttons in an Inertia frontend. All examples use version 8 of the package.

## Roles, permissions and guards

The package has three building blocks:

| Concept | What it is | Example |
| --- | --- | --- |
| **Permission** | A single thing a user may do | `Edit User`, `View Invoices` |
| **Role** | A named group of permissions | `admin`, `manager` |
| **Guard** | The auth guard a role or permission belongs to | `web`, `api` |

A user can get permissions **via a role**, **directly**, or both. Your code should almost always check *permissions*, not roles. "Can this user edit users?" survives a reorganization of your roles; "Is this user an admin?" does not.

## Installing Laravel Spatie permission

Install the package, publish its config and migration, then migrate:

```bash
composer require spatie/laravel-permission
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
php artisan migrate
```

The migration creates five tables: `permissions`, `roles`, `model_has_permissions`, `model_has_roles` and `role_has_permissions`. Then add the `HasRoles` trait to your user model:

```php
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasRoles;
}
```

`HasRoles` also pulls in `HasPermissions`, so the user gets both sets of methods.

### Register the middleware aliases

The package ships `RoleMiddleware`, `PermissionMiddleware` and `RoleOrPermissionMiddleware`, but it does not register short aliases for them. In Laravel 11 and later you add them in `bootstrap/app.php`:

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

Create records with the models, or use `findOrCreate()` so seeders can run more than once:

```php
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

$edit = Permission::findOrCreate('Edit User', 'web');
$admin = Role::findOrCreate('admin', 'web');

$admin->givePermissionTo($edit);
```

Then assign them to users:

| Method | What it does |
| --- | --- |
| `$user->assignRole('admin')` | Adds a role, keeping existing ones |
| `$user->removeRole('admin')` | Removes one role |
| `$user->syncRoles(['manager'])` | Replaces all roles with the given list |
| `$user->givePermissionTo('Edit User')` | Adds a direct permission |
| `$user->revokePermissionTo('Edit User')` | Removes a direct permission |
| `$user->syncPermissions([...])` | Replaces all direct permissions |

The `sync*` methods are what you want behind an "edit user" form: whatever the admin ticked becomes the new truth, with nothing left over from before.

## Checking roles and permissions

You can check in PHP, in routes and in Blade.

```php
$user->can('Edit User');              // through Laravel's Gate
$user->hasPermissionTo('Edit User');  // direct or via a role
$user->hasRole('admin');
$user->hasAnyRole(['admin', 'manager']);
$user->getAllPermissions();           // collection of Permission models
```

`can()` works because the package registers a `Gate::before` callback (controlled by `register_permission_check_method` in `config/permission.php`, on by default). There is one difference worth knowing: `hasPermissionTo()` throws a `PermissionDoesNotExist` exception for a permission name that isn't in the database, while `can()` simply returns `false`.

**Routes** use the aliases you registered. Separate alternatives with `|` — the user needs **any** of them:

```php
Route::get('users', [UserController::class, 'index'])
    ->middleware('permission:View Users|Edit User');

Route::get('reports', [ReportController::class, 'index'])
    ->middleware('role:admin|manager');
```

A failed check throws `Spatie\Permission\Exceptions\UnauthorizedException`, which renders as a 403 response.

**Blade** gets Laravel's `@can` plus the package's own directives such as `@role`, `@hasrole`, `@hasanyrole` and `@haspermission`:

```blade
@can('Edit User')
    <button type="button">Edit user</button>
@endcan
```

## A super admin with Gate::before

Rather than giving a super admin every permission (and remembering to add each new one), let them pass every check. Register your own `Gate::before` in `AppServiceProvider::boot()`:

```php
use Illuminate\Support\Facades\Gate;

Gate::before(function (User $user): ?bool {
    return $user->hasRole('super-admin') ? true : null;
});
```

Return `null`, not `false`, for everyone else — `false` would deny every ability for normal users. Because the `permission` middleware checks through the Gate (it calls `canAny()`), super admins pass it too. The `role` middleware does **not** use the Gate, so `role:admin` still rejects a super admin who lacks the `admin` role.

## Caching and resetting the permission cache

To avoid database queries on every check, the package caches all roles and permissions. The default `expiration_time` in `config/permission.php` is 24 hours.

The cache is flushed automatically when a `Role` or `Permission` model is saved or deleted, and when you give a permission to a role. It is **not** flushed if you change the tables with raw queries or a database import. In those cases, reset it yourself:

```bash
php artisan permission:cache-reset
```

Or from code, for example at the end of a seeder:

```php
app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
```

::: warning Stale permissions after deploying
If a new permission "doesn't work" in production but works locally, a stale cache is the usual cause. Reset it as part of your deployment after seeding.
:::

## Seeding permissions from config files

Hard-coding permission names in a seeder gets messy as the app grows. A cleaner approach is one config file per feature that lists its permissions and the roles that get them by default:

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

A seeder then loops over the files, calls `Permission::findOrCreate()` for each entry and resets the cache. Adding a permission becomes a one-line config change plus a re-run of the seeder, and the list of permissions is easy to review in a pull request.

## Multiple guards

Every role and permission has a `guard_name`. A permission created for the `web` guard does not exist as far as a user on an `admin` or `api` guard is concerned. If you omit the guard, the package uses the model's `guard_name` property if it has one, otherwise the guards whose provider uses that model, preferring your default guard.

When you use more than one guard, be explicit:

- Pass the guard when creating: `Permission::findOrCreate('Edit User', 'admin')`.
- Pass it to the middleware after a comma: `permission:Edit User,admin`.
- Keep permission names identical across guards only if they really mean the same thing.

Separate guards are also how you keep platform admins and customer users apart in a multi-tenant app — see [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## Showing and hiding UI in Inertia

With Inertia there is no Blade, so share the user's permission names as props in `HandleInertiaRequests`:

```php
'auth' => [
    'user' => $request->user(),
    'permissions' => fn (): array => $request->user()
        ?->getAllPermissions()->pluck('name')->values()->all() ?? [],
    'isSuperAdmin' => fn (): bool => (bool) $request->user()?->hasRole('super-admin'),
],
```

Then write a tiny helper on the frontend. In Vue:

```ts
export function usePermission() {
    const page = usePage<PageProps>();

    const can = (...permissions: string[]): boolean =>
        page.props.auth.isSuperAdmin ||
        permissions.some((p) => page.props.auth.permissions.includes(p));

    return { can };
}
```

Use it as `v-if="can('Create User')"`. The same idea works in [React and Svelte](/blog/vue-react-or-svelte-laravel-saas.html), because the props come from the same Laravel backend. Building whole menus from permissions is covered in the [SaaS Laravel docs](/docs/core/users-roles-permissions.html#checking-permissions).

::: tip Hiding is not securing
Frontend checks only hide buttons. Always protect the route or controller with middleware or a policy as well.
:::

## Frequently asked questions

### Should I check roles or permissions?

Check permissions in your code and use roles to hand out groups of permissions. That way you can change what a role may do without touching any controller, route or component.

### Why does my new permission return false?

The usual causes are a stale cache (run `php artisan permission:cache-reset`), a guard mismatch between the permission and the user, or a typo in the name. Remember that `hasPermissionTo()` throws for unknown names while `can()` returns `false`.

### Can a user have permissions without a role?

Yes. `givePermissionTo()` and `syncPermissions()` attach permissions directly to the user, and `getAllPermissions()` returns direct and role-based permissions together.

### Does Spatie permission work with multi-tenancy?

Yes. With a database per tenant, each tenant database has its own permission tables, so roles and permissions are naturally separated per customer.

## How SaaS Laravel handles this

The [SaaS Laravel starter kits](/) use `spatie/laravel-permission` 8 with the `permission` and `role` aliases registered in `bootstrap/app.php`. Permissions are defined in `config/permissions/*.php` (and `config/permissions/tenant/` for tenants) and seeded by a `PermissionSeeder` that resets the cache. Five system roles (super-admin, admin, manager, employee and user) are seeded out of the box, a `Gate::before` lets `super-admin` pass every check, and `auth.permissions` plus `auth.isSuperAdmin` power a `can()` helper in the Vue, React and Svelte kits. The central app uses the `web` guard and each tenant uses a `tenant` guard. New users can also be onboarded with [signed invitation links](/blog/laravel-user-invitations-signed-urls.html). The full setup is in the [users, roles and permissions docs](/docs/core/users-roles-permissions.html).

<BlogPostCta title="Roles and permissions, already wired up" text="SaaS Laravel ships config-driven Spatie permissions, seeded system roles, a super admin and permission-aware menus and buttons — in Vue, React or Svelte." />
