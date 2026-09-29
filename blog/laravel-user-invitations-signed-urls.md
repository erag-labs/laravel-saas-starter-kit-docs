---
title: "User Invitations in Laravel with Signed URLs"
description: "Build a secure Laravel user invitation flow with temporary signed URLs, the signed middleware, queued emails, expiring single-use links and an accept page."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: permissions
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

In most SaaS apps, people don't sign up on their own. A colleague adds them. A Laravel user invitation flow handles that properly: an admin enters a name and email, the app sends that person a link, and they pick their own password. Nobody emails a password around, and the admin never knows it.

You don't need a package for this. Laravel already gives you temporary signed URLs, the `signed` middleware and queued notifications. I'll go through the whole flow, from creating the pending user to accepting the invitation, and point out the security details that are easy to miss.

## How a Laravel user invitation flow works

The flow has five steps:

1. An admin fills in the invite form.
2. The app creates a pending user (or an invitation record).
3. The app emails a signed, expiring link to the accept page.
4. The invitee opens the link and sets a password.
5. The app activates the account, signs the user in and makes the link unusable.

## Step 1: Choose a pending user or an invitation record

You can store an invitation in two ways:

| Approach | How it works | Good for |
| --- | --- | --- |
| Pending user | Create the user right away with a random password and an `invited_at` timestamp | Simple apps where an invited user can already get roles and appear in lists |
| Invitation table | Store email, role, token and expiry in an `invitations` table; create the user on accept | Inviting people who may already have an account, or teams with many pending invites |

I'd start with a pending user. It's simpler and it's enough for most apps. I only reach for a separate table when invitees might already have an account. Add a nullable `invited_at` column to your `users` table and create the user inside a transaction:

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

Nobody ever sees that random password. It's there so the `password` column isn't empty and nobody can guess their way in before the invitation is accepted.

## Step 2: Generate a temporary signed URL

A signed URL carries a `signature` query parameter, which is an HMAC of the URL made with your `APP_KEY`. A temporary signed URL also adds an `expires` timestamp, and that timestamp is part of the signed data. Change the user ID or the expiry time and the signature stops matching.

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

Put only the user's ID in the URL. **Never put the email address in it.** URLs end up in server logs, browser history and analytics tools, and an email address there is personal data you're leaking for no reason.

## Step 3: Protect the routes with the signed middleware

Laravel's `signed` middleware (`Illuminate\Routing\Middleware\ValidateSignature`) rejects any request whose signature is missing, wrong or expired. It throws an `InvalidSignatureException`, and Laravel turns that into a 403 response.

```php
Route::middleware(['guest', 'signed'])->group(function () {
    Route::get('users/invitation/{user}', [UserInvitationController::class, 'show'])
        ->name('users.invitation.show');

    Route::post('users/invitation/{user}', [UserInvitationController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('users.invitation.store');
});
```

The part people usually get wrong is signing only the GET route. Sign the POST route too, or anyone who knows a user ID could post a password to it. That means the accept form has to post back to the full signed URL, query string included.

The other two middleware are there for good reasons. `guest` stops a signed-in user from accepting someone else's invitation in their own session, and `throttle` limits password attempts on the accept endpoint.

If the link has to work on several domains (tenant subdomains, for example), sign a relative URL with `absolute: false` and use `signed:relative` on the route.

## Step 4: Send the invitation as a queued notification

Sending mail inside the request slows the admin's form down, and any mail server hiccup becomes an error page. Implement `ShouldQueue` so the email goes through the queue instead:

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

Build the email in `toMail()` with a `MailMessage` and an `->action('Accept invitation', $this->acceptUrl)` button, and say when the link expires. I like a constant for the lifetime, because then the email text and the URL expiry can't drift apart.

Send the notification only after the database transaction has committed. Otherwise a queue worker can pick up a job for a user that doesn't exist yet:

```php
$user->notify(new UserInvitationNotification($this->invitationUrl($user)));
```

::: warning No worker, no email
Queued notifications are only sent while a queue worker runs (`php artisan queue:work`). If invitations "never arrive", check the worker and the `jobs` and `failed_jobs` tables first.
:::

## Step 5: The accept page

The accept controller refuses links that were already used, validates the password and activates the account.

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

Validate the password with your normal rules (`Password::defaults()` and `confirmed`). Marking the email as verified is safe here, since opening a link sent to that inbox proves the user controls it. Regenerating the session after login protects against session fixation.

Give the `show` action the same `invited_at` check. Then an old link sends people to the login page instead of showing them a form they can't use.

## Resending and revoking invitations

A resend is just a new signed URL and the same notification sent again. Only allow it while the invitation is still pending, and rate limit the endpoint so nobody can use it to spam an inbox.

One thing to know: a resend doesn't cancel the earlier link. Both stay valid until they expire or the invitation is accepted. For most apps I don't think that matters. If you do need older links to die, add a value to the signed parameters that changes on every resend (a timestamp or a random token stored on the invitation) and compare it in the controller.

Revoking is simpler. Delete the pending user or invitation record, route model binding finds nothing, and the link returns a 404.

## Security checklist for invitation links

| Risk | What to do |
| --- | --- |
| Link reused after acceptance | Clear `invited_at` (or set `accepted_at`) and check it on every request |
| Link valid forever | Use `temporarySignedRoute()` with a sensible lifetime, such as 7 days |
| Tampered user ID | Protect both GET and POST routes with `signed` |
| Emails leaked in URLs | Put only an ID in the link, never the email address |
| Brute-force on the accept form | Add `throttle` middleware |
| Wrong user signed in | Use the `guest` middleware and regenerate the session after login |

Once the user is in, their role decides what they can see. Assigning roles and checking permissions is covered in [Laravel Roles and Permissions with Spatie](/blog/laravel-roles-permissions-spatie.html).

## Frequently asked questions

### How long should an invitation link be valid?

Long enough for someone to find the email after a weekend or a holiday, and short enough that forgotten links don't stay useful for months. Seven days is a common choice, and it's what I use.

### What happens when someone opens an expired invitation link?

The `signed` middleware rejects it with a 403, because the `expires` timestamp is part of the signature. The admin can send a new invitation.

### Can an invitation link be used twice?

Not if you clear the pending state on acceptance. Once `invited_at` is `null`, the controller redirects to the login page instead of accepting a new password.

### Why are my invitation emails not being sent?

The notification implements `ShouldQueue`, so it sits in the queue until a worker processes it. Start `php artisan queue:work` (or your process manager) and check for failed jobs.

## How SaaS Laravel handles invitations

If you'd rather not build this yourself, the [SaaS Laravel starter kits](/) already follow this flow in the `Modules/User` module. When an admin ticks "Send invitation email", `UserService` creates the user with a random password and `invited_at`, assigns the selected role, and queues a `UserInvitationNotification` with a signed link valid for 7 days. The accept routes use the `guest` and `signed` middleware, and the POST route is throttled. On the accept page the user sets a password, gets verified and signed in, and `invited_at` is cleared so the link can't be reused. Until then, the user list shows an "Invitation pending" badge. Workspace owners can be invited the same way when a tenant is created, and those invitations can be resent while the workspace is still pending. The [invitation docs](/docs/core/users-roles-permissions.html#invitations) and [queue worker setup](/docs/getting-started/local-development.html#queue-worker) have the details, and the [Laravel SaaS starter kit guide](/blog/laravel-saas-starter-kit.html) shows the bigger picture.

<BlogPostCta title="Invitations that just work" text="SaaS Laravel ships queued, signed and expiring user invitations with roles and permissions built in, for Vue, React or Svelte." />
