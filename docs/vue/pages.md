---
title: "Vue Kit Pages & Routes"
description: "Every Inertia page in the Vue kit with its route, access rules, layout and purpose, from sign-in and settings pages to tenants, users and setup."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/vue/pages.html
  - - meta
    - property: og:title
      content: "Vue Kit Pages & Routes"
  - - meta
    - property: og:description
      content: "Every Inertia page in the Vue kit with its route, access rules, layout and purpose, from sign-in and settings pages to tenants, users and setup."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/vue/pages.html
  - - meta
    - name: twitter:title
      content: "Vue Kit Pages & Routes"
  - - meta
    - name: twitter:description
      content: "Every Inertia page in the Vue kit with its route, access rules, layout and purpose, from sign-in and settings pages to tenants, users and setup."
---

# Pages <Badge type="tip" text="Vue" />

Pages live in `resources/js/pages`. The Inertia page name is the path without `.vue`:

```text
Inertia::render('users/Index') → resources/js/pages/users/Index.vue
```

Controllers live in `Modules/<Module>/Http/Controllers`. Default layouts are explained in [Layouts](/docs/vue/layouts).

::: info
Routes marked **central** only exist on the central domain (`APP_DOMAIN`, `central.only` middleware). Everything else works on the central domain and on tenant domains; the permission names include both variants (for example `View Users|View Tenant Users`).
:::

## Public and auth pages

Auth pages render inside `AuthLayout` (card, simple or split). Fortify registers the auth routes; `Modules/Auth/Providers/AuthServiceProvider.php` binds them to these pages.

| Page file | Route | Purpose |
| --- | --- | --- |
| `Home.vue` | `GET /` (`home`) | Landing page on the central domain. Tenant domains redirect to `login`. No layout. |
| `auth/Login.vue` | `GET /login` (`login`) | Email + password login, passkey login, links to reset/register when enabled for the domain |
| `auth/Register.vue` | `GET /register` (`register`) | Registration, when enabled for the domain |
| `auth/ForgotPassword.vue` | `GET /forgot-password` (`password.request`) | Request a reset link |
| `auth/ResetPassword.vue` | `GET /reset-password/{token}` (`password.reset`) | Set a new password |
| `auth/VerifyEmail.vue` | `GET /email/verify` (`verification.notice`) | Resend the verification email |
| `auth/ConfirmPassword.vue` | `GET /user/confirm-password` (`password.confirm`) | Re-enter password before sensitive pages |
| `auth/TwoFactorChallenge.vue` | `GET /two-factor-challenge` (`two-factor.login`) | TOTP code or recovery code; switches the layout title with `setLayoutProps` |
| `auth/AcceptInvitation.vue` | `GET /invitation/accept` (`tenant.invitation.show`, tenant, signed)<br>`GET /users/invitation/{user}` (`users.invitation.show`, signed) | Invited tenant admin or user sets a password. `mode` prop: `'workspace'` or `'user'` |
| `auth/Maintenance.vue` | Rendered by `EnsureTenantIsNotInMaintenance` on tenant domains | Animated maintenance page with the custom message. No layout. |
| `auth/Suspended.vue` | Rendered by `EnsureTenantIsNotSuspended` on tenant domains | Suspended workspace notice with the custom message. No layout. |

## App pages

App pages render inside `AppLayout` and require `auth` + `verified`.

