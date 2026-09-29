---
title: "Building a Multilingual Laravel App for SaaS"
description: "Plan a multilingual Laravel app: what to translate, URL strategy and hreflang SEO, database content, dates and currencies, right-to-left text and workflow."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: localization
tags: [Localization, SaaS]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/multilingual-saas-laravel.html
  - - meta
    - property: og:title
      content: "Building a Multilingual Laravel App for SaaS"
  - - meta
    - property: og:description
      content: "Plan a multilingual Laravel app: what to translate, URL strategy and hreflang SEO, database content, dates and currencies, right-to-left text and workflow."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/multilingual-saas-laravel.html
  - - meta
    - name: twitter:title
      content: "Building a Multilingual Laravel App for SaaS"
  - - meta
    - name: twitter:description
      content: "Plan a multilingual Laravel app: what to translate, URL strategy and hreflang SEO, database content, dates and currencies, right-to-left text and workflow."
---

# Multilingual Laravel App: Planning a SaaS for Customers in Many Languages

<BlogPostMeta />

When people start on a multilingual Laravel app, they usually think about translating strings first. That's actually the easy part. The harder decisions come earlier: which parts of the product get translated at all, whether the language belongs in the URL, how search engines find each version, what happens to content in the database, and how dates and prices look to someone in Tokyo or São Paulo.

Those product and architecture decisions are what I want to cover here. If you're after the mechanics of sharing `lang/` files with your frontend, that's in the pillar guide on [Laravel Inertia translations](/blog/laravel-inertia-translations.html), and the per-account setting is covered in [Laravel user locale](/blog/laravel-user-language-preference.html).

## What a multilingual SaaS actually has to translate

Before you pick any tools, list every surface. They tend to live in different places, and each needs its own approach:

| Surface | Where it usually lives | Translated by |
| --- | --- | --- |
| Interface labels, buttons, toasts | `lang/<locale>/*.php` | Your team or translators |
| Validation and auth errors | `validation.php`, `auth.php` | Once, then rarely touched |
| Emails and notifications | Notification classes plus lang files | Sent in the recipient's language |
| Marketing pages, docs, blog | Static files or a CMS | Per page, with SEO in mind |
| Product data you own (plans, templates) | Database | Stored per locale |
| Content your customers write | Database | Usually not translated at all |
| Dates, numbers, currencies | Formatting code | Handled by locale-aware formatters |
| Legal pages | Separate documents | Reviewed per market |

Two of those rows are easy to forget. Customer content normally stays in whatever language it was written in, and you translate the interface around it. Legal text is as much a business decision as a translation job, so plan it with whoever owns your terms and privacy policy.

## Choosing a URL strategy for your multilingual Laravel app

Next comes the question of whether the language is part of the address. There are four common options:

| Strategy | Example | Good for | Downsides |
| --- | --- | --- | --- |
| Path prefix | `example.com/de/pricing` | Marketing sites, docs | Every route and link needs the prefix |
| Language subdomain | `de.example.com` | Large sites with separate teams | Collides with tenant subdomains |
| Country domain | `example.de` | Strong local brands | Several domains, certificates and SEO profiles |
| No language in URL | `app.example.com/settings` | Pages behind a login | Can't be indexed per language |

You don't have to pick just one. Most SaaS products end up with **two strategies**: path prefixes for the public site, because every language version needs its own URL to be indexed, and clean URLs for the app behind the login, where the language comes from the user's saved preference. That's the combination I'd recommend.

What if your customers get their own subdomain, as in [Laravel multi-tenancy with subdomains](/blog/laravel-multi-tenancy-subdomains.html)? Then language subdomains are out, because `acme.example.com` is already taken by the tenant. Use a workspace-level default language instead, and let each user override it.

## SEO for translated pages

Search engines treat each language version as a separate page, so your job is to help them see how the versions relate.

Start with the basics. Set `lang` on the `html` element from the current locale, and translate the title, meta description and slug, not only the body text.

Then add `hreflang` links on every version. Each page should point to all the other versions and to itself, plus an `x-default` for visitors whose language you don't support. Pair that with a self-referencing canonical per language. This is where people often slip: if the German page's canonical points at the English page, you're telling search engines to ignore the German one.

Finally, don't force a redirect by language. Google's guidance for multilingual sites advises against automatically redirecting visitors based on their perceived language. Suggest a switch with a banner instead, and let people stay where they landed.

In a Blade layout, the `hreflang` block can be generated from your list of supported locales:

```blade
@foreach ($supportedLocales as $locale)
    <link rel="alternate" hreflang="{{ $locale }}" href="{{ url($locale.'/'.$path) }}">
@endforeach
<link rel="alternate" hreflang="x-default" href="{{ url('en/'.$path) }}">
```

## Translating content stored in the database

Lang files are for text that ships with your code. Anything an admin edits at runtime, such as plan names, onboarding templates or help articles, belongs in the database. There are three common designs:

| Design | How it works | Trade-offs |
| --- | --- | --- |
| JSON column per field | `name` holds `{"en": "Starter", "de": "Einsteiger"}` | Simple; packages such as `spatie/laravel-translatable` read the current locale for you |
| Translations table | `plan_translations` with `plan_id`, `locale`, `name` | Easy to query and index per language; more joins |
| One row per language | Separate records linked by a group ID | Fits content that differs by market, not just by language |

