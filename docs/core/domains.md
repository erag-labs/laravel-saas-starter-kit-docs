---
title: "Tenant Domains & Per-Domain Settings"
description: "Tenant subdomains, primary and secondary domains, and per-domain settings: app name, default language and which authentication features are enabled."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/core/domains.html
  - - meta
    - property: og:title
      content: "Tenant Domains & Per-Domain Settings"
  - - meta
    - property: og:description
      content: "Tenant subdomains, primary and secondary domains, and per-domain settings: app name, default language and which authentication features are enabled."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/core/domains.html
  - - meta
    - name: twitter:title
      content: "Tenant Domains & Per-Domain Settings"
  - - meta
    - name: twitter:description
      content: "Tenant subdomains, primary and secondary domains, and per-domain settings: app name, default language and which authentication features are enabled."
---

# Domains

A domain is how a request finds its tenant. Each tenant has one or more domains, stored in the central `domains` table (`App\Models\Domain`), and every domain also carries its own branding, language and auth settings.

```text
acme.vue.test  → domains table → tenant 1 → per-domain App name, language, auth features
```

## Domain format

Domains are **subdomains of `APP_DOMAIN`**. You enter only the subdomain; the kit appends the central domain:

```text
input: acme      → stored: acme.vue.test
input: acme-eu   → stored: acme-eu.vue.test
```

| Rule | Value |
| --- | --- |
| Characters | Lowercase letters, digits and single hyphens (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) |
| Length | Max 63 characters |
| Uniqueness | Unique across all tenants (`UniqueTenantDomain` rule) |
| Validated by | `TenantRegisterData` (new tenant), `DomainData` (extra domain) |

::: info Custom top-level domains
`DomainService::createDomain()` always builds `<sub>.APP_DOMAIN`. Mapping fully custom domains (e.g. `app.customer.com`) is not part of the kit.
:::

## Domains page

`/tenants/domains` lists all domains of all tenants. It is central only and needs `View Tenants`.

- Paginated, with stats cards
- Search by domain or tenant, filter by **primary** / **secondary**
- Add, set primary, delete, settings and authentication features (require `Manage Tenant Domains`)

The same actions are available per tenant on the tenant detail page.

| Action | Route |
| --- | --- |
| Add domain | `POST /tenants/domains` |
| Set primary | `PATCH /tenants/domains/{domain}/primary` |
| Delete | `DELETE /tenants/domains/{domain}` |
| Settings (App name, language) | `PUT /tenants/domains/{domain}/settings` |
| Authentication features | `PUT /tenants/domains/{domain}/auth-features` |

## Primary domain

Each tenant has exactly one primary domain. Invitation links and tenant links use it.

- The first domain of a tenant is always primary. Adding a domain with **primary** checked moves the flag.
- The primary domain **cannot be deleted**. Make another domain primary first.

## Per-domain settings

Each domain can override three settings. They are stored as columns on `domains` and validated by `Modules\Tenant\Data\DomainSettingsData` (auth features by their own request).

| Setting | Column | Effect |
| --- | --- | --- |
| App name | `app_name` (max 100 chars) | Brand shown in the sidebar, auth pages, page titles and emails sent on that domain |
| Default language | `locale` | Default language for users on that domain who have not picked one |
| Authentication features | `auth_features` (JSON) | Turns Fortify features on or off for that domain only |

### App name

When tenancy starts, `App\Listeners\ApplyTenantAppName` sets `config('app.name')` to the first value that exists:

```text
domain app_name → tenant company → central APP_NAME
```

### Default language

One of the 17 `LanguageEnum` values, or empty to use the app default. See [Localization](/docs/core/localization#how-the-locale-is-resolved).

### Authentication features

Registration, password reset, email verification, two-factor and passkeys can be switched off per domain. See [Authentication → Per-domain features](/docs/core/authentication#per-domain-features).

## Local DNS

Every tenant domain must resolve to your app.

| Environment | Setup |
| --- | --- |
| Local with Herd | All `*.vue.test` subdomains work automatically once the site is linked |
| Production | A wildcard DNS record (`*.your-domain.com`) plus a wildcard virtual host and TLS certificate |
