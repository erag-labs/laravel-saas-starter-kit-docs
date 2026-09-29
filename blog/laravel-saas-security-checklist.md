---
title: "Laravel SaaS Security Checklist"
description: "A Laravel SaaS security checklist: authentication, sessions, tenant isolation, authorization, data exposure, secrets, uploads, dependencies and monitoring."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: security
tags: [Security, Multi-tenancy]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-saas-security-checklist.html
  - - meta
    - property: og:title
      content: "Laravel SaaS Security Checklist"
  - - meta
    - property: og:description
      content: "A Laravel SaaS security checklist: authentication, sessions, tenant isolation, authorization, data exposure, secrets, uploads, dependencies and monitoring."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-saas-security-checklist.html
  - - meta
    - name: twitter:title
      content: "Laravel SaaS Security Checklist"
  - - meta
    - name: twitter:description
      content: "A Laravel SaaS security checklist: authentication, sessions, tenant isolation, authorization, data exposure, secrets, uploads, dependencies and monitoring."
---

# Laravel SaaS Security: A Practical Checklist for Multi-Tenant Apps

<BlogPostMeta />

Laravel gives you strong defaults, but a SaaS adds risks a single-customer app doesn't have: many tenants sharing one codebase, admins with wide access, and invitation and reset emails flying around. This **Laravel SaaS security** checklist walks through the areas to review before launch and after every major feature. Each item is short on purpose and links to a detailed guide where one exists.

## How to use this Laravel SaaS security checklist

Work through it section by section and note who owns each item. Not everything has to be done on day one:

| Priority | Areas |
| --- | --- |
| Before launch | Authentication, sessions, tenant isolation, authorization, secrets, HTTPS |
| First weeks | Security headers, upload hardening, audit logging, dependency checks |
| Ongoing | Dependency updates, restore tests, reviewing permissions and admin accounts |

For deployment steps and non-security launch tasks, see [deploying a Laravel SaaS to production](/blog/deploy-laravel-saas.html) and the [SaaS launch checklist](/blog/laravel-saas-launch-checklist.html).

## 1. Authentication

Most account takeovers start at the login form. [Laravel Fortify](/blog/laravel-fortify-tutorial.html) covers the flows; these are the settings to check.

- **Throttle every auth endpoint.** Login, two-factor challenge, password reset, registration and invitation accept all need limits. Key login limits by email and IP. See [rate limiting login attempts in Laravel](/blog/laravel-login-rate-limiting.html).
- **Set one password policy.** Define `Password::defaults()` once, favour length, and check breached passwords. See [password rules and confirmation in Laravel](/blog/laravel-password-validation-rules.html).
- **Offer a second factor.** TOTP codes with recovery codes, confirmed before they take effect. See [two-factor authentication in Laravel](/blog/laravel-two-factor-authentication.html).
- **Consider passkeys.** They resist phishing, which TOTP codes don't. See [passkeys in Laravel](/blog/laravel-passkeys.html).
- **Verify email addresses** before users can act on data or receive invitations. See [email verification in Laravel](/blog/laravel-email-verification.html).
- **Require a recent password** for sensitive pages: security settings, recovery codes, account deletion.
- **Don't reveal which emails exist.** Keep login errors generic, and make "forgot password" respond the same way for known and unknown addresses.

## 2. Sessions and guards

- **Secure cookies in production.** Set `SESSION_SECURE_COOKIE=true` so the session cookie is only sent over HTTPS. Laravel already makes it `http_only` and `same_site=lax` by default.
- **Keep sessions per host.** In a subdomain-based multi-tenant app, leave `SESSION_DOMAIN` as `null` so one tenant's session cookie is never sent to another tenant's subdomain.
- **Regenerate the session on login** and invalidate it on logout. Fortify does both; check any custom login code.
- **Separate admin and customer accounts** when they live in different tables or databases. See [separate auth guards for admins and customers](/blog/laravel-multiple-auth-guards.html).
- **Sign out other devices** after a password change with `Auth::logoutOtherDevices()` and the `auth.session` middleware.
- **Pick a sensible lifetime.** `SESSION_LIFETIME` is in minutes; shorter is safer for admin-heavy apps.

## 3. Tenant isolation

This is the SaaS-specific section, and the one where a single bug leaks one customer's data to another. Start with the [multi-tenant SaaS guide](/blog/multi-tenant-saas-laravel-database-per-tenant.html) if you haven't chosen a data model yet.

- **Identify the tenant from the host, never from input.** A `tenant_id` in a form field or query string can be changed by the user.
- **Check every data path, not just the database.** Cache keys, file storage, queued jobs and scheduled commands all need tenant context.
- **Block tenant routes on the central domain** and central admin routes on tenant domains.
- **In a single database, scope every query.** A global scope on tenant-owned models is the minimum. Raw queries and `DB::table()` bypass it.
- **Test cross-tenant access.** Sign in as a user of tenant A and request tenant B's resources by ID. Automate this in your test suite.

## 4. Authorization

- **Protect routes on the server.** Every route that reads or changes data needs `permission` middleware, a policy or a Gate check. Hiding a button in Vue, React or Svelte is not authorization. See [Laravel roles and permissions with Spatie](/blog/laravel-roles-permissions-spatie.html).
- **Check ownership, not just permission.** "Can edit invoices" is not the same as "can edit *this* invoice". Policies are the right place for that.
- **Limit super-admin accounts** and review them regularly. A `Gate::before` bypass makes these accounts all-powerful.
- **Guard against mass assignment.** Use `$fillable` (or the `#[Fillable]` attribute) and pass validated data to `create()` and `update()`, never `$request->all()`.
- **Stop privilege escalation.** Users who manage roles must not be able to give themselves, or anyone else, more than they have.

