---
title: "Maintenance Mode for Multi-Tenant Laravel Apps"
description: "Laravel maintenance mode in a multi-tenant SaaS: php artisan down options, bypass cookies on subdomains, and pausing all workspaces or a single tenant."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: saas
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

Turning on Laravel maintenance mode takes one command: `php artisan down`. In a multi-tenant SaaS, though, that one command often does more than you wanted. It takes your marketing site, sign-up page and admin area offline along with every customer workspace. Here I'll explain how the built-in maintenance mode behaves with tenant subdomains, and then show two finer-grained options: pausing all tenant workspaces while the central app stays up, and taking just one tenant offline.

## How Laravel maintenance mode works

With the default `file` driver, `php artisan down` writes a file at `storage/framework/down`. As long as that file exists, the `PreventRequestsDuringMaintenance` middleware answers every request with a 503, until you run `php artisan up`.

The command has more options than most people use:

| Option | What it does |
| --- | --- |
| `--secret=...` | Visiting `/<secret>` sets a bypass cookie, so you can use the app while it is down |
| `--with-secret` | Generates a random secret and prints it |
| `--render="errors::503"` | Prerenders a view and serves it before the framework boots |
| `--retry=60` | Sends a `Retry-After` header |
| `--refresh=15` | Asks the browser to reload the page after 15 seconds |
| `--redirect=/` | Redirects every request to one path |
| `--status=503` | The HTTP status to return (503 by default) |

Around a risky piece of work, the sequence usually looks like this:

```bash
php artisan down --with-secret --retry=60 --render="errors::503"
# run the migration, move the server, restore the data...
php artisan up
```

### Where multi-tenant apps get surprised

The first surprise is the bypass cookie. Laravel sets the `laravel_maintenance` cookie using your `session.domain`, and with the usual `SESSION_DOMAIN=null` that means the cookie only works on the host where you opened the secret URL. If you want to check both `acme.your-saas.com` and `globex.your-saas.com`, you have to open the secret URL on each one. You might be tempted to share the cookie across all subdomains instead, but that would also share sessions between tenants, which you almost never want (more on that in [sessions across tenant subdomains](/blog/laravel-multi-tenancy-subdomains.html)).

Second, running several servers needs a shared store. The file driver only affects the server where you ran the command. Set `APP_MAINTENANCE_DRIVER=cache` and point `APP_MAINTENANCE_STORE` at a store every server can read, so a single `down` applies everywhere.

The last one catches people off guard: queues and the scheduler pause too. While the app is down, `queue:work` stops picking up jobs unless it was started with `--force`, and scheduled tasks are skipped unless they call `evenInMaintenanceMode()`. Invitation emails and other queued work just sit and wait for `php artisan up`.

## Three levels of maintenance in a multi-tenant app

`php artisan down` works at the application level. It has no idea which tenant a request belongs to. That's fine for some jobs, but it's only one of the scopes you might need:

| Scope | Who is blocked | Typical reason | Tool |
| --- | --- | --- | --- |
| Platform | Everyone, central and tenants | Moving servers, a risky central migration | `php artisan down` |
| All workspaces | Every tenant; the central app stays online | A tenant schema change that can't be made backwards compatible | A central setting plus middleware |
| One tenant | A single customer | Restoring or moving that tenant's database | A flag on the tenant |

The two narrower scopes need a bit of code. Once you have paying customers, I think both are worth adding.

## Maintenance for every workspace, with the central app online

The idea is simple. You store a flag in the **central** database and check it in middleware that runs after tenant identification. Since the flag lives on the central connection, one write affects every tenant, and your admin area stays reachable so you can turn it off again.

With stancl/tenancy, you can make a small `Setting` model that uses the `CentralConnection` trait. It always reads from the central database, even in the middle of a tenant request. The middleware can then look like this:

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

A few decisions come up while you build this. First, which routes stay open: keep login, the two-factor challenge and logout reachable so your team can still sign in and use a bypass. Second, how your team gets in. Symfony's `IpUtils::checkIp()` accepts single IPs and CIDR ranges, so an office or VPN allow list is easy to support.

The third one is where it runs, and it's the one to double-check. Register the middleware after tenancy is initialised. If it runs first, `tenant()` returns `null` and the check quietly lets every request through, with no error to tell you something's wrong.

### A bypass link you can revoke

Not everyone on your team has a fixed IP. For them, add a route that sets a cookie when the secret in the URL matches. Store an HMAC of the secret rather than the secret itself, and compare using `hash_equals()`:

```php
$token = hash_hmac('sha256', $mode['secret'], config('app.key'));

return redirect('/')->withCookie(cookie('tenant_maintenance_bypass', $token, 60 * 12));
```

If you're wondering why an HMAC and not a random token: the cookie value is derived from the secret, so changing the secret immediately invalidates every bypass cookie you've handed out. There's nothing to track or clean up.

## Taking a single tenant offline

Sometimes only one customer is affected. Maybe you're restoring their database from a backup, moving it to another server or running a long data fix for one large account. stancl/tenancy v3 handles this for you with two pieces. The `MaintenanceMode` trait adds `putDownForMaintenance()` to your tenant model, which stores a `maintenance_mode` attribute holding the time, message, retry value and allowed IPs. Then the `CheckTenantForMaintenanceMode` middleware returns a 503 for that tenant and lets the allowed IPs through.

```php
use Stancl\Tenancy\Database\Concerns\MaintenanceMode;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains, MaintenanceMode;
}

$tenant->putDownForMaintenance(['message' => 'Restoring data', 'retry' => 600]);
$tenant->update(['maintenance_mode' => null]); // back online
```

Add the middleware to your tenant routes after the identification middleware, because it throws an exception when no tenant is initialised. Also note that it throws a plain 503 `HttpException`, so the message you stored isn't shown automatically. If you want customers to see it, customise your 503 error page.

Keep per-tenant maintenance for short, technical pauses. Blocking a customer over unpaid invoices or abuse is a different workflow, covered separately in [suspending customer accounts in a SaaS](/blog/suspend-tenant-accounts-saas.html).

## Maintenance mode during deploys

Do you need any of this for a normal deploy? Most of the time, no. If your migrations are backwards compatible (add a nullable column, backfill it, drop the old one in a later release), both the old and new code keep working while the tenant migrations run database by database. I'd only reach for workspace-wide maintenance when a change genuinely can't be made compatible, like renaming a column that the running code still reads. The full sequence is in [deploying a Laravel SaaS to production](/blog/deploy-laravel-saas.html).

## What a good maintenance page includes

Start with the status code. Return a 503 with a `Retry-After` header, so search engines and uptime monitors treat the outage as temporary rather than as a broken site.

Then the message. Keep it short and honest: what's happening and roughly when you'll be back. If you have a status page, link to it.

Make sure the page doesn't depend on the thing you're fixing. `--render` serves a prerendered page without booting the framework, which helps a lot when the app itself can't start halfway through a deploy. Also avoid long CDN caching on it, or customers will keep seeing the maintenance page after you're back up.

Finally, leave a way in for your team: open login routes, a bypass link or an IP allow list.

## Frequently asked questions

### Does php artisan down take every tenant offline?

Yes. Laravel's maintenance middleware is global and runs for every request on every host, so the central app and all tenant subdomains return a 503. If you only want to pause workspaces, use a tenant-level flag.

### Why does my maintenance secret only work on one subdomain?

Because the bypass cookie is set for the current host unless `SESSION_DOMAIN` covers all subdomains. Open the secret URL on each tenant host you need to use while the app is down.

### Do queued jobs run while Laravel is in maintenance mode?

Not by default. Workers pause until `php artisan up`, unless you started them with `queue:work --force`. Scheduled tasks are skipped unless they use `evenInMaintenanceMode()`.

### Can I put a single tenant into maintenance with stancl/tenancy?

Yes. Version 3 comes with a `MaintenanceMode` trait for the tenant model and a `CheckTenantForMaintenanceMode` middleware. Call `putDownForMaintenance()` on the tenant, then clear `maintenance_mode` to bring it back.

## How SaaS Laravel handles maintenance mode

If you'd rather not build the workspace-wide version yourself, the SaaS Laravel kits already include it. It's managed from **Setup → Tenant Settings** by users with the `Manage Tenant Maintenance` permission. The setting lives in the central `settings` table and holds a message, a bypass secret and an allow list of up to 50 IPs or CIDR ranges. While it's on, tenant requests get a 503 maintenance page, except login, two-factor, passkey login and logout. Signed-in tenant users can open `/maintenance/bypass/<secret>` to get a 12-hour cookie that holds an HMAC of the secret. The central app is never blocked, and `php artisan down` still works for the whole application. Per-tenant maintenance isn't built in, but suspending a single workspace is. The docs cover it under [maintenance and suspension](/docs/core/maintenance-and-suspension.html), and the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html) explains what else to look for in a kit.

<BlogPostCta title="Maintenance mode, already wired up" text="SaaS Laravel includes workspace-wide maintenance mode with a bypass link and IP allow list, plus workspace suspension, in Vue, React or Svelte." />
