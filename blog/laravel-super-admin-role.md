---
title: "Laravel Super Admin Role with Spatie Permission"
description: "Build a Laravel super admin role with Spatie: Gate::before or Gate::after, checks the bypass misses, the first super admin and how to stop privilege escalation."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: permissions
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

Sooner or later someone has to fix a customer's data at 11 p.m., and a missing permission is the last thing that person needs. A **Laravel super admin role** gives a small group of trusted people access to everything, including the permissions you'll add next month.

The basic `Gate::before` trick is three lines, and most tutorials stop there. I want to cover what comes after: which hook to pick, the checks a super admin does *not* pass automatically, how to create the first super admin, and how to stop other users from promoting themselves.

## What a super admin role should be

A super admin isn't "an admin with a few extra permissions". It's an escape hatch that skips permission checks, and I treat it as a different kind of account altogether.

| | Super admin | Admin |
| --- | --- | --- |
| Permissions | Passes every check, including new ones | Only what is granted in config or the UI |
| Typical holders | Founders, platform operations | Customer-side admins, support staff |
| How many | As few as possible | As many as needed |
| Who may grant it | Only another super admin | Super admins and admins with the right permission |

In a multi-tenant app, keep the platform operator separate from your customers. A tenant's own "owner" or "super admin" should control only that tenant, while your platform super admin lives in the central app. [Separate auth guards](/blog/laravel-multiple-auth-guards.html) are a common way to draw that line.

## Three ways to build a Laravel super admin role

| Approach | How it works | Watch out for |
| --- | --- | --- |
| Give the role every permission | `$role->syncPermissions(Permission::all())` in a seeder | New permissions are missing until you re-run it |
| `Gate::before` | Returns `true` for super admins before any other check runs | Nothing can deny a super admin, not even a policy |
| `Gate::after` | Grants access only when no other check decided | Policies that return `false` also block super admins |

Assigning every permission is explicit, and you can inspect it right there in the database. The problem is that it's only as fresh as your last seeder run.

