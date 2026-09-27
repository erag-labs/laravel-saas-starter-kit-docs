---
title: "Svelte Kit Pages & Routes"
description: "Every Inertia page in the Svelte kit with its route, access rules, layout and purpose, from sign-in and settings pages to tenants, users and setup."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/svelte/pages.html
  - - meta
    - property: og:title
      content: "Svelte Kit Pages & Routes"
  - - meta
    - property: og:description
      content: "Every Inertia page in the Svelte kit with its route, access rules, layout and purpose, from sign-in and settings pages to tenants, users and setup."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/svelte/pages.html
  - - meta
    - name: twitter:title
      content: "Svelte Kit Pages & Routes"
  - - meta
    - name: twitter:description
      content: "Every Inertia page in the Svelte kit with its route, access rules, layout and purpose, from sign-in and settings pages to tenants, users and setup."
---

# Pages <Badge type="tip" text="Svelte" />

Pages live in `resources/js/pages`. The Inertia page name is the path without `.svelte`:

```text
Inertia::render('users/Index') → resources/js/pages/users/Index.svelte
```

Controllers live in `Modules/<Module>/Http/Controllers`.

::: info
Routes marked **central** only exist on the central domain (`APP_DOMAIN`, `central.only` middleware). Everything else works on the central domain and on tenant domains; the permission names include both variants (for example `View Users|View Tenant Users`).
:::

## Public and auth pages

Auth pages render inside `AuthLayout` (card, simple or split). Fortify registers the auth routes; `Modules/Auth/Providers/AuthServiceProvider.php` binds them to these pages.

| Page file | Route | Purpose |
| --- | --- | --- |
| `Home.svelte` | `GET /` (`home`) | Landing page on the central domain. Tenant domains redirect to `login`. No layout. |
| `auth/Login.svelte` | `GET /login` (`login`) | Email + password login, passkey login, links to reset/register when enabled for the domain |
| `auth/Register.svelte` | `GET /register` (`register`) | Registration, when enabled for the domain |
| `auth/ForgotPassword.svelte` | `GET /forgot-password` (`password.request`) | Request a reset link |
| `auth/ResetPassword.svelte` | `GET /reset-password/{token}` (`password.reset`) | Set a new password |
| `auth/VerifyEmail.svelte` | `GET /email/verify` (`verification.notice`) | Resend the verification email |
| `auth/ConfirmPassword.svelte` | `GET /user/confirm-password` (`password.confirm`) | Re-enter password before sensitive pages |
| `auth/TwoFactorChallenge.svelte` | `GET /two-factor-challenge` (`two-factor.login`) | TOTP code or recovery code; switches the layout title with `setLayoutProps` |
| `auth/AcceptInvitation.svelte` | `GET /invitation/accept` (`tenant.invitation.show`, tenant, signed) and `GET /users/invitation/{user}` (`users.invitation.show`, signed) | Invited tenant admin or user sets a password. `mode` prop: `'workspace'` or `'user'` |
| `auth/Maintenance.svelte` | Rendered by `EnsureTenantIsNotInMaintenance` on tenant domains | Animated maintenance page with the custom message. No layout. |
| `auth/Suspended.svelte` | Rendered by `EnsureTenantIsNotSuspended` on tenant domains | Suspended workspace notice with the custom message. No layout. |

## App pages

App pages render inside `AppLayout` and require `auth` + `verified`.

