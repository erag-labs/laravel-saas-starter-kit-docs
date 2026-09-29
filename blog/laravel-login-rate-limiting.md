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

Without a limit, a script can try thousands of passwords a minute against your login form. A Laravel login throttle fixes that by capping how many attempts one client gets in a time window, which stretches a brute-force attack from minutes into years. Below I'll cover how the rate limiter counts attempts, Fortify's two throttling modes, picking the key, and showing a proper error instead of a bare 429 page.

## What login throttling protects against

Nobody sits there guessing one user's password by hand. Attacks are automated, and each kind leaves a different pattern in your logs:

| Attack | What it looks like | What stops it |
| --- | --- | --- |
| Brute force | Many passwords against one account | A limit per email |
| Credential stuffing | Leaked email/password pairs from other sites | A limit per IP, plus 2FA |
| Password spraying | One common password against many accounts | A limit per IP |
| Lockout abuse | Failing on purpose to lock a victim out | Never lock by email alone |

No single key handles every row, so I'd spend more thought on the throttle key than on whether the number is 5 or 10.

## How Laravel's rate limiter works

The `RateLimiter` keeps a count of hits against a string key, stored in your cache. Once the count goes past the maximum, it rejects further attempts until the decay time is up. You register named limiters in a service provider:

```php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for('login', function (Request $request) {
    return Limit::perMinute(5)->by($request->input('email').'|'.$request->ip());
});
```

After that, you attach it to a route with `->middleware('throttle:login')`. Besides `perMinute()`, `Limit` has `perSecond()`, `perMinutes()`, `perHour()` and `perDay()`.

One detail that's easy to miss: the counters live in the cache store named by `CACHE_STORE`, unless you've set a separate `cache.limiter` store. If you're running more than one app server, that store has to be shared (Redis or the database). Otherwise each server keeps its own count.

## The Laravel login throttle in Fortify

[Laravel Fortify](/blog/laravel-fortify-tutorial.html) can throttle logins in two different ways, and the `limiters.login` value in `config/fortify.php` decides which one you get.

### Option one: a named limiter

With `'login' => 'login'`, Fortify puts `throttle:login` middleware on `POST /login`. It's up to you to define the `login` limiter, usually in `FortifyServiceProvider`. Every POST counts here, whether the password was right or not.

### Option two: Fortify's built-in limiter

If you set `'login' => null`, Fortify skips the middleware and adds `EnsureLoginIsNotThrottled` to its login pipeline. The `LoginRateLimiter` behind it only counts **failed** attempts, and it clears the counter once someone signs in successfully.

| | Named limiter | `LoginRateLimiter` (`null`) |
| --- | --- | --- |
| What counts | Every POST to `/login` | Only failed attempts |
| Limit | Whatever you define | 5 attempts, 60 seconds decay (fixed) |
| Key | Whatever you define | Lowercase email + IP, transliterated |
| When exceeded | `ThrottleRequestsException` (HTTP 429) | Validation error on the email field |
| `Lockout` event | Not fired | Fired |
| Customise | Full control in the closure | Bind your own `LockoutResponse` |

Which should you choose? Fortify's published config uses the named limiter, and it's the one I'd go with because you control the key and the numbers. The built-in limiter gives you a nicer error message with no extra work (it uses the `auth.throttle` translation), but you can't change its limit. Further down I'll show how to get the same friendly error from a named limiter.

## Choosing the throttle key

The key decides who shares a counter, and each obvious choice has a catch.

If you key by IP only, everyone behind the same office network or mobile carrier NAT shares one counter. One person mistyping their password a few times can block their colleagues. Key by email only and you've handed attackers a way to lock out any user: they just fail on purpose with that person's address.

Email plus IP is the sensible default. Repeated attempts on one account from one address get throttled, while the real user on a different network can still sign in.

Normalise the email before building the key. Fortify's own limiter lowercases and transliterates it, so `Admin@Example.com` and `admin@example.com` share one counter:

```php
$key = Str::transliterate(Str::lower((string) $request->input('email')).'|'.$request->ip());
```

### Add a looser per-IP limit as a second layer

If you're wondering what email + IP misses, it's password spraying: one IP trying a single common password against hundreds of different accounts. Each email only sees one attempt, so the per-email counter never fills up. The fix is to return more than one limit from the closure. A request is blocked as soon as any of them is exceeded:

```php
RateLimiter::for('login', function (Request $request) {
    $email = Str::transliterate(Str::lower((string) $request->input(Fortify::username())));

    return [
        Limit::perMinute(5)->by($email.'|'.$request->ip()),
        Limit::perMinute(30)->by($request->ip()),
    ];
});
```

