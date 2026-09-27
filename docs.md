---
title: "SaaS Laravel Documentation"
description: "Documentation for the SaaS Laravel starter kits: a multi-tenant Laravel 13 and Inertia v3 backend shared by the Vue, React and Svelte editions."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs.html
  - - meta
    - property: og:title
      content: "SaaS Laravel Documentation"
  - - meta
    - property: og:description
      content: "Documentation for the SaaS Laravel starter kits: a multi-tenant Laravel 13 and Inertia v3 backend shared by the Vue, React and Svelte editions."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs.html
  - - meta
    - name: twitter:title
      content: "SaaS Laravel Documentation"
  - - meta
    - name: twitter:description
      content: "Documentation for the SaaS Laravel starter kits: a multi-tenant Laravel 13 and Inertia v3 backend shared by the Vue, React and Svelte editions."
---

# Introduction

SaaS Laravel is a production-ready starting point for multi-tenant SaaS applications built on **Laravel 13**, **Inertia v3** and **Tailwind CSS v4**. It ships as three starter kits that share the same Laravel backend and differ only in the frontend:

| Kit | Frontend | UI components | Docs |
| --- | --- | --- | --- |
| <Badge type="tip" text="Vue" /> | Vue 3.5 (`<script setup>` + TypeScript) | shadcn-vue on Reka UI | [/docs/vue](/docs/vue) |
| <Badge type="tip" text="React" /> | React 19 + TypeScript | shadcn/ui on Radix UI | [/docs/react](/docs/react) |
| <Badge type="tip" text="Svelte" /> | Svelte 5 (runes) + TypeScript | shadcn-svelte on Bits UI | [/docs/svelte](/docs/svelte) |

Everything under `app/`, `Modules/`, `config/`, `database/`, `routes/`, `lang/` and `tests/` works the same way in every kit, so the **Core** section of these docs applies to all three. Only `resources/js` is framework-specific.

## What is included

- **Authentication** with Laravel Fortify: login, registration, password reset, email verification, password confirmation, two-factor authentication (TOTP + recovery codes), passkeys, profile and security settings, account deletion. See [Authentication](/docs/core/authentication).
- **Multi-tenancy** with `stancl/tenancy`: one database per tenant, identified by domain (`<sub>.APP_DOMAIN`). Tenant CRUD, workspace status (Active, Trial, Pending Invitation, Suspended), tenant admin invitations. See [Multi-tenancy](/docs/core/multi-tenancy).
- **Domains**: multiple subdomains per tenant, primary domain, per-domain app name, default language and authentication features. See [Domains](/docs/core/domains).
- **Maintenance mode** for all tenant workspaces with a custom message, secret bypass link and IP allow list. See [Maintenance & suspension](/docs/core/maintenance-and-suspension).
- **Users, roles and permissions** with `spatie/laravel-permission`: user management, invitations, per-user permissions, config-driven permission files. See [Users, roles & permissions](/docs/core/users-roles-permissions).
- **Navigation and layouts**: database-driven menus with drag and drop ordering, sidebar or header layout, three auth layouts, light/dark/system appearance. See [Navigation & layouts](/docs/core/navigation-and-layouts).
- **Localization**: 17 languages, per-user and per-domain language. See [Localization](/docs/core/localization).
- **Typed frontend**: Laravel Wayfinder route functions and TypeScript types generated from `spatie/laravel-data` classes.
- **Tooling**: Pest 5, Larastan, Pint, ESLint, Prettier and Laravel Boost AI guidelines and skills.

::: info No API layer
All routes are Inertia (web) routes. The kits do not ship an HTTP API, API tokens or billing.
:::

## Where to start

1. Check the [requirements](/docs/getting-started/requirements).
2. Get access to your kit repository: [Repository access](/docs/purchase/repository-access).
3. Follow [Installation](/docs/getting-started/installation), then [Local development](/docs/getting-started/local-development).
4. Read [Architecture](/docs/core/architecture) and [Project structure](/docs/getting-started/project-structure) before adding features.
5. Continue with the framework guide for your kit: [Vue](/docs/vue), [React](/docs/react) or [Svelte](/docs/svelte).

Pricing and purchase details are on the [pricing page](/pricing) and in [How to pay](/how-to-pay).
