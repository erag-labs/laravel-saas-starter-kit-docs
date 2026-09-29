---
title: "User Invitations in Laravel with Signed URLs"
description: "Build a secure Laravel user invitation flow with temporary signed URLs, the signed middleware, queued emails, expiring single-use links and an accept page."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Users, Security]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-user-invitations-signed-urls.html
  - - meta
    - property: og:title
      content: "User Invitations in Laravel with Signed URLs"
  - - meta
    - property: og:description
      content: "Build a secure Laravel user invitation flow with temporary signed URLs, the signed middleware, queued emails, expiring single-use links and an accept page."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-user-invitations-signed-urls.html
  - - meta
    - name: twitter:title
      content: "User Invitations in Laravel with Signed URLs"
  - - meta
    - name: twitter:description
      content: "Build a secure Laravel user invitation flow with temporary signed URLs, the signed middleware, queued emails, expiring single-use links and an accept page."
---

# Laravel User Invitations with Signed URLs: A Secure Invite Flow

<BlogPostMeta />

In a SaaS app, most users don't sign up on their own — a colleague adds them. A **Laravel user invitation** flow lets an admin enter a name and email, sends that person a link, and lets them choose their own password. Nobody has to share a password by email, and the admin never knows it.

Laravel already has everything you need for this: temporary signed URLs, the `signed` middleware and queued notifications. This guide walks through the whole flow, from creating the pending user to accepting the invitation, plus the security details that are easy to get wrong.

## How a Laravel user invitation flow works

1. An admin fills in the invite form.
2. The app creates a **pending** user (or an invitation record).
3. The app emails a **signed, expiring link** to the accept page.
4. The invitee opens the link and sets a password.
5. The app activates the account, signs the user in and makes the link unusable.

## Step 1: Choose a pending user or an invitation record

There are two common ways to store an invitation:

| Approach | How it works | Good for |
| --- | --- | --- |
| **Pending user** | Create the user right away with a random password and an `invited_at` timestamp | Simple apps where an invited user can already get roles and appear in lists |
| **Invitation table** | Store email, role, token and expiry in an `invitations` table; create the user on accept | Inviting people who may already have an account, or teams with many pending invites |

A pending user is the simpler option and works well for most apps. Add a nullable `invited_at` column to your `users` table and create the user inside a transaction:

```php
$user = DB::transaction(function () use ($data): User {
    $user = new User([
        'name' => $data->name,
        'email' => $data->email,
        'password' => Str::random(40),
    ]);

    $user->invited_at = now();
    $user->save();
    $user->assignRole($data->role);

    return $user;
});
```

The random password is never shown to anyone. It only exists so the `password` column isn't empty and nobody can guess their way in before the invitation is accepted.

## Step 2: Generate a temporary signed URL

A signed URL carries a `signature` query parameter: an HMAC of the URL, made with your `APP_KEY`. A temporary signed URL also adds an `expires` timestamp, which is part of the signed data. Change the user ID or the expiry time, and the signature no longer matches.

```php
use Illuminate\Support\Facades\URL;

public function invitationUrl(User $user): string
{
    return URL::temporarySignedRoute(
        'users.invitation.show',
        now()->addDays(7),
        ['user' => $user->getKey()],
    );
}
```

Put only the user's ID in the URL — never the email address. URLs end up in server logs, browser history and analytics tools, and an email address in them is personal data you're leaking for no reason.

## Step 3: Protect the routes with the signed middleware

Laravel's `signed` middleware (`Illuminate\Routing\Middleware\ValidateSignature`) rejects any request whose signature is missing, wrong or expired. It throws an `InvalidSignatureException`, which Laravel turns into a 403 response.

```php
Route::middleware(['guest', 'signed'])->group(function () {
    Route::get('users/invitation/{user}', [UserInvitationController::class, 'show'])
        ->name('users.invitation.show');

    Route::post('users/invitation/{user}', [UserInvitationController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('users.invitation.store');
});
```

A few details matter here:

- **Sign the POST route too.** Otherwise anyone who knows a user ID could post a password to it. The accept form must post back to the full signed URL, including the query string.
- **`guest`** stops a signed-in user from accepting someone else's invitation in their own session.
- **`throttle`** limits password attempts on the accept endpoint.
- If the link must work on several domains (for example tenant subdomains), sign a relative URL with `absolute: false` and use `signed:relative` on the route.

## Step 4: Send the invitation as a queued notification

Sending mail inside the request slows the admin's form down, and a mail server hiccup would turn into an error page. Implement `ShouldQueue` so the email goes through the queue:

```php
class UserInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public const int EXPIRES_IN_DAYS = 7;

    public function __construct(public string $acceptUrl) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }
}
```

Build the email in `toMail()` with a `MailMessage` and an `->action('Accept invitation', $this->acceptUrl)` button, and mention when the link expires. Using a constant for the lifetime keeps the email text and the URL expiry in sync.

Send the notification **after** the database transaction has committed, so a queue worker never picks up a job for a user that doesn't exist yet:

```php
$user->notify(new UserInvitationNotification($this->invitationUrl($user)));
```

::: warning No worker, no email
Queued notifications are only sent while a queue worker runs (`php artisan queue:work`). If invitations "never arrive", check the worker and the `jobs` and `failed_jobs` tables first.
:::

## Step 5: The accept page

The accept controller does three things: refuses links that were already used, validates the password and activates the account.

```php
public function store(AcceptUserInvitationData $data, Request $request, User $user): RedirectResponse
{
    if (! $user->invited_at) {
        return to_route('login');
    }
    $user->forceFill([
        'password' => $data->password,
        'email_verified_at' => $user->email_verified_at ?? now(),
        'invited_at' => null,
    ])->save();

    Auth::login($user);
    $request->session()->regenerate();
    return to_route('dashboard');
}
```

Validate the password with your normal rules (`Password::defaults()` and `confirmed`). Marking the email as verified is safe: opening a link sent to that inbox proves the user controls it. Regenerating the session after login protects against session fixation.

The `show` action should run the same `invited_at` check, so an old link sends people to the login page instead of showing a form they can't use.

## Resending and revoking invitations

**Resending** is just generating a new signed URL and sending the notification again. Only allow it while the invitation is still pending, and rate limit the endpoint so it can't be used to spam an inbox.

Keep in mind that a resend doesn't cancel the earlier link — both stay valid until they expire or the invitation is accepted. If you need older links to stop working, add a value to the signed parameters that changes on every resend (such as a timestamp or random token stored on the invitation) and compare it in the controller.

**Revoking** is simpler: delete the pending user or invitation record. Route model binding then finds nothing and the link returns a 404.

## Security checklist for invitation links

| Risk | What to do |
| --- | --- |
| Link reused after acceptance | Clear `invited_at` (or set `accepted_at`) and check it on every request |
| Link valid forever | Use `temporarySignedRoute()` with a sensible lifetime, such as 7 days |
| Tampered user ID | Protect both GET and POST routes with `signed` |
| Emails leaked in URLs | Put only an ID in the link, never the email address |
| Brute-force on the accept form | Add `throttle` middleware |
| Wrong user signed in | Use the `guest` middleware and regenerate the session after login |

Once the user is in, what they can see depends on their role — see [Laravel Roles and Permissions with Spatie](/blog/laravel-roles-permissions-spatie.html) for assigning roles and checking permissions.

## Frequently asked questions

### How long should an invitation link be valid?

Long enough for someone to find the email after a weekend or a holiday, short enough that forgotten links don't stay useful for months. Seven days is a common choice.

### What happens when someone opens an expired invitation link?

The `signed` middleware rejects it with a 403 response, because the `expires` timestamp is part of the signature. The admin can send a new invitation.

### Can an invitation link be used twice?

Not if you clear the pending state on acceptance. Once `invited_at` is `null`, the controller redirects to the login page instead of accepting a new password.

### Why are my invitation emails not being sent?

Because the notification implements `ShouldQueue`, it waits in the queue until a worker processes it. Start `php artisan queue:work` (or your process manager) and check for failed jobs.

## How SaaS Laravel handles this

The [SaaS Laravel starter kits](/) follow this exact flow in the `Modules/User` module. When an admin ticks **Send invitation email**, `UserService` creates the user with a random password and `invited_at`, assigns the selected role, and queues a `UserInvitationNotification` with a signed link valid for 7 days. The accept routes use the `guest` and `signed` middleware, and the POST route is throttled. On the accept page the user sets a password, is verified and signed in, and `invited_at` is cleared so the link can't be reused. The user list shows an "Invitation pending" badge until then. Workspace owners can be invited the same way when a tenant is created, and those invitations can be resent while the workspace is still pending. See the [invitation docs](/docs/core/users-roles-permissions.html#invitations) and the [queue worker setup](/docs/getting-started/local-development.html#queue-worker), or read our [Laravel SaaS starter kit guide](/blog/laravel-saas-starter-kit.html).

<BlogPostCta title="Invitations that just work" text="SaaS Laravel ships queued, signed and expiring user invitations with roles and permissions built in — for Vue, React or Svelte." />
