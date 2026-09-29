---
title: "Laravel SaaS Project Structure"
description: "Folder layout of a SaaS Laravel kit: app, Modules, config, database, lang, resources/js and tests, plus how each module groups its code by layer."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/getting-started/project-structure.html
  - - meta
    - property: og:title
      content: "Laravel SaaS Project Structure"
  - - meta
    - property: og:description
      content: "Folder layout of a SaaS Laravel kit: app, Modules, config, database, lang, resources/js and tests, plus how each module groups its code by layer."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/getting-started/project-structure.html
  - - meta
    - name: twitter:title
      content: "Laravel SaaS Project Structure"
  - - meta
    - name: twitter:description
      content: "Folder layout of a SaaS Laravel kit: app, Modules, config, database, lang, resources/js and tests, plus how each module groups its code by layer."
---

# Project structure

## Kit layout

A kit is a standard Laravel app with one addition: features live in `Modules/` instead of being spread across `app/`. Why? See [Architecture → Why a module-based structure](/docs/core/architecture#why-a-module-based-structure). React and Svelte have the same backend folders as Vue; only `resources/js` differs (see the framework guides: [Vue](/docs/vue/architecture), [React](/docs/react/architecture), [Svelte](/docs/svelte/architecture)).

| Folder | What lives there |
| --- | --- |
| `app/` | Shared infrastructure: middleware, tenancy listeners, models, providers |
| `Modules/` | Feature modules (`Auth`, `Dashboard`, `Menu`, `RolePermission`, `Settings`, `Tenant`, `User`) |
| `bootstrap/` | `app.php` (middleware, aliases, error pages), `providers.php` (app and module providers) |
| `config/` | Laravel config plus `tenancy.php`, `fortify.php`, `inertia-lang.php` and the `permissions/` files |
| `database/` | Central migrations and seeders, with `tenant/` subfolders for tenant databases |
| `lang/` | 17 locales; kit strings in `lang/<locale>/modules/` |
| `resources/js/` | Inertia pages, components, layouts, generated types, translations and routes |
| `routes/` | `web.php` is empty; routes live in modules |
| `tests/` | Pest feature and unit tests |
| `.agents/`, `.claude/`, `.ai/`, `boost.json`, `AGENTS.md`, `CLAUDE.md` | Laravel Boost AI tooling |

::: details View the full directory tree (Vue kit)
```text
vue/
├── app/
│   ├── Concerns/                  # PasswordValidationRules, ProfileValidationRules
│   ├── Http/Middleware/           # HandleInertiaRequests, InitializeTenancyIfTenantDomain,
│   │                              # PreventAccessFromTenantDomains, TenancyAware* auth middleware
│   ├── Listeners/                 # ConfigureTenantAuth, RevertTenantAuth, ApplyTenantAppName, ...
│   ├── Models/                    # User, Tenant, Domain, Menu, LayoutSetting, Setting
│   ├── Providers/                 # AppServiceProvider, TenancyServiceProvider, TypeScriptTransformerServiceProvider
│   └── Support/TypeScriptTransformer/
├── Modules/                       # Feature modules (PSR-4 namespace Modules\)
│   ├── Auth/                      # Fortify actions + views
│   ├── Dashboard/                 # Home page + dashboard
│   ├── Menu/                      # DB-driven navigation
│   ├── RolePermission/            # Roles, permission config loader
│   ├── Settings/                  # Profile, security, language, layout
│   ├── Tenant/                    # Tenants, domains, maintenance, invitations
│   └── User/                      # User management + invitations
├── bootstrap/
│   ├── app.php                    # Middleware, aliases, error page rendering
│   └── providers.php              # App + module service providers
├── config/
│   ├── permissions/               # Central permission files (dashboard, menus, roles, settings, tenants, users)
│   │   └── tenant/                # Tenant permission files
│   ├── tenancy.php  fortify.php  auth.php  permission.php  inertia-lang.php  queue.php ...
├── database/
│   ├── migrations/                # Central database
│   │   └── tenant/                # Every tenant database
│   ├── seeders/                   # DatabaseSeeder, RoleSeeder, PermissionSeeder, MenuSeeder, DefaultUserSeeder
│   │   └── tenant/                # TenantDatabaseSeeder, tenant RoleSeeder, tenant MenuSeeder
│   └── factories/
├── lang/
│   └── <locale>/                  # 17 locales
│       ├── auth.php  pagination.php  passwords.php  validation.php
│       └── modules/               # auth, common, dashboard, domain, errors, home, layout,
│                                  # maintenance, menu, role, security, settings, tenant, user
├── resources/
│   ├── css/app.css
│   ├── views/app.blade.php        # Inertia root view
│   └── js/
│       ├── app.ts                 # createInertiaApp + default layouts
│       ├── pages/                 # Inertia pages (auth, errors, roles, settings, setup, tenants, users)
│       ├── components/            # App components, common/ form components, ui/ (shadcn)
│       ├── layouts/               # AppLayout, AuthLayout, app/, auth/, settings/
│       ├── composables/           # usePermission, useLanguage, useConfirmDialog, ...
│       ├── lib/                   # utils, flashToast
│       ├── lang/<locale>/         # Generated by erag:generate-lang
│       ├── types/                 # Hand-written types + generated Modules/* types
│       ├── actions/  routes/  wayfinder/   # Generated by Wayfinder (git-ignored)
├── routes/
│   ├── web.php                    # Empty: routes live in modules
│   ├── tenant.php                 # stancl sample tenant routes
│   └── console.php
├── tests/
│   ├── Feature/                   # Auth, Settings, Dashboard (+ Tenancy in React/Svelte)
│   ├── Unit/
│   ├── Pest.php  TestCase.php
├── .agents/skills  .claude/skills  .ai/rules  boost.json  AGENTS.md  CLAUDE.md   # Laravel Boost AI tooling
├── composer.json  package.json  vite.config.ts  phpstan.neon  pint.json  phpunit.xml
```
:::

## Inside a module

Each module is self-contained: it has its own routes, controllers, Data objects, services and enums, and registers its routes from its service provider (listed in `bootstrap/providers.php`). Adding a feature usually means adding a module, not touching `app/`.

`Modules/Tenant` is the most complete example:

| Folder | Contains | Examples |
| --- | --- | --- |
| `Data/` | spatie/laravel-data classes: validation (rules, attributes, messages) + TS types | `TenantRegisterData`, `DomainData` |
| `Enums/` | Option lists | `WorkspaceStatusEnum`, `IndustryEnum`, `TeamSizeEnum`, `WorkWeekEnum` |
| `Http/Controllers/` | Thin controllers: validate via Data, call a Service, render or redirect | `TenantController`, `DomainController` |
| `Http/Middleware/` | Request guards | `EnsureTenantIsNotSuspended`, `EnsureTenantIsNotInMaintenance`, `EnsureTenantAuthFeatureEnabled` |
| `Http/Requests/` | Form requests where a Data class is not used | `AcceptInvitationRequest` |
| `Jobs/` | Queueable jobs | `CreateTenantUserJob` |
| `Listeners/` | Tenancy event listeners | `ApplyTenantFortifyFeatures`, `RestoreCentralFortifyFeatures` |
| `Notifications/` | Emails | `TenantInvitationNotification`, `TenantPasswordResetNotification` |
| `Providers/` | Module service provider | `TenantServiceProvider` |
| `Repositories/` | Complex queries | `TenantRepository`, `DomainRepository` |
| `Rules/` | Validation rules | `IpAddressOrCidr`, `UniqueTenantDomain` |
| `Services/` | Business logic | `TenantService`, `DomainService`, `TenantMaintenanceService`, `TenantAuthFeatureService` |
| `routes/web.php` | Central routes | Tenants, domains, tenant settings |
| `routes/tenant.php` | Tenant-only routes | Invitation accept, maintenance bypass |

See [Architecture](/docs/core/architecture) for how requests flow through these pieces.

## Frontend naming per kit

| | <Badge type="tip" text="Vue" /> | <Badge type="tip" text="React" /> | <Badge type="tip" text="Svelte" /> |
| --- | --- | --- | --- |
| Pages | `pages/tenants/Index.vue` | `pages/tenants/index.tsx` | `pages/tenants/Index.svelte` |
| Shared logic | `composables/usePermission.ts` | `hooks/use-permission.ts` | `lib/permission.ts` |
| Type check | `vue-tsc` | `tsc` | `svelte-check` |
