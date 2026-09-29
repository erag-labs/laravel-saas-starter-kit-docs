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

If you've searched for a Laravel Svelte tutorial lately, you've probably found plenty that no longer match the code you're writing. Svelte 5 swapped much of the older syntax for runes and snippets, and a lot of guides haven't caught up. The pairing itself still works really well through Inertia: Laravel handles routing, validation and data, and Svelte 5 renders each page with very little code. So I want to walk through the current way to build SaaS pages, one piece at a time: props with `$props()`, layout props from a module script, the reactive `page` object, forms with snippets, and shared state in `.svelte.ts` files.

Still deciding on a framework? [Vue, React or Svelte for your Laravel SaaS](/blog/vue-react-or-svelte-laravel-saas.html) compares them. Everything below is Svelte only.

## The Svelte 5 syntax behind every Inertia page

Here's a quick map from the old syntax to the new, so the code later on reads naturally:

| Rune or syntax | What it replaces | Typical use in an Inertia page |
| --- | --- | --- |
| `$props()` | `export let` | Receive the props from `Inertia::render()` |
| `$state()` / `$state.raw()` | Plain `let` reactivity | Search text, open/closed modals, a selected record |
| `$derived()` | `$:` statements | Values computed from props or `page.props` |
| `$effect()` | `$:` side effects | Trigger a visit when a debounced value changes |
| `{#snippet}` / `{@render}` | Slots | Form render props, layout children |
| `onclick={...}` | `on:click` | Event handlers are plain attributes |

## A Laravel Svelte page from controller to component

Nothing changes on the Laravel side. The controller is ordinary Laravel:

```php
return Inertia::render('users/Index', [
    'users' => $this->userService->getUsers($search),
    'filters' => ['search' => $search ?? ''],
]);
```

That renders `resources/js/pages/users/Index.svelte`. You don't write a page resolver yourself, because the `@inertiajs/vite` plugin generates it. That leaves `createInertiaApp()` in `app.ts` with very little to do: it sets the title, default layouts and progress bar. In the component, one typed rune receives the props:

```svelte
<script lang="ts">
    import type { UserIndexProps } from '@/types';

    let props: UserIndexProps = $props();

    const users = $derived(props.users.data);
    const links = $derived(props.users.links);
</script>
```

Notice that `props` stays an object. It's tempting to destructure it, but then you'd lose reactivity. Reading `props.users` each time means it stays reactive when Inertia reloads the page with new data, for example after a search.

## Layout props from the module script

Default layouts are picked in `app.ts` by page name. Auth pages get the auth layout and everything else gets the app layout. So how does a page give that layout its breadcrumbs? You export a `layout` object from `<script module>`. That block runs once per module, which is exactly what Inertia expects:

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

Inertia v3 sees a plain object, keeps the default layout and hands the object to it as props. The layout then renders the page with `{@render children?.()}`. If a value depends on page data, a module script can't see it, so use `setLayoutProps()` from `@inertiajs/svelte` instead. Nesting and persistence get their own write-up in [persistent layouts in Inertia](/blog/inertia-persistent-layouts.html).

## Shared data through the page object

This one tripped me up at first. In Inertia v3, `page` from `@inertiajs/svelte` is a reactive object, not a store, so you read it without a `$` prefix:

```svelte
<script lang="ts">
    import { page } from '@inertiajs/svelte';

    const currentUserId = $derived(page.props.auth.user.id);
</script>
```

Types come from a single declaration. Augment `InertiaConfig` in `@inertiajs/core` with `sharedPageProps: SharedData`, and `page.props.auth` and `page.props.locale` are typed everywhere. A permission helper can then be a plain function in `lib/permission.ts` that reads `page.props.auth.permissions`. It doesn't need a hook or a store, and it works fine inside `{#if can('Create User')}` blocks.

## Page titles without a Head component

You might go looking for a `Head` component like the Vue and React adapters have. The Svelte adapter doesn't export one. Svelte already has `<svelte:head>` built in, so a tiny `AppHead.svelte` wrapper is all you need:

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

