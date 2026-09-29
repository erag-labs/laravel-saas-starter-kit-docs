---
title: "Deploying a Laravel SaaS to Production"
description: "Deploy a Laravel SaaS step by step: server needs, wildcard DNS and TLS, a deploy script with tenant migrations, queue workers with Supervisor and the scheduler."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Multi-tenancy, Deployment]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/deploy-laravel-saas.html
  - - meta
    - property: og:title
      content: "Deploying a Laravel SaaS to Production"
  - - meta
    - property: og:description
      content: "Deploy a Laravel SaaS step by step: server needs, wildcard DNS and TLS, a deploy script with tenant migrations, queue workers with Supervisor and the scheduler."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/deploy-laravel-saas.html
  - - meta
    - name: twitter:title
      content: "Deploying a Laravel SaaS to Production"
  - - meta
    - name: twitter:description
      content: "Deploy a Laravel SaaS step by step: server needs, wildcard DNS and TLS, a deploy script with tenant migrations, queue workers with Supervisor and the scheduler."
---

# How to Deploy a Laravel SaaS: Server, Tenant Migrations, Queues and TLS

<BlogPostMeta />

To **deploy a Laravel SaaS** you need everything a normal Laravel app needs, plus a few things that only show up with multi-tenancy: wildcard subdomains, a database user that can create databases, and migrations that run once per tenant. This guide walks through the server setup, a deploy script you can adapt, tenant migrations, queue workers, the scheduler, and how to avoid downtime. It assumes a database-per-tenant app with tenants on subdomains.

## What the production server needs

| Need | Why |
| --- | --- |
| PHP, Composer and Node.js | Install dependencies and build assets |
| nginx (or another web server) with PHP-FPM | Serves the central domain and every tenant subdomain |
| MySQL or PostgreSQL with a user that can create and drop databases | Creating a tenant creates its database |
| A process manager such as Supervisor | Keeps queue workers running |
| cron | Runs the Laravel scheduler every minute |
| A real mail transport | Invitations and password resets must arrive |
| Wildcard DNS and a wildcard TLS certificate | Every new tenant gets a subdomain without manual setup |

The database permission catches many people out. On managed databases the default user often can't `CREATE DATABASE`. Test it before your first customer signs up, not after.

## Wildcard DNS and TLS for tenant subdomains

Point both `your-saas.com` and `*.your-saas.com` at the server, then serve both from one nginx server block:

```nginx
server {
    listen 443 ssl;
    server_name your-saas.com *.your-saas.com;
    root /var/www/your-saas/public;
    ssl_certificate     /etc/letsencrypt/live/your-saas.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-saas.com/privkey.pem;
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

Let's Encrypt only issues wildcard certificates through the DNS-01 challenge, so use a certbot DNS plugin for your provider. Renewals then run on their own:

```bash
certbot certonly --dns-cloudflare --dns-cloudflare-credentials ~/.secrets/cloudflare.ini \
  -d your-saas.com -d "*.your-saas.com"
```

How tenant identification, central domains and cookies fit together is covered in [Laravel multi-tenancy with subdomains](/blog/laravel-multi-tenancy-subdomains.html).

## Production environment settings

| Key | Production value | Why |
| --- | --- | --- |
| `APP_ENV` | `production` | Enables production-only behaviour and confirmation prompts |
| `APP_DEBUG` | `false` | Never show stack traces to customers |
| `APP_URL` | `https://your-saas.com` | Used for links, emails and asset URLs |
| `APP_KEY` | Generated once, then kept | Encrypted data, such as 2FA secrets, depends on it |
| `SESSION_SECURE_COOKIE` | `true` | Cookies are only sent over HTTPS |
| `MAIL_MAILER` | `smtp` or an API transport | So queued emails are delivered |

Keep the `.env` file outside version control and back it up separately. Losing `APP_KEY` means losing everything encrypted with it.

## A script to deploy a Laravel SaaS, step by step

The order matters. Build assets before caching routes, and migrate the central database before the tenants:

```bash
set -e
cd /var/www/your-saas
git pull origin main
composer install --no-dev --optimize-autoloader --no-interaction
php artisan optimize:clear
npm ci && npm run build
php artisan migrate --force
php artisan tenants:migrate
php artisan optimize
php artisan reload
```

- `set -e` stops the script at the first failure, so a failed migration never reaches `optimize`.
- `optimize:clear` removes stale config and route caches. Build tools that read your routes, such as the Wayfinder Vite plugin, then see the current ones.
- `php artisan optimize` caches config, events, routes and views.
- `php artisan reload` runs `queue:restart` and `schedule:interrupt`, so workers pick up the new code.

