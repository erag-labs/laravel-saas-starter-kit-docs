---
title: "Laravel Multiple Guards for Admins and Customers"
description: "Set up Laravel multiple guards for admins and customers: auth.php config, admin login, route middleware, redirects, logout, Inertia props and Fortify."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
tags: [Authentication, Security]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-multiple-auth-guards.html
  - - meta
    - property: og:title
      content: "Laravel Multiple Guards for Admins and Customers"
  - - meta
    - property: og:description
      content: "Set up Laravel multiple guards for admins and customers: auth.php config, admin login, route middleware, redirects, logout, Inertia props and Fortify."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-multiple-auth-guards.html
  - - meta
    - name: twitter:title
      content: "Laravel Multiple Guards for Admins and Customers"
  - - meta
    - name: twitter:description
      content: "Set up Laravel multiple guards for admins and customers: auth.php config, admin login, route middleware, redirects, logout, Inertia props and Fortify."
---

# Laravel Multiple Guards: Separate Logins for Admins and Customers

<BlogPostMeta />

Most SaaS apps have two very different groups of people signing in: your own team running the platform, and the customers using it. **Laravel multiple guards** let you keep them apart, with separate tables, separate logins and separate sessions, so a customer account can never reach the admin area by accident. This guide covers when separate guards are worth it, the `config/auth.php` setup, an admin login, route protection, redirects, logout, Inertia shared props and how Fortify fits in.

## Guards, providers and password brokers

Laravel's authentication config has three building blocks:

| Piece | Answers | Example |
| --- | --- | --- |
| Guard | How is the user remembered between requests? | `session` driver named `admin` |
| Provider | Where are users loaded from? | Eloquent model `App\Models\Admin` |
| Password broker | How are reset tokens stored and checked? | Broker `admins` with its own table |

A guard points at one provider. Two guards with two providers give you two independent kinds of user in the same app.

## When separate guards beat roles

Before adding a guard, check whether a role would do. Roles on a single `users` table are simpler; guards give you a hard wall.

| Choose roles when… | Choose separate guards when… |
| --- | --- |
| Admins are also customers of the product | Admins are internal staff only |
| One account should switch between areas | The two groups must never share an account |
| The data lives in one table | The users live in different tables or databases |
| You want one login page | You want a separate login, often on its own subdomain |

Roles and permissions are covered in [Laravel roles and permissions with Spatie](/blog/laravel-roles-permissions-spatie.html). The rest of this guide assumes you want the wall.

## Step 1: The admin model

Create an `admins` table with the same basic columns as `users`: `name`, a unique `email`, `password`, `remember_token` and timestamps. The model extends the same base class as your user model:

```php
namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class Admin extends Authenticatable
{
    use Notifiable;

    protected $fillable = ['name', 'email', 'password'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed'];
    }
}
```

## Step 2: Configure Laravel multiple guards in auth.php

Add a guard, a provider and a password broker next to the existing `web` ones:

```php
'guards' => [
    'web' => ['driver' => 'session', 'provider' => 'users'],
    'admin' => ['driver' => 'session', 'provider' => 'admins'],
],

'providers' => [
    'users' => ['driver' => 'eloquent', 'model' => App\Models\User::class],
    'admins' => ['driver' => 'eloquent', 'model' => App\Models\Admin::class],
],

'passwords' => [
    // 'users' => [...],
    'admins' => ['provider' => 'admins', 'table' => 'admin_password_reset_tokens', 'expire' => 30, 'throttle' => 60],
],
```

Give admins their own reset token table. The default `password_reset_tokens` table uses the email as its primary key, so a customer and an admin with the same address would overwrite each other's tokens.

Keep `defaults.guard` on `web`. The admin guard is opt-in, route by route.

## Step 3: An admin login

The login controller stays small. It checks the credentials against the `admin` guard and regenerates the session:

```php
public function store(AdminLoginRequest $request): RedirectResponse
{
    $credentials = $request->only('email', 'password');

    if (! Auth::guard('admin')->attempt($credentials, $request->boolean('remember'))) {
        throw ValidationException::withMessages(['email' => __('auth.failed')]);
    }

    $request->session()->regenerate();

    return redirect()->intended(route('admin.dashboard'));
}
```

Put validation in the `AdminLoginRequest` Form Request, and put a rate limiter on the route. Admin logins are a favourite target, so see [rate limiting login attempts in Laravel](/blog/laravel-login-rate-limiting.html).

## Step 4: Protect the routes

The `auth` and `guest` middleware accept a guard name after a colon:

```php
Route::prefix('admin')->name('admin.')->group(function () {
    Route::middleware('guest:admin')->group(function () {
        Route::get('login', [AdminLoginController::class, 'create'])->name('login');
        Route::post('login', [AdminLoginController::class, 'store'])->name('login.store');
    });

    Route::middleware('auth:admin')->group(function () {
        Route::get('/', AdminDashboardController::class)->name('dashboard');
        Route::post('logout', [AdminLoginController::class, 'destroy'])->name('logout');
    });
});
```

