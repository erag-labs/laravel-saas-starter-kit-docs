---
title: "Troubleshooting Laravel SaaS Kits"
description: "Fixes for common problems: Vite manifest errors, tenant subdomains, queued emails, stale translations or types, tenant database clashes and 403 errors."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/reference/troubleshooting.html
  - - meta
    - property: og:title
      content: "Troubleshooting Laravel SaaS Kits"
  - - meta
    - property: og:description
      content: "Fixes for common problems: Vite manifest errors, tenant subdomains, queued emails, stale translations or types, tenant database clashes and 403 errors."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/reference/troubleshooting.html
  - - meta
    - name: twitter:title
      content: "Troubleshooting Laravel SaaS Kits"
  - - meta
    - name: twitter:description
      content: "Fixes for common problems: Vite manifest errors, tenant subdomains, queued emails, stale translations or types, tenant database clashes and 403 errors."
---

# Troubleshooting

| Symptom | Usual cause |
| --- | --- |
| Vite manifest error | Frontend not built / dev server not running |
| 404 on `localhost` or `127.0.0.1` | App opened on a host that is not `APP_DOMAIN` |
| Tenant subdomain does not load | No wildcard DNS or site link |
| Emails not sent | No queue worker, or `MAIL_MAILER=log` |
| Stale translations, routes or types | Generated files not regenerated |
| 403 after registering | Self-registered users have no role |

## `Unable to locate file in Vite manifest`

The frontend has not been built, or the dev server is not running. Run `npm run dev` (or `composer dev`) during development, or `npm run build` for a production-like build.

## The app shows 404 on `127.0.0.1:8000` or `localhost`

Only `APP_DOMAIN` is a central domain; any other host is treated as a tenant and unknown tenants return 404. Open the app at `APP_URL` (e.g. `http://vue.test`), not the address printed by `php artisan serve`.

## Tenant subdomain does not load

- The tenant domain must resolve to the app. With Herd, link the site with the name matching `APP_DOMAIN` (`herd link vue` for `vue.test`); all `*.vue.test` subdomains then work.
- Without Herd you need wildcard DNS (e.g. dnsmasq) and a web server that serves `*.APP_DOMAIN` from `public/`. A plain `/etc/hosts` file cannot do wildcards.
- In production add a `*.your-domain.com` DNS record and a wildcard TLS certificate.
- Check the domain exists: `php artisan tenants:list`.

## Invitation or password reset emails are not sent

These notifications are queued (`QUEUE_CONNECTION=database`).

1. Run a worker: `composer dev` (includes `queue:listen`) or `php artisan queue:work`.
2. Keep `DB_QUEUE_CONNECTION` unset (it falls back to `DB_CONNECTION`) so jobs from tenants land in the central `jobs` table where the worker looks.
3. With `MAIL_MAILER=log` emails are written to `storage/logs/laravel.log`, not delivered. Configure SMTP to send them.
4. Check `php artisan queue:failed`.

## Translations do not update in the UI

The frontend reads the generated JSON in `resources/js/lang`, not `lang/` directly. Run `php artisan erag:generate-lang` after changing `lang/`.

Also check you import the helper from the framework subpath (`@erag/lang-sync-inertia/vue`, `/react`, `/svelte`).

## Route functions or types are outdated / TypeScript errors after backend changes

Regenerate the generated files:

| Command | Regenerates |
| --- | --- |
| `php artisan wayfinder:generate --with-form` | `@/routes`, `@/actions` |
| `php artisan typescript:transform` | `resources/js/types` |

Restart `npm run dev` if the editor still shows stale types.

## Creating a tenant fails with a database error

- **Access denied / cannot create database**: the DB user needs `CREATE DATABASE` (and `DROP DATABASE` to delete tenants).
- **Database exists**: another app on the same MySQL server already created `tenant1`, or a previous `migrate:fresh` left tenant databases behind. Drop the old databases, or use a unique tenant DB prefix: `TENANCY_DB_PREFIX` in the React kit, `'prefix'` in `config/tenancy.php` in Vue and Svelte. See [Database](/docs/core/database#tenant-database-naming).

## New tenant migration did not run

Tenant migrations belong in `database/migrations/tenant` and run with `php artisan tenants:migrate`, not `php artisan migrate`.

## 403 right after registering

Self-registered users get no role and no permissions, and `/dashboard` requires `View Analytics Dashboard` (central) or `View Tenant Dashboard` (tenant). Assign a role or permissions from **Users**, or assign a default role in `Modules\Auth\Actions\CreateNewUser`. See [Authentication](/docs/core/authentication#registration-and-permissions).

## A menu item is missing

Menus are filtered by their `permission` column. Check the user has that permission, or that the item exists in the current context's `menus` table (central and tenant menus are separate). **Setup → Menus → Reset** restores the seeded defaults.

## Changes to `config/permissions` have no effect

Permissions must exist in the database. Run `php artisan db:seed --class=PermissionSeeder` (central) and `php artisan tenants:seed --class="Database\Seeders\PermissionSeeder"` (tenants), then assign them. spatie caches permissions for 24 hours; the seeders clear the cache, otherwise run `php artisan permission:cache-reset`.

## Passkeys do not work locally

WebAuthn needs a secure origin (HTTPS). Secure the site (for example `herd secure vue`) and use an `https://` `APP_URL`. The React and Svelte `.env.example` files already use `https://`; the Vue one uses `http://vue.test`.

## A tenant shows the maintenance or suspended page

- Maintenance: **Setup → Tenant Settings** on the central domain, or use the bypass link / IP allow list.
- Suspended: set the tenant's Workspace status back to Active.

See [Maintenance & suspension](/docs/core/maintenance-and-suspension).

## Still stuck

Open an issue on your kit's GitHub repository with the error, the steps to reproduce and your PHP/Node versions.
