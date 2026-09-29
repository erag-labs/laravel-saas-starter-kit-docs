---
title: "Persistent Layouts in Inertia"
description: "How Inertia layouts work: persistent, nested and default layouts, plus layout props with setLayoutProps, with Vue, React and Svelte examples for Laravel apps."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: frontend
tags: [Inertia, Frontend]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/inertia-persistent-layouts.html
  - - meta
    - property: og:title
      content: "Persistent Layouts in Inertia"
  - - meta
    - property: og:description
      content: "How Inertia layouts work: persistent, nested and default layouts, plus layout props with setLayoutProps, with Vue, React and Svelte examples for Laravel apps."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/inertia-persistent-layouts.html
  - - meta
    - name: twitter:title
      content: "Persistent Layouts in Inertia"
  - - meta
    - name: twitter:description
      content: "How Inertia layouts work: persistent, nested and default layouts, plus layout props with setLayoutProps, with Vue, React and Svelte examples for Laravel apps."
---

# Inertia Layouts: Persistent, Nested and Default Layouts in Vue, React and Svelte

<BlogPostMeta />

A SaaS dashboard has a sidebar, a top bar, maybe a toaster and a confirm dialog, and you want all of them to stay put while the user clicks between pages. Inertia layouts can do exactly that. Set up properly, the layout stays mounted across visits and only the page inside it changes. I'll walk through persistent layouts, nested layouts, the default layout option that arrived in Inertia v3, and layout props for titles and breadcrumbs, with examples for Vue, React and Svelte.

## Why wrapping a page in a layout resets it

Most people start by having the page render its own layout, because it's the obvious thing to write:

```vue
<template>
    <AppLayout>
        <h1>Projects</h1>
    </AppLayout>
</template>
```

It works. The catch is that the layout is now part of the page. When Inertia swaps to the next page component, the old page is destroyed and the layout goes with it, and then both get created again. The sidebar loses its scroll position, an open dropdown closes, a playing video stops, and any state held in the layout is gone.

## Persistent Inertia layouts per page

The fix is to declare the layout *next to* the page instead of inside it. Inertia then renders the layout itself, puts the page inside, and keeps the same layout instance when the next page uses it too.

::: code-group

```vue [Vue]
<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';

defineOptions({ layout: AppLayout });
</script>

<template>
    <h1>Projects</h1>
</template>
```

```tsx [React]
import AppLayout from '@/layouts/app-layout';

export default function Projects() {
    return <h1>Projects</h1>;
}

Projects.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
```

```svelte [Svelte]
<script module>
    export { default as layout } from '@/layouts/AppLayout.svelte';
</script>

<h1>Projects</h1>
```

:::

The layout renders the page wherever Vue has a `slot`, React has `children` and Svelte has `{@render children()}`. If you're on Vue older than 3.3, `defineOptions` isn't available; use a second `<script>` block with `export default { layout: AppLayout }` instead.

One React detail that's easy to trip over: in v3, a layout that's an arrow function component has to be wrapped in an array, like `Projects.layout = [ArrowLayout]`.

## Nesting layouts inside each other

Settings pages usually sit inside the app shell *and* a settings sub-navigation. Pass an array, and Inertia nests them from the outside in:

::: code-group

```vue [Vue]
defineOptions({ layout: [AppLayout, SettingsLayout] });
```

```tsx [React]
Profile.layout = [AppLayout, SettingsLayout];
```

```svelte [Svelte]
<script module>
    import AppLayout from '@/layouts/AppLayout.svelte';
    import SettingsLayout from '@/layouts/settings/Layout.svelte';

    export const layout = [AppLayout, SettingsLayout];
</script>
```

:::

Moving from one settings page to another keeps both layouts mounted. Moving to the dashboard keeps `AppLayout` and removes only `SettingsLayout`.

## Default layouts in createInertiaApp

Declaring the layout on every page gets repetitive, and sooner or later someone forgets one. Inertia v3 adds a `layout` option to `createInertiaApp()` that picks a layout from the page name:

```ts
createInertiaApp({
    layout: (name) => {
        if (name.startsWith('auth/')) return AuthLayout;
        if (name.startsWith('settings/')) return [AppLayout, SettingsLayout];
        if (name.startsWith('public/')) return null;

        return AppLayout;
    },
});
```

Returning `null` means no layout at all. The callback also gets the full page object as a second argument, and it accepts every format a page can use: a component, an array, a tuple with props or a named object. If a page sets its own layout, that still wins over the default. I've summed up the other [Inertia v3 changes](/blog/inertia-js-v3-whats-new.html) in a separate post.

For most apps I'd set defaults here and only override on the odd page. It keeps the layout decision in one file where you can see all of it.

## Passing data to a layout with layout props

Layouts often need something from the page: a title, breadcrumbs, whether to show the sidebar. Layout props let the page send that data up without prop drilling or a global store.

### Give the layout defaults

A layout is just a component with props, so give each prop a default:

::: code-group

```vue [Vue]
<script setup lang="ts">
const { title = 'My App', breadcrumbs = [] } = defineProps<{
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
}>();
</script>
```

