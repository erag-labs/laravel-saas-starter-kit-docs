---
title: "Laravel Stripe Subscriptions for a SaaS"
description: "Add Laravel Stripe subscription billing to a multi-tenant SaaS with Cashier: bill the tenant, Checkout, webhooks, plan gating, the billing portal and tax."
pageClass: blog-page
date: 2026-09-29
author: erag
category: saas
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

# Laravel Stripe Subscriptions for a SaaS: Billing the Tenant with Cashier

<BlogPostMeta />

At some point your SaaS has to start charging money, and in a multi-tenant app the first question isn't which API to call. It's who the customer actually is. We build a **Laravel Stripe subscription** setup with Laravel Cashier, the official package that wraps Stripe's billing API in a handful of readable methods. Below we walk through the parts that matter in a multi-tenant app: deciding who pays, making the tenant billable, starting a subscription with Stripe Checkout, handling webhooks, gating features by plan and dealing with tax.

Our examples use Cashier 16, Laravel 13, Inertia and stancl/tenancy. Most of it carries over to any Laravel app.

## Who pays: the user or the tenant

Cashier's docs use the `User` model as the billable model. That's fine for a single-user product. In a B2B SaaS, though, the customer is usually a company or workspace, not one person.

| Bill the user | Bill the tenant (workspace) |
| --- | --- |
| One subscription per person | One subscription per company |
| Breaks when the paying person leaves | Survives staff changes |
| Seats are awkward to count | Seats map to the tenant's users |
| Fine for personal tools | The usual choice for B2B SaaS |

We bill the tenant. With database-per-tenant apps there's a practical bonus too: the tenants table lives in the central database, so all billing data sits in one place and the webhook handler never has to switch into a tenant database.

## Install Laravel Cashier

Install the package and publish its migrations:

```bash
composer require laravel/cashier
php artisan vendor:publish --tag="cashier-migrations"
```

Next, copy your keys from the Stripe dashboard into `.env`: `STRIPE_KEY`, `STRIPE_SECRET` and `STRIPE_WEBHOOK_SECRET`. If you don't charge in US dollars, set `CASHIER_CURRENCY` as well. Stick to test mode keys until launch.

## Make the tenant billable

The migrations Cashier publishes assume a `users` table. Since the tenant is our billable model, we edit them before running `php artisan migrate`. In the customer columns migration, `Schema::table('users', ...)` becomes `Schema::table('tenants', ...)`. In the subscriptions migration, `user_id` becomes `tenant_id`, and the index on it changes too. Cashier finds the owner through the model's foreign key, and for a `Tenant` model that's `tenant_id`.

Then add the `Billable` trait to the tenant model. With stancl/tenancy there's one trap to watch for. Any attribute not listed in `getCustomColumns()` gets stored in the `data` JSON column, and Cashier looks tenants up with `where('stripe_id', ...)`. **Cashier's columns have to be real columns:**

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

Cast `trial_ends_at` to `datetime` while you're there, because Cashier compares it as a date. When Cashier creates the Stripe customer it sends `name`, `email` and `phone`, so if the model has no `name` accessor yet, add one (returning the company name, for example).

### Keep subscriptions in the central database

During a tenant request, stancl/tenancy switches the default database connection to the tenant's database. Queries through `$tenant->subscriptions()` use the tenant model's central connection, which is what you want. A direct `Subscription::query()`, on the other hand, would hit the tenant database. We extend Cashier's models and pin them to the central connection:

```php
namespace App\Models;

use Laravel\Cashier\Subscription as CashierSubscription;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Subscription extends CashierSubscription
{
    use CentralConnection;
}
```

`SubscriptionItem` gets the same treatment. After that, register all three in `AppServiceProvider::boot()`:

```php
Cashier::useCustomerModel(Tenant::class);
Cashier::useSubscriptionModel(Subscription::class);
Cashier::useSubscriptionItemModel(SubscriptionItem::class);
```

## Start a Laravel Stripe subscription with Checkout

Stripe Checkout is a payment page that Stripe hosts. Card entry, 3D Secure, wallets and promotion codes all happen there, and your app never touches card data. Create your products and prices in the Stripe dashboard and keep the price IDs in config.

We keep the billing logic in a service so the controller stays thin:

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

Inertia requests are XHR requests, so a plain redirect to `checkout.stripe.com` won't work. `Inertia::location()` tells the client to do a full page visit instead:

```php
public function store(StartSubscriptionRequest $request, BillingService $billing): Response
{
    $url = $billing->checkoutUrl(tenant(), $request->validated('price'));

    return Inertia::location($url);
}
```

In the Form Request, validate the price against the prices you actually sell. **Never pass a price ID from the browser straight to Stripe.**

## Stripe webhooks keep Cashier in sync

Whenever a customer pays, upgrades or cancels, Stripe tells your app through a webhook. Cashier ships a webhook controller at `/stripe/webhook` that keeps its `subscriptions` table current, and that table is what the rest of your app should trust.

