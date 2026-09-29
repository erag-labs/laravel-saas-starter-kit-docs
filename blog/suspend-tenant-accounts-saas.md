---
title: "Suspending Customer Accounts in a SaaS"
description: "How to suspend a SaaS account the right way: status fields, blocking middleware, what stays reachable, background jobs, customer messages and reactivation."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Multi-tenancy, Operations]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/suspend-tenant-accounts-saas.html
  - - meta
    - property: og:title
      content: "Suspending Customer Accounts in a SaaS"
  - - meta
    - property: og:description
      content: "How to suspend a SaaS account the right way: status fields, blocking middleware, what stays reachable, background jobs, customer messages and reactivation."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/suspend-tenant-accounts-saas.html
  - - meta
    - name: twitter:title
      content: "Suspending Customer Accounts in a SaaS"
  - - meta
    - name: twitter:description
      content: "How to suspend a SaaS account the right way: status fields, blocking middleware, what stays reachable, background jobs, customer messages and reactivation."
---

# How to Suspend a SaaS Account: Statuses, Access Rules and Reactivation

<BlogPostMeta />

Sooner or later you will need to **suspend a SaaS account**: a card keeps failing, someone breaks your terms, or a security incident needs a customer's workspace frozen while you investigate. Suspension sounds like one boolean, but done badly it either locks customers out of the page they need to fix the problem, or leaves background jobs running for an account that should be paused. This guide covers the data model, where to block access, what to keep reachable, the parts people forget, and how to bring an account back.

## Suspend vs cancel vs delete vs maintenance

These four get mixed up, and each needs different behaviour:

| Action | Data | Access | Reversible |
| --- | --- | --- | --- |
| Suspend | Kept | Blocked, except a few pages | Yes, instantly |
| Cancel | Kept until the period ends | Normal until the period ends | Yes, by subscribing again |
| Delete | Removed | None | Only from a backup |
| Maintenance | Kept | Temporarily blocked for technical work | Yes, when the work is done |

Suspension is a **business decision about one customer**. Maintenance is a **technical pause**, often for everyone; that is covered in [maintenance mode for multi-tenant Laravel apps](/blog/laravel-multi-tenant-maintenance-mode.html).

## Model the status explicitly

Don't use an `is_active` boolean. You will want more than two states, and a status enum makes every transition readable:

```php
enum AccountStatus: string
{
    case Trial = 'trial';
    case Active = 'active';
    case PastDue = 'past_due';
    case Suspended = 'suspended';
}
```

Next to the status, store a few fields that save you later:

| Field | Purpose |
| --- | --- |
| `suspended_at` | When it happened; drives retention and reporting |
| `suspension_reason` | Internal note: "chargeback", "spam reports", "customer request" |
| `status_message` | Customer-facing text shown on the suspended page |
| `suspended_by` | The admin who did it, or `system` for automatic suspension |

Keep the internal reason and the customer-facing message separate. "Flagged for fraud review" is useful for your team and not something you want on a customer's screen.

In a database-per-tenant app, these fields belong on the tenant record in the **central** database, not in the tenant's own database. That way your admin area can list and filter suspended accounts without opening every tenant.

## Block access in one middleware

Check the status in a single middleware that runs on every tenant request, after the tenant has been identified and before authentication. Returning a page instead of a redirect keeps things simple and works for signed-in users with an existing session:

```php
public function handle(Request $request, Closure $next): Response
{
    $tenant = tenant();

    if (! $tenant || $tenant->status !== AccountStatus::Suspended->value
        || $request->routeIs('logout', 'billing.*')) {
        return $next($request);
    }

    return response()->view('suspended', ['message' => $tenant->status_message], 403);
}
```

Because every request passes through it, you don't need to end sessions when you suspend: the very next click shows the suspended page.

### Which HTTP status code?

| Code | Fits? |
| --- | --- |
| `403 Forbidden` | Yes. The server understood the request and refuses it for this account. |
| `402 Payment Required` | Tempting for unpaid invoices, but the HTTP specification reserves it for future use, and not every suspension is about money. |
| `503 Service Unavailable` | No. It tells browsers, crawlers and monitors that your service is down. |

## Decide what stays reachable

Blocking everything feels safe, but it creates support tickets. Decide per reason:

| Keep open | Why |
| --- | --- |
| Logout | Users must be able to leave, or switch accounts |
| The billing page | A customer suspended for non-payment needs a way to pay |
| Data export | Customers expect to get their data out, and it builds trust |
| A support contact | So they can ask what happened instead of disputing a charge |

