---
title: "Laravel Multi-Tenancy with Subdomains"
description: "A Laravel multi-tenancy subdomain guide for stancl/tenancy: identification middleware, central domains, tenant routes, sessions, wildcard DNS and links."
date: 2026-09-29
author: erag
category: multi-tenancy
tags: [Multi-tenancy, Routing]
pageClass: blog-page
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-multi-tenancy-subdomains.html
  - - meta
    - property: og:title
      content: "Laravel Multi-Tenancy with Subdomains"
  - - meta
    - property: og:description
      content: "A Laravel multi-tenancy subdomain guide for stancl/tenancy: identification middleware, central domains, tenant routes, sessions, wildcard DNS and links."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-multi-tenancy-subdomains.html
  - - meta
    - name: twitter:title
      content: "Laravel Multi-Tenancy with Subdomains"
  - - meta
    - name: twitter:description
      content: "A Laravel multi-tenancy subdomain guide for stancl/tenancy: identification middleware, central domains, tenant routes, sessions, wildcard DNS and links."
---

# Laravel Multi-Tenancy with Subdomains: How Tenant Identification Works

<BlogPostMeta />

Most multi-tenant Laravel apps give each customer their own address, like `acme.your-saas.com`. A Laravel multi-tenancy subdomain setup looks simple from the outside, but a surprising number of pieces have to agree with each other: the identification middleware, the list of central domains, the `domains` table, your routes, session cookies, DNS and the way you build links. When one of them is off, you usually get a confusing 404 or a server error rather than a helpful message.

We'll go through each piece using [stancl/tenancy](https://tenancyforlaravel.com) (version 3), the package behind most Laravel multi-tenant apps. If you haven't settled on a data model yet, read [how to build a multi-tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html) first.

## How subdomain identification works

Before your controller runs, every request goes through the same steps:

```text
acme.your-saas.com/dashboard
  → is the host a central domain?   no
  → look up the host in the domains table → tenant "acme"
  → tenancy()->initialize($tenant)  (database, cache, files, queue switch)
  → your route runs inside the tenant
```

When the host is a central domain (`your-saas.com`), tenancy isn't started. Your central app handles the request instead, which covers the marketing site, sign-up and the platform admin.

## Laravel multi-tenancy subdomain middleware: which one to use

stancl/tenancy ships three middleware that read the host name. The difference between them is what they look up in the `domains` table.

| Middleware | Looks up | Store in `domains.domain` |
| --- | --- | --- |
| `InitializeTenancyByDomain` | The full host, e.g. `acme.your-saas.com` | `acme.your-saas.com` |
| `InitializeTenancyBySubdomain` | Only the first part of the host, e.g. `acme` | `acme` |
| `InitializeTenancyByDomainOrSubdomain` | The subdomain if the host ends with a central domain, otherwise the full host | `acme` for subdomains, `app.customer.com` for custom domains |

`InitializeTenancyBySubdomain` throws a `NotASubdomainException` when the host is a central domain, a bare `localhost`, an IP address, or a domain that doesn't end with one of your central domains. By default it treats the first part of the host as the subdomain. If you prefix hosts with `www`, the static `$subdomainIndex` property lets you change that.

Our preference is to store the **full host** with `InitializeTenancyByDomain`. It's the most explicit option: each row in the `domains` table is exactly the host a browser sends, so nothing is guessed, and moving to a different central domain later means updating rows rather than changing code.

## Configure the central domains

The package has to know which hosts are not tenants. That's the `central_domains` key in `config/tenancy.php`:

```php
// config/tenancy.php
'central_domains' => [
    env('APP_DOMAIN'), // e.g. your-saas.com
],
```

By default, the published config lists `127.0.0.1` and `localhost`. Replace them with your real central domain. If you don't, your production host gets treated as a tenant and returns an error. The middleware compare the request host exactly, so `your-saas.com` and `www.your-saas.com` need two separate entries.

## Split routes: routes/tenant.php vs routes/web.php

Running `php artisan tenancy:install` creates `routes/tenant.php`, and the generated `TenancyServiceProvider` loads it. Tenant routes carry two middleware:

```php
// routes/tenant.php
Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
])->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
});
```

`PreventAccessFromCentralDomains` aborts with a 404 when someone opens a tenant route on a central domain. Your central routes stay in `routes/web.php`, and they need protecting from tenant hosts as well. stancl's documentation suggests wrapping them in `Route::domain()` for each central domain. A small middleware that aborts when the host isn't in `central_domains` does the job just as well, and it's what we tend to use.

### Unknown subdomains

A request for `typo.your-saas.com` throws `TenantCouldNotBeIdentifiedOnDomainException`, and unless you handle it, the visitor sees a server error. Turn it into a 404 in `bootstrap/app.php`:

```php
use Stancl\Tenancy\Contracts\TenantCouldNotBeIdentifiedException;

->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(function (TenantCouldNotBeIdentifiedException $e) {
        abort(404);
    });
})
```

## The domains table

The package's migration creates a central `domains` table with a unique `domain` column and a `tenant_id` foreign key that cascades on delete. A tenant can have more than one domain:

```php
$tenant = Tenant::create();

$tenant->domains()->create(['domain' => 'acme.your-saas.com']);
```

