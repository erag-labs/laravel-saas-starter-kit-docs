---
title: "Modular Laravel Architecture for SaaS"
description: "A practical guide to Laravel modular architecture for SaaS: feature modules, service providers that load routes, one-way dependencies and adding a module."
pageClass: blog-page
date: 2026-09-29
author: erag
category: architecture
tags: [Architecture, Code quality]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/modular-laravel-architecture.html
  - - meta
    - property: og:title
      content: "Modular Laravel Architecture for SaaS"
  - - meta
    - property: og:description
      content: "A practical guide to Laravel modular architecture for SaaS: feature modules, service providers that load routes, one-way dependencies and adding a module."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/modular-laravel-architecture.html
  - - meta
    - name: twitter:title
      content: "Modular Laravel Architecture for SaaS"
  - - meta
    - name: twitter:description
      content: "A practical guide to Laravel modular architecture for SaaS: feature modules, service providers that load routes, one-way dependencies and adding a module."
---

# Laravel Modular Architecture: Organising a SaaS by Feature

<BlogPostMeta />

A **Laravel modular architecture** groups your code by feature instead of by type. Instead of one big `app/Http/Controllers` folder and one big `app/Services` folder, each feature — tenants, users, settings — gets its own folder with its own routes, controllers, services and service provider.

For a small app, Laravel's default layout is perfect. For a SaaS product that keeps growing, organising by feature is often what keeps the codebase readable. This guide explains why, what a module looks like, how to keep modules from tangling into each other, when not to bother, and how to add a new module step by step.

## Why the default app/ folder gets hard to manage

Laravel's default structure groups files by what they *are*: controllers in one place, form requests in another, jobs, notifications and services somewhere else. That works well while the app is small.

A SaaS application is rarely small for long. Tenants, domains, authentication, roles and permissions, invitations, settings, menus and maintenance mode all live in the same codebase. After a while:

- `app/Http/Controllers` holds dozens of unrelated controllers.
- Changing one feature means opening five or six folders to find all of its pieces.
- It's hard to tell which classes belong together — or which ones are safe to delete.
- Two developers working on different features still touch the same folders and collide.

The problem isn't Laravel. It's that "grouped by type" stops telling you anything useful once there are many features.

## What a Laravel modular architecture looks like

In a modular Laravel app, each feature lives in `Modules/<Feature>` and every module follows the same layout. Here is the `Tenant` module from the SaaS Laravel kits, slightly shortened:

```text
Modules/Tenant/
├── Data/            TenantRegisterData, DomainData, ...
├── Enums/           WorkspaceStatusEnum, IndustryEnum, ...
├── Http/
│   ├── Controllers/ TenantController, DomainController, ...
│   ├── Middleware/  EnsureTenantIsNotSuspended, ...
│   └── Requests/    AcceptInvitationRequest, ...
├── Jobs/            CreateTenantUserJob
├── Notifications/   TenantInvitationNotification, ...
├── Providers/       TenantServiceProvider
├── Repositories/    TenantRepository, DomainRepository
├── Services/        TenantService, DomainService, ...
└── routes/          web.php, tenant.php
```

To understand tenants, you open one folder. Smaller modules only have the folders they need — `Modules/Dashboard` is just a controller, a service provider and a routes file.

### Autoloading with PSR-4

