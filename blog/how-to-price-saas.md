---
title: "SaaS Pricing: How to Price Your SaaS Product"
description: "A practical SaaS pricing guide for developers: value metrics, pricing models, tiers, trials vs freemium, annual plans, and how to turn plans into code."
pageClass: blog-page
date: 2026-09-29
author: erag
category: saas
tags: [SaaS, Pricing]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/how-to-price-saas.html
  - - meta
    - property: og:title
      content: "SaaS Pricing: How to Price Your SaaS Product"
  - - meta
    - property: og:description
      content: "A practical SaaS pricing guide for developers: value metrics, pricing models, tiers, trials vs freemium, annual plans, and how to turn plans into code."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/how-to-price-saas.html
  - - meta
    - name: twitter:title
      content: "SaaS Pricing: How to Price Your SaaS Product"
  - - meta
    - name: twitter:description
      content: "A practical SaaS pricing guide for developers: value metrics, pricing models, tiers, trials vs freemium, annual plans, and how to turn plans into code."
---

# How to Price Your SaaS: A Practical SaaS Pricing Guide for Developers

<BlogPostMeta />

Most developers leave pricing until the very end and then pick a number that feels safe. That's a shame, because SaaS pricing decides who signs up, how much support you'll carry, how fast you grow and even what you end up building. Below we go through the decisions roughly in the order you'll face them: what to charge for, which model to use, how to set up tiers, trials and annual plans, and finally how to get your plans into code.

You won't find magic numbers here. Good prices come from talking to your customers, not from averages in a blog post.

## Start from value, not from cost

Any price sits somewhere between three reference points:

| Reference point | Question | Role |
| --- | --- | --- |
| Your costs | What does one customer cost you in hosting, support and payment fees? | The floor. Never price below it. |
| Alternatives | What does the customer use today: a spreadsheet, a competitor, an employee's time? | The anchor customers compare you to. |
| Value | How much time, money or risk does your product save them? | The ceiling. You capture a share of it. |

First-time founders usually price close to the floor. Hosting a small Laravel app is cheap, so the cost floor starts to look like the answer. It isn't. Customers don't pay for your server bill, they pay for the problem you make go away. If the product saves a team several hours a week, the price should reflect those hours rather than your hosting invoice.

So how do you find the value? Ask potential customers what they do today and what it costs them. Those answers will tell you more than any pricing formula.

## Choose a value metric

The value metric is the unit you charge for. Ideally it grows as the customer gets more out of the product, so your revenue grows alongside them.

| Value metric | Good fit | Watch out for |
| --- | --- | --- |
| Per seat (user) | Collaboration tools where each user gets value | Customers share logins to save money |
| Per workspace or account | B2B tools where the company is the customer | Large and small customers pay the same |
| Usage (records, API calls, emails) | Products where value follows volume | Unpredictable bills scare some buyers |
| Flat fee | Simple tools with one type of customer | Leaves money on the table as customers grow |
| Feature tiers | Products with clear basic and advanced use | Tiers that feel arbitrary annoy people |

A good metric is easy to understand and easy to predict, and it's tied to something the customer actually cares about. Plenty of B2B products combine two: a price per workspace that includes some seats, plus a charge for each extra seat.

## Pick a SaaS pricing model

Once the metric is settled, the model mostly follows from it.

A flat rate means one plan and one price. It's the easiest thing to explain, but it doesn't grow with large customers. Tiered pricing gives you a few plans with rising limits and features, and it's the most common model for B2B SaaS. Per-seat pricing multiplies the price by the number of users, so it scales with team size. Usage-based pricing charges for what people use: fair, but harder for both sides to forecast. And a hybrid combines a base tier with usage or seat add-ons, which is flexible but more work to build and to explain.

If you're not sure, we'd start with tiers. People understand them, you can change them easily, and every payment provider supports them.

## Designing your pricing tiers

Three tiers is a common starting point: one for individuals or small teams, one for growing teams, one for larger organisations.

Name them after the customer, not after metals. "Starter", "Team" and "Business" tell people where they fit in a way "Silver" never will. Then make the middle tier the obvious pick for your ideal customer, and say so on the page.

Separate tiers by limits and advanced features rather than by taking away the basics, because every plan should feel usable on its own. The things large customers need (single sign-on, audit logs, priority support, custom contracts) belong in the top tier. You might also add a "Contact us" tier for customers who need invoices, security reviews or custom terms.

Finally, keep the number of limits small. Two or three clear ones beat a long feature matrix that nobody reads.

## Free trial, freemium or neither

