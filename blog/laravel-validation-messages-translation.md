---
title: "Translating Validation Messages in Laravel"
description: "Laravel validation messages translation explained: the lookup order, lang files for every locale, field names, custom messages, arrays and custom rules."
pageClass: blog-page
date: 2026-09-29
author: erag
category: localization
tags: [Localization, Validation]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-validation-messages-translation.html
  - - meta
    - property: og:title
      content: "Translating Validation Messages in Laravel"
  - - meta
    - property: og:description
      content: "Laravel validation messages translation explained: the lookup order, lang files for every locale, field names, custom messages, arrays and custom rules."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-validation-messages-translation.html
  - - meta
    - name: twitter:title
      content: "Translating Validation Messages in Laravel"
  - - meta
    - name: twitter:description
      content: "Laravel validation messages translation explained: the lookup order, lang files for every locale, field names, custom messages, arrays and custom rules."
---

# Laravel Validation Messages Translation: From Lang Files to Custom Rules

<BlogPostMeta />

Few things make a translated app look unfinished faster than an English error under a German form. Laravel validation messages translation is mostly built in, but it only really clicks once you know where each part of a message comes from: the rule text, the field name, the values, and any overrides you've added.

We'll walk through the order Laravel uses to look up a message, how to get a `validation.php` for every language, and how to translate field names, custom messages, array fields, enum values and custom rule classes. Getting those translated errors into an Inertia form is a separate topic, covered in our pillar guide on [translations in Laravel and Inertia](/blog/laravel-inertia-translations.html).

## Where a validation message comes from

A failing rule gets its message in two steps. Laravel finds the message template first, then fills in the placeholders, such as `:attribute`, `:max` or `:values`.

For the template, the validator stops at the first match:

| Step | Source | Example key |
| --- | --- | --- |
| 1 | Messages passed to the validator (`messages()` on a Form Request) | `email.unique` |
| 2 | Custom lines in the lang file | `validation.custom.email.unique` |
| 3 | Size rules by type (`min`, `max`, `size`, `between`) | `validation.max.string` |
| 4 | The default line for the rule | `validation.unique` |

All of these lookups use the current locale. As long as your locale middleware has already run, steps 2 to 4 come translated for free. If a key is missing in the current locale, Laravel tries `APP_FALLBACK_LOCALE`. If it's missing there too, the user sees the raw key, something like `validation.custom_rule`.

Field names follow a similar chain. Laravel checks names passed to the validator (`attributes()`), then `validation.attributes` in the lang file, and finally falls back to the field key with underscores turned into spaces. That's why `first_name` shows up as "first name".

## Laravel validation messages translation starts with lang files

A fresh Laravel app doesn't have a `lang` folder. The publish command creates `lang/en` with Laravel's four default files:

```bash
php artisan lang:publish
```

You get `auth.php`, `pagination.php`, `passwords.php` and `validation.php`, in English only. Every other language needs its own `lang/<locale>/validation.php` with the same keys. You can translate it yourself or start from a community package like `laravel-lang/lang`. If you take the package route, we'd still review the result before it reaches users.

Whichever way you go, check two things in each translated file. First, the nested rules. Size rules are arrays (`'max' => ['string' => ..., 'numeric' => ...]`), and the `Password` rule reads `validation.password.mixed`, `.letters`, `.numbers`, `.symbols` and `.uncompromised`. Flatten `max` into a single string and the lookup by type breaks. Second, the placeholders. Translators have to keep `:attribute`, `:min`, `:max`, `:values` and the rest exactly as written, though they're free to move them anywhere in the sentence.

There's one more file to remember, because login errors aren't validation rules. "These credentials do not match our records" lives in `auth.php` under `failed`, and the throttle message sits under `throttle`. Translate those as well.

## Translating field names

The most common leftover is a translated rule message wrapped around an English field name ("Das Feld email muss…"). You can fix it in two places.

### Globally, in the lang file

This suits fields that mean the same thing everywhere:

```php
// lang/de/validation.php
'attributes' => [
    'email' => 'E-Mail-Adresse',
    'password' => 'Passwort',
],
```

### Per form, in the request

Use this when the same key means different things on different forms, or when your strings live in feature files. Return the names from `attributes()` and call `__()` inside the method. Don't translate them in a constant or a config file; the pillar article explains why.

Laravel also supports case variants of the placeholder: `:attribute` as written, `:Attribute` with a capital first letter, and `:ATTRIBUTE` in upper case. When the field name starts a sentence, use `:Attribute`. Translators then don't need a separate string just for the capital letter.

## Custom messages for a single rule

Sometimes the generic text isn't good enough. "The email has already been taken" on a sign-up form is a typical example. You can override it in two places:

| Where | Key | Best when |
| --- | --- | --- |
| `validation.custom` in each `lang/<locale>/validation.php` | `'custom' => ['email' => ['unique' => '...']]` | The same override applies to every form |
| `messages()` on the Form Request | `'email.unique' => __('signup.email_taken')` | The message is specific to one form |

For anything form-specific, we prefer the second option. The form's wording stays next to its rules, in the same feature lang file as its labels:

```php
public function messages(): array
{
    return [
        'email.unique' => __('signup.validation.email_taken'),
        'terms.accepted' => __('signup.validation.terms_required'),
    ];
}
```

Keys in `messages()` can also target a rule for every field (`'required' => ...`) or use wildcards. Wildcards are what you'll want for arrays.

## Arrays and nested fields

With array input, the default field name is the full path. So the user reads "The members.2.email field is required", which isn't something you want on screen. Two things fix it.

Wildcard keys work in both `messages()` and `attributes()`:

```php
public function attributes(): array
{
    return [
        'members.*.email' => __('team.validation.member_email'),
    ];
}
```

On top of that, Laravel fills in the position of the failing item. `:index` is zero-based, `:position` starts at 1, and `:ordinal-position` gives "1st", "2nd" and so on. A translation like `'member_email' => 'E-Mail von Mitglied :position'` becomes "E-Mail von Mitglied 3", which is far clearer than a dotted path. For text users read, `:position` is usually the one to reach for.

## Translating values in messages

Rules such as `required_if` print a value in the message: "The company field is required when type is business." The field name `type` comes from your attributes, but `business` is the raw input value.

Laravel looks for a translated value under `validation.values`, keyed by field and then by value:

```php
'values' => [
    'type' => [
        'business' => 'Geschäftskunde',
    ],
],
```

The `:input` placeholder uses the same lookup. A message that echoes the user's input can therefore show a friendly, translated value too.

## Custom rule classes

A rule class that implements `ValidationRule` receives a `$fail` callback, and you decide what message to hand it:

```php
public function validate(string $attribute, mixed $value, Closure $fail): void
{
    if (! $this->isValidVatNumber($value)) {
        $fail('validation.vat_number')->translate();
    }
}
```

The example passes a lang key and calls `translate()`. The key is looked up in the current locale, and you can pass replacements to `translate()`. Another option is to hand `$fail` a string that's already translated, `$fail(__('billing.validation.vat_invalid'))`, which fits well when your strings live in feature files. A plain untranslated string works for a prototype, but it stays in one language forever.

However you do it, `:attribute` in the final message is replaced with the translated field name, so the rule doesn't need to know which form it's used on. For choosing and combining password rules, see [password rules and confirmation in Laravel](/blog/laravel-password-validation-rules.html).

## Watch out for browser validation

HTML attributes like `required` or `type="email"` make the browser validate the form before the request is even sent. Those bubbles are written by the browser, in the browser's language rather than the one your user picked, and they look nothing like your own errors.

If you want every message to come from Laravel (we do), add `novalidate` to the form and show the server's errors under each field. Inertia's form helpers work the same way: they display whatever Laravel returns, so **a consistent server-side translation is all you need**. For more on building those forms, see our guide to [the Inertia Form component](/blog/inertia-form-component.html).

## Frequently asked questions

### Why are my validation messages still in English?

It's usually one of three things. The locale gets set after validation runs (in a controller instead of middleware, for example), `lang/<locale>/validation.php` doesn't exist, or the file is missing the key and Laravel falls back to English. Check `app()->getLocale()` inside the request that fails and you'll quickly see which one it is.

### How do I translate only the field name, not the whole message?

Add the field to `attributes` in `lang/<locale>/validation.php`, or return it from the `attributes()` method of your Form Request. Laravel puts that name into the translated rule message wherever `:attribute` appears.

### Why does an error show a key like validation.something?

The translator returns the key itself when it can't find a line in the current locale or the fallback locale. Add the missing key to your lang files. A common cause is a custom rule calling `translate()` on a key that doesn't exist.

### Should custom messages go in validation.php or in the Form Request?

Use `validation.custom` for overrides that apply everywhere, and `messages()` for wording that belongs to one form. In a large app, keeping form-specific text in feature lang files makes things much easier to maintain.

## How SaaS Laravel handles validation messages

If you'd rather not assemble all of this yourself, the SaaS Laravel kits already include a translated `validation.php`, `auth.php`, `passwords.php` and `pagination.php` for all 17 supported languages. Field names and custom messages come from `attributes()` and `messages()` methods on Form Requests and spatie/laravel-data objects, which call `__()` with keys from one lang file per feature, such as `modules/settings.validation.attributes.locale`. Custom rules, like the IP address rule used for maintenance mode, return translated messages too. The [localization documentation](/docs/core/localization.html) shows the file layout.

<BlogPostCta title="Validation errors in every language" text="SaaS Laravel ships 17 languages with translated validation messages and field names, plus per-user language settings, in Vue, React or Svelte." />
