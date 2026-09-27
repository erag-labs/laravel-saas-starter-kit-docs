---
title: "React Kit Pages & Routes"
description: "Every Inertia page in the React kit with its route, access rules, layout and purpose, from sign-in and settings pages to tenants, users and setup."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/react/pages.html
  - - meta
    - property: og:title
      content: "React Kit Pages & Routes"
  - - meta
    - property: og:description
      content: "Every Inertia page in the React kit with its route, access rules, layout and purpose, from sign-in and settings pages to tenants, users and setup."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/react/pages.html
  - - meta
    - name: twitter:title
      content: "React Kit Pages & Routes"
  - - meta
    - name: twitter:description
      content: "Every Inertia page in the React kit with its route, access rules, layout and purpose, from sign-in and settings pages to tenants, users and setup."
---

# Pages <Badge type="tip" text="React" />

Pages live in `resources/js/pages`. Each page is a default-exported function component, and its Inertia name is the kebab-case path without `.tsx`:

```text
Inertia::render('users/index') → resources/js/pages/users/index.tsx
```

Controllers live in `Modules/<Module>/Http/Controllers`.

::: info
Routes marked **central** only exist on the central domain (`APP_DOMAIN`, `central.only` middleware). Everything else works on both central and tenant domains, so permissions list both variants (for example `View Users|View Tenant Users`).
:::

## Public and auth pages

Auth pages render inside `AuthLayout` (card, simple or split). Fortify registers the routes, and `Modules/Auth/Providers/AuthServiceProvider.php` binds them to these pages.

| Page file | Route | Purpose |
| --- | --- | --- |
| `home.tsx` | `GET /` (`home`) | Landing page on the central domain. Tenant domains redirect to `login`. No layout. |
| `auth/login.tsx` | `GET /login` (`login`) | Email + password login, passkey login, links to reset/register when enabled for the domain |
| `auth/register.tsx` | `GET /register` (`register`) | Registration, when enabled for the domain |
| `auth/forgot-password.tsx` | `GET /forgot-password` (`password.request`) | Request a reset link |
| `auth/reset-password.tsx` | `GET /reset-password/{token}` (`password.reset`) | Set a new password |
| `auth/verify-email.tsx` | `GET /email/verify` (`verification.notice`) | Resend the verification email |
| `auth/confirm-password.tsx` | `GET /user/confirm-password` (`password.confirm`) | Re-enter password before sensitive pages |
| `auth/two-factor-challenge.tsx` | `GET /two-factor-challenge` (`two-factor.login`) | TOTP code or recovery code; switches the layout title with `setLayoutProps` |
| `auth/accept-invitation.tsx` | `GET /invitation/accept` (`tenant.invitation.show`, tenant, signed) and `GET /users/invitation/{user}` (`users.invitation.show`, signed) | Invited tenant admin or user sets a password. `mode` prop: `'workspace'` or `'user'` |
| `auth/maintenance.tsx` | Rendered by `EnsureTenantIsNotInMaintenance` on tenant domains | Animated maintenance page with the custom message. No layout. |
| `auth/suspended.tsx` | Rendered by `EnsureTenantIsNotSuspended` on tenant domains | Suspended workspace notice with the custom message. No layout. |

## App pages

App pages render inside `AppLayout` and require `auth` + `verified`.

