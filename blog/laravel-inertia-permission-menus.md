---
title: "Permission-Based Menus in Laravel and Inertia"
description: "Handle Laravel Inertia permissions on the frontend: define menu items with a permission, filter them on the server and render only what each user can open."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: permissions
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

A sidebar that shows "Billing" to someone who then gets a 403 after clicking it looks broken. If you want to handle Laravel Inertia permissions on the frontend properly, I'd start with the navigation, because it's the first thing every user sees. Permission-based menus mean each user sees only the pages they can actually open.

Below I give each menu item a required permission, filter the menu in PHP, share it as an Inertia prop, mark the active item and render it in Vue, React or Svelte. None of it copies authorization rules into JavaScript.

## Why filter the menu on the server

There are two ways to build a permission-aware menu. You can send the whole menu plus the user's permissions and filter in the browser. Or you can filter in PHP and send only what the user may see.

| | Filter in the browser | Filter on the server |
| --- | --- | --- |
| What the browser receives | Every item, including admin-only URLs | Only the items the user can open |
| Where the rules live | In JavaScript, once per frontend | In PHP, next to routes and policies |
| Super admin and policy rules | Must be re-implemented | Applied automatically by `$user->can()` |
| Frontend code | Loops plus permission checks | Just a loop |

For navigation I filter on the server, every time. `$user->can()` goes through Laravel's Gate, so Spatie permissions, a [super admin rule](/blog/laravel-super-admin-role.html) in `Gate::before` and your policies all count without extra code. If the package itself is new to you, start with [Laravel Roles and Permissions with Spatie](/blog/laravel-roles-permissions-spatie.html).

## Describe each menu item with a permission

Each item needs a label and a route name, plus an optional icon, an optional required permission and optional children. The definition can live in a config file or in a database table.

A config file lives in git, gets reviewed in pull requests and needs no migration. It fits when the menu only changes when the code does. A database table lets admins reorder or regroup items at runtime; if you go that way, seed the defaults with `updateOrCreate()` on a unique slug so re-running the seeder is safe. I'd start with config and only move to a table once admins really need to rearrange things.

Here's the config version:

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

Store **route names, not URLs**. The URL is resolved with `route()` at request time, so changing a URI never breaks the menu, and the route name tells you which middleware protects the page. An item without a `permission` key shows up for every signed-in user.

## Build the visible tree in a service

A small service walks the items, drops the ones the user can't access and removes any group that ends up empty:

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

Every item that survives becomes a plain array for the frontend. Its children go through the same `build()` call first:

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

Because of the recursion, nested groups follow the same rules as top-level items. Empty groups disappear too. A "Projects" heading with no visible children is just noise, so `reject()` removes nodes that have neither a link nor children.

The part people usually get wrong is `values()`. **It isn't optional.** `filter()` keeps the original array keys, and without re-indexing, a list like `[0 => ..., 2 => ...]` is encoded as a JSON *object*. Your `v-for` or `.map()` then gets confused.

## Mark the active item on the server

Comparing URLs in the browser breaks as soon as a page has a query string or a child route such as `/projects/42/edit`. Route names hold up better. Laravel's `routeIs()` accepts several names and wildcards, so an item can list extra routes that should highlight it:

```php
protected function isActive(array $item): bool
{
    $patterns = array_filter([$item['route'] ?? null, ...($item['active'] ?? [])]);

    return request()->routeIs(...$patterns);
}
```

With `'active' => ['projects.show', 'projects.edit']`, "All projects" stays highlighted while someone views or edits a project. A wildcard such as `projects.*` works too, but it would also match `projects.create` and highlight two items at once, so I'd rather list the routes. And since `node()` marks a parent as active when one of its children is, collapsible groups open on the right page.

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

Guests get an empty array. The menu is rebuilt on every full Inertia visit, so a permission change shows up on the user's next navigation without them having to sign out. Partial reloads that ask for other props with `only` skip the closure entirely.

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

After that, the component has nothing left to decide. It loops and renders:

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

React reads the same prop with `usePage().props.navigation`, and Svelte uses the page store from `@inertiajs/svelte`. Not one of them contains a permission check. If you already describe your PHP data with classes, you can [generate the TypeScript types from PHP](/blog/laravel-typescript-types-from-php.html) instead of writing `NavItem` by hand.

## Buttons and actions inside a page

Navigation is only half of the frontend. For buttons like "New project" or "Delete", you can share the user's permission names and use a small `can()` helper, as shown in the [Spatie permissions guide](/blog/laravel-roles-permissions-spatie.html). Or you can send page-specific abilities from the controller, which also covers policies that depend on the record:

```php
return Inertia::render('projects/Show', [
    'project' => $project,
    'can' => [
        'update' => $request->user()->can('update', $project),
        'delete' => $request->user()->can('delete', $project),
    ],
]);
```

I prefer the second option. It keeps rules like "only the owner can delete" on the server, where they belong.

## Keep menus and routes in sync

When a menu permission doesn't match the route's middleware, you get exactly the two bugs you set out to avoid: links that end in a 403, or pages nobody can find. Go through this checklist whenever you add a page:

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

Only if your pages need them for buttons. For navigation, the filtered menu is enough. Permission names aren't secret, but a smaller payload and fewer rules in JavaScript keep the frontend simpler.

### Can I cache the menu with Inertia's once props?

Inertia v3 can remember a prop across navigations with `Inertia::once()` or `shareOnce()`. The catch is freshness. A user whose role changes keeps the old menu until the prop expires or the page is fully reloaded. Building a small menu is cheap, so I'd stick with a normal lazy prop.

### How do I translate menu labels?

Translate on the server while you build the tree. You can pass each label through `__()` with JSON translation files, or give items a key such as `nav.projects` with the stored title as a fallback. Either way the frontend receives text that's ready to show. For the rest of the UI, see [Laravel translations in Inertia apps](/blog/laravel-inertia-translations.html).

## How SaaS Laravel builds permission-based menus

If you'd rather not build this yourself, the [SaaS Laravel starter kits](/) already do it. Navigation lives in a `menus` table, one in the central database and one in each tenant database. Every row has an optional `permission` column, and `MenuService` drops the items and children the user can't access with `$user->can()`, marks the active item from `route_name` plus an `active` list of route patterns, and translates labels from `modules/common.nav.*`. The result is shared as lazy `menus` and `setupMenus` props, so the Vue, React and Svelte sidebars only loop over what they receive. Admins can drag and drop items under **Setup → Menus**, which requires `Reorder Navigation Menus` (or `Reorder Tenant Menus`), and reset them to the seeded defaults. See [navigation and layouts](/docs/core/navigation-and-layouts.html#database-driven-menus) in the docs.

<BlogPostCta title="Menus that respect permissions" text="SaaS Laravel ships database-driven menus filtered by Spatie permissions on the server, with drag-and-drop ordering, in Vue, React or Svelte." />
