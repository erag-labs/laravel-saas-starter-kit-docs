---
title: "Email Verification in Laravel"
description: "Laravel email verification explained: MustVerifyEmail, signed links, the verified middleware, Fortify routes, a resend page and handling email changes."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: security
tags: [Authentication, Security]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-email-verification.html
  - - meta
    - property: og:title
      content: "Email Verification in Laravel"
  - - meta
    - property: og:description
      content: "Laravel email verification explained: MustVerifyEmail, signed links, the verified middleware, Fortify routes, a resend page and handling email changes."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-email-verification.html
  - - meta
    - name: twitter:title
      content: "Email Verification in Laravel"
  - - meta
    - name: twitter:description
      content: "Laravel email verification explained: MustVerifyEmail, signed links, the verified middleware, Fortify routes, a resend page and handling email changes."
---

# Laravel Email Verification: Signed Links, Fortify and the verified Middleware

<BlogPostMeta />

Anyone can type any address into a sign-up form. **Laravel email verification** makes sure the person behind an account can actually read that inbox before they reach the parts of your app that matter. This guide explains how the built-in flow works, how to switch it on with Laravel Fortify, how to build the "check your inbox" page in Inertia, and the edge cases: changed emails, expired links and users who open the link on another device.

## How Laravel email verification works

Laravel ships every piece of the flow. Fortify only adds the routes and controllers on top.

```text
POST /register
  → Registered event
  → SendEmailVerificationNotification listener
  → VerifyEmail notification with a temporary signed URL
User clicks the link
  → GET /email/verify/{id}/{hash}   (auth, signed, throttle)
  → email_verified_at = now(), Verified event
  → redirect to your app with ?verified=1
```

Three details make the link safe:

- **It is signed.** The `signed` middleware rejects any URL whose query string was changed.
- **It expires.** The link is valid for `auth.verification.expire` minutes, 60 by default.
- **It is tied to the address.** The `hash` segment is a SHA-1 of the user's current email. If the email changes, old links stop working.

The listener is registered by the framework automatically. It only sends the email when the user model implements `MustVerifyEmail` and isn't verified yet.

## Step 1: Implement MustVerifyEmail

Laravel's base `User` class already uses the `MustVerifyEmail` trait, which provides `hasVerifiedEmail()`, `markEmailAsVerified()` and `sendEmailVerificationNotification()`. What switches verification on is the **interface**:

```php
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable implements MustVerifyEmail
{
    // ...
}
```

Without the interface, the listener sends nothing and the `verified` middleware lets everyone through. That is the most common reason for "my verification emails never arrive". The `users` table also needs a nullable `email_verified_at` timestamp, which the default migration already has.

## Step 2: Enable the Fortify routes

With [Laravel Fortify](/blog/laravel-fortify-tutorial.html), add the feature to `config/fortify.php`:

```php
'features' => [
    Features::registration(),
    Features::emailVerification(),
    // ...
],
```

Fortify then registers three routes, all for signed-in users:

| Method | URI | Route name | Purpose |
| --- | --- | --- | --- |
| GET | `/email/verify` | `verification.notice` | The "check your inbox" page |
| GET | `/email/verify/{id}/{hash}` | `verification.verify` | The link in the email |
| POST | `/email/verification-notification` | `verification.send` | Resend the email |

The link and resend routes use the limiter in `fortify.limiters.verification`, which defaults to six requests per minute. The link route also checks that the `id` belongs to the signed-in user and that the `hash` matches their current email.

Tell Fortify which page to render for the notice:

```php
Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/VerifyEmail', [
    'status' => $request->session()->get('status'),
]));
```

If the user is already verified, the notice route skips the page and redirects them into the app.

## Step 3: Protect routes with the verified middleware

Verification only matters if something depends on it. Add `verified` next to `auth` on every route that should require a confirmed address:

```php
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    // billing, team settings, anything that sends email to others
});
```

An unverified user who hits one of these routes is redirected to `verification.notice`. JSON requests get a 403 with "Your email address is not verified." instead. To send users to a different route, pass its name: `verified:onboarding.verify`.

Leave profile and logout routes reachable without `verified`, so a user who typed the wrong address can fix it.

## The "check your inbox" page in Inertia