| Page file | Route | Permission | Purpose |
| --- | --- | --- | --- |
| `dashboard.tsx` | `GET /dashboard` (`dashboard`, `Route::inertia`) | `View Analytics Dashboard\|View Tenant Dashboard` | Dashboard placeholder grid |
| `users/index.tsx` | `GET /users` (`users.index`) | `View Users\|View Tenant Users` | User list with search, stats, pagination, create/edit/delete, invitations, permission assignment |
| `roles/index.tsx` | `GET /roles` (`roles.index`) | `View Roles\|View Tenant Roles` | Role list and create/edit/delete (system roles protected) |
| `tenants/index.tsx` | `GET /tenants` (`tenants.index`) — central | `View Tenants` | Tenant list with search, status filter and stats |
| `tenants/create.tsx` | `GET /tenants/create` (`tenants.create`) — central | `Create Tenant` | Create a tenant (company, subdomain, admin, profile data, status) |
| `tenants/show.tsx` | `GET /tenants/{tenant}` (`tenants.show`) — central | `View Tenants` | Tenant detail: edit, domains, reset admin password, resend invitation, delete |
| `tenants/domains.tsx` | `GET /tenants/domains` (`tenants.domains`) — central | `View Tenants` | All domains: filters, search, add, set primary, delete, per-domain settings and auth features |

## Settings pages

`settings/*` pages render inside `AppLayout` plus the settings sub-navigation (`layouts/settings/layout.tsx`). `GET /settings` redirects to `/settings/profile`.

| Page file | Route | Purpose |
| --- | --- | --- |
| `settings/profile.tsx` | `GET /settings/profile` (`profile.edit`) | Name, email, language ("Default" follows the domain), email verification notice, delete account |
| `settings/security.tsx` | `GET /settings/security` (`security.edit`), requires password confirmation | Change password, two-factor authentication, passkeys |
| `settings/appearance.tsx` | `GET /settings/appearance` (`appearance.edit`, `Route::inertia`) | Light / dark / system |
| `settings/layout.tsx` | `GET /settings/layout` (`layout.edit`) | Personal layout: app layout, sidebar variant, collapsible mode |

## Setup pages

`setup/*` pages use the plain `AppLayout`. While the URL starts with `/setup`, the sidebar shows `setupMenus` instead of the main menu. `GET /setup` redirects to `/setup/menus`.

| Page file | Route | Permission | Purpose |
| --- | --- | --- | --- |
| `setup/menus.tsx` | `GET /setup/menus` (`setup.menus.index`) | `View Navigation Menus\|View Tenant Menus` | Drag & drop menu order (`sortablejs`), reset to defaults |
| `setup/layout.tsx` | `GET /setup/layout` (`setup.layout.index`) | `Update Layout Settings\|Update Tenant Layout` | Global default app layout, sidebar settings and auth layout |
| `setup/tenant-settings.tsx` | `GET /setup/tenant-settings` (`setup.tenant-settings.edit`) — central | `Manage Tenant Maintenance` | Global maintenance mode for tenant workspaces |

## Error page

| Page file | Rendered by | Purpose |
| --- | --- | --- |
| `errors/error.tsx` | Exception handler in `bootstrap/app.php` | 403, 404, 500 and 503 responses. Uses `AppLayout` for signed-in users and `AuthLayout` for guests. |

In `local` and `testing`, only 403 renders this page. Other statuses show Laravel's debug page.

## Partials

Page-specific modals and sections live in `partials/` next to the page:

| File | Used by |
| --- | --- |
| `users/partials/user-form-modal.tsx` | Create/edit user, "Send invitation email" |
| `users/partials/assign-user-permissions-modal.tsx` | Grouped permission checkboxes for one user |
| `roles/partials/role-form-modal.tsx` | Create/edit role |
| `tenants/partials/edit-tenant-modal.tsx` | Edit tenant details and status |
| `tenants/partials/organization-domains.tsx` | Domains card on the tenant detail page |
| `tenants/partials/domain-modal.tsx` | Add a domain |
| `tenants/partials/domain-settings-modal.tsx` | Per-domain App name and default language |
| `tenants/partials/domain-auth-features-modal.tsx` | Per-domain registration / password reset / verification / 2FA / passkeys toggles |
| `tenants/partials/reset-password-modal.tsx` | Send a reset link or set the tenant admin password |
| `tenants/partials/maintenance-mode-form.tsx` | Maintenance message, secret bypass link, allowed IPs |

::: tip
Adding a page? Follow [Development → Adding a page](/docs/react/development#adding-a-page).
:::
