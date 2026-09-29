---
title: "Repositories in Laravel: When They Help"
description: "An honest look at the Laravel repository pattern: when a repository earns its place, when it only adds noise, and lighter options like scopes and builders."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
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

Few architecture topics split Laravel developers like the **Laravel repository pattern**. Some teams put a repository and an interface in front of every model. Others call it pointless ceremony on top of Eloquent. Both camps are right about different situations.

This post explains what a repository is, why it's controversial in Laravel, the cases where it clearly helps, the cases where it only adds files, lighter alternatives to try first, and rules that keep a repository useful if you decide to write one.

## What the repository pattern is

A repository is a class that hides *how* data is fetched and stored behind methods that describe *what* you need. Instead of building a query in your controller or service, you call `$invoices->overdueForCustomer($customer)` and get results back.

In Laravel projects it usually shows up in one of two forms:

- **Interface plus implementation.** An `InvoiceRepositoryInterface` is bound to an `EloquentInvoiceRepository` in a service provider, and callers type-hint the interface.
- **A concrete class.** An `InvoiceRepository` with query methods, injected directly, with no interface.

The promise is that your business logic no longer depends on the database layer, so queries live in one place and could be swapped for another data source.

## Why the repository pattern is controversial in Laravel

The pattern comes from architectures where the domain objects know nothing about the database. Eloquent works the other way round. It's an Active Record ORM: every model already knows how to query and save itself, with a rich query builder, relationships, scopes and eager loading.

That creates three common problems:

1. **The abstraction leaks.** Most Eloquent repositories return Eloquent models or collections. Callers still use `$invoice->customer`, lazy loading and `save()`, so the database layer was never really hidden.
2. **The database swap never comes.** Very few apps replace MySQL or PostgreSQL with something that isn't SQL. An interface built for that day often never gets a second implementation.
3. **Wrappers add work without adding meaning.** The classic generic repository looks like this:

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

Every method is a thinner version of something Eloquent already does. You write an interface, an implementation and a binding, and in return you lose features like eager loading options and chunking, until you add them back one by one.

## When a repository helps

A repository earns its place when it holds real query knowledge that several parts of the app need. Good signs:

- **Complex listing queries.** An admin screen with free-text search across several columns and relations, status filters, sorting and pagination.
- **Reporting and statistics.** Counts per status, totals per month, dashboards that aggregate data.
- **Mapping to read models.** Queries that return Data objects or arrays shaped for a page rather than raw models.
- **Raw SQL or unusual queries** that you want in one tested place instead of scattered through services.
- **A non-Eloquent data source.** Data that comes from an external API or a search engine is where an interface really pays off, because you may actually have two implementations — a real one and a fake for tests.

Here's what a repository with real query knowledge looks like. It is a concrete class, it only reads, and it returns data shaped for the page:

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

The index controller, an export job and an API endpoint can all call `search()` and get the same results. The `InvoiceData` objects come from [spatie/laravel-data](/blog/laravel-data-objects.html), so the page receives exactly the fields it needs.

## When a repository hurts

Skip the repository when:

- It only wraps `find()`, `create()`, `update()` and `delete()`.
- Each query is used in exactly one place.
- Every repository gets an interface "just in case", with one implementation forever.
- The repository starts sending emails, dispatching jobs or running transactions. That's business logic, and it belongs in your [Laravel service layer](/blog/laravel-service-layer-pattern.html).
- You're building a small app or a prototype where the extra layer slows you down.

## Lighter alternatives to try first

Eloquent has built-in places for reusable query logic. They cover most of what people reach for repositories to do.

### Local scopes

A scope names a reusable constraint on the model itself. In recent Laravel versions you can mark a protected method with the `#[Scope]` attribute:

```php
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;

#[Scope]
protected function overdue(Builder $query): void
{
    $query->whereNull('paid_at')->where('due_at', '<', now());
}
```

Call it with `Invoice::query()->overdue()->get()`, and chain it with other constraints as usual.

### Custom Eloquent builders

When a model collects many scopes, move them into a dedicated builder class and register it with the `#[UseEloquentBuilder]` attribute on the model:

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

You keep everything Eloquent offers, and the query methods get their own file.

### Query classes

For a single complex query, such as a report, a small invokable class like `MonthlyRevenueQuery` does the job of a repository method without a whole repository around it.

## A quick decision guide

| Situation | Best fit |
| --- | --- |
| A constraint used in many queries (`active`, `overdue`) | Local scope |
| Many scopes on one model | Custom Eloquent builder |
| One complex report or export query | Query class |
| Listing screens with search, filters, stats and DTO mapping | Concrete repository |
| Data from an external API or search index | Interface plus implementations |
| Simple CRUD | Eloquent directly in the service |

## Rules for repositories that stay useful

If a repository is the right tool, these rules keep it from turning into the generic kind:

- **Name methods after questions.** `overdueForCustomer()` beats `findWhere(['status' => 'overdue'])`.
- **Mostly read.** Put writes, transactions and side effects in services.
- **Start concrete.** Add an interface when a second implementation actually exists.
- **Return finished results.** Return collections, paginators or Data objects — not a half-built query builder the caller keeps modifying.
- **Eager load inside.** The repository knows which relations its results need, so it should load them and avoid N+1 queries.
- **Test against a real database.** Repositories are about SQL, so a test with a real (test) database is more useful than mocks. See [testing a Laravel SaaS with Pest](/blog/laravel-saas-testing-pest.html).

## Frequently asked questions

### Does Laravel recommend the repository pattern?

No. Laravel's documentation doesn't use or require repositories. Eloquent models query and save themselves, and the framework's own tools — scopes, builders and relationships — are the default way to organise queries.

### Do I need an interface for every repository?

No. An interface is worth it when you have, or will soon have, more than one implementation, such as a live API client and a fake for tests. For an Eloquent-only repository, a concrete class is simpler and just as easy to inject.

### What is the difference between a repository and a service?

A repository answers questions about stored data: find, search, count. A service performs use cases: create an order, invite a user, cancel a subscription. A service may use a repository to read data, but not the other way round.

### Can I mix repositories and plain Eloquent in one project?

Yes, and it's often the most practical choice. Use a repository where queries are complex and shared, and plain Eloquent where they're simple. Consistency matters inside a feature, not across the whole app.

## How SaaS Laravel uses repositories

The SaaS Laravel kits take the selective approach. Only the `Tenant` module has repositories — `TenantRepository` and `DomainRepository` — and both are concrete classes without interfaces. They power the tenant and domain admin screens: search across several columns and relations, status and type filters, pagination, metric-card statistics and mapping to Data objects. Writes go through `TenantService` and `DomainService`, while simpler modules such as `User` and `RolePermission` query Eloquent directly in their services. See the [architecture documentation](/docs/core/architecture.html) and the [modular Laravel architecture guide](/blog/modular-laravel-architecture.html) for how these layers fit into each module.

<BlogPostCta title="Architecture without extra ceremony" text="SaaS Laravel uses services, Data objects and repositories only where they help, with multi-tenancy, authentication and permissions built in, in Vue, React or Svelte." />
