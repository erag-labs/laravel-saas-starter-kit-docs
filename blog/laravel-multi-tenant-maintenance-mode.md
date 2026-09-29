---
title: "Maintenance Mode for Multi-Tenant Laravel Apps"
description: "Laravel maintenance mode in a multi-tenant SaaS: php artisan down options, bypass cookies on subdomains, and pausing all workspaces or a single tenant."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
tags: [Multi-tenancy, Operations]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-multi-tenant-maintenance-mode.html
  - - meta
    - property: og:title
      content: "Maintenance Mode for Multi-Tenant Laravel Apps"
  - - meta
    - property: og:description
      content: "Laravel maintenance mode in a multi-tenant SaaS: php artisan down options, bypass cookies on subdomains, and pausing all workspaces or a single tenant."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-multi-tenant-maintenance-mode.html
  - - meta
    - name: twitter:title
      content: "Maintenance Mode for Multi-Tenant Laravel Apps"
  - - meta
    - name: twitter:description
      content: "Laravel maintenance mode in a multi-tenant SaaS: php artisan down options, bypass cookies on subdomains, and pausing all workspaces or a single tenant."
---

# Laravel Maintenance Mode in a Multi-Tenant SaaS: Platform, Workspace and Tenant Level

<BlogPostMeta />

**Laravel maintenance mode** is a single command: `php artisan down`. In a multi-tenant SaaS that command is often too blunt, because it takes your marketing site, sign-up and admin area offline together with every customer workspace. This guide explains how the built-in maintenance mode behaves with tenant subdomains, then shows two finer options: pausing all tenant workspaces while the central app stays online, and taking a single tenant offline.

## How Laravel maintenance mode works

With the default `file` driver, `php artisan down` writes `storage/framework/down`. From then on, the `PreventRequestsDuringMaintenance` middleware answers every request with a 503 until you run `php artisan up`.

The command has a few options worth knowing:

| Option | What it does |
| --- | --- |
| `--secret=...` | Visiting `/<secret>` sets a bypass cookie, so you can use the app while it is down |
| `--with-secret` | Generates a random secret and prints it |
| `--render="errors::503"` | Prerenders a view and serves it before the framework boots |
| `--retry=60` | Sends a `Retry-After` header |
| `--refresh=15` | Asks the browser to reload the page after 15 seconds |
| `--redirect=/` | Redirects every request to one path |
| `--status=503` | The HTTP status to return (503 by default) |

A typical sequence around risky work:

```bash
php artisan down --with-secret --retry=60 --render="errors::503"
# run the migration, move the server, restore the data...
php artisan up
```

### Three things that surprise multi-tenant apps

- **The bypass cookie belongs to one host.** Laravel sets the `laravel_maintenance` cookie with your `session.domain`. With the usual `SESSION_DOMAIN=null`, the cookie only works on the host where you opened the secret URL. To check `acme.your-saas.com` and `globex.your-saas.com`, open the secret URL on each of them. Sharing cookies across all subdomains would also share sessions between tenants, which is rarely what you want (see [sessions across tenant subdomains](/blog/laravel-multi-tenancy-subdomains.html)).
- **Several servers need a shared store.** The file driver only affects the server where you ran the command. Set `APP_MAINTENANCE_DRIVER=cache` and point `APP_MAINTENANCE_STORE` at a store all servers share, so one `down` applies everywhere.
- **Queues and the scheduler pause too.** `queue:work` stops taking jobs while the app is down unless it was started with `--force`, and scheduled tasks are skipped unless they call `evenInMaintenanceMode()`. Invitation emails and other queued work simply wait for `php artisan up`.

## Three scopes of maintenance in a multi-tenant app

`php artisan down` works at the application level and doesn't care which tenant a request belongs to. That is one of three scopes you might need:

| Scope | Who is blocked | Typical reason | Tool |
| --- | --- | --- | --- |
| Platform | Everyone, central and tenants | Moving servers, a risky central migration | `php artisan down` |
| All workspaces | Every tenant; the central app stays online | A tenant schema change that can't be made backwards compatible | A central setting plus middleware |
| One tenant | A single customer | Restoring or moving that tenant's database | A flag on the tenant |

The two finer scopes need a little code. Both are worth having once you have paying customers.

## Maintenance for every workspace, with the central app online

The idea: store a flag in the **central** database and check it in middleware that runs after tenant identification. Because the flag lives on the central connection, one write affects every tenant, and your admin area stays reachable so you can switch it off again.

With stancl/tenancy, a small `Setting` model that uses the `CentralConnection` trait always reads the central database, even inside a tenant request. The middleware then looks like this:

```php
public function handle(Request $request, Closure $next): Response
{
    $mode = Setting::where('key', 'tenant_maintenance')->value('value'); // array cast

    if (! tenant() || ! ($mode['enabled'] ?? false)) {
        return $next($request);
    }

    if ($request->routeIs('login', 'login.store', 'logout')
        || IpUtils::checkIp((string) $request->ip(), $mode['allowed_ips'] ?? [])) {
        return $next($request);
    }

    return response()->view('tenant-maintenance', ['message' => $mode['message'] ?? null], 503);
}
```

