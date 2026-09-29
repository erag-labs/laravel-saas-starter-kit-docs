---
title: "Password Rules and Confirmation in Laravel"
description: "Laravel password rules explained: Password::defaults(), length vs complexity, breached-password checks, passwordrules hints and password confirmation."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: security
tags: [Authentication, Security, Validation]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-password-validation-rules.html
  - - meta
    - property: og:title
      content: "Password Rules and Confirmation in Laravel"
  - - meta
    - property: og:description
      content: "Laravel password rules explained: Password::defaults(), length vs complexity, breached-password checks, passwordrules hints and password confirmation."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-password-validation-rules.html
  - - meta
    - name: twitter:title
      content: "Password Rules and Confirmation in Laravel"
  - - meta
    - name: twitter:description
      content: "Laravel password rules explained: Password::defaults(), length vs complexity, breached-password checks, passwordrules hints and password confirmation."
---

# Laravel Password Rules: Strong Validation and Password Confirmation

<BlogPostMeta />

Sign-up, password reset, "change password": every one of those forms has to agree on what a good password is. Laravel password rules let you decide that once, with the `Password` rule object and `Password::defaults()`. I'll cover the policy I'd pick today, how to define it in one place and reuse it, how the breached-password check actually works, and how to make users confirm their password before they do something sensitive.

## A sensible password policy for a SaaS app

Password advice has moved on. The old "one symbol, rotate every 90 days" policy gave us predictable passwords like `Summer2026!`. NIST's current digital identity guidelines (SP 800-63B, revision 4, published August 2025) focus on length and on blocking known-bad passwords:

| Guideline | NIST SP 800-63B rev. 4 |
| --- | --- |
| Minimum length, password is the only factor | 15 characters |
| Minimum length, password used with MFA | 8 characters |
| Maximum length | Allow at least 64 characters |
| Composition rules (mixed case, symbols) | Should not be imposed |
| Blocklist check | Compare against common, expected and compromised passwords |
| Periodic rotation | Do not require it; force a change only after a compromise |

Sometimes a customer's compliance checklist still asks for composition rules, and Laravel can do those. If it's up to me, though, I'd take a long minimum length plus a breach check over any combination of character classes.

## The Password rule object

`Illuminate\Validation\Rules\Password` lets you build the rule fluently:

| Method | Requires |
| --- | --- |
| `Password::min(12)` | At least 12 characters |
| `->max(72)` | At most 72 characters |
| `->letters()` | At least one letter |
| `->mixedCase()` | At least one uppercase and one lowercase letter |
| `->numbers()` | At least one number |
| `->symbols()` | At least one symbol |
| `->uncompromised()` | Not found in known data breaches |
| `->rules([...])` | Any extra rules you want to merge in |

Every check that fails adds its own translated message (`validation.password.mixed`, `validation.password.uncompromised` and so on). Users see exactly what's missing instead of one vague error.

About that maximum. bcrypt only uses the first 72 bytes of a password, so if you hash with bcrypt, set `max()` around that length. Otherwise the end of a very long passphrase gets ignored and nobody tells the user.

## Define Laravel password rules once with Password::defaults()

Paste `Password::min(12)->...` into every form and your policies will drift apart. Set a default in a service provider's `boot()` method instead:

```php
use Illuminate\Validation\Rules\Password;

Password::defaults(fn () => app()->isProduction()
    ? Password::min(12)->letters()->numbers()->uncompromised()
    : null
);
```

After that, `Password::default()` returns your rule everywhere. When the callback returns `null`, which it does outside production in this example, Laravel falls back to its own eight-character default. I like this split. Seeding and local testing stay fast, and your test suite doesn't hit the breach API.

Then use the default in every form that sets a password:

```php
public function rules(): array
{
    return [
        'current_password' => ['required', 'string', 'current_password'],
        'password' => ['required', 'string', Password::default(), 'confirmed'],
    ];
}
```

There are two shortcuts, `Password::required()` and `Password::sometimes()`, which return the default rule with `required` or `sometimes` added. If you're sharing rules between Form Requests and Fortify actions, a small trait with a `passwordRules()` method does the job.

### The confirmed rule

`confirmed` checks that `password` matches a field called `password_confirmation`. Recent Laravel versions let you name a different field, like `confirmed:repeat_password`. It guards against typos. It isn't a security feature, and some teams drop it and offer a "show password" toggle instead.

## How the breached-password check works

