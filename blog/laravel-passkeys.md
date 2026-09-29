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

Passwords get phished, reused and leaked. Passkeys fix all three: the user signs in with a fingerprint, face scan or device PIN, and there is no secret on your server worth stealing. This guide explains what passkeys are, how **Laravel passkeys** work with the official `laravel/passkeys` package and Laravel Fortify, the registration and login flows, and the configuration that trips up most multi-tenant apps: the relying party ID and allowed origins.

## What passkeys are

A passkey is a **WebAuthn** credential: a public/private key pair created by the user's device or password manager for one specific website.

- The **private key** stays on the device or in the user's password manager and never reaches your server.
- The **public key** is stored by your application.
- To sign in, the device signs a random challenge from your server after the user unlocks it with a fingerprint, face scan or PIN.
- Your server checks the signature with the stored public key. If it matches, the user is in.

## Why passkeys beat passwords

| Risk | Password | Passkey |
| --- | --- | --- |
| Phishing | Users can type it into a lookalike site | Bound to your domain; the browser won't offer it on another site |
| Database leak | Hashes can be cracked offline | Public keys are useless to an attacker |
| Reuse across sites | Very common | Impossible: every site gets its own key pair |
| Second factor | Needs a separate step, such as a TOTP code | Possession of the device and a biometric or PIN in one step |

## How Laravel passkeys work: laravel/passkeys and Fortify

Laravel's passkey support comes in two parts:

- **`laravel/passkeys`**: the server package. It generates WebAuthn options, verifies responses (using `web-auth/webauthn-lib`), stores credentials in a `passkeys` table and fires `PasskeyRegistered`, `PasskeyVerified` and `PasskeyDeleted` events.
- **`@laravel/passkeys`**: the JavaScript client. It runs the browser side of the ceremonies and ships helpers for Vue, React and Svelte.

Laravel Fortify requires `laravel/passkeys` and integrates it as a feature: you enable passkeys in `config/fortify.php`, Fortify registers the routes and copies its settings, guard, middleware and rate limiter into the package's config.

```php
'features' => [
    // ...
    Features::passkeys([
        'confirmPassword' => true,
    ]),
],
```

`confirmPassword` puts the routes that add and delete passkeys behind the `password.confirm` middleware. Then prepare the user model:

```php
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;

class User extends Authenticatable implements PasskeyUser
{
    use PasskeyAuthenticatable;
}
```

The `passkeys` table stores one row per credential: `user_id`, a user-chosen `name`, a unique `credential_id`, the `credential` JSON (including the public key) and `last_used_at`. A user can have as many passkeys as they have devices.

These are the routes Fortify registers:

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

Passkeys are added by a user who is already signed in, usually from a security settings page.

1. **Name it.** The user clicks "Add passkey" and gives it a name such as "Chrome on Mac".
2. **Get options.** The client fetches `passkey.registration-options`: a fresh challenge, the relying party ID and a stable user handle. The handle is an HMAC of the user's table and ID, so no email address is embedded in the credential.
3. **Create the key.** The browser shows its native prompt, the user unlocks the device, and the device creates the key pair. The package requires a discoverable credential and user verification, so sign-in needs no username.
4. **Store it.** The client posts the result to `passkey.store`. The server verifies the challenge, origin and relying party, then saves the public key.

With the Vue helper, the component code is short:

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

1. The login page shows a "Sign in with a passkey" button. Clicking it fetches a challenge from `passkey.login-options`.
2. The browser lists the passkeys saved for your domain. The user picks one and unlocks it.
3. The client posts the signed response to `passkey.login`. The package verifies the signature and origin, updates `last_used_at`, logs the user in through the configured guard and regenerates the session. With Fortify, the redirect is Fortify's login redirect.

A few details worth knowing:

- **Blocking accounts.** `Passkeys::authorizeLoginUsing()` lets you reject a valid passkey, for example for a suspended account.
- **No TOTP challenge.** A passkey login does not go through Fortify's [two-factor challenge](/blog/laravel-two-factor-authentication.html). That is by design: the passkey already combines something you have with a biometric or PIN.
- **Password confirmation.** The `passkey.confirm` routes let users confirm a sensitive action with a passkey instead of retyping a password.
- **Autofill.** The JavaScript client can also offer passkeys in the browser's autofill dropdown, anchored to an input with `autocomplete="email webauthn"`.

