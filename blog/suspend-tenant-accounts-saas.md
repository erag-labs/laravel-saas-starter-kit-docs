---
title: "Suspending Customer Accounts in a SaaS"
description: "How to suspend a SaaS account the right way: status fields, blocking middleware, what stays reachable, background jobs, customer messages and reactivation."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: saas
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

At some point you'll have to suspend a SaaS account. A card keeps failing, someone breaks your terms, or a security incident means a customer's workspace has to be frozen while you investigate. It sounds like one boolean. Done badly, though, it either locks customers out of the very page they need to fix the problem, or leaves background jobs running for an account that should be paused. Below is how I'd handle the data model, where to block access, what to keep reachable, the parts people forget, and how to bring an account back.

## Suspend vs cancel vs delete vs maintenance

People mix these four up, and each one needs different behaviour:

| Action | Data | Access | Reversible |
| --- | --- | --- | --- |
| Suspend | Kept | Blocked, except a few pages | Yes, instantly |
| Cancel | Kept until the period ends | Normal until the period ends | Yes, by subscribing again |
| Delete | Removed | None | Only from a backup |
| Maintenance | Kept | Temporarily blocked for technical work | Yes, when the work is done |

The way I think about it: suspension is **a business decision about one customer**, while maintenance is a technical pause, often for everyone. Maintenance has its own post on [maintenance mode for multi-tenant Laravel apps](/blog/laravel-multi-tenant-maintenance-mode.html).

## Model the status explicitly

Don't use an `is_active` boolean. You'll want more than two states sooner than you think, and a status enum keeps every transition readable:

```php
enum AccountStatus: string
{
    case Trial = 'trial';
    case Active = 'active';
    case PastDue = 'past_due';
    case Suspended = 'suspended';
}
```

Next to the status, I'd store a few extra fields. They cost nothing now and save you later:

| Field | Purpose |
| --- | --- |
| `suspended_at` | When it happened; drives retention and reporting |
| `suspension_reason` | Internal note: "chargeback", "spam reports", "customer request" |
| `status_message` | Customer-facing text shown on the suspended page |
| `suspended_by` | The admin who did it, or `system` for automatic suspension |

Keep the internal reason and the customer-facing message apart. "Flagged for fraud review" is useful to your team. It's not something you want on a customer's screen.

In a database-per-tenant app, these fields go on the tenant record in the **central** database, not in the tenant's own database. Then your admin area can list and filter suspended accounts without opening every tenant.

## Block access in one middleware

Check the status in a single middleware that runs on every tenant request, after the tenant is identified and before authentication. I prefer returning a page over a redirect. It's simpler, and it works for signed-in users who already have a session:

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

Every request passes through it, so you don't need to end sessions when you suspend. The very next click shows the suspended page.

### Picking the HTTP status code

| Code | Fits? |
| --- | --- |
| `403 Forbidden` | Yes. The server understood the request and refuses it for this account. |
| `402 Payment Required` | Tempting for unpaid invoices, but the HTTP specification reserves it for future use, and not every suspension is about money. |
| `503 Service Unavailable` | No. It tells browsers, crawlers and monitors that your service is down. |

## Decide what stays reachable

Blocking everything feels safe. In practice it just creates support tickets, so decide per reason:

| Keep open | Why |
| --- | --- |
| Logout | Users must be able to leave, or switch accounts |
| The billing page | A customer suspended for non-payment needs a way to pay |
| Data export | Customers expect to get their data out, and it builds trust |
| A support contact | So they can ask what happened instead of disputing a charge |

For abuse or security cases, I'd close everything except logout. For non-payment, keep billing open. Otherwise you're blocking the one action that fixes the problem.

## Suspension beyond the web request

The middleware stops page views, and that's all it stops. Plenty of other things can still act on behalf of a suspended account.

API tokens and integrations are the obvious one: apply the same check to your API routes, not just the web group. Queued jobs are sneakier. Anything dispatched before the suspension will still run, so check the status at the start of long or costly jobs.

