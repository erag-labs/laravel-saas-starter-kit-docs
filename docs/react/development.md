---
title: "React Kit Development Workflow"
description: "Daily commands for the React kit and step-by-step guides to adding a page and a form, plus type checking with tsc and linting with ESLint and Prettier."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/react/development.html
  - - meta
    - property: og:title
      content: "React Kit Development Workflow"
  - - meta
    - property: og:description
      content: "Daily commands for the React kit and step-by-step guides to adding a page and a form, plus type checking with tsc and linting with ESLint and Prettier."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/react/development.html
  - - meta
    - name: twitter:title
      content: "React Kit Development Workflow"
  - - meta
    - name: twitter:description
      content: "Daily commands for the React kit and step-by-step guides to adding a page and a form, plus type checking with tsc and linting with ESLint and Prettier."
---

# Development <Badge type="tip" text="React" />

## Daily workflow

Start everything with `composer dev`, then edit files in `resources/js` and `Modules/`. Vite reloads the browser and regenerates Wayfinder files as you go.

| Command | What it does |
| --- | --- |
| `composer dev` | Runs `php artisan serve`, `queue:listen`, `pail` and `npm run dev` together |
| `npm run dev` | Vite dev server with HMR (also regenerates Wayfinder files) |
| `npm run build` | Production build to `public/build` |
| `npm run build:ssr` | Client + SSR bundle (`vite build && vite build --ssr`) |
| `php artisan erag:generate-lang` | Export `lang/*` to `resources/js/lang/*.json` |
| `php artisan wayfinder:generate --with-form` | Regenerate Wayfinder files without Vite running |

All commands are listed in [Commands](/docs/reference/commands).

::: tip
If a change doesn't show up in the browser, check that `npm run dev` (or `composer dev`) is running, or run `npm run build`.
:::

## Adding a page

Example: a **Reports** page in the Dashboard module at `/reports`.

```text
routes/web.php → ReportController@index → Inertia::render('reports/index') → pages/reports/index.tsx
```

1. **Route.** Add it to `Modules/Dashboard/routes/web.php` inside the `auth` + `verified` group, with `permission:View Reports|View Tenant Reports` middleware and the name `reports.index`.
2. **Controller.** Create `Modules/Dashboard/Http/Controllers/ReportController.php`. Keep it thin: call a service in `Modules/<Module>/Services` and return `Inertia::render('reports/index', [...])`.
3. **Page file.** Create `resources/js/pages/reports/index.tsx` with a default-exported component and a static `layout` for breadcrumbs.
4. **Wayfinder.** `@/routes/reports` appears once Wayfinder has run. With `npm run dev` running it regenerates automatically.
5. **Translations.** Add the keys to `lang/en/modules/dashboard.php` and the same file in every other locale, then run `php artisan erag:generate-lang`.
6. **Permission.** Add `View Reports` to `config/permissions/dashboard.php` and `View Tenant Reports` to `config/permissions/tenant/dashboard.php`, then seed them.
7. **Menu (optional).** Add an entry to `database/seeders/MenuSeeder.php` and `database/seeders/tenant/MenuSeeder.php` with `'route_name' => 'reports.index'` and the permission.
8. **Test.** Assert the route renders the `reports/index` component.

The page itself stays small:

```tsx
export default function ReportsIndex({ reports }: Props) {
    const { __ } = reactLang();

    return (
        <>
            <Head title={__('modules.dashboard.reports.title')} />
            <Heading title={__('modules.dashboard.reports.title')} />
            <ul>
                {reports.map((report) => <li key={report.id}>{report.name}</li>)}
            </ul>
        </>
    );
}
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
namespace Modules\Dashboard\Http\Controllers;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('reports/index', [
            'reports' => [],
        ]);
    }
}
```
:::

::: details View full page file
```tsx
import { reactLang } from '@erag/lang-sync-inertia/react';
import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { dashboard } from '@/routes';
import { index } from '@/routes/reports';

type Props = {
    reports: { id: number; name: string }[];
};

export default function ReportsIndex({ reports }: Props) {
    const { __ } = reactLang();

    return (
        <>
            <Head title={__('modules.dashboard.reports.title')} />

            <div className="space-y-6 px-4 py-6">
                <Heading
                    title={__('modules.dashboard.reports.title')}
                    description={__('modules.dashboard.reports.description')}
                />

                <ul className="space-y-2">
                    {reports.map((report) => (
                        <li key={report.id}>{report.name}</li>
                    ))}
                </ul>
            </div>
        </>
    );
}

ReportsIndex.layout = {
    breadcrumbs: [
        { title: 'modules.common.nav.dashboard', href: dashboard() },
        { title: 'modules.dashboard.reports.title', href: index() },
    ],
};
```
:::

