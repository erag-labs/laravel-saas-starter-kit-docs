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

Writing `'/tenants/' + id` in a Vue, React or Svelte component works right up until someone renames the route. Laravel Wayfinder fixes that by generating TypeScript functions for your controllers and named routes. You import a function, pass it the ID, and get back the right URL and HTTP method, with TypeScript checking every call.

I'll go through how Wayfinder works, how to install and generate it, and how to use it for links, visits and forms. After that there's a comparison with Ziggy and a few tips for using it in a real SaaS codebase.

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

These are real TypeScript functions, so a missing parameter or a misspelled route shows up as a type error. Without them, you'd find out from a broken link in production.

::: warning Still in beta
Wayfinder is pre-1.0. Its README notes that the API may change before the v1.0.0 release, so pin the version in `composer.json` and read the changelog when you update.
:::

## Installing and generating

Install the package with Composer, then generate the files:

```bash
composer require laravel/wayfinder
php artisan wayfinder:generate
```

The command takes four options:

| Option | Effect |
| --- | --- |
| `--with-form` | Also generate `.form()` variants for HTML and Inertia forms |
| `--skip-actions` | Don't generate the controller-based `actions/` files |
| `--skip-routes` | Don't generate the named-route `routes/` files |
| `--path=` | Write the files somewhere other than `resources/js` |

### The Vite plugin

You'll get tired of running that command by hand pretty quickly. The `@laravel/vite-plugin-wayfinder` package runs it for you when Vite starts (`npm run dev` or `npm run build`), and again whenever a watched PHP file changes:

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

Since the files are regenerated on every build, you can safely add `resources/js/actions`, `resources/js/routes` and `resources/js/wayfinder` to `.gitignore`.

## Importing from @/actions and @/routes

There are two ways to reach the same endpoint, and it's worth knowing both:

| Import from | Based on | Example |
| --- | --- | --- |
| `@/routes/...` | Route names | `tenants.index` → `import { index } from '@/routes/tenants'` |
| `@/actions/...` | Controller classes | `import ProfileController from '@/actions/Modules/Settings/Http/Controllers/ProfileController'` |

A route without a dot in its name, such as `dashboard`, is exported straight from `@/routes`. Controller paths mirror the PHP namespace, so a controller inside a feature module ends up under `@/actions/Modules/...`. That's handy if you follow a [modular Laravel architecture](/blog/modular-laravel-architecture.html).

Whichever you use, I'd stick to **named imports** (`import { index, destroy } from ...`). If you're wondering why it matters: importing a whole controller as a default export keeps every one of its functions in your bundle, while named imports let the bundler drop the ones you don't use. Invokable controllers are the exception, since their default export is the function itself.

## Using .url() and parameters

Wayfinder functions work anywhere a URL or a route object is expected. In Vue with Inertia:

```vue
<Link :href="dashboard()">Dashboard</Link>
```

```ts
router.get(index.url(), { search: value.trim() || undefined }, { preserveScroll: true, replace: true });

router.delete(destroy.url(role.id), { preserveScroll: true });
```

Notice the difference between the two. `Link` accepts the `{ url, method }` object directly, but `router` methods want the plain string from `.url()`.

You can pass parameters in several shapes, and all of them are typed from your route definition:

```ts
destroy(5);                  // a bare value
destroy({ id: 5 });          // a model-like object
destroy({ tenant: 5 });      // named by the route parameter
destroy([5]);                // positional array
```

When a route binds a custom key, such as `{post:slug}`, pass `{ slug: 'my-post' }`. Query strings go in a final `options` argument. For example, `index.url({ query: { page: 2 } })` appends `?page=2`, and `mergeQuery` keeps whatever parameters are already in the browser's URL.

Each function also gets method-specific variants (`.get()`, `.head()`, `.post()`, `.put()`, `.patch()` or `.delete()`), but only for the methods the route actually accepts.

## Forms with .form()

With `--with-form` (or `formVariants: true`), every function gets a `.form()` variant that returns `{ action, method }`, which is exactly what a form needs. There's one catch you might run into: HTML forms only support GET and POST. So for PUT, PATCH and DELETE routes, Wayfinder uses POST and adds Laravel's `_method` field to the query string:

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