Scheduled work usually loops over every tenant (nightly reports, digests, syncs), and it should skip suspended ones. The same goes for outgoing email and webhooks; don't keep sending "your weekly summary" to an account you've just locked. And if tenants publish anything on custom domains or public pages, decide whether that goes offline too.

With stancl/tenancy, skipping suspended tenants in scheduled work is one extra line:

```php
Tenant::query()->cursor()
    ->reject(fn (Tenant $tenant) => $tenant->status === AccountStatus::Suspended->value)
    ->each(fn (Tenant $tenant) => $tenant->run(fn () => SendWeeklyDigest::dispatch()));
```

## Suspend a SaaS account through one service

Suspending and reactivating should both go through one service method, called by your admin controller and by any automatic process. That gives you a single place to record who did it and to notify people:

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

Listeners can then email the customer, alert your team and write an audit log entry. Protect the action itself as well. Only a small group of admins should be able to suspend accounts, ideally through a dedicated permission.

## Automatic suspension for failed payments

Suspending by hand is fine for abuse cases. For non-payment you'll usually want it automated:

1. The payment fails and your billing provider's webhook marks the account `past_due`.
2. The customer gets emails and an in-app banner, while access stays normal for a grace period.
3. When the grace period ends without a successful payment, a scheduled command suspends the account.
4. A successful payment webhook reactivates it immediately.

Wiring up subscriptions and webhooks is its own topic, covered in [adding Stripe billing to a Laravel SaaS](/blog/laravel-saas-stripe-billing.html). What matters here is that the webhook handler calls the same suspend and reactivate methods as your admin area. Two code paths that both change the status is how accounts end up in a state nobody can explain.

## Reactivation and retention

Reactivating should be as quick as suspending. Set the status back, clear `suspended_at`, and tell the customer. Nothing was deleted, so they pick up exactly where they left off.

Suspended accounts shouldn't hang around forever, though. Decide how long you keep data for a suspended or cancelled account, put that in your terms, warn the customer before the deadline, and then delete the tenant properly. Take a final backup first, as described in [backups for a multi-database Laravel SaaS](/blog/laravel-multi-database-backups.html). Dropping a tenant database can't be undone.

## Frequently asked questions

### What is the difference between suspending and deleting a SaaS account?

Suspension blocks access but keeps every record, so you can restore the account instantly. Deletion removes the data, and only a backup can bring it back. Suspend first, and delete only after your retention period.

### Should a suspended customer still be able to log in?

Usually yes, but only as far as the suspended page. Letting them sign in means you can show a clear message and, for unpaid invoices, a link to the billing page. The rest of the product stays off limits.

### Which HTTP status code should a suspended account return?

`403 Forbidden` is the most accurate choice. I'd avoid `503`, which tells browsers and monitoring tools your whole service is down.

### Do I need to log users out when I suspend their account?

Not if the check runs in middleware on every request. The next request after the status change shows the suspended page, whether the user already had a session or not.

## How SaaS Laravel handles suspension

If you'd rather not build this part yourself, the SaaS Laravel kits give every tenant a workspace status: Active, Trial, Pending Invitation or Suspended. A central admin sets it in the tenant edit form, with an optional status message of up to 500 characters. When a workspace is suspended, the `EnsureTenantIsNotSuspended` middleware renders a suspended page with the company name and the message, with HTTP 403, on every web request to that tenant's domains. Only logout still works. Setting the status back to Active or Trial restores access immediately. To be clear, suspension in the kits is manual. They don't include billing, so automatic suspension for failed payments is yours to add. The [maintenance and suspension](/docs/core/maintenance-and-suspension.html) docs have the details, and the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html) shows where this fits.

<BlogPostCta title="Workspace suspension, built in" text="SaaS Laravel includes workspace status, suspension with a custom message and tenant-wide maintenance mode, with database-per-tenant isolation in Vue, React or Svelte." />
