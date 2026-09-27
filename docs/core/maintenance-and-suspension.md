---
title: "Tenant Maintenance Mode & Suspension"
description: "Put every tenant workspace into maintenance with a bypass link and IP allow list, or suspend a single workspace, while the central app stays online."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/core/maintenance-and-suspension.html
  - - meta
    - property: og:title
      content: "Tenant Maintenance Mode & Suspension"
  - - meta
    - property: og:description
      content: "Put every tenant workspace into maintenance with a bypass link and IP allow list, or suspend a single workspace, while the central app stays online."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/core/maintenance-and-suspension.html
  - - meta
    - name: twitter:title
      content: "Tenant Maintenance Mode & Suspension"
  - - meta
    - name: twitter:description
      content: "Put every tenant workspace into maintenance with a bypass link and IP allow list, or suspend a single workspace, while the central app stays online."
---

# Maintenance & suspension

Two mechanisms block access to tenant workspaces without touching the central app: **maintenance mode** takes every workspace offline for planned work, **suspension** locks a single tenant.

| | Maintenance mode | Suspension |
| --- | --- | --- |
| Scope | **All** tenant workspaces | One tenant |
| Set in | Setup → Tenant Settings | Tenant edit form (Workspace status) |
| Page | `auth/Maintenance` (HTTP 503) | `auth/Suspended` (HTTP 403) |
| Still reachable | Login, two-factor, passkey login, logout, bypass link | Logout only |
| Bypass | Secret link, IP/CIDR allow list | None |
| Middleware | `EnsureTenantIsNotInMaintenance` | `EnsureTenantIsNotSuspended` |

The central app is never affected by either mechanism.

::: info Laravel's own maintenance mode
This is separate from `php artisan down`, which takes the whole application (central and tenants) offline.
:::

## Maintenance mode

Turn it on in **Setup → Tenant Settings** (`/setup/tenant-settings`, central only, permission `Manage Tenant Maintenance`).

| Field | Rules | Purpose |
| --- | --- | --- |
| `enabled` | boolean | Turns maintenance on for every tenant |
| `message` | max 500 chars | Shown on the maintenance page |
| `secret` | 8-64 chars, `alpha_dash` | Enables the bypass link |
| `allowed_ips` | up to 50 IPs or CIDR ranges | These IPs are never blocked |

How a tenant request is handled while maintenance is on:

```text
login / two-factor / passkey login / logout / bypass route → allowed
IP in allowed_ips                                          → allowed
valid bypass cookie                                        → allowed
anything else                                              → maintenance page (503)
```

### Bypass link

Lets your team use a workspace while it is in maintenance:

```text
https://acme.vue.test/maintenance/bypass/{secret}
```

- Sign in to the tenant first; the route requires a signed-in tenant user (`auth:tenant`).
- A valid secret sets the `tenant_maintenance_bypass` cookie for **12 hours** and redirects to `/`.
- The cookie holds an HMAC of the secret with `APP_KEY`, so changing the secret invalidates existing bypass cookies.

### IP allow list

Requests from any listed IP or CIDR range pass straight through. Entries are validated by the `IpAddressOrCidr` rule and checked with Symfony's `IpUtils::checkIp()`.

**Related files**

| File | Role |
| --- | --- |
| `Modules/Tenant/Data/MaintenanceModeData.php` | Fields and validation |
| `Modules/Tenant/Services/TenantMaintenanceService.php` | Reads and stores the setting (central `settings` table, key `tenant_maintenance`), bypass and IP checks |
| `Modules/Tenant/Http/Middleware/EnsureTenantIsNotInMaintenance.php` | Blocks requests, lists the open routes |
| `Modules/Tenant/Http/Controllers/TenantMaintenanceBypassController.php` | Sets the bypass cookie |
| `Modules/Tenant/Rules/IpAddressOrCidr.php` | IP / CIDR validation |

## Suspension

Set a tenant's **Workspace status** to **Suspended** in the tenant edit form, optionally with a **status message** (max 500 chars).

On every request to that tenant's domains, `EnsureTenantIsNotSuspended` renders `auth/Suspended` with the company name and message (HTTP 403). Only `logout` still works. Set the status back to Active or Trial to restore access.

See [Multi-tenancy → Workspace status](/docs/core/multi-tenancy#workspace-status).