On save, the `Domain` model lowercases the domain and checks that it doesn't already belong to another tenant. If it does, you get a `DomainOccupiedByOtherTenantException`. When customers pick their own subdomain, catch that exception and show it as a validation error.

You should still validate the subdomain yourself before it gets that far. Allow lowercase letters, digits and hyphens, cap each DNS label at 63 characters, and keep a list of reserved names such as `www`, `api` or `admin`.

## Sessions and cookies across subdomains

In a multi-tenant app, leave `SESSION_DOMAIN` empty (`null`). The session cookie is then a **host-only** cookie. `acme.your-saas.com` and `globex.your-saas.com` each get their own session, and signing in to one tenant never signs you in to another.

With `SESSION_DOMAIN=.your-saas.com`, one cookie is shared across every subdomain. That's handy for a single app spread over subdomains, but here it mixes tenant sessions together. Laravel's `XSRF-TOKEN` cookie uses the same domain setting, so it would be shared too.

::: tip Sessions in tenant databases
If you use the database session driver together with the database bootstrapper, sessions started on a tenant host are stored in that tenant's database. That's one more reason a cookie shared across tenants wouldn't work.
:::

## Generating links to a tenant's subdomain

`route()` builds URLs for the current host. So from the central admin, `route('dashboard')` points at `your-saas.com`, not at the tenant. There are two ways around this.

The first is the `tenant_route()` helper that comes with stancl/tenancy. It swaps the host of a generated URL:

```php
$url = tenant_route('acme.your-saas.com', 'dashboard');
// https://acme.your-saas.com/dashboard
```

The second is to build the URL yourself from a relative path. We like this one because it also works for signed links:

```php
$path = URL::temporarySignedRoute('invitation.show', now()->addDays(7), [], absolute: false);

$url = "https://{$tenant->domains()->value('domain')}{$path}";
```

On the tenant route, validate relative signed URLs with the `signed:relative` middleware. There's a fuller walkthrough of this pattern in [our post on user invitations with signed URLs](/blog/laravel-user-invitations-signed-urls.html).

## Wildcard DNS and TLS in production

A new tenant should work the moment it's created, without anyone touching DNS or the server. For that you need the following:

| Layer | What to set up |
| --- | --- |
| DNS | A wildcard record `*.your-saas.com` pointing at your server, next to the record for `your-saas.com` |
| Web server | A virtual host that serves both, e.g. nginx `server_name your-saas.com *.your-saas.com;` |
| TLS | A wildcard certificate for `*.your-saas.com`. Let's Encrypt issues wildcards only through the DNS-01 challenge |

Keep in mind that a wildcard certificate only covers one level. `acme.your-saas.com` is covered; `eu.acme.your-saas.com` isn't.

If you turn on Laravel's trusted hosts, calling `$middleware->trustHosts()` without arguments trusts the host of `APP_URL` and all of its subdomains. It's skipped in the `local` environment.

## Local development

You need wildcard subdomains on your laptop as well, and `/etc/hosts` can't do wildcards. Our [guide to local subdomains with Laravel Herd](/blog/laravel-herd-subdomains.html) covers Herd, the alternatives and the usual pitfalls.

## Frequently asked questions

### Should I store the full domain or only the subdomain?

That depends on the middleware. `InitializeTenancyByDomain` looks up the full host, while `InitializeTenancyBySubdomain` only looks up the first part. We'd store full hosts: it's the most explicit option and it leaves room for other domains later.

### Why do I get a 404 on my central domain?

There are two usual causes. Either a tenant route is being opened on a central host, which `PreventAccessFromCentralDomains` blocks on purpose, or your host is missing from `central_domains`. Check that `APP_DOMAIN` matches the host in the browser exactly.

### Can users stay logged in across tenant subdomains?

Only with a shared `SESSION_DOMAIN`, and we don't recommend that for multi-tenant apps. Each tenant should have its own session, with users signing in to each tenant separately.

### Can tenants also use their own custom domain?

Yes. A custom domain is just another row in the `domains` table, identified by `InitializeTenancyByDomain` or `InitializeTenancyByDomainOrSubdomain`. The customer points their domain at your server, and you need a TLS certificate for each custom domain.

## How SaaS Laravel handles subdomains

This is the setup we ship in the [SaaS Laravel starter kits](/). `APP_DOMAIN` is the only central domain, and tenant domains are always `<subdomain>.APP_DOMAIN`, stored as full hosts. A global middleware skips tenancy on the central domain and runs `InitializeTenancyByDomain` everywhere else. Unknown hosts return a 404, and a `central.only` middleware keeps the central admin off tenant hosts. `SESSION_DOMAIN` stays `null`, and invitation and password-reset links are built from the tenant's primary domain. Each tenant can have several subdomains with their own app name, language and auth features. The [Domains](/docs/core/domains.html) and [Multi-tenancy](/docs/core/multi-tenancy.html) docs have the details.

<BlogPostCta title="Subdomain multi-tenancy, already wired up" text="SaaS Laravel identifies tenants by subdomain, keeps sessions per tenant and builds tenant links for you, with Vue, React or Svelte on the same Laravel backend." />