Search has three moving parts. The input holds its own `$state`, a debounce helper exposes a getter, and an `$effect` sends the visit:

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

If you're wondering what `untrack()` is doing there, it marks a deliberate one-time read. The initial search text is copied from the prop once and never again. Without `untrack()`, Svelte warns that the reference only captures the initial value, which in this case is exactly what you want.

The `lastSearch` guard does a different job. It stops the effect from firing a visit on mount, and from sending the same query twice.

To finish it off, bind the input with `bind:value={search}` and render rows in a keyed each block, `{#each users as user (user.id)}`, so Svelte reuses rows correctly after a reload.

## Forms: useForm and snippets

In the Svelte adapter, `useForm` returns a reactive object whose fields are plain properties. You assign to them directly. There's no `$form` store syntax any more:

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

For forms that are mostly plain inputs, I'd reach for the `Form` component instead, because it's shorter. It passes `errors` and `processing` through a snippet: `{#snippet children({ errors, processing })}`. When the same form edits different records, wrap it in `{#key record.id}` so it resets between them. The component itself is covered in [the Inertia Form component guide](/blog/inertia-form-component.html).

## Calling component methods with bind:this

Sometimes the page needs to open a modal and tell it which record to show. The modal can export functions from its instance script:

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

On the page, hold `let modal = $state<UserFormModal | null>(null)`, render `<UserFormModal bind:this={modal} />` and call `modal?.open(user)`. Why `$state.raw` for the selected record? You replace it as a whole and never mutate it, so deep proxying would be wasted work.

## Shared state in .svelte.ts files

Runes aren't limited to components. They also work in files ending in `.svelte.ts`, and that's the Svelte 5 replacement for a lot of stores. A module-level `$state` becomes app-wide state:

```ts
// lib/theme.svelte.ts
const appearance = $state<{ value: Appearance }>({ value: 'system' });

export function updateAppearance(value: Appearance): void {
    appearance.value = value;
    localStorage.setItem('appearance', value);
}
```

This suits things like the theme, a global confirm dialog or two-factor setup data. One detail to get right: export an object or a getter, not a primitive you reassign. Otherwise importers won't always see the current value.

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

No. SvelteKit is a full-stack framework with its own router and server. With Inertia, Laravel already is the server and router, so all you need is Svelte and the Vite plugin. Aliases such as `$lib` are SvelteKit conventions, so use a path alias like `@/` instead.

### Can I still use Svelte 4 syntax like export let and on:click?

Svelte 5 still compiles most legacy syntax, but a single component can't mix runes and legacy reactivity. As soon as a file uses `$props()` or `$state()`, write the whole file in runes mode.

### Do Svelte stores still work with Inertia v3?

Stores still work in Svelte 5. In Inertia v3, though, `page` is a reactive object rather than a store. For new shared state, runes in a `.svelte.ts` module are usually the simpler choice.

### How do I type page props in a Laravel Svelte app?

Type the component props with `let props: MyPageProps = $props()`, and declare shared props once through the `InertiaConfig` augmentation. For laravel-data classes, `php artisan typescript:transform` can generate the types.

## How SaaS Laravel does it in Svelte

If you'd rather start from working pages than wire all of this up yourself, the [SaaS Laravel Svelte kit](/kits/svelte.html) is built on Svelte 5 and Inertia v3 in exactly this style. Pages such as `pages/users/Index.svelte` export breadcrumbs from `<script module>`, read `page.props` directly and use `$effect` with a debounced getter for search. Modals like `UserFormModal.svelte` export `open()` for `bind:this`. The theme and the confirm dialog live in `.svelte.ts` rune modules, and `npm run lint` runs `svelte-check`. Every page, layout and component is listed in the [Svelte kit documentation](/docs/svelte.html).

<BlogPostCta title="Ship your Svelte SaaS faster" text="The SaaS Laravel Svelte kit ships Svelte 5 and Inertia v3 pages for users, roles, tenants and settings, with shadcn-svelte components and typed routes." />
