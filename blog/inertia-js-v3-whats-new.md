---
title: "Inertia.js v3: What's New for Laravel"
description: "Inertia v3 for Laravel explained: the new Vite plugin, useHttp, optimistic updates, instant visits, layout props, breaking changes and an upgrade checklist."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: frontend
tags: [Inertia, Frontend]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/inertia-js-v3-whats-new.html
  - - meta
    - property: og:title
      content: "Inertia.js v3: What's New for Laravel"
  - - meta
    - property: og:description
      content: "Inertia v3 for Laravel explained: the new Vite plugin, useHttp, optimistic updates, instant visits, layout props, breaking changes and an upgrade checklist."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/inertia-js-v3-whats-new.html
  - - meta
    - name: twitter:title
      content: "Inertia.js v3: What's New for Laravel"
  - - meta
    - name: twitter:description
      content: "Inertia v3 for Laravel explained: the new Vite plugin, useHttp, optimistic updates, instant visits, layout props, breaking changes and an upgrade checklist."
---

# Inertia v3 for Laravel: New Features, Breaking Changes and How to Upgrade

<BlogPostMeta />

If you've got a Laravel app on Inertia v2, you're probably wondering how much work Inertia v3 will be. It's the biggest release of the adapter since v2: Axios is gone, a new Vite plugin removes most of the setup code, and there are new tools like `useHttp`, optimistic updates, instant visits and layout props. Below I'll go through what's new, which breaking changes to search your code for, and the upgrade steps in order.

Everything here was checked against `inertiajs/inertia-laravel` 3.3 and the `@inertiajs/*` 3.7 packages.

## Inertia v3 at a glance

| Area | Inertia v2 | Inertia v3 |
| --- | --- | --- |
| HTTP client | Axios (bundled) | Built-in XHR client with interceptors |
| Page resolution | `resolve` callback with `import.meta.glob` | Optional `@inertiajs/vite` plugin does it for you |
| SSR in development | Separate build and SSR server | Runs inside the normal Vite dev server |
| Layouts | Set on each page | Default layouts in `createInertiaApp`, plus layout props |
| Non-page requests | Axios or `fetch` by hand | `useHttp` with form-like state |
| Lazy props | `Inertia::lazy()` (deprecated) | Removed, use `Inertia::optional()` |
| Packages | CommonJS and ESM | ESM only, ES2022 target |

## Requirements for Inertia v3

You'll need **PHP 8.2+, Laravel 11+ and Node 20+**. The adapter supports Laravel 11, 12 and 13. On the frontend, the React adapter requires React 19 and the Svelte adapter requires Svelte 5 with runes, while the Vue adapter works with any Vue 3 release.

Still on React 18 or Svelte 4? Upgrade the framework first, then Inertia. Doing both at once makes it much harder to tell which change broke what.

## What's new in Inertia v3

### The @inertiajs/vite plugin

The new Vite plugin does two jobs. It turns page resolution into a shorthand, so you stop writing `import.meta.glob` code yourself. It also runs SSR inside the Vite dev server during development, which means no more `vite build --ssr` or `php artisan inertia:start-ssr` while you work.

```ts
// vite.config.ts
import inertia from '@inertiajs/vite';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({ input: ['resources/js/app.ts'] }),
        inertia(),
    ],
});
```

With the plugin in place, `createInertiaApp()` can drop the `resolve` callback entirely, or take a short `pages: './pages'` option instead. You don't have to adopt it, though. A hand-written `resolve` function still works.

### Default layouts and layout props

`createInertiaApp()` now accepts a `layout` option, so you can choose a layout for every page in one place based on the page name. Pages can also pass data up to their layout, like a title or breadcrumbs, with static props or `setLayoutProps()`.

If you've read early upgrade notes that mention a `useLayoutProps` hook, that's where the confusion comes from. In the installed 3.7 adapters the exported function is `setLayoutProps()`, with `resetLayoutProps()` beside it. I go through both step by step in [persistent layouts in Inertia](/blog/inertia-persistent-layouts.html).

### useHttp for plain JSON requests

Not every request should be a page visit. Loading a QR code, running a search or checking a slug only needs JSON back. `useHttp` gives those requests the same state you already know from `useForm` (`processing`, `errors`, progress and cancellation), and it does it without Axios.

```vue
<script setup lang="ts">
import { useHttp } from '@inertiajs/vue3';

const http = useHttp({ query: '' });

function search() {
    http.get('/api/search', {
        onSuccess: (response) => console.log(response),
    });
}
</script>
```

### Optimistic updates

`router.optimistic()` changes the page props straight away, before the server answers. If the request fails, Inertia rolls the props back for you. It works with `useForm`, `useHttp` and the `optimistic` prop of the `Form` component too.

```ts
router.optimistic((props) => ({
    post: { ...props.post, likes: props.post.likes + 1 },
})).post(`/posts/${post.id}/like`);
```

### Instant visits

Give a `Link` the name of the target component, and Inertia switches to that page immediately. It renders with the shared props while the request runs in the background, and the page-specific props fill in when the server responds.

```vue
<Link href="/dashboard" component="Dashboard">Dashboard</Link>
```

### Custom error pages from exceptions

`Inertia::handleExceptionsUsing()` lets you render an Inertia page for any exception response. Calling `withSharedData()` adds your shared props even when the error happened outside the Inertia middleware, which is the case for most 404s. If your callback returns nothing, Laravel's default rendering takes over.

```php
// app/Providers/AppServiceProvider.php
Inertia::handleExceptionsUsing(function (ExceptionResponse $response) {
    if (in_array($response->statusCode(), [403, 404, 500, 503])) {
        return $response->render('errors/Error', [
            'status' => $response->statusCode(),
        ])->withSharedData();
    }
});
```

