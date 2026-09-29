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

Laravel Fortify gives you every authentication route and controller you need, but no screens. That makes it a natural fit for Inertia, where the pages live in Vue, React or Svelte anyway. This **Laravel Fortify tutorial** covers installing Fortify, choosing features, rendering Inertia pages for each view, and how the login, registration and password reset flows work under the hood, including where to customise them.

## What Fortify does and what you build

Fortify is a **headless** authentication backend. It registers routes, runs validation and hashing, talks to the session guard and returns redirects or JSON. You supply the pages and a few small action classes.

| Fortify handles | You provide |
| --- | --- |
| Routes and controllers for login, logout, registration, password reset, email verification, password confirmation, 2FA and passkeys | The Inertia pages (forms, links, status messages) |
| The login pipeline, throttling hooks and session regeneration | Rate limiter definitions |
| Password reset tokens and emails via Laravel's password broker | The `CreateNewUser` and `ResetUserPassword` actions |
| Events such as `Registered` and `PasswordReset` | Listeners, if you need them |

Because the frontend is yours, the same Fortify setup works whether your Inertia app uses Vue, React or Svelte.

## Laravel Fortify tutorial: installing the package

Require the package, run the installer and migrate:

```bash
composer require laravel/fortify
php artisan fortify:install
php artisan migrate
```

`fortify:install` publishes everything you will edit:

- `config/fortify.php`: guard, password broker, features, limiters and redirects.
- `app/Providers/FortifyServiceProvider.php`: registered in `bootstrap/providers.php` for you.
- `app/Actions/Fortify/*`: `CreateNewUser`, `ResetUserPassword`, `UpdateUserPassword`, `UpdateUserProfileInformation` and a `PasswordValidationRules` trait.
- Migrations for the two-factor columns on `users` and the `passkeys` table.

## Choosing features in config/fortify.php

Each entry in the `features` array switches on a group of routes. Leave one out and its routes are never registered.

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
| `registration()` | `/register` page and POST | This guide |
| `resetPasswords()` | Forgot and reset password pages and POSTs | This guide |
| `emailVerification()` | Verification notice, signed link and resend | [Email verification in Laravel](/blog/laravel-email-verification.html) |
| `updateProfileInformation()` / `updatePasswords()` | PUT endpoints for profile and password changes | Optional; many apps write their own settings controllers |
| `twoFactorAuthentication()` | TOTP setup, QR code, recovery codes and the login challenge | [Two-factor authentication in Laravel](/blog/laravel-two-factor-authentication.html) |
| `passkeys()` | WebAuthn registration and passwordless login | [Passkeys in Laravel](/blog/laravel-passkeys.html) |

Login, logout and password confirmation are always registered. A few other settings are worth a look now:

- `guard` and `passwords`: the session guard and password broker Fortify uses.
- `username` and `email`: the field names of the login and reset forms.
- `lowercase_usernames`: lowercases the email before login and registration.
- `home`: the default redirect after login, registration and reset.
- `prefix` and `domain`: move all Fortify routes under a path or a subdomain.

## Rendering Inertia pages for Fortify

Fortify's GET routes (`/login`, `/register`, `/forgot-password` and so on) ask you what to render. Tell it in `FortifyServiceProvider::boot()` by returning an Inertia response:

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

The same pattern applies to `resetPasswordView`, `verifyEmailView`, `confirmPasswordView` and `twoFactorChallengeView`. For the reset page, pass `$request->route('token')` and `$request->email` as props so the form can post them back.

Passing flags like `canRegister` lets the page hide links to features you have switched off. Pass the session `status` too: Fortify flashes messages such as "We have emailed your password reset link" there.

## The Fortify login flow

The login page posts `email`, `password` and an optional `remember` to `POST /login` (route name `login.store`). With Inertia's `<Form>` component and Wayfinder, the page needs no hard-coded URLs:

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

On the server, Fortify sends the request through a small pipeline:

1. **Throttle.** If you name a limiter in `fortify.limiters.login`, the route uses it as `throttle` middleware. Tuning it is covered in [rate limiting login attempts in Laravel](/blog/laravel-login-rate-limiting.html).
2. **Canonicalize.** With `lowercase_usernames` on, the email is lowercased.
3. **Two-factor check.** If 2FA is enabled and the user has confirmed it, Fortify stores the user ID in the session and redirects to the challenge instead of logging in.
4. **Attempt.** `Auth::guard(...)->attempt()` with the credentials and the remember flag.
5. **Prepare the session.** The session ID is regenerated and the limiter is cleared.