## Where tenant migrations fit in the deploy

`php artisan tenants:migrate` from stancl/tenancy runs your tenant migrations against every tenant database, one after the other, and stancl's default config already passes `--force`. In a deploy, two things matter:

- **It gets slower with every customer.** Ten tenants take seconds; a thousand can take minutes, and during that window some tenants already have the new schema. Write backwards-compatible migrations so both versions of your code work.
- **It runs before `reload`.** With `set -e`, a failing tenant stops the script, and workers keep running the old code until you fix the problem and run the deploy again.

For risky changes, migrate a couple of tenants first as a canary with `php artisan tenants:migrate --tenants=1 --tenants=2`. Safe migration patterns and recovering from a half-finished run are covered in [tenant migrations and seeders in Laravel](/blog/laravel-tenant-migrations-seeders.html).

## Queue workers with Supervisor

Queue workers are long-running processes, so a process manager restarts them when they crash or when the server reboots. A Supervisor config:

```ini
[program:your-saas-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/your-saas/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/your-saas/storage/logs/worker.log
stopwaitsecs=3600
```

If queued jobs are stored on the central connection, one pool of workers handles every tenant, and stancl's queue bootstrapper restores the right tenant when each job runs. Workers keep old code in memory, which is why the deploy script ends with `reload`.

## The scheduler

Add one cron entry for the whole app:

```bash
* * * * * cd /var/www/your-saas && php artisan schedule:run >> /dev/null 2>&1
```

Scheduled tasks run in the central context. To run a command for each tenant, wrap it in `tenants:run`:

```php
Schedule::command('tenants:run reports:send')
    ->dailyAt('02:00')
    ->withoutOverlapping()
    ->onOneServer();
```

`onOneServer()` needs a cache store that supports locks (database, Redis, Memcached or DynamoDB) shared by all servers. Without it, two servers would both send the reports.

## Avoiding downtime

The script above updates files in place, so for a few seconds requests can hit a half-updated app. Zero-downtime deploys fix this by building each release in its own directory and switching a `current` symlink once everything is ready. Tools such as Deployer, Envoyer or your hosting platform automate the pattern.

Two things must be shared between releases: the `.env` file and the whole `storage` directory. With stancl's filesystem bootstrapper, each tenant's files live in their own folder under `storage`, so a fresh `storage` per release would appear to lose every upload.

For product, legal and support readiness before launch day, use the [Laravel SaaS launch checklist](/blog/laravel-saas-launch-checklist.html). If you haven't picked a foundation yet, the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html) covers what to look for.

## Frequently asked questions

### Can I deploy a multi-tenant Laravel app to shared hosting?

Rarely. You need wildcard subdomains, a database user that can create databases and long-running queue workers. Most shared hosts don't allow all three, so a VPS or a managed platform is the practical choice.

### Should tenant migrations run in the deploy script?

For most apps, yes: running them in the script means a failure stops the deploy before workers restart. With thousands of tenants, some teams move them to queued jobs, but then they must track which tenants are finished.

### How do I roll back a bad deploy?

Switch the `current` symlink back to the previous release and run `php artisan reload`. Rolling back migrations across every tenant is slow and risky, which is one more reason to keep migrations backwards compatible, so old code still runs on the new schema.

### Why does a new tenant subdomain show a certificate error?

Your certificate probably only covers the main domain. Issue a wildcard certificate for `*.your-saas.com` through the DNS-01 challenge. A wildcard covers one level of subdomains only.

## Deploying SaaS Laravel

The SaaS Laravel kits document their production needs in the [requirements](/docs/getting-started/requirements.html): PHP 8.3 or newer, a web server that routes the central domain and `*.your-domain.com`, wildcard DNS, a database user that can create tenant databases, `php artisan queue:work`, and a real mailer. The central domain is set with `APP_DOMAIN`. Tenant migrations live in `database/migrations/tenant` and run with `php artisan tenants:migrate`. Queued jobs are stored in the central `jobs` table, so one worker serves every tenant. `npm run build` runs `wayfinder:generate` through the Vite plugin, so PHP and Composer dependencies must be installed where you build. The kits don't define any scheduled tasks yet, and the seeded default users must be removed or changed before going live.

<BlogPostCta title="Start from a deployable SaaS" text="SaaS Laravel ships database-per-tenant multi-tenancy, a central queue for all tenants and documented production requirements, in Vue, React or Svelte." />