::: details View translations, permissions and menu
Translation keys in `lang/en/modules/dashboard.php` (repeat for each locale under `lang/<locale>/modules/`):

```php
'reports' => [
    'title' => 'Reports',
    'description' => 'Exported analytics reports.',
],
```

The frontend uses `__('modules.dashboard.reports.title')`. PHP code uses the slash form: `__('modules/dashboard.reports.title')`.

Permissions:

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

Seed them:

```bash
php artisan db:seed --class=PermissionSeeder
php artisan tenants:seed --class="Database\Seeders\PermissionSeeder"
```

Users that get a system role afterwards receive the permission from `associated_roles`. Grant it to existing users from **Users → Assign permissions**.

For the menu, run `php artisan db:seed --class=MenuSeeder` after adding the entry. Menu titles are translated from the `nav.<slug>` keys in `lang/<locale>/modules/common.php`.

More on roles, permissions and tenant seeding: [Users, roles & permissions](/docs/core/users-roles-permissions).
:::

::: details View feature test
```php
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;

test('users with the permission can visit the reports page', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(Permission::findOrCreate('View Reports', 'web'));

    $this->actingAs($user)
        ->get(route('reports.index'))
        ->assertInertia(fn (Assert $page) => $page->component('reports/index'));
});
```

Run it with `php artisan test --compact --filter=reports`. `config/inertia.php` has `testing.ensure_pages_exist` enabled, so the test fails if `reports/index.tsx` is missing.
:::

## Adding a form

Forms post straight to a Laravel route. There is no API layer.

```text
<Form {...store.form()}> → Controller@store(Data $data) → Service → Inertia::flash('toast') → redirect
```

1. **Route.** Add a `POST` (or `PATCH`/`PUT`) route with a name and permission middleware.
2. **Validation.** Put the rules in a Spatie Data class (`Modules/<Module>/Data/*Data.php`, `rules()` method) and type-hint it in the controller action, as `RoleController@store(RoleData $data)` does.
3. **Controller.** Call the service, flash a toast and redirect.
4. **Page.** Spread the Wayfinder `.form()` object into `<Form>` and use `Common*` inputs with `name` and `error`.

```tsx
import { store } from '@/routes/roles';

<Form {...store.form()} resetOnSuccess options={{ preserveScroll: true }}>
    {({ errors, processing }) => (
        <>
            <CommonInput name="name" label={__('modules.role.form_modal.name')} error={errors.name} />
            <CommonButton type="submit" loading={processing}>
                {__('modules.role.form_modal.create')}
            </CommonButton>
        </>
    )}
</Form>
```

Validation errors come back in `errors` keyed by field name. More patterns (edit forms, `useForm`, create/edit modals) are in [Inertia → Forms](/docs/react/inertia#forms).

::: details View controller action
```php
public function store(RoleData $data): RedirectResponse
{
    $this->roleService->createRole($data);

    Inertia::flash('toast', ['type' => 'success', 'message' => __('modules/role.toasts.created')]);

    return to_route('roles.index');
}
```
:::

## Type checking & linting

| Command | What it does |
| --- | --- |
| `npm run lint` | `eslint .` + `prettier --check resources/` + `tsc --noEmit` |
| `npm run lint:fix` | `eslint . --fix` + `prettier --write resources/` + `tsc --noEmit` |
| `npx tsc --noEmit` | Type check only |
| `composer lint` | Pint, `php artisan typescript:transform`, `npm run lint:fix` |
| `composer test` | Lint check, Larastan, then `php artisan test` |

Run `npm run lint:fix` before committing.

## Conventions

- **No hard-coded text.** Every visible string goes through `__()` with a `modules.<feature>.<key>` key, including breadcrumbs, placeholders, toasts and confirm dialogs.
- **Use the `Common*` components** for form fields and buttons, and `useConfirmDialog()` for destructive actions.
- **Use Wayfinder** instead of hard-coded URLs; use `.form()` with `<Form>`.
- **Type everything.** Use generated types from `@/types/Modules/...` for Data objects, and `import type` for type-only imports (enforced by ESLint).
- **Hide actions by permission** with `usePermission().can(...)`. See [Architecture → Permissions](/docs/react/architecture#permissions-on-the-frontend).
- **Placement.** Hooks go in `hooks/use-x.ts`; page-only components in the page's `partials/` folder. Files are kebab-case.