No package is required. A single PSR-4 entry in `composer.json` maps the `Modules\` namespace to the `Modules/` folder:

```json
"autoload": {
    "psr-4": {
        "App\\": "app/",
        "Modules\\": "Modules/"
    }
}
```

Run `composer dump-autoload` once after adding the mapping. From then on, a class like `Modules\Tenant\Services\TenantService` in `Modules/Tenant/Services/TenantService.php` loads like any other class.

### What stays in app/

Modules don't have to own everything. Shared infrastructure can stay where Laravel expects it. In the kits, the Eloquent models (`User`, `Tenant`, `Domain`, `Menu` and friends) live in `app/Models`, tenancy middleware and listeners live in `app/`, and migrations stay in `database/migrations`. Modules contain the feature logic around them.

## How module service providers load routes

Each module has a service provider that registers its routes. This is the provider from `Modules/Dashboard`, without its imports and empty `register()` method:

```php
class DashboardServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->registerRoutes();
    }

    protected function registerRoutes(): void
    {
        Route::middleware('web')
            ->group(__DIR__.'/../routes/web.php');
    }
}
```

Every module provider is listed in `bootstrap/providers.php`, next to the app's own providers. Because modules load their own routes, the kits' `routes/web.php` is intentionally empty.

A provider can load more than one file. `TenantServiceProvider` loads both `routes/web.php` (central routes) and `routes/tenant.php` (tenant-only routes), and uses `register()` to bind `TenantAuthFeatureService` as a singleton. Anything a module needs to set up — bindings, event listeners, route files — belongs in its own provider.

Route caching works exactly as before: `php artisan route:cache` caches every route that was registered, no matter which provider registered it.

## Keeping modules loosely coupled

Folders alone don't make an architecture. If every module reaches into every other module, you've just moved the mess. Three rules keep modules independent:

1. **Most modules depend on nothing.** A feature should work without knowing other features exist.
2. **When a module needs another one, it uses that module's public pieces** — its services, enums and Data objects — never its internal details or tables.
3. **Dependencies point one way**, towards a small number of foundation modules. Foundation modules never depend on feature modules, so there are no circular dependencies.

This is the real dependency map of the kits' seven modules:

```text
Auth, Dashboard, RolePermission, Settings  →  no module dependencies
Menu                                       →  Settings (layout settings)
Tenant                                     →  RolePermission (tenant admin role), Settings (languages)
User                                       →  RolePermission (roles and permissions)
```

For example, the `User` module's `UserService` receives `PermissionService` from `RolePermission` through its constructor. It never queries permission tables itself.

You can check a module's dependencies with a quick search:

```bash
grep -rn "use Modules\\\\" Modules/User | grep -v "Modules\\\\User"
```

If you want to enforce the rules automatically, Pest's architecture tests can do it — for example, asserting that `Modules\RolePermission` does not use `Modules\User`.

::: tip Foundation modules stay small
The fewer things a foundation module does, the fewer reasons other modules have to change when it changes. Resist adding feature logic to `Settings` or `RolePermission` just because everything already depends on them.
:::

## When not to modularise

A modular Laravel architecture is not free. It adds folders, providers and decisions about where things belong. Skip it when:

| Situation | Better choice |
| --- | --- |
| A prototype or proof of concept | Default Laravel structure — you may throw it away |
| A small app with a handful of controllers | Default structure; modules add more folders than features |
| One developer, one feature area | Default structure, maybe with a `Services` folder |
| A growing product with many features and a team | Feature modules |

You can also start with the default layout and move to modules later. Because PSR-4 and service providers are plain Laravel, the move is mostly renaming namespaces and moving files — not rewriting logic.

## Step by step: adding a new module

Say you want a `Project` feature. Here's how to add it as a module.

**1. Create the folders.** Start with what you need: `Modules/Project/Http/Controllers`, `Providers`, `Services`, `Data` and `routes`. Add `Enums`, `Jobs` or `Repositories` later if the feature grows.

**2. Add a service provider** at `Modules/Project/Providers/ProjectServiceProvider.php` with the same `registerRoutes()` method as the Dashboard example above.

**3. Register it** in `bootstrap/providers.php`:

```php
use Modules\Project\Providers\ProjectServiceProvider;

return [
    // ...existing providers
    ProjectServiceProvider::class,
];
```

**4. Add routes** in `Modules/Project/routes/web.php`, with the middleware the feature needs:

```php
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
});
```

**5. Keep the controller thin.** Validate with a Data object or form request, call a service, return a response. Business logic and database transactions go in `ProjectService`:

```php
public function store(ProjectData $data): RedirectResponse
{
    $this->projectService->create($data);

    return to_route('projects.index');
}
```

**6. Depend in one direction only.** If projects need permissions, inject `RolePermission`'s services — and never make `RolePermission` depend on `Project`.

**7. Regenerate the frontend helpers.** If you use typed routes, regenerate them so the frontend can call the new endpoints. See [Typed Routes with Laravel Wayfinder](/blog/laravel-wayfinder-typed-routes.html).

## Frequently asked questions

### Do I need a package to build Laravel modules?

No. A PSR-4 entry in `composer.json` and a service provider per module is all it takes. Module packages add generators and extra conventions, which some teams like, but they are optional.

### Where do models and migrations go in a modular Laravel app?

Either works. Some teams put models inside each module. Others keep shared models in `app/Models` and migrations in `database/migrations`, because many features use the same models — that's the approach the SaaS Laravel kits take.

### Does a modular structure make Laravel slower?

Not in any meaningful way. Classes are still autoloaded on demand, providers do very little work, and route and config caching behave the same as in a default app.

### Can a module have its own frontend pages?

With Inertia, pages usually stay in `resources/js/pages`, grouped by feature (for example `pages/tenants`). The module owns the backend; the page folder mirrors it on the frontend.

## How SaaS Laravel handles this

The [SaaS Laravel kits](/) ship with this structure already in place: seven modules (`Auth`, `Dashboard`, `Menu`, `RolePermission`, `Settings`, `Tenant` and `User`), each registered through its own service provider in `bootstrap/providers.php`, with an empty `routes/web.php` and one-way dependencies towards `RolePermission` and `Settings`. The same backend is shared by the Vue, React and Svelte kits. Read the details in the [architecture documentation](/docs/core/architecture.html) and the [project structure guide](/docs/getting-started/project-structure.html), or see how it fits into the bigger picture in our [Laravel SaaS starter kit guide](/blog/laravel-saas-starter-kit.html).

<BlogPostCta title="Start with a structure that scales" text="SaaS Laravel gives you a module-based Laravel backend with thin controllers, services and Data objects — plus multi-tenancy, authentication and permissions already built." />
