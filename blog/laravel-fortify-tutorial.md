---
title: "Laravel Fortify Tutorial for Inertia Apps"
description: "A Laravel Fortify tutorial for Inertia apps: install Fortify, pick features, render Inertia pages and wire up login, registration and password reset."
pageClass: blog-page
date: 2026-09-29
author: erag
category: security
tags: [Authentication, Inertia]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-fortify-tutorial.html
  - - meta
    - property: og:title
      content: "Laravel Fortify Tutorial for Inertia Apps"
  - - meta
    - property: og:description
      content: "A Laravel Fortify tutorial for Inertia apps: install Fortify, pick features, render Inertia pages and wire up login, registration and password reset."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-fortify-tutorial.html
  - - meta
    - name: twitter:title
      content: "Laravel Fortify Tutorial for Inertia Apps"
  - - meta
    - name: twitter:description
      content: "A Laravel Fortify tutorial for Inertia apps: install Fortify, pick features, render Inertia pages and wire up login, registration and password reset."
---

# Laravel Fortify Tutorial: Headless Authentication for Inertia Apps

<BlogPostMeta />

Laravel Fortify gives you every authentication route and controller you need, and not a single screen. In an Inertia app that's exactly what you want, because the pages live in Vue, React or Svelte anyway. In this Laravel Fortify tutorial we install Fortify, choose its features, render an Inertia page for each view, and walk through how login, registration and password reset actually work, including where you can customise them.

## What Fortify does and what you build

Fortify is a headless authentication backend. It registers routes, runs validation and hashing, talks to the session guard, and returns redirects or JSON. Your side of the deal is the pages plus a few small action classes.

| Fortify handles | You provide |
| --- | --- |
| Routes and controllers for login, logout, registration, password reset, email verification, password confirmation, 2FA and passkeys | The Inertia pages (forms, links, status messages) |
| The login pipeline, throttling hooks and session regeneration | Rate limiter definitions |
| Password reset tokens and emails via Laravel's password broker | The `CreateNewUser` and `ResetUserPassword` actions |
| Events such as `Registered` and `PasswordReset` | Listeners, if you need them |

Since the frontend is entirely yours, one Fortify setup works the same for an Inertia app built on Vue, React or Svelte.

## Laravel Fortify tutorial: installing the package

Require the package, run the installer and migrate:

```bash
composer require laravel/fortify
php artisan fortify:install
php artisan migrate
```

`fortify:install` publishes all the files you'll end up editing. There's `config/fortify.php`, which holds the guard, password broker, features, limiters and redirects. There's `app/Providers/FortifyServiceProvider.php`, already registered in `bootstrap/providers.php` for you. Under `app/Actions/Fortify/` you get `CreateNewUser`, `ResetUserPassword`, `UpdateUserPassword`, `UpdateUserProfileInformation` and a `PasswordValidationRules` trait. And finally there are migrations for the two-factor columns on `users` and for the `passkeys` table.

## Choosing features in config/fortify.php

Each entry in the `features` array turns on a group of routes. If you leave one out, its routes are never registered at all.

```php
use Laravel\Fortify\Features;

'features' => [
    Features::registration(),
    Features::resetPasswords(),
    Features::emailVerification(),
    Features::twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true]),
    Features::passkeys(['confirmPassword' => true]),
],
```

| Feature | What it adds | Deep dive |
| --- | --- | --- |
| `registration()` | `/register` page and POST | This post |
| `resetPasswords()` | Forgot and reset password pages and POSTs | This post |
| `emailVerification()` | Verification notice, signed link and resend | [Email verification in Laravel](/blog/laravel-email-verification.html) |
| `updateProfileInformation()` / `updatePasswords()` | PUT endpoints for profile and password changes | Optional; many apps write their own settings controllers |
| `twoFactorAuthentication()` | TOTP setup, QR code, recovery codes and the login challenge | [Two-factor authentication in Laravel](/blog/laravel-two-factor-authentication.html) |
| `passkeys()` | WebAuthn registration and passwordless login | [Passkeys in Laravel](/blog/laravel-passkeys.html) |

Login, logout and password confirmation are always registered, whatever you put here.

While you have the file open, look at a few other settings. `guard` and `passwords` pick the session guard and password broker Fortify uses. `username` and `email` are the field names on the login and reset forms, and `lowercase_usernames` lowercases the email before login and registration. `home` is the default redirect after login, registration and reset. If you want every Fortify route under a path or a subdomain, that's what `prefix` and `domain` are for.

## Rendering Inertia pages for Fortify

Fortify's GET routes (`/login`, `/register`, `/forgot-password` and so on) need you to tell them what to render. You do that in `FortifyServiceProvider::boot()` by returning an Inertia response:

```php
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;

Fortify::loginView(fn (Request $request) => Inertia::render('auth/Login', [
    'canResetPassword' => Features::enabled(Features::resetPasswords()),
    'canRegister' => Features::enabled(Features::registration()),
    'status' => $request->session()->get('status'),
]));

Fortify::registerView(fn () => Inertia::render('auth/Register'));
Fortify::requestPasswordResetLinkView(fn () => Inertia::render('auth/ForgotPassword'));
```

`resetPasswordView`, `verifyEmailView`, `confirmPasswordView` and `twoFactorChallengeView` follow the same pattern. On the reset page, pass `$request->route('token')` and `$request->email` as props so the form can post them back.

We'd always pass flags like `canRegister`, so the page can hide links to features you've switched off. Pass the session `status` as well. That's where Fortify flashes messages like "We have emailed your password reset link".

## How the Fortify login flow works

The login page posts `email`, `password` and an optional `remember` to `POST /login` (route name `login.store`). Using Inertia's `<Form>` component with Wayfinder, the page doesn't need a single hard-coded URL:

```vue
<script setup lang="ts">
import { Form } from '@inertiajs/vue3';
import { store } from '@/routes/login';
</script>

<template>
    <Form v-bind="store.form()" :reset-on-success="['password']" v-slot="{ errors, processing }">
        <input name="email" type="email" autocomplete="email" />
        <input name="password" type="password" autocomplete="current-password" />
        <button :disabled="processing">Log in</button>
    </Form>
</template>
```

On the server, the request goes through a small pipeline:

1. Throttle. If you name a limiter in `fortify.limiters.login`, the route applies it as `throttle` middleware. We cover tuning it in [rate limiting login attempts in Laravel](/blog/laravel-login-rate-limiting.html).
2. Canonicalize. With `lowercase_usernames` on, the email is lowercased.
3. Two-factor check. If 2FA is enabled and the user has confirmed it, Fortify puts the user ID in the session and redirects to the challenge instead of logging in.
4. Attempt. `Auth::guard(...)->attempt()` runs with the credentials and the remember flag.
5. Prepare the session. The session ID is regenerated and the limiter is cleared.

Validation errors come back as ordinary Inertia errors, so `errors.email` shows "These credentials do not match our records" with no extra code on your part.

### Customising who may log in

`Fortify::authenticateUsing()` replaces the credential check. Return the user to log them in, or `null` to fail:

```php
Fortify::authenticateUsing(function (Request $request) {
    $user = User::where('email', $request->email)->first();

    if ($user && ! $user->is_suspended && Hash::check($request->password, $user->password)) {
        return $user;
    }
});
```

`is_suspended` is a stand-in for whatever column your app actually uses. If you need bigger changes, `Fortify::authenticateThrough()` lets you return your own list of pipeline classes.

## Registration with CreateNewUser

`POST /register` hands the whole request to your `CreatesNewUsers` action. The published `CreateNewUser` validates the input and creates the user:

```php
public function create(array $input): User
{
    Validator::make($input, [
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'string', 'email', 'max:255', Rule::unique(User::class)],
        'password' => $this->passwordRules(),
    ])->validate();

    return User::create([...]);
}
```

After that, Fortify fires the `Registered` event, logs the new user in, regenerates the session and redirects. `Registered` is also what triggers the verification email when email verification is turned on.

This action is where you'd add fields like a company name or assign a default role. Keep it thin, though. Once registration grows into several steps, we'd move the work into a service class and call that from here. For what belongs in `passwordRules()`, and how Fortify's always-on password confirmation page protects sensitive screens, see [Laravel password rules and confirmation](/blog/laravel-password-validation-rules.html).

## Password reset

The reset flow has four steps, all backed by Laravel's password broker (the one named in `fortify.passwords`):

| Step | Route | What happens |
| --- | --- | --- |
| Request page | GET `/forgot-password` (`password.request`) | Your Inertia page with an email field |
| Send link | POST `/forgot-password` (`password.email`) | The broker creates a token and emails a reset link |
| Reset page | GET `/reset-password/{token}` (`password.reset`) | Your page with token, email and new password fields |
| Save | POST `/reset-password` (`password.update`) | Your `ResetUserPassword` action sets the new password |

Once the reset succeeds, Fortify redirects to the login page with a status message. Token lifetime and throttling come from the broker's `expire` and `throttle` settings in `config/auth.php`.

## Redirects and responses

By default, every successful action redirects to `fortify.home`. To override individual cases, add a `redirects` array to `config/fortify.php`:

```php
'redirects' => [
    'login' => '/dashboard',
    'logout' => '/',
    'register' => '/welcome',
    'email-verification' => '/dashboard',
],
```

It accepts `password-reset` and `password-confirmation` too. When a redirect needs real logic, such as sending admins somewhere different, bind your own class to a response contract like `Laravel\Fortify\Contracts\LoginResponse` in the container.

Every built-in response also returns JSON when the request expects it. That's why Fortify works for SPAs and mobile clients as well. If you don't want the GET page routes at all, set `views` to `false`.

## Frequently asked questions

### Does Laravel Fortify include login pages?

No. Fortify is headless: it registers the routes and the logic, and you render the pages. With Inertia, you return `Inertia::render()` from callbacks like `Fortify::loginView()`.

### Can I use Fortify with Inertia and React or Svelte instead of Vue?

Yes. Fortify only ever sees form posts, and it answers with redirects, validation errors or JSON. The server setup is identical for Vue, React and Svelte; only the page components change.

### How do I change where users land after login?

Set `home` in `config/fortify.php`, or add `'redirects' => ['login' => '/somewhere']`. For conditional redirects, bind your own `LoginResponse` implementation.

### Can Fortify handle two different user types?

Fortify works with one guard at a time, set in `fortify.guard`. If you need separate admin and customer logins, read [separate auth guards for admins and customers](/blog/laravel-multiple-auth-guards.html).

## How SaaS Laravel uses Fortify

If you'd rather not wire all of this up yourself, the SaaS Laravel kits have it done already. An `Auth` module connects Fortify to the app: its `AuthServiceProvider` registers the Inertia views, the `CreateNewUser` and `ResetUserPassword` actions, and the `login`, `two-factor` and `passkeys` rate limiters. `config/fortify.php` enables registration, password reset, email verification, 2FA and passkeys, with `home` set to `/dashboard`, while profile and password changes live in the kit's own Settings pages. On tenant domains, Fortify points at a separate `tenant` guard, and each tenant domain can switch individual features off. The [authentication documentation](/docs/core/authentication.html) lists every page and file.

<BlogPostCta title="Fortify auth, already wired to Inertia" text="SaaS Laravel ships Fortify login, registration, password reset, email verification, 2FA and passkeys as Inertia pages in Vue, React or Svelte." />
