---
title: "Rate Limiting Login Attempts in Laravel"
description: "A Laravel login throttle guide: how Fortify limits sign-ins, choosing a throttle key, layered limits, friendly errors for Inertia and other auth routes."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: security
tags: [Authentication, Security]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-login-rate-limiting.html
  - - meta
    - property: og:title
      content: "Rate Limiting Login Attempts in Laravel"
  - - meta
    - property: og:description
      content: "A Laravel login throttle guide: how Fortify limits sign-ins, choosing a throttle key, layered limits, friendly errors for Inertia and other auth routes."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-login-rate-limiting.html
  - - meta
    - name: twitter:title
      content: "Rate Limiting Login Attempts in Laravel"
  - - meta
    - name: twitter:description
      content: "A Laravel login throttle guide: how Fortify limits sign-ins, choosing a throttle key, layered limits, friendly errors for Inertia and other auth routes."
---

# Laravel Login Throttle: How to Rate Limit Sign-In Attempts Properly

<BlogPostMeta />

A login form without limits lets anyone try thousands of passwords per minute. A **Laravel login throttle** caps how many attempts a client can make in a time window, which turns brute force from minutes of work into years. This guide explains how Laravel's rate limiter works, the two ways Laravel Fortify throttles logins, how to pick a good throttle key, and how to show a friendly error instead of a bare 429 page.

## What login throttling protects against

Attackers rarely guess one user's password by hand. They automate, and each automated attack looks different in your logs:

| Attack | What it looks like | What stops it |
| --- | --- | --- |
| Brute force | Many passwords against one account | A limit per email |
| Credential stuffing | Leaked email/password pairs from other sites | A limit per IP, plus 2FA |
| Password spraying | One common password against many accounts | A limit per IP |
| Lockout abuse | Failing on purpose to lock a victim out | Never lock by email alone |

No single key covers every row, which is why the throttle key matters more than the exact number of attempts.

## How Laravel's rate limiter works

Laravel's `RateLimiter` counts hits against a string key in your cache. When the count passes the maximum, further attempts are rejected until the decay time runs out. You define named limiters in a service provider:

```php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for('login', function (Request $request) {
    return Limit::perMinute(5)->by($request->input('email').'|'.$request->ip());
});
```

Then attach it to a route with `->middleware('throttle:login')`. `Limit` also has `perSecond()`, `perMinutes()`, `perHour()` and `perDay()`.

The counters live in the cache store from `CACHE_STORE`, unless you set a separate `cache.limiter` store. If you run several app servers, that store must be shared (Redis or the database), or each server counts on its own.

## The Laravel login throttle in Fortify

[Laravel Fortify](/blog/laravel-fortify-tutorial.html) supports two throttling modes, chosen by `limiters.login` in `config/fortify.php`.

**Mode 1: a named limiter.** With `'login' => 'login'`, Fortify adds `throttle:login` middleware to `POST /login`. You define the `login` limiter yourself, usually in `FortifyServiceProvider`. Every POST counts, successful or not.

**Mode 2: Fortify's built-in limiter.** Set `'login' => null` and Fortify adds `EnsureLoginIsNotThrottled` to its login pipeline instead. Its `LoginRateLimiter` only counts **failed** attempts and clears the counter after a successful login.

| | Named limiter | `LoginRateLimiter` (`null`) |
| --- | --- | --- |
| What counts | Every POST to `/login` | Only failed attempts |
| Limit | Whatever you define | 5 attempts, 60 seconds decay (fixed) |
| Key | Whatever you define | Lowercase email + IP, transliterated |
| When exceeded | `ThrottleRequestsException` (HTTP 429) | Validation error on the email field |
| `Lockout` event | Not fired | Fired |
| Customise | Full control in the closure | Bind your own `LockoutResponse` |

The named limiter is the more flexible option and the one Fortify's published config uses. The built-in limiter is less configurable but produces a nicer error out of the box, using the `auth.throttle` translation message.

## Choosing the throttle key

The key decides who shares a counter. Each simple choice has a weakness:

- **IP only.** Everyone behind the same office network or mobile carrier NAT shares one counter, so one noisy user blocks colleagues.
- **Email only.** An attacker can lock any user out by failing on purpose with their address.
- **Email + IP.** A good default. Attacks on one account from one address get throttled, and the real user on another network can still sign in.

Normalise the email before building the key. Fortify's own limiter lowercases and transliterates it, so `Admin@Example.com` and `admin@example.com` share a counter:

```php
$key = Str::transliterate(Str::lower((string) $request->input('email')).'|'.$request->ip());
```

### Layer a looser per-IP limit on top

Email + IP does not stop password spraying, where one IP tries a single password against hundreds of accounts. A limiter closure can return several limits, and a request is blocked when **any** of them is exceeded:

```php
RateLimiter::for('login', function (Request $request) {
    $email = Str::transliterate(Str::lower((string) $request->input(Fortify::username())));

    return [
        Limit::perMinute(5)->by($email.'|'.$request->ip()),
        Limit::perMinute(30)->by($request->ip()),
    ];
});
```