For abuse or security cases, you may close everything except logout. For non-payment, keep billing open, or you are blocking the only action that fixes the problem.

## Suspension beyond the web request

The middleware stops page views. Plenty of other things can still act on behalf of a suspended account:

- **API tokens and integrations.** Apply the same check to your API routes, not just the web group.
- **Queued jobs.** Jobs dispatched before the suspension will still run. Check the status at the start of long or costly jobs.
- **Scheduled work.** Nightly reports, digests and syncs usually loop over every tenant. Skip suspended ones.
- **Outgoing email and webhooks.** Don't keep sending "your weekly summary" to an account you've just locked.
- **Custom domains and public pages.** If tenants publish anything publicly, decide whether it goes offline too.

With stancl/tenancy, skipping suspended tenants in scheduled work is one extra line:

```php
Tenant::query()->cursor()
    ->reject(fn (Tenant $tenant) => $tenant->status === AccountStatus::Suspended->value)
    ->each(fn (Tenant $tenant) => $tenant->run(fn () => SendWeeklyDigest::dispatch()));
```

## Suspend a SaaS account through one service

Suspending and reactivating should go through one service method, called by your admin controller and by any automatic process. That gives you one place to record who did it and to notify people:

```php
public function suspend(Tenant $tenant, string $reason, ?string $message, ?User $by): void
{
    $tenant->update([
        'status' => AccountStatus::Suspended->value,
        'suspended_at' => now(),
        'suspension_reason' => $reason,
        'status_message' => $message,
        'suspended_by' => $by?->id,
    ]);

    event(new TenantSuspended($tenant, $reason)); // your own event
}
```

Listeners can then email the customer, alert your team and write an audit log entry. Also protect the action itself: only a small group of admins should be able to suspend accounts, ideally through a dedicated permission.

## Automatic suspension for failed payments

Suspending by hand works for abuse cases. For non-payment you usually automate it:

1. The payment fails and your billing provider's webhook marks the account `past_due`.
2. The customer gets emails and an in-app banner, while access stays normal for a grace period.
3. When the grace period ends without a successful payment, a scheduled command suspends the account.
4. A successful payment webhook reactivates it immediately.

Wiring up subscriptions and webhooks is covered in [adding Stripe billing to a Laravel SaaS](/blog/laravel-saas-stripe-billing.html). The important part here is that the webhook handler calls the same suspend and reactivate methods as your admin area.

## Reactivation and retention

Reactivating should be as quick as suspending: set the status back, clear `suspended_at`, and tell the customer. Because nothing was deleted, they return to exactly where they left off.

Suspended accounts shouldn't live forever, though. Decide how long you keep data for a suspended or cancelled account, write it into your terms, warn the customer before the deadline, and then delete the tenant properly. Take a final backup first, as described in [backups for a multi-database Laravel SaaS](/blog/laravel-multi-database-backups.html), because dropping a tenant database can't be undone.

## Frequently asked questions

### What is the difference between suspending and deleting a SaaS account?

Suspension blocks access but keeps every record, so the account can be restored instantly. Deletion removes the data and can only be undone from a backup. Suspend first, and delete only after your retention period.

### Should a suspended customer still be able to log in?

Usually yes, as far as the suspended page. Signing in lets you show a clear message and, for unpaid invoices, a link to the billing page. What they must not reach is the rest of the product.

### Which HTTP status code should a suspended account return?

`403 Forbidden` is the most accurate choice. Avoid `503`, which signals an outage of your whole service to browsers and monitoring tools.

### Do I need to log users out when I suspend their account?

Not if the check runs in middleware on every request. The next request after the status change shows the suspended page, whether or not the user already had a session.

## How SaaS Laravel handles suspension

The SaaS Laravel kits give every tenant a workspace status: Active, Trial, Pending Invitation or Suspended. A central admin sets it in the tenant edit form, with an optional status message of up to 500 characters. When a workspace is suspended, the `EnsureTenantIsNotSuspended` middleware renders a suspended page with the company name and the message, with HTTP 403, on every web request to that tenant's domains; only logout still works. Setting the status back to Active or Trial restores access immediately. Suspension is manual: the kits do not include billing, so automatic suspension for failed payments is yours to add. Read [maintenance and suspension](/docs/core/maintenance-and-suspension.html) in the docs, or see where this fits in the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html).

<BlogPostCta title="Workspace suspension, built in" text="SaaS Laravel includes workspace status, suspension with a custom message and tenant-wide maintenance mode, with database-per-tenant isolation in Vue, React or Svelte." />
