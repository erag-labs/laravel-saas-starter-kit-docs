---
title: "Laravel User Locale: Per-User Language Settings"
description: "Store a Laravel user locale, validate and save the choice, apply it on every request and send emails and queued notifications in each user's language."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Localization, Laravel]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-user-language-preference.html
  - - meta
    - property: og:title
      content: "Laravel User Locale: Per-User Language Settings"
  - - meta
    - property: og:description
      content: "Store a Laravel user locale, validate and save the choice, apply it on every request and send emails and queued notifications in each user's language."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-user-language-preference.html
  - - meta
    - name: twitter:title
      content: "Laravel User Locale: Per-User Language Settings"
  - - meta
    - name: twitter:description
      content: "Store a Laravel user locale, validate and save the choice, apply it on every request and send emails and queued notifications in each user's language."
---

# Laravel User Locale: Letting Every User Choose Their Own Language

<BlogPostMeta />

A **Laravel user locale** is the language a signed-in person has chosen for your app, saved on their account so it follows them to every device. Laravel gives you the building blocks, `app()->setLocale()` and the translator, but leaves the rest to you: where to store the choice, when to apply it, and how to keep emails and background jobs in the same language.

This guide covers the whole lifecycle of a per-user language preference: the column, the enum of supported languages, the endpoint that saves it, middleware placement, guests, notifications and the frontend. For sharing your `lang/` files with Vue, React or Svelte, see the pillar guide on [Laravel Inertia translations](/blog/laravel-inertia-translations.html).

## Where a language preference can come from

Before writing code, decide which sources you trust and in what order. Each one fits a different situation:

| Source | Best for | Watch out for |
| --- | --- | --- |
| Column on `users` | Signed-in users, every device | Needs a settings screen |
| Session or cookie | Guests on login and sign-up pages | Lost when the session ends or the browser changes |
| URL prefix such as `/de/` | Public, indexable pages | Every link must carry the prefix |
| `Accept-Language` header | A sensible first guess | Reflects the browser, not always the person |
| Workspace or domain default | Teams that all speak one language | Only exists once a tenant is known |
| `APP_LOCALE` | The final fallback | Same for everyone |

For the logged-in part of a SaaS, the user column is the one that matters. The others fill the gaps before someone signs in, or when they never make a choice.

## Store the Laravel user locale on the users table

A short, nullable string column is enough. Ten characters leaves room for region codes like `pt_BR` if you add them later:

```php
Schema::table('users', function (Blueprint $table) {
    $table->string('locale', 10)->nullable()->after('email');
});
```

`null` means "no preference". That is useful: the user then follows the workspace or app default, and changes to that default reach them automatically. Remember to add `locale` to the model's fillable attributes.

Next, keep the list of supported languages in one place. A backed enum works well, because you can use it for validation, for the options in a select and for safe fallbacks:

```php
enum Language: string
{
    case English = 'en';
    case German = 'de';
    case Spanish = 'es';

    public static function resolve(?string $locale): self
    {
        return self::tryFrom((string) $locale) ?? self::English;
    }
}
```

`resolve()` turns anything unknown, including `null` or a language you have since removed, into your default. Call it every time you read a locale from the database, a cookie or a header.

## Saving the user's choice

Give the language its own small endpoint, such as `PATCH /settings/language`, instead of burying it in the profile form. That way a language switcher in the user menu can change it with one request.

Validate the value against the enum and allow `null` for "Default":

```php
public function rules(): array
{
    return [
        'locale' => ['nullable', 'string', Rule::enum(Language::class)],
    ];
}
```

Then save it, switch the locale for the rest of this request, and redirect back:

```php
public function update(LanguageRequest $request): RedirectResponse
{
    $request->user()->update(['locale' => $request->validated('locale')]);

    app()->setLocale($request->validated('locale') ?? config('app.fallback_locale'));

    return back()->with('status', __('settings.language_updated'));
}
```

The `setLocale()` call is easy to forget. Without it, the success message is translated in the *old* language, because your middleware already ran before the controller. In a real app, replace the fallback with the same workspace or app default your middleware uses.

With Inertia, the redirect back triggers a fresh page response built in the new locale, so every string on the screen updates without a full reload.

## Applying the locale on every request

