---
title: "Laravel SaaS Dashboard with Vue and Inertia"
description: "A Laravel Vue Inertia walkthrough for SaaS dashboards: typed props, layout breadcrumbs, a debounced search, useForm, modal refs and permission checks in Vue 3."
pageClass: blog-page
date: 2026-09-29
author: erag
tags: [Vue, Inertia]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-vue-inertia-saas.html
  - - meta
    - property: og:title
      content: "Laravel SaaS Dashboard with Vue and Inertia"
  - - meta
    - property: og:description
      content: "A Laravel Vue Inertia walkthrough for SaaS dashboards: typed props, layout breadcrumbs, a debounced search, useForm, modal refs and permission checks in Vue 3."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-vue-inertia-saas.html
  - - meta
    - name: twitter:title
      content: "Laravel SaaS Dashboard with Vue and Inertia"
  - - meta
    - name: twitter:description
      content: "A Laravel Vue Inertia walkthrough for SaaS dashboards: typed props, layout breadcrumbs, a debounced search, useForm, modal refs and permission checks in Vue 3."
---

# Laravel Vue Inertia Walkthrough: Building a SaaS Dashboard Page by Page

<BlogPostMeta />

A **Laravel Vue Inertia** stack lets you write a SaaS dashboard the way you write a classic Laravel app. Routes, controllers, validation and permissions stay in PHP, and Vue 3 components replace Blade views. This walkthrough builds the parts every dashboard needs: typed page props, breadcrumbs, a searchable table, settings forms, modals and permission checks, using `<script setup>`, composables and TypeScript.

If you are still choosing a frontend, read [Vue, React or Svelte for your Laravel SaaS](/blog/vue-react-or-svelte-laravel-saas.html) first. This article assumes you picked Vue.

## The stack at a glance

| Piece | Package | Role |
| --- | --- | --- |
| Framework | `vue` 3.5 | Components with `<script setup lang="ts">` |
| Adapter | `@inertiajs/vue3` v3 | `usePage`, `router`, `useForm`, `Form`, `Link`, `Head` |
| Vite plugin | `@inertiajs/vite` | Resolves pages, so `app.ts` needs no `resolve` function |
| UI | shadcn-vue on `reka-ui` | Dialogs, selects, sidebar, buttons |
| Icons and toasts | `@lucide/vue`, `vue-sonner` | Icons as components, toast notifications |
| Type checking | `vue-tsc` | Checks `.vue` files, not only `.ts` |

## How a Laravel Vue Inertia page gets its data

A controller returns a page name and its props. With the Inertia Vite plugin, the name maps straight to a file in `resources/js/pages`:

```php
public function index(Request $request): Response
{
    return Inertia::render('reports/Index', [
        'reports' => $this->reportService->paginate($request->string('search')),
        'filters' => ['search' => $request->string('search')->value()],
    ]);
}
```

That renders `resources/js/pages/reports/Index.vue`. A useful naming rule is lowercase folders and PascalCase files: `users/Index.vue`, `tenants/Show.vue`, `settings/Profile.vue`. Page-only pieces such as modals go into a `Partials/` folder next to the page instead of the shared `components/` folder.

Keep the controller thin and let a service build the data. The page then only renders what it gets.

## Typing props with defineProps

Vue 3.5 accepts a TypeScript type directly in `defineProps`, so the page contract is one line:

```vue
<script setup lang="ts">
import type { ReportIndexProps } from '@/types';

const props = defineProps<ReportIndexProps>();
</script>
```

Write `ReportIndexProps` by hand, or generate it from PHP. If your props come from spatie/laravel-data objects with a `#[TypeScript]` attribute, `php artisan typescript:transform` from spatie/laravel-typescript-transformer writes matching types into `resources/js/types`, so the PHP class stays the single source of truth.

Shared props, such as the signed-in user, need one declaration for the whole app. Inertia v3 reads it from a module augmentation:

```ts
declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: SharedData;
    }
}
```

After that, `usePage<PageProps>().props.auth.user` is typed in every component.

## Breadcrumbs through the layout

Most dashboard pages share one app layout, chosen once in `app.ts` by page name. The page still needs to tell that layout something, such as its breadcrumbs. In Inertia v3 a page can set `layout` to a plain props object. The default layout stays, and it receives the object as props:

```vue
<script setup lang="ts">
import { dashboard } from '@/routes';
import { index } from '@/routes/reports';

defineOptions({
    layout: {
        breadcrumbs: [
            { title: 'Dashboard', href: dashboard() },
            { title: 'Reports', href: index() },
        ],
    },
});
</script>
```

`defineOptions` is hoisted out of `setup`, so it cannot use the component's local variables or refs. When a layout value depends on data loaded by the page, call Inertia v3's `setLayoutProps()` from the page instead. Layout nesting and persistence get their own article: [persistent layouts in Inertia](/blog/inertia-persistent-layouts.html).

The `dashboard()` and `index()` helpers come from Laravel Wayfinder, which generates typed route functions from your PHP routes.

## A searchable table with a composable

A list page usually has a search box that updates the URL. In Vue, split it into a small, reusable composable and a `watch`:

```ts
const search = shallowRef(props.filters.search);
const debouncedSearch = useDebounce(search, 300);

watch(debouncedSearch, (value) => {
    router.get(
        index.url(),
        { search: value.trim() || undefined },
        { preserveScroll: true, replace: true },
    );
});
```

