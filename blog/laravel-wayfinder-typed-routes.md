---
title: "Typed Routes with Laravel Wayfinder"
description: "How Laravel Wayfinder turns your routes and controllers into typed TypeScript functions: setup, the Vite plugin, .url(), parameters, forms and practical tips."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: architecture
tags: [TypeScript, Inertia]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-wayfinder-typed-routes.html
  - - meta
    - property: og:title
      content: "Typed Routes with Laravel Wayfinder"
  - - meta
    - property: og:description
      content: "How Laravel Wayfinder turns your routes and controllers into typed TypeScript functions: setup, the Vite plugin, .url(), parameters, forms and practical tips."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-wayfinder-typed-routes.html
  - - meta
    - name: twitter:title
      content: "Typed Routes with Laravel Wayfinder"
  - - meta
    - name: twitter:description
      content: "How Laravel Wayfinder turns your routes and controllers into typed TypeScript functions: setup, the Vite plugin, .url(), parameters, forms and practical tips."
---

# Laravel Wayfinder: Typed Routes for Your Inertia Frontend

<BlogPostMeta />

**Laravel Wayfinder** generates TypeScript functions for your controllers and named routes. Instead of typing `'/tenants/' + id` in a Vue, React or Svelte component, you import a function, pass it the ID and get back the right URL and HTTP method — with TypeScript checking every call.

This guide covers how Wayfinder works, how to install and generate it, how to use it for links, visits and forms, how it compares to Ziggy, and a few tips from using it in a real SaaS codebase.

## What Laravel Wayfinder does

Wayfinder reads the routes registered in your Laravel app and writes TypeScript files into `resources/js`:

| Directory | Contains |
| --- | --- |
| `actions/` | One file per controller, with a function for each routed method |
| `routes/` | One function per named route, grouped by the route name |
| `wayfinder/` | Shared helpers and types used by the generated files |

Each function returns an object with the URL and the default method:

```ts
import { destroy } from '@/routes/tenants';

destroy(5);     // { url: '/tenants/5', method: 'delete' }
destroy.url(5); // '/tenants/5'
```

Because these are real TypeScript functions, a missing parameter or a misspelled route is a type error instead of a broken link in production.

::: warning Still in beta
Wayfinder is pre-1.0. Its README notes that the API may change before the v1.0.0 release, so pin the version in `composer.json` and read the changelog when you update.
:::

## Installing and generating

Install the package with Composer, then generate the files:

```bash
composer require laravel/wayfinder
php artisan wayfinder:generate
```

The command has four options:

| Option | Effect |
| --- | --- |
| `--with-form` | Also generate `.form()` variants for HTML and Inertia forms |
| `--skip-actions` | Don't generate the controller-based `actions/` files |
| `--skip-routes` | Don't generate the named-route `routes/` files |
| `--path=` | Write the files somewhere other than `resources/js` |

### The Vite plugin

Running the command by hand gets old quickly. The `@laravel/vite-plugin-wayfinder` package runs it for you when Vite starts (`npm run dev` or `npm run build`) and again when a watched PHP file changes:

```ts
import { wayfinder } from '@laravel/vite-plugin-wayfinder';

export default defineConfig({
    plugins: [
        // laravel(), vue(), ...
        wayfinder({
            formVariants: true, // passes --with-form
        }),
    ],
});
```

Since the files are regenerated on every build, you can add `resources/js/actions`, `resources/js/routes` and `resources/js/wayfinder` to `.gitignore`.

## Importing from @/actions and @/routes

You can reach the same endpoint in two ways:

| Import from | Based on | Example |
| --- | --- | --- |
| `@/routes/...` | Route names | `tenants.index` → `import { index } from '@/routes/tenants'` |
| `@/actions/...` | Controller classes | `import ProfileController from '@/actions/Modules/Settings/Http/Controllers/ProfileController'` |

A route without a dot in its name, such as `dashboard`, is exported from `@/routes` directly. Controller paths mirror the PHP namespace, so a controller in a feature module ends up under `@/actions/Modules/...` — handy if you use a [modular Laravel architecture](/blog/modular-laravel-architecture.html).

Prefer **named imports** (`import { index, destroy } from ...`). Importing a whole controller as a default export keeps all of its functions in your bundle, while named imports let the bundler drop the ones you don't use. Invokable controllers are the exception: their default export is the function itself.

## Using .url() and parameters

Wayfinder functions work anywhere a URL or a route object is expected. In Vue with Inertia:

```vue
<Link :href="dashboard()">Dashboard</Link>
```

```ts
router.get(index.url(), { search: value.trim() || undefined }, { preserveScroll: true, replace: true });

router.delete(destroy.url(role.id), { preserveScroll: true });
```

`Link` accepts the `{ url, method }` object directly, while `router` methods take the plain string from `.url()`.

Parameters can be passed in several shapes, all typed from your route definition:

```ts
destroy(5);                  // a bare value
destroy({ id: 5 });          // a model-like object
destroy({ tenant: 5 });      // named by the route parameter
destroy([5]);                // positional array
```

