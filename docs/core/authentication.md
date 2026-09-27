---
title: "Laravel Fortify Auth with 2FA & Passkeys"
description: "Fortify-based authentication with separate central and tenant guards, two-factor codes, passkeys and per-domain toggles for each sign-in feature."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/core/authentication.html
  - - meta
    - property: og:title
      content: "Laravel Fortify Auth with 2FA & Passkeys"
  - - meta
    - property: og:description
      content: "Fortify-based authentication with separate central and tenant guards, two-factor codes, passkeys and per-domain toggles for each sign-in feature."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/core/authentication.html
  - - meta
    - name: twitter:title
      content: "Laravel Fortify Auth with 2FA & Passkeys"
  - - meta
    - name: twitter:description
      content: "Fortify-based authentication with separate central and tenant guards, two-factor codes, passkeys and per-domain toggles for each sign-in feature."
---

# Authentication

Authentication is powered by **Laravel Fortify** (headless) with Inertia pages. Fortify handles the routes and logic; the `Modules/Auth` module connects it to the kit's pages, actions and rate limits.

## Features

| Feature | Fortify feature | Pages |
| --- | --- | --- |
| Login / logout | always on | `auth/Login` |
| Registration | `Features::registration()` | `auth/Register` |
| Password reset | `Features::resetPasswords()` | `auth/ForgotPassword`, `auth/ResetPassword` |
| Email verification | `Features::emailVerification()` | `auth/VerifyEmail` |
| Password confirmation | always on | `auth/ConfirmPassword` |
| Two-factor auth (TOTP + recovery codes) | `Features::twoFactorAuthentication()` | `auth/TwoFactorChallenge`, Security settings |
| Passkeys (WebAuthn) | `Features::passkeys()` | Login, Confirm password, Security settings |

Page names are shown in Vue/Svelte casing; React uses kebab-case (`auth/two-factor-challenge`).

Signed-in users also get these settings pages:

| Page | URL | Contains |
| --- | --- | --- |
| Profile | `/settings/profile` | Name, email, language, delete account |
| Security | `/settings/security` (requires password confirmation) | Change password, 2FA, passkeys |
| Appearance | `/settings/appearance` | Light, dark, system |
| Layout | `/settings/layout` | Personal layout options |

## How it is wired

`AuthServiceProvider` in the Auth module tells Fortify which actions and Inertia pages to use, and registers the rate limiters. On tenant domains it also points Fortify at the `tenant` guard, so users are logged into the right database.

| Rate limiter | Limit |
| --- | --- |
| `login` | 5 per minute per email + IP |
| `two-factor` | 5 per minute per login session |
| `passkeys` | 10 per minute per credential (or session) + IP |

**Related files**

| File | Role |
| --- | --- |
| `Modules/Auth/Providers/AuthServiceProvider.php` | Fortify actions and views, rate limiters, `StatefulGuard` binding |
| `Modules/Auth/Actions/CreateNewUser.php`, `ResetUserPassword.php` | Registration and password reset |
| `config/fortify.php` | `home` is `/dashboard`; the full feature list |
| `app/Models/User.php` | Uses `TwoFactorAuthenticatable`, `PasskeyAuthenticatable`, `HasRoles` |

## Central and tenant guards

Central users and tenant users live in different databases, so each context has its own session guard. Both guards use the same `App\Models\User` model.

| Guard | Provider and password broker | Database |
| --- | --- | --- |
| `web` | `central_users` | Central |
| `tenant` | `tenant_users` | Tenant |

You never switch guards by hand. On every request the kit sets the Laravel and Fortify guard for the current context, and the `auth` / `guest` middleware aliases map `web` to `tenant` inside a tenant. Write `->middleware('auth')` in both contexts.

::: info Separate accounts
A central user and a tenant user are different records in different databases, even with the same email. Sessions are also per host.
:::

**Related files**: `config/auth.php`, `App\Http\Middleware\InitializeTenancyIfTenantDomain`, `App\Listeners\ConfigureTenantAuth`, `App\Listeners\RevertTenantAuth`. See [Architecture → Central vs tenant context](/docs/core/architecture#central-vs-tenant-context).

## Per-domain features

Each tenant domain can turn Fortify features off without code changes, for example to disable self-registration for one customer. Open **Tenants → Domains → Authentication features**; the dialog lists every feature from `config/fortify.php` with a toggle.

How it works:

```text
domains.auth_features (JSON)   → stored per domain; missing keys count as enabled
tenancy starts                 → ApplyTenantFortifyFeatures filters fortify.features
request to a disabled feature  → EnsureTenantAuthFeatureEnabled returns 404
```

Blocked route names include `register`, `password.request`, `verification.*`, `two-factor.*` and `passkey.*`.

The central domain always uses the full `config/fortify.php` list. To disable a feature everywhere, remove it from that list.

## Registration and permissions

`CreateNewUser` creates a user **without a role or permissions**. Fortify then redirects to `/dashboard`, which requires `View Analytics Dashboard` (central) or `View Tenant Dashboard` (tenant).

::: warning New users see a 403
A freshly registered user gets a **403** on the dashboard until an admin assigns a role.
:::

Your options:

- Assign a role in `Modules\Auth\Actions\CreateNewUser::create()` (below). `RoleEnum::USER` has no dashboard permission by default, so pick a role, or edit `config/permissions/*.php`, to fit your app.
- Turn registration off per domain (see above).

::: details View implementation example
```php
use Modules\RolePermission\Enums\RoleEnum;
use Modules\RolePermission\Services\PermissionService;

$user = User::create([...]);

app(PermissionService::class)->assignRole($user, RoleEnum::USER->value);

return $user;
```
:::

## Email verification

`Features::emailVerification()` is enabled, but `App\Models\User` does **not** implement `MustVerifyEmail` (the import is commented out). The `verified` middleware therefore lets unverified users through.

To require verification, uncomment the `MustVerifyEmail` import in `app/Models/User.php` and add it to the class:

```php
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
```

Seeded users are already verified, and invited users are verified when they accept.

## Passwords

`AppServiceProvider` sets `Password::defaults()`:

| Environment | Rules |
| --- | --- |
| Production | At least 12 characters, mixed case, letters, numbers, symbols, not in known breaches |
| Other | Laravel's default rules |

## Passkeys

Passkeys use `@laravel/passkeys` on the frontend and Fortify's passkey routes.

| Setting (`config/fortify.php`) | Value |
| --- | --- |
| Relying party ID | Host of `APP_URL` |
| Allowed origin | `APP_URL` |

::: tip Use HTTPS locally
Browsers only allow WebAuthn on secure origins. Run `herd secure` to test passkeys.
:::

## Invitations

Two invitation flows let admins create accounts without choosing a password:

- **Tenant admin invitation**: see [Multi-tenancy](/docs/core/multi-tenancy#invitations).
- **User invitation**: see [Users, roles & permissions](/docs/core/users-roles-permissions#invitations).

Both send queued emails with a signed link valid for 7 days; run a [queue worker](/docs/getting-started/local-development#queue-worker).
