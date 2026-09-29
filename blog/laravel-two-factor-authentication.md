---
title: "Two-Factor Authentication in Laravel"
description: "Laravel two factor authentication with Fortify: how TOTP works, the enable, QR code and confirm flow, recovery codes, the login challenge and security tips."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: security
tags: [Authentication, Security]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-two-factor-authentication.html
  - - meta
    - property: og:title
      content: "Two-Factor Authentication in Laravel"
  - - meta
    - property: og:description
      content: "Laravel two factor authentication with Fortify: how TOTP works, the enable, QR code and confirm flow, recovery codes, the login challenge and security tips."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-two-factor-authentication.html
  - - meta
    - name: twitter:title
      content: "Two-Factor Authentication in Laravel"
  - - meta
    - name: twitter:description
      content: "Laravel two factor authentication with Fortify: how TOTP works, the enable, QR code and confirm flow, recovery codes, the login challenge and security tips."
---

# Laravel Two-Factor Authentication with Fortify: A Practical Guide

<BlogPostMeta />

A password on its own is one leaked database or one reused password away from an account takeover. Laravel two factor authentication closes most of that gap with a second step: after the password, the user types a six-digit code from an authenticator app on their phone. Below I'll cover how those codes work, how to turn 2FA on with Laravel Fortify, the enable → QR code → confirm flow, recovery codes and the login challenge. Then the small details that decide whether users like it or end up in your support inbox.

## How TOTP codes work

The codes are TOTP codes (time-based one-time passwords). During setup, the server generates a random secret and shows it as a QR code. The authenticator app stores that secret. From then on, both sides compute a code on their own from the secret and the current 30-second time step. If the two codes match, the user has proven they hold the device.

| Factor | Example |
| --- | --- |
| Something you know | The password |
| Something you have | The phone with the authenticator app |

Nothing travels over the network after setup. That's why the app works offline, and why any standard TOTP app will do. Fortify uses `pragmarx/google2fa` to generate and verify codes and `bacon/bacon-qr-code` to draw the QR code.

## Enabling Laravel two factor authentication with Fortify

