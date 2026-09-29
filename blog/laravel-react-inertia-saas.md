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

If you like React but don't want to build and maintain a separate API just for your own frontend, Laravel React Inertia is the setup you're after. Your Laravel controllers return React components instead of Blade views, and Inertia handles the glue. I'll walk through the React side of a SaaS app on React 19 and Inertia v3, one piece at a time: the folder layout, typed page components, layout props, app-wide providers, search without effects, forms, imperative modals, and what the React Compiler changes about memoisation.

If you haven't picked a framework yet, start with [Vue, React or Svelte for your Laravel SaaS](/blog/vue-react-or-svelte-laravel-saas.html). From here on I'm assuming React.

## Folder layout for a Laravel React Inertia app

One convention that holds up well as the app grows is kebab-case file names everywhere under `resources/js`:

| Folder | Holds | Example |
| --- | --- | --- |
| `pages/` | One default export per page | `pages/users/index.tsx` |
| `pages/<feature>/partials/` | Page-only pieces | `users/partials/user-form-modal.tsx` |
| `layouts/` | App, auth and settings shells | `layouts/app-layout.tsx` |
| `hooks/` | Custom hooks | `hooks/use-permission.ts` |
| `components/ui/` | shadcn/ui primitives, one file each | `components/ui/dialog.tsx` |

How does PHP find the right file? The Inertia page name is simply the path without the extension, so `Inertia::render('users/index')` renders `pages/users/index.tsx`. The `@inertiajs/vite` plugin builds the page resolver for you, which means `createInertiaApp()` in `app.tsx` doesn't need a `resolve` function at all.

## Typed page components

A page is just a function component that gets its Inertia props as ordinary React props. I like destructuring them in the signature, because then the page's contract is visible at a glance:

```tsx
export default function UsersIndex({ users, stats, filters }: UserIndexProps) {
    const { props } = usePage();
    const currentUserId = props.auth.user.id;

    return <UsersTable users={users.data} currentUserId={currentUserId} />;
}
```

You'll notice `usePage()` has no generic here, and yet `props.auth` is fully typed. That comes from one declaration in `types/global.d.ts`:

```ts
declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: SharedData;
    }
}
```

For the page prop types themselves, you can write them by hand or generate them from spatie/laravel-data classes with `php artisan typescript:transform`. Generating them means one less thing to keep in sync by hand.

## Layout props as a static property

Pick the default layout once in `app.tsx`, based on the page name. Pages under `auth/*` get the auth layout, `settings/*` pages get the app layout plus a settings sub-navigation, and everything else gets the app layout.

When a page needs to pass data up to that layout, breadcrumbs for example, it assigns a plain object to its `layout` property. Inertia v3 keeps the default layout and hands that object to it as props:

```tsx
UsersIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Users', href: index() },
    ],
};
```

Keep in mind that this runs once per module, outside render. So if your breadcrumbs depend on page data, use `setLayoutProps()` instead. Nesting and persistence get their own post: [persistent layouts in Inertia](/blog/inertia-persistent-layouts.html).

## App-wide providers with withApp

Some components have to wrap the whole tree: a tooltip provider, a toaster, maybe a query client. In Inertia v3 they go in the `withApp` option, and `strictMode` switches on React's development checks:

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

Since the `Toaster` lives here, this is also a natural spot for a hook that listens to Inertia's `flash` event and turns server messages into toasts. Inside `useEffect`, return the unsubscribe function from `router.on()` so the listener gets removed on unmount. Turning flash data into toasts is covered step by step in [flash messages and toasts with Inertia](/blog/inertia-flash-messages-toasts.html).

## Search without an effect

A lot of React code stores the search text in state, debounces it into a second value, and fires the request from `useEffect`. It works. It also adds an extra render and an effect you have to reason about. I find it simpler to debounce the request itself, right from the change handler:

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

The input stays controlled and responds instantly. Only the server request waits. If you're writing `useDebounceFn` yourself, keep the latest callback in a ref and create the debounced function once per `delay`. That way the timer survives re-renders, and a `cancel()` in the cleanup stops a request from firing after unmount.

## Forms: useForm or the Form component

