---
title: "Deploying a Laravel SaaS to Production"
description: "Deploy a Laravel SaaS step by step: server needs, wildcard DNS and TLS, a deploy script with tenant migrations, queue workers with Supervisor and the scheduler."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: saas
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

When you deploy a Laravel SaaS, you need everything a normal Laravel app needs. Multi-tenancy then adds a few things of its own: wildcard subdomains, a database user that's allowed to create databases, and migrations that run once for every tenant. Below I go through the server, a deploy script you can adapt, tenant migrations, queue workers, the scheduler and how I'd avoid downtime. I'm assuming a database-per-tenant app with tenants on subdomains.

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

The database permission is the one that catches people out. On managed databases, the default user often can't run `CREATE DATABASE`. **Test it before your first customer signs up**, not after.

## Wildcard DNS and TLS for tenant subdomains

Point both `your-saas.com` and `*.your-saas.com` at the server. One nginx server block can then serve both:

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

Let's Encrypt only issues wildcard certificates through the DNS-01 challenge, so you'll need the certbot DNS plugin for your provider. Once that's in place, renewals run on their own:

```bash
certbot certonly --dns-cloudflare --dns-cloudflare-credentials ~/.secrets/cloudflare.ini \
  -d your-saas.com -d "*.your-saas.com"
```

Tenant identification, central domains and cookies are a topic of their own. I cover how they fit together in [Laravel multi-tenancy with subdomains](/blog/laravel-multi-tenancy-subdomains.html).

## Production environment settings

| Key | Production value | Why |
| --- | --- | --- |
| `APP_ENV` | `production` | Enables production-only behaviour and confirmation prompts |
| `APP_DEBUG` | `false` | Never show stack traces to customers |
| `APP_URL` | `https://your-saas.com` | Used for links, emails and asset URLs |
| `APP_KEY` | Generated once, then kept | Encrypted data, such as 2FA secrets, depends on it |
| `SESSION_SECURE_COOKIE` | `true` | Cookies are only sent over HTTPS |
| `MAIL_MAILER` | `smtp` or an API transport | So queued emails are delivered |

Keep `.env` out of version control and back it up separately. If you lose `APP_KEY`, you lose everything that was encrypted with it.

## A script to deploy a Laravel SaaS, step by step

Order matters here. Build assets before you cache routes, and migrate the central database before the tenants:

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

A few of those lines deserve a note. `set -e` stops the script at the first failure, so a failed migration never reaches `optimize`. `optimize:clear` throws away stale config and route caches, which means build tools that read your routes (the Wayfinder Vite plugin, for example) see the current ones.

Near the end, `php artisan optimize` caches config, events, routes and views again. Then `php artisan reload` runs `queue:restart` and `schedule:interrupt`, so workers pick up the new code.

## Where tenant migrations fit in the deploy

`php artisan tenants:migrate` comes from stancl/tenancy. It runs your tenant migrations against every tenant database, one after the other, and stancl's default config already passes `--force`. Two things about it matter during a deploy.

It gets slower with every customer. Ten tenants take seconds; a thousand can take minutes, and during that window some tenants already have the new schema while others don't. That's why I write backwards-compatible migrations, so both versions of the code keep working.

It also runs before `reload`. With `set -e`, a failing tenant stops the script, and workers keep running the old code until you fix the problem and deploy again. I'd much rather have that than workers on new code talking to a half-migrated schema.

For risky changes, migrate a couple of tenants first as a canary with `php artisan tenants:migrate --tenants=1 --tenants=2`. Safe migration patterns, and how to recover from a half-finished run, are in [tenant migrations and seeders in Laravel](/blog/laravel-tenant-migrations-seeders.html).

## Queue workers with Supervisor

Queue workers are long-running processes. Something has to restart them when they crash or when the server reboots, and that's the process manager's job. Here's a Supervisor config:

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

If queued jobs are stored on the central connection, one pool of workers handles every tenant. stancl's queue bootstrapper restores the right tenant when each job runs. Workers do keep old code in memory, though, which is why the deploy script ends with `reload`.

## The scheduler

One cron entry covers the whole app:

```bash
* * * * * cd /var/www/your-saas && php artisan schedule:run >> /dev/null 2>&1
```

Scheduled tasks run in the central context. When a command has to run for each tenant, wrap it in `tenants:run`:

```php
Schedule::command('tenants:run reports:send')
    ->dailyAt('02:00')
    ->withoutOverlapping()
    ->onOneServer();
```

`onOneServer()` needs a cache store that supports locks (database, Redis, Memcached or DynamoDB), shared by all your servers. Without it, two servers would both send the reports.

## Avoiding downtime

The script above updates files in place, so for a few seconds requests can hit a half-updated app. Zero-downtime deploys fix that. Each release is built in its own directory, and a `current` symlink switches over once everything is ready. Deployer, Envoyer or your hosting platform can automate the pattern, and once real customers depend on the app I think it's worth setting up.

Two things have to be shared between releases: the `.env` file and the whole `storage` directory. Don't skip the second one. With stancl's filesystem bootstrapper, each tenant's files live in their own folder under `storage`, so a fresh `storage` per release would look as if every upload had vanished.

The server is only one part of launch day. For product, legal and support readiness, go through the [Laravel SaaS launch checklist](/blog/laravel-saas-launch-checklist.html). And if you haven't picked a foundation yet, my [buyer's guide to Laravel SaaS starter kits](/blog/laravel-saas-starter-kit.html) covers what to look for.

## Frequently asked questions

### Can I deploy a multi-tenant Laravel app to shared hosting?

Rarely. You need wildcard subdomains, a database user that can create databases and long-running queue workers. Most shared hosts won't give you all of them, so I'd go straight to a VPS or a managed platform.

### Should tenant migrations run in the deploy script?

For most apps, yes. Running them in the script means a failure stops the deploy before workers restart. Some teams with thousands of tenants move them to queued jobs instead, but then they have to track which tenants are finished.

### How do I roll back a bad deploy?

Switch the `current` symlink back to the previous release and run `php artisan reload`. Rolling back migrations across every tenant is slow and risky. That's one more reason to keep migrations backwards compatible, so the old code still runs on the new schema.

### Why does a new tenant subdomain show a certificate error?

Your certificate probably only covers the main domain. Issue a wildcard certificate for `*.your-saas.com` through the DNS-01 challenge. Keep in mind that a wildcard only covers one level of subdomains.

## Deploying SaaS Laravel

If you'd rather start from something that already spells this out, the SaaS Laravel kits list their production needs in the [requirements](/docs/getting-started/requirements.html): PHP 8.3 or newer, a web server that routes the central domain and `*.your-domain.com`, wildcard DNS, a database user that can create tenant databases, `php artisan queue:work`, and a real mailer. You set the central domain with `APP_DOMAIN`. Tenant migrations live in `database/migrations/tenant` and run with `php artisan tenants:migrate`. Queued jobs go into the central `jobs` table, so one worker serves every tenant.

One thing to watch: `npm run build` runs `wayfinder:generate` through the Vite plugin, so PHP and Composer dependencies must be installed wherever you build. The kits don't define any scheduled tasks yet, and you should remove or change the seeded default users before going live.

<BlogPostCta title="Start from a deployable SaaS" text="SaaS Laravel ships database-per-tenant multi-tenancy, a central queue for all tenants and documented production requirements, in Vue, React or Svelte." />
