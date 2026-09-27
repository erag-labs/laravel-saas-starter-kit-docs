---
title: "Laravel Database-per-Tenant Multi-Tenancy"
description: "Database-per-tenant multi-tenancy with stancl/tenancy: identification by domain, the tenant creation pipeline, workspace status and admin invitations."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/core/multi-tenancy.html
  - - meta
    - property: og:title
      content: "Laravel Database-per-Tenant Multi-Tenancy"
  - - meta
    - property: og:description
      content: "Database-per-tenant multi-tenancy with stancl/tenancy: identification by domain, the tenant creation pipeline, workspace status and admin invitations."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/core/multi-tenancy.html
  - - meta
    - name: twitter:title
      content: "Laravel Database-per-Tenant Multi-Tenancy"
  - - meta
    - name: twitter:description
      content: "Database-per-tenant multi-tenancy with stancl/tenancy: identification by domain, the tenant creation pipeline, workspace status and admin invitations."
---

# Multi-tenancy

The kits use **stancl/tenancy** (`^3.10`) in **multi-database** mode: every tenant (workspace) gets its own database and is identified by the request's domain. Data is isolated at the database level, so tenant code does not need `where tenant_id = ...` filters.

```text
vue.test            → central app  (central DB: saas_laravel_vue)
acme.vue.test       → tenant 1     (DB: tenant1)
globex.vue.test     → tenant 2     (DB: tenant2)
```

## Identification

The host of each request decides the context:

```text
host == APP_DOMAIN              → central app
host found in domains table     → tenancy initialized for that tenant
unknown host                    → 404
```

- `APP_DOMAIN` is the only central domain (`central_domains` in `config/tenancy.php`).
- `InitializeTenancyIfTenantDomain` runs first on every request and hands non-central hosts to stancl's `InitializeTenancyByDomain`.
- Tenant domains are always subdomains of `APP_DOMAIN`: the subdomain you enter (`acme`) is stored as `acme.vue.test`. See [Domains](/docs/core/domains).

## What is tenant-aware

Once a tenant is identified, these bootstrappers (`config/tenancy.php`) switch Laravel services to that tenant:

| Bootstrapper | Effect inside a tenant |
| --- | --- |
| `DatabaseTenancyBootstrapper` | Default connection becomes the tenant database |
| `CacheTenancyBootstrapper` | Cache calls are tagged per tenant |
| `FilesystemTenancyBootstrapper` | `local` and `public` disks and `storage_path()` are suffixed per tenant |
| `QueueTenancyBootstrapper` | Jobs remember the tenant and re-initialize it when processed |