A middleware reads the saved preference and calls `app()->setLocale()` at the start of each request. The pillar article shows the [middleware body with a user, domain and app fallback](/blog/laravel-inertia-translations.html#per-user-and-per-domain-locale), so here we'll focus on where it runs, which is where most bugs come from.

It has to run **after** the session starts, so `$request->user()` works, and **before** anything that renders translated output, such as your Inertia middleware. In Laravel 11 and later you configure that in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->web(append: [
        SetUserLocale::class,
        HandleInertiaRequests::class,
    ]);

    $middleware->prependToPriorityList(
        before: HandleInertiaRequests::class,
        prepend: SetUserLocale::class,
    );
})
```

Appending to the `web` group puts it after `StartSession`. The priority entry keeps the order right even when route middleware gets sorted.

::: tip Read the default first
`app()->setLocale()` also writes to `config('app.locale')`. If you need the original default later in the request, for example to show "Default (English)" in a select, work it out before you override it and keep it on the request.
:::

Setting the locale also fires Laravel's `LocaleUpdated` event, which Carbon listens to. Translated dates from `translatedFormat()` or `diffForHumans()` follow the user's language without extra code.

## Guests: session, cookie and Accept-Language

On the login or sign-up page there is no user yet. Two light options work well:

1. **Guess from the browser.** Symfony's request object picks the best match from the languages you support:

```php
$supported = array_column(Language::cases(), 'value');

$locale = $request->session()->get('locale')
    ?? $request->getPreferredLanguage($supported);
```

2. **Remember an explicit choice.** A small language switcher on the guest pages stores the value in the session.

When a guest signs up, copy their current locale into the new user's `locale` column. Their first email and dashboard then match the language they registered in.

## Emails, notifications and queued jobs

HTTP middleware does nothing for a queue worker. A queued notification is rendered later, in a separate process, with the app default locale, unless you tell Laravel otherwise.

The clean fix is to let the user model report its own language through the `HasLocalePreference` contract:

```php
use Illuminate\Contracts\Translation\HasLocalePreference;

class User extends Authenticatable implements HasLocalePreference
{
    public function preferredLocale(): ?string
    {
        return $this->locale;
    }
}
```

Laravel checks this contract when it sends a notification to the user, and when you pass the user to `Mail::to()`. When it returns `null`, the app default applies.

For people without a preference yet, such as someone you are inviting, set the language explicitly. Notifications and mailables both have a `locale()` method:

```php
$invitee->notify(
    (new InvitationNotification($url))->locale(app()->getLocale())
);
```

This sends the invitation in the inviter's current language, which is usually a better guess than the app default. The same issue affects [queued jobs in a multi-tenant Laravel app](/blog/laravel-multi-tenant-queues.html): anything that depends on request state has to be passed to the job explicitly.

## Share the locale with the frontend

Your components need to know the active language too. Share it as a prop, next to the user's raw choice and the available options:

```php
'locale' => app()->getLocale(),
'userLocale' => $request->user()?->locale,
```

Keeping both values lets a select show "Default" as selected when `userLocale` is `null`, while the page still renders in the resolved language. Also set `lang` on the root `html` element from `app()->getLocale()` in your root Blade view; screen readers and browser translation tools rely on it. Formatting dates and numbers in the browser is covered in the guide to building a [multilingual Laravel SaaS app](/blog/multilingual-saas-laravel.html).

## Checklist

- Nullable `locale` column, where `null` means "use the default"
- One enum or config list of supported languages, used for validation and options
- Every stored or guessed value passes through a `resolve()`-style fallback
- The save endpoint calls `setLocale()` before building its response
- The middleware runs after the session starts and before Inertia
- Guests get a session choice or an `Accept-Language` guess, copied on sign-up
- The user model implements `HasLocalePreference`
- Invitations and other mail to users without a preference set `locale()` explicitly

## Frequently asked questions

### Should I store the user's language in the session or the database?

Use the database for signed-in users, so the choice follows them to every device and into emails. The session is useful for guests, and as a short-lived override, but it disappears when the session expires.

### How do I detect the browser language in Laravel?

Call `$request->getPreferredLanguage()` with the list of locales you support. It reads the `Accept-Language` header and returns the best match, or the first entry of your list when nothing matches. Treat it as a first guess and let people change it.

### Why are my queued emails sent in the wrong language?

Queue workers don't run your web middleware, so they use the app default locale. Implement `HasLocalePreference` on the user model, or call `locale()` on the notification or mailable before you queue it.

### What happens if a user picked a language I later remove?

Nothing breaks as long as every read goes through a fallback such as `Language::resolve()`. The user sees your default language, and their stored value can be cleaned up with a one-off query.

## How SaaS Laravel handles per-user language

In the SaaS Laravel kits, `users.locale` is a nullable column in both the central and tenant databases, and `Modules\Settings\Enums\LanguageEnum` lists the 17 supported languages with a `resolve()` fallback. Users pick a language in their profile or from the user menu, which calls `PATCH /settings/language`. Choosing "Default" stores `null`, so they follow their tenant domain's default language or `APP_LOCALE`. The `SetUserLocale` middleware runs before the Inertia middleware, which then shares `locale`, `userLocale`, `defaultLocale` and `languages` with the frontend. See the [localization documentation](/docs/core/localization.html) and the [per-domain language setting](/docs/core/domains.html).

<BlogPostCta title="Every user in their own language" text="SaaS Laravel ships with 17 languages, a per-user language setting and per-domain defaults, in Vue, React or Svelte." />