### Smaller additions

A few smaller changes are easy to miss in the release notes:

- `Inertia::render()` accepts enums. A backed enum's value (or a unit enum's name) can be the component name.
- `preserveErrors` keeps validation errors during partial reloads.
- Form component generics give you typed `errors` and slot props in TypeScript.
- Nested prop types: `Inertia::optional()`, `Inertia::defer()` and `Inertia::merge()` resolve inside nested arrays and closures, and `only`, `except`, `Deferred` and `WhenVisible` accept dot-notation paths.
- `http.onRequest()`, `http.onResponse()` and `http.onError()` replace Axios interceptors.

There are also new Blade components. `<x-inertia::head>` and `<x-inertia::app>` can replace the `@inertiaHead` and `@inertia` directives, and the head slot only renders when SSR is off, which avoids duplicate `<title>` tags. The directives still work. Finally, the Inertia middleware now registers itself at the right priority, so you can delete any manual priority setup.

## Inertia v3 breaking changes to check before you upgrade

Most apps only need a few edits. I'd search your code for each item in this table:

| Change in Inertia v3 | What to do |
| --- | --- |
| Axios removed | Nothing, unless you import Axios yourself. Then `npm install axios`. |
| `qs` and `lodash-es` no longer bundled | Install them directly if your code imports them. |
| Events `invalid` and `exception` | Rename to `httpException` and `networkError` (document events: `inertia:httpException`, `inertia:networkError`). |
| `router.cancel()` | Use `router.cancelAll()`. |
| `future` options in `createInertiaApp` | Remove them. All four v2 future flags are now always on. |
| `hideProgress()` / `revealProgress()` | Use the exported `progress` object: `progress.hide()`, `progress.reveal()`. |
| `Inertia::lazy()` and `LazyProp` | Replace with `Inertia::optional()`. |
| `config/inertia.php` layout | Page settings moved from `testing` into a new `pages` key. Republish the config. |
| Old testing traits `Has`, `Matching`, `Debugging` | Use `AssertableInertia` (most apps already do). |
| `require()` imports | Switch to `import`. The packages are ESM only. |

Some behaviour changes won't show up in a search, so give them a quick test. `useForm` now resets `processing` and `progress` inside `onFinish`. React's `Deferred` no longer shows its fallback again during a partial reload, which brings it in line with Vue and Svelte. The initial page data is always sent in a `<script type="application/json">` element, and `clearHistory` and `encryptHistory` are left out of the page object unless they're `true`.

## Upgrade checklist

1. Check the requirements: PHP 8.2, Laravel 11, Node 20, React 19 or Svelte 5.
2. Update the server adapter: `composer require inertiajs/inertia-laravel:^3.0`.
3. Update your client adapter, for example `npm install @inertiajs/vue3@^3.0`.
4. Optionally add the Vite plugin: `npm install @inertiajs/vite@^3.0`.
5. Republish the config with `php artisan vendor:publish --provider="Inertia\ServiceProvider" --force`, re-apply your changes, then run `php artisan view:clear`.
6. Work through the breaking-changes table above.
7. Run your test suite and click through forms, file uploads and error pages.

Take care with step 5. **Republishing with `--force` overwrites your config**, so keep a copy of your old `config/inertia.php` to re-apply your changes from.

## What carries over from v2

Everything you used in v2 still works: deferred props, merging props, polling, prefetching, once props, infinite scroll and history encryption. You also get flash data (`Inertia::flash()`), which suits toasts far better than shared session props. I cover that in [flash messages and toasts with Inertia](/blog/inertia-flash-messages-toasts.html).

For forms, the `Form` component is still the simplest option, and in v3 it gains the `optimistic` prop and typed slot props. The [Inertia Form component guide](/blog/inertia-form-component.html) walks through it.

## Frequently asked questions

### Do I still need Axios with Inertia v3?

No. Inertia v3 ships its own HTTP client with request, response and error interceptors. You'd only install Axios if your own code imports it; the core package lists it as an optional peer dependency.

### Is the @inertiajs/vite plugin required?

No, it's optional. Without it, you keep a `resolve` callback in `createInertiaApp()` and set up SSR the way you did before. With it, page resolution becomes one line and SSR runs in the Vite dev server during development. For a new project I'd use it.

### Does Inertia v3 work with Laravel 10?

No. The Laravel adapter needs Laravel 11 or newer and PHP 8.2 or newer, so upgrade Laravel first and Inertia second.

### Can I keep the @inertia and @inertiaHead Blade directives?

Yes. The new `<x-inertia::app>` and `<x-inertia::head>` components are an alternative, not a replacement. They're worth switching to if you use SSR and see duplicate `<title>` tags.

## Inertia v3 in SaaS Laravel

If you'd rather start on v3 than upgrade to it, the [SaaS Laravel starter kits](/) are already built on Inertia v3 (`inertiajs/inertia-laravel` ^3.0 and `@inertiajs/*` ^3.0) with the `@inertiajs/vite` plugin, so `app.ts` has no `resolve` callback. Default layouts are chosen by page name in `createInertiaApp()`. There's no Axios: forms use the `Form` component, two-factor QR and recovery codes load through `useHttp`, and controllers send toasts with `Inertia::flash()`. The root view uses `<x-inertia::head>` and `<x-inertia::app>`. You can read more in [Inertia v3 with Vue](/docs/vue/inertia.html), or compare the three frontends in [Vue, React or Svelte for your Laravel SaaS](/blog/vue-react-or-svelte-laravel-saas.html).

<BlogPostCta title="Start on Inertia v3 from day one" text="SaaS Laravel kits run on Inertia v3 with the Vite plugin, the Form component and flash toasts, in Vue, React or Svelte on the same Laravel backend." />
