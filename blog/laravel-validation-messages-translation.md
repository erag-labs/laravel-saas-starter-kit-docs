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

Nothing makes a translated app feel half-finished faster than an English error under a German form. **Laravel validation messages translation** is mostly built in, but only once you understand where each part of a message comes from: the rule text, the field name, the values and your own overrides.

This guide explains the order in which Laravel looks up a message, how to get `validation.php` in every language, and how to translate field names, custom messages, array fields, enum values and custom rule classes. How the translated errors reach an Inertia form is covered in the pillar guide on [Laravel Inertia translations](/blog/laravel-inertia-translations.html).

## Where a validation message comes from

When a rule fails, Laravel builds the message in two steps: first it finds the **message template**, then it fills in the **placeholders** such as `:attribute`, `:max` or `:values`.

For the template, the validator stops at the first match:

| Step | Source | Example key |
| --- | --- | --- |
| 1 | Messages passed to the validator (`messages()` on a Form Request) | `email.unique` |
| 2 | Custom lines in the lang file | `validation.custom.email.unique` |
| 3 | Size rules by type (`min`, `max`, `size`, `between`) | `validation.max.string` |
| 4 | The default line for the rule | `validation.unique` |

Every translator lookup uses the current locale, so if your locale middleware has already run, steps 2 to 4 are translated for free. When a key is missing in the current locale, Laravel tries `APP_FALLBACK_LOCALE`. If it is missing there too, the user sees the raw key, such as `validation.custom_rule`.

Field names go through a similar chain: names passed to the validator (`attributes()`), then `validation.attributes` in the lang file, then the field key itself with underscores turned into spaces, so `first_name` becomes "first name".

## Laravel validation messages translation starts with lang files

A fresh Laravel app has no `lang` folder. Running the publish command creates `lang/en` with Laravel's four default files:

```bash
php artisan lang:publish
```

That gives you `auth.php`, `pagination.php`, `passwords.php` and `validation.php`, in English only. For every other language you need a `lang/<locale>/validation.php` with the same keys. You can translate it yourself, or start from a community translation package such as `laravel-lang/lang` and review the result.

Two things to check in any translated file:

- **Nested rules.** Size rules are arrays (`'max' => ['string' => ..., 'numeric' => ...]`), and the `Password` rule reads `validation.password.mixed`, `.letters`, `.numbers`, `.symbols` and `.uncompromised`. A flat translation of `max` breaks the type lookup.
- **Placeholders.** Translators must keep `:attribute`, `:min`, `:max`, `:values` and friends exactly as they are, but may move them anywhere in the sentence.

Login errors are not validation rules. "These credentials do not match our records" lives in `auth.php` under `failed`, and the throttle message under `throttle`, so translate those files too.

## Translating field names

A translated rule message with an English field name ("Das Feld email muss…") is the most common leftover. There are two places to fix it.

**Globally, in the lang file.** Good for fields that mean the same thing everywhere:

```php
// lang/de/validation.php
'attributes' => [
    'email' => 'E-Mail-Adresse',
    'password' => 'Passwort',
],
```

**Per form, in the request.** Good when the same key means different things on different forms, or when your strings live in feature files. Return the names from `attributes()` and translate them with `__()` inside the method, never in a constant or config file, as the pillar article explains.

Laravel also supports case variants of the placeholder: `:attribute` as written, `:Attribute` with a capital first letter, and `:ATTRIBUTE` in upper case. Use `:Attribute` when the field name starts the sentence, so translators don't need a separate string for it.

## Custom messages for a single rule

Sometimes the generic text is not good enough, for example "The email has already been taken" on a sign-up form. You can override it in two places:

| Where | Key | Best when |
| --- | --- | --- |
| `validation.custom` in each `lang/<locale>/validation.php` | `'custom' => ['email' => ['unique' => '...']]` | The same override applies to every form |
| `messages()` on the Form Request | `'email.unique' => __('signup.email_taken')` | The message is specific to one form |

The second option keeps each form's wording next to the form's rules and in the same feature lang file as its labels:

```php
public function messages(): array
{
    return [
        'email.unique' => __('signup.validation.email_taken'),
        'terms.accepted' => __('signup.validation.terms_required'),
    ];
}
```

