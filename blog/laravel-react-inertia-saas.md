---
title: "Building a Laravel SaaS with React and Inertia"
description: "Laravel React Inertia guide for SaaS apps: typed page components, static layout props, withApp providers, useForm, ref-as-prop modals and the React Compiler."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: frontend
tags: [React, Inertia]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-react-inertia-saas.html
  - - meta
    - property: og:title
      content: "Building a Laravel SaaS with React and Inertia"
  - - meta
    - property: og:description
      content: "Laravel React Inertia guide for SaaS apps: typed page components, static layout props, withApp providers, useForm, ref-as-prop modals and the React Compiler."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-react-inertia-saas.html
  - - meta
    - name: twitter:title
      content: "Building a Laravel SaaS with React and Inertia"
  - - meta
    - name: twitter:description
      content: "Laravel React Inertia guide for SaaS apps: typed page components, static layout props, withApp providers, useForm, ref-as-prop modals and the React Compiler."
---

# Laravel React Inertia Guide: Building SaaS Pages with React 19

<BlogPostMeta />

With **Laravel React Inertia**, your Laravel controllers return React components instead of Blade views, and you never build a separate API for your own frontend. This guide walks through the React side of a SaaS app on React 19 and Inertia v3. It covers the folder layout, typed page components, layout props, app-wide providers, search without effects, forms, imperative modals and what the React Compiler changes about memoisation.

Still comparing frameworks? The pillar article [Vue, React or Svelte for your Laravel SaaS](/blog/vue-react-or-svelte-laravel-saas.html) covers that. Here we assume React.

## Folder layout for a React Inertia app

A convention that scales well is kebab-case file names everywhere under `resources/js`:

| Folder | Holds | Example |
| --- | --- | --- |
| `pages/` | One default export per page | `pages/users/index.tsx` |
| `pages/<feature>/partials/` | Page-only pieces | `users/partials/user-form-modal.tsx` |
| `layouts/` | App, auth and settings shells | `layouts/app-layout.tsx` |
| `hooks/` | Custom hooks | `hooks/use-permission.ts` |
| `components/ui/` | shadcn/ui primitives, one file each | `components/ui/dialog.tsx` |

The Inertia page name is the path without the extension. `Inertia::render('users/index')` in PHP renders `pages/users/index.tsx`. The `@inertiajs/vite` plugin builds the page resolver for you, so `createInertiaApp()` in `app.tsx` doesn't need a `resolve` function.

## Typed page components

A page is a function component that receives its Inertia props as ordinary React props. Destructure them in the signature so the contract is visible at a glance:

```tsx
export default function UsersIndex({ users, stats, filters }: UserIndexProps) {
    const { props } = usePage();
    const currentUserId = props.auth.user.id;

    return <UsersTable users={users.data} currentUserId={currentUserId} />;
}
```

`usePage()` has no generic here, yet `props.auth` is fully typed. That comes from a single declaration in `types/global.d.ts`:

```ts
declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: SharedData;
    }
}
```

Page prop types can be written by hand, or generated from spatie/laravel-data classes with `php artisan typescript:transform`.

## Layout props as a static property

Choose the default layout once in `app.tsx`, based on the page name. `auth/*` pages get the auth layout, `settings/*` pages get the app layout plus a settings sub-navigation, and everything else gets the app layout.

A page passes data to that layout, such as breadcrumbs, by assigning a plain object to its `layout` property. Inertia v3 keeps the default layout and hands it the object as props:

```tsx
UsersIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Users', href: index() },
    ],
};
```

This runs once per module, outside render. For breadcrumbs that depend on page data, call `setLayoutProps()` instead. Nesting and persistence are covered in [persistent layouts in Inertia](/blog/inertia-persistent-layouts.html).

## App-wide providers with withApp

Some React components must wrap the whole tree: a tooltip provider, a toaster, maybe a query client. Inertia v3's `withApp` option is the place for them, and `strictMode` turns on React's development checks:

```tsx
createInertiaApp({
    layout: (name) => (name.startsWith('auth/') ? AuthLayout : AppLayout),
    strictMode: true,
    withApp: (app) => (
        <TooltipProvider delayDuration={0}>
            {app}
            <Toaster />
        </TooltipProvider>
    ),
});
```

Because the `Toaster` lives here, it's also a natural home for a hook that listens to Inertia's `flash` event and shows server messages as toasts. In `useEffect`, return the unsubscribe function from `router.on()` so the listener is removed on unmount. Showing flash data as toasts has its own guide: [flash messages and toasts with Inertia](/blog/inertia-flash-messages-toasts.html).

## Search without an effect

A common React habit is to store the search text in state, debounce it into a second value, and fire the request from `useEffect`. That works, but it adds a render and an effect to track. It's simpler to debounce the request itself, straight from the change handler:

