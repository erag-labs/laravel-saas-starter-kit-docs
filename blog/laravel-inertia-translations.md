---
title: "Laravel Translations in Inertia Apps"
description: "How to handle Laravel Inertia translations: share PHP lang files with Vue, React or Svelte, set the locale per user, translate validation and plurals."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
tags: [Localization, Inertia]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-inertia-translations.html
  - - meta
    - property: og:title
      content: "Laravel Translations in Inertia Apps"
  - - meta
    - property: og:description
      content: "How to handle Laravel Inertia translations: share PHP lang files with Vue, React or Svelte, set the locale per user, translate validation and plurals."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-inertia-translations.html
  - - meta
    - name: twitter:title
      content: "Laravel Translations in Inertia Apps"
  - - meta
    - name: twitter:description
      content: "How to handle Laravel Inertia translations: share PHP lang files with Vue, React or Svelte, set the locale per user, translate validation and plurals."
---

# Laravel Inertia Translations: Sharing Lang Files with Vue, React and Svelte

<BlogPostMeta />

**Laravel Inertia translations** have one awkward problem: your strings live in PHP files under `lang/`, but your interface is rendered by JavaScript components. Laravel's `__()` helper works perfectly in controllers, mail and validation — and does nothing for a Vue, React or Svelte page.

This guide walks through the common ways to bridge that gap, shows how the `erag/laravel-lang-sync-inertia` package does it, and covers the details that come up in a real multilingual app: per-user language, validation messages, file organisation, plurals and payload size.

## The problem: two worlds, one set of strings

In a Blade app, every string is translated on the server. With Inertia, Laravel still handles routing, validation and data, but the markup is built in the browser from page props. That leaves you with three choices:

1. Translate everything on the server and pass finished strings as props.
2. Send the translation files themselves to the frontend and translate there.
3. Keep a separate set of frontend translation files.

Option 1 works for a handful of strings but quickly clutters every controller. Option 3 means maintaining two sets of files that drift apart. Most Inertia apps end up with option 2: **one source of truth in `lang/`**, shared with the frontend.

## Ways to share Laravel translations with Inertia

| Approach | How it works | Trade-offs |
| --- | --- | --- |
| Shared Inertia prop | Middleware loads PHP lang files and shares them as a prop | Simple, always in sync; the strings travel with the page response |
| JSON generated at build time | A command converts `lang/*.php` to JSON the frontend can read | Fast lookups; you must regenerate after every change |
| Generic i18n library | A frontend i18n library loads its own message files | Powerful formatting; a second format and a second set of conventions to learn |

There is no single right answer. What matters is that PHP stays the source of truth, so a validation message and a button label never disagree.

## How erag/laravel-lang-sync-inertia works

The package combines the first two approaches. It has a Composer package for Laravel and a small npm package, `@erag/lang-sync-inertia`, for the frontend.

### Option A: load files per page with `syncLangFiles()`

Call the global `syncLangFiles()` helper in a controller before rendering. It loads one or more groups for the current locale and shares them under the `lang` prop:

```php
public function index(): Response
{
    syncLangFiles(['auth', 'modules.tenant']);

    return Inertia::render('tenants/Index');
}
```

Dot notation reads nested files, so `modules.tenant` loads `lang/<locale>/modules/tenant.php`.

### Option B: generate JSON for every file

Run one Artisan command to export every PHP lang file to JSON:

```bash
php artisan erag:generate-lang
```

It mirrors the folder structure, for example `lang/en/modules/user.php` becomes `resources/js/lang/en/modules/user.json`. Both paths are configurable in `config/inertia-lang.php` (`lang_path` and `output_lang`). When these JSON files exist, the package automatically shares all of them for the current locale in the `lang` prop, merged with anything you loaded with `syncLangFiles()` (runtime-loaded values win on conflicts).

### Reading translations in components

Import the helper from the subpath for your framework — `@erag/lang-sync-inertia/vue`, `/react` or `/svelte` — and call it in the component. There is no plugin or provider to register.

```vue
<script setup lang="ts">
import { vueLang } from '@erag/lang-sync-inertia/vue';

const { __ } = vueLang();
</script>

<template>
    <h1>{{ __('modules.settings.delete_account.title') }}</h1>
</template>
```

React uses `reactLang()` and Svelte uses `svelteLang()`; each returns `__`, `trans`, `transChoice` and `trans_choice`. Placeholders work the Laravel way: `__('modules.user.welcome', { name: user.name })` replaces `:name`. If a key is missing, the helper returns the key itself, so gaps are easy to spot.

::: tip Key format
PHP uses a slash for sub-folders (`__('modules/settings.language.updated')`), components use dots everywhere (`__('modules.settings.language.updated')`).
:::

## Per-user and per-domain locale

Because the `lang` prop is resolved from `app()->getLocale()` when the response is built, choosing a language is just a matter of setting the locale early in the request. A middleware that runs before your Inertia middleware is enough:

```php
public function handle(Request $request, Closure $next): Response
{
    $default = $this->domainLocale($request) ?? config('app.locale');

    app()->setLocale($request->user()?->locale ?? $default);

    return $next($request);
}
```

A sensible order of preference for a SaaS is:

1. the signed-in user's saved language (a nullable `locale` column on `users`),
2. the default language of the customer's domain or workspace,
3. the app default from `APP_LOCALE`.

Storing `null` when the user picks "Default" lets them follow their workspace's language automatically. Always validate the value against a list of supported locales, and fall back to your default for anything unknown. If you run tenants on subdomains, the domain lookup fits naturally into that flow — see [Laravel Multi-Tenancy with Subdomains](/blog/laravel-multi-tenancy-subdomains.html).

## Translating validation messages

Good news: validation needs no frontend work. Laravel translates messages on the server using `lang/<locale>/validation.php` and the current locale, and Inertia passes the finished strings to your forms in the `errors` prop.

For custom messages and field names, use the `messages()` and `attributes()` methods of a Form Request (or a Data object) and call `__()` inside them:

```php
public function attributes(): array
{
    return [
        'features' => __('modules/domain.validation.attributes.features'),
    ];
}
```

::: warning Translate at runtime, not at boot
Calling `__()` in a config file, a constant or a service provider runs before your locale middleware, so every user gets the default language. Call it inside methods that run during the request.
:::

## Organise translations by feature

A single huge `messages.php` becomes hard to maintain once you have more than a few screens. Keep Laravel's own files (`auth.php`, `validation.php`, `passwords.php`, `pagination.php`) at the top of each locale and put your strings in **one file per feature**:

```text
lang/<locale>/
├── auth.php  validation.php  ...
└── modules/
    ├── dashboard.php  settings.php  tenant.php  user.php
```

This mirrors a [modular Laravel architecture](/blog/modular-laravel-architecture.html): when you add a module, you add its lang file, and it is obvious where every string lives. Nested keys such as `index.title` or `toasts.created` keep each file readable.

## Pluralisation

Use Laravel's pipe syntax with explicit counts or ranges:

```php
'invitations' => '{0} No invitations|{1} One invitation|[2,*] :count invitations',
```

Then call `trans_choice('modules/user.invitations', $count)` in PHP or `transChoice('modules.user.invitations', count)` in a component. The frontend helper fills in `:count` for you.

Laravel's PHP side applies each language's plural rules to simple `singular|plural` strings. The frontend helper is simpler: without explicit counts it uses the first form for 1 and the last form otherwise. For languages with more than two plural forms, such as Russian or Polish, write explicit `{n}` and `[a,b]` ranges so both sides agree.

## Performance: only share what the page needs

Every Inertia response carries its props, so translations add to every page load and visit. A few habits keep this small:

- **Generated JSON shares everything for the locale.** That's convenient and fine for a typical dashboard, but if your lang files grow large, consider calling `syncLangFiles()` per page instead, so each response carries only the groups it uses.
- **Only the current locale is sent.** Other languages never leave the server, so adding languages does not grow the payload.
- **Remove unused keys.** Old strings cost bytes on every request.
- **Keep long content out of lang files.** Help articles and legal text belong in the database or in Markdown, not in a shared prop.
- **Regenerate and commit the JSON** as part of your workflow, so production never serves stale strings.

## Frequently asked questions

### Do I need a frontend i18n library with Inertia?

Not necessarily. If your strings already live in Laravel lang files, sharing them through an Inertia prop and a small `__()` helper covers labels, placeholders and plurals. A dedicated library makes sense when you need heavy client-side formatting or run a frontend without Laravel.

### Do I have to run erag:generate-lang after every change?

Yes, if you use the generated JSON approach. The frontend reads the JSON, not the PHP files, so run `php artisan erag:generate-lang` after editing anything in `lang/` and commit the output.

### How do I switch the language without a full page reload?

Save the user's choice with a normal Inertia request and redirect back. The next response is built with the new locale, so the `lang` prop, validation messages and server-side strings all update together.

### Does this work the same in Vue, React and Svelte?

Yes. The backend is identical; only the import changes: `vueLang` from `/vue`, `reactLang` from `/react` or `svelteLang` from `/svelte`. If you are still choosing a frontend, read [Vue, React or Svelte for Your Laravel SaaS?](/blog/vue-react-or-svelte-laravel-saas.html).

## How SaaS Laravel handles translations

The SaaS Laravel kits ship with 17 languages, using `erag/laravel-lang-sync-inertia` with generated JSON committed in `resources/js/lang`. Strings are organised in one file per feature under `lang/<locale>/modules/`, and a `SetUserLocale` middleware picks the user's language, then the tenant domain's default, then `APP_LOCALE`. Users switch language from their profile or the user menu, and Data objects translate validation messages and attribute names. The details are in the [localization documentation](/docs/core/localization.html).

<BlogPostCta title="Ship a multilingual SaaS from day one" text="SaaS Laravel includes 17 languages, per-user and per-domain locales and translated validation — with your choice of Vue, React or Svelte." />
