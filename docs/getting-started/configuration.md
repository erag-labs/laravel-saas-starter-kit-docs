---
title: "Laravel SaaS Kit Configuration"
description: "The .env keys and config files that control tenancy, authentication, permissions, translations and queues in the SaaS Laravel starter kits."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/getting-started/configuration.html
  - - meta
    - property: og:title
      content: "Laravel SaaS Kit Configuration"
  - - meta
    - property: og:description
      content: "The .env keys and config files that control tenancy, authentication, permissions, translations and queues in the SaaS Laravel starter kits."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/getting-started/configuration.html
  - - meta
    - name: twitter:title
      content: "Laravel SaaS Kit Configuration"
  - - meta
    - name: twitter:description
      content: "The .env keys and config files that control tenancy, authentication, permissions, translations and queues in the SaaS Laravel starter kits."
---

# Configuration

Most settings are standard Laravel. This page covers the keys and files that are specific to the kits. For every `.env` key and its default, see the [Environment reference](/docs/reference/environment).

## Key `.env` values

| Key | Example (Vue kit) | Used for |
| --- | --- | --- |
| `APP_URL` | `http://vue.test` | Fortify passkeys, and the scheme (`http` / `https`) of tenant links |
| `APP_DOMAIN` | `vue.test` | The central domain, and the suffix for tenant subdomains |
| `DB_CONNECTION`, `DB_DATABASE` | `mysql`, `saas_laravel_vue` | Central database; tenant databases are created on the same server |
| `SESSION_DRIVER` | `database` | Sessions |
| `QUEUE_CONNECTION` | `database` | Queued emails and jobs |
| `CACHE_STORE` | `database` | Cache |
| `MAIL_MAILER` | `log` | Writes emails to the log until you configure a real mailer |

Where the database-backed drivers store their data:

| Driver | Central domain | Tenant domain |
| --- | --- | --- |
| Sessions | Central `sessions` table | That tenant's `sessions` table (sessions use the active connection) |
| Cache | Central `cache` table | Tenant databases have their own `cache` tables |
| Queue | Central `jobs` table | Also the central `jobs` table (see [`config/queue.php`](#config-queue-php)) |

## `config/tenancy.php`

`APP_DOMAIN` is read here twice: as `central_domains` (a single-item array) and as `domain` (the suffix for tenant subdomains).

| Key | Value | Meaning |
| --- | --- | --- |
| `tenant_model` | `App\Models\Tenant` | Integer auto-increment IDs |
| `domain_model` | `App\Models\Domain` | Adds `is_primary`, `app_name`, `locale`, `auth_features` |
| `central_domains` | `[env('APP_DOMAIN')]` | Requests on any other host initialize tenancy |
| `domain` | `env('APP_DOMAIN')` | Tenant domains are `<sub>.<domain>` |
| `bootstrappers` | Database, Cache, Filesystem, Queue | Redis bootstrapper is commented out |
| `database.central_connection` | `env('DB_CONNECTION', 'central')` | |
| `database.prefix` | `'tenant'` (React: `env('TENANCY_DB_PREFIX', 'tenant')`) | Tenant DB name = prefix + tenant id |
| `database.managers` | sqlite, mysql, mariadb, pgsql | |
| `filesystem.disks` | `local`, `public` | Suffixed per tenant (`storage/tenant<id>/...`) |
| `migration_parameters` | `--path => database/migrations/tenant` | Used by `tenants:migrate` |
| `seeder_parameters` | `--class => TenantDatabaseSeeder` | Used by `tenants:seed` and tenant creation |

See [Database → Tenant database naming](/docs/core/database#tenant-database-naming) before changing the prefix.

## `config/fortify.php`

| Key | Value |
| --- | --- |
| `guard` / `passwords` | `web` / `central_users` (switched to `tenant` / `tenant_users` on tenant domains) |
| `home` | `/dashboard` |
| `lowercase_usernames` | `true` |
| `features` | `registration`, `resetPasswords`, `emailVerification`, `twoFactorAuthentication` (confirm + confirmPassword), `passkeys` (confirmPassword) |
| `passkeys.relying_party_id` | Host of `APP_URL` |
| `passkeys.user_handle_secret` | `env('PASSKEYS_USER_HANDLE_SECRET', config('app.key'))` |

::: info The feature list is the maximum
Tenant domains can switch individual features off, but never on if they are missing here. See [Authentication → Per-domain features](/docs/core/authentication#per-domain-features).
:::

## `config/auth.php`

Two session guards share `App\Models\User`:

| Guard | Provider | Password broker |
| --- | --- | --- |
| `web` | `central_users` | `central_users` |
| `tenant` | `tenant_users` | `tenant_users` |

`AUTH_PASSWORD_TIMEOUT` (default `10800` seconds) controls how long a password confirmation lasts.

## `config/permission.php` and `config/permissions/*`

| File | Purpose |
| --- | --- |
| `config/permission.php` | Standard spatie config: teams disabled, wildcard permissions disabled, 24-hour cache |
| `config/permissions/*.php` | Central permissions and the default system roles for each |
| `config/permissions/tenant/*.php` | Tenant permissions and the default system roles for each |

Each file becomes one permission group in the UI; the file name is the group key. File format and examples: [Users, roles & permissions → Permissions](/docs/core/users-roles-permissions#permissions).

## `config/inertia-lang.php`

| Key | Value |
| --- | --- |
| `lang_path` | `base_path('lang')` |
| `output_lang` | `resource_path('js/lang')` |

`php artisan erag:generate-lang` exports PHP translation files from `lang_path` to JSON in `output_lang`. See [Localization](/docs/core/localization).

## `config/queue.php`

All queued jobs, including those dispatched inside a tenant, are stored in the **central** `jobs` table, so a single worker processes them for every tenant.

This works because the `database` queue connection reads `DB_QUEUE_CONNECTION`, which defaults to `DB_CONNECTION` (the central connection name, e.g. `mysql`), not the tenant connection. stancl's `QueueTenancyBootstrapper` restores the tenant context when each job runs.

::: details View the queue connection
```php
'database' => [
    'driver' => 'database',
    'connection' => env('DB_QUEUE_CONNECTION', env('DB_CONNECTION')),
    'table' => env('DB_QUEUE_TABLE', 'jobs'),
    'queue' => env('DB_QUEUE', 'default'),
    'retry_after' => (int) env('DB_QUEUE_RETRY_AFTER', 90),
],
```
:::

More: [Local development → Queue worker](/docs/getting-started/local-development#queue-worker).

## Other files

| File | Notes |
| --- | --- |
| `config/app.php` | `locale` / `fallback_locale` from `APP_LOCALE` / `APP_FALLBACK_LOCALE` (`en`) |
| `config/data.php` | spatie/laravel-data defaults |
| `config/inertia.php` | Inertia server settings |
| `bootstrap/app.php` | Middleware registration, aliases (`auth`, `guest`, `central.only`, `permission`, `role`) and error page rendering |
| `bootstrap/providers.php` | App and module service providers |
