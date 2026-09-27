---
title: "Run a Laravel SaaS Kit Locally"
description: "First run of a SaaS Laravel kit step by step: environment, database, seeding, composer dev, the queue worker, creating tenants, generated files and tests."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/getting-started/local-development.html
  - - meta
    - property: og:title
      content: "Run a Laravel SaaS Kit Locally"
  - - meta
    - property: og:description
      content: "First run of a SaaS Laravel kit step by step: environment, database, seeding, composer dev, the queue worker, creating tenants, generated files and tests."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/getting-started/local-development.html
  - - meta
    - name: twitter:title
      content: "Run a Laravel SaaS Kit Locally"
  - - meta
    - name: twitter:description
      content: "First run of a SaaS Laravel kit step by step: environment, database, seeding, composer dev, the queue worker, creating tenants, generated files and tests."
---

# Local development

This is the complete first-run guide. It uses the Vue kit's values (`vue.test`); the React and Svelte kits use `react.test` and `svelte.test` in their `.env.example`.

```text
Clone → .env → central database → migrate + seed → npm install → herd link → composer dev → first tenant
```

## Prerequisites

- PHP `^8.3` (the kits run on PHP 8.4 with Herd)
- Composer 2
- A current Node LTS and npm
- MySQL, with a user that can create databases
- [Laravel Herd](https://herd.laravel.com) (recommended: `*.test` domains and wildcard tenant subdomains work automatically)

Details: [Requirements](/docs/getting-started/requirements).

## 1. Clone and install PHP dependencies

```bash
git clone https://github.com/erag-technologies/saas-laravel-starter-kit-vue.git my-saas
cd my-saas
composer install
```

## 2. Create `.env`

```bash
cp .env.example .env
php artisan key:generate
```

Set these keys:

```dotenv
APP_NAME="My SaaS"
APP_URL=http://vue.test
APP_DOMAIN=vue.test

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=saas_laravel_vue
DB_USERNAME=root
DB_PASSWORD=

MAIL_MAILER=log
```

| Key | Why it matters |
| --- | --- |
| `APP_URL` | Base URL of the central app. Also used for passkeys and to pick `http`/`https` for tenant links. |
| `APP_DOMAIN` | The **central domain**. Every other host is treated as a tenant domain; tenant domains are `<subdomain>.APP_DOMAIN`. |
| `DB_*` | The central database. Tenant databases are created on the same server. |
| `MAIL_*` | `log` writes emails to `storage/logs/laravel.log`. Configure SMTP to actually deliver invitations and password resets. |

::: warning Several kits on one MySQL server
Tenant databases are named `<prefix><tenant id>` (for example `tenant1`), so two kits on one server would both create `tenant1`. Give each kit a different prefix **before** creating tenants:

- **React kit**: set `TENANCY_DB_PREFIX=react_tenant` in `.env`.
- **Vue and Svelte kits**: change the literal `'prefix' => 'tenant'` in `config/tenancy.php`, or replace it with `env('TENANCY_DB_PREFIX', 'tenant')`.

See [Database → Tenant database naming](/docs/core/database#tenant-database-naming).
:::

All keys: [Environment reference](/docs/reference/environment).

## 3. Create the central database

```bash
mysql -u root -e "CREATE DATABASE saas_laravel_vue"
```

Or create it in TablePlus, DBngin, Herd Pro, etc.

## 4. Migrate and seed

```bash
php artisan migrate --seed
```

This runs the central migrations in `database/migrations` and `Database\Seeders\DatabaseSeeder`.

### Seeded data

| Seeder | What it creates |
| --- | --- |
| `RoleSeeder` | Roles `super-admin`, `admin`, `manager`, `employee`, `user` (guard `web`) |
| `PermissionSeeder` | Every permission listed in `config/permissions/*.php` |
| `MenuSeeder` | The central sidebar menus (Dashboard, Tenants, Users, Roles, Setup) |
| `DefaultUserSeeder` | One verified user per role, with that role's default permissions |

Default users (password `password` for all):

| Email | Role |
| --- | --- |
| `super-admin@gmail.com` | Super Admin |
| `admin@gmail.com` | Admin |
| `manager@gmail.com` | Manager |
| `employee@gmail.com` | Employee |
| `user@gmail.com` | User |

::: danger Change these before going live
`DefaultUserSeeder` uses the constant `DEFAULT_PASSWORD = 'password'`. It also runs inside every new tenant database (via `TenantDatabaseSeeder`). Remove or change it before production.
:::

To start over, run `php artisan migrate:fresh --seed`.

::: warning `migrate:fresh` keeps tenant databases
It drops the central tables only. Tenant databases (`tenant1`, `tenant2`, ...) stay on the server. Delete tenants from the UI first (that drops their databases), or drop the databases manually.
:::

## 5. Install frontend dependencies

```bash
npm install
```

## 6. Serve the app

With Herd, link the folder to your `APP_DOMAIN`:

```bash
herd link vue          # vue.test and *.vue.test
herd secure vue        # optional: HTTPS, then set APP_URL=https://vue.test
```

::: tip Passkeys need HTTPS
Browsers only allow WebAuthn on secure origins. Use `herd secure` if you want to test passkeys.
:::

## 7. Start the dev processes

```bash
composer dev
```

`composer dev` runs `php artisan dev`, which starts these processes in one terminal:

| Process | Command |
| --- | --- |
| server | `php artisan serve` |
| queue | `php artisan queue:listen --tries=1 --timeout=0` |
| logs | `php artisan pail --timeout=0` (only when the `pcntl` extension is available) |
| vite | `npm run dev` |

::: warning Open APP_URL, not 127.0.0.1
Open **`APP_URL`** (e.g. `http://vue.test`) in the browser, not `127.0.0.1:8000`. `127.0.0.1` is not your central domain, so tenancy treats it as an unknown tenant and returns 404.
:::

Prefer separate terminals? With Herd serving the app, run only `npm run dev` and `php artisan queue:listen --tries=1`.

## Queue worker

`QUEUE_CONNECTION=database`. These emails are queued and are **not sent** unless a worker runs:

- Tenant admin invitation (`TenantInvitationNotification`)
- Tenant admin password reset (`TenantPasswordResetNotification`)
- User invitation (`UserInvitationNotification`)

`composer dev` already runs `queue:listen`. Jobs dispatched inside a tenant are stored in the **central** `jobs` table, so one worker handles all tenants; stancl's `QueueTenancyBootstrapper` restores the tenant context when the job runs. See [Configuration → `config/queue.php`](/docs/getting-started/configuration#config-queue-php).

::: warning Keep the queue on the central connection
Do not point `DB_QUEUE_CONNECTION` at the `tenant` connection. Jobs would be written to individual tenant databases where no worker reads them.
:::

## Create your first tenant

1. Sign in as `super-admin@gmail.com` on `http://vue.test`.
2. Go to **Tenants → Add Tenant**.
3. Enter the company, admin details and a subdomain, e.g. `acme`.
4. Either set a password for the tenant admin, or leave **send invitation** on to email a signed link.

On save, the kit creates the `tenant<id>` database, runs the tenant migrations and seeder, and creates the tenant admin with the `super-admin` role. This happens synchronously; see [Multi-tenancy → Creating a tenant](/docs/core/multi-tenancy#creating-a-tenant) for the full pipeline.

Open `http://acme.vue.test` and sign in as the tenant admin. With invitations on, open the link from the email first (with `MAIL_MAILER=log` it is in `storage/logs/laravel.log`).

### Tenant migrations

After adding or pulling new files in `database/migrations/tenant`:

```bash
php artisan tenants:migrate
php artisan tenants:seed      # optional, runs TenantDatabaseSeeder for every tenant
```

## Generated files

Several frontend files are generated from PHP. Regenerate them after changing the source:

| Command | Source → output | When |
| --- | --- | --- |
| `php artisan wayfinder:generate --with-form` | Routes and controllers → `resources/js/routes`, `resources/js/actions`, `resources/js/wayfinder` | After adding/renaming routes or controller methods. The Vite plugin also regenerates during `npm run dev` / `npm run build`. |
| `php artisan typescript:transform` | Data objects marked `#[TypeScript]` and enums in `app/` and `Modules/` → `resources/js/types` | After changing a Data class or enum |
| `php artisan erag:generate-lang` | `lang/<locale>/**/*.php` → `resources/js/lang/<locale>/**/*.json` | After editing translation files |

| Output | In git? |
| --- | --- |
| Wayfinder (`routes`, `actions`, `wayfinder`) | No (git-ignored) |
| `resources/js/types`, `resources/js/lang` | Yes, commit them |

`composer lint` runs Pint, `typescript:transform` and `npm run lint:fix` (the Vue kit also runs `wayfinder:generate --with-form`).

## Tests and checks

```bash
php artisan test --compact     # Pest only
composer test                  # config:clear, lint check, PHPStan, Pest
```

Tests run on in-memory SQLite (`phpunit.xml`), so they do not touch your MySQL data. `npm run lint` runs ESLint, Prettier (check) and your framework's type checker:

| Kit | Type check on its own |
| --- | --- |
| Vue | `npx vue-tsc --noEmit` |
| React | `npx tsc --noEmit` |
| Svelte | `npx svelte-check --tsconfig ./tsconfig.json` |

See [Testing](/docs/core/testing).

## Production build

```bash
npm run build
```

Assets go to `public/build`. A `build:ssr` script exists (`vite build && vite build --ssr`), but SSR is not enabled by default.

If you see `Unable to locate file in Vite manifest`, run `npm run build` or keep `npm run dev` running. More fixes: [Troubleshooting](/docs/reference/troubleshooting).