Validation errors come back as normal Inertia errors, so `errors.email` shows "These credentials do not match our records" without extra code.

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

Here `is_suspended` stands in for whatever column your app uses. For bigger changes, `Fortify::authenticateThrough()` lets you return your own list of pipeline classes.

## Registration

`POST /register` passes the whole request to your `CreatesNewUsers` action. The published `CreateNewUser` validates the input and creates the user:

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

Fortify then fires the `Registered` event, logs the new user in, regenerates the session and redirects. `Registered` is what triggers the verification email when email verification is on.

This action is the place to add fields like a company name or to assign a default role. Keep it thin: if registration grows into several steps, move the work into a service class and call it from here. What belongs in `passwordRules()`, and how Fortify's always-on password confirmation page protects sensitive screens, is covered in [Laravel password rules and confirmation](/blog/laravel-password-validation-rules.html).

## Password reset

The reset flow has four steps, all backed by Laravel's password broker (the one named in `fortify.passwords`):

| Step | Route | What happens |
| --- | --- | --- |
| Request page | GET `/forgot-password` (`password.request`) | Your Inertia page with an email field |
| Send link | POST `/forgot-password` (`password.email`) | The broker creates a token and emails a reset link |
| Reset page | GET `/reset-password/{token}` (`password.reset`) | Your page with token, email and new password fields |
| Save | POST `/reset-password` (`password.update`) | Your `ResetUserPassword` action sets the new password |

After a successful reset, Fortify redirects to the login page with a status message. Token lifetime and throttling come from the broker's `expire` and `throttle` settings in `config/auth.php`.

## Redirects and responses

By default every successful action redirects to `fortify.home`. Add a `redirects` array to `config/fortify.php` to override individual cases:

```php
'redirects' => [
    'login' => '/dashboard',
    'logout' => '/',
    'register' => '/welcome',
    'email-verification' => '/dashboard',
],
```

`password-reset` and `password-confirmation` are accepted too. When a redirect needs logic, for example sending admins somewhere else, bind your own class to a response contract such as `Laravel\Fortify\Contracts\LoginResponse` in the container. Every built-in response also returns JSON when the request expects it, which is why Fortify works for SPAs and mobile clients too. Set `views` to `false` if you don't want the GET page routes at all.

## Frequently asked questions

### Does Laravel Fortify include login pages?

No. Fortify is headless: it registers the routes and logic, and you render the pages. With Inertia you return `Inertia::render()` from callbacks like `Fortify::loginView()`.

### Can I use Fortify with Inertia and React or Svelte instead of Vue?

Yes. Fortify only sees form posts and returns redirects, validation errors or JSON. The server setup is identical for Vue, React and Svelte; only the page components differ.

### How do I change where users land after login?

Set `home` in `config/fortify.php`, or add `'redirects' => ['login' => '/somewhere']`. For conditional redirects, bind your own `LoginResponse` implementation.

### Can Fortify handle two different user types?

Fortify works with one guard at a time, set in `fortify.guard`. For separate admin and customer logins, see [separate auth guards for admins and customers](/blog/laravel-multiple-auth-guards.html).

## How SaaS Laravel uses Fortify

In the SaaS Laravel kits, an `Auth` module connects Fortify to the app: its `AuthServiceProvider` registers the Inertia views, the `CreateNewUser` and `ResetUserPassword` actions and the `login`, `two-factor` and `passkeys` rate limiters. `config/fortify.php` enables registration, password reset, email verification, 2FA and passkeys with `home` set to `/dashboard`, while profile and password changes live in the kit's own Settings pages. On tenant domains, Fortify is pointed at a separate `tenant` guard, and each tenant domain can switch individual features off. The [authentication documentation](/docs/core/authentication.html) lists every page and file.

<BlogPostCta title="Fortify auth, already wired to Inertia" text="SaaS Laravel ships Fortify login, registration, password reset, email verification, 2FA and passkeys as Inertia pages in Vue, React or Svelte." />