Keys in `messages()` can also target a rule for every field (`'required' => ...`) or use wildcards, which matters for arrays.

## Arrays and nested fields

For array input, the default field name is the full path, so a user sees "The members.2.email field is required". Two tools fix that.

First, wildcard keys work in both `messages()` and `attributes()`:

```php
public function attributes(): array
{
    return [
        'members.*.email' => __('team.validation.member_email'),
    ];
}
```

Second, Laravel fills in the position of the failing item. `:index` is zero-based, `:position` starts at 1, and `:ordinal-position` gives "1st", "2nd" and so on. A translation like `'member_email' => 'E-Mail von Mitglied :position'` turns into "E-Mail von Mitglied 3", which is far clearer than a dotted path.

## Translating values in messages

Rules such as `required_if` print a value in the message: "The company field is required when type is business." The field name `type` comes from your attributes, but `business` is the raw input value.

Laravel looks for a translated value under `validation.values`, keyed by field and value:

```php
'values' => [
    'type' => [
        'business' => 'Geschäftskunde',
    ],
],
```

The same lookup is used for the `:input` placeholder, so a message that echoes the user's input can also show a friendly, translated value.

## Custom rule classes

A rule class that implements `ValidationRule` receives a `$fail` callback. You have three options for the message:

```php
public function validate(string $attribute, mixed $value, Closure $fail): void
{
    if (! $this->isValidVatNumber($value)) {
        $fail('validation.vat_number')->translate();
    }
}
```

1. **A lang key plus `translate()`**, as above. The key is looked up in the current locale; you can pass replacements to `translate()`.
2. **An already translated string**, `$fail(__('billing.validation.vat_invalid'))`, which works well when your strings live in feature files.
3. **A plain string.** Fine for a prototype, but it stays in one language forever.

In all three cases, `:attribute` in the final message is replaced with the translated field name, so the rule doesn't need to know which form it is used on. For choosing and combining password rules, see [password rules and confirmation in Laravel](/blog/laravel-password-validation-rules.html).

## Watch out for browser validation

HTML attributes like `required` or `type="email"` make the browser validate before your request is sent. Those bubbles are written by the browser, in the browser's language, not the one your user picked, and they look different from your own errors.

If every message should come from Laravel, add `novalidate` to the form and show the server's errors under each field. The same applies to Inertia's form helpers: they display whatever Laravel returns, so a consistent server-side translation is all you need. For more on building those forms, see the guide to the [Inertia form component](/blog/inertia-form-component.html).

## Frequently asked questions

### Why are my validation messages still in English?

Usually one of three things: the locale is set after validation runs (for example in a controller instead of middleware), `lang/<locale>/validation.php` does not exist, or it is missing the key and Laravel falls back to English. Check `app()->getLocale()` inside the request that fails.

### How do I translate only the field name, not the whole message?

Add the field to `attributes` in `lang/<locale>/validation.php`, or return it from the `attributes()` method of your Form Request. Laravel inserts that name into the translated rule message wherever `:attribute` appears.

### Why does an error show a key like validation.something?

The translator returns the key itself when it finds no line in the current locale or the fallback locale. Add the missing key to your lang files. A custom rule that calls `translate()` on a key that does not exist is a common cause.

### Should custom messages go in validation.php or in the Form Request?

Use `validation.custom` for overrides that apply everywhere and `messages()` for wording that belongs to one form. Keeping form-specific text in feature lang files makes large apps easier to maintain.

## How SaaS Laravel handles validation messages

The SaaS Laravel kits include a translated `validation.php`, `auth.php`, `passwords.php` and `pagination.php` for all 17 supported languages. Field names and custom messages come from `attributes()` and `messages()` methods on Form Requests and spatie/laravel-data objects, which call `__()` with keys from one lang file per feature, such as `modules/settings.validation.attributes.locale`. Custom rules, for example the IP address rule used for maintenance mode, return translated messages too. See the [localization documentation](/docs/core/localization.html) for the file layout.

<BlogPostCta title="Validation errors in every language" text="SaaS Laravel ships 17 languages with translated validation messages and field names, plus per-user language settings, in Vue, React or Svelte." />
