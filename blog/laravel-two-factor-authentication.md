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

A password on its own is one leaked database or one reused password away from an account takeover. **Laravel two factor authentication** adds a second step: after the password, the user types a six-digit code from an authenticator app on their phone. This guide explains how those codes work, how to turn 2FA on with Laravel Fortify, the enable → QR code → confirm flow, recovery codes, the login challenge, and the details that make it safe and pleasant to use.

## How TOTP codes work

The codes come from **TOTP** (time-based one-time passwords). When a user sets up 2FA, the server generates a random secret and shows it as a QR code. The authenticator app stores that secret. From then on, both sides independently compute a code from the secret and the current 30-second time step. If the codes match, the user has proven they hold the device.

| Factor | Example |
| --- | --- |
| Something you know | The password |
| Something you have | The phone with the authenticator app |

Nothing travels over the network after setup, so the app works offline, and any standard TOTP app will do. Fortify uses `pragmarx/google2fa` to generate and verify codes and `bacon/bacon-qr-code` to draw the QR code.

## Enabling Laravel two factor authentication with Fortify

[Laravel Fortify](https://github.com/laravel/fortify) is Laravel's headless authentication backend. 2FA is one entry in the `features` array of `config/fortify.php`:

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

| Option | What it does |
| --- | --- |
| `confirm` | 2FA only becomes active after the user enters a valid code. Until then, login is not challenged. |
| `confirmPassword` | Adds the `password.confirm` middleware to every 2FA management route. |
| `window` | How many extra 30-second steps before and after "now" are accepted. `0` accepts only the current code. |
| `secret-length` | Length of the generated secret (default `16`). |

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

Add `two_factor_secret` and `two_factor_recovery_codes` to the model's hidden attributes so they never end up in JSON responses or Inertia props.

## The routes Fortify registers

With the feature enabled, Fortify registers these routes (all management routes require an authenticated user):

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

1. **Enable.** The user clicks "Enable" and your frontend posts to `two-factor.enable`. Fortify's `EnableTwoFactorAuthentication` action generates a secret and eight recovery codes and stores both, encrypted.
2. **Show the QR code.** Fetch `two-factor.qr-code`, which returns JSON with an `svg` and the `otpauth` `url`. Also fetch `two-factor.secret-key` and show the key as text, for users who can't scan.
3. **Confirm.** The user types the current code from their app and you post it as `code` to `two-factor.confirm`. `ConfirmTwoFactorAuthentication` verifies it and sets `two_factor_confirmed_at`. A wrong code comes back as a validation error on `code`.
4. **Save recovery codes.** Fetch `two-factor.recovery-codes` and ask the user to store them somewhere safe.

The `confirm` option is what makes this flow safe. Without it, 2FA is active as soon as the secret is saved, so a user who closes the tab before scanning is locked out at the next login. With it, Fortify only challenges users whose setup is confirmed. Its `InteractsWithTwoFactorState` trait for form requests also provides `ensureStateIsValid()`, which clears a setup that was started but never finished.

## Recovery codes

Recovery codes are the backup plan for a lost or reset phone. Fortify generates eight of them, each made of two random ten-character strings joined by a dash.

- **One use each.** When a recovery code is accepted at login, `replaceRecoveryCode()` swaps it for a fresh code, so it can't be used again.
- **Regenerate on demand.** Posting to `two-factor.regenerate-recovery-codes` replaces the whole list. Old codes stop working immediately.
- **Custom format.** If you need a different format, register a generator with `Fortify::generateRecoveryCodesUsing()`.

## The two-factor challenge on login

When a user with 2FA enabled signs in, Fortify checks the password first. If it is correct, Fortify does **not** log the user in yet. It stores the user's ID and "remember me" choice in the session (`login.id` and `login.remember`) and redirects to `/two-factor-challenge`.

The challenge form posts either `code` (from the app) or `recovery_code`. On success, Fortify logs the user in and regenerates the session. Two safeguards are built in:

- **Rate limiting.** The POST route uses the limiter named in `fortify.limiters.two-factor`. Define it per login attempt:

```php
RateLimiter::for('two-factor', function (Request $request) {
    return Limit::perMinute(5)->by($request->session()->get('login.id'));
});
```

- **Replay protection.** Fortify caches each accepted code, so the same code can't be used a second time.

## UX tips that prevent support tickets

- **Always confirm.** Keep `confirm` on so a half-finished setup can never lock anyone out.
- **Offer the text key.** Some users set up 2FA on the same phone they're browsing on and can't scan their own screen.
- **Make recovery codes easy to keep.** Show them right after confirming, with a copy button, and explain that each code works once.
- **One-click switch on the challenge page.** A "Use a recovery code" link that swaps the input is enough.
- **Explain regeneration.** Before regenerating, tell users that their old codes will stop working.
- **Plan trusted admin resets.** When a user loses both phone and codes, verify their identity through a channel you trust, then let an administrator reset 2FA. Never offer a self-service "disable 2FA" email link, which would make the email inbox the only real factor. Fortify's own action clears all three columns:

```php
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;

app(DisableTwoFactorAuthentication::class)($user);
```

## Security considerations

- **Secrets are encrypted with your app key.** Treat `APP_KEY` with care: if you lose it, every user has to set up 2FA again.
- **Require a recent password.** `confirmPassword` puts the management routes behind `password.confirm`, so someone at an unlocked laptop can't read recovery codes or turn 2FA off. How long a confirmation lasts is set by `password_timeout` in `config/auth.php`.
- **Mind the clock.** TOTP depends on the server time. Keep NTP running on your servers, especially with a strict `window` of `0`.
- **Audit the events.** Fortify dispatches `TwoFactorAuthenticationEnabled`, `TwoFactorAuthenticationConfirmed`, `TwoFactorAuthenticationDisabled`, `TwoFactorAuthenticationFailed` and `RecoveryCodeReplaced`. Listen to them to write an audit log or email the user when 2FA is turned off.
- **Know the limits.** A convincing phishing page can relay a TOTP code in real time. For phishing-resistant sign-in, offer [passkeys in Laravel](/blog/laravel-passkeys.html) as well.

## Frequently asked questions

### Does Laravel have built-in two-factor authentication?

Not in the framework itself, but Laravel Fortify, the official first-party auth backend, includes TOTP two-factor authentication with QR codes, recovery codes and a login challenge. You enable it with `Features::twoFactorAuthentication()`.

### Which authenticator apps work with Laravel Fortify?

Any app that supports standard TOTP codes: six digits, refreshed every 30 seconds. Most password managers and dedicated authenticator apps on iOS and Android support this.

### What happens if a user loses their phone?

They sign in with one of their recovery codes and then set up 2FA again on a new device. If they have lost the codes too, an administrator should verify their identity and reset 2FA with `DisableTwoFactorAuthentication`.

### Can I force every user to enable 2FA?

Fortify leaves 2FA optional for each user. To require it, add a middleware that sends users whose `hasEnabledTwoFactorAuthentication()` returns `false` to your security settings page until they finish setup.

## Two-factor authentication in SaaS Laravel

The [SaaS Laravel starter kits](/) ship with Fortify 2FA already wired up, using `confirm`, `confirmPassword` and a `window` of `0`. Users manage it on the Security settings page, which itself requires password confirmation. The page has a setup dialog with the QR code and text key, plus recovery codes you can view and regenerate. The challenge page lets users switch between an authentication code and a recovery code, and attempts are limited to five per minute. The 2FA columns exist in both the central and the tenant `users` tables, and each tenant domain can switch 2FA off without code changes. Read the details in the [authentication documentation](/docs/core/authentication.html), or see how the kit fits into a [multi-tenant SaaS in Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

<BlogPostCta title="Ship secure sign-in from day one" text="SaaS Laravel includes Fortify authentication with two-factor codes, recovery codes and passkeys, plus multi-tenancy and roles, in Vue, React or Svelte." />