The page needs two actions: resend the email, and log out. Fortify flashes `status` as `verification-link-sent` after a resend, so show a confirmation for that value:

```vue
<script setup lang="ts">
import { Form } from '@inertiajs/vue3';
import { send } from '@/routes/verification';

defineProps<{ status?: string }>();
</script>

<template>
    <p v-if="status === 'verification-link-sent'">A new link is on its way.</p>

    <Form v-bind="send.form()" v-slot="{ processing }">
        <button type="submit" :disabled="processing">Resend verification email</button>
    </Form>
</template>
```

Tell the user which address you sent the link to, and give them a way to change it. Most "I never got the email" tickets are typos.

## Customising the verification email

Both the message and the URL can be changed from a service provider's `boot()` method:

```php
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

VerifyEmail::toMailUsing(function (object $notifiable, string $url) {
    return (new MailMessage)
        ->subject('Confirm your email for '.config('app.name'))
        ->line('Click the button below to finish setting up your account.')
        ->action('Confirm email', $url);
});
```

`VerifyEmail::createUrlUsing()` replaces the link itself, which is useful when a separate frontend handles the click. To change the lifetime, add a `verification.expire` value (in minutes) to `config/auth.php`.

The notification is sent synchronously by default, so a slow mail server slows down registration. To queue it, create a notification that extends `VerifyEmail`, implements `ShouldQueue` and uses the `Queueable` trait, then override `sendEmailVerificationNotification()` on your user model to send that class instead. Remember to run a queue worker.

## When a user changes their email

A verified account that switches to a new address is unverified again. Handle it where the profile is updated, ideally in a service rather than the controller:

```php
$user->fill($data);

if ($user->isDirty('email')) {
    $user->email_verified_at = null;
}

$user->save();

if ($user->wasChanged('email') && $user instanceof MustVerifyEmail) {
    $user->sendEmailVerificationNotification();
}
```

Because the link hash is based on the current email, any link sent to the old address is now useless.

## Edge cases to plan for

| Situation | What happens | What to do |
| --- | --- | --- |
| User opens the link on another device | The route requires login, so they are sent to the login page first | After login they are redirected back to the link and verified |
| Link has expired | The `signed` middleware returns a 403 | Make the resend button easy to find |
| Link clicked twice | Already verified; the user is simply redirected | Nothing |
| User was invited by an admin | They proved ownership by opening the invite link | Set `email_verified_at` when they accept, see [user invitations with signed URLs](/blog/laravel-user-invitations-signed-urls.html) |
| Accounts created by seeders | No email is sent | Set `email_verified_at` in the seeder |

For local development, set `MAIL_MAILER=log` and copy the link from `storage/logs/laravel.log`.

## Frequently asked questions

### Why is Laravel not sending the verification email?

Usually because the user model doesn't implement `MustVerifyEmail`, so the listener skips it. Also check your mail settings, and if you queued the notification, that a queue worker is running.

### How long is a Laravel email verification link valid?

Sixty minutes by default. Change it with `verification.expire` in `config/auth.php`. After that, the user requests a new link from the notice page.

### Can users log in before verifying their email?

Yes. Verification doesn't block login; it blocks the routes you protect with the `verified` middleware. That is what lets unverified users reach the resend page.

### Should I block login until the email is verified?

It is rarely worth it. Letting users in but gating the important routes gives them a clear next step. For signup abuse, combine verification with [login rate limiting](/blog/laravel-login-rate-limiting.html) and a rate limit on your registration route.

## Email verification in SaaS Laravel

The SaaS Laravel kits enable `Features::emailVerification()` and include a Verify Email page in Vue, React and Svelte with resend and logout buttons. The app's module routes use `['auth', 'verified']`, but `App\Models\User` ships **without** `MustVerifyEmail` (the import is commented out), so verification is not enforced until you add the interface. The profile settings page resets `email_verified_at` when the email changes and offers a resend link. Seeded users and invited users who accept are marked as verified, and each tenant domain can turn verification off. See [email verification in the authentication docs](/docs/core/authentication.html#email-verification).

<BlogPostCta title="Email verification, ready to switch on" text="SaaS Laravel includes Fortify email verification pages, signed invitation links and per-domain auth settings on a multi-tenant Laravel backend." />