| Page file | Route | Permission | Purpose |
| --- | --- | --- | --- |
| `Dashboard.svelte` | `GET /dashboard` (`dashboard`, `Route::inertia`) | `View Analytics Dashboard\|View Tenant Dashboard` | Dashboard placeholder grid |
| `users/Index.svelte` | `GET /users` (`users.index`) | `View Users\|View Tenant Users` | User list with search, stats, pagination, create/edit/delete, invitations, permission assignment |
| `roles/Index.svelte` | `GET /roles` (`roles.index`) | `View Roles\|View Tenant Roles` | Role list and create/edit/delete (system roles protected) |
| `tenants/Index.svelte` | `GET /tenants` (`tenants.index`) — central | `View Tenants` | Tenant list with search, status filter and stats |
| `tenants/Create.svelte` | `GET /tenants/create` (`tenants.create`) — central | `Create Tenant` | Create a tenant (company, subdomain, admin, profile data, status) |
| `tenants/Show.svelte` | `GET /tenants/{tenant}` (`tenants.show`) — central | `View Tenants` | Tenant detail: edit, domains, reset admin password, resend invitation, delete |
| `tenants/Domains.svelte` | `GET /tenants/domains` (`tenants.domains`) — central | `View Tenants` | All domains: filters, search, add, set primary, delete, per-domain settings and auth features |

## Settings pages

`settings/*` pages render inside `AppLayout` + `layouts/settings/Layout.svelte` (the Profile / Security / Appearance / Layout sub-navigation). `GET /settings` redirects to `/settings/profile`.

| Page file | Route | Purpose |
| --- | --- | --- |
| `settings/Profile.svelte` | `GET /settings/profile` (`profile.edit`) | Name, email, language ("Default" follows the domain), email verification notice, delete account |
| `settings/Security.svelte` | `GET /settings/security` (`security.edit`), requires password confirmation | Change password, two-factor authentication, passkeys |
| `settings/Appearance.svelte` | `GET /settings/appearance` (`appearance.edit`, `Route::inertia`) | Light / dark / system |
| `settings/Layout.svelte` | `GET /settings/layout` (`layout.edit`) | Personal layout: app layout, sidebar variant, collapsible mode |

## Setup pages

`setup/*` pages use the plain `AppLayout`; the sidebar switches to `setupMenus` while the URL starts with `/setup`. `GET /setup` redirects to `/setup/menus`.

| Page file | Route | Permission | Purpose |
| --- | --- | --- | --- |
| `setup/Menus.svelte` | `GET /setup/menus` (`setup.menus.index`) | `View Navigation Menus\|View Tenant Menus` | Drag & drop menu order (`sortablejs`), reset to defaults |
| `setup/Layout.svelte` | `GET /setup/layout` (`setup.layout.index`) | `Update Layout Settings\|Update Tenant Layout` | Global default app and auth layout |
| `setup/TenantSettings.svelte` | `GET /setup/tenant-settings` (`setup.tenant-settings.edit`) — central | `Manage Tenant Maintenance` | Global maintenance mode for tenant workspaces |

## Error page

| Page file | Rendered by | Purpose |
| --- | --- | --- |
| `errors/Error.svelte` | Exception handler in `bootstrap/app.php` | 403, 404, 500 and 503 responses. Uses `AppLayout` for signed-in users and `AuthLayout` for guests. |

In `local` and `testing` only 403 renders this page; other statuses show Laravel's debug page.

## Partials

Page-specific modals and sections live in `Partials/` next to the page:

| File | Used by |
| --- | --- |
| `users/Partials/UserFormModal.svelte` | Create/edit user, "Send invitation email" |
| `users/Partials/AssignUserPermissionsModal.svelte` | Grouped permission checkboxes for one user |
| `roles/Partials/RoleFormModal.svelte` | Create/edit role |
| `tenants/Partials/EditTenantModal.svelte` | Edit tenant details and status |
| `tenants/Partials/OrganizationDomains.svelte` | Domains card on the tenant detail page |
| `tenants/Partials/DomainModal.svelte` | Add a domain |
| `tenants/Partials/DomainSettingsModal.svelte` | Per-domain App name and default language |
| `tenants/Partials/DomainAuthFeaturesModal.svelte` | Per-domain registration / password reset / verification / 2FA / passkeys toggles |
| `tenants/Partials/ResetPasswordModal.svelte` | Send a reset link or set the tenant admin password |
| `tenants/Partials/MaintenanceModeForm.svelte` | Maintenance message, secret bypass link, allowed IPs |

::: tip
Adding a page? Follow [Development → Adding a page](/docs/svelte/development#adding-a-page).
:::
