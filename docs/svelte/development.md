---
title: "Svelte Kit Development Workflow"
description: "Daily commands for the Svelte kit and step-by-step guides to adding a page and a form, plus type checking with svelte-check and linting with ESLint and Prettier."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/svelte/development.html
  - - meta
    - property: og:title
      content: "Svelte Kit Development Workflow"
  - - meta
    - property: og:description
      content: "Daily commands for the Svelte kit and step-by-step guides to adding a page and a form, plus type checking with svelte-check and linting with ESLint and Prettier."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/svelte/development.html
  - - meta
    - name: twitter:title
      content: "Svelte Kit Development Workflow"
  - - meta
    - name: twitter:description
      content: "Daily commands for the Svelte kit and step-by-step guides to adding a page and a form, plus type checking with svelte-check and linting with ESLint and Prettier."
---

# Development <Badge type="tip" text="Svelte" />

## Daily workflow

| Command | What it does |
| --- | --- |
| `composer dev` | Runs `php artisan serve`, `queue:listen`, `pail` and `npm run dev` together |
| `npm run dev` | Vite dev server with HMR; also regenerates Wayfinder files |
| `npm run build` | Production build to `public/build` |
| `npm run build:ssr` | Client and SSR bundle (`vite build && vite build --ssr`) |
| `php artisan erag:generate-lang` | Export `lang/*` to `resources/js/lang/*.json` |
| `php artisan wayfinder:generate --with-form` | Regenerate `@/routes` and `@/actions` without Vite running |

All commands are listed in [Commands](/docs/reference/commands).

::: tip
If a change doesn't show up in the browser, check that `npm run dev` (or `composer dev`) is running, or run `npm run build`.
:::

## Adding a page

Example: a **Reports** page in the Dashboard module at `/reports`. Each step has the full code in a collapsible block.

```text
route (module web.php) → controller → Inertia::render('reports/Index')
  → resources/js/pages/reports/Index.svelte → translations → permission + menu → test
```

1. **Route.** Add it to `Modules/Dashboard/routes/web.php` inside the `auth` + `verified` group, with `permission:View Reports|View Tenant Reports` middleware and the name `reports.index`.
2. **Controller.** Create `Modules/Dashboard/Http/Controllers/ReportController.php`. Keep it thin: business logic belongs in `Modules/<Module>/Services`. Render the page by its path under `resources/js/pages` (PascalCase in this kit): `Inertia::render('reports/Index', …)`.
3. **Page.** Create `resources/js/pages/reports/Index.svelte`. Put breadcrumbs in `<script module>`, read props with `$props()`, set the title with `AppHead`.
4. **Wayfinder.** `@/routes/reports` exists once Wayfinder has run. With `npm run dev` running it regenerates automatically; otherwise run `php artisan wayfinder:generate --with-form`.
5. **Translations.** Add keys to `lang/en/modules/dashboard.php` and the same file in every other locale, then run `php artisan erag:generate-lang`. Svelte uses the dot form `__('modules.dashboard.reports.title')`; PHP uses the slash form `__('modules/dashboard.reports.title')`.
6. **Permission.** Add `View Reports` to `config/permissions/dashboard.php` and `View Tenant Reports` to `config/permissions/tenant/dashboard.php`, then seed them (commands below).
7. **Menu.** Add an entry with `'route_name' => 'reports.index'` and the permission to `database/seeders/MenuSeeder.php` (and `database/seeders/tenant/MenuSeeder.php`), then run `php artisan db:seed --class=MenuSeeder`. Menu titles come from the `nav.<slug>` keys in `lang/<locale>/modules/common.php`.
8. **Test.** Assert that a user with the permission gets the `reports/Index` component.

::: details Steps 1–2: route and controller
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

::: details Step 3: page file
```svelte
<script module lang="ts">
    import { dashboard } from '@/routes';
    import { index } from '@/routes/reports';

    export const layout = {
        breadcrumbs: [
            { title: 'modules.common.nav.dashboard', href: dashboard() },
            { title: 'modules.dashboard.reports.title', href: index() },
        ],
    };
</script>

<script lang="ts">
    import { svelteLang } from '@erag/lang-sync-inertia/svelte';
    import AppHead from '@/components/AppHead.svelte';
    import Heading from '@/components/Heading.svelte';

    let {
        reports,
    }: {
        reports: { id: number; name: string }[];
    } = $props();

    const { __ } = svelteLang();
</script>

<AppHead title={__('modules.dashboard.reports.title')} />

<div class="space-y-6 px-4 py-6">
    <Heading
        title={__('modules.dashboard.reports.title')}
        description={__('modules.dashboard.reports.description')}
    />

    <ul class="space-y-2">
        {#each reports as report (report.id)}
            <li>{report.name}</li>
        {/each}
    </ul>
</div>
```
:::

