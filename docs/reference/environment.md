---
title: "Environment Variables (.env) Reference"
description: "Every relevant .env key with its default from .env.example, what it controls in the kits, the differences between kits and a production checklist."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/reference/environment.html
  - - meta
    - property: og:title
      content: "Environment Variables (.env) Reference"
  - - meta
    - property: og:description
      content: "Every relevant .env key with its default from .env.example, what it controls in the kits, the differences between kits and a production checklist."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/reference/environment.html
  - - meta
    - name: twitter:title
      content: "Environment Variables (.env) Reference"
  - - meta
    - name: twitter:description
      content: "Every relevant .env key with its default from .env.example, what it controls in the kits, the differences between kits and a production checklist."
---

# Environment

Defaults below are from the Vue kit's `.env.example`. The other kits differ only in these keys:

| Key | Vue | React | Svelte |
| --- | --- | --- | --- |
| `APP_URL` | `http://vue.test` | `https://react.test` | `https://svelte.test` |
| `APP_DOMAIN` | `vue.test` | `react.test` | `svelte.test` |
| `DB_DATABASE` | `saas_laravel_vue` | `saas_laravel_recat` | `saas_laravel_svelte` |
| `DB_PASSWORD` | set to a sample value | empty | empty |

::: tip
Change `APP_URL`, `APP_DOMAIN` and the `DB_*` keys first. Most other defaults work as is for local development.
:::

## Application

| Key | Default | Notes |
| --- | --- | --- |
| `APP_NAME` | `Laravel` | Central app name. Tenant domains override it with the domain's App name or company. |
| `APP_ENV` | `local` | In `production`: strict password rules, destructive DB commands prohibited, full error pages |
| `APP_KEY` | empty | `php artisan key:generate`. Also signs maintenance bypass cookies and is the default passkey user handle secret. |
| `APP_DEBUG` | `true` | `false` in production |
| `APP_URL` | `http://vue.test` | Central URL. Scheme is reused for tenant links; host is the passkey relying party. |
| `APP_DOMAIN` | `vue.test` | Central domain; tenant domains are `<sub>.APP_DOMAIN` |
| `APP_LOCALE` | `en` | Default language when neither the user nor the domain sets one |
| `APP_FALLBACK_LOCALE` | `en` | |
| `APP_FAKER_LOCALE` | `en_US` | |
| `APP_MAINTENANCE_DRIVER` | `file` | Laravel's own `php artisan down` (not tenant maintenance) |
| `BCRYPT_ROUNDS` | `12` | |

## Tenancy

| Key | Default | Notes |
| --- | --- | --- |
| `TENANCY_DB_PREFIX` | `tenant` | **React kit only** (`config/tenancy.php`). Vue and Svelte hardcode `'prefix' => 'tenant'`; edit the config or switch it to `env()`. Use a unique prefix when several apps share one MySQL server. |

## Database

| Key | Default | Notes |
| --- | --- | --- |
| `DB_CONNECTION` | `mysql` | Also the central tenancy connection |
| `DB_HOST` | `127.0.0.1` | |
| `DB_PORT` | `3306` | |
| `DB_DATABASE` | `saas_laravel_vue` | Central database; create it before migrating |
| `DB_USERNAME` | `root` | Needs `CREATE DATABASE` rights for tenants |
| `DB_PASSWORD` | sample value (Vue), empty (React, Svelte) | Replace with your own |

## Session, cache, queue

| Key | Default | Notes |
| --- | --- | --- |
| `SESSION_DRIVER` | `database` | Stored in the current context's DB (tenant sessions in tenant DBs) |
| `SESSION_LIFETIME` | `120` | Minutes |
| `SESSION_ENCRYPT` | `false` | |
| `SESSION_PATH` | `/` | |
| `SESSION_DOMAIN` | `null` | Sessions are per host, so central and tenant logins are separate |
| `CACHE_STORE` | `database` | |
| `QUEUE_CONNECTION` | `database` | Invitation and reset emails are queued |
| `DB_QUEUE_CONNECTION` | not set (falls back to `DB_CONNECTION`) | Keep jobs in the central `jobs` table so one worker serves all tenants |
| `BROADCAST_CONNECTION` | `log` | |
| `FILESYSTEM_DISK` | `local` | `local` and `public` are suffixed per tenant |

## Mail

| Key | Default | Notes |
| --- | --- | --- |
| `MAIL_MAILER` | `log` | Emails go to `storage/logs/laravel.log`. Use `smtp` (or another transport) to deliver. |
| `MAIL_SCHEME` | `null` | |
| `MAIL_HOST` | `127.0.0.1` | |
| `MAIL_PORT` | `2525` | |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | `null` | |
| `MAIL_FROM_ADDRESS` | `hello@example.com` | |
| `MAIL_FROM_NAME` | `${APP_NAME}` | |

## Other keys in `.env.example`

| Key | Default |
| --- | --- |
| `LOG_CHANNEL` / `LOG_STACK` / `LOG_LEVEL` | `stack` / `single` / `debug` |
| `REDIS_CLIENT` / `REDIS_HOST` / `REDIS_PORT` | `phpredis` / `127.0.0.1` / `6379` |
| `MEMCACHED_HOST` | `127.0.0.1` |
| `AWS_*` | empty (`AWS_DEFAULT_REGION=us-east-1`) |
| `VITE_APP_NAME` | `${APP_NAME}` (page title suffix on the frontend) |

## Optional keys read by config

| Key | Default | File |
| --- | --- | --- |
| `PASSKEYS_USER_HANDLE_SECRET` | `APP_KEY` | `config/fortify.php` |
| `AUTH_PASSWORD_TIMEOUT` | `10800` | `config/auth.php` |
| `DB_QUEUE_TABLE` / `DB_QUEUE` / `DB_QUEUE_RETRY_AFTER` | `jobs` / `default` / `90` | `config/queue.php` |

## Production checklist

| Key | Production value |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | `https://your-domain.com` |
| `APP_DOMAIN` | `your-domain.com` |
| `MAIL_MAILER` | `smtp` (or another real transport) |

::: warning Also before going live
- Run a queue worker (`php artisan queue:work`); invitation and reset emails are queued.
- Point `*.your-domain.com` at the app (wildcard DNS and TLS certificate).
- Remove or change the seeded default users.
:::