## Relying party ID and allowed origins

These two settings decide where a passkey works. With Fortify, they live under the `passkeys` key of `config/fortify.php`:

```php
'passkeys' => [
    'relying_party_id' => parse_url(config('app.url'), PHP_URL_HOST),
    'allowed_origins' => [config('app.url')],
    'user_handle_secret' => env('PASSKEYS_USER_HANDLE_SECRET', config('app.key')),
    'timeout' => 60000,
],
```

- **`relying_party_id`** is the domain a passkey is bound to. The browser only accepts it if it matches the page's host or a parent domain of it. A passkey created for `your-saas.com` can therefore be used on `acme.your-saas.com`.
- **`allowed_origins`** is checked on the server. Each origin (scheme, host and port) must appear in the list exactly. Subdomain matching is not enabled, so a sign-in from `https://acme.your-saas.com` is rejected unless that origin is listed.
- **`user_handle_secret`** derives the user handle. Set `PASSKEYS_USER_HANDLE_SECRET` explicitly if you ever rotate `APP_KEY`.

::: warning Multi-tenant apps: allow every origin
If tenants sign in on their own subdomains, the defaults only allow `APP_URL`. Keep the relying party ID on your root domain and add each tenant origin to `allowed_origins`. Build the list from domains you know, such as your domains table, never from the raw `Host` header. A tenant on a completely different custom domain can't share your root relying party ID; passkeys there have to be bound to that domain.
:::

| Setup | `relying_party_id` | `allowed_origins` |
| --- | --- | --- |
| Single app domain | `app.example.com` | `https://app.example.com` |
| Tenant subdomains | `example.com` | `https://example.com`, `https://acme.example.com`, … |
| Tenant custom domain | `acme-corp.com` | `https://acme-corp.com` |

Browsers only run WebAuthn on secure origins, so test over HTTPS locally too. More on subdomain setups in [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## Browser support and password fallback

Passkeys work in all current major browsers on desktop and mobile, and synced passkeys follow the user across devices through their password manager.

Still, keep passwords as a fallback:

- **Hide what won't work.** The JavaScript helpers return `isSupported`, so you can hide passkey buttons in browsers without WebAuthn.
- **Add passkeys after sign-in.** Users sign up and log in with a password first, then add passkeys from their settings. Password reset stays the recovery path if every device is lost.
- **Make passkeys manageable.** Show each passkey's name, when it was created and last used, and a delete button. The package's `Passkey` model even exposes an `authenticator` label, such as a password manager's name, resolved from the credential's AAGUID.

## Frequently asked questions

### Do passkeys replace passwords completely in Laravel?

They can, but most apps keep passwords as a fallback. With Fortify, passkeys sit next to password login, and password reset remains the recovery path.

### Do I need HTTPS for passkeys?

Yes. Browsers only allow WebAuthn on secure origins, so use HTTPS in production and in local development.

### Can one passkey work across tenant subdomains?

Yes, if the relying party ID is your root domain and every tenant origin is in `allowed_origins`. The browser accepts the parent domain, and the server checks the exact origin.

### Are passkeys the same as two-factor authentication?

No, but they cover the same ground: a passkey combines a device with a biometric or PIN in one step, so Fortify doesn't ask for a TOTP code afterwards.

## Passkeys in SaaS Laravel

The [SaaS Laravel starter kits](/) enable Fortify passkeys with `confirmPassword`. The `User` model implements `PasskeyUser`, and the `passkeys` table exists in both the central and the tenant databases. Every kit (Vue, React and Svelte) uses `@laravel/passkeys` for a passkey button on the login and confirm-password pages. On the Security settings page, users can add, name and delete passkeys and see each one's authenticator and last use. Passkey requests are limited to ten per minute, and each tenant domain can switch passkeys off. The kit ships the package defaults for the relying party ID and allowed origins, so extend `allowed_origins` for tenant subdomains as described above. See the [authentication documentation](/docs/core/authentication.html) and the [Laravel SaaS starter kit guide](/blog/laravel-saas-starter-kit.html).

<BlogPostCta title="Passwordless sign-in, already built" text="SaaS Laravel ships Fortify authentication with passkeys, two-factor codes and per-domain feature toggles, on a multi-tenant Laravel backend with Vue, React or Svelte." />