::: details Steps 5–7: translations, permissions and seeding
```php
// lang/en/modules/dashboard.php
'reports' => [
    'title' => 'Reports',
    'description' => 'Exported analytics reports.',
],
```

```php
// config/permissions/dashboard.php (central)
[
    'permission_name' => 'View Reports',
    'associated_roles' => ['Super Admin', 'Admin'],
],

// config/permissions/tenant/dashboard.php (tenant)
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
:::

::: details Step 8: feature test
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

Run it with `php artisan test --compact --filter=reports`. `config/inertia.php` enables `testing.ensure_pages_exist`, so the test fails if `reports/Index.svelte` is missing.
:::

::: info
Users who get a system role after seeding receive the permission from `associated_roles`. Grant it to existing users from **Users → Assign permissions**. Details: [Users, roles & permissions](/docs/core/users-roles-permissions).
:::

## Adding a form

Forms post to a controller action through Wayfinder and Inertia's `<Form>` component. The roles form is a good model (`RoleController`, `RoleData`, `pages/roles/Partials/RoleFormModal.svelte`).

1. **Validate on the server.** The kit validates with Spatie Data classes (for example `Modules/RolePermission/Data/RoleData.php` with a `rules()` method) type-hinted in the controller action.
2. **Delegate and respond.** The controller calls a service, flashes a toast with `Inertia::flash('toast', …)` and redirects.
3. **Add the route** to the module's `routes/web.php` with a name and permission middleware.
4. **Build the form** by spreading the Wayfinder `.form()` object into `<Form>` and using `Common*` inputs with `name` and `error`.

```svelte
<script lang="ts">
    import { Form } from '@inertiajs/svelte';
    import { store } from '@/routes/roles';
</script>

<Form {...store.form()} options={{ preserveScroll: true }}>
    {#snippet children({ errors, processing })}
        <CommonInput name="name" label={__('modules.role.form_modal.name')} error={errors.name} />
        <CommonButton type="submit" loading={processing}>{__('modules.role.form_modal.create')}</CommonButton>
    {/snippet}
</Form>
```

Validation errors land in `errors` automatically; the flashed toast appears through `lib/flash-toast.ts`. Edit forms, `useForm` and create/edit modals are covered in [Inertia → Forms](/docs/svelte/inertia#forms).

## Type checking & linting

| Command | What it runs |
| --- | --- |
| `npm run lint` | `eslint .`, `prettier --check resources/`, `svelte-check --tsconfig ./tsconfig.json` |
| `npm run lint:fix` | `eslint . --fix`, `prettier --write resources/`, `svelte-check --tsconfig ./tsconfig.json` |
| `npx svelte-check --tsconfig ./tsconfig.json` | Type check only |
| `composer lint` | Pint, `php artisan typescript:transform`, `npm run lint:fix` |
| `composer test` | `config:clear`, `composer lint:check`, Larastan (`composer types:check`), then `php artisan test` |

Run `npm run lint:fix` before committing.

## Conventions

- **No hard-coded text.** Every visible string goes through `__()` with a `modules.<feature>.<key>` key, including breadcrumbs, placeholders, toasts and confirm dialogs.
- **Use the `Common*` components** for form fields and buttons, and `useConfirmDialog()` for destructive actions.
- **Use Wayfinder** instead of hard-coded URLs, and `.form()` with `<Form>`.
- **Type everything.** Use generated types from `@/types/Modules/...` for Data objects and `import type` for type-only imports (enforced by ESLint).
- **Hide actions by permission** with `usePermission()` (for example `can('Export Analytics Reports', 'Export Tenant Reports')`). See [Architecture → Permissions](/docs/svelte/architecture#permissions-on-the-frontend).
- **Shared logic** goes in `lib/` (a `.svelte.ts` file when it needs runes); page-only components go in the page's `Partials/` folder.
