---
title: "Repositories in Laravel: When They Help"
description: "An honest look at the Laravel repository pattern: when a repository earns its place, when it only adds noise, and lighter options like scopes and builders."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: architecture
tags: [Architecture, Code quality]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-repository-pattern.html
  - - meta
    - property: og:title
      content: "Repositories in Laravel: When They Help"
  - - meta
    - property: og:description
      content: "An honest look at the Laravel repository pattern: when a repository earns its place, when it only adds noise, and lighter options like scopes and builders."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-repository-pattern.html
  - - meta
    - name: twitter:title
      content: "Repositories in Laravel: When They Help"
  - - meta
    - name: twitter:description
      content: "An honest look at the Laravel repository pattern: when a repository earns its place, when it only adds noise, and lighter options like scopes and builders."
---

# The Laravel Repository Pattern: When It Helps and When It Hurts

<BlogPostMeta />

Ask a room of Laravel developers about the Laravel repository pattern and you'll get two very confident, very different answers. Some teams put a repository and an interface in front of every model. Others see it as pointless ceremony on top of Eloquent. Honestly, both camps are right, just about different situations.

So instead of picking a side, I want to help you tell those situations apart. We'll look at what a repository actually is, why it's controversial in Laravel, where it clearly helps, where it only adds files, some lighter alternatives worth trying first, and a few rules that keep a repository useful if you do write one.

## What the repository pattern is

A repository is a class that hides *how* data is fetched and stored behind methods that describe *what* you need. Rather than building a query in your controller or service, you call `$invoices->overdueForCustomer($customer)` and get results back.

In Laravel projects you'll usually see it in one of two shapes. The first is an interface plus an implementation: an `InvoiceRepositoryInterface` is bound to an `EloquentInvoiceRepository` in a service provider, and callers type-hint the interface. The second is simpler, a concrete `InvoiceRepository` class with query methods that you inject directly, with no interface at all.

Either way, the promise is the same. Your business logic stops depending on the database layer, queries live in one place, and in theory you could swap in another data source later.

## Why the Laravel repository pattern is controversial

If you're wondering where the friction comes from, it's the pattern's origins. It comes from architectures where domain objects know nothing about the database. Eloquent works the opposite way. It's an Active Record ORM, so every model already knows how to query and save itself, with a rich query builder, relationships, scopes and eager loading built in.

Put a repository on top of that and a few problems tend to show up.

The abstraction leaks. Most Eloquent repositories return Eloquent models or collections, and callers go on using `$invoice->customer`, lazy loading and `save()`. The database layer was never really hidden.

The database swap you planned for rarely happens. Very few apps replace MySQL or PostgreSQL with something that isn't SQL, so an interface built for that day often never gets a second implementation.

And generic wrappers add work without adding meaning. This is the classic version:

```php
interface UserRepositoryInterface
{
    public function all(): Collection;
    public function find(int $id): ?User;
    public function create(array $data): User;
    public function update(int $id, array $data): User;
    public function delete(int $id): bool;
}
```

Look at each method and you'll see a thinner version of something Eloquent already does. You write an interface, an implementation and a binding, and what you get in return is fewer features. Eager loading options and chunking disappear until you add them back one at a time.

## When a repository helps

A repository earns its place when it holds real query knowledge that several parts of the app need. Complex listing queries are the clearest example: think of an admin screen with free-text search across several columns and relations, status filters, sorting and pagination. Reporting is another, whether that's counts per status, totals per month or dashboards that aggregate data.

It also helps when you're mapping to read models, meaning queries that return Data objects or arrays shaped for a page instead of raw models. Raw SQL and unusual queries belong here too, so they sit in one tested place rather than scattered across services.

The strongest case is a **non-Eloquent data source**. When data comes from an external API or a search engine, an interface really pays off, because you may genuinely have two implementations: the real one and a fake for tests.

Here's what a repository with real query knowledge looks like. Notice that it's a concrete class, it only reads, and it returns data shaped for the page:

```php
class InvoiceRepository
{
    public function search(?string $term, string $status = 'all', int $perPage = 15): LengthAwarePaginator
    {
        return Invoice::query()
            ->with('customer')
            ->when($term, fn ($q) => $q->where(fn ($q) => $q
                ->where('number', 'like', "%{$term}%")
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$term}%"))))
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->latest('id')
            ->paginate($perPage)
            ->through(fn (Invoice $invoice) => InvoiceData::from($invoice));
    }
}
```

Now the index controller, an export job and an API endpoint can all call `search()` and get identical results. The `InvoiceData` objects come from [spatie/laravel-data](/blog/laravel-data-objects.html), so the page receives exactly the fields it needs and nothing more.