If a route binds a custom key, such as `{post:slug}`, you can pass `{ slug: 'my-post' }`. Query strings go in a final `options` argument: `index.url({ query: { page: 2 } })` appends `?page=2`, and `mergeQuery` keeps the parameters already in the browser's URL.

Each function also has method-specific variants — `.get()`, `.head()`, `.post()`, `.put()`, `.patch()` or `.delete()` — generated only for the methods the route accepts.

## Forms with .form()

With `--with-form` (or `formVariants: true`), every function gets a `.form()` variant that returns `{ action, method }` — exactly what a form needs. HTML forms only support GET and POST, so for PUT, PATCH and DELETE routes Wayfinder uses POST and adds Laravel's `_method` field to the query string:

```ts
store.form();
// { action: '/tenants', method: 'post' }

ProfileController.update.form();
// { action: '/settings/profile?_method=PATCH', method: 'post' }
```

That object plugs straight into Inertia's `<Form>` component:

```vue
<Form v-bind="store.form()" :reset-on-success="['password']" v-slot="{ errors, processing }">
    <input name="email" type="email" />
    <input name="password" type="password" />
    <button type="submit" :disabled="processing">Log in</button>
</Form>
```

In React and Svelte you spread it instead: `<Form {...store.form()}>`. Inertia's `useForm` works too — pass the route object to `form.submit(store())` and it picks the URL and method.

## Why typed routes are worth it

- **Refactor-safe.** Rename a route or change its parameters, regenerate, and your type checker (`vue-tsc`, `tsc` or `svelte-check`) points at every call site that needs updating.
- **No hardcoded URLs.** Change `/settings/profile` to `/account/profile` in PHP and the frontend follows after the next build.
- **Typed parameters.** You can't forget the tenant ID; the function won't compile without it.
- **Easy to trace.** Generated functions carry `@see` comments with the controller file and line number, so hovering a function in your editor tells you where the PHP code lives.
- **Only what you use.** Each route is its own export, so unused routes stay out of your bundle.

## Laravel Wayfinder vs Ziggy

Ziggy has long been a popular way to use Laravel routes in JavaScript. The two take different approaches:

| | Ziggy | Wayfinder |
| --- | --- | --- |
| How you call a route | A global `route('name', params)` helper | An imported function per route or controller method |
| Route lookup | By name string, at runtime | By import, checked at build time |
| Route list | Shipped to the frontend as a route list | Split into individual modules you import |
| Controller-based calls | No — routes are referenced by name | Built in, via `@/actions` |
| Form helpers | No | `.form()` variants |

Both are solid. If your project already uses Ziggy and you're happy with it, there's no urgent reason to switch. For a new Inertia app with TypeScript, Wayfinder's import-based approach fits naturally with the rest of your typed code.

## Tips for using Wayfinder in a real project

- **Keep `npm run dev` running** while you work, or run `php artisan wayfinder:generate` after adding routes. A missing import usually just means the files are stale.
- **Watch your own folders.** The Vite plugin watches `routes/**/*.php` and `app/**/Http/**/*.php` by default. If routes or controllers live elsewhere, add those paths with the plugin's `patterns` option.
- **Clear cached routes before building.** Wayfinder reads the registered router, so a stale `route:cache` from a previous deploy produces stale files. Run `php artisan route:clear` before `npm run build`.
- **Watch for reserved words.** A controller method named `delete` or `import` becomes `deleteMethod` or `importMethod` in TypeScript.
- **Generate before type-checking in CI**, since the generated files aren't committed.

## Frequently asked questions

### Should I commit the files Wayfinder generates?

No. They are rebuilt on every `wayfinder:generate` run and by the Vite plugin on every build, so it's common to git-ignore `actions`, `routes` and `wayfinder` in `resources/js`.

### Do I need the Vite plugin?

No, but it saves effort. Without it, run `php artisan wayfinder:generate` yourself whenever routes change, and before every production build.

### Does Laravel Wayfinder work with React and Svelte?

Yes. The generated files are plain TypeScript with no framework dependency, so the same imports work in Vue, React and Svelte. Only the way you pass the objects to components differs.

### Can I use Wayfinder without Inertia?

Yes. `.url()` returns a normal string you can use with `fetch` or any HTTP client, and `.form()` gives you the `action` and `method` for a regular HTML form (you still add the CSRF field yourself).

## How SaaS Laravel uses Wayfinder

All three [SaaS Laravel kits](/) ship with Wayfinder and its Vite plugin configured with `formVariants: true`. Forms such as login, registration and profile settings spread `.form()` into Inertia's `<Form>`; searches and deletes use `router` with `.url()`. The generated directories are git-ignored, and `composer lint` regenerates them with `--with-form` before type-checking. See the [Vue Inertia guide](/docs/vue/inertia.html#wayfinder-routes) and the [generated files table](/docs/getting-started/local-development.html#generated-files), or read [Vue, React or Svelte for Your Laravel SaaS?](/blog/vue-react-or-svelte-laravel-saas.html) to choose a frontend.

<BlogPostCta title="Typed from PHP to TypeScript" text="SaaS Laravel kits come with Wayfinder routes, generated TypeScript types and a module-based Laravel backend — in Vue, React or Svelte." />