Decisions to make along the way:

- **Which routes stay open.** Keep login, the two-factor challenge and logout reachable, so your team can sign in and use a bypass.
- **How your team gets in.** Symfony's `IpUtils::checkIp()` accepts single IPs and CIDR ranges, which makes an office or VPN allow list easy.
- **Where it runs.** Register it after tenancy is initialised. If it runs first, `tenant()` is `null` and the check silently lets everything through.

### A bypass link that can be revoked

For people without a fixed IP, add a route that sets a cookie when the secret matches. Store an HMAC of the secret, not the secret itself, and compare with `hash_equals()`:

```php
$token = hash_hmac('sha256', $mode['secret'], config('app.key'));

return redirect('/')->withCookie(cookie('tenant_maintenance_bypass', $token, 60 * 12));
```

Because the cookie value depends on the secret, changing the secret instantly invalidates every bypass cookie that was handed out.

## Taking a single tenant offline

Sometimes only one customer is affected: you are restoring their database from a backup, moving it to another server or running a long data fix for one large account. stancl/tenancy v3 has this built in:

- The `MaintenanceMode` trait adds `putDownForMaintenance()` to your tenant model. It stores a `maintenance_mode` attribute with the time, message, retry value and allowed IPs.
- The `CheckTenantForMaintenanceMode` middleware returns a 503 for that tenant, letting allowed IPs through.

```php
use Stancl\Tenancy\Database\Concerns\MaintenanceMode;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains, MaintenanceMode;
}

$tenant->putDownForMaintenance(['message' => 'Restoring data', 'retry' => 600]);
$tenant->update(['maintenance_mode' => null]); // back online
```

Add the middleware to your tenant routes after the identification middleware; it throws an exception when no tenant is initialised. It throws a plain 503 `HttpException`, so the stored message is not shown automatically. Customise your 503 error page if you want to display it.

Per-tenant maintenance is a short, technical pause. Blocking a customer for unpaid invoices or abuse is a different workflow, covered in [suspending customer accounts in a SaaS](/blog/suspend-tenant-accounts-saas.html).

## Maintenance mode during deploys

Most don't. If your migrations are backwards compatible (add a nullable column, backfill it, remove the old one in a later release), old and new code both work while the tenant migrations run database by database. Reach for workspace-wide maintenance only when a change can't be made compatible, such as renaming a column the running code still reads. The full sequence is in [deploying a Laravel SaaS to production](/blog/deploy-laravel-saas.html).

## What a good maintenance page includes

- **A 503 status and a `Retry-After` header**, so search engines and uptime monitors treat the outage as temporary.
- **A short, honest message**: what is happening and roughly when it will be back. Link your status page if you have one.
- **No dependencies on the thing you're fixing.** `--render` serves a prerendered page without booting the framework, which helps when the app itself can't start mid-deploy.
- **No long CDN caching**, or customers will keep seeing the page after you're back.
- **A way in for your team**, through open login routes, a bypass link or an IP allow list.

## Frequently asked questions

### Does php artisan down take every tenant offline?

Yes. Laravel's maintenance middleware is global and runs for every request on every host, so the central app and all tenant subdomains return 503. Use a tenant-level flag if you only want to pause workspaces.

### Why does my maintenance secret only work on one subdomain?

The bypass cookie is set for the current host unless `SESSION_DOMAIN` covers all subdomains. Open the secret URL on each tenant host you want to use while the app is down.

### Do queued jobs run while Laravel is in maintenance mode?

Not by default. Workers pause until `php artisan up`, unless they were started with `queue:work --force`. Scheduled tasks are skipped unless they use `evenInMaintenanceMode()`.

### Can I put a single tenant into maintenance with stancl/tenancy?

Yes. Version 3 ships a `MaintenanceMode` trait for the tenant model and a `CheckTenantForMaintenanceMode` middleware. Call `putDownForMaintenance()` on the tenant and clear `maintenance_mode` to bring it back.

## How SaaS Laravel handles maintenance mode

The SaaS Laravel kits include workspace-wide maintenance, managed from **Setup → Tenant Settings** by users with the `Manage Tenant Maintenance` permission. The setting is stored in the central `settings` table and has a message, a bypass secret and an allow list of up to 50 IPs or CIDR ranges. While it is on, tenant requests get a 503 maintenance page, except login, two-factor, passkey login and logout. Signed-in tenant users can open `/maintenance/bypass/<secret>` to get a 12-hour cookie that holds an HMAC of the secret. The central app is never blocked, and `php artisan down` still works for the whole application. Per-tenant maintenance is not built in, but suspending a single workspace is. See [maintenance and suspension](/docs/core/maintenance-and-suspension.html) in the docs, or the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html) for what else to expect from a kit.

<BlogPostCta title="Maintenance mode, already wired up" text="SaaS Laravel includes workspace-wide maintenance mode with a bypass link and IP allow list, plus workspace suspension, in Vue, React or Svelte." />