## 5. Data exposure

- **Turn off debug mode.** `APP_DEBUG=false` and `APP_ENV=production` in production. A debug page shows environment variables and stack traces.
- **Hide sensitive attributes.** Add `password`, `remember_token`, `two_factor_secret` and `two_factor_recovery_codes` to the model's hidden attributes.
- **Treat Inertia props as public.** Everything you pass to a page is visible in the browser. Map models to the fields the page needs instead of passing whole models.
- **Return 404 or 403 for other tenants' IDs,** and keep error pages free of internal details.
- **Keep secrets out of logs.** Don't log request bodies on auth routes, and mark sensitive method arguments with PHP's `#[\SensitiveParameter]`.

## 6. Links, tokens and emails

- **Sign and expire invitation links.** Use temporary signed URLs and make them single-use. See [user invitations in Laravel with signed URLs](/blog/laravel-user-invitations-signed-urls.html).
- **Keep reset tokens short-lived.** The password broker's `expire` (minutes) and `throttle` (seconds between requests) in `config/auth.php` control this.
- **Build tenant links from the tenant's domain,** not from the current request's `Host` header, so an attacker can't poison links in emails.
- **Rate limit anything that sends email** so your app can't be used to flood an inbox.

## 7. Input, output and uploads

- **Validate every request** with Form Requests or data objects, including admin-only endpoints.
- **Prefer Eloquent and query bindings.** Never put user input into `DB::raw()`, `whereRaw()` or `orderBy()` column names without an allow-list.
- **Escape output.** Vue, React and Svelte escape by default. Treat `v-html`, `dangerouslySetInnerHTML` and `{@html}` as a code review red flag.
- **Validate uploads** by MIME type and size, store them outside the public directory unless they must be public, and use tenant-aware disks.
- **Keep CSRF protection on.** It is part of the `web` middleware group; only exclude webhook routes that verify their own signatures.

## 8. Secrets and configuration

- **Protect `APP_KEY`.** It encrypts cookies, signed URLs and 2FA secrets. Laravel's `APP_PREVIOUS_KEYS` lets you rotate it without breaking existing encrypted data.
- **Keep `.env` out of Git** and use different keys and credentials per environment.
- **Remove seeded demo users** or change their passwords before going live.
- **Use least-privilege database users.** In a database-per-tenant setup, only the account that creates tenant databases needs `CREATE DATABASE` rights.

## 9. Transport and headers

- **HTTPS everywhere,** including every tenant subdomain. A wildcard certificate covers `*.your-domain.com`. See [Laravel multi-tenancy with subdomains](/blog/laravel-multi-tenancy-subdomains.html).
- **Add security headers** in middleware or at the web server: `Strict-Transport-Security`, a `Content-Security-Policy`, `frame-ancestors` (or `X-Frame-Options`) and `Referrer-Policy`.
- **Trust proxies deliberately.** Behind a load balancer, configure trusted proxies so `$request->ip()`, which rate limits depend on, is the real client IP.

## 10. Dependencies

- **Run `composer audit` and `npm audit`** in CI and before releases.
- **Commit lock files** so production installs exactly what you tested.
- **Stay on supported Laravel and PHP versions** and apply security releases promptly.

## 11. Monitoring, backups and response

- **Log security events.** Failed logins, lockouts, 2FA being disabled, role changes and impersonation. Laravel and Fortify dispatch events for most of these.
- **Alert on spikes** in failed logins or 403 responses.
- **Back up every database** and test restores. With a database per tenant, that means every tenant database. See [backups for a multi-database Laravel SaaS](/blog/laravel-multi-database-backups.html).
- **Be able to lock a customer out quickly.** Plan how to suspend a tenant and how to delete one safely. See [suspending customer accounts in a SaaS](/blog/suspend-tenant-accounts-saas.html).

## Frequently asked questions

### Is Laravel secure enough for a SaaS?

Yes. Laravel ships CSRF protection, escaped output in Blade, hashed passwords, signed URLs, encryption and rate limiting. Most SaaS security problems come from application code: missing authorization checks, tenant data leaks and exposed debug pages, which is what this checklist targets.

### What is the biggest security risk in a multi-tenant Laravel app?

Cross-tenant data leaks. They usually come from a query that skips tenant scoping, a cache key or file path without a tenant prefix, or a queued job that runs without tenant context. Database-per-tenant reduces the risk, and automated cross-tenant tests catch what remains.

### How often should I review Laravel SaaS security?

Review the whole checklist before launch and after major features. Run dependency audits on every build, and review admin accounts, roles and permissions at least every quarter.

### Do I need a penetration test before launching?

Not always for a first launch, but it helps once you handle sensitive data or sell to larger companies, who often ask for one. Fixing everything on this checklist first makes the test cheaper and the report shorter.

## How SaaS Laravel covers the checklist

The [SaaS Laravel starter kits](/) cover much of the authentication, session and isolation work: Fortify with confirmed TOTP 2FA, passkeys and rate limiters for login, 2FA and passkeys; a production password policy with breach checks; and a Security page behind password confirmation. Tenants are identified by subdomain with a database per tenant, sessions stay per host, central and tenant users use separate guards, and a `central.only` middleware keeps the admin area off tenant domains. Routes use Spatie `permission` middleware, invitation links are signed and expire after 7 days, and tenants can be suspended. Security headers, monitoring and backups are yours to set up. See [authentication](/docs/core/authentication.html), [multi-tenancy](/docs/core/multi-tenancy.html) and the [production checklist](/docs/reference/environment.html#production-checklist).

<BlogPostCta title="Start from a secure SaaS foundation" text="SaaS Laravel includes Fortify auth with 2FA and passkeys, database-per-tenant isolation and Spatie permissions, in Vue, React or Svelte." />