| Page file | Route | Permission | Purpose |
| --- | --- | --- | --- |
| `Dashboard.vue` | `GET /dashboard` (`dashboard`, `Route::inertia`) | `View Analytics Dashboard\|View Tenant Dashboard` | Dashboard placeholder grid |
| `users/Index.vue` | `GET /users` (`users.index`) | `View Users\|View Tenant Users` | User list with search, stats, pagination, create/edit/delete, invitations, permission assignment |
| `roles/Index.vue` | `GET /roles` (`roles.index`) | `View Roles\|View Tenant Roles` | Role list and create/edit/delete (system roles protected) |
| `tenants/Index.vue` | `GET /tenants` (`tenants.index`) — central | `View Tenants` | Tenant list with search, status filter and stats |
| `tenants/Create.vue` | `GET /tenants/create` (`tenants.create`) — central | `Create Tenant` | Create a tenant (company, subdomain, admin, profile data, status) |
| `tenants/Show.vue` | `GET /tenants/{tenant}` (`tenants.show`) — central | `View Tenants` | Tenant detail: edit, domains, reset admin password, resend invitation, delete |
| `tenants/Domains.vue` | `GET /tenants/domains` (`tenants.domains`) — central | `View Tenants` | All domains: filters, search, add, set primary, delete, per-domain settings and auth features |

## Settings pages

`settings/*` pages render inside `AppLayout` + `layouts/settings/Layout.vue` (the Profile / Security / Appearance / Layout sub-navigation). `GET /settings` redirects to `/settings/profile`.

| Page file | Route | Purpose |
| --- | --- | --- |
| `settings/Profile.vue` | `GET /settings/profile` (`profile.edit`) | Name, email, language ("Default" follows the domain), email verification notice, delete account |
| `settings/Security.vue` | `GET /settings/security` (`security.edit`), requires password confirmation | Change password, two-factor authentication, passkeys |
| `settings/Appearance.vue` | `GET /settings/appearance` (`appearance.edit`, `Route::inertia`) | Light / dark / system |
| `settings/Layout.vue` | `GET /settings/layout` (`layout.edit`) | Personal layout: app layout, sidebar variant, collapsible mode |

## Setup pages

`setup/*` pages use the plain `AppLayout`; the sidebar switches to `setupMenus` while the URL starts with `/setup`. `GET /setup` redirects to `/setup/menus`.

| Page file | Route | Permission | Purpose |
| --- | --- | --- | --- |
| `setup/Menus.vue` | `GET /setup/menus` (`setup.menus.index`) | `View Navigation Menus\|View Tenant Menus` | Drag & drop menu order (`vue-draggable-plus`), reset to defaults |
| `setup/Layout.vue` | `GET /setup/layout` (`setup.layout.index`) | `Update Layout Settings\|Update Tenant Layout` | Global default app and auth layout |
| `setup/TenantSettings.vue` | `GET /setup/tenant-settings` (`setup.tenant-settings.edit`) — central | `Manage Tenant Maintenance` | Global maintenance mode for tenant workspaces |

## Error page

| Page file | Rendered by | Purpose |
| --- | --- | --- |
| `errors/Error.vue` | Exception handler in `bootstrap/app.php` | 403, 404, 500 and 503 responses. Uses `AppLayout` for signed-in users and `AuthLayout` for guests. |

In `local` and `testing` only 403 renders this page; other statuses show Laravel's debug page.

## Partials

Page-specific modals and sections live in `Partials/` next to the page:

| File | Used by |
| --- | --- |
| `users/Partials/UserFormModal.vue` | Create/edit user, "Send invitation email" |
| `users/Partials/AssignUserPermissionsModal.vue` | Grouped permission checkboxes for one user |
| `roles/Partials/RoleFormModal.vue` | Create/edit role |
| `tenants/Partials/EditTenantModal.vue` | Edit tenant details and status |
| `tenants/Partials/OrganizationDomains.vue` | Domains card on the tenant detail page |
| `tenants/Partials/DomainModal.vue` | Add a domain |
| `tenants/Partials/DomainSettingsModal.vue` | Per-domain App name and default language |
| `tenants/Partials/DomainAuthFeaturesModal.vue` | Per-domain registration / password reset / verification / 2FA / passkeys toggles |
| `tenants/Partials/ResetPasswordModal.vue` | Send a reset link or set the tenant admin password |
| `tenants/Partials/MaintenanceModeForm.vue` | Maintenance message, secret bypass link, allowed IPs |

::: tip
Adding a page? Follow [Development → Adding a page](/docs/vue/development#adding-a-page).
:::