| Option | How it works | Best for |
| --- | --- | --- |
| Free trial | Full access for a limited time | Products that show value within days |
| Trial with card up front | Same, but payment details are collected at signup | Fewer but more serious signups |
| Freemium | A free plan with limits, forever | Products that spread through users inviting others |
| No free option, money-back guarantee | Pay first, refund if unhappy | Niche B2B tools with high-intent buyers |
| Demo or pilot | Sales-led onboarding | Expensive, complex products |

Freemium isn't free for you. Free users still take support time and hosting, and you need a clear reason for them to upgrade. For a small team we'd usually pick a time-limited trial; it's simpler to run.

Whichever you choose, make sure new users hit their first useful result well before the trial ends. A trial that runs out before people see the value converts badly at any price.

## Monthly and annual billing

Offering both is standard. Annual plans give you cash up front and lower churn, and customers get a discount for committing. "Two months free" is a common way to frame it, but pick a discount you can actually afford.

If your buyers are small teams trying things out, show monthly prices by default and highlight the annual saving. Larger customers often prefer annual invoices anyway, since that's what their finance team wants.

## What belongs on your pricing page

The pricing page is where people make up their minds, so don't make them work for it. Show prices openly unless a tier really is custom, and say which currency they're in and whether tax is included. List the two or three limits that matter instead of every feature.

A short FAQ can deal with the usual objections: cancellation, data export, what happens when the trial ends, refunds. Explain what happens when a customer hits a limit, too. Surprise lockouts turn into angry support tickets.

And keep the pricing page, the checkout and the invoices consistent. Mismatched numbers destroy trust fast.

## Don't underprice

Low prices feel safe, but they cause their own problems. You end up with too little margin to pay for support and improvements. You also attract the wrong customers, since price-sensitive buyers often need the most help and churn the fastest. Business buyers may not take a very cheap tool seriously in the first place. And once a price is set, it's hard to raise, because existing customers notice every increase.

It's much easier to offer a launch discount than to fix a price that was too low from day one.

## Changing prices later

Pricing isn't set in stone, and you should expect to revisit it as you learn.

When you do, try new prices on new customers first and let existing customers stay on their current plan. Grandfather them for at least a while, and give plenty of notice before any increase. It helps to explain why: new features or better support make an increase easier to accept. Then watch what happens to signups, upgrades and churn before and after.

## Turn plans into code

Keep plan rules in one place rather than scattered across controllers. A config file that maps each plan to its payment price, limits and features works well:

```php
// config/plans.php
return [
    'team' => [
        'price' => env('PRICE_TEAM_MONTHLY'),
        'limits' => ['users' => 10, 'projects' => 50],
        'features' => ['exports' => true, 'audit_log' => false],
    ],
    // starter, business...
];
```

Check limits in a service, and share the current plan and its limits with the frontend so it can show an upgrade prompt instead of an error. For the payment side, including subscriptions and webhooks, see [adding Stripe billing to a Laravel SaaS](/blog/laravel-saas-stripe-billing.html). If you haven't picked a provider yet, read our [Stripe vs Paddle vs Lemon Squeezy comparison](/blog/stripe-vs-paddle-vs-lemon-squeezy-laravel.html) first, because some providers handle sales tax for you as well.

## Frequently asked questions

### How much should I charge for my SaaS?

Enough to cover your costs with room to spare, anchored to the value you create and to what customers use today. Ask potential customers what the problem costs them right now. That tells you more than competitor prices.

### Should I show prices publicly?

For self-serve products, yes. Hidden prices add friction, and some buyers will leave rather than ask. Save "Contact us" for custom or enterprise tiers where the price genuinely depends on the customer.

### Is per-user pricing a good idea for B2B SaaS?

It works well when every user gets value, as in collaboration tools. If only a handful of people use the product but the whole company benefits, per-workspace or usage pricing usually fits better.

### How often should I change my SaaS pricing?

Whenever you learn something important: after launch, after shipping major features, or when customers keep asking for a plan you don't offer. Change it carefully, test on new customers first, and treat existing customers fairly.

## Pricing and SaaS Laravel

To be clear, SaaS Laravel doesn't include billing, plans or usage limits, so it doesn't decide your pricing model for you. In the kit, each customer is a tenant with its own database, and the central `App\Models\Tenant` model is a natural place to store the current plan. Permissions are already config-driven through `config/permissions/`, and a `config/plans.php` file fits the same style. See [multi-tenancy in the docs](/docs/core/multi-tenancy.html) for how tenants are stored, the [SaaS launch checklist](/blog/laravel-saas-launch-checklist.html) for everything else to prepare, and the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html) for what the kits include.

<BlogPostCta title="Spend your time on pricing, not plumbing" text="SaaS Laravel includes database-per-tenant multi-tenancy, Fortify auth, roles and permissions and 17 languages, so you can focus on your product and pricing." />
