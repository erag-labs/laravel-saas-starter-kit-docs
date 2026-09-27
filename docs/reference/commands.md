---
title: "Composer, npm & Artisan Commands"
description: "Composer scripts, npm scripts and Artisan commands available in every SaaS Laravel kit, including setup, the dev server, tests, linting and generators."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/reference/commands.html
  - - meta
    - property: og:title
      content: "Composer, npm & Artisan Commands"
  - - meta
    - property: og:description
      content: "Composer scripts, npm scripts and Artisan commands available in every SaaS Laravel kit, including setup, the dev server, tests, linting and generators."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/reference/commands.html
  - - meta
    - name: twitter:title
      content: "Composer, npm & Artisan Commands"
  - - meta
    - name: twitter:description
      content: "Composer scripts, npm scripts and Artisan commands available in every SaaS Laravel kit, including setup, the dev server, tests, linting and generators."
---

# Commands

All kits share the same Composer scripts and Artisan commands. Where a kit differs, the table says so.

::: tip Most used
`composer dev` to run everything locally, `composer lint` before committing, `php artisan tenants:migrate` after adding a tenant migration.
:::

## Composer scripts

| Command | What it runs |
| --- | --- |
| `composer setup` | `composer install`, copy `.env.example` → `.env` (if missing), `php artisan key:generate`, `php artisan migrate --force`, `npm install`, `npm run build` |
| `composer dev` | `php artisan dev`: `serve`, `queue:listen --tries=1 --timeout=0`, `pail --timeout=0` (when `pcntl` is available), `npm run dev` |
| `composer test` | `config:clear`, `lint:check`, `types:check`, `php artisan test` |
| `composer ci:check` | `composer test` without a process timeout |
| `composer lint` | `pint --parallel`, `typescript:transform`, `npm run lint:fix`. Vue also runs `wayfinder:generate --with-form` first. |
| `composer lint:check` | `pint --parallel --test`, `npm run lint`. Vue also runs `wayfinder:generate --with-form` first. |
| `composer types:check` | `phpstan analyse` |

After `composer update`, the `post-update-cmd` hook publishes Laravel assets and runs `php artisan boost:update`.

## npm scripts

| Command | Vue | React | Svelte |
| --- | --- | --- | --- |
| `npm run dev` | `vite` | `vite` | `vite` |
| `npm run build` | `vite build` | `vite build` | `vite build` |
| `npm run build:ssr` | `vite build && vite build --ssr` | same | same |
| `npm run lint` | ESLint + Prettier check + `vue-tsc --noEmit` | ESLint + Prettier check + `tsc --noEmit` | ESLint + Prettier check + `svelte-check --tsconfig ./tsconfig.json` |
| `npm run lint:fix` | ESLint `--fix` + Prettier `--write` + `vue-tsc --noEmit` | ESLint `--fix` + Prettier `--write` + `tsc --noEmit` | ESLint `--fix` + Prettier `--write` + `svelte-check --tsconfig ./tsconfig.json` |

ESLint runs on `.` and Prettier on `resources/` in every kit.

## Artisan

### Database

| Command | Purpose |
| --- | --- |
| `php artisan migrate` | Central migrations |
| `php artisan migrate --seed` | Central migrations + `DatabaseSeeder` |
| `php artisan migrate:fresh --seed` | Rebuild the central database (tenant DBs are not dropped) |
| `php artisan db:seed --class=PermissionSeeder` | Sync central permissions from `config/permissions` |
| `php artisan db:seed --class=MenuSeeder` | Restore/add central menus |

### Tenancy (stancl/tenancy)

| Command | Purpose |
| --- | --- |
| `php artisan tenants:list` | List tenants and domains |
| `php artisan tenants:migrate` | Run `database/migrations/tenant` for all tenants |
| `php artisan tenants:migrate --tenants=1` | Only for tenant `1` |
| `php artisan tenants:rollback` | Roll back tenant migrations |
| `php artisan tenants:migrate-fresh` | Drop and re-migrate tenant databases |
| `php artisan tenants:seed` | Run `TenantDatabaseSeeder` for all tenants |
| `php artisan tenants:seed --class="Database\Seeders\PermissionSeeder"` | Run one seeder for all tenants |
| `php artisan tenants:run <command>` | Run any Artisan command per tenant |

### Code generation

| Command | Output |
| --- | --- |
| `php artisan wayfinder:generate --with-form` | `resources/js/routes`, `resources/js/actions`, `resources/js/wayfinder` |
| `php artisan typescript:transform` | `resources/js/types/...` from Data classes and enums |
| `php artisan erag:generate-lang` | `resources/js/lang/<locale>/*.json` from `lang/<locale>/*.php` |

### Development and operations

| Command | Purpose |
| --- | --- |
| `php artisan dev` | Start the dev processes (same as `composer dev`) |
| `php artisan queue:listen --tries=1` | Development queue worker (reloads code) |
| `php artisan queue:work` | Production queue worker |
| `php artisan queue:failed` / `queue:retry all` | Inspect and retry failed jobs |
| `php artisan pail` | Tail logs |
| `php artisan route:list --except-vendor` | List application routes |
| `php artisan test --compact` | Run Pest |
| `php artisan make:test --pest Name` | New feature test |
| `php artisan boost:update` | Refresh Laravel Boost AI guidelines and skills |
| `vendor/bin/pint --dirty` | Format changed PHP files |

## Herd

Use the site name that matches `APP_DOMAIN` (`vue`, `react` or `svelte` by default).

| Command | Purpose |
| --- | --- |
| `herd link vue` | Serve the current folder as `vue.test` (and `*.vue.test`) |
| `herd secure vue` | Enable HTTPS for the site |
