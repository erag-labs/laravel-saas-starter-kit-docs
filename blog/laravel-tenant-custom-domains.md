---
title: "Custom Domains for Tenants in Laravel"
description: "Add a Laravel tenant custom domain the safe way: storing and verifying domains, customer DNS, TLS certificates on demand, sessions, passkeys and links."
pageClass: blog-page
date: 2026-09-29
author: erag
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

Sooner or later a customer asks to use `app.acme.com` instead of `acme.your-saas.com`. Supporting a **Laravel tenant custom domain** is only a small change in Laravel itself; most of the work is around it: proving the customer owns the domain, telling them how to set up DNS, and getting a TLS certificate for a host you do not control.

This guide covers each step with [stancl/tenancy](https://tenancyforlaravel.com) version 3. It assumes your tenants already work on subdomains, as described in [Laravel Multi-Tenancy with Subdomains](/blog/laravel-multi-tenancy-subdomains.html). For the overall architecture, see [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## How a custom domain request reaches your app

A request for a customer's domain passes through four layers before your code runs:

```text
app.acme.com
  → customer's DNS: CNAME to domains.your-saas.com
  → your server accepts the connection
  → TLS: a certificate for app.acme.com must exist
  → Laravel: look up app.acme.com in the domains table → tenant "acme"
```

Only the last step is Laravel. Subdomains get away with one wildcard DNS record and one wildcard certificate. Custom domains need a DNS change by the customer and a certificate per domain.

## Storing a Laravel tenant custom domain

stancl/tenancy already supports this. A custom domain is just another row in the `domains` table, and a tenant can have several:

```php
$tenant->domains()->create(['domain' => 'app.acme.com']);
```

Which identification middleware you need depends on what you store:

| You store | Middleware |
| --- | --- |
| Full hosts for everything (`acme.your-saas.com`, `app.acme.com`) | `InitializeTenancyByDomain` |
| Short subdomains (`acme`) plus full custom hosts | `InitializeTenancyByDomainOrSubdomain` |

If you already store full hosts for subdomains, custom domains need no middleware change at all. Do not add customer domains to `central_domains`; that list is only for your own hosts.

### Validate before you save

Treat the domain as untrusted input:

- Lowercase it and strip any scheme, path, port or trailing dot.
- Accept only valid host names; reject IP addresses and `localhost`.
- Reject your own domain and its subdomains, so nobody can claim `admin.your-saas.com`.
- Keep it unique. stancl's `Domain` model throws `DomainOccupiedByOtherTenantException` when another tenant already has the domain; turn it into a validation error.

## Verify ownership before activation

The domain lookup matches **any** row in the `domains` table. If you insert `app.acme.com` as soon as someone types it, a tenant could claim a domain they do not own, and your server would start requesting certificates for it.

Keep new custom domains out of the `domains` table until they are verified. A separate table, or a `pending_domains` column on the tenant, works well:

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

Show the customer a TXT record to add, such as `_your-saas-verify.app.acme.com` with the token as its value. A scheduled job checks it with PHP's `dns_get_record()`:

```php
public function isVerified(PendingDomain $pending): bool
{
    $records = dns_get_record('_your-saas-verify.'.$pending->domain, DNS_TXT) ?: [];

    return collect($records)->contains(
        fn (array $record) => hash_equals($pending->token, $record['txt'] ?? '')
    );
}
```

When the check passes, create the real `domains` row and delete the pending one in a transaction. From then on the domain resolves to the tenant.

## The DNS your customers need to add

Give customers exact instructions. There are two cases:

| Customer wants | Record | Points to |
| --- | --- | --- |
| A subdomain, e.g. `app.acme.com` | `CNAME` | A host you control, e.g. `domains.your-saas.com` |
| The root domain, e.g. `acme.com` | `A` (and `AAAA` if you use IPv6) | Your server's IP address |

A `CNAME` is better because you can move servers by changing one record on your side. The DNS standard does not allow a `CNAME` on a root domain, so root domains need `A` records, or an `ALIAS`/`ANAME`-style record if the customer's DNS provider offers one. That is why most SaaS products recommend a subdomain.

DNS changes can take a while to spread. Tell customers that, and re-check verification on a schedule instead of once.

## TLS certificates for custom domains

Your wildcard certificate for `*.your-saas.com` does not cover `app.acme.com`. Every custom domain needs its own certificate, issued after the DNS points at you.

| Option | How it works | Good for |
| --- | --- | --- |
| On-demand TLS in the web server | The server requests a certificate during the first HTTPS handshake for a new host | Most self-hosted setups |
| A job per domain | After verification, a queued job runs your ACME client (for example certbot) and reloads the web server | Setups that must stay on nginx or Apache |
| A proxy or CDN with custom hostname support | The provider issues and renews certificates in front of your server | Teams that already use one |

### On-demand TLS with Caddy

The [Caddy](https://caddyserver.com) web server can issue certificates on demand. You must restrict it, or anyone could point a domain at your server and make it request certificates. Caddy's `ask` option calls a URL with `?domain=` and only issues a certificate when the response is a `2xx`:

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

The Laravel route behind it answers one question: is this a verified domain?

```php
Route::get('/internal/domain-check', function (Request $request) {
    $known = Domain::where('domain', $request->string('domain')->lower()->toString())->exists();

    return response()->noContent($known ? 204 : 404);
});
```

Keep that route internal: only reachable from the server itself, and outside your tenant identification middleware. Because only verified domains are in the `domains` table, deleting a row also stops future renewals.

## Laravel settings that assume one domain

A custom domain is a different site as far as the browser is concerned. Check these:

- **Sessions.** Leave `SESSION_DOMAIN` empty. A user signed in on `acme.your-saas.com` is **not** signed in on `app.acme.com`; each host has its own cookie. Pick one main domain per tenant and redirect the other to it.
- **Trusted hosts.** If you enable `$middleware->trustHosts()`, the default trusts only `APP_URL` and its subdomains, so custom domains are rejected. Pass your own list or a callable, or validate hosts in the web server instead.
- **Passkeys.** A passkey is bound to its relying party ID. Passkeys registered on `acme.your-saas.com` do not work on `app.acme.com`. See [Passkeys in Laravel](/blog/laravel-passkeys.html) for how the relying party is configured.
- **Links in emails and queued jobs.** `route()` uses the current host, and in a queue worker that is `APP_URL`. Store a primary domain per tenant and build tenant links from it.
- **OAuth and webhooks.** Redirect URIs registered with third parties usually have to be exact. Keep those flows on your own domain.

## Removing or changing a domain

When a customer removes a domain or stops paying, delete the `domains` row. Identification stops immediately, and with on-demand TLS the next renewal is refused because the `ask` check fails.

If the domain was the tenant's main domain, switch to another one first. Otherwise emails and redirects keep pointing at a host that no longer works. What happens to the rest of the tenant's data when the whole tenant goes is covered in [Deleting Tenants Safely in Laravel](/blog/delete-tenant-laravel-safely.html).

## Frequently asked questions

### Can a customer use their root domain?

Yes, but they need `A` records pointing at your IP address, or an `ALIAS`/`ANAME` record if their DNS provider supports it, because a root domain cannot be a `CNAME`. If your IP address ever changes, every root-domain customer has to update DNS, so recommend a subdomain like `app.acme.com`.

### Do I need a separate certificate for every custom domain?

Yes. A wildcard certificate only covers your own domain. Issue one certificate per custom domain, either on demand in the web server, with a job that runs an ACME client, or through a proxy that manages custom hostnames.

### Can a tenant keep its subdomain after adding a custom domain?

Yes. A tenant can have several rows in the `domains` table, and all of them identify the same tenant. Choose one as the main domain for links and redirect the others to it, so users do not end up signed in on two hosts.

### How do I stop someone from claiming a domain they do not own?

Only activate a domain after a DNS check proves control, for example a TXT record with a random token. Until then, keep it out of the `domains` table so it cannot identify a tenant or trigger a certificate.

## Custom domains and SaaS Laravel

The [SaaS Laravel starter kits](/) identify tenants by full host with `InitializeTenancyByDomain`, and each tenant can have several domains with one primary domain and its own app name, language and authentication features. Those domains are always subdomains of `APP_DOMAIN`: `DomainService` appends the central domain to what you enter, so custom domains like `app.acme.com` are not part of the kit. Because lookups already use full hosts, adding them means adding your own validation, ownership verification and TLS setup as described above. See the [Domains documentation](/docs/core/domains.html).

<BlogPostCta title="Tenant subdomains with their own settings" text="SaaS Laravel gives each tenant one or more subdomains, each with its own app name, language and login options, on Vue, React or Svelte." />
