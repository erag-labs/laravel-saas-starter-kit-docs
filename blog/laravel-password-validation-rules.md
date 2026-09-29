---
title: "Password Rules and Confirmation in Laravel"
description: "Laravel password rules explained: Password::defaults(), length vs complexity, breached-password checks, passwordrules hints and password confirmation."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
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

Every sign-up, reset and "change password" form needs the same answer to one question: what counts as a good password? **Laravel password rules** give you that answer in one place with the `Password` rule object and `Password::defaults()`. This guide covers what a sensible policy looks like today, how to define it once and reuse it everywhere, how the breached-password check works, and how to ask users to confirm their password before sensitive actions.

## What a good password policy looks like

Password advice has changed. The old "at least one symbol, change it every 90 days" approach produced predictable passwords like `Summer2026!`. NIST's current digital identity guidelines (SP 800-63B, revision 4, published August 2025) focus on length and on blocking known-bad passwords instead:

| Guideline | NIST SP 800-63B rev. 4 |
| --- | --- |
| Minimum length, password is the only factor | 15 characters |
| Minimum length, password used with MFA | 8 characters |
| Maximum length | Allow at least 64 characters |
| Composition rules (mixed case, symbols) | Should not be imposed |
| Blocklist check | Compare against common, expected and compromised passwords |
| Periodic rotation | Do not require it; force a change only after a compromise |

You may still need composition rules for a customer's compliance checklist, and Laravel supports them. But if you get to choose, a long minimum length plus a breach check does more than any mix of character classes.

## The Password rule object

Laravel's `Illuminate\Validation\Rules\Password` builds a password rule fluently:

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

Each failing check adds its own translated message (`validation.password.mixed`, `validation.password.uncompromised` and so on), so users see exactly what is missing.

A note on the maximum: bcrypt only uses the first 72 bytes of a password. If you hash with bcrypt, a `max()` around that length avoids silently ignoring the end of very long passphrases.

## Define Laravel password rules once with Password::defaults()

Copying `Password::min(12)->...` into every form is how policies drift apart. Set a default in a service provider's `boot()` method instead:

```php
use Illuminate\Validation\Rules\Password;

Password::defaults(fn () => app()->isProduction()
    ? Password::min(12)->letters()->numbers()->uncompromised()
    : null
);
```

`Password::default()` then returns your rule everywhere. When the callback returns `null`, as it does outside production here, Laravel falls back to its own default of eight characters. That keeps seeding and local testing fast, and avoids calling the breach API from your test suite.

Use the default in every form that sets a password:

```php
public function rules(): array
{
    return [
        'current_password' => ['required', 'string', 'current_password'],
        'password' => ['required', 'string', Password::default(), 'confirmed'],
    ];
}
```

`Password::required()` and `Password::sometimes()` are shortcuts that return the default rule with `required` or `sometimes` added. For reuse across Form Requests and Fortify actions, a small trait with a `passwordRules()` method works well.

### The confirmed rule

`confirmed` checks that `password` matches a field named `password_confirmation`. Since recent Laravel versions you can name a different field, for example `confirmed:repeat_password`. It is a typo guard, not a security feature, so some teams drop it and offer a "show password" toggle instead.

## How the breached-password check works