## When a repository hurts

On the other side, I'd skip the repository if all it does is wrap `find()`, `create()`, `update()` and `delete()`, or if each query is only ever used in one place. The same goes for giving every repository an interface "just in case" when it will have one implementation forever.

Watch out, too, for a repository that starts sending emails, dispatching jobs or running transactions. That's business logic, and it belongs in your [Laravel service layer](/blog/laravel-service-layer-pattern.html). And if you're building a small app or a prototype, the extra layer mostly slows you down.

## Lighter alternatives to try first

Before creating a repository, it's worth knowing that Eloquent already has built-in homes for reusable query logic. They cover most of what people reach for repositories to do.

### Local scopes

A scope gives a name to a reusable constraint, right on the model. In recent Laravel versions you can mark a protected method with the `#[Scope]` attribute:

```php
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;

#[Scope]
protected function overdue(Builder $query): void
{
    $query->whereNull('paid_at')->where('due_at', '<', now());
}
```

You call it with `Invoice::query()->overdue()->get()`, and it chains with other constraints as usual.

### Custom Eloquent builders

Once a model collects lots of scopes, you can move them into a dedicated builder class and register it with the `#[UseEloquentBuilder]` attribute on the model:

```php
#[UseEloquentBuilder(InvoiceBuilder::class)]
class Invoice extends Model {}

class InvoiceBuilder extends Builder
{
    public function overdue(): static
    {
        return $this->whereNull('paid_at')->where('due_at', '<', now());
    }
}
```

This keeps everything Eloquent offers while giving the query methods their own file.

### Query classes

Sometimes you only have one complex query, like a report. A small invokable class such as `MonthlyRevenueQuery` does the job of a repository method without a whole repository around it.

## A quick decision guide

If you just want the short version, this table maps each situation to the tool I'd use:

| Situation | Best fit |
| --- | --- |
| A constraint used in many queries (`active`, `overdue`) | Local scope |
| Many scopes on one model | Custom Eloquent builder |
| One complex report or export query | Query class |
| Listing screens with search, filters, stats and DTO mapping | Concrete repository |
| Data from an external API or search index | Interface plus implementations |
| Simple CRUD | Eloquent directly in the service |

## Rules for repositories that stay useful

If you've decided a repository is the right tool, a few habits stop it from drifting into the generic kind.

Name methods after questions. `overdueForCustomer()` tells you far more than `findWhere(['status' => 'overdue'])`. Keep the repository mostly about reading, and leave writes, transactions and side effects to services.

**Start concrete.** Only add an interface when a second implementation actually exists. When you return results, return finished ones: collections, paginators or Data objects, not a half-built query builder the caller keeps modifying. And eager load inside the repository, since it knows which relations its results need and can avoid N+1 queries.

Finally, test repositories against a real (test) database rather than mocks. Repositories are about SQL, so mocking the SQL away doesn't tell you much. There's more on that in [testing a Laravel SaaS with Pest](/blog/laravel-saas-testing-pest.html).

## Frequently asked questions

### Does Laravel recommend the repository pattern?

No. Laravel's documentation doesn't use or require repositories. Eloquent models query and save themselves, and the framework's own tools (scopes, builders and relationships) are the default way to organise queries.

### Do I need an interface for every repository?

No. An interface is worth it when you have, or will soon have, more than one implementation, like a live API client and a fake for tests. For a repository that only uses Eloquent, a concrete class is simpler and just as easy to inject.

### What is the difference between a repository and a service?

A repository answers questions about stored data: find, search, count. A service carries out use cases: create an order, invite a user, cancel a subscription. A service can use a repository to read data, but it shouldn't work the other way round.

### Can I mix repositories and plain Eloquent in one project?

Yes, and it's often the most practical choice. Use a repository where queries are complex and shared, and plain Eloquent where they're simple. What matters is being consistent inside a feature, not across the whole app.

## How SaaS Laravel uses repositories

The SaaS Laravel kits take the selective approach described here. Only the `Tenant` module has repositories, `TenantRepository` and `DomainRepository`, and both are concrete classes with no interfaces. They power the tenant and domain admin screens: search across several columns and relations, status and type filters, pagination, metric-card statistics and mapping to Data objects. Writes go through `TenantService` and `DomainService`, while simpler modules such as `User` and `RolePermission` query Eloquent directly in their services. The [architecture documentation](/docs/core/architecture.html) and the [modular Laravel architecture guide](/blog/modular-laravel-architecture.html) show how these layers fit into each module.

<BlogPostCta title="Architecture without extra ceremony" text="SaaS Laravel uses services, Data objects and repositories only where they help, with multi-tenancy, authentication and permissions built in, in Vue, React or Svelte." />