For a handful of admin-edited fields like plan names, I'd start with the JSON column, since it's the simplest. Reach for a translations table once you need to query and index per language.

Whichever you choose, define a **fallback**. When the German name is empty, show the English one rather than a blank cell. It's also worth deciding early whether search should match all languages or only the current one, because that affects your indexes.

## Dates, numbers and currencies

Language, time zone and currency are three separate settings. A French speaker may live in Canada and pay in US dollars, so don't derive one from another.

On the server, Laravel's `Number` helper formats with a locale, using PHP's `intl` extension:

```php
use Illuminate\Support\Number;

Number::format(1234567.891, precision: 2, locale: 'de');   // 1.234.567,89
Number::currency(49, in: 'EUR', locale: 'fr');             // 49,00 €
```

Carbon picks up the app locale automatically when you call `app()->setLocale()`, so `translatedFormat()` and `diffForHumans()` give you translated month names and relative times.

In the browser, skip hand-written formats and use the built-in `Intl` API with the locale your backend shares:

```ts
const formatDate = (value: string, locale: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
```

Store timestamps in UTC and convert them to the user's time zone for display. Money works the same way: keep it as integers in minor units, with the currency code next to it, and only format it at the edge.

## Right-to-left languages

Arabic, Hebrew, Persian and Urdu read right to left, and supporting them takes more than translation.

First, set `dir="rtl"` on the `html` element next to `lang`. Then use logical CSS instead of left and right. In Tailwind CSS v4, `ms-4`, `me-4`, `ps-4` and `pe-4` follow the reading direction, and the `rtl:` variant handles the exceptions.

Icons need some thought too. Mirror directional ones such as arrows and "back" chevrons, but leave logos, media controls and charts with a time axis alone. And test with real text. Mixed-direction strings, like an email address inside an Arabic sentence, reveal most layout bugs.

If there's any chance you'll support these languages, use logical utilities from day one. It saves a large refactor later.

## A translation workflow that scales

Adding languages isn't the hard part. Keeping them all complete and consistent is. These habits help:

1. Pick one source language. Write every new key in English first, and treat other locales as translations of it.
2. Split strings by feature, so translators and reviewers work on small files.
3. Never concatenate sentences. Use placeholders (`:name`, `:count`) instead, because word order changes between languages.
4. Leave room for longer text. German and Finnish labels often run much longer than English, so test buttons and table headers with your longest language.
5. Check key parity in CI. A short script can compare every locale against English:

```php
$source = Arr::dot(require lang_path('en/billing.php'));
$target = Arr::dot(require lang_path('de/billing.php'));

$missing = array_diff_key($source, $target);
```

You might be wondering why not just use `Lang::handleMissingKeysUsing()` to log missing keys at runtime. You can, but it only fires when a key is missing in both the current and the fallback locale. So it won't catch a German key that quietly falls back to English, which is why the CI check is worth having.

Machine translation makes a reasonable first draft for large files. Have a native speaker review anything customers read often, though: onboarding, billing and error messages.

## Launch checklist

- Every interface string comes from lang files, with no hard-coded text in components
- Validation, auth and email messages exist in every supported locale
- The public site has one URL per language with `hreflang`, canonical and translated meta tags
- The app reads the language from the user, then the workspace, then the app default
- Database content that you own has translations and a fallback
- Dates, numbers and prices use locale-aware formatters, and time zones are separate
- Layouts survive your longest language, and right-to-left if you support it
- A CI check reports missing keys before release

## Frequently asked questions

### Should the language be in the URL of a Laravel SaaS?

For public pages that should rank in search, yes. Each language needs its own URL, usually with a path prefix. For pages behind a login, no. Store the language on the user and keep URLs clean.

### How many languages should a SaaS launch with?

Start with the languages your first customers actually use, and make sure each one is complete. A small set of fully translated languages beats many half-translated ones. Adding a language later is easy as long as every string already comes from lang files.

### Can I machine-translate my Laravel lang files?

As a first draft, yes, provided placeholders like `:attribute` and `:count` survive. Have a native speaker review the result, especially onboarding, billing and error messages, where a clumsy sentence costs trust.

### How do I support right-to-left languages in a Laravel app?

Set `dir="rtl"` on the `html` element for those locales, use logical CSS utilities instead of left and right, and mirror directional icons. Laravel's translation system itself works the same in either direction.

## How SaaS Laravel handles a multilingual app

If you'd rather not build the app side of this yourself, the SaaS Laravel kits ship with 17 languages, all written left to right. There's one lang file per feature under `lang/<locale>/modules/`, plus generated JSON for the frontend. The language comes from the user's setting, then the tenant domain's default, then `APP_LOCALE`, and the root view sets the `lang` attribute from the active locale. To be clear about the scope, the kits focus on the app behind the login. Localized marketing URLs, `hreflang` tags and translated database content are left for you to add. The [localization documentation](/docs/core/localization.html) and the [domain settings](/docs/core/domains.html) have the details.

<BlogPostCta title="Start your multilingual SaaS in 17 languages" text="SaaS Laravel includes 17 languages, per-user and per-domain language settings and translated validation, with Vue, React or Svelte." />
