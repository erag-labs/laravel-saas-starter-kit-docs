---
title: "Database Menus & App Layouts"
description: "Database-driven menus with permission checks and drag-and-drop ordering, sidebar or header layouts, sign-in layouts and light or dark appearance."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/core/navigation-and-layouts.html
  - - meta
    - property: og:title
      content: "Database Menus & App Layouts"
  - - meta
    - property: og:description
      content: "Database-driven menus with permission checks and drag-and-drop ordering, sidebar or header layouts, sign-in layouts and light or dark appearance."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/core/navigation-and-layouts.html
  - - meta
    - name: twitter:title
      content: "Database Menus & App Layouts"
  - - meta
    - name: twitter:description
      content: "Database-driven menus with permission checks and drag-and-drop ordering, sidebar or header layouts, sign-in layouts and light or dark appearance."
---

# Navigation & layouts

## Database-driven menus

Navigation is stored in the database instead of being hard-coded in components. Admins can reorder it from the UI, each item can require a permission, and central and tenant apps have separate menus (a `menus` table in the central database and in each tenant database).

```text
menus table → MenuService (filters by permission) → `menus` / `setupMenus` props → sidebar or header
```

| Column | Purpose |
| --- | --- |
| `title` | Fallback label |
| `slug` | Unique key, also used for translation (`modules/common.nav.<slug>`) |
| `parent_slug` | Parent menu (one level of nesting) |
| `sort_order` | Order within its parent |
| `route_name` | Named route for the link (`route()` is used when the route exists) |
| `permission` | Permission required to see the item; empty = visible to everyone signed in |
| `active` | JSON list of extra route names that mark the item active (e.g. `tenants.show`) |
| `icon` | Iconify name, e.g. `lucide:building-2` |
| `is_setup` | `true` for items in the **Setup** section instead of the main sidebar |

**Related files**: `App\Models\Menu`, `Modules\Menu\Services\MenuService`.

### Default menus

| Central (`Database\Seeders\MenuSeeder`) | Tenant (`Database\Seeders\tenant\MenuSeeder`) |
| --- | --- |
| Dashboard | Dashboard |
| Tenants → All Tenants, Add Tenant, Domains | — |
| Users | Users |
| Roles | Roles |
| Setup → Menus, Layout Settings, Tenant Settings | Setup → Menus, Layout Settings |

### Adding a menu item

1. Add an entry to the menu seeder (central and/or tenant).
2. Re-run the seeder.
3. Optionally add a `nav.projects` key to `lang/<locale>/modules/common.php` to translate the label.

```php
[
    'slug' => 'projects',
    'title' => 'Projects',
    'parent_slug' => null,
    'sort_order' => 6,
    'route_name' => 'projects.index',
    'permission' => 'View Projects',
    'icon' => 'lucide:folder',
    'is_setup' => false,
],
```

```bash
php artisan db:seed --class=MenuSeeder
php artisan tenants:seed --class="Database\Seeders\tenant\MenuSeeder"
```

Seeders use `updateOrCreate` on `slug`, so re-running is safe.

### Reordering

**Setup → Menus** (`/setup/menus`):

- Drag and drop items to reorder or move them between parents. Changes are saved automatically (`POST /setup/menus/reorder`).
- **Reset** re-runs the menu seeder for the current context (`POST /setup/menus/reset`), restoring default order and parents.

| Action | Central permission | Tenant permission |
| --- | --- | --- |
| View | `View Navigation Menus` | `View Tenant Menus` |
| Reorder / reset | `Reorder Navigation Menus` | `Reorder Tenant Menus` |

The drag and drop library differs per kit: `vue-draggable-plus` (Vue), `sortablejs` (React, Svelte).

## Layout settings

Admins set a default look for everyone; each user can override it for themselves.

| Setting | Options | Default |
| --- | --- | --- |
| `app_layout` | `sidebar`, `header` (top navigation) | `sidebar` |
| `sidebar_variant` | `inset`, `sidebar`, `floating` | `inset` |
| `sidebar_collapsible` | `icon`, `offcanvas`, `none` | `icon` |
| `auth_layout` | `card`, `simple`, `split` | `card` |

| Level | Where | Who | Applies to |
| --- | --- | --- | --- |
| Personal | **Settings → Layout** (`/settings/layout`) | Every signed-in user | Their own app layout and sidebar options |
| Global default | **Setup → Layout Settings** (`/setup/layout`) | Users with `Update Layout Settings` or `Update Tenant Layout` | Guests and users without a personal setting |

::: info Auth pages always use the global default
`auth_layout` is always taken from the global default, because auth pages are shown before sign-in.
:::

Both levels are stored in `layout_settings`: the row with `user_id = null` is the global default, rows with a `user_id` are personal overrides. `LayoutService::getLayoutSettings()` resolves the active settings and shares them as the `layout` prop.

### Layout components

| Layout | Vue files |
| --- | --- |
| App (switches on `app_layout`) | `layouts/AppLayout.vue` → `layouts/app/AppSidebarLayout.vue` or `AppHeaderLayout.vue` |
| Auth (switches on `auth_layout`) | `layouts/AuthLayout.vue` → `layouts/auth/AuthCardLayout.vue`, `AuthSimpleLayout.vue`, `AuthSplitLayout.vue` |
| Settings | `layouts/settings/Layout.vue` |

`app.ts` assigns layouts by page name:

```text
auth/*       → auth layout
settings/*   → app layout + settings layout
everything else → app layout
```

React and Svelte follow the same structure with their own file naming; see the framework [layout guides](/docs/vue/layouts).

## Appearance

**Settings → Appearance** (`/settings/appearance`) switches between **light**, **dark** and **system**.

| Stored in | Why |
| --- | --- |
| `localStorage` | Read by the frontend |
| `appearance` cookie (not encrypted) | `HandleAppearance` shares it with the Blade root view, so the right theme is applied before the page renders |

The sidebar's open/closed state is kept in the `sidebar_state` cookie and shared as `sidebarOpen`.
