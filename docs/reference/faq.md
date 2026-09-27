---
title: "SaaS Laravel Starter Kits FAQ"
description: "Answers to common questions about the SaaS Laravel starter kits: kit differences, features, pricing, repository access, updates and development."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/reference/faq.html
  - - meta
    - property: og:title
      content: "SaaS Laravel Starter Kits FAQ"
  - - meta
    - property: og:description
      content: "Answers to common questions about the SaaS Laravel starter kits: kit differences, features, pricing, repository access, updates and development."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/reference/faq.html
  - - meta
    - name: twitter:title
      content: "SaaS Laravel Starter Kits FAQ"
  - - meta
    - name: twitter:description
      content: "Answers to common questions about the SaaS Laravel starter kits: kit differences, features, pricing, repository access, updates and development."
---

# FAQ

## Product

### What is the difference between the Vue, React and Svelte kits?

Only the frontend (`resources/js`). The Laravel backend (modules, tenancy, auth, permissions, migrations, translations, tests) is the same. Pick the frontend your team prefers. See [Introduction](/docs).

### Is there a billing / Stripe integration?

No. The kits do not include billing, subscriptions or payment processing for your customers.

### Is there a REST API?

No. All routes are Inertia web routes. There are no API tokens (Sanctum) or API endpoints.

### Does it support teams?

Not as a feature. Each tenant is a separate workspace with its own users; spatie's teams mode is disabled in `config/permission.php`.

### Can tenants use their own custom domains?

Out of the box, tenant domains are subdomains of `APP_DOMAIN` (`acme.your-domain.com`). A tenant can have several subdomains and one primary. See [Domains](/docs/core/domains).

### Single database or one database per tenant?

One database per tenant (stancl/tenancy multi-database mode). See [Multi-tenancy](/docs/core/multi-tenancy).

### Which languages are included?

17: English, Hindi, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Turkish, Dutch, Indonesian, Bengali, Polish, Vietnamese and Thai. See [Localization](/docs/core/localization).

### Is SSR enabled?

No. A `build:ssr` npm script exists, but the kits run as client-rendered Inertia apps by default.

### Do I have to use Laravel Herd?

No, but it is the easiest option because tenant subdomains (`*.vue.test`) work automatically. Any setup that serves the central domain and its wildcard subdomains works. See [Requirements](/docs/getting-started/requirements).

### Can I use SQLite or PostgreSQL?

`config/tenancy.php` registers database managers for SQLite, MySQL, MariaDB and PostgreSQL, and the test suite runs on in-memory SQLite. The kits are built and run against MySQL, which is the recommended choice.

## Purchase and access

### How much does it cost?

Each kit is $29 and the All Starter Kits bundle (Vue + React + Svelte) is $79. Both are one-time payments with lifetime access. See [Pricing](/pricing).

### Is it a subscription?

No. You pay once and get lifetime access with weekly updates.

### How do I pay?

Through GitHub Sponsors. See [How to pay](/how-to-pay).

### How quickly do I get access?

Immediately. Access is granted automatically: your GitHub account is invited to the repository as soon as the payment goes through. See [Repository access](/docs/purchase/repository-access).

### What does the bundle include?

Access to all three kit repositories (Vue, React and Svelte).

### How do I get updates?

Updates are pushed weekly to your kit repository. Add it as the `upstream` remote and merge. See [Updates](/docs/purchase/updates).

### Where do I get help?

Open an issue on your kit's GitHub repository. Check [Troubleshooting](/docs/reference/troubleshooting) first.

## Development

### Where do I add a new feature?

Create a new module in `Modules/<Name>/` with its own service provider, routes, controllers, Data classes and services, and register the provider in `bootstrap/providers.php`. Add pages in `resources/js/pages`. See [Architecture](/docs/core/architecture).

### How do I add a page that only tenants see?

1. Add the route in a module and protect it with `auth` and a tenant permission from `config/permissions/tenant/*.php`.
2. Add a menu entry to `Database\Seeders\tenant\MenuSeeder`.
3. For strictly tenant-only routes, add stancl's `PreventAccessFromCentralDomains` middleware.

### What are the default logins?

One user per role, all with the password `password`:

| Role | Email |
| --- | --- |
| Super Admin | `super-admin@gmail.com` |
| Admin | `admin@gmail.com` |
| Manager | `manager@gmail.com` |
| Employee | `employee@gmail.com` |
| User | `user@gmail.com` |

They are created by `DefaultUserSeeder` centrally and in every new tenant.

::: warning
Change or remove the default users before going to production.
:::

### Do the kits work with AI coding agents?

Yes. Each kit ships Laravel Boost guidelines (`AGENTS.md`, `CLAUDE.md`), skills in `.agents/skills` and `.claude/skills`, and an MCP configuration (`.mcp.json`). The Vue kit also has project rules in `.ai/rules`.
