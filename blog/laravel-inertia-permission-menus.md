---
title: "Permission-Based Menus in Laravel and Inertia"
description: "Handle Laravel Inertia permissions on the frontend: define menu items with a permission, filter them on the server and render only what each user can open."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Permissions, Inertia]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-inertia-permission-menus.html
  - - meta
    - property: og:title
      content: "Permission-Based Menus in Laravel and Inertia"
  - - meta
    - property: og:description
      content: "Handle Laravel Inertia permissions on the frontend: define menu items with a permission, filter them on the server and render only what each user can open."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-inertia-permission-menus.html
  - - meta
    - name: twitter:title
      content: "Permission-Based Menus in Laravel and Inertia"
  - - meta
    - name: twitter:description
      content: "Handle Laravel Inertia permissions on the frontend: define menu items with a permission, filter them on the server and render only what each user can open."
---

# Permission-Based Menus in Laravel and Inertia: Build the Navigation on the Server

<BlogPostMeta />

A sidebar that shows "Billing" to someone who gets a 403 after clicking it looks broken. Handling **Laravel Inertia permissions on the frontend** well starts with the navigation: every user should see only the pages they can actually open.

This guide shows how to give each menu item a required permission, filter the menu in PHP, share it as an Inertia prop, mark the active item and render it in Vue, React or Svelte without copying authorization rules into JavaScript.

## Why filter the menu on the server

There are two ways to build a permission-aware menu. You can send the whole menu plus the user's permissions and filter in the browser, or you can filter in PHP and send only what the user may see.

| | Filter in the browser | Filter on the server |
| --- | --- | --- |
| What the browser receives | Every item, including admin-only URLs | Only the items the user can open |
| Where the rules live | In JavaScript, once per frontend | In PHP, next to routes and policies |
| Super admin and policy rules | Must be re-implemented | Applied automatically by `$user->can()` |
| Frontend code | Loops plus permission checks | Just a loop |

Server-side filtering wins for navigation. `$user->can()` goes through Laravel's Gate, so Spatie permissions, a [super admin rule](/blog/laravel-super-admin-role.html) in `Gate::before` and your policies all count without extra code. If you are new to the package itself, start with [Laravel Roles and Permissions with Spatie](/blog/laravel-roles-permissions-spatie.html).

## Describe each menu item with a permission

Every item needs a label, a route name, an optional icon, an optional required permission and optional children. You can keep the definition in a config file or in a database table.

- **A config file** lives in git, gets reviewed in pull requests and needs no migration. It fits when the menu only changes when the code changes.
- **A database table** lets admins reorder or regroup items at runtime. Seed the defaults with `updateOrCreate()` on a unique slug so re-running the seeder is safe.

Here is the config version:

```php
// config/navigation.php
return [
    ['label' => 'Dashboard', 'route' => 'dashboard', 'icon' => 'layout-grid'],
    [
        'label' => 'Projects',
        'icon' => 'folder',
        'children' => [
            ['label' => 'All projects', 'route' => 'projects.index', 'permission' => 'View Projects', 'active' => ['projects.show', 'projects.edit']],
            ['label' => 'New project', 'route' => 'projects.create', 'permission' => 'Create Project'],
        ],
    ],
    ['label' => 'Billing', 'route' => 'billing.show', 'permission' => 'Manage Billing'],
];
```

Store **route names**, not URLs. The URL is resolved with `route()` at request time, so changing a URI never breaks the menu, and the route name tells you which middleware protects the page. An item without a `permission` key is visible to every signed-in user.

## Build the visible tree in a service

A small service walks the items, drops the ones the user can't access and removes groups that end up empty:

```php
class NavigationBuilder
{
    public function build(User $user, array $items): array
    {
        return collect($items)
            ->filter(fn (array $item) => empty($item['permission']) || $user->can($item['permission']))
            ->map(fn (array $item) => $this->node($user, $item))
            ->reject(fn (array $node) => $node['href'] === null && $node['children'] === [])
            ->values()
            ->all();
    }
}
```

Each surviving item becomes a plain array for the frontend. Children go through the same `build()` call first:

```php
protected function node(User $user, array $item): array
{
    $children = $this->build($user, $item['children'] ?? []);

    return [
        'label' => $item['label'],
        'icon' => $item['icon'] ?? null,
        'href' => isset($item['route']) ? route($item['route']) : null,
        'active' => $this->isActive($item) || collect($children)->contains('active', true),
        'children' => $children,
    ];
}
```

Three details matter here:

1. **Recursion** handles nested groups with the same rules as top-level items.
2. **Empty groups disappear.** A "Projects" heading with no visible children is just noise, so `reject()` removes nodes that have neither a link nor children.
3. **`values()` is not optional.** `filter()` keeps the original array keys. Without re-indexing, a list like `[0 => ..., 2 => ...]` is encoded as a JSON *object*, and your `v-for` or `.map()` gets confused.

## Mark the active item on the server

Comparing URLs in the browser breaks as soon as a page has a query string or a child route such as `/projects/42/edit`. Route names are more reliable. Laravel's `routeIs()` accepts several names and wildcards, so an item can list extra routes that should highlight it:

```php
protected function isActive(array $item): bool
{
    $patterns = array_filter([$item['route'] ?? null, ...($item['active'] ?? [])]);

    return request()->routeIs(...$patterns);
}
```

With `'active' => ['projects.show', 'projects.edit']`, "All projects" stays highlighted while someone looks at or edits a project. A wildcard such as `projects.*` works too, but it would also match `projects.create` and highlight two items at once. Because `node()` marks a parent as active when one of its children is, collapsible groups open on the right page.

## Share the menu as an Inertia prop

Add the result to the shared props in `HandleInertiaRequests`. Wrap it in a closure so it's only computed when Inertia actually needs it:

```php
public function share(Request $request): array
{
    return [
        ...parent::share($request),
        'navigation' => fn (): array => $request->user()
            ? app(NavigationBuilder::class)->build($request->user(), config('navigation'))
            : [],
    ];
}
```

Guests get an empty array. Because the menu is rebuilt on every full Inertia visit, a permission change shows up on the user's next navigation, without signing out. Partial reloads that ask for other props with `only` skip the closure entirely.

## Render the menu in Vue, React or Svelte

Describe the shape once in TypeScript:

```ts
export type NavItem = {
    label: string;
    icon: string | null;
    href: string | null;
    active: boolean;
    children: NavItem[];
};
```

The component then has nothing to decide. It loops and renders:

```vue
<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3';

const page = usePage<{ navigation: NavItem[] }>();
</script>

<template>
    <ul>
        <li v-for="item in page.props.navigation" :key="item.label">
            <Link v-if="item.href" :href="item.href" :class="{ 'font-semibold': item.active }">{{ item.label }}</Link>
            <span v-else>{{ item.label }}</span>
            <!-- render item.children with the same markup -->
        </li>
    </ul>
</template>
```

React reads the same prop with `usePage().props.navigation` and Svelte with the page store from `@inertiajs/svelte`. None of them contain a single permission check. If you already describe your PHP data with classes, you can [generate the TypeScript types from PHP](/blog/laravel-typescript-types-from-php.html) instead of writing `NavItem` by hand.

## Buttons and actions inside a page

Navigation is only half of the frontend. For "New project" or "Delete" buttons, you have two options:

- Share the user's permission names and use a small `can()` helper, as shown in the [Spatie permissions guide](/blog/laravel-roles-permissions-spatie.html).
- Send page-specific abilities from the controller. This also covers policies that depend on the record:

```php
return Inertia::render('projects/Show', [
    'project' => $project,
    'can' => [
        'update' => $request->user()->can('update', $project),
        'delete' => $request->user()->can('delete', $project),
    ],
]);
```

The second option keeps rules like "only the owner can delete" on the server, where they belong.

## Keep menus and routes in sync

A menu permission that differs from the route's middleware creates the two bugs you're trying to avoid: links that end in a 403, or pages nobody can find. Use this checklist when you add a page:

| Check | Why |
| --- | --- |
| Menu item and route use the same permission name | The link appears exactly when the page opens |
| The route has `permission:` middleware or a policy | Hidden links are not protection; anyone can type a URL |
| Permission names come from one list, such as config files or an enum | A typo can't create a permission nobody has |
| A test signs in with a low-privilege role and checks the `navigation` prop | Regressions show up before your customers see them |

## Frequently asked questions

### Is hiding a menu item enough to protect a page?

No. Removing the link only changes what the user sees. Protect every route with the `permission` middleware or a policy, so a typed or bookmarked URL still returns a 403.

### Should I send all of a user's permissions to the frontend?

Only if your pages need them for buttons. For navigation, sending the filtered menu is enough. Permission names are not secret, but a shorter payload and fewer rules in JavaScript make the frontend simpler.

### Can I cache the menu with Inertia's once props?

Inertia v3 can remember a prop across navigations with `Inertia::once()` or `shareOnce()`. The catch is freshness: a user whose role changes keeps the old menu until the prop expires or the page is fully reloaded. Building a small menu is cheap, so a normal lazy prop is usually the better trade.

### How do I translate menu labels?

Translate on the server while building the tree, for example by passing each label through `__()` with JSON translation files, or by giving items a key such as `nav.projects` with the stored title as fallback. The frontend then receives ready-to-show text. See [Laravel translations in Inertia apps](/blog/laravel-inertia-translations.html) for the rest of the UI.

## How SaaS Laravel builds permission-based menus

The [SaaS Laravel starter kits](/) store navigation in a `menus` table, one in the central database and one in each tenant database. Every row has an optional `permission` column, and `MenuService` drops the items and children the user can't access with `$user->can()`, marks the active item from `route_name` plus an `active` list of route patterns, and translates labels from `modules/common.nav.*`. The result is shared as lazy `menus` and `setupMenus` props, so the Vue, React and Svelte sidebars only loop over what they receive. Admins can drag and drop items under **Setup → Menus**, which requires `Reorder Navigation Menus` (or `Reorder Tenant Menus`), and reset them to the seeded defaults. See [navigation and layouts](/docs/core/navigation-and-layouts.html#database-driven-menus) in the docs.

<BlogPostCta title="Menus that respect permissions" text="SaaS Laravel ships database-driven menus filtered by Spatie permissions on the server, with drag-and-drop ordering, in Vue, React or Svelte." />
