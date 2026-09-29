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

Laravel's defaults are good, so it's tempting to assume the security side of a SaaS is mostly handled for you. It isn't quite. A SaaS brings risks a single-customer app never has: lots of tenants sharing one codebase, admins who can see almost everything, and invitation and reset emails going out all day. I put this Laravel SaaS security checklist together as something to walk through before launch, and again after every big feature. Each item is deliberately short, and where a longer guide exists, I've linked it.

## How to work through this Laravel SaaS security checklist

Go section by section and write down who owns each item. You don't need all of it on day one, so here's roughly how I'd order it:

| Priority | Areas |
| --- | --- |
| Before launch | Authentication, sessions, tenant isolation, authorization, secrets, HTTPS |
| First weeks | Security headers, upload hardening, audit logging, dependency checks |
| Ongoing | Dependency updates, restore tests, reviewing permissions and admin accounts |

Looking for deployment steps, or launch tasks that aren't about security? Those live in [deploying a Laravel SaaS to production](/blog/deploy-laravel-saas.html) and the [SaaS launch checklist](/blog/laravel-saas-launch-checklist.html).

## 1. Authentication

Most account takeovers begin at the login form. [Laravel Fortify](/blog/laravel-fortify-tutorial.html) handles the flows themselves; what you need to check is how they're set up.

- Throttle every auth endpoint: login, the two-factor challenge, password reset, registration and invitation accept. Key the login limit by email and IP. More in [rate limiting login attempts in Laravel](/blog/laravel-login-rate-limiting.html).
- Define one password policy with `Password::defaults()`, favour length, and check against breached passwords. See [password rules and confirmation in Laravel](/blog/laravel-password-validation-rules.html).
- Offer a second factor. TOTP codes with recovery codes work well, as long as the user confirms the setup before it takes effect. See [two-factor authentication in Laravel](/blog/laravel-two-factor-authentication.html).
- Think about passkeys too. They resist phishing, and TOTP codes don't. The [passkeys in Laravel](/blog/laravel-passkeys.html) guide covers the setup.
- Verify email addresses before users can act on data or receive invitations ([email verification in Laravel](/blog/laravel-email-verification.html)).
- Ask for a recent password on sensitive pages such as security settings, recovery codes and account deletion.
- Don't reveal which emails exist. Login errors should stay generic, and "forgot password" should respond the same way whether or not the address is known.

## 2. Sessions and guards

- In production, set `SESSION_SECURE_COOKIE=true` so the session cookie only travels over HTTPS. Laravel already makes it `http_only` with `same_site=lax` by default, so this is the one you usually add yourself.
- Leave `SESSION_DOMAIN` as `null` in a subdomain-based multi-tenant app. If you're wondering why, that keeps sessions per host, so one tenant's session cookie is never sent to another tenant's subdomain.
- Regenerate the session on login and invalidate it on logout. Fortify does both, but check any custom login code you've written.
- If admins and customers live in different tables or databases, keep their accounts apart with [separate auth guards for admins and customers](/blog/laravel-multiple-auth-guards.html).
- After a password change, sign out other devices with `Auth::logoutOtherDevices()` and the `auth.session` middleware.
- Choose a sensible `SESSION_LIFETIME`. It's in minutes, and shorter is safer for admin-heavy apps.

## 3. Tenant isolation

This is the SaaS-specific section, and it's where one bug can hand a customer's data to someone else. If you haven't picked a data model yet, start with the [multi-tenant SaaS guide](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

- Identify the tenant from the host, never from input. A user can change a `tenant_id` in a form field or query string.
- Check every data path, not only the database. Cache keys, file storage, queued jobs and scheduled commands all need tenant context too.
- Block tenant routes on the central domain, and central admin routes on tenant domains.
- With a single database, scope every query. A global scope on tenant-owned models is the minimum, and keep in mind that raw queries and `DB::table()` bypass it.
- Sign in as a user of tenant A and request tenant B's resources by ID. Then **automate that cross-tenant test** in your suite, so it runs on every change.

## 4. Authorization

- Protect routes on the server. Every route that reads or changes data needs `permission` middleware, a policy or a Gate check. Hiding a button in Vue, React or Svelte isn't authorization. The [Laravel roles and permissions with Spatie](/blog/laravel-roles-permissions-spatie.html) guide goes into this.
- Check ownership as well as permission. "Can edit invoices" doesn't mean "can edit *this* invoice", and policies are the right place for that difference.
- Keep super-admin accounts few and review them regularly, because a `Gate::before` bypass makes them all-powerful.
- Guard against mass assignment. Use `$fillable` (or the `#[Fillable]` attribute) and pass validated data to `create()` and `update()`, never `$request->all()`.
- Stop privilege escalation. People who manage roles must not be able to give themselves, or anyone else, more than they already have.

## 5. Data exposure

- Turn off debug mode with `APP_DEBUG=false` and `APP_ENV=production` in production. A debug page shows environment variables and stack traces.
- Add `password`, `remember_token`, `two_factor_secret` and `two_factor_recovery_codes` to the model's hidden attributes.
- Everything you pass to an Inertia page is visible in the browser, so **treat Inertia props as public**. Map models to the fields the page needs instead of passing whole models.
- Return 404 or 403 for other tenants' IDs, and keep error pages free of internal details.
- Keep secrets out of logs. Don't log request bodies on auth routes, and mark sensitive method arguments with PHP's `#[\SensitiveParameter]`.