Keep the per-IP number generous. It exists to catch automation, not to slow down an office where twenty people sign in at 9am.

### Multi-tenant apps: include the host

In a multi-tenant app, the same email can exist in several tenants with separate passwords. If your rate limiter cache is shared across tenants, add `$request->getHost()` to the key so failing on one tenant's subdomain does not throttle the same user on another.

## Show a friendly error instead of a 429 page

With a named limiter, the 6th attempt throws a `ThrottleRequestsException`. For an Inertia app that means a plain 429 response rather than a validation error, and Inertia shows non-Inertia responses in a modal dialog. Use `response()` on the limit to return a normal validation-style redirect instead:

```php
return Limit::perMinute(5)
    ->by($key)
    ->response(function (Request $request, array $headers) {
        return back()
            ->withErrors(['email' => __('auth.throttle', ['seconds' => $headers['Retry-After']])])
            ->withHeaders($headers);
    });
```

The `$headers` array contains `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`, so you can tell the user exactly how long to wait. The error then appears under the email field like any other validation message.

## Throttling a custom login controller

Without Fortify, use the rate limiter directly: check, attempt, then either count the failure or clear the counter. Put this in a Form Request or an auth service rather than the controller:

```php
if (RateLimiter::tooManyAttempts($key, 5)) {
    event(new Lockout($request));

    throw ValidationException::withMessages([
        'email' => __('auth.throttle', ['seconds' => RateLimiter::availableIn($key)]),
    ]);
}

if (! Auth::attempt($request->only('email', 'password'), $request->boolean('remember'))) {
    RateLimiter::hit($key); // decays after 60 seconds by default
    throw ValidationException::withMessages(['email' => __('auth.failed')]);
}

RateLimiter::clear($key);
```

This counts only failures, the same way Fortify's built-in limiter does. Listen for the `Illuminate\Auth\Events\Lockout` event if you want to log lockouts or alert on spikes.

## Throttle the other auth endpoints too

Attackers go around a protected login form if the neighbouring routes are open. Check every endpoint that accepts a secret or sends an email:

| Endpoint | Why it needs a limit | Typical approach |
| --- | --- | --- |
| Two-factor challenge | Six-digit codes are guessable without a limit | `fortify.limiters.two-factor`, keyed by `login.id` in the session. See [two-factor authentication in Laravel](/blog/laravel-two-factor-authentication.html) |
| Passkey login | Protects the WebAuthn endpoints | `fortify.limiters.passkeys` |
| Forgot password | Can be used to flood an inbox | The broker's `throttle` in `config/auth.php` (seconds before a user can request another token) |
| Registration | Bots creating accounts | A limit or bot protection (Fortify's route has none by default) |
| Invitation accept | Password form on a public link | `throttle:6,1` or a named limiter |
| Confirm password | A signed-in session can retry passwords | Your own limit (Fortify's route has none by default) |

Rate limits slow attackers down; they do not stop a user whose password leaked elsewhere. Pair them with [strong password rules](/blog/laravel-password-validation-rules.html) and a second factor.

## Frequently asked questions

### How many login attempts should Laravel allow?

Five attempts per minute per email and IP is the common default, and it is what both Fortify's built-in limiter and its published config use. Real users rarely mistype more than a few times, while an attacker at five tries per minute needs a very long time to get anywhere. Add a looser per-IP limit to catch spraying.

### Why does my Laravel login throttle not reset after a successful login?

A named limiter counts every request, including successful ones, and the counter simply decays after the window. If you want successful logins to clear the counter, use Fortify's built-in limiter (set `limiters.login` to `null`) or call `RateLimiter::clear($key)` yourself after `Auth::attempt()` succeeds.

### How do I clear a locked-out user in Laravel?

Call `RateLimiter::clear()` with the same key the limiter uses. For named limiters, the middleware stores the key as a hash of the limiter name plus your key, so it is usually easier to wait for the decay window than to clear it by hand. Flushing the whole cache also clears it, but that removes everything else in the store.

### Should I lock accounts permanently after failed logins?

Usually not. Permanent lockouts let anyone who knows an email address disable that account. Short, rolling time windows plus two-factor authentication give most of the protection without the support tickets.

## How SaaS Laravel handles login throttling

The [SaaS Laravel starter kits](/) register three named limiters in `Modules/Auth/Providers/AuthServiceProvider.php`: `login` allows 5 attempts per minute per lowercase, transliterated email and IP, `two-factor` allows 5 per minute per login session, and `passkeys` allows 10 per minute per credential (or session) and IP. The password change on the Security page and the invitation accept forms use `throttle:6,1`, while resending invitations and admin password-reset emails use `throttle:3,1`. The Vue, React and Svelte kits share this backend. See the [authentication documentation](/docs/core/authentication.html) for the full setup.

<BlogPostCta title="Throttled sign-in, ready to ship" text="SaaS Laravel ships Fortify login, two-factor and passkey rate limits already configured, with multi-tenancy and roles, in Vue, React or Svelte." />