`uncompromised()` asks the [Have I Been Pwned](https://haveibeenpwned.com/Passwords) Pwned Passwords API whether the password has shown up in a known breach. The password itself never leaves your server. Laravel hashes it with SHA-1 and sends only the first five characters of that hash to the range API. The API replies with every matching hash suffix and a breach count, and Laravel compares the rest of the hash locally.

You can pass a threshold, for example `uncompromised(3)`, to allow passwords that appeared only a few times. Before you rely on it, know two things.

First, **it fails open**. If the API times out or errors, Laravel reports the exception and treats the password as not compromised, so sign-ups keep working. Second, it adds a network call to every validation. That's the reason the example above only turns it on in production.

## Tell the browser your rules

Password managers generate strong passwords, but only if they know what you'll accept. Safari reads a `passwordrules` attribute, and Laravel can build its value from your rule object:

```php
Password::defaults()->toPasswordRulesString();
// "minlength: 12; required: lower; required: digit;"
```

Pass that string to the page as a prop and put it on the input, along with `autocomplete="new-password"`:

```html
<input type="password" name="password" autocomplete="new-password" passwordrules="minlength: 12; required: lower; required: digit;">
```

The generated password now passes validation first time, and your rules still live only on the server.

## Changing a password

A change-password form needs a bit more than the rules above.

Ask for the current password with the `current_password` rule, which checks it against the signed-in user's hash. Let the model do the hashing: with a `'password' => 'hashed'` cast on the user model, `$user->update(['password' => $request->password])` stores a hash, never plain text.

I'd also sign out the user's other sessions. `Auth::logoutOtherDevices($password)` invalidates them, as long as those routes use the `auth.session` middleware. And throttle the endpoint, so someone holding a stolen session can't sit there guessing the current password. [Rate limiting login attempts in Laravel](/blog/laravel-login-rate-limiting.html) covers how.

## Password confirmation for sensitive actions

Being signed in doesn't prove the owner is the one at the keyboard. Before you show recovery codes, delete an account or change security settings, ask for the password again. Laravel's `password.confirm` middleware handles it:

```php
Route::get('/settings/security', [SecurityController::class, 'edit'])
    ->middleware(['auth', 'password.confirm']);
```

If the user hasn't confirmed recently, the middleware redirects to the `password.confirm` route. JSON requests get a `423` response instead. Once they confirm, the session stores `auth.password_confirmed_at` and they can carry on for as long as `password_timeout` in `config/auth.php` allows. The default is 10800 seconds, which is three hours.

For routes that deserve a tighter window, pass a shorter timeout in seconds as the second middleware parameter:

```php
->middleware('password.confirm:password.confirm,300');
```

### Password confirmation with Fortify

[Laravel Fortify](/blog/laravel-fortify-tutorial.html) registers the confirmation routes for you: `GET` and `POST /user/confirm-password`, plus `GET /user/confirmed-password-status`, which returns `{"confirmed": true}` or `false`. I find that status endpoint useful in an SPA, where you'd rather open a confirmation dialog than redirect.

You can also change how the password gets checked by registering a callback. Here's one that throttles confirmation attempts per user:

```php
Fortify::confirmPasswordsUsing(function (User $user, ?string $password) {
    $key = 'confirm-password:'.$user->id;

    if (RateLimiter::tooManyAttempts($key, 5)) {
        return false;
    }

    RateLimiter::hit($key);

    return Hash::check((string) $password, $user->password);
});
```

Fortify's two-factor and passkey management routes can require a confirmed password through their `confirmPassword` option. Users with a passkey can confirm with it rather than typing a password; that flow is in [passkeys in Laravel](/blog/laravel-passkeys.html).

## Frequently asked questions

### What are Laravel's default password rules?

If you never call `Password::defaults()`, `Password::default()` only asks for a minimum of eight characters. Mixed case, numbers, symbols and the breach check are all opt-in through the `Password` rule's methods.

### Should I force users to change their password regularly?

No. Current NIST guidance says not to require periodic changes, because people just respond with predictable variations. Force a change only when you have evidence the password was compromised.

### How long does password confirmation last in Laravel?

For as long as `password_timeout` in `config/auth.php` says, which defaults to 10800 seconds (three hours). You can shorten it for one route by passing seconds to the `password.confirm` middleware.

### Does the uncompromised rule send passwords to a third party?

No. Laravel sends only the first five characters of the password's SHA-1 hash, gets back a list of matching suffixes, and compares the rest locally. Neither the full password nor the full hash leaves your server.

## Password rules in the SaaS Laravel kits

If you'd rather not set all of this up yourself, the [SaaS Laravel starter kits](/) already call `Password::defaults()` in `AppServiceProvider`. In production, passwords need at least 12 characters with mixed case, letters, numbers and symbols, and must not appear in known breaches. Other environments use Laravel's eight-character default. Registration, password reset, password change and both invitation forms validate with `Password::default()` and `confirmed`, mostly through a shared `PasswordValidationRules` trait, and those pages get `toPasswordRulesString()` for the `passwordrules` attribute. The Security settings page sits behind password confirmation (with a passkey option), and changing your password also asks for the current one. The [authentication documentation](/docs/core/authentication.html) has the details.

<BlogPostCta title="Password policy, set once for every form" text="SaaS Laravel applies one password policy to sign-up, reset, invitations and settings, with password confirmation, 2FA and passkeys, in Vue, React or Svelte." />