```tsx
const [search, setSearch] = useState(filters.search ?? '');

const runSearch = useDebounceFn((value: string) => {
    router.get(index.url(), { search: value.trim() || undefined }, {
        preserveScroll: true,
        replace: true,
    });
}, 300);

const updateSearch = (value: string) => {
    setSearch(value);
    runSearch(value);
};
```

The input stays controlled and instant, and only the server request waits. Inside `useDebounceFn`, keep the latest callback in a ref and build the debounced function once per `delay`. The timer then survives re-renders, and a `cancel()` in the cleanup stops a request after unmount.

## Forms: useForm or the Form component

For forms where React owns the values, such as a settings screen of clickable cards, `useForm` returns everything you need to destructure:

```tsx
const { data, setData, patch, processing, isDirty, reset, setDefaults } = useForm({
    app_layout: layoutSettings.app_layout ?? 'sidebar',
});

const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    patch(update.url(), { preserveScroll: true, onSuccess: () => setDefaults() });
};
```

Calling `setDefaults()` after success makes the saved data the new baseline, so `isDirty` resets. For ordinary inputs, the `Form` component is shorter: spread a Wayfinder action such as `{...store.form()}` onto it and read `errors` and `processing` from its render-prop children. The details are in [the Inertia Form component guide](/blog/inertia-form-component.html).

## Imperative modals with ref as a prop

React 19 passes `ref` to function components like any other prop, so `forwardRef` is no longer needed. A create or edit modal can expose `open()` with `useImperativeHandle`:

```tsx
export interface UserFormModalHandle {
    open: (user?: UserManagementUser) => void;
}

export default function UserFormModal({ ref }: { ref?: Ref<UserFormModalHandle> }) {
    const [selected, setSelected] = useState<UserManagementUser | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useImperativeHandle(ref, () => ({
        open: (user) => { setSelected(user ?? null); setIsOpen(true); },
    }));
    // …Dialog and Form
}
```

The page keeps `useRef<UserFormModalHandle>(null)` and calls `modalRef.current?.open(user)`. Pass `key={selected?.id ?? 'create'}` to the form inside, so React mounts a clean form when switching between records.

## The React Compiler and memoisation

With `babel-plugin-react-compiler` added to `@vitejs/plugin-react` in `vite.config.ts`, the compiler memoises components and values automatically. In practice you write plain derived values instead of wrapping them in `useMemo`:

```tsx
const isEditing = selected !== null;
const title = isEditing ? __('Edit user') : __('Add user');
```

Keep following the rules of React: no conditional hooks and no mutation of props or state. The compiler skips components that break them. Reach for `useMemo` or `useCallback` only when profiling shows a problem the compiler didn't solve.

## Pitfalls to avoid

- **Hiding UI is not authorisation.** A `usePermission()` hook can hide buttons, but Laravel middleware and policies must still reject the request.
- **Hard-coded URLs.** Wayfinder helpers like `index.url()` break the TypeScript build when a route changes, instead of breaking in production.
- **Double requests in development.** Strict mode runs effects twice in development. Code that works only once, such as subscriptions, needs a cleanup.
- **Type checks in CI.** Run `tsc --noEmit` together with ESLint, so prop mismatches fail the build.

## Frequently asked questions

### Do I need React Router with Laravel and Inertia?

No. Laravel defines every route, and Inertia turns link clicks and form submissions into page visits. Adding React Router would give you a second, conflicting router.

### Can a Laravel React Inertia app render on the server?

Yes. Inertia supports server-side rendering with a separate SSR build (`vite build --ssr`) and a small Node process. Many dashboards behind a login don't need it, so start without SSR and add it for public pages if search engines matter.

### Should I add Redux or Zustand?

Usually not at first. Server data arrives as page props on every visit, so there is little client state to manage. Add a store only for client-only state shared by several pages, such as an open command palette.

### Is the React Compiler safe to use in production?

Yes. The React team released the compiler as stable, and it works on standard React 19 code. Components that break the rules of React are skipped rather than miscompiled.

## How SaaS Laravel does it in React

The [SaaS Laravel React kit](/kits/react.html) uses React 19 and Inertia v3 with the structure above. Pages such as `pages/users/index.tsx` set breadcrumbs with `UsersIndex.layout`, `app.tsx` wraps the app in `TooltipProvider` and `Toaster` through `withApp`, and modals like `user-form-modal.tsx` expose `open()` through a ref prop. The React Compiler is enabled in `vite.config.ts`, and `npm run lint` runs ESLint, Prettier and `tsc --noEmit`. The [React kit documentation](/docs/react.html) describes every page, layout and hook.

<BlogPostCta title="Build your SaaS in React, not from zero" text="The SaaS Laravel React kit ships React 19 and Inertia v3 pages for users, roles, tenants and settings, with shadcn/ui components and typed routes." />
