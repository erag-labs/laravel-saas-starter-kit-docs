---
title: "Laravel Multi-Tenancy with Subdomains"
description: "A Laravel multi-tenancy subdomain guide for stancl/tenancy: identification middleware, central domains, tenant routes, sessions, wildcard DNS and links."
date: 2026-09-29
author: erag
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

Giving every customer their own address, like `acme.your-saas.com`, is the most common way to run a multi-tenant Laravel app. A **Laravel multi-tenancy subdomain** setup looks simple from the outside, but several pieces have to agree with each other: the identification middleware, the list of central domains, the `domains` table, your routes, session cookies, DNS and the way you build links.

This guide walks through each piece using [stancl/tenancy](https://tenancyforlaravel.com) (version 3), the package behind most Laravel multi-tenant apps. If you are still choosing a data model, start with [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## How subdomain identification works

Every request goes through the same steps before your controller runs:

```text
acme.your-saas.com/dashboard
  → is the host a central domain?   no
  → look up the host in the domains table → tenant "acme"
  → tenancy()->initialize($tenant)  (database, cache, files, queue switch)
  → your route runs inside the tenant
```

If the host is a central domain (`your-saas.com`), tenancy is not started and the request is handled by your central app: the marketing site, sign-up and the platform admin.

## Laravel multi-tenancy subdomain middleware: which one to use

stancl/tenancy ships three middleware that read the host name. They differ in **what they look up** in the `domains` table.

| Middleware | Looks up | Store in `domains.domain` |
| --- | --- | --- |
| `InitializeTenancyByDomain` | The full host, e.g. `acme.your-saas.com` | `acme.your-saas.com` |
| `InitializeTenancyBySubdomain` | Only the first part of the host, e.g. `acme` | `acme` |
| `InitializeTenancyByDomainOrSubdomain` | The subdomain if the host ends with a central domain, otherwise the full host | `acme` for subdomains, `app.customer.com` for custom domains |

`InitializeTenancyBySubdomain` throws a `NotASubdomainException` when the host is a central domain, a bare `localhost`, an IP address, or a domain that does not end with one of your central domains. By default the subdomain is the first part of the host; the static `$subdomainIndex` property changes that if you prefix hosts with `www`.

Storing the **full host** with `InitializeTenancyByDomain` is the most explicit option. Each row in the `domains` table is exactly the host a browser sends, so there is no guessing, and switching the central domain later means updating rows rather than changing code.

## Configure the central domains

The package needs to know which hosts are **not** tenants. That is the `central_domains` key in `config/tenancy.php`:

```php
// config/tenancy.php
'central_domains' => [
    env('APP_DOMAIN'), // e.g. your-saas.com
],
```

The published config lists `127.0.0.1` and `localhost` by default. Replace them with your real central domain, otherwise your production host is treated as a tenant and returns an error. The middleware compare the request host exactly, so `your-saas.com` and `www.your-saas.com` are two different entries.

## Split routes: routes/tenant.php vs routes/web.php

`php artisan tenancy:install` creates `routes/tenant.php`, and the generated `TenancyServiceProvider` loads it. Tenant routes carry two middleware:

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

`PreventAccessFromCentralDomains` aborts with a 404 when a tenant route is opened on a central domain. `routes/web.php` keeps your central routes. Protect those from tenant hosts too: stancl's documentation suggests wrapping them in `Route::domain()` for each central domain, and a small middleware that aborts when the host is **not** in `central_domains` works just as well.

### Unknown subdomains

A request for `typo.your-saas.com` throws `TenantCouldNotBeIdentifiedOnDomainException`. Unless you handle it, that is a server error. Turn it into a 404 in `bootstrap/app.php`:

```php
use Stancl\Tenancy\Contracts\TenantCouldNotBeIdentifiedException;

->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(function (TenantCouldNotBeIdentifiedException $e) {
        abort(404);
    });
})
```

## The domains table

The package's migration creates a central `domains` table with a unique `domain` column and a `tenant_id` foreign key that cascades on delete. One tenant can have several domains:

```php
$tenant = Tenant::create();

$tenant->domains()->create(['domain' => 'acme.your-saas.com']);
```

The `Domain` model converts domains to lowercase and checks on save that the domain does not belong to another tenant. It throws `DomainOccupiedByOtherTenantException` if it does. Catch it and turn it into a validation error when customers pick their own subdomain. Also validate the subdomain yourself: lowercase letters, digits and hyphens, at most 63 characters per DNS label, and a list of reserved names such as `www`, `api` or `admin`.

## Sessions and cookies across subdomains

Leave `SESSION_DOMAIN` empty (`null`) in a multi-tenant app. The session cookie is then a **host-only** cookie: `acme.your-saas.com` and `globex.your-saas.com` each get their own session, and signing in to one tenant never signs you in to another.

Setting `SESSION_DOMAIN=.your-saas.com` shares one cookie across every subdomain. That is useful for a single app spread over subdomains, but in a multi-tenant app it mixes tenant sessions together. Laravel's `XSRF-TOKEN` cookie uses the same domain setting, so it would be shared as well.

::: tip Sessions in tenant databases
With the database session driver and the database bootstrapper, sessions started on a tenant host are stored in that tenant's database. That is another reason a cookie shared across tenants would not work.
:::

## Generating links to a tenant's subdomain

`route()` builds URLs for the **current** host. From the central admin, `route('dashboard')` points at `your-saas.com`, not at the tenant. You have two options.

stancl/tenancy includes a `tenant_route()` helper that swaps the host of a generated URL:

```php
$url = tenant_route('acme.your-saas.com', 'dashboard');
// https://acme.your-saas.com/dashboard
```

Or build the URL yourself from a relative path, which also works for signed links:

```php
$path = URL::temporarySignedRoute('invitation.show', now()->addDays(7), [], absolute: false);

$url = "https://{$tenant->domains()->value('domain')}{$path}";
```

Validate relative signed URLs with the `signed:relative` middleware on the tenant route. This pattern is covered in more detail in [User Invitations in Laravel with Signed URLs](/blog/laravel-user-invitations-signed-urls.html).

## Wildcard DNS and TLS in production

Every new tenant must work without touching DNS or the server. That needs three things:

| Layer | What to set up |
| --- | --- |
| DNS | A wildcard record `*.your-saas.com` pointing at your server, next to the record for `your-saas.com` |
| Web server | A virtual host that serves both, e.g. nginx `server_name your-saas.com *.your-saas.com;` |
| TLS | A wildcard certificate for `*.your-saas.com`. Let's Encrypt issues wildcards only through the DNS-01 challenge |

A wildcard certificate covers one level only: `acme.your-saas.com` is covered, `eu.acme.your-saas.com` is not.

If you enable Laravel's trusted hosts, `$middleware->trustHosts()` without arguments trusts the host of `APP_URL` and all of its subdomains. It is skipped in the `local` environment.

## Local development

Your laptop needs wildcard subdomains too, and `/etc/hosts` cannot do wildcards. [Local Laravel Subdomains with Laravel Herd](/blog/laravel-herd-subdomains.html) covers Herd, the alternatives and the common pitfalls.

## Frequently asked questions

### Should I store the full domain or only the subdomain?

It depends on the middleware. `InitializeTenancyByDomain` looks up the full host, `InitializeTenancyBySubdomain` looks up only the first part. Storing full hosts is the most explicit, and it keeps the door open for other domains later.

### Why do I get a 404 on my central domain?

Either a tenant route is being opened on a central host, which `PreventAccessFromCentralDomains` blocks on purpose, or your host is missing from `central_domains`. Check that `APP_DOMAIN` matches the host in the browser exactly.

### Can users stay logged in across tenant subdomains?

Only with a shared `SESSION_DOMAIN`, which is not recommended for multi-tenant apps. Each tenant should have its own session, and users sign in on each tenant separately.

### Can tenants also use their own custom domain?

Yes. Custom domains are just more rows in the `domains` table, identified by `InitializeTenancyByDomain` or `InitializeTenancyByDomainOrSubdomain`. The customer points their domain at your server, and you need a TLS certificate for each custom domain.

## How SaaS Laravel handles subdomains

In the [SaaS Laravel starter kits](/), `APP_DOMAIN` is the only central domain and tenant domains are always `<subdomain>.APP_DOMAIN`, stored as full hosts. A global middleware skips tenancy on the central domain and runs `InitializeTenancyByDomain` everywhere else, unknown hosts return a 404, and a `central.only` middleware keeps the central admin off tenant hosts. `SESSION_DOMAIN` stays `null`, and invitation and password-reset links are built from the tenant's primary domain. Each tenant can have several subdomains with their own app name, language and auth features. See [Domains](/docs/core/domains.html) and [Multi-tenancy](/docs/core/multi-tenancy.html).

<BlogPostCta title="Subdomain multi-tenancy, already wired up" text="SaaS Laravel identifies tenants by subdomain, keeps sessions per tenant and builds tenant links for you, with Vue, React or Svelte on the same Laravel backend." />