When `auth:admin` passes, Laravel calls `Auth::shouldUse('admin')` for the rest of the request. From then on `$request->user()`, `Auth::user()`, policies and `@can` checks all use the admin.

### Send each guest to the right login page

By default, a guest who hits a protected route is sent to the route named `login`. Tell Laravel which login page fits the URL in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->redirectGuestsTo(fn (Request $request) => $request->is('admin', 'admin/*')
        ? route('admin.login')
        : route('login'));

    $middleware->redirectUsersTo(fn (Request $request) => $request->is('admin', 'admin/*')
        ? route('admin.dashboard')
        : route('dashboard'));
})
```

`redirectUsersTo` handles the opposite case: a signed-in admin opening the admin login page.

## Reading the right user in code

Outside `auth:admin` routes, the default guard is still `web`. Ask for the guard explicitly there:

```php
Auth::guard('admin')->user();
$request->user('admin');
Auth::guard('admin')->check();
```

### The Inertia shared props trap

`HandleInertiaRequests` usually runs in the `web` middleware group, before route middleware such as `auth:admin`. A plain `$request->user()` in `share()` is evaluated at that moment, against the `web` guard, so admin pages receive `null`. Wrap it in a closure so it is resolved when the page renders:

```php
'auth' => [
    'user' => fn () => $request->user(),
],
```

Only share the fields the frontend needs. An admin record often has columns a browser should never see.

## Logging out one guard

Both guards store their login in the same session, under different keys (`login_web_…` and `login_admin_…`). That means one browser can be signed in as a customer and as an admin at the same time, and it changes how logout works:

| Call | Effect |
| --- | --- |
| `Auth::guard('admin')->logout()` | Removes only the admin login and its remember-me cookie |
| `$request->session()->invalidate()` | Destroys the whole session, logging out **every** guard |

For an admin logout that leaves the customer session alone, log out the guard, then regenerate the session ID and the CSRF token instead of invalidating. If you'd rather the two never share a session at all, serve the admin area from its own subdomain. With `SESSION_DOMAIN` unset, the session cookie is host-only, so each host gets its own session.

## Where Fortify fits

Laravel Fortify works with **one** guard at a time. It resolves the guard from `fortify.guard`, uses the broker in `fortify.passwords`, and registers its routes with `guest:` and `auth:` middleware for that guard. There are two practical patterns:

1. **Fortify for customers, a few hand-written admin controllers.** The admin area rarely needs registration, 2FA setup screens or email verification of its own, so a login, logout and password reset controller is often all you need.
2. **One Fortify setup, guard switched per host.** A global middleware sets `fortify.guard`, `fortify.passwords` and `Auth::shouldUse()` before routing, based on the domain. Because Fortify's route middleware was registered with the boot-time guard name, the `auth` and `guest` middleware must map that name to the active guard too.

The second pattern suits multi-tenant apps where each context has the same features but a different user store. The [Laravel Fortify tutorial](/blog/laravel-fortify-tutorial.html) covers the rest of the Fortify setup.

### Permissions per guard

If you use spatie/laravel-permission, every role and permission belongs to a guard through its `guard_name`. Create the admin permissions for the `admin` guard and pass the guard to the middleware, as explained in the Spatie guide linked above.

## Frequently asked questions

### Can a user be logged in with two guards at once?

Yes. Each guard stores its login under its own session key, so the same browser can hold a customer login and an admin login together. Put the admin area on a separate subdomain if you want to prevent that.

### Why does auth()->user() return null on my admin pages?

The code runs with the default `web` guard. Either the route is missing `auth:admin`, or the code runs before that middleware, as shared Inertia props often do. Use `Auth::guard('admin')->user()` or resolve the user lazily.

### Does Laravel Fortify support multiple guards?

Not side by side. Fortify serves the guard set in `fortify.guard`. Use it for one group and write a small login for the other, or switch the guard per domain before the request reaches Fortify's routes.

### Do I need a separate model for each guard?

No. Two guards can share one model when their providers load it from different places, for example a central database and a per-tenant database in a multi-tenant app. When both groups live in one database, a separate model and table is the simplest way to keep them apart.

## How SaaS Laravel separates users

The SaaS Laravel kits use two session guards on the same `App\Models\User` model: `web` with the `central_users` provider for the platform, and `tenant` with the `tenant_users` provider for each customer's own database. Each guard has a matching password broker. When tenancy starts, a listener switches the default guard and Fortify's guard and broker to the tenant ones, and the kit's `auth` and `guest` middleware map `web` to `tenant` inside a tenant, so routes simply use `auth`. Platform-only routes, such as tenant management, add a `central.only` middleware that returns a 404 on tenant domains. The approach is described in the [central and tenant guards documentation](/docs/core/authentication.html#central-and-tenant-guards) and in [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

<BlogPostCta title="Central and tenant logins, kept apart" text="SaaS Laravel separates platform and tenant users with their own guards, providers and password brokers, on Fortify, stancl/tenancy and Inertia." />
