---
title: "Laravel Default Roles: Protecting System Roles"
description: "Define Laravel default roles in an enum, seed them safely and block renames and deletes on the server with a policy, a model guard and clear UI badges."
pageClass: blog-page
date: 2026-09-29
author: erag
category: permissions
tags: [Permissions, Security]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-protect-system-roles.html
  - - meta
    - property: og:title
      content: "Laravel Default Roles: Protecting System Roles"
  - - meta
    - property: og:description
      content: "Define Laravel default roles in an enum, seed them safely and block renames and deletes on the server with a policy, a model guard and clear UI badges."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-protect-system-roles.html
  - - meta
    - name: twitter:title
      content: "Laravel Default Roles: Protecting System Roles"
  - - meta
    - name: twitter:description
      content: "Define Laravel default roles in an enum, seed them safely and block renames and deletes on the server with a policy, a model guard and clear UI badges."
---

# Laravel Default Roles: How to Seed Them and Keep Them Safe

<BlogPostMeta />

Most SaaS apps ship with a handful of **Laravel default roles**, such as super admin, admin and member, and the code depends on them by name. If someone renames `admin` to "Administrators" in the roles screen, every `hasRole('admin')`, every seeder and every role-based check quietly stops matching.

This guide shows how to define system roles in one place, seed them, let customers add their own roles next to them, and enforce the protection on the server, where it can't be skipped.

## System roles vs custom roles

The fix starts with naming two kinds of roles and treating them differently:

| | System roles | Custom roles |
| --- | --- | --- |
| Defined in | Code (an enum) | The admin UI |
| Created by | A seeder on install and deploy | Admins at runtime |
| Referenced in code | Yes: seeders, `Gate::before`, config files | No |
| Rename or delete | Blocked | Allowed |
| Default permissions | From your permission config | Chosen by the admin |

Custom roles are a feature: a customer can create "Support Agent" with exactly the permissions they need. System roles are infrastructure. Your code assumes they exist with a fixed name.

## Define Laravel default roles in an enum

A backed enum gives you one list of system roles that PHP, seeders and validation can all use:

```php
enum RoleName: string
{
    case SuperAdmin = 'super-admin';
    case Admin = 'admin';

    public function label(): string
    {
        return __('roles.'.$this->value);
    }

    public static function isSystem(string $name): bool
    {
        return self::tryFrom($name) !== null;
    }
}
```

The **value** is the stable identifier stored in the `roles` table. The **label** is for people, so it can be translated or reworded without touching the database. Spatie's `findOrCreate()`, `assignRole()` and `hasRole()` accept backed enums in version 8, so you rarely need to write the string by hand.

## Seed default roles on every deploy

Seeding system roles should be safe to repeat:

```php
foreach (RoleName::cases() as $role) {
    Role::findOrCreate($role, 'web');
}
```

`findOrCreate()` only inserts what's missing, so the seeder can run on every deploy and for every tenant database. Two rules keep it safe:

- **Never delete roles that aren't in the enum.** Those are your customers' custom roles.
- **Seed each guard you use.** A role belongs to one guard, and a `web` role doesn't exist for users on another guard.

Which permissions each system role gets by default belongs in its own config, covered in [config-driven permissions](/blog/laravel-permissions-config-files.html).

## What goes wrong when system roles are editable

Before adding protection, it helps to see what you're protecting against:

- **A rename breaks lookups.** `hasRole('admin')`, `role:admin` middleware and a super admin `Gate::before` stop matching. On the next deploy the seeder recreates `admin`, and you end up with two roles and your users on the wrong one.
- **A delete removes access instantly.** Spatie's `deleting` listener detaches the role from every user and from its permissions. The seeder can recreate an empty role, but it can't bring the old assignments back.
- **A guard change breaks the links.** Permissions belong to a guard too, so a role moved to another guard no longer matches the permissions and users it was set up for.
- **Look-alike names confuse people.** A custom role called "Admin" or "ADMIN" next to `admin` invites mistakes. Reject custom names that match a system role in any casing.

## Enforce the protection on the server

Disabling the edit and delete buttons is good UX, but it isn't protection. A crafted `PUT` or `DELETE` request goes straight to your controller. Use two layers: a policy for friendly errors and a model guard as a safety net.

### A policy for the roles screen

```php
class RolePolicy
{
    public function update(User $user, Role $role): bool
    {
        return ! RoleName::isSystem($role->name) && $user->can('Edit Role');
    }

    public function delete(User $user, Role $role): bool
    {
        return ! RoleName::isSystem($role->name) && $user->can('Delete Role');
    }
}
```

