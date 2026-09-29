---
title: "Laravel SaaS Dashboard with Vue and Inertia"
description: "A Laravel Vue Inertia walkthrough for SaaS dashboards: typed props, layout breadcrumbs, a debounced search, useForm, modal refs and permission checks in Vue 3."
pageClass: blog-page
date: 2026-09-29
author: erag
category: frontend
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

You want to build a SaaS dashboard the way you'd build a classic Laravel app, but with Vue on the screen. That's what a Laravel Vue Inertia stack gives you. Routes, controllers, validation and permissions stay in PHP, and Vue 3 components take the place of Blade views.

Below we build the parts almost every dashboard needs: typed page props, breadcrumbs, a searchable table, settings forms, modals and permission checks. Everything uses `<script setup>`, composables and TypeScript.

Still deciding on a frontend? Read [Vue, React or Svelte for your Laravel SaaS](/blog/vue-react-or-svelte-laravel-saas.html) first. From here on, we assume you've picked Vue.

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

A controller returns a page name and its props. With the Inertia Vite plugin, that name maps straight to a file in `resources/js/pages`:

```php
public function index(Request $request): Response
{
    return Inertia::render('reports/Index', [
        'reports' => $this->reportService->paginate($request->string('search')),
        'filters' => ['search' => $request->string('search')->value()],
    ]);
}
```

That renders `resources/js/pages/reports/Index.vue`. The naming rule we follow is lowercase folders and PascalCase files: `users/Index.vue`, `tenants/Show.vue`, `settings/Profile.vue`. Pieces that only one page uses, such as its modals, go into a `Partials/` folder next to that page rather than the shared `components/` folder.

Keep the controller thin and let a service build the data. The page then just renders what it's given.

## Typing props with defineProps

In Vue 3.5, `defineProps` takes a TypeScript type directly, so the page contract fits on one line:

```vue
<script setup lang="ts">
import type { ReportIndexProps } from '@/types';

const props = defineProps<ReportIndexProps>();
</script>
```

You can write `ReportIndexProps` by hand or generate it from PHP, and we'd generate it. If your props come from spatie/laravel-data objects with a `#[TypeScript]` attribute, `php artisan typescript:transform` from spatie/laravel-typescript-transformer writes matching types into `resources/js/types`. The PHP class stays the single source of truth.

Shared props, like the signed-in user, need a single declaration for the whole app. Inertia v3 reads it from a module augmentation:

```ts
declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: SharedData;
    }
}
```

From then on, `usePage<PageProps>().props.auth.user` is typed in every component.

## Breadcrumbs through the layout

Most dashboard pages share one app layout, picked once in `app.ts` based on the page name. The page still has to tell that layout a few things, and breadcrumbs are the obvious one. In Inertia v3 a page can set `layout` to a plain props object. The default layout stays in place and receives the object as props:

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

There's one catch. `defineOptions` is hoisted out of `setup`, so it can't use the component's local variables or refs. When a layout value depends on data the page loads, call Inertia v3's `setLayoutProps()` from the page instead. Nesting and persistence are a bigger subject with their own article: [persistent layouts in Inertia](/blog/inertia-persistent-layouts.html).

The `dashboard()` and `index()` helpers come from Laravel Wayfinder, which generates typed route functions from your PHP routes.

## A searchable table with a composable

List pages usually have a search box that updates the URL. In Vue we split that into a small, reusable composable and a `watch`:

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

Each detail here is deliberate. `shallowRef` is enough for a string and skips deep reactivity you don't need. `replace: true` stops every keystroke from adding a browser history entry, and `preserveScroll` keeps the table where the user left it. Sending `undefined` for an empty search drops `?search=` from the URL altogether.

The composable itself accepts a ref, a getter or a plain value, using `MaybeRefOrGetter` and `toValue()`. It clears its timer in `onScopeDispose`, so nothing fires after the page unmounts. Composables like this live in `resources/js/composables` and are named `useSomething`.

Render the rows with `v-for` and a `:key` on the record ID. For the paginator links that Laravel's paginator returns, use Inertia's `Link` with `preserve-scroll`.

## Settings forms with useForm

Inertia gives Vue two ways to write forms. The `Form` component suits plain inputs posted to a route, and it has its own guide: [the Inertia Form component](/blog/inertia-form-component.html). `useForm` is the better fit when Vue controls the values, for example a layout picker made of clickable cards:

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

The returned object is reactive, so the template can read `form.app_layout`, `form.processing`, `form.isDirty` and `form.errors` directly. Don't skip the `form.defaults()` call after a successful save. It makes the saved values the new baseline, so `isDirty` goes back to `false` and a "Save changes" bar can hide itself.

## Modals with template refs and defineExpose

We keep create and edit dialogs in one component that the page opens imperatively. The modal exposes an `open()` method:

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

Give the form inside the modal a `:key` based on the record ID. Then switching from "edit Alice" to "create" mounts a fresh form, instead of carrying over the old values and errors.

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

In the template, `v-if="can('Create User')"` hides the button. **Always keep the server-side check**, because hiding a button protects nothing. The wider pattern, menus included, is covered in [permission-based menus in Laravel and Inertia](/blog/laravel-inertia-permission-menus.html).

## Checklist for a new Vue page

When we add a page, this is what we check before calling it done:

- Route with middleware and a name, and a thin controller calling a service
- `Inertia::render('feature/Index', [...])` with only the props the page needs
- `pages/feature/Index.vue` with `defineProps<FeatureIndexProps>()`
- Breadcrumbs via `defineOptions({ layout: { breadcrumbs } })`
- Page title with `Head`
- URLs from Wayfinder helpers, not hard-coded strings
- `vue-tsc --noEmit` passes

## Frequently asked questions

### Should I use the Options API or the Composition API with Inertia?

Both work, but we'd use `<script setup>` with the Composition API. `defineProps` with a TypeScript type, composables and `defineOptions` are all built for it, and page logic stays short.

### Do I need Vue Router or Pinia in a Laravel Vue Inertia app?

You don't need Vue Router. Laravel owns the routes, and Inertia swaps pages for you. Pinia is optional. Server data arrives as page props, so a store only earns its place for client-only state that several pages share, and a small module-level `ref` in a composable is often enough for that.

### How do I type usePage in Vue?

Declare your shared props once through the `InertiaConfig` augmentation in a global `.d.ts` file. Then pass your `PageProps` type to `usePage` wherever you want page props merged with shared props.

### Can I write some pages in plain JavaScript?

Yes, Inertia doesn't require TypeScript. You do lose prop checking from `vue-tsc` on those pages, so we'd at least keep shared components and composables typed.

## How SaaS Laravel does it in Vue

If you'd like to start from a codebase that already works this way, the [SaaS Laravel Vue kit](/kits/vue.html) follows this structure on Vue 3.5 and Inertia v3. Pages like `users/Index.vue` use `defineOptions` breadcrumbs, a `useDebounce` composable with `router.get`, `UserFormModal.vue` opened through `defineExpose`, and `usePermission()` for buttons. Forms use Inertia's `Form` component with the kit's `Common*` inputs, or `useForm` for the layout settings. Types for laravel-data objects are generated into `resources/js/types`. Every page, route and component is listed in the [Vue kit documentation](/docs/vue.html).

<BlogPostCta title="Start your Vue SaaS dashboard today" text="The SaaS Laravel Vue kit ships Inertia v3 pages for users, roles, tenants and settings, with typed props, shadcn-vue components and permission-aware UI." />
