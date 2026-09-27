---
title: "Vue Kit Development Workflow"
description: "Daily commands for the Vue kit and step-by-step guides to adding a page and a form, plus type checking with vue-tsc and linting with ESLint and Prettier."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/vue/development.html
  - - meta
    - property: og:title
      content: "Vue Kit Development Workflow"
  - - meta
    - property: og:description
      content: "Daily commands for the Vue kit and step-by-step guides to adding a page and a form, plus type checking with vue-tsc and linting with ESLint and Prettier."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/vue/development.html
  - - meta
    - name: twitter:title
      content: "Vue Kit Development Workflow"
  - - meta
    - name: twitter:description
      content: "Daily commands for the Vue kit and step-by-step guides to adding a page and a form, plus type checking with vue-tsc and linting with ESLint and Prettier."
---

# Development <Badge type="tip" text="Vue" />

## Daily workflow

| Command | What it does |
| --- | --- |
| `composer dev` | Runs `php artisan dev`: Laravel server, queue listener, Pail logs and Vite together |
| `npm run dev` | Vite dev server with HMR (also regenerates Wayfinder files) |
| `npm run build` | Production build to `public/build` |
| `npm run build:ssr` | Client and SSR bundle (`vite build && vite build --ssr`) |
| `npm run lint` | `eslint .` + `prettier --check resources/` + `vue-tsc --noEmit` |
| `npm run lint:fix` | `eslint . --fix` + `prettier --write resources/` + `vue-tsc --noEmit` |
| `composer lint` | Pint, `wayfinder:generate --with-form`, `typescript:transform`, `npm run lint:fix` |
| `composer test` | Lint check, PHPStan (Larastan), then `php artisan test` |
| `php artisan erag:generate-lang` | Export `lang/*` to `resources/js/lang/*.json` |

All commands are listed in [Commands](/docs/reference/commands).

::: tip
A change doesn't show up in the browser? Check that `npm run dev` (or `composer dev`) is running, or run `npm run build`.
:::

## Adding a page

Example: a **Reports** page in the Dashboard module at `/reports`.

```text
Modules/Dashboard/routes/web.php → ReportController@index
  → Inertia::render('reports/Index') → resources/js/pages/reports/Index.vue
```

1. **Route.** Add it to `Modules/Dashboard/routes/web.php` inside the `auth` + `verified` group, with `->middleware('permission:View Reports|View Tenant Reports')` and `->name('reports.index')`.
2. **Controller.** Create `Modules/Dashboard/Http/Controllers/ReportController.php`. Keep it thin: business logic goes in `Modules/<Module>/Services`. Return `Inertia::render('reports/Index', [...])`.
3. **Page.** Create `resources/js/pages/reports/Index.vue` (PascalCase file, lowercase folder). Set breadcrumbs with `defineOptions({ layout: { breadcrumbs } })` and the title with `<Head>`.
4. **Wayfinder.** `@/routes/reports` appears once Wayfinder runs. `npm run dev` regenerates it; otherwise run `php artisan wayfinder:generate --with-form`.
5. **Translations.** Add the keys to `lang/<locale>/modules/dashboard.php` for every locale, then run `php artisan erag:generate-lang`.
6. **Permission.** Add `View Reports` to `config/permissions/dashboard.php` and `View Tenant Reports` to `config/permissions/tenant/dashboard.php`, then seed them.
7. **Menu (optional).** Add an entry to `database/seeders/MenuSeeder.php` (and `database/seeders/tenant/MenuSeeder.php`) with `'route_name' => 'reports.index'` and the permission.

The page itself stays small:

```vue
<script setup lang="ts">
defineOptions({
    layout: {
        breadcrumbs: [{ title: 'modules.dashboard.reports.title', href: index() }],
    },
});

defineProps<{ reports: { id: number; name: string }[] }>();

const { __ } = vueLang();
</script>
```

::: details View route and controller
```php
// Modules/Dashboard/routes/web.php
use Modules\Dashboard\Http\Controllers\ReportController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('reports', [ReportController::class, 'index'])
        ->middleware('permission:View Reports|View Tenant Reports')
        ->name('reports.index');
});
```

```php
// Modules/Dashboard/Http/Controllers/ReportController.php
namespace Modules\Dashboard\Http\Controllers;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('reports/Index', [
            'reports' => [],
        ]);
    }
}
```
:::

::: details View full page
```vue
<script setup lang="ts">
import { vueLang } from '@erag/lang-sync-inertia/vue';
import { Head } from '@inertiajs/vue3';
import Heading from '@/components/Heading.vue';
import { dashboard } from '@/routes';
import { index } from '@/routes/reports';

defineOptions({
    layout: {
        breadcrumbs: [
            { title: 'modules.common.nav.dashboard', href: dashboard() },
            { title: 'modules.dashboard.reports.title', href: index() },
        ],
    },
});

defineProps<{
    reports: { id: number; name: string }[];
}>();

const { __ } = vueLang();
</script>

<template>
    <Head :title="__('modules.dashboard.reports.title')" />

    <div class="space-y-6 px-4 py-6">
        <Heading
            :title="__('modules.dashboard.reports.title')"
            :description="__('modules.dashboard.reports.description')"
        />
    </div>
</template>
```
:::