When React owns the values, as on a settings screen made of clickable cards, `useForm` gives you everything you need to destructure:

```tsx
const { data, setData, patch, processing, isDirty, reset, setDefaults } = useForm({
    app_layout: layoutSettings.app_layout ?? 'sidebar',
});

const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    patch(update.url(), { preserveScroll: true, onSuccess: () => setDefaults() });
};
```

If you're wondering why `setDefaults()` is there: calling it after a successful save makes the saved data the new baseline, so `isDirty` goes back to false. For ordinary inputs I'd reach for the `Form` component instead, since it's shorter. Spread a Wayfinder action such as `{...store.form()}` onto it and read `errors` and `processing` from its render-prop children. There's more in [the Inertia Form component guide](/blog/inertia-form-component.html).

## Imperative modals with ref as a prop

React 19 passes `ref` to function components like any other prop, so you don't need `forwardRef` any more. A create or edit modal can expose an `open()` method with `useImperativeHandle`:

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

On the page side, keep a `useRef<UserFormModalHandle>(null)` and call `modalRef.current?.open(user)`. One small detail saves a lot of confusion: pass `key={selected?.id ?? 'create'}` to the form inside the modal. React then mounts a fresh form when you switch between records, instead of carrying old values over.

## The React Compiler and memoisation

Once `babel-plugin-react-compiler` is added to `@vitejs/plugin-react` in `vite.config.ts`, the compiler memoises components and values for you. Day to day, that means writing plain derived values instead of wrapping them in `useMemo`:

```tsx
const isEditing = selected !== null;
const title = isEditing ? __('Edit user') : __('Add user');
```

You still need to follow the rules of React: no conditional hooks, and no mutating props or state. Components that break those rules are skipped by the compiler. I'd only reach for `useMemo` or `useCallback` when profiling shows a problem the compiler didn't handle.

## Pitfalls to avoid

The big one is treating hidden UI as authorisation. A `usePermission()` hook is great for hiding buttons, but Laravel middleware and policies still have to reject the request. Anyone can send a request without clicking your button.

Hard-coded URLs are the next thing I'd avoid. With Wayfinder helpers like `index.url()`, a changed route breaks the TypeScript build instead of breaking in production.

Don't be alarmed by double requests in development, either. Strict mode runs effects twice in dev, so anything that should only happen once, like a subscription, needs a cleanup function. And run `tsc --noEmit` alongside ESLint in CI, so prop mismatches fail the build rather than reaching users.

## Frequently asked questions

### Do I need React Router with Laravel and Inertia?

No. Laravel defines every route, and Inertia turns link clicks and form submissions into page visits. Adding React Router would give you a second router fighting with the first.

### Can a Laravel React Inertia app render on the server?

Yes. Inertia supports server-side rendering with a separate SSR build (`vite build --ssr`) and a small Node process. Plenty of dashboards behind a login don't need it, so I'd start without SSR and add it for public pages if search engines matter to you.

### Should I add Redux or Zustand?

Usually not at first. Server data arrives as page props on every visit, so there's very little client state to manage. Add a store only for client-only state that several pages share, such as an open command palette.

### Is the React Compiler safe to use in production?

Yes. The React team released the compiler as stable, and it works on standard React 19 code. Components that break the rules of React are skipped, not miscompiled.

## How SaaS Laravel does it in React

If you'd rather start from working code, the [SaaS Laravel React kit](/kits/react.html) uses React 19 and Inertia v3 with the structure described above. Pages such as `pages/users/index.tsx` set breadcrumbs with `UsersIndex.layout`, `app.tsx` wraps the app in `TooltipProvider` and `Toaster` through `withApp`, and modals like `user-form-modal.tsx` expose `open()` through a ref prop. The React Compiler is enabled in `vite.config.ts`, and `npm run lint` runs ESLint, Prettier and `tsc --noEmit`. Every page, layout and hook is described in the [React kit documentation](/docs/react.html).

<BlogPostCta title="Build your SaaS in React, not from zero" text="The SaaS Laravel React kit ships React 19 and Inertia v3 pages for users, roles, tenants and settings, with shadcn/ui components and typed routes." />
