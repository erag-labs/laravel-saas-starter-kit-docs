---
title: "Laravel and Svelte 5 with Inertia"
description: "Laravel Svelte 5 tutorial with Inertia v3: runes in pages, module-script layout props, the reactive page object, snippets in forms and shared .svelte.ts state."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: frontend
tags: [Svelte, Inertia]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-svelte-inertia.html
  - - meta
    - property: og:title
      content: "Laravel and Svelte 5 with Inertia"
  - - meta
    - property: og:description
      content: "Laravel Svelte 5 tutorial with Inertia v3: runes in pages, module-script layout props, the reactive page object, snippets in forms and shared .svelte.ts state."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-svelte-inertia.html
  - - meta
    - name: twitter:title
      content: "Laravel and Svelte 5 with Inertia"
  - - meta
    - name: twitter:description
      content: "Laravel Svelte 5 tutorial with Inertia v3: runes in pages, module-script layout props, the reactive page object, snippets in forms and shared .svelte.ts state."
---

# Laravel Svelte Tutorial: Runes, Snippets and Inertia v3 in a SaaS App

<BlogPostMeta />

**Laravel and Svelte** fit together well through Inertia. Laravel handles routing, validation and data, and Svelte 5 renders each page with very little code. Svelte 5 replaced much of the older syntax with runes and snippets, though, so many tutorials no longer match what you write today. This guide shows the current way to build SaaS pages: props with `$props()`, layout props from a module script, the reactive `page` object, forms with snippets, and shared state in `.svelte.ts` files.

Deciding between frameworks? See [Vue, React or Svelte for your Laravel SaaS](/blog/vue-react-or-svelte-laravel-saas.html). This article is Svelte only.

## The Svelte 5 pieces you will use in every page

| Rune or syntax | What it replaces | Typical use in an Inertia page |
| --- | --- | --- |
| `$props()` | `export let` | Receive the props from `Inertia::render()` |
| `$state()` / `$state.raw()` | Plain `let` reactivity | Search text, open/closed modals, a selected record |
| `$derived()` | `$:` statements | Values computed from props or `page.props` |
| `$effect()` | `$:` side effects | Trigger a visit when a debounced value changes |
| `{#snippet}` / `{@render}` | Slots | Form render props, layout children |
| `onclick={...}` | `on:click` | Event handlers are plain attributes |

## A Laravel Svelte page from controller to component

The controller stays ordinary Laravel:

```php
return Inertia::render('users/Index', [
    'users' => $this->userService->getUsers($search),
    'filters' => ['search' => $search ?? ''],
]);
```

That renders `resources/js/pages/users/Index.svelte`. The `@inertiajs/vite` plugin generates the page resolver, so `createInertiaApp()` in `app.ts` only sets the title, default layouts and progress bar. In the component, receive the props with one typed rune:

```svelte
<script lang="ts">
    import type { UserIndexProps } from '@/types';

    let props: UserIndexProps = $props();

    const users = $derived(props.users.data);
    const links = $derived(props.users.links);
</script>
```

Keep `props` as an object instead of destructuring it. Each `props.users` read then stays reactive when Inertia reloads the page with new data, for example after a search.

## Layout props from the module script

The default layout is chosen in `app.ts` by page name: auth pages get the auth layout and the rest get the app layout. To give that layout breadcrumbs, export a `layout` object from `<script module>`. It runs once per module, which matches what Inertia expects:

```svelte
<script module lang="ts">
    import { dashboard } from '@/routes';
    import { index } from '@/routes/users';

    export const layout = {
        breadcrumbs: [
            { title: 'Dashboard', href: dashboard() },
            { title: 'Users', href: index() },
        ],
    };
</script>
```

Inertia v3 sees a plain object, keeps the default layout and passes the object in as props. The layout renders the page with `{@render children?.()}`. For values that depend on page data, use `setLayoutProps()` from `@inertiajs/svelte`. More on nesting and persistence in [persistent layouts in Inertia](/blog/inertia-persistent-layouts.html).

## Shared data through the page object

In Inertia v3, `page` from `@inertiajs/svelte` is a reactive object, not a store, so you read it without a `$` prefix:

```svelte
<script lang="ts">
    import { page } from '@inertiajs/svelte';

    const currentUserId = $derived(page.props.auth.user.id);
</script>
```

Typing comes from one declaration: augment `InertiaConfig` in `@inertiajs/core` with `sharedPageProps: SharedData`. After that, `page.props.auth` and `page.props.locale` are typed everywhere. A permission helper can then be a plain function in `lib/permission.ts` that reads `page.props.auth.permissions`. It needs no hook or store, and it works in `{#if can('Create User')}` blocks.

## Page titles without a Head component

The Svelte adapter doesn't export a `Head` component like the Vue and React adapters do. Svelte has `<svelte:head>` built in, so a tiny `AppHead.svelte` wrapper covers it:

```svelte
<script lang="ts">
    let { title = '' }: { title?: string } = $props();

    const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
    const fullTitle = $derived(title ? `${title} - ${appName}` : appName);
</script>

<svelte:head>
    <title>{fullTitle}</title>
</svelte:head>
```

## A debounced search with runes