::: details View translations, permissions and seeding
```php
// lang/en/modules/dashboard.php (repeat for every locale)
'reports' => [
    'title' => 'Reports',
    'description' => 'Exported analytics reports.',
],
```

```php
// config/permissions/dashboard.php
[
    'permission_name' => 'View Reports',
    'associated_roles' => ['Super Admin', 'Admin'],
],

// config/permissions/tenant/dashboard.php
[
    'permission_name' => 'View Tenant Reports',
    'associated_roles' => ['Super Admin', 'Admin'],
],
```

```bash
php artisan erag:generate-lang
php artisan db:seed --class=PermissionSeeder
php artisan tenants:seed --class="Database\Seeders\PermissionSeeder"
php artisan db:seed --class=MenuSeeder
```

- The keys are then available as `__('modules.dashboard.reports.title')`. PHP uses the slash form: `__('modules/dashboard.reports.title')`.
- Menu titles are translated from the `nav.<slug>` keys in `lang/<locale>/modules/common.php`.
- Users who get a system role afterwards receive the permission from `associated_roles`. Grant it to existing users from **Users → Assign permissions**.
- Hide actions inside the page with `usePermission().can('View Reports', 'View Tenant Reports')`. See [Architecture → Permissions](/docs/vue/architecture#permissions-on-the-frontend).

More on roles and tenant seeding: [Users, roles & permissions](/docs/core/users-roles-permissions).
:::

::: details View a feature test
```php
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;

test('users with the permission can visit the reports page', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(Permission::findOrCreate('View Reports', 'web'));

    $this->actingAs($user)
        ->get(route('reports.index'))
        ->assertInertia(fn (Assert $page) => $page->component('reports/Index'));
});
```

```bash
php artisan test --compact --filter=reports
```

`config/inertia.php` has `testing.ensure_pages_exist` enabled, so the test fails if `reports/Index.vue` is missing.
:::

## Adding a form

Forms post to a controller through Inertia. Validation errors come back as `errors`, and success usually redirects with a flash toast.

```text
<Form v-bind="store.form()"> → Controller (Form Request or Data class validates)
  → Service → Inertia::flash('toast', …) → redirect
```

1. **Backend.** Add a route and a controller action. Validate with a Form Request or a Data class (for example `UserData` in `UserController::store`), call a service, flash a toast and redirect.
2. **Route function.** Import the Wayfinder function: `import { store } from '@/routes/reports'`.
3. **Form.** Spread `store.form()` into `<Form>` and read `errors` and `processing` from the slot.
4. **Fields.** Use `Common*` components with `name` and `:error`. No `v-model` needed.

```vue
<Form v-bind="store.form()" reset-on-success v-slot="{ errors, processing }">
    <CommonInput name="name" :label="__('modules.dashboard.reports.name')" :error="errors.name" />
    <CommonButton type="submit" :loading="processing">
        {{ __('modules.common.actions.save_changes') }}
    </CommonButton>
</Form>
```

Edit forms, create/edit modals and `useForm`: see [Inertia → Forms](/docs/vue/inertia#forms).

## Type checking & linting

| Command | When |
| --- | --- |
| `npx vue-tsc --noEmit` | Type check only |
| `npm run lint` | Check ESLint, Prettier and types without changing files |
| `npm run lint:fix` | Fix what can be fixed, then type check. Run before committing |
| `composer lint` | Regenerate Wayfinder and TypeScript types, then run all PHP and frontend fixers |

- ESLint enforces `import type` for type-only imports, ordered imports, 1TBS braces and blank lines around control statements.
- Types for Data classes come from `@/types/Modules/<Module>/Data`, generated by `php artisan typescript:transform`.

::: warning
`vue-tsc` fails on missing `@/routes` or `@/actions` imports until Wayfinder has generated them. Run `npm run dev`, `npm run build` or `composer lint` first.
:::

## Conventions

- **No hard-coded text.** Every visible string goes through `__()` with a `modules.<feature>.<key>` key, including breadcrumbs, placeholders, toasts and confirm dialogs.
- **No code comments.** Name things clearly instead (`.ai/rules/general.md`).
- **Use the `Common*` components** for fields and buttons, and `useConfirmDialog()` for destructive actions.
- **Use Wayfinder** instead of hard-coded URLs; `.form()` with `<Form>`.
- **Type everything.** Generated types from `@/types/Modules/...`; `import type` for type-only imports.
- **Composables** go in `composables/useX.ts`; page-only components in the page's `Partials/` folder.
