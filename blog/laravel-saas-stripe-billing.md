---
title: "Laravel Stripe Subscriptions for a SaaS"
description: "Add Laravel Stripe subscription billing to a multi-tenant SaaS with Cashier: bill the tenant, Checkout, webhooks, plan gating, the billing portal and tax."
pageClass: blog-page
date: 2026-09-29
author: erag
tags: [Billing, Stripe]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-saas-stripe-billing.html
  - - meta
    - property: og:title
      content: "Laravel Stripe Subscriptions for a SaaS"
  - - meta
    - property: og:description
      content: "Add Laravel Stripe subscription billing to a multi-tenant SaaS with Cashier: bill the tenant, Checkout, webhooks, plan gating, the billing portal and tax."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-saas-stripe-billing.html
  - - meta
    - name: twitter:title
      content: "Laravel Stripe Subscriptions for a SaaS"
  - - meta
    - name: twitter:description
      content: "Add Laravel Stripe subscription billing to a multi-tenant SaaS with Cashier: bill the tenant, Checkout, webhooks, plan gating, the billing portal and tax."
---

# Adding Stripe Billing to a Laravel SaaS: Subscriptions with Cashier

<BlogPostMeta />

Sooner or later every SaaS needs to charge money. A **Laravel Stripe subscription** setup is usually built with Laravel Cashier, the official package that wraps Stripe's billing API in a few readable methods. This guide shows how to add it to a multi-tenant app: who should pay, how to make the tenant billable, starting a subscription with Stripe Checkout, webhooks, gating features by plan and handling tax.

The examples use Cashier 16, Laravel 13, Inertia and stancl/tenancy, but most of it applies to any Laravel app.

## Who pays: the user or the tenant

Cashier's docs use the `User` model as the billable model. That works for single-user products, but in a B2B SaaS the customer is usually a company or workspace, not one person.

| Bill the user | Bill the tenant (workspace) |
| --- | --- |
| One subscription per person | One subscription per company |
| Breaks when the paying person leaves | Survives staff changes |
| Seats are awkward to count | Seats map to the tenant's users |
| Fine for personal tools | The usual choice for B2B SaaS |

Billing the tenant also has a practical benefit with database-per-tenant apps: the tenants table lives in the central database, so all billing data sits in one place and your webhook handler never has to switch into a tenant database.

## Install Laravel Cashier

Install the package and publish its migrations:

```bash
composer require laravel/cashier
php artisan vendor:publish --tag="cashier-migrations"
```

Then add your keys from the Stripe dashboard to `.env`: `STRIPE_KEY`, `STRIPE_SECRET` and `STRIPE_WEBHOOK_SECRET`. Set `CASHIER_CURRENCY` if you don't charge in US dollars. Use test mode keys until you launch.

## Make the tenant billable

Cashier's published migrations assume a `users` table. Because the tenant is the billable model, edit them before running `php artisan migrate`:

- In the customer columns migration, change `Schema::table('users', ...)` to `Schema::table('tenants', ...)`.
- In the subscriptions migration, rename `user_id` to `tenant_id`, including the index on it. Cashier finds the owner through the model's foreign key, which is `tenant_id` for a `Tenant` model.

Next, add the `Billable` trait to the tenant model. If you use stancl/tenancy, there is one trap: attributes that aren't listed in `getCustomColumns()` are stored in the `data` JSON column. Cashier looks tenants up with `where('stripe_id', ...)`, so its columns must be real columns:

```php
use Laravel\Cashier\Billable;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use Billable, HasDatabase, HasDomains;

    public static function getCustomColumns(): array
    {
        return [
            'id', 'email', 'company', // ...your existing columns
            'stripe_id', 'pm_type', 'pm_last_four', 'trial_ends_at',
        ];
    }
}
```

Also cast `trial_ends_at` to `datetime`, because Cashier compares it as a date. Cashier sends `name`, `email` and `phone` to Stripe when it creates the customer, so give the model a `name` accessor (the company name, for example) if it doesn't have one.

### Keep subscriptions in the central database

Inside a tenant request, stancl/tenancy switches the default database connection to the tenant's database. Queries through `$tenant->subscriptions()` follow the tenant model's central connection, but a direct `Subscription::query()` would hit the tenant database. Extend Cashier's models and pin them to the central connection:

```php
namespace App\Models;

use Laravel\Cashier\Subscription as CashierSubscription;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Subscription extends CashierSubscription
{
    use CentralConnection;
}
```

Do the same for `SubscriptionItem`, then register everything in `AppServiceProvider::boot()`:

```php
Cashier::useCustomerModel(Tenant::class);
Cashier::useSubscriptionModel(Subscription::class);
Cashier::useSubscriptionItemModel(SubscriptionItem::class);
```

## Start a Laravel Stripe subscription with Checkout

Stripe Checkout is a payment page hosted by Stripe. It handles card entry, 3D Secure, wallets and promotion codes, so you never touch card data. Create your products and prices in the Stripe dashboard and keep the price IDs in config.

Put the billing logic in a service so the controller stays thin:

```php
class BillingService
{
    public function checkoutUrl(Tenant $tenant, string $priceId): string
    {
        return $tenant->newSubscription('default', $priceId)
            ->trialDays(14)
            ->allowPromotionCodes()
            ->checkout([
                'success_url' => route('billing.show'),
                'cancel_url' => route('billing.show'),
            ])->url;
    }
}
```

With Inertia, a normal redirect to `checkout.stripe.com` won't work, because Inertia requests are XHR requests. Use `Inertia::location()`, which tells the client to do a full page visit:

```php
public function store(StartSubscriptionRequest $request, BillingService $billing): Response
{
    $url = $billing->checkoutUrl(tenant(), $request->validated('price'));

    return Inertia::location($url);
}
```

Validate the price in the Form Request against the list of prices you actually sell. Never pass a price ID from the browser straight to Stripe.

## Webhooks are the source of truth

When a customer pays, upgrades or cancels, Stripe tells your app through webhooks. Cashier ships a webhook controller at `/stripe/webhook` that keeps its `subscriptions` table up to date. Three things to set up:

1. **Create the endpoint.** Run `php artisan cashier:webhook` to register it in Stripe with the events Cashier needs, or add it in the dashboard. Point it at your central domain, not a tenant subdomain.
2. **Skip CSRF for it.** Stripe can't send a CSRF token:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->preventRequestForgery(except: ['stripe/*']);
})
```

3. **Set `STRIPE_WEBHOOK_SECRET`.** Cashier then verifies the signature of every incoming webhook.

To react to billing events yourself, listen for `Laravel\Cashier\Events\WebhookHandled`, which fires after Cashier has updated its tables, and check `$event->payload['type']`. This is where you email the owner about a failed payment or change a workspace status.

Locally, the Stripe CLI can forward webhooks to your machine with `stripe listen --forward-to` followed by your local webhook URL.

## Gate features by plan

Cashier's `subscribed()` returns `true` during a trial and during the grace period after a cancellation, so it's a good default check. A small middleware on your tenant routes keeps unpaid workspaces on the billing page:

```php
class EnsureTenantIsSubscribed
{
    public function handle(Request $request, Closure $next): Response
    {
        if (tenant()?->subscribed('default')) {
            return $next($request);
        }

        return redirect()->route('billing.show');
    }
}
```

Leave the billing page, logout and account settings outside this middleware, or users can never fix their payment. For plan-specific features, use `subscribedToPrice()` or `subscribedToProduct()`, and share the current plan as an Inertia prop so the frontend can hide what the plan doesn't include.

Decide early how you treat failed payments. By default a `past_due` subscription counts as inactive. `Cashier::keepPastDueSubscriptionsActive()` keeps access open while Stripe retries the card, and `hasIncompletePayment()` tells you when to show a "please update your card" banner.

## Plan changes, cancellations and the billing portal

| Task | Cashier method |
| --- | --- |
| Upgrade or downgrade | `$tenant->subscription('default')->swap($priceId)` |
| Cancel at period end | `->cancel()`, then check `onGracePeriod()` |
| Cancel immediately | `->cancelNow()` |
| Undo a cancellation | `->resume()` during the grace period |
| Change seat count | `->updateQuantity($seats)` |

You don't have to build screens for cards, invoices and cancellations. Stripe's customer portal covers them. `billingPortalUrl()` returns the URL, which you open with `Inertia::location()` just like Checkout. Restrict both routes to a tenant permission such as "Manage Billing", so only owners or admins can change the plan.

## Taxes and invoices

Whether you must charge VAT or sales tax depends on where you and your customers are. Stripe Tax can calculate it: call `Cashier::calculateTaxes()` in your service provider and use `collectTaxIds()` on the subscription builder so business customers can enter a VAT number at checkout. Stripe calculates and collects the tax, but as the seller you are still responsible for registering and filing. If you'd rather hand that off to a merchant of record, read [Stripe vs Paddle vs Lemon Squeezy for Laravel](/blog/stripe-vs-paddle-vs-lemon-squeezy-laravel.html).

## Frequently asked questions

### Does Laravel Cashier work with a Team or Tenant model instead of User?

Yes. Add the `Billable` trait to that model, call `Cashier::useCustomerModel()` in a service provider, and edit the published migrations so they target your table and use its foreign key, such as `tenant_id`.

### Should I use Stripe Checkout or build my own payment form?

Start with Checkout. It handles card authentication, wallets and promotion codes on a page Stripe maintains. Cashier also supports custom forms with Stripe Elements, but that means more frontend work and more edge cases to test.

### How do I give new tenants a trial without a credit card?

Set `trial_ends_at` on the tenant when you create it (with a `datetime` cast on the model). Cashier treats that as a generic trial, so `$tenant->onTrial()` returns `true` until the date passes and no subscription exists yet.

### What happens when a payment fails?

Stripe retries the charge based on your dashboard settings and sends webhooks along the way. Cashier updates the subscription status, and your app decides whether a `past_due` workspace keeps access while the customer updates their card.

## Adding billing to SaaS Laravel

SaaS Laravel does not include billing. The kits leave the payment provider to you, and the steps above are how you'd add Stripe. The tenant is a good billable model: `App\Models\Tenant` lives in the central `tenants` table and already has an `email` column and a `name` accessor that returns the company. It uses stancl's virtual columns, so add Cashier's columns to `getCustomColumns()`. Build billing as its own module in `Modules/`, following the [module-based architecture](/docs/core/architecture.html), and add a tenant permission for it in `config/permissions/tenant/`. The kit's [workspace status](/docs/core/multi-tenancy.html#workspace-status) (active, trial, pending, suspended) is set by hand today; a webhook listener could set it for you. For the bigger picture, see the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html) and the [SaaS launch checklist](/blog/laravel-saas-launch-checklist.html).

<BlogPostCta title="A tenant model ready for your billing" text="SaaS Laravel gives you database-per-tenant multi-tenancy, Fortify auth, roles and a modular Laravel 13 backend. Billing is not included, so you pick the provider." />
