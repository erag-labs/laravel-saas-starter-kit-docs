---
title: "Laravel Super Admin Role with Spatie Permission"
description: "Build a Laravel super admin role with Spatie: Gate::before or Gate::after, checks the bypass misses, the first super admin and how to stop privilege escalation."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Permissions, Security]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-super-admin-role.html
  - - meta
    - property: og:title
      content: "Laravel Super Admin Role with Spatie Permission"
  - - meta
    - property: og:description
      content: "Build a Laravel super admin role with Spatie: Gate::before or Gate::after, checks the bypass misses, the first super admin and how to stop privilege escalation."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-super-admin-role.html
  - - meta
    - name: twitter:title
      content: "Laravel Super Admin Role with Spatie Permission"
  - - meta
    - name: twitter:description
      content: "Build a Laravel super admin role with Spatie: Gate::before or Gate::after, checks the bypass misses, the first super admin and how to stop privilege escalation."
---

# How to Build a Laravel Super Admin Role with Spatie Permission

<BlogPostMeta />

Sooner or later someone has to fix a customer's data at 11 p.m., and that person should not be blocked by a missing permission. A **Laravel super admin role** gives a small group of trusted people access to everything, including permissions you add next month.

The basic `Gate::before` trick takes three lines. This guide covers what comes after it: choosing the right hook, the checks a super admin does *not* pass automatically, creating the first super admin, and stopping other users from promoting themselves.

## What a super admin role should be

A super admin is not "an admin with a few more permissions". It's an escape hatch that skips permission checks, so treat it as a separate kind of account.

| | Super admin | Admin |
| --- | --- | --- |
| Permissions | Passes every check, including new ones | Only what is granted in config or the UI |
| Typical holders | Founders, platform operations | Customer-side admins, support staff |
| How many | As few as possible | As many as needed |
| Who may grant it | Only another super admin | Super admins and admins with the right permission |

In a multi-tenant app, keep the platform operator apart from customers. A tenant's own "owner" or "super admin" should only control that tenant, while your platform super admin lives in the central app. [Separate auth guards](/blog/laravel-multiple-auth-guards.html) are a common way to draw that line.

## Three ways to build a Laravel super admin role

| Approach | How it works | Watch out for |
| --- | --- | --- |
| Give the role every permission | `$role->syncPermissions(Permission::all())` in a seeder | New permissions are missing until you re-run it |
| `Gate::before` | Returns `true` for super admins before any other check runs | Nothing can deny a super admin, not even a policy |
| `Gate::after` | Grants access only when no other check decided | Policies that return `false` also block super admins |

**Giving the role every permission** is explicit and easy to inspect in the database, but it is only as fresh as your last seeder run.

