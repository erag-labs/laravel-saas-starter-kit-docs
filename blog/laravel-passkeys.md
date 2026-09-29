---
title: "Passkeys in Laravel: Passwordless Login"
description: "How Laravel passkeys work with WebAuthn and Fortify: the register and login flows, relying party and allowed origins for subdomains, and password fallback."
pageClass: blog-page
date: 2026-09-29
author: erag
category: security
tags: [Authentication, Security]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-passkeys.html
  - - meta
    - property: og:title
      content: "Passkeys in Laravel: Passwordless Login"
  - - meta
    - property: og:description
      content: "How Laravel passkeys work with WebAuthn and Fortify: the register and login flows, relying party and allowed origins for subdomains, and password fallback."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-passkeys.html
  - - meta
    - name: twitter:title
      content: "Passkeys in Laravel: Passwordless Login"
  - - meta
    - name: twitter:description
      content: "How Laravel passkeys work with WebAuthn and Fortify: the register and login flows, relying party and allowed origins for subdomains, and password fallback."
---

# Laravel Passkeys: Passwordless Login with WebAuthn and Fortify

<BlogPostMeta />

Passwords get phished, reused and leaked, and there isn't much your app can do about any of that once a user has picked a bad one. Passkeys remove the problem. The user signs in with a fingerprint, face scan or device PIN, and your server holds nothing worth stealing. Below we explain what passkeys are, how Laravel passkeys work with the official `laravel/passkeys` package and Laravel Fortify, what the registration and login flows look like, and the configuration that trips up most multi-tenant apps: the relying party ID and allowed origins.

## What passkeys are

A passkey is a WebAuthn credential. In practice that means a public/private key pair, created by the user's device or password manager for one specific website.

The private key stays on the device or in the user's password manager and never reaches your server. Your application only stores the public key. To sign in, the user unlocks the device with a fingerprint, face scan or PIN, and the device signs a random challenge from your server. Your server checks that signature against the stored public key, and if it matches, the user is in.

## Why passkeys beat passwords

| Risk | Password | Passkey |
| --- | --- | --- |
| Phishing | Users can type it into a lookalike site | Bound to your domain; the browser won't offer it on another site |
| Database leak | Hashes can be cracked offline | Public keys are useless to an attacker |
| Reuse across sites | Very common | Impossible: every site gets its own key pair |
| Second factor | Needs a separate step, such as a TOTP code | Possession of the device and a biometric or PIN in one step |

## How Laravel passkeys work: laravel/passkeys and Fortify

Passkey support in Laravel is split between a server package and a JavaScript client.

`laravel/passkeys` is the server side. It generates WebAuthn options, verifies responses (using `web-auth/webauthn-lib`), stores credentials in a `passkeys` table and fires `PasskeyRegistered`, `PasskeyVerified` and `PasskeyDeleted` events. `@laravel/passkeys` runs the browser side of the ceremonies and ships helpers for Vue, React and Svelte.

Laravel Fortify requires `laravel/passkeys` and treats passkeys as a feature. You enable them in `config/fortify.php`, and Fortify registers the routes and copies its settings, guard, middleware and rate limiter into the package's config.

```php
'features' => [
    // ...
    Features::passkeys([
        'confirmPassword' => true,
    ]),
],
```

With `confirmPassword`, the routes that add and delete passkeys sit behind the `password.confirm` middleware. We'd leave that on. Next, prepare the user model:

```php
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;

class User extends Authenticatable implements PasskeyUser
{
    use PasskeyAuthenticatable;
}
```

Each credential gets one row in the `passkeys` table: `user_id`, a user-chosen `name`, a unique `credential_id`, the `credential` JSON (including the public key) and `last_used_at`. Users can have as many passkeys as they have devices.

Fortify registers these routes:

| Method | URI | Route name | Who |
| --- | --- | --- | --- |
| GET | `/passkeys/login/options` | `passkey.login-options` | Guests |
| POST | `/passkeys/login` | `passkey.login` | Guests |
| GET | `/passkeys/confirm/options` | `passkey.confirm-options` | Signed-in users |
| POST | `/passkeys/confirm` | `passkey.confirm` | Signed-in users |
| GET | `/user/passkeys/options` | `passkey.registration-options` | Signed-in, password confirmed |
| POST | `/user/passkeys` | `passkey.store` | Signed-in, password confirmed |
| DELETE | `/user/passkeys/{passkey}` | `passkey.destroy` | Signed-in, password confirmed |

## The registration flow

A user adds a passkey while already signed in, usually from a security settings page.

1. The user clicks "Add passkey" and gives it a name such as "Chrome on Mac".
2. The client fetches `passkey.registration-options`, which returns a fresh challenge, the relying party ID and a stable user handle. The handle is an HMAC of the user's table and ID, so no email address ends up embedded in the credential.
3. The browser shows its native prompt, the user unlocks the device, and the device creates the key pair. The package requires a discoverable credential and user verification, so signing in later needs no username.
4. The client posts the result to `passkey.store`. The server verifies the challenge, origin and relying party, then saves the public key.

With the Vue helper, the component code stays short:

```ts
import { usePasskeyRegister } from '@laravel/passkeys/vue';

const { register, isLoading, error, isSupported } = usePasskeyRegister({
    onSuccess: () => {
        // Reload the list of passkeys
    },
});

await register('Chrome on Mac');
```

## The passkey login flow