Spatie's `Role` model isn't in your `App\Models` namespace, so register the policy yourself with `Gate::policy(Role::class, RolePolicy::class)` in a service provider.

There's a catch if you use a [super admin role](/blog/laravel-super-admin-role.html) with `Gate::before`: it answers `true` before the policy ever runs, so super admins could still rename or delete system roles. Either switch the bypass to `Gate::after`, or rely on the next layer, which no Gate callback can skip.

### A model guard as a safety net

Extend Spatie's model and refuse the change at the Eloquent level. This also covers Tinker, jobs and any code path you forgot:

```php
class Role extends SpatieRole
{
    protected static function booting(): void
    {
        static::updating(function (Role $role): void {
            if (RoleName::isSystem($role->getOriginal('name')) && $role->isDirty(['name', 'guard_name'])) {
                throw new LogicException('System roles cannot be renamed.');
            }
        });

        static::deleting(function (Role $role): void {
            throw_if(RoleName::isSystem($role->name), LogicException::class, 'System roles cannot be deleted.');
        });
    }
}
```

Point the package at it with `'role' => App\Models\Role::class` under `models` in `config/permission.php`.

Notice `booting()` rather than the usual `booted()`. Spatie registers its own `deleting` listener, which detaches users and permissions, while the model's traits boot. Listeners run in the order they were registered, so a guard added in `booted()` runs *after* that listener. The delete would be stopped, but the role would already be empty. Listeners added in `booting()` run first.

Two limits remain. Mass updates such as `Role::query()->update([...])` skip model events entirely, and an exception makes a poor error message. Check in the policy or service first and keep the model guard for the cases you didn't think of.

## Mark system roles in the UI

Once the server enforces the rules, the UI should explain them:

- Show a **System** or **Custom** badge on each role.
- Disable edit and delete for system roles, with a tooltip that says why.
- Send the flag from the server instead of hard-coding the list of names in JavaScript, so the two can't drift apart:

```php
$roles = Role::query()->orderBy('name')->get()->map(fn (Role $role): array => [
    'id' => $role->id,
    'name' => $role->name,
    'is_system' => RoleName::isSystem($role->name),
]);
```

Whether admins may change the *permissions* of a system role is a separate decision. Locking the name protects your code; locking the permissions protects your defaults. Many apps allow the first kind of edit and block the second.

## Changing default roles later

Default roles do change as a product grows. Treat each change as a small migration:

| Change | How to do it safely |
| --- | --- |
| Add a system role | Add the enum case and its permission defaults, deploy, run the seeder for the central app and every tenant |
| Rename a system role | Change the enum value and update `roles.name` in a migration in the same release, then reset the permission cache |
| Remove a system role | Move its users to another role first, then delete it in a migration and remove the enum case |

With a database per tenant, remember that a rename or removal must run in every tenant database, so it belongs in a [tenant migration](/blog/laravel-tenant-migrations-seeders.html).

## Frequently asked questions

### Can I let customers rename the default roles?

Let them change the label, not the name. Store a display name or translate the label, and keep the role's `name` as the stable identifier your code uses.

### What happens to users when a Spatie role is deleted?

The package detaches the role from every user and removes its permission links before the row is deleted. Users keep permissions that were assigned to them directly, but lose everything they received through that role.

### Should system roles have editable permissions?

It depends on who you build for. If customers expect to tailor roles, allow permission changes and protect only the name. If support relies on "an admin can always do X", keep system role permissions in config and make them read-only in the UI.

### How do I add a new default role to an app that is already live?

Add a case to the enum, add its permission defaults, and run the role and permission seeders on deploy, for every tenant if you have them. Because the seeders use `findOrCreate()`, existing roles and assignments stay untouched.

## How SaaS Laravel protects its default roles

The [SaaS Laravel starter kits](/) define five system roles in `Modules\RolePermission\Enums\RoleEnum`: `super-admin`, `admin`, `manager`, `employee` and `user`, each with a label. A `RoleSeeder` creates them with `findOrCreate()` for the `web` guard in the central app and the `tenant` guard in every tenant, and their default permissions come from the `config/permissions` files. The roles page shows total, system and custom counts and a **System** or **Custom** badge per role, with edit and delete disabled for system roles, and the backend refuses to delete `super-admin`. Admins can create and rename their own custom roles, with names validated as unique per guard. The details are in the [roles section of the docs](/docs/core/users-roles-permissions.html#roles), and the [Spatie permissions guide](/blog/laravel-roles-permissions-spatie.html) covers the package basics.

<BlogPostCta title="Default roles, ready on day one" text="SaaS Laravel ships five system roles, custom roles, config-driven Spatie permissions and a super admin for the central app and every tenant, in Vue, React or Svelte." />
