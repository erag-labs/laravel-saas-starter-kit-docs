---
title: "Requirements for Laravel SaaS Starter Kits"
description: "What you need to run a SaaS Laravel starter kit: PHP 8.3+, Composer 2, Node.js LTS, MySQL for per-tenant databases and a local server with wildcard subdomains."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/getting-started/requirements.html
  - - meta
    - property: og:title
      content: "Requirements for Laravel SaaS Starter Kits"
  - - meta
    - property: og:description
      content: "What you need to run a SaaS Laravel starter kit: PHP 8.3+, Composer 2, Node.js LTS, MySQL for per-tenant databases and a local server with wildcard subdomains."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/getting-started/requirements.html
  - - meta
    - name: twitter:title
      content: "Requirements for Laravel SaaS Starter Kits"
  - - meta
    - name: twitter:description
      content: "What you need to run a SaaS Laravel starter kit: PHP 8.3+, Composer 2, Node.js LTS, MySQL for per-tenant databases and a local server with wildcard subdomains."
---

# Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| PHP | `^8.3` | The kits are developed and tested on PHP 8.4. Extensions required by Laravel 13, plus `pdo_mysql`. |
| Composer | 2.x | Installs the Laravel backend. |
| Node.js + npm | A current Node LTS | `@erag/lang-sync-inertia` declares `node >= 24`. Each kit ships a `package-lock.json`, so use **npm**. |
| MySQL (or MariaDB) | Any supported version | Multi-database tenancy creates one database per tenant, so the DB user must be allowed to `CREATE DATABASE` / `DROP DATABASE`. |
| Local web server with wildcard subdomains | — | [Laravel Herd](https://herd.laravel.com) is recommended. |
| Git | — | To clone your kit repository and pull updates. |

## Why Herd

Tenants are identified by domain, so every tenant subdomain must reach your app:

```text
APP_DOMAIN=vue.test
vue.test        → central app
acme.vue.test   → tenant created with the subdomain "acme"
```

Herd serves `*.test` sites and their subdomains out of the box, so every new tenant works without extra DNS or hosts-file entries.

::: tip Other setups
Any local stack works as long as the central domain **and all of its subdomains** point to the project's `public/` directory without a port in the URL (tenant links are built as `scheme://<domain>/path`). Laravel Sail is installed as a dev dependency, but the kits are configured and tested with Herd.
:::

## Database

`.env.example` uses `DB_CONNECTION=mysql`. `config/tenancy.php` also registers database managers for `sqlite`, `mariadb` and `pgsql`, but MySQL is the setup the kits are built and tested against.

::: warning Database permissions
Creating a tenant runs `CREATE DATABASE` on the central connection. If your DB user cannot create databases, tenant creation fails.
:::

## Production

| Need | Why |
| --- | --- |
| PHP `^8.3` | Same as local |
| Web server routing the central domain and a wildcard subdomain (`*.your-domain.com`) to the app, plus a wildcard DNS record | Every tenant is a subdomain |
| A database user with rights to create tenant databases | Tenant creation runs `CREATE DATABASE` |
| A queue worker (`php artisan queue:work`) | Invitation and password-reset emails are queued |
| A real mailer (`MAIL_MAILER=smtp` or similar) | So those emails are delivered |

Next: [Installation](/docs/getting-started/installation).
