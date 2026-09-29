---
title: "Custom Domains for Tenants in Laravel"
description: "Add a Laravel tenant custom domain the safe way: storing and verifying domains, customer DNS, TLS certificates on demand, sessions, passkeys and links."
pageClass: blog-page
date: 2026-09-29
author: erag
category: multi-tenancy
tags: [Multi-tenancy, Domains]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-tenant-custom-domains.html
  - - meta
    - property: og:title
      content: "Custom Domains for Tenants in Laravel"
  - - meta
    - property: og:description
      content: "Add a Laravel tenant custom domain the safe way: storing and verifying domains, customer DNS, TLS certificates on demand, sessions, passkeys and links."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-tenant-custom-domains.html
  - - meta
    - name: twitter:title
      content: "Custom Domains for Tenants in Laravel"
  - - meta
    - name: twitter:description
      content: "Add a Laravel tenant custom domain the safe way: storing and verifying domains, customer DNS, TLS certificates on demand, sessions, passkeys and links."
---

# Laravel Tenant Custom Domains: Letting Customers Bring Their Own Domain

<BlogPostMeta />

At some point a customer will ask to use `app.acme.com` instead of `acme.your-saas.com`. Supporting a **Laravel tenant custom domain** is a small change in Laravel itself. The real work sits around it: proving the customer owns the domain, telling them how to set up DNS, and getting a TLS certificate for a host you don't control.

We'll go through each step with [stancl/tenancy](https://tenancyforlaravel.com) version 3. We assume your tenants already work on subdomains, as set up in [Laravel Multi-Tenancy with Subdomains](/blog/laravel-multi-tenancy-subdomains.html). If you want the bigger architectural picture first, read [how to build a multi-tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## How a custom domain request reaches your app

Before any of your code runs, a request for a customer's domain passes through four layers:

```text
app.acme.com
  → customer's DNS: CNAME to domains.your-saas.com
  → your server accepts the connection
  → TLS: a certificate for app.acme.com must exist
  → Laravel: look up app.acme.com in the domains table → tenant "acme"
```

Laravel only handles the last one. Subdomains get away with one wildcard DNS record and one wildcard certificate. Custom domains need a DNS change on the customer's side and a certificate for each domain.

## Storing a Laravel tenant custom domain

stancl/tenancy supports this already. A custom domain is just another row in the `domains` table, and a tenant can have several:

```php
$tenant->domains()->create(['domain' => 'app.acme.com']);
```

The identification middleware you need depends on what you store:

| You store | Middleware |
| --- | --- |
| Full hosts for everything (`acme.your-saas.com`, `app.acme.com`) | `InitializeTenancyByDomain` |
| Short subdomains (`acme`) plus full custom hosts | `InitializeTenancyByDomainOrSubdomain` |

If you already store full hosts for subdomains, custom domains need no middleware change at all, which is one reason we store full hosts from the start. Don't add customer domains to `central_domains`. That list is only for your own hosts.

### Validate before you save

The domain is untrusted input, so clean it up first. Lowercase it and strip any scheme, path, port or trailing dot. Accept only valid host names, and reject IP addresses and `localhost`.

Then check it against your own setup. Reject your own domain and its subdomains, so nobody can claim `admin.your-saas.com`. It also has to be unique: stancl's `Domain` model throws `DomainOccupiedByOtherTenantException` when another tenant already has the domain, and you'll want to turn that into a validation error.

## Verify ownership before activation

The domain lookup matches **any** row in the `domains` table. So if you insert `app.acme.com` the moment someone types it, a tenant could claim a domain they don't own, and your server would start requesting certificates for it.

We keep new custom domains out of the `domains` table until they're verified. A separate table works well, or a `pending_domains` column on the tenant:

```php
Schema::create('pending_domains', function (Blueprint $table) {
    $table->id();
    $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
    $table->string('domain')->unique();
    $table->string('token');
    $table->timestamp('last_checked_at')->nullable();
    $table->timestamps();
});
```

Show the customer a TXT record to add, such as `_your-saas-verify.app.acme.com` with the token as its value. A scheduled job then checks it using PHP's `dns_get_record()`:

```php
public function isVerified(PendingDomain $pending): bool
{
    $records = dns_get_record('_your-saas-verify.'.$pending->domain, DNS_TXT) ?: [];

    return collect($records)->contains(
        fn (array $record) => hash_equals($pending->token, $record['txt'] ?? '')
    );
}
```

Once the check passes, create the real `domains` row and delete the pending one inside a transaction. From that point the domain resolves to the tenant.

## DNS records to give your customers

Customers need exact instructions, and there are two cases to cover:

| Customer wants | Record | Points to |
| --- | --- | --- |
| A subdomain, e.g. `app.acme.com` | `CNAME` | A host you control, e.g. `domains.your-saas.com` |
| The root domain, e.g. `acme.com` | `A` (and `AAAA` if you use IPv6) | Your server's IP address |

We recommend the `CNAME` route, because you can move servers by changing one record on your side. The DNS standard doesn't allow a `CNAME` on a root domain, so root domains need `A` records, or an `ALIAS`/`ANAME`-style record if the customer's DNS provider offers one. That's why most SaaS products steer customers towards a subdomain.