## 6. Links, tokens and emails

- Invitation links should be signed, expire, and work only once. Temporary signed URLs get you most of the way; see [user invitations in Laravel with signed URLs](/blog/laravel-user-invitations-signed-urls.html).
- Keep reset tokens short-lived. The password broker's `expire` (minutes) and `throttle` (seconds between requests) in `config/auth.php` control this.
- Build tenant links from the tenant's domain rather than the current request's `Host` header, so an attacker can't poison the links in your emails.
- Rate limit anything that sends email, so nobody can use your app to flood an inbox.

## 7. Input, output and uploads

- Validate every request with Form Requests or data objects. That includes admin-only endpoints.
- Prefer Eloquent and query bindings. User input should never go into `DB::raw()`, `whereRaw()` or `orderBy()` column names without an allow-list.
- Vue, React and Svelte escape output by default, so treat `v-html`, `dangerouslySetInnerHTML` and `{@html}` as a red flag in code review.
- Validate uploads by MIME type and size. Store them outside the public directory unless they really must be public, and use tenant-aware disks.
- Leave CSRF protection on. It's part of the `web` middleware group, and the only routes to exclude are webhooks that verify their own signatures.

## 8. Secrets and configuration

- Protect `APP_KEY`. Cookies, signed URLs and 2FA secrets all depend on it. When you need to rotate it, Laravel's `APP_PREVIOUS_KEYS` lets you do that without breaking existing encrypted data.
- Keep `.env` out of Git, and use different keys and credentials for each environment.
- Remove seeded demo users, or change their passwords, before going live.
- Give database users the least privilege they need. In a database-per-tenant setup, only the account that creates tenant databases needs `CREATE DATABASE` rights.

## 9. Transport and headers

- Serve HTTPS everywhere, including every tenant subdomain. A wildcard certificate covers `*.your-domain.com`, and [Laravel multi-tenancy with subdomains](/blog/laravel-multi-tenancy-subdomains.html) walks through it.
- Add security headers in middleware or at the web server: `Strict-Transport-Security`, a `Content-Security-Policy`, `frame-ancestors` (or `X-Frame-Options`) and `Referrer-Policy`.
- Configure trusted proxies on purpose. Behind a load balancer, that's what makes `$request->ip()` return the real client IP, and your rate limits depend on it.

## 10. Dependencies

Run `composer audit` and `npm audit` in CI and before every release. Commit your lock files so production installs exactly what you tested. And stay on supported Laravel and PHP versions, so you can apply security releases as soon as they're out.

## 11. Monitoring, backups and response

- Log security events: failed logins, lockouts, 2FA being disabled, role changes and impersonation. Laravel and Fortify dispatch events for most of these, so it's mostly a matter of listening for them.
- Alert on spikes in failed logins or 403 responses.
- **Back up every database and test the restores.** With a database per tenant, that means every tenant database. See [backups for a multi-database Laravel SaaS](/blog/laravel-multi-database-backups.html).
- Know how you'd lock a customer out quickly. Plan how to suspend a tenant and how to delete one safely ([suspending customer accounts in a SaaS](/blog/suspend-tenant-accounts-saas.html)).

## Frequently asked questions

### Is Laravel secure enough for a SaaS?

Yes. Laravel ships with CSRF protection, escaped output in Blade, hashed passwords, signed URLs, encryption and rate limiting. When a SaaS does have security problems, they usually come from application code: missing authorization checks, tenant data leaks, exposed debug pages. That's what this checklist is aimed at.

### What is the biggest security risk in a multi-tenant Laravel app?

Cross-tenant data leaks. The usual causes are a query that skips tenant scoping, a cache key or file path without a tenant prefix, or a queued job that runs without tenant context. A database per tenant lowers the risk, and automated cross-tenant tests catch what's left.

### How often should I review Laravel SaaS security?

Go through the whole checklist before launch and after major features. Dependency audits belong on every build, and I'd review admin accounts, roles and permissions at least once a quarter.

### Do I need a penetration test before launching?

Not always for a first launch. It gets more useful once you handle sensitive data or sell to larger companies, who often ask for one. If you fix everything on this checklist first, the test costs less and the report is shorter.

## How SaaS Laravel covers the checklist

If you'd rather not wire all of the authentication, session and isolation work up yourself, the [SaaS Laravel starter kits](/) already cover a good part of it. You get Fortify with confirmed TOTP 2FA, passkeys, and rate limiters for login, 2FA and passkeys, along with a production password policy with breach checks and a Security page behind password confirmation. Tenants are identified by subdomain with a database each, sessions stay per host, central and tenant users have separate guards, and a `central.only` middleware keeps the admin area off tenant domains. Routes use Spatie `permission` middleware, invitation links are signed and expire after 7 days, and tenants can be suspended. Security headers, monitoring and backups are still yours to set up. The details are in [authentication](/docs/core/authentication.html), [multi-tenancy](/docs/core/multi-tenancy.html) and the [production checklist](/docs/reference/environment.html#production-checklist).

<BlogPostCta title="Start from a secure SaaS foundation" text="SaaS Laravel includes Fortify auth with 2FA and passkeys, database-per-tenant isolation and Spatie permissions, in Vue, React or Svelte." />