**`Gate::before`** is the approach the Spatie documentation recommends, and the [Spatie permissions pillar guide](/blog/laravel-roles-permissions-spatie.html#a-super-admin-with-gate-before) shows the code. The callback returns `true` for super admins and `null` for everyone else, so normal users fall through to the regular checks.

**`Gate::after`** flips the order. Laravel runs the normal check first and only uses the after callback's answer if the result is still `null`:

```php
// AppServiceProvider::boot()
Gate::after(function (User $user, string $ability, ?bool $result): ?bool {
    return $user->hasRole('super-admin') ? true : null;
});
```

That lets a policy say "no" even to a super admin, which is handy for rules like "nobody may delete their own account from the users list". The trade-off: any policy method that returns `false` for non-owners also blocks your super admin, so write those methods with that in mind.

If you only need the bypass for one model, a policy's `before()` method does the same thing locally:

```php
public function before(User $user, string $ability): ?bool
{
    return $user->hasRole('super-admin') ? true : null;
}
```

## Where the super admin bypass does not reach

Gate callbacks only run when something asks the Gate. Several common checks never do:

| Check | Passes for a super admin via the Gate? |
| --- | --- |
| `$user->can()`, `@can`, `Gate::allows()`, `$this->authorize()` | Yes |
| `permission:` route middleware | Yes, it calls `canAny()` |
| `role:` route middleware | No, it checks role names directly |
| `$user->hasPermissionTo()` and `$user->hasRole()` | No |
| `User::permission('Approve Invoices')` query scope | No |
| Frontend `v-if` or conditional rendering | Only if you share a flag such as `isSuperAdmin` |

The query scope is the sneaky one. "Email everyone who can approve invoices" built with `User::permission(...)` silently skips super admins who don't hold that permission directly. In application code, prefer `can()` and the `permission` middleware, and keep role checks for the few places that really are about roles.

There's one more side effect: a super admin passes `can('Edti User')` too. Typos in ability names never show up while you test with the super admin account, so always click through new features as a normal role as well.

## Creating the first super admin

Your UI can't create the first super admin, because nobody is allowed to use it yet. Spatie ships an Artisan command for exactly this:

```bash
php artisan permission:assign-role super-admin 1 web
```

The arguments are the role name, the user ID and the guard. For something friendlier, add a command that takes an email address:

```php
// routes/console.php
Artisan::command('app:make-super-admin {email}', function (string $email) {
    $user = User::where('email', $email)->firstOrFail();
    $user->assignRole('super-admin');

    $this->info("{$email} is now a super admin.");
})->purpose('Promote an existing user to super admin');
```

The user signs up or accepts an invitation normally, then you promote them from the server. Avoid seeders that create a super admin with a known password in production. Demo accounts are useful locally and dangerous anywhere else.

## Stopping privilege escalation

The most common super admin bug isn't in the Gate callback. It's the user form. If anyone with "Edit User" can pick a role from a dropdown, a manager can make themselves a super admin with one request, no matter what the dropdown shows.

Three rules close that door:

1. **Only super admins may grant or remove the super admin role.** Validate the submitted role on the server.
2. **Only super admins may edit super admins.** Otherwise someone could change a super admin's email address, reset the password and take over the account.
3. **The last super admin can't be demoted or deleted.**

The first rule fits in a Form Request:

```php
public function rules(): array
{
    $allowed = Role::query()
        ->where('guard_name', 'web')
        ->when(! $this->user()->hasRole('super-admin'), fn ($query) => $query->where('name', '!=', 'super-admin'))
        ->pluck('name');

    return ['role' => ['required', 'string', Rule::in($allowed)]];
}
```

The last one belongs in the service that changes roles or deletes users:

```php
// Before removing the role from $user or deleting $user
if ($user->hasRole('super-admin') && User::role('super-admin')->count() === 1) {
    throw ValidationException::withMessages([
        'role' => 'At least one super admin must remain.',
    ]);
}
```

Filter the role options you send to the frontend with the same logic, so people don't see choices the server will reject. Protecting the `super-admin` role record itself from being renamed or deleted is covered in [protecting system roles](/blog/laravel-protect-system-roles.html).

## Hardening super admin accounts

A super admin account is the most valuable target in your app. A few habits keep it that way:

- **Require two-factor authentication** for every super admin. See [two-factor authentication in Laravel](/blog/laravel-two-factor-authentication.html).
- **Log role changes.** Spatie v8 dispatches `RoleAttachedEvent` and `RoleDetachedEvent` when you set `events_enabled` to `true` in `config/permission.php`. A listener can write an audit entry or alert the other super admins.
- **Review the list regularly.** People change jobs; their super admin access should not outlive their role.
- **Use personal accounts.** A shared "admin@" login makes audit logs useless.

## Frequently asked questions

### Should a super admin have every permission assigned in the database?

It's not required when you use `Gate::before`, because the bypass answers every Gate check. Assigning them anyway can still help: `hasPermissionTo()`, query scopes and permission lists in the UI then show the full picture.

### Why does my super admin get a 403 on some routes?

Most likely the route uses `role:` middleware instead of `permission:`. The role middleware compares role names and never asks the Gate, so a `role:admin` route rejects a super admin who doesn't also hold the `admin` role.

### How many super admins should a SaaS have?

As few as you can run the business with, usually two or three, so that one person's vacation or lost phone doesn't lock you out. Everyone else should get a regular role with only the permissions they need.

### Can I stop a super admin from doing one specific action?

Not with `Gate::before`, because it answers before any policy runs. Switch to `Gate::after` and return `false` from the policy method, or put the rule in your service layer, where no Gate callback can skip it.

## How SaaS Laravel handles the super admin role

The [SaaS Laravel starter kits](/) define `super-admin` as a case of `Modules\RolePermission\Enums\RoleEnum` and register a `Gate::before` in `AppServiceProvider` that returns `true` for it, so the `permission` middleware and every `can()` call pass. The shared `auth.isSuperAdmin` prop makes the `can()` helpers in the Vue, React and Svelte kits return `true` as well. Because "Super Admin" is listed in the `associated_roles` of every permission in `config/permissions`, super admins also receive all permissions directly when the role is assigned. The central app and each tenant have their own `super-admin` role (guards `web` and `tenant`), and the roles controller refuses to delete it. Read more in the [super admin section of the docs](/docs/core/users-roles-permissions.html#super-admin).

<BlogPostCta title="A super admin that is already wired up" text="SaaS Laravel ships a super-admin role with a Gate::before bypass, config-driven Spatie permissions and Fortify two-factor login, in Vue, React or Svelte." />
