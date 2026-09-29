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

Most SaaS apps ship with a handful of Laravel default roles, such as super admin, admin and member, and the code refers to them by name. Then someone renames `admin` to "Administrators" in the roles screen, and every `hasRole('admin')`, every seeder and every role-based check quietly stops matching. Nothing errors. Things just stop working.

We'll show how we define system roles in one place, seed them, let customers add their own roles alongside them, and enforce the protection on the server, where nobody can skip it.

## System roles vs custom roles

The fix starts with admitting you have two kinds of roles, and treating them differently:

| | System roles | Custom roles |
| --- | --- | --- |
| Defined in | Code (an enum) | The admin UI |
| Created by | A seeder on install and deploy | Admins at runtime |
| Referenced in code | Yes: seeders, `Gate::before`, config files | No |
| Rename or delete | Blocked | Allowed |
| Default permissions | From your permission config | Chosen by the admin |

Custom roles are a feature. A customer can create "Support Agent" with exactly the permissions they need. System roles are closer to infrastructure, because your code assumes they exist under a fixed name.

## Define Laravel default roles in an enum

We keep system roles in a backed enum. That gives PHP, seeders and validation one shared list:

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

The value is the stable identifier stored in the `roles` table. The label is for people, so you can translate or reword it without touching the database. In version 8, Spatie's `findOrCreate()`, `assignRole()` and `hasRole()` accept backed enums, so you'll rarely type the string by hand.

## Seed default roles on every deploy

Seeding system roles should be safe to repeat:

```php
foreach (RoleName::cases() as $role) {
    Role::findOrCreate($role, 'web');
}
```

`findOrCreate()` only inserts what's missing, which means the seeder can run on every deploy and for every tenant database. Keep two things in mind, though. Never delete roles that aren't in the enum, since those belong to your customers. And seed each guard you use: a role belongs to one guard, and a `web` role doesn't exist for users on another guard.

The permissions each system role gets by default belong in their own config. We cover that in [config-driven permissions](/blog/laravel-permissions-config-files.html).

## What goes wrong when system roles are editable

It helps to be specific about what you're protecting against before adding any protection.

Renaming is the most common problem. After a rename, `hasRole('admin')`, the `role:admin` middleware and a super admin `Gate::before` all stop matching. On the next deploy the seeder recreates `admin`, and now you have two roles with your users attached to the wrong one.

Deleting is worse, because it removes access instantly. Spatie's `deleting` listener detaches the role from every user and from its permissions. The seeder can recreate an empty role, but it can't bring the old assignments back.

Changing the guard also breaks things. Permissions belong to a guard too, so a role moved to another guard no longer lines up with the permissions and users it was set up for.

Then there are look-alike names. A custom role called "Admin" or "ADMIN" sitting next to `admin` invites mistakes, so reject custom names that match a system role in any casing.

## Enforce the protection on the server

Disabling the edit and delete buttons is good UX, but it isn't protection. A crafted `PUT` or `DELETE` request goes straight to your controller. We use two layers: a policy that produces friendly errors, and a model guard as a safety net.

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

Spatie's `Role` model isn't in your `App\Models` namespace, so Laravel won't discover the policy. Register it yourself with `Gate::policy(Role::class, RolePolicy::class)` in a service provider.

If you use a [super admin role](/blog/laravel-super-admin-role.html) with `Gate::before`, there's a catch. `Gate::before` answers `true` before the policy ever runs, so **super admins could still rename or delete system roles**. You can switch the bypass to `Gate::after`, or rely on the next layer, which no Gate callback can skip. We'd do the second either way.

### A model guard as a safety net

Extend Spatie's model and refuse the change at the Eloquent level. That also covers Tinker, jobs and any code path you forgot about:

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

Then point the package at it with `'role' => App\Models\Role::class` under `models` in `config/permission.php`.

You might be wondering why this uses `booting()` rather than the usual `booted()`. Spatie registers its own `deleting` listener, the one that detaches users and permissions, while the model's traits boot. Listeners run in the order they were registered, so a guard added in `booted()` would run *after* Spatie's. The delete would be stopped, but the role would already be empty. Listeners added in `booting()` run first.

This still has two limits. Mass updates such as `Role::query()->update([...])` skip model events entirely, and an exception makes a poor error message for a user. So check in the policy or service first, and keep the model guard for the cases you didn't think of.

## Mark system roles in the UI

With the server enforcing the rules, the UI's job is to explain them. Show a System or Custom badge on each role, and disable edit and delete for system roles with a tooltip that says why.

Send the flag from the server rather than hard-coding the list of names in JavaScript. That way the two can't drift apart:

```php
$roles = Role::query()->orderBy('name')->get()->map(fn (Role $role): array => [
    'id' => $role->id,
    'name' => $role->name,
    'is_system' => RoleName::isSystem($role->name),
]);
```

Whether admins may change the *permissions* of a system role is a separate decision. Locking the name protects your code, while locking the permissions protects your defaults. Many apps allow the first kind of edit and block the second.

## Changing default roles later

Default roles change as a product grows, and that's fine. We treat each change as a small migration:

| Change | How to do it safely |
| --- | --- |
| Add a system role | Add the enum case and its permission defaults, deploy, run the seeder for the central app and every tenant |
| Rename a system role | Change the enum value and update `roles.name` in a migration in the same release, then reset the permission cache |
| Remove a system role | Move its users to another role first, then delete it in a migration and remove the enum case |

If you run a database per tenant, a rename or removal has to happen in every tenant database. That makes it a job for a [tenant migration](/blog/laravel-tenant-migrations-seeders.html).

## Frequently asked questions

### Can I let customers rename the default roles?

Let them change the label, not the name. Store a display name or translate the label, and keep the role's `name` as the stable identifier your code relies on.

### What happens to users when a Spatie role is deleted?

The package detaches the role from every user and removes its permission links before the row is deleted. Users keep any permissions assigned to them directly, but they lose everything they got through that role.

### Should system roles have editable permissions?

That depends on who you're building for. If customers expect to tailor roles, allow permission changes and protect only the name. If your support team relies on "an admin can always do X", keep system role permissions in config and make them read-only in the UI.

### How do I add a new default role to an app that is already live?

Add a case to the enum, add its permission defaults, and run the role and permission seeders on deploy (for every tenant, if you have them). Since the seeders use `findOrCreate()`, existing roles and assignments aren't touched.

## How SaaS Laravel protects its default roles

If you'd rather start with this already in place, the [SaaS Laravel starter kits](/) define five system roles in `Modules\RolePermission\Enums\RoleEnum`: `super-admin`, `admin`, `manager`, `employee` and `user`, each with a label. A `RoleSeeder` creates them with `findOrCreate()` for the `web` guard in the central app and the `tenant` guard in every tenant, and their default permissions come from the `config/permissions` files. The roles page shows total, system and custom counts and a System or Custom badge per role, with edit and delete disabled for system roles, and the backend refuses to delete `super-admin`. Admins can create and rename their own custom roles, with names validated as unique per guard. The [roles section of the docs](/docs/core/users-roles-permissions.html#roles) has the details, and the [Spatie permissions guide](/blog/laravel-roles-permissions-spatie.html) covers the package basics.

<BlogPostCta title="Default roles, ready on day one" text="SaaS Laravel ships five system roles, custom roles, config-driven Spatie permissions and a super admin for the central app and every tenant, in Vue, React or Svelte." />