On top of that the kit switches the auth guard, Fortify features, app name and locale. See [Architecture](/docs/core/architecture#central-vs-tenant-context).

## Managing tenants

All tenant screens are central-only (`central.only` middleware) and live in `Modules/Tenant`:

| Route | Page | Permission |
| --- | --- | --- |
| `GET /tenants` | List with search, status filter and stats (total, active, trial, pending, suspended) | `View Tenants` |
| `GET /tenants/create` | Create form | `Create Tenant` |
| `GET /tenants/{tenant}` | Detail: profile, domains, admin password, invitation | `View Tenants` |
| `PUT /tenants/{tenant}` | Edit | `Edit Tenant` |
| `DELETE /tenants/{tenant}` | Delete (drops the tenant database) | `Delete Tenant` |
| `GET /tenants/domains` | All domains | `View Tenants` |

### Tenant data

Tenants are stored in the central `tenants` table (`App\Models\Tenant`). Some attributes are real columns; the rest are kept in the `data` JSON column by stancl's virtual columns. You read and write both the same way (`$tenant->industry`).

| Stored as | Attributes |
| --- | --- |
| Columns | `id`, `first_name`, `last_name`, `email`, `phone`, `company`, `team_size` |
| `data` JSON | `industry`, `registration_number`, `tax_number`, `workspace_status`, `work_week`, `status_message` |

Select options come from enums in `Modules/Tenant/Enums`:

| Enum | Values |
| --- | --- |
| `TeamSizeEnum` | `1-10`, `11-50`, `51-200`, `201-500`, `500+` |
| `IndustryEnum` | `technology`, `fintech`, `healthcare`, `ecommerce`, `agency`, `education`, `other` |
| `WorkWeekEnum` | `mon_fri`, `mon_sat`, `sun_thu` |
| `WorkspaceStatusEnum` | See [Workspace status](#workspace-status) |

## Creating a tenant

Creating a tenant from **Tenants → Add Tenant** does everything needed for a working workspace in one request:

```text
TenantController::store()  → validates TenantRegisterData
TenantService::createTenant()
  1. creates the Tenant
  2. creates its primary domain <subdomain>.APP_DOMAIN
  3. sends the invitation, if requested
TenantCreated event        → provisioning pipeline (synchronous)
```

| Pipeline step | Result |
| --- | --- |
| `CreateDatabase` | `CREATE DATABASE tenant<id>` |
| `MigrateDatabase` | Runs `database/migrations/tenant` |
| `SeedDatabase` | Runs `Database\Seeders\tenant\TenantDatabaseSeeder` (roles, tenant permissions, tenant menus, default users) |
| `CreateTenantUserJob` | Creates the tenant admin (tenant's email) with the `super-admin` role and **all** `tenant` permissions |

Deleting a tenant fires `TenantDeleted` → `DeleteDatabase`.

::: details View implementation example
```php
// App\Providers\TenancyServiceProvider::events()
Events\TenantCreated::class => [
    JobPipeline::make([
        Jobs\CreateDatabase::class,
        Jobs\MigrateDatabase::class,
        Jobs\SeedDatabase::class,
        CreateTenantUserJob::class,
    ])->send(fn (Events\TenantCreated $event) => $event->tenant)
      ->shouldBeQueued(false),
],
```
:::

::: warning Queuing the pipeline
The pipeline runs inside the request, which can be slow with many migrations. You can switch `shouldBeQueued(false)` to `true`, but then the tenant is only usable after the worker finishes. `CreateTenantUserJob` also reads the admin password and the invitation flag from the current request, which a queue worker does not have, so adjust it before queuing.
:::

## Workspace status

`Modules\Tenant\Enums\WorkspaceStatusEnum`:

| Status | Value | Behaviour |
| --- | --- | --- |
| Active | `active` | Normal access |
| Trial | `trial` | Normal access (label only) |
| Pending Invitation | `pending` | Set automatically when an invitation is sent; becomes `active` when the admin accepts |
| Suspended | `suspended` | Every tenant page renders `auth/Suspended` (HTTP 403) with the optional status message; only logout works |

See [Maintenance & suspension](/docs/core/maintenance-and-suspension).

## Invitations

An invitation lets the tenant admin choose their own password instead of you setting one in the create form.

```text
Create tenant with "send invitation" on
  → admin created without a password, workspace = pending
  → queued email with a signed link on the primary domain (/invitation/accept, valid 7 days)
  → admin sets a password (auth/AcceptInvitation)
  → admin is verified and signed in, workspace = active
```

- Pending tenants can be re-invited from the tenant page (`POST /tenants/{tenant}/invitation`, throttled 3 per minute).
- The email is queued, so a [queue worker](/docs/getting-started/local-development#queue-worker) must be running.

**Related files**: `TenantService::sendInvitation()`, `Modules/Tenant/Notifications/TenantInvitationNotification.php`, `Modules/Tenant/Http/Controllers/TenantInvitationController.php`, `Modules/Tenant/routes/tenant.php`.

## Admin password reset

From the tenant's domains, a central admin can reset the tenant admin's password (requires `Edit Tenant`):

| Option | Route | What happens |
| --- | --- | --- |
| Email a reset link | `POST /tenants/domains/{domain}/password-reset` | Creates a `tenant_users` token and sends `TenantPasswordResetNotification` with a link on that domain |
| Set a password manually | `PUT /tenants/domains/{domain}/password` | Password is updated directly |

## Working in tenant context from code

Inside a tenant request, tenancy is already initialized. To run code for a specific tenant elsewhere (commands, jobs, central pages), use `run()`:

```php
$tenant->run(function () {
    User::query()->count(); // tenant database
});

tenancy()->initialized; // true inside a tenant request
tenant();               // current Tenant or null
```

## Tenant migrations and seeders

| What | Location |
| --- | --- |
| Tenant migrations | `database/migrations/tenant` |
| Tenant seeder | `database/seeders/tenant/TenantDatabaseSeeder.php` |

```bash
php artisan tenants:migrate                  # migrate all tenants
php artisan tenants:migrate --tenants=1      # one tenant
php artisan tenants:seed                     # run TenantDatabaseSeeder for all tenants
```

`tenants:list` and `tenants:run <command>` are also available. Details: [Database](/docs/core/database).