```tsx [React]
export default function AppLayout({ title = 'My App', breadcrumbs = [], children }: Props) {
    return <Shell title={title} breadcrumbs={breadcrumbs}>{children}</Shell>;
}
```

```svelte [Svelte]
<script lang="ts">
    let { title = 'My App', breadcrumbs = [], children } = $props();
</script>
```

:::

### Static and callback props

When the value is fixed, pass it along with the layout. A tuple sets the layout and its props in one go: `defineOptions({ layout: [AppLayout, { title: 'Projects' }] })`. And if a default layout is already configured, the page can pass just the props:

```tsx
Projects.layout = {
    breadcrumbs: [{ title: 'Projects', href: '/projects' }],
};
```

When the value depends on the page's data, use a callback instead. It receives the page props:

```ts
Profile.layout = (props) => ({ title: `Profile: ${props.auth.user.name}` });
```

### Dynamic props with setLayoutProps

Sometimes you only know the value while the page is running, for example when a prop decides which mode the page is in. For that, call `setLayoutProps()` from the page:

```ts
import { setLayoutProps } from '@inertiajs/vue3'; // or /react, /svelte

if (props.mode === 'user') {
    setLayoutProps({ title: 'Join your team' });
}
```

If you're wondering what happens when more than one of these sets the same prop, they're merged in a fixed order:

| Priority | Source |
| --- | --- |
| 1 (highest) | Dynamic props from `setLayoutProps()` |
| 2 | Static props from the page's layout definition |
| 3 (lowest) | Default values in the layout component |

Dynamic props are reset on every navigation unless the visit uses `preserveState`. You can also clear them yourself with `resetLayoutProps()`.

### Named layouts

With nested layouts, a prop like `title` could belong to either one. Named layouts clear that up. Declare `layout: { app: AppLayout, content: ContentLayout }` on the page, then target one of them with `setLayoutProps('content', { padding: 'sm' })`.

## Typing layout props

Inertia's `InertiaConfig` interface accepts a `layoutProps` key, the same way it does for shared page props. Declare it once and `setLayoutProps()` will check your keys:

```ts
declare module '@inertiajs/core' {
    export interface InertiaConfig {
        layoutProps: {
            title: string;
            breadcrumbs: BreadcrumbItem[];
        };
    }
}
```

## What belongs in a persistent layout

A simple rule: anything that should survive navigation goes in the layout, and page data stays in the page.

| Put in the layout | Keep in the page |
| --- | --- |
| Sidebar, top bar and user menu | Data that belongs to one page, such as a project list |
| The toast container | Logic that must run again on every visit |
| Global dialogs, such as a confirm dialog | Page-specific forms and their state |
| Data from shared props, read with `usePage()` (or `page` in Svelte) | Props passed by the page's controller |

The toast container needs to live in the layout (or the app root) so that messages flashed on a redirect have somewhere to appear. More on that in [flash messages and toasts with Inertia](/blog/inertia-flash-messages-toasts.html).

**A persistent layout's setup code runs only when it first mounts.** That's the most common surprise. If the layout needs to react to navigation, watch the page URL or props rather than counting on the component being created again.

## Frequently asked questions

### What is the difference between a persistent layout and a regular layout in Inertia?

A regular layout is rendered inside the page component, so it's destroyed and recreated on every visit. A persistent layout is declared on the page and rendered by Inertia, which means the same instance stays mounted (state and all) while you move between pages that use it.

### How do I set the page title in an Inertia layout?

For the browser tab, use Inertia's `Head` component in the page. For a visible heading or breadcrumbs in the layout, pass a layout prop, either statically in the layout definition or with `setLayoutProps()`.

### Can a page opt out of the default layout?

Yes. Set a different layout on the page and it overrides the default. If you want a page with no layout at all, return `null` for it from the default `layout` callback in `createInertiaApp()`.

### Why doesn't my layout update when I navigate?

Because it persists, its setup code only runs once. Read changing values through reactive page data (`usePage()` in Vue and React, `page` in Svelte) or through layout props, not through variables that were set once when the layout was created.

## Layouts in SaaS Laravel

If you'd rather not set all this up yourself, the [SaaS Laravel starter kits](/) already choose default layouts in `createInertiaApp()` by page name. `auth/*` pages get the auth layout, `settings/*` pages get the app layout plus the settings navigation, and everything else gets the app layout. Pages send breadcrumbs, or an auth page title and description, as props-only layout objects, and the invitation page switches its title with `setLayoutProps()`. Public pages such as the home page opt out with an empty layout array. The app layout then renders a sidebar or header shell, picked from the layout setting shared with every page. See [Vue kit layouts](/docs/vue/layouts.html), [navigation and layouts](/docs/core/navigation-and-layouts.html) and the [Vue, React or Svelte guide](/blog/vue-react-or-svelte-laravel-saas.html).

<BlogPostCta title="App and auth layouts, ready to use" text="SaaS Laravel kits ship persistent sidebar, header and sign-in layouts with breadcrumbs and per-user layout settings, in Vue, React or Svelte." />