`Gate::before` is what the Spatie documentation recommends, and the [Spatie permissions pillar guide](/blog/laravel-roles-permissions-spatie.html#a-super-admin-with-gate-before) has the code. The callback returns `true` for super admins and `null` for everyone else, so normal users fall through to the regular checks. This is the one I'd start with.

`Gate::after` flips the order. Laravel runs the normal check first and only uses the after callback's answer if the result is still `null`:

```php
// AppServiceProvider::boot()
Gate::after(function (User $user, string $ability, ?bool $result): ?bool {
    return $user->hasRole('super-admin') ? true : null;
});
```

That lets a policy say "no" even to a super admin, which is useful for rules like "nobody may delete their own account from the users list". The price is that any policy method returning `false` for non-owners now blocks your super admin too, so you have to write those methods with that in mind.

If you only need the bypass for one model, a policy's `before()` method does the same thing locally:

```php
public function before(User $user, string $ability): ?bool
{
    return $user->hasRole('super-admin') ? true : null;
}
```

## Where the super admin bypass does not reach

Gate callbacks only run when something asks the Gate. Quite a few common checks never do:

| Check | Passes for a super admin via the Gate? |
| --- | --- |
| `$user->can()`, `@can`, `Gate::allows()`, `$this->authorize()` | Yes |
| `permission:` route middleware | Yes, it calls `canAny()` |
| `role:` route middleware | No, it checks role names directly |
| `$user->hasPermissionTo()` and `$user->hasRole()` | No |
| `User::permission('Approve Invoices')` query scope | No |
| Frontend `v-if` or conditional rendering | Only if you share a flag such as `isSuperAdmin` |

The query scope is the sneaky one. Say you build "email everyone who can approve invoices" with `User::permission(...)`. It silently skips super admins who don't hold that permission directly. In application code I'd use `can()` and the `permission` middleware, and save role checks for the few places that genuinely are about roles.

There's a quieter side effect as well. A super admin passes `can('Edti User')` too, typo and all. If you only ever test with the super admin account, you'll never spot a misspelled ability name. Click through every new feature as a normal role as well.

## Creating the first super admin

Your UI can't create the first super admin, because nobody is allowed to use that screen yet. Spatie ships an Artisan command for exactly this:

```bash
php artisan permission:assign-role super-admin 1 web
```

The arguments are the role name, the user ID and the guard. I prefer something friendlier that takes an email address:

```php
// routes/console.php
Artisan::command('app:make-super-admin {email}', function (string $email) {
    $user = User::where('email', $email)->firstOrFail();
    $user->assignRole('super-admin');

    $this->info("{$email} is now a super admin.");
})->purpose('Promote an existing user to super admin');
```

The user signs up or accepts an invitation like anyone else, and then you promote them from the server. Don't use seeders that create a super admin with a known password in production. Demo accounts are handy locally and dangerous everywhere else.

## Stopping privilege escalation

The most common super admin bug isn't in the Gate callback at all. It's in the user form. If anyone with "Edit User" can pick a role from a dropdown, a manager can make themselves a super admin with a single request, whatever the dropdown happens to show.

You close that door with three rules. Only super admins may grant or remove the super admin role, and the server has to validate the submitted role. Only super admins may edit other super admins; otherwise someone could change a super admin's email address, reset the password and take over the account. And **the last super admin can't be demoted or deleted.**

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

Filter the role options you send to the frontend with the same logic, so nobody sees choices the server will reject anyway. Protecting the `super-admin` role record itself from being renamed or deleted is a separate job, covered in [protecting system roles](/blog/laravel-protect-system-roles.html).

## Hardening super admin accounts

A super admin account is the most valuable target in your app, so it deserves more care than a normal login.

Require two-factor authentication for every super admin; [two-factor authentication in Laravel](/blog/laravel-two-factor-authentication.html) walks through the setup. Log role changes too. Spatie v8 dispatches `RoleAttachedEvent` and `RoleDetachedEvent` when you set `events_enabled` to `true` in `config/permission.php`, and a listener can write an audit entry or alert the other super admins.

Review the list of super admins regularly. People change jobs, and their access shouldn't outlive their role. And give everyone a personal account. A shared "admin@" login makes your audit log useless.

## Frequently asked questions

### Should a super admin have every permission assigned in the database?

You don't have to when you use `Gate::before`, because the bypass answers every Gate check. Assigning them anyway still has a benefit: `hasPermissionTo()`, query scopes and permission lists in the UI then show the full picture.

### Why does my super admin get a 403 on some routes?

Most likely the route uses `role:` middleware rather than `permission:`. The role middleware compares role names and never asks the Gate, so a `role:admin` route rejects a super admin who doesn't also hold the `admin` role.

### How many super admins should a SaaS have?

As few as you can run the business with, which is usually two or three, so one person's vacation or lost phone doesn't lock you out. Everyone else gets a regular role with only the permissions they need.

### Can I stop a super admin from doing one specific action?

Not with `Gate::before`, because it answers before any policy runs. Either switch to `Gate::after` and return `false` from the policy method, or put the rule in your service layer, where no Gate callback can skip it.

## The super admin role in SaaS Laravel

In the [SaaS Laravel starter kits](/), this is already done. They define `super-admin` as a case of `Modules\RolePermission\Enums\RoleEnum` and register a `Gate::before` in `AppServiceProvider` that returns `true` for it, so the `permission` middleware and every `can()` call pass. The shared `auth.isSuperAdmin` prop makes the `can()` helpers in the Vue, React and Svelte kits return `true` as well. Because "Super Admin" is listed in the `associated_roles` of every permission in `config/permissions`, super admins also receive all permissions directly when the role is assigned. The central app and each tenant have their own `super-admin` role (guards `web` and `tenant`), and the roles controller refuses to delete it. There's more in the [super admin section of the docs](/docs/core/users-roles-permissions.html#super-admin).

<BlogPostCta title="A super admin that is already wired up" text="SaaS Laravel ships a super-admin role with a Gate::before bypass, config-driven Spatie permissions and Fortify two-factor login, in Vue, React or Svelte." />