Signing in takes three steps. The login page shows a "Sign in with a passkey" button, and clicking it fetches a challenge from `passkey.login-options`. The browser then lists the passkeys saved for your domain, and the user picks one and unlocks it. Finally, the client posts the signed response to `passkey.login`. The package verifies the signature and origin, updates `last_used_at`, logs the user in through the configured guard and regenerates the session. With Fortify, the user lands on Fortify's login redirect.

Some details that matter once you build on top of this:

- `Passkeys::authorizeLoginUsing()` lets you reject a perfectly valid passkey, for example when the account is suspended.
- A passkey login skips Fortify's [two-factor challenge](/blog/laravel-two-factor-authentication.html). That's by design, since the passkey already combines something you have with a biometric or PIN.
- The `passkey.confirm` routes let users confirm a sensitive action with a passkey instead of retyping a password.
- The JavaScript client can also offer passkeys in the browser's autofill dropdown, anchored to an input with `autocomplete="email webauthn"`.

## Relying party ID and allowed origins

These two settings decide where a passkey works, and they're where most setups go wrong. With Fortify, they live under the `passkeys` key of `config/fortify.php`:

```php
'passkeys' => [
    'relying_party_id' => parse_url(config('app.url'), PHP_URL_HOST),
    'allowed_origins' => [config('app.url')],
    'user_handle_secret' => env('PASSKEYS_USER_HANDLE_SECRET', config('app.key')),
    'timeout' => 60000,
],
```

`relying_party_id` is the domain a passkey is bound to. The browser only accepts it if it matches the page's host or one of its parent domains, which is why a passkey created for `your-saas.com` can be used on `acme.your-saas.com`.

`allowed_origins` is checked on the server, and it's strict. Each origin (scheme, host and port) must appear in the list exactly. There's no subdomain matching, so a sign-in from `https://acme.your-saas.com` is **rejected unless that origin is listed**.

`user_handle_secret` is used to derive the user handle. If you ever rotate `APP_KEY`, set `PASSKEYS_USER_HANDLE_SECRET` explicitly first.

::: warning Multi-tenant apps: allow every origin
When tenants sign in on their own subdomains, the defaults only allow `APP_URL`. Keep the relying party ID on your root domain and add each tenant origin to `allowed_origins`. Build that list from domains you already know, such as your domains table, and never from the raw `Host` header. A tenant on a completely different custom domain can't share your root relying party ID, so passkeys there have to be bound to that domain.
:::

| Setup | `relying_party_id` | `allowed_origins` |
| --- | --- | --- |
| Single app domain | `app.example.com` | `https://app.example.com` |
| Tenant subdomains | `example.com` | `https://example.com`, `https://acme.example.com`, … |
| Tenant custom domain | `acme-corp.com` | `https://acme-corp.com` |

Browsers only run WebAuthn on secure origins, so test over HTTPS locally as well. For the wider subdomain setup, see [how to build a multi-tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## Browser support and password fallback

All current major browsers support passkeys on desktop and mobile, and synced passkeys follow the user across devices through their password manager.

We'd still keep passwords around as a fallback. The JavaScript helpers return `isSupported`, so you can hide passkey buttons in browsers without WebAuthn. The flow that works well for most apps is: users sign up and log in with a password first, then add passkeys from their settings. If they lose every device, password reset is still the way back in.

Make passkeys easy to manage, too. Show each one's name, when it was created and last used, and a delete button. The package's `Passkey` model also exposes an `authenticator` label, such as a password manager's name, resolved from the credential's AAGUID. That label helps users tell their passkeys apart.

## Frequently asked questions

### Do passkeys replace passwords completely in Laravel?

They can, but most apps keep passwords as a fallback. With Fortify, passkeys sit next to password login, and password reset remains the recovery path.

### Do I need HTTPS for passkeys?

Yes. Browsers only allow WebAuthn on secure origins, so you need HTTPS in production and in local development.

### Can one passkey work across tenant subdomains?

Yes, as long as the relying party ID is your root domain and every tenant origin is in `allowed_origins`. The browser accepts the parent domain, and the server checks the exact origin.

### Are passkeys the same as two-factor authentication?

Not quite, but they cover the same ground. A passkey combines a device with a biometric or PIN in a single step, which is why Fortify doesn't ask for a TOTP code afterwards.

## Passkeys in SaaS Laravel

The [SaaS Laravel starter kits](/) already have this wired up. They enable Fortify passkeys with `confirmPassword`, the `User` model implements `PasskeyUser`, and the `passkeys` table exists in both the central and the tenant databases. Every kit (Vue, React and Svelte) uses `@laravel/passkeys` for a passkey button on the login and confirm-password pages. On the Security settings page, users can add, name and delete passkeys and see each one's authenticator and last use. Passkey requests are limited to ten per minute, and each tenant domain can switch passkeys off. One honest caveat: the kit ships the package defaults for the relying party ID and allowed origins, so you'll need to extend `allowed_origins` for tenant subdomains as described above. More in the [authentication documentation](/docs/core/authentication.html) and the [Laravel SaaS starter kit guide](/blog/laravel-saas-starter-kit.html).

<BlogPostCta title="Passwordless sign-in, already built" text="SaaS Laravel ships Fortify authentication with passkeys, two-factor codes and per-domain feature toggles, on a multi-tenant Laravel backend with Vue, React or Svelte." />