A few details matter here:

- **`shallowRef`** is enough for a string and avoids deep reactivity you don't need.
- **`replace: true`** stops every keystroke from adding a browser history entry.
- **`preserveScroll`** keeps the table where the user left it.
- **Sending `undefined`** for an empty search drops `?search=` from the URL.

The composable itself accepts a ref, a getter or a plain value by using `MaybeRefOrGetter` and `toValue()`. It clears its timer in `onScopeDispose`, so nothing fires after the page unmounts. Put composables like this in `resources/js/composables` and name them `useSomething`.

Render the rows with `v-for` and a `:key` on the record ID, and use Inertia's `Link` with `preserve-scroll` for the paginator links that Laravel's paginator returns.

## Settings forms with useForm

Inertia gives Vue two ways to write forms. The `Form` component suits plain inputs posted to a route, and it has its own guide: [the Inertia Form component](/blog/inertia-form-component.html). `useForm` suits forms where Vue controls the values, such as a layout picker made of clickable cards:

```ts
const form = useForm({
    app_layout: props.layoutSettings.app_layout ?? 'sidebar',
    sidebar_variant: props.layoutSettings.sidebar_variant ?? 'inset',
});

const submit = () => {
    form.patch(update.url(), {
        preserveScroll: true,
        onSuccess: () => form.defaults(),
    });
};
```

The returned object is reactive, so the template can read `form.app_layout`, `form.processing`, `form.isDirty` and `form.errors` directly. Calling `form.defaults()` after a successful save makes the saved values the new baseline. `isDirty` goes back to `false` and a "Save changes" bar can hide itself.

## Modals with template refs and defineExpose

Create and edit dialogs are best kept in one component that the page opens imperatively. The modal exposes an `open()` method:

```ts
const selectedUser = shallowRef<UserManagementUser | null>(null);
const isOpen = shallowRef(false);

const open = (user?: UserManagementUser) => {
    selectedUser.value = user ?? null;
    isOpen.value = true;
};

defineExpose({ open, close: () => (isOpen.value = false) });
```

The page holds a typed template ref and calls it:

```ts
const userFormModal = ref<InstanceType<typeof UserFormModal> | null>(null);

const openEditModal = (user: UserManagementUser) => userFormModal.value?.open(user);
```

Give the form inside the modal a `:key` based on the record ID. Switching from "edit Alice" to "create" then mounts a fresh form instead of carrying over old values and errors.

## Permission checks in templates

Your Laravel policies and route middleware decide what a user may do. The frontend only decides what to show. Share the user's permission names as a prop and wrap them in a composable:

```ts
export function usePermission() {
    const page = usePage<PageProps>();

    const can = (...permissions: string[]) =>
        page.props.auth.isSuperAdmin ||
        permissions.some((p) => page.props.auth.permissions.includes(p));

    return { can };
}
```

In the template, `v-if="can('Create User')"` hides the button. Always keep the server-side check, because hiding a button protects nothing. The wider pattern, including menus, is covered in [permission-based menus in Laravel and Inertia](/blog/laravel-inertia-permission-menus.html).

## Checklist for a new Vue page

- Route with middleware and a name, and a thin controller calling a service
- `Inertia::render('feature/Index', [...])` with only the props the page needs
- `pages/feature/Index.vue` with `defineProps<FeatureIndexProps>()`
- Breadcrumbs via `defineOptions({ layout: { breadcrumbs } })`
- Page title with `Head`
- URLs from Wayfinder helpers, not hard-coded strings
- `vue-tsc --noEmit` passes

## Frequently asked questions

### Should I use the Options API or the Composition API with Inertia?

Both work, but `<script setup>` with the Composition API is the better fit. `defineProps` with a TypeScript type, composables and `defineOptions` are all built for it, and it keeps page logic short.

### Do I need Vue Router or Pinia in a Laravel Vue Inertia app?

Not Vue Router: Laravel owns the routes, and Inertia swaps pages for you. Pinia is optional. Server data arrives as page props, so a store is only worth adding for client-only state that several pages share. A small module-level `ref` in a composable is often enough.

### How do I type usePage in Vue?

Declare your shared props once through the `InertiaConfig` augmentation in a global `.d.ts` file. Then pass your `PageProps` type to `usePage` where you want page props merged with shared props.

### Can I write some pages in plain JavaScript?

Yes. Inertia doesn't require TypeScript. You lose prop checking from `vue-tsc` on those pages, so keep shared components and composables typed.

## How SaaS Laravel does it in Vue

The [SaaS Laravel Vue kit](/kits/vue.html) follows this structure on Vue 3.5 and Inertia v3. Pages like `users/Index.vue` use `defineOptions` breadcrumbs, a `useDebounce` composable with `router.get`, `UserFormModal.vue` opened through `defineExpose`, and `usePermission()` for buttons. Forms use Inertia's `Form` component with the kit's `Common*` inputs, or `useForm` for the layout settings. Types for laravel-data objects are generated into `resources/js/types`. The [Vue kit documentation](/docs/vue.html) lists every page, route and component.

<BlogPostCta title="Start your Vue SaaS dashboard today" text="The SaaS Laravel Vue kit ships Inertia v3 pages for users, roles, tenants and settings, with typed props, shadcn-vue components and permission-aware UI." />