In React and Svelte you spread it instead: `<Form {...store.form()}>`. Inertia's `useForm` works too. Pass the route object to `form.submit(store())` and it picks up the URL and method for you.

## Why typed routes are worth the setup

The biggest win for me is refactoring. Rename a route or change its parameters, regenerate, and your type checker (`vue-tsc`, `tsc` or `svelte-check`) points at every call site that needs updating. The same goes for URLs: change `/settings/profile` to `/account/profile` in PHP and the frontend follows after the next build, because nothing was hardcoded.

Parameters are typed as well, so you can't forget the tenant ID. The function simply won't compile without it.

It's also easy to trace where things come from. Generated functions carry `@see` comments with the controller file and line number, so hovering over a function in your editor tells you where the PHP code lives. And since each route is its own export, routes you never use stay out of your bundle.

## Laravel Wayfinder vs Ziggy

Ziggy has been a popular way to use Laravel routes in JavaScript for a long time. The two take different approaches:

| | Ziggy | Wayfinder |
| --- | --- | --- |
| How you call a route | A global `route('name', params)` helper | An imported function per route or controller method |
| Route lookup | By name string, at runtime | By import, checked at build time |
| Route list | Shipped to the frontend as a route list | Split into individual modules you import |
| Controller-based calls | No, routes are referenced by name | Built in, via `@/actions` |
| Form helpers | No | `.form()` variants |

Both are solid choices. If your project already uses Ziggy and you're happy with it, there's no urgent reason to switch. For a new Inertia app written in TypeScript, though, I'd pick Wayfinder, because its import-based approach fits in naturally with the rest of your typed code.

## Tips for using Wayfinder in a real project

- Keep `npm run dev` running while you work, or run `php artisan wayfinder:generate` after adding routes. If an import suddenly can't be found, the files are usually just stale.
- The Vite plugin watches `routes/**/*.php` and `app/**/Http/**/*.php` by default. If your routes or controllers live somewhere else, add those paths with the plugin's `patterns` option.
- Wayfinder reads the registered router, so a stale `route:cache` from a previous deploy produces stale files. Run `php artisan route:clear` before `npm run build`.
- Watch out for reserved words. A controller method named `delete` or `import` becomes `deleteMethod` or `importMethod` in TypeScript.
- In CI, **generate before type-checking**, since the generated files aren't committed.

## Frequently asked questions

### Should I commit the files Wayfinder generates?

No. Every `wayfinder:generate` run rebuilds them, and so does the Vite plugin on every build. That's why it's common to git-ignore `actions`, `routes` and `wayfinder` in `resources/js`.

### Do I need the Vite plugin?

No, but it saves you effort. Without it, you have to run `php artisan wayfinder:generate` yourself whenever routes change, and before every production build.

### Does Laravel Wayfinder work with React and Svelte?

Yes. The generated files are plain TypeScript with no framework dependency, so the same imports work in Vue, React and Svelte. The only difference is how you pass the objects to components.

### Can I use Wayfinder without Inertia?

Yes. `.url()` returns a normal string you can use with `fetch` or any HTTP client, and `.form()` gives you the `action` and `method` for a regular HTML form. You still add the CSRF field yourself in that case.

## How SaaS Laravel uses Wayfinder

If you'd like to see all of this already wired up, all three [SaaS Laravel kits](/) ship with Wayfinder and its Vite plugin configured with `formVariants: true`. Forms such as login, registration and profile settings spread `.form()` into Inertia's `<Form>`, while searches and deletes use `router` with `.url()`. The generated directories are git-ignored, and `composer lint` regenerates them with `--with-form` before type-checking. The [Vue Inertia guide](/docs/vue/inertia.html#wayfinder-routes) and the [generated files table](/docs/getting-started/local-development.html#generated-files) have the details. If you're still choosing a frontend, read [Vue, React or Svelte for Your Laravel SaaS?](/blog/vue-react-or-svelte-laravel-saas.html).

<BlogPostCta title="Typed from PHP to TypeScript" text="SaaS Laravel kits come with Wayfinder routes, generated TypeScript types and a module-based Laravel backend, in Vue, React or Svelte." />