[Laravel Fortify](https://github.com/laravel/fortify) is Laravel's headless authentication backend, and 2FA is just one entry in the `features` array of `config/fortify.php`:

```php
use Laravel\Fortify\Features;

'features' => [
    // ...
    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
        'window' => 0,
    ]),
],
```

There aren't many options, but each one changes something you'll notice:

| Option | What it does |
| --- | --- |
| `confirm` | 2FA only becomes active after the user enters a valid code. Until then, login is not challenged. |
| `confirmPassword` | Adds the `password.confirm` middleware to every 2FA management route. |
| `window` | How many extra 30-second steps before and after "now" are accepted. `0` accepts only the current code. |
| `secret-length` | Length of the generated secret (default `16`). |

I use exactly the values in the snippet above: `confirm` and `confirmPassword` on, `window` at `0`. I wouldn't loosen any of them without a concrete reason.

Next, add the `TwoFactorAuthenticatable` trait to your user model:

```php
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    use TwoFactorAuthenticatable;
}
```

Fortify's migration (`add_two_factor_columns_to_users_table`) adds three nullable columns to `users`:

| Column | Type | Holds |
| --- | --- | --- |
| `two_factor_secret` | `text` | The TOTP secret, encrypted |
| `two_factor_recovery_codes` | `text` | A JSON list of recovery codes, encrypted |
| `two_factor_confirmed_at` | `timestamp` | When the user confirmed setup |

Put `two_factor_secret` and `two_factor_recovery_codes` in the model's hidden attributes. You don't want either of them turning up in a JSON response or an Inertia prop.

## The routes Fortify registers

Once the feature is on, Fortify registers the routes below. Every management route needs an authenticated user.

| Method | URI | Route name |
| --- | --- | --- |
| POST | `/user/two-factor-authentication` | `two-factor.enable` |
| GET | `/user/two-factor-qr-code` | `two-factor.qr-code` |
| GET | `/user/two-factor-secret-key` | `two-factor.secret-key` |
| POST | `/user/confirmed-two-factor-authentication` | `two-factor.confirm` |
| GET | `/user/two-factor-recovery-codes` | `two-factor.recovery-codes` |
| POST | `/user/two-factor-recovery-codes` | `two-factor.regenerate-recovery-codes` |
| DELETE | `/user/two-factor-authentication` | `two-factor.disable` |
| GET / POST | `/two-factor-challenge` | `two-factor.login` / `two-factor.login.store` |

## The enable, QR code and confirm flow

Setup takes four requests, and your frontend drives each one:

1. The user clicks "Enable" and your frontend posts to `two-factor.enable`. Fortify's `EnableTwoFactorAuthentication` action generates a secret and eight recovery codes and stores both, encrypted.
2. Fetch `two-factor.qr-code`, which returns JSON with an `svg` and the `otpauth` `url`. I'd also fetch `two-factor.secret-key` and show the key as text for anyone who can't scan.
3. The user types the current code from their app, and you post it as `code` to `two-factor.confirm`. `ConfirmTwoFactorAuthentication` checks it and sets `two_factor_confirmed_at`. A wrong code comes back as a validation error on `code`.
4. Fetch `two-factor.recovery-codes` and ask the user to store them somewhere safe.

The part people usually get wrong is turning `confirm` off. Without it, 2FA is active the moment the secret is saved, so a user who closes the tab before scanning is locked out at their next login. With it, Fortify only challenges users who actually finished setup. Fortify also has an `InteractsWithTwoFactorState` trait for form requests, and its `ensureStateIsValid()` method clears a setup that was started but never finished.

## Recovery codes

Recovery codes are the backup plan for a lost or reset phone. Fortify generates eight of them, each made of two random ten-character strings joined by a dash.

Each code works once. When one is accepted at login, `replaceRecoveryCode()` swaps it for a fresh code so it can't be used again. Users can also throw away the whole list by posting to `two-factor.regenerate-recovery-codes`, and the old codes stop working immediately. If you need a different format, register your own generator with `Fortify::generateRecoveryCodesUsing()`.

## The two-factor challenge on login

When a user with 2FA enabled signs in, Fortify checks the password first. If it's correct, Fortify does **not** log them in yet. It stores the user's ID and "remember me" choice in the session (`login.id` and `login.remember`) and redirects to `/two-factor-challenge`.

The challenge form posts either `code` (from the app) or `recovery_code`. On success, Fortify logs the user in and regenerates the session.

Two safeguards come with it. The first is rate limiting. The POST route uses the limiter named in `fortify.limiters.two-factor`, and I'd key it to the login attempt:

```php
RateLimiter::for('two-factor', function (Request $request) {
    return Limit::perMinute(5)->by($request->session()->get('login.id'));
});
```

The second is replay protection. Fortify caches each accepted code, so the same code can't be used a second time.

## UX tips that prevent support tickets

None of this is hard to build. Skipping it is how 2FA turns into a steady stream of "I'm locked out" emails.

Keep `confirm` on. I've said it already, but a half-finished setup should never be able to lock anyone out.

Show the text key next to the QR code. Some people set up 2FA on the same phone they're browsing on, and they can't scan their own screen.

Make recovery codes easy to keep. Show them right after confirming, add a copy button, and say plainly that each code works once. On the challenge page, a "Use a recovery code" link that swaps the input is all you need. And before users regenerate their codes, tell them the old ones will stop working.

Finally, plan for the user who loses both the phone and the codes. Verify their identity through a channel you trust, then let an administrator reset 2FA. **Never offer a self-service "disable 2FA" email link.** It makes the email inbox the only real factor. Fortify's own action clears all three columns:

```php
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;

app(DisableTwoFactorAuthentication::class)($user);
```

## Security considerations for 2FA secrets and codes

The secrets are encrypted with your app key, so treat `APP_KEY` with care. If you lose it, every user has to set up 2FA again.

I'd always keep `confirmPassword` on. It puts the management routes behind `password.confirm`, so someone sitting at a laptop you left open can't read recovery codes or switch 2FA off. How long a confirmation lasts is set by `password_timeout` in `config/auth.php`.

TOTP depends on the server clock. Keep NTP running on your servers, especially with a strict `window` of `0`.

Fortify dispatches `TwoFactorAuthenticationEnabled`, `TwoFactorAuthenticationConfirmed`, `TwoFactorAuthenticationDisabled`, `TwoFactorAuthenticationFailed` and `RecoveryCodeReplaced`. Listen to them. At minimum I'd write an audit log and email the user when 2FA is turned off.

Also be honest about the limits. A convincing phishing page can relay a TOTP code in real time. For phishing-resistant sign-in, offer [passkeys in Laravel](/blog/laravel-passkeys.html) as well.

## Frequently asked questions

### Does Laravel have built-in two-factor authentication?

Not in the framework itself. Laravel Fortify, the official first-party auth backend, does include TOTP two-factor authentication with QR codes, recovery codes and a login challenge. You switch it on with `Features::twoFactorAuthentication()`.

### Which authenticator apps work with Laravel Fortify?

Any app that supports standard TOTP codes: six digits, refreshed every 30 seconds. Most password managers and dedicated authenticator apps on iOS and Android handle this.

### What happens if a user loses their phone?

They sign in with one of their recovery codes, then set up 2FA again on the new device. If the codes are gone too, an administrator should verify who they are and reset 2FA with `DisableTwoFactorAuthentication`.

### Can I force every user to enable 2FA?

Fortify leaves 2FA optional per user. To require it, add a middleware that sends anyone whose `hasEnabledTwoFactorAuthentication()` returns `false` to your security settings page until they finish setup.

## Two-factor authentication in SaaS Laravel

You can see all of this working in the [SaaS Laravel starter kits](/), which have Fortify 2FA set up with `confirm`, `confirmPassword` and a `window` of `0`. Users manage it on the Security settings page, which itself requires password confirmation. There's a setup dialog with the QR code and text key, and recovery codes you can view and regenerate. On the challenge page, users can switch between an authentication code and a recovery code, and attempts are limited to five per minute. The 2FA columns exist in both the central and the tenant `users` tables, and each tenant domain can switch 2FA off without code changes. The [authentication documentation](/docs/core/authentication.html) has the details, and there's more on how the kit fits into a [multi-tenant SaaS in Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

<BlogPostCta title="Ship secure sign-in from day one" text="SaaS Laravel includes Fortify authentication with two-factor codes, recovery codes and passkeys, plus multi-tenancy and roles, in Vue, React or Svelte." />
