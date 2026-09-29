---
title: "Laravel Multiple Guards for Admins and Customers"
description: "Set up Laravel multiple guards for admins and customers: auth.php config, admin login, route middleware, redirects, logout, Inertia props and Fortify."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: security
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

In most SaaS apps, two very different groups of people sign in: your own team, who run the platform, and the customers who use it. Laravel multiple guards let you keep those groups apart, with separate tables, separate logins and separate sessions, so a customer account can't wander into the admin area by accident. I'll go through when separate guards are worth the extra setup, the `config/auth.php` changes, an admin login, protecting routes, redirects, logout, Inertia shared props and where Fortify fits in.

## Guards, providers and password brokers

If the auth config has always felt a bit abstract, it helps to know it's built from three pieces, each answering a different question:

| Piece | Answers | Example |
| --- | --- | --- |
| Guard | How is the user remembered between requests? | `session` driver named `admin` |
| Provider | Where are users loaded from? | Eloquent model `App\Models\Admin` |
| Password broker | How are reset tokens stored and checked? | Broker `admins` with its own table |

A guard points at exactly one provider. Add a second guard with its own provider and you have two independent kinds of user living in the same app.

## When separate guards beat roles

Before you add a guard, ask whether a role would do the job. Roles on a single `users` table are simpler to live with. Guards give you a hard wall instead.

| Choose roles when… | Choose separate guards when… |
| --- | --- |
| Admins are also customers of the product | Admins are internal staff only |
| One account should switch between areas | The two groups must never share an account |
| The data lives in one table | The users live in different tables or databases |
| You want one login page | You want a separate login, often on its own subdomain |

My rule of thumb: if you find yourself wanting one person to hop between both areas, stick with roles, which are covered in [Laravel roles and permissions with Spatie](/blog/laravel-roles-permissions-spatie.html). Everything below assumes you want the wall.

## Step 1: The admin model

Start with an `admins` table that has the same basic columns as `users`: `name`, a unique `email`, `password`, `remember_token` and timestamps. The model extends the same base class your user model does:

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

Next, add a guard, a provider and a password broker alongside the existing `web` ones:

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

You might wonder why admins need their own reset token table. The default `password_reset_tokens` table uses the email as its primary key, so if a customer and an admin happen to share an address, they'd overwrite each other's tokens.

Leave `defaults.guard` set to `web`. The admin guard is opt-in, one route at a time.

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

Validation belongs in the `AdminLoginRequest` Form Request. Please also put a rate limiter on this route, since admin logins are a favourite target for attackers. The details are in [rate limiting login attempts in Laravel](/blog/laravel-login-rate-limiting.html).

## Step 4: Protect the routes

Both the `auth` and `guest` middleware take a guard name after a colon:

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

Once `auth:admin` passes, Laravel calls `Auth::shouldUse('admin')` for the rest of that request. So from that point on, `$request->user()`, `Auth::user()`, policies and `@can` checks all work with the admin.

### Send each guest to the right login page

By default, a guest who hits a protected route gets sent to the route named `login`. That's the customer login, which is wrong for `/admin`. You can tell Laravel which login page matches the URL in `bootstrap/app.php`:

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

`redirectUsersTo` covers the reverse situation, where an admin who's already signed in opens the admin login page.

## Reading the right user in code

Outside `auth:admin` routes, the default guard is still `web`. In those places, ask for the guard by name:

```php
Auth::guard('admin')->user();
$request->user('admin');
Auth::guard('admin')->check();
```

### The Inertia shared props trap

This one tends to trip people up. `HandleInertiaRequests` usually runs in the `web` middleware group, which is before route middleware like `auth:admin`. A plain `$request->user()` inside `share()` is evaluated right then, against the `web` guard, so your admin pages receive `null`. The fix is to wrap it in a closure, so it's resolved later when the page actually renders:

```php
'auth' => [
    'user' => fn () => $request->user(),
],
```

While you're there, only share the fields the frontend needs. Admin records often have columns a browser should never see.

## Logging out one guard

Both guards keep their login in the same session, just under different keys (`login_web_…` and `login_admin_…`). So one browser can be signed in as a customer and as an admin at the same time. That affects how logout behaves:

| Call | Effect |
| --- | --- |
| `Auth::guard('admin')->logout()` | Removes only the admin login and its remember-me cookie |
| `$request->session()->invalidate()` | Destroys the whole session, logging out **every** guard |

To log an admin out without touching the customer session, log out the guard and then regenerate the session ID and CSRF token, rather than invalidating. If you'd prefer the two never share a session in the first place, serve the admin area from its own subdomain. With `SESSION_DOMAIN` unset, the session cookie is host-only, and each host gets its own session.

## Where Fortify fits

Laravel Fortify works with **one** guard at a time. It reads the guard from `fortify.guard`, uses the broker in `fortify.passwords`, and registers its routes with `guest:` and `auth:` middleware for that guard. In practice that leaves you two patterns.

The first is Fortify for customers plus a few hand-written admin controllers. The admin area rarely needs registration, 2FA setup screens or its own email verification, so a login, a logout and a password reset controller are often all it takes. For a typical app with internal staff, this is the one I'd pick.

The second is a single Fortify setup where the guard switches per host. A global middleware sets `fortify.guard`, `fortify.passwords` and `Auth::shouldUse()` before routing, based on the domain. There's a catch: Fortify's route middleware was registered with the guard name from boot time, so your `auth` and `guest` middleware have to map that name to the active guard as well. This pattern suits multi-tenant apps where each context has the same features but a different user store.

For the rest of the Fortify setup, see the [Laravel Fortify tutorial](/blog/laravel-fortify-tutorial.html).

### Permissions per guard

With spatie/laravel-permission, every role and permission belongs to a guard through its `guard_name`. Create your admin permissions for the `admin` guard and pass the guard to the middleware, as the Spatie guide linked earlier explains.

## Frequently asked questions

### Can a user be logged in with two guards at once?

Yes. Each guard keeps its login under its own session key, so the same browser can hold a customer login and an admin login together. If you want to prevent that, put the admin area on a separate subdomain.

### Why does auth()->user() return null on my admin pages?

Because the code is running with the default `web` guard. Either the route is missing `auth:admin`, or the code runs before that middleware, which is what usually happens with shared Inertia props. Use `Auth::guard('admin')->user()` or resolve the user lazily.

### Does Laravel Fortify support multiple guards?

Not side by side. Fortify serves whichever guard is set in `fortify.guard`. You can use it for one group and write a small login for the other, or switch the guard per domain before the request reaches Fortify's routes.

### Do I need a separate model for each guard?

No. Two guards can share one model if their providers load it from different places, for example a central database and a per-tenant database in a multi-tenant app. When both groups live in the same database, though, a separate model and table is the simplest way to keep them apart.

## How SaaS Laravel separates users

For a working example, the SaaS Laravel kits use two session guards on the same `App\Models\User` model: `web` with the `central_users` provider for the platform, and `tenant` with the `tenant_users` provider for each customer's own database. Each guard has its own password broker. When tenancy starts, a listener switches the default guard, plus Fortify's guard and broker, to the tenant ones. The kit's `auth` and `guest` middleware map `web` to `tenant` inside a tenant, so routes just use `auth`. Platform-only routes such as tenant management add a `central.only` middleware that returns a 404 on tenant domains. You can read more in the [central and tenant guards documentation](/docs/core/authentication.html#central-and-tenant-guards) and in [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

<BlogPostCta title="Central and tenant logins, kept apart" text="SaaS Laravel separates platform and tenant users with their own guards, providers and password brokers, on Fortify, stancl/tenancy and Inertia." />