`uncompromised()` asks the [Have I Been Pwned](https://haveibeenpwned.com/Passwords) Pwned Passwords API whether the password has appeared in a known breach. The password itself never leaves your server:

1. Laravel hashes the password with SHA-1.
2. It sends only the first five characters of the hash to the range API.
3. The API returns every matching hash suffix with a breach count.
4. Laravel compares the rest of the hash locally.

Pass a threshold to allow passwords that appeared only a few times, for example `uncompromised(3)`. Two things to know before relying on it:

- **It fails open.** If the API times out or returns an error, Laravel reports the exception and treats the password as not compromised, so sign-ups keep working.
- **It adds a network call** to every validation. That is why the example above only enables it in production.

## Tell the browser your rules

Password managers generate strong passwords, but only if they know your rules. Safari reads a `passwordrules` attribute, and Laravel can build its value from your rule object:

```php
Password::defaults()->toPasswordRulesString();
// "minlength: 12; required: lower; required: digit;"
```

Pass that string to the page as a prop and put it on the input, together with `autocomplete="new-password"`:

```html
<input type="password" name="password" autocomplete="new-password" passwordrules="minlength: 12; required: lower; required: digit;">
```

Now the generated password passes validation on the first try, and your rules live only on the server.

## Changing a password

A password change form needs a little more than the rules above:

- **Ask for the current password** with the `current_password` rule, which checks the value against the signed-in user's hash.
- **Let the model hash it.** With a `'password' => 'hashed'` cast on the user model, `$user->update(['password' => $request->password])` stores a hash, never plain text.
- **Sign out other sessions.** `Auth::logoutOtherDevices($password)` invalidates the user's other sessions, as long as those routes use the `auth.session` middleware.
- **Throttle the endpoint** so a stolen session can't guess the current password. See [rate limiting login attempts in Laravel](/blog/laravel-login-rate-limiting.html).

## Password confirmation for sensitive actions

A signed-in session is not proof that the owner is at the keyboard. Before showing recovery codes, deleting an account or changing security settings, ask for the password again. Laravel's `password.confirm` middleware does this:

```php
Route::get('/settings/security', [SecurityController::class, 'edit'])
    ->middleware(['auth', 'password.confirm']);
```

If the user hasn't confirmed recently, the middleware redirects to the `password.confirm` route (JSON requests get a `423` response instead). After a successful confirmation, the session stores `auth.password_confirmed_at`, and the user can continue for as long as `password_timeout` in `config/auth.php` allows. Laravel's default is 10800 seconds (three hours).

For especially sensitive routes, pass a shorter timeout in seconds as the second middleware parameter:

```php
->middleware('password.confirm:password.confirm,300');
```

### Password confirmation with Fortify

[Laravel Fortify](/blog/laravel-fortify-tutorial.html) registers the confirmation routes for you: `GET` and `POST /user/confirm-password`, plus `GET /user/confirmed-password-status`, which returns `{"confirmed": true}` or `false`. That status endpoint is handy when you want to open a confirmation dialog in your SPA instead of redirecting.

To change how the password is checked, register a callback. For example, to throttle confirmation attempts per user:

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

Fortify's two-factor and passkey management routes can require a confirmed password through their `confirmPassword` option, and users with a passkey can confirm with it instead of typing a password. See [passkeys in Laravel](/blog/laravel-passkeys.html) for that flow.

## Frequently asked questions

### What are Laravel's default password rules?

Without `Password::defaults()`, `Password::default()` requires only a minimum of eight characters. Everything else, such as mixed case, numbers, symbols or the breach check, is opt-in through the `Password` rule's methods.

### Should I force users to change their password regularly?

No. Current NIST guidance says not to require periodic changes, because users respond with predictable variations. Force a change only when you have evidence that a password was compromised.

### How long does password confirmation last in Laravel?

As long as `password_timeout` in `config/auth.php`, which defaults to 10800 seconds (three hours). You can shorten it for a single route by passing seconds to the `password.confirm` middleware.

### Does the uncompromised rule send passwords to a third party?

No. Laravel sends only the first five characters of the password's SHA-1 hash, receives a list of matching hash suffixes and compares the rest locally. The full password and full hash never leave your server.

## How SaaS Laravel handles password rules

The [SaaS Laravel starter kits](/) set `Password::defaults()` in `AppServiceProvider`: in production, passwords need at least 12 characters with mixed case, letters, numbers and symbols, and must not appear in known breaches; other environments use Laravel's eight-character default. Registration, password reset, password change and both invitation forms validate with `Password::default()` and `confirmed`, mostly through a shared `PasswordValidationRules` trait, and those pages receive `toPasswordRulesString()` for the `passwordrules` attribute. The Security settings page sits behind password confirmation (with a passkey option), and changing the password also requires the current one. Read the [authentication documentation](/docs/core/authentication.html) for details.

<BlogPostCta title="Password policy, set once for every form" text="SaaS Laravel applies one password policy to sign-up, reset, invitations and settings, with password confirmation, 2FA and passkeys, in Vue, React or Svelte." />