First, create the endpoint. `php artisan cashier:webhook` registers it in Stripe with the events Cashier needs, or you can add it by hand in the dashboard. Either way, point it at your central domain, not a tenant subdomain.

Second, exclude it from CSRF protection, since Stripe can't send a CSRF token:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->preventRequestForgery(except: ['stripe/*']);
})
```

Finally, set `STRIPE_WEBHOOK_SECRET`. With it in place, Cashier verifies the signature of every incoming webhook.

To react to billing events in your own code, listen for `Laravel\Cashier\Events\WebhookHandled`. It fires after Cashier has updated its tables, and `$event->payload['type']` tells you which event came in. That's the place to email the owner about a failed payment or change a workspace status.

On your own machine, the Stripe CLI can forward webhooks with `stripe listen --forward-to` followed by your local webhook URL.

## Gate features by plan

Cashier's `subscribed()` returns `true` during a trial and during the grace period after a cancellation, which makes it a sensible default check. We put a small middleware on the tenant routes to keep unpaid workspaces on the billing page:

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

Keep the billing page, logout and account settings outside this middleware. Otherwise users have no way to fix their payment. For features tied to a specific plan, use `subscribedToPrice()` or `subscribedToProduct()`, and share the current plan as an Inertia prop so the frontend can hide what the plan doesn't include.

It pays to decide early how failed payments behave. By default a `past_due` subscription counts as inactive. `Cashier::keepPastDueSubscriptionsActive()` keeps access open while Stripe retries the card, and `hasIncompletePayment()` tells you when to show a "please update your card" banner. We lean towards keeping access open during retries, since locking a paying team out over an expired card is a rough experience.

## Plan changes, cancellations and the billing portal

| Task | Cashier method |
| --- | --- |
| Upgrade or downgrade | `$tenant->subscription('default')->swap($priceId)` |
| Cancel at period end | `->cancel()`, then check `onGracePeriod()` |
| Cancel immediately | `->cancelNow()` |
| Undo a cancellation | `->resume()` during the grace period |
| Change seat count | `->updateQuantity($seats)` |

You don't need to build your own screens for cards, invoices and cancellations, because Stripe's customer portal handles them. `billingPortalUrl()` gives you the URL, and you open it with `Inertia::location()` exactly like Checkout. Put both routes behind a tenant permission such as "Manage Billing" so that only owners or admins can change the plan.

## Taxes and invoices

Your VAT or sales tax obligations depend on where you and your customers are based. Stripe Tax can do the calculation: call `Cashier::calculateTaxes()` in your service provider, and add `collectTaxIds()` to the subscription builder so business customers can enter a VAT number at checkout. Stripe calculates and collects the tax. Registering and filing are still your job as the seller. If you'd rather hand that off to a merchant of record, our comparison of [Stripe, Paddle and Lemon Squeezy for Laravel](/blog/stripe-vs-paddle-vs-lemon-squeezy-laravel.html) covers the options.

## Frequently asked questions

### Does Laravel Cashier work with a Team or Tenant model instead of User?

Yes. Add the `Billable` trait to that model, call `Cashier::useCustomerModel()` in a service provider, and edit the published migrations so they point at your table and use its foreign key, such as `tenant_id`.

### Should I use Stripe Checkout or build my own payment form?

We'd start with Checkout. It handles card authentication, wallets and promotion codes on a page Stripe maintains for you. Cashier does support custom forms with Stripe Elements, but that's more frontend work and more edge cases to test.

### How do I give new tenants a trial without a credit card?

Set `trial_ends_at` on the tenant when you create it, with a `datetime` cast on the model. Cashier treats this as a generic trial: `$tenant->onTrial()` returns `true` until the date passes, and no subscription has to exist yet.

### What happens when a payment fails?

Stripe retries the charge according to your dashboard settings and sends webhooks as it goes. Cashier updates the subscription status. It's up to your app whether a `past_due` workspace keeps access while the customer updates their card.

## Adding billing to SaaS Laravel

SaaS Laravel doesn't include billing. We leave the payment provider to you, and the steps above are how you'd add Stripe. The tenant makes a good billable model: `App\Models\Tenant` lives in the central `tenants` table and already has an `email` column and a `name` accessor that returns the company. It uses stancl's virtual columns, so remember to add Cashier's columns to `getCustomColumns()`. We'd build billing as its own module in `Modules/`, following the [module-based architecture](/docs/core/architecture.html), with a tenant permission for it in `config/permissions/tenant/`. The kit's [workspace status](/docs/core/multi-tenancy.html#workspace-status) (active, trial, pending, suspended) is set by hand today, and a webhook listener could set it for you. For the wider view, see the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html) and the [SaaS launch checklist](/blog/laravel-saas-launch-checklist.html).

<BlogPostCta title="A tenant model ready for your billing" text="SaaS Laravel gives you database-per-tenant multi-tenancy, Fortify auth, roles and a modular Laravel 13 backend. Billing is not included, so you pick the provider." />