Keep the per-IP number generous. Its job is to catch automation, not to slow down an office where twenty people all sign in at 9am.

### Multi-tenant apps: include the host

In a multi-tenant app the same email can exist in several tenants, each with its own password. If the rate limiter cache is shared across tenants, add `$request->getHost()` to the key. Otherwise failing on one tenant's subdomain would throttle that same person on another tenant where they did nothing wrong.

## Show a friendly error instead of a 429 page

This is the bit that tends to catch people out. With a named limiter, the sixth attempt throws a `ThrottleRequestsException`, which becomes a plain 429 response. Inertia shows non-Inertia responses in a modal dialog, so your user gets a strange popup instead of a message under the form.

You can fix this with `response()` on the limit, returning a normal validation-style redirect:

```php
return Limit::perMinute(5)
    ->by($key)
    ->response(function (Request $request, array $headers) {
        return back()
            ->withErrors(['email' => __('auth.throttle', ['seconds' => $headers['Retry-After']])])
            ->withHeaders($headers);
    });
```

The `$headers` array includes `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`, which means you can tell the user exactly how many seconds to wait. The error then shows up under the email field, just like any other validation message.

## Throttling a custom login controller

Not using Fortify? You can call the rate limiter directly. The order is: check the limit, try the login, then either record the failure or clear the counter. I'd put this in a Form Request or an auth service so the controller stays thin:

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

Like Fortify's built-in limiter, this only counts failures. If you'd like to log lockouts or get alerted when they spike, listen for the `Illuminate\Auth\Events\Lockout` event.

## Throttle the other auth endpoints too

Attackers will go around a protected login form if the routes next to it are open, so check every endpoint that accepts a secret or sends an email:

| Endpoint | Why it needs a limit | Typical approach |
| --- | --- | --- |
| Two-factor challenge | Six-digit codes are guessable without a limit | `fortify.limiters.two-factor`, keyed by `login.id` in the session. See [two-factor authentication in Laravel](/blog/laravel-two-factor-authentication.html) |
| Passkey login | Protects the WebAuthn endpoints | `fortify.limiters.passkeys` |
| Forgot password | Can be used to flood an inbox | The broker's `throttle` in `config/auth.php` (seconds before a user can request another token) |
| Registration | Bots creating accounts | A limit or bot protection (Fortify's route has none by default) |
| Invitation accept | Password form on a public link | `throttle:6,1` or a named limiter |
| Confirm password | A signed-in session can retry passwords | Your own limit (Fortify's route has none by default) |

Keep in mind what rate limits can't do. They slow attackers down, but they won't save a user whose password already leaked from another site. For that you need [strong password rules](/blog/laravel-password-validation-rules.html) and a second factor as well.

## Frequently asked questions

### How many login attempts should Laravel allow?

Five attempts per minute per email and IP is the usual default, and it's what both Fortify's built-in limiter and its published config use. A real user rarely mistypes more than a few times, while an attacker limited to five tries a minute won't get far. I'd add a looser per-IP limit on top to catch spraying.

### Why does my Laravel login throttle not reset after a successful login?

A named limiter counts every request, successful ones included, and the counter only goes away when the window decays. If you want a successful login to clear it, either switch to Fortify's built-in limiter (set `limiters.login` to `null`) or call `RateLimiter::clear($key)` yourself after `Auth::attempt()` succeeds.

### How do I clear a locked-out user in Laravel?

Call `RateLimiter::clear()` with the same key the limiter uses. With named limiters that's awkward, because the middleware stores the key as a hash of the limiter name plus your key, so waiting out the decay window is usually simpler. Flushing the whole cache works too, but it wipes everything else in that store.

### Should I lock accounts permanently after failed logins?

Usually not. A permanent lockout lets anyone who knows an email address disable that account. Short, rolling windows combined with two-factor authentication give you most of the protection without the support tickets.

## How SaaS Laravel handles login throttling

If you'd rather not set all of this up yourself, the [SaaS Laravel starter kits](/) already register three named limiters in `Modules/Auth/Providers/AuthServiceProvider.php`. The `login` limiter allows 5 attempts per minute per lowercase, transliterated email and IP. `two-factor` allows 5 per minute per login session, and `passkeys` allows 10 per minute per credential (or session) and IP. The password change on the Security page and the invitation accept forms use `throttle:6,1`, and resending invitations or admin password-reset emails uses `throttle:3,1`. The Vue, React and Svelte kits all share this backend. The [authentication documentation](/docs/core/authentication.html) has the full setup.

<BlogPostCta title="Throttled sign-in, ready to ship" text="SaaS Laravel ships Fortify login, two-factor and passkey rate limits already configured, with multi-tenancy and roles, in Vue, React or Svelte." />