DNS changes can take a while to spread. Say so in your instructions, and re-check verification on a schedule rather than just once.

## TLS certificates for custom domains

Your wildcard certificate for `*.your-saas.com` doesn't cover `app.acme.com`. Every custom domain needs its own certificate, issued after the DNS points at you. You have three realistic ways to get one:

| Option | How it works | Good for |
| --- | --- | --- |
| On-demand TLS in the web server | The server requests a certificate during the first HTTPS handshake for a new host | Most self-hosted setups |
| A job per domain | After verification, a queued job runs your ACME client (for example certbot) and reloads the web server | Setups that must stay on nginx or Apache |
| A proxy or CDN with custom hostname support | The provider issues and renews certificates in front of your server | Teams that already use one |

### On-demand TLS with Caddy

The [Caddy](https://caddyserver.com) web server can issue certificates on demand. You have to restrict it, though, or anyone could point a domain at your server and make it request certificates. Caddy's `ask` option calls a URL with `?domain=` and only issues a certificate when the response is a `2xx`:

```text
{
    on_demand_tls {
        ask http://127.0.0.1:8080/internal/domain-check
    }
}

https:// {
    tls {
        on_demand
    }
    reverse_proxy 127.0.0.1:8080
}
```

The Laravel route behind it answers a single question: is this a verified domain?

```php
Route::get('/internal/domain-check', function (Request $request) {
    $known = Domain::where('domain', $request->string('domain')->lower()->toString())->exists();

    return response()->noContent($known ? 204 : 404);
});
```

Keep that route internal. It should only be reachable from the server itself and sit outside your tenant identification middleware. Since only verified domains live in the `domains` table, deleting a row also stops future renewals.

## Laravel settings that assume one domain

As far as the browser is concerned, a custom domain is a different site. A few Laravel settings quietly assume otherwise.

Sessions come first. Leave `SESSION_DOMAIN` empty. A user signed in on `acme.your-saas.com` is **not** signed in on `app.acme.com`, because each host has its own cookie. Pick one main domain per tenant and redirect the other to it.

Trusted hosts are next. If you enable `$middleware->trustHosts()`, the default trusts only `APP_URL` and its subdomains, so custom domains get rejected. Pass your own list or a callable, or validate hosts in the web server instead.

Passkeys are bound to their relying party ID, so passkeys registered on `acme.your-saas.com` won't work on `app.acme.com`. Our post on [passkeys in Laravel](/blog/laravel-passkeys.html) explains how the relying party is configured.

Links in emails and queued jobs need attention as well. `route()` uses the current host, and in a queue worker that's `APP_URL`. Store a primary domain per tenant and build tenant links from it.

Last, OAuth and webhooks. Redirect URIs registered with third parties usually have to match exactly, so keep those flows on your own domain.

## Removing or changing a domain

When a customer removes a domain or stops paying, delete the `domains` row. Identification stops straight away, and with on-demand TLS the next renewal is refused because the `ask` check fails.

If that domain was the tenant's main domain, switch to another one first. Otherwise emails and redirects keep pointing at a host that no longer works. For what happens to the rest of the tenant's data when the whole tenant goes, see [Deleting Tenants Safely in Laravel](/blog/delete-tenant-laravel-safely.html).

## Frequently asked questions

### Can a customer use their root domain?

Yes, but they'll need `A` records pointing at your IP address, or an `ALIAS`/`ANAME` record if their DNS provider supports one, because a root domain can't be a `CNAME`. If your IP address ever changes, every root-domain customer has to update their DNS. That's why we'd recommend a subdomain like `app.acme.com`.

### Do I need a separate certificate for every custom domain?

Yes. A wildcard certificate only covers your own domain. You issue one certificate per custom domain, either on demand in the web server, with a job that runs an ACME client, or through a proxy that manages custom hostnames.

### Can a tenant keep its subdomain after adding a custom domain?

Yes. A tenant can have several rows in the `domains` table, and they all identify the same tenant. Choose one as the main domain for links and redirect the others to it, so users don't end up signed in on two hosts.

### How do I stop someone from claiming a domain they don't own?

Only activate a domain after a DNS check proves control, for example a TXT record containing a random token. Until then, keep it out of the `domains` table so it can't identify a tenant or trigger a certificate.

## Custom domains and SaaS Laravel

The [SaaS Laravel starter kits](/) identify tenants by full host with `InitializeTenancyByDomain`. Each tenant can have several domains, with one primary domain and its own app name, language and authentication features. Those domains are always subdomains of `APP_DOMAIN`, though: `DomainService` appends the central domain to whatever you enter, so custom domains like `app.acme.com` aren't part of the kit. Because lookups already use full hosts, adding them comes down to your own validation, ownership verification and TLS setup, as described above. The [Domains documentation](/docs/core/domains.html) has the details.

<BlogPostCta title="Tenant subdomains with their own settings" text="SaaS Laravel gives each tenant one or more subdomains, each with its own app name, language and login options, on Vue, React or Svelte." />