The search box holds its own `$state`, a debounce helper exposes a getter, and an `$effect` sends the visit:

```ts
let search = $state(untrack(() => props.filters.search));
const debounced = useDebounce(() => search, 300);
let lastSearch = untrack(() => debounced.value);

$effect(() => {
    const value = debounced.value;
    if (value === lastSearch) return;
    lastSearch = value;
    router.get(index.url(), { search: value.trim() || undefined }, {
        preserveScroll: true,
        replace: true,
    });
});
```

Two Svelte 5 details are at work:

- **`untrack()`** marks a deliberate one-time read. The initial search text is copied from the prop once. Without it, Svelte warns that the reference only captures the initial value, which is exactly what you want here.
- **The `lastSearch` guard** stops the effect from firing a visit on mount and from repeating the same query.

Bind the input with `bind:value={search}`, and render rows with a keyed each block, `{#each users as user (user.id)}`, so Svelte reuses rows correctly after a reload.

## Forms: useForm and snippets

`useForm` in the Svelte adapter returns a reactive object whose fields are plain properties. You assign to them directly, with no `$form` store syntax:

```svelte
<script lang="ts">
    const form = useForm(untrack(() => ({ app_layout: layoutSettings.app_layout ?? 'sidebar' })));

    const submit = (event: Event) => {
        event.preventDefault();
        form.patch(update.url(), { preserveScroll: true, onSuccess: () => form.defaults() });
    };
</script>

<button type="button" onclick={() => (form.app_layout = 'header')}>Header</button>
```

For plain input forms, the `Form` component is shorter. It passes `errors` and `processing` through a snippet: `{#snippet children({ errors, processing })}`. Wrap it in `{#key record.id}` to reset it between records. The component itself is covered in [the Inertia Form component guide](/blog/inertia-form-component.html).

## Calling component methods with bind:this

A modal that the page opens can export functions from its instance script:

```svelte
<script lang="ts">
    let isOpen = $state(false);
    let selectedUser = $state.raw<UserManagementUser | null>(null);

    export function open(user?: UserManagementUser): void {
        selectedUser = user ?? null;
        isOpen = true;
    }
</script>
```

The page holds `let modal = $state<UserFormModal | null>(null)`, renders `<UserFormModal bind:this={modal} />` and calls `modal?.open(user)`. `$state.raw` fits the selected record because you replace it as a whole and never mutate it, so deep proxying would be wasted work.

## Shared state in .svelte.ts files

Runes also work outside components, in files ending in `.svelte.ts`. That's the Svelte 5 replacement for many stores. A module-level `$state` becomes app-wide state:

```ts
// lib/theme.svelte.ts
const appearance = $state<{ value: Appearance }>({ value: 'system' });

export function updateAppearance(value: Appearance): void {
    appearance.value = value;
    localStorage.setItem('appearance', value);
}
```

Use this for theme, a global confirm dialog or two-factor setup data. Export an object or getter rather than a reassigned primitive, so importers always see the current value.

## Checklist for a new Svelte page

- Controller returns `Inertia::render('feature/Index', [...])`
- `let props: FeatureIndexProps = $props()`, without destructuring
- Breadcrumbs exported from `<script module>` as `layout`
- Title through `<svelte:head>` or a wrapper component
- Derived values with `$derived`, one-time copies wrapped in `untrack()`
- Keyed `{#each}` blocks for records
- `svelte-check` passes in CI

## Frequently asked questions

### Do I need SvelteKit to use Svelte with Laravel?

No. SvelteKit is a full-stack framework with its own router and server. With Inertia, Laravel is the server and router, so you only need Svelte and the Vite plugin. Aliases such as `$lib` are SvelteKit conventions, so use a path alias like `@/` instead.

### Can I still use Svelte 4 syntax like export let and on:click?

Svelte 5 still compiles most legacy syntax, but a component can't mix runes and legacy reactivity. Once a file uses `$props()` or `$state()`, write the whole file in runes mode.

### Do Svelte stores still work with Inertia v3?

Stores still work in Svelte 5, but in Inertia v3 `page` is a reactive object, not a store. New shared state is usually simpler as runes in a `.svelte.ts` module.

### How do I type page props in a Laravel Svelte app?

Type the component props with `let props: MyPageProps = $props()` and declare shared props once through the `InertiaConfig` augmentation. Types for laravel-data classes can be generated with `php artisan typescript:transform`.

## How SaaS Laravel does it in Svelte

The [SaaS Laravel Svelte kit](/kits/svelte.html) is built on Svelte 5 and Inertia v3 in exactly this style. Pages such as `pages/users/Index.svelte` export breadcrumbs from `<script module>`, read `page.props` directly and use `$effect` with a debounced getter for search. Modals like `UserFormModal.svelte` export `open()` for `bind:this`. Theme and the confirm dialog live in `.svelte.ts` rune modules, and `npm run lint` runs `svelte-check`. The [Svelte kit documentation](/docs/svelte.html) lists every page, layout and component.

<BlogPostCta title="Ship your Svelte SaaS faster" text="The SaaS Laravel Svelte kit ships Svelte 5 and Inertia v3 pages for users, roles, tenants and settings, with shadcn-svelte components and typed routes." />
