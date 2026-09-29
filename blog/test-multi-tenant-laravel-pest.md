---
title: "Testing Multi-Tenant Laravel Apps with Pest"
description: "How to test Laravel tenancy with Pest: test database setup, creating tenants, isolation tests, tenant domains, fakes, cache and files, and faster test runs."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: multi-tenancy
tags: [Multi-tenancy, Testing]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/test-multi-tenant-laravel-pest.html
  - - meta
    - property: og:title
      content: "Testing Multi-Tenant Laravel Apps with Pest"
  - - meta
    - property: og:description
      content: "How to test Laravel tenancy with Pest: test database setup, creating tenants, isolation tests, tenant domains, fakes, cache and files, and faster test runs."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/test-multi-tenant-laravel-pest.html
  - - meta
    - name: twitter:title
      content: "Testing Multi-Tenant Laravel Apps with Pest"
  - - meta
    - name: twitter:description
      content: "How to test Laravel tenancy with Pest: test database setup, creating tenants, isolation tests, tenant domains, fakes, cache and files, and faster test runs."
---

# How to Test Laravel Tenancy with Pest: Tenants, Domains and Isolation

<BlogPostMeta />

In a multi-tenant app, the bug that hurts most is one customer seeing another customer's data. And a normal test suite doesn't go looking for it. So when you set out to test Laravel tenancy with Pest, the goal is a little different from usual: you're not only checking that features work, you're proving that tenants stay apart.

I'll go through it in order: setting up the test database, creating tenants in tests, proving isolation, testing requests on tenant domains, and the fakes that start behaving differently once tenancy is involved.

The examples use Pest with `pestphp/pest-plugin-laravel` and [stancl/tenancy](https://tenancyforlaravel.com) version 3 with a database per tenant. If you haven't set tenancy up yet, [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html) covers that. For general SaaS testing (factories, auth, permissions), see [Testing a Laravel SaaS with Pest](/blog/laravel-saas-testing-pest.html).

## What to test in a multi-tenant app

You don't need to run every test inside a tenant. Put your effort where tenancy actually changes behaviour:

| Area | What to prove |
| --- | --- |
| Identification | A tenant host initializes the right tenant; an unknown host returns 404 |
| Isolation | Data created in tenant A is not visible in tenant B |
| Central vs tenant | Central pages are blocked on tenant hosts and the other way round |
| Authentication | Tenant users cannot sign in centrally, or on another tenant |
| Tenant lifecycle | Creating a tenant creates its database, runs migrations and seeds it |
| Background work | Queued jobs run in the tenant they were dispatched from |
| Cache and files | Tenant cache entries and files do not collide |

Everything else, like validation rules or a service's calculations, can be tested once, in whichever context is simplest.

## Setting up the test database

Database-per-tenant tests create real databases, and that rules out a couple of the usual shortcuts. stancl's documentation notes that with multi-database tenancy you can't use in-memory SQLite databases or the `RefreshDatabase` trait. If you're wondering why, it's because tenancy switches the default database connection in the middle of the test.

| Approach | Central database | Tenant databases | Trade-off |
| --- | --- | --- | --- |
| SQLite files | A file such as `database/testing.sqlite` | One file per tenant in `database/` | Fast, no server needed |
| A test MySQL or PostgreSQL server | A dedicated test database | Created by the tenancy pipeline | Matches production, slower |

Whichever you choose, use `DatabaseMigrations` for tenant tests and **delete every tenant after each test**. Deleting a tenant fires `TenantDeleted`, and the `DeleteDatabase` job in stancl's default `TenancyServiceProvider` then removes the tenant's database or file.

I'd also give test tenants their own database prefix, so a test run can never touch a development tenant that happens to have the same ID:

```php
// tests/TestCase.php
protected function setUp(): void
{
    parent::setUp();

    config(['tenancy.database.prefix' => 'test_tenant_']);
}
```

On SQLite, set `tenancy.database.suffix` to `.sqlite` as well. That way tenant files match the usual `*.sqlite` rule in `database/.gitignore` if a crashed run ever leaves one behind.

## Organising Pest for central and tenant tests

It helps to split tests into folders and give each folder its own setup in `tests/Pest.php`. Pest lets you attach hooks per folder:

```php
pest()->extend(TestCase::class)
    ->use(DatabaseMigrations::class)
    ->afterEach(function () {
        tenancy()->end();
        Tenant::all()->each->delete();
    })
    ->in('Feature/Tenant');

pest()->extend(TestCase::class)
    ->use(DatabaseMigrations::class)
    ->in('Feature/Central');
```

Next, add a small helper that creates a tenant with a domain. Creating the tenant triggers your `TenantCreated` pipeline, so the database gets created, migrated and seeded exactly as it would be in production:

```php
function createTenant(string $subdomain = 'acme'): Tenant
{
    $tenant = Tenant::create();
    $tenant->domains()->create(['domain' => "{$subdomain}.your-saas.test"]);

    return $tenant;
}
```

Does your app create tenants through a service class, with a first admin, default roles and so on? Then call that service here instead, so your tests cover the real flow.

## Test Laravel tenancy isolation with two tenants

The most valuable tenancy test is also one of the shortest. Create data in one tenant, then prove another tenant can't see it:

```php
it('keeps projects separate per tenant', function () {
    $acme = createTenant('acme');
    $globex = createTenant('globex');

    $acme->run(fn () => Project::factory()->create(['name' => 'Rocket']));

    $globex->run(function () {
        expect(Project::where('name', 'Rocket')->exists())->toBeFalse();
    });
});
```

`$tenant->run()` initializes the tenant, runs the callback and then restores the previous context, so the test finishes where it started. When a whole test should run inside one tenant, use `tenancy()->initialize($tenant)` instead and let the `afterEach` hook end tenancy.

I'd write the same pair for every table that holds customer data and is reached in an unusual way: raw queries, a second connection, a reporting view or an export job.

## Testing requests on tenant domains

Feature tests can call a full URL. Laravel sets the request host from it, so your identification middleware sees the tenant domain just as it would in a browser:

```php
it('shows the dashboard on a tenant domain', function () {
    $tenant = createTenant('acme');
    $user = $tenant->run(fn () => User::factory()->create());

    $this->actingAs($user, 'tenant')
        ->get('http://acme.your-saas.test/dashboard')
        ->assertOk();
});
```

If tenant users have their own guard, pass its name to `actingAs()`. Notice that the user is created inside the tenant, so it exists in the tenant database and not the central one.

Two negative tests catch most routing mistakes:

```php
it('returns 404 for an unknown tenant', function () {
    $this->get('http://nobody.your-saas.test/login')->assertNotFound();
});

it('blocks central pages on tenant hosts', function () {
    createTenant('acme');

    $this->get('http://acme.your-saas.test/admin/tenants')->assertNotFound();
});
```

The status you expect depends on how you handle a missing tenant. The 404 above assumes you render `TenantCouldNotBeIdentifiedException` as a 404 in `bootstrap/app.php`.

## Fakes that behave differently with tenancy

Laravel's fakes are easy to reach for without thinking, and with tenancy a few of them quietly change what your test proves. Let's take them one at a time.

### Events

stancl/tenancy is built on events. Creating a tenant, creating its database and initializing tenancy all fire them. A bare `Event::fake()` stops that whole chain, which means no database is created and tenancy never starts. Fake only the events you actually assert on:

```php
Event::fake([InvoicePaid::class]);
```

### Queues

With `Queue::fake()`, jobs are recorded but never serialized, and the queue bootstrapper doesn't add the tenant key to the payload. So `assertPushed()` proves a job was dispatched, not that it'll run in the right tenant. To test the job itself, call `handle()` inside `$tenant->run()`. [Queued Jobs in a Multi-Tenant Laravel App](/blog/laravel-multi-tenant-queues.html) has the setup that makes this reliable.

### Storage

`FilesystemTenancyBootstrapper` forgets and rebuilds the tenant disks when tenancy starts. If you call `Storage::fake('public')` before the tenant is initialized, the fake gets thrown away and files end up in the real tenant folder. The fix is just ordering: call it after initializing the tenant.

## Testing cache isolation

Most test suites run with `CACHE_STORE=array`. The array store supports cache tags, so stancl's cache bootstrapper works in tests even when your production store doesn't. That means a tenant cache call against the `database` or `file` store can throw an exception your tests will never see.

To close that gap, add one test that runs a cached code path inside a tenant using the store you use in production, for example in a CI job with Redis. [Tenant-Aware Cache and File Storage in Laravel](/blog/laravel-tenant-cache-filesystem.html) goes into the details.

## Keeping tenant tests fast

Every `createTenant()` call creates a database and runs all your tenant migrations and seeders, so the cost adds up. Most tests only need one tenant, and isolation tests need two; I wouldn't create more than that. Keep tenant seeders small in tests too, seeding only what the flow under test requires.

Grouping helps as well. Add `->group('tenancy')` to tenant tests, and you can run the quick central tests on their own with `--exclude-group=tenancy`.

If you run tests in parallel, add Laravel's `ParallelTesting::token()` to the tenant database prefix. That keeps two processes from ever creating the same tenant database.

## Frequently asked questions

### Can I use RefreshDatabase with stancl/tenancy?

Not for tests that create tenants in a multi-database setup. stancl's documentation says `RefreshDatabase` and in-memory SQLite don't work there, because tenancy switches the default connection. Use `DatabaseMigrations` and delete tenants after each test. Tests that only touch central data can keep `RefreshDatabase`.

### Why do my tenant tests leave database files behind?

A tenant database is only removed when the tenant is deleted. If a test fails before cleanup, or the `afterEach` hook is missing, the file or database stays behind. Deleting tenants in `afterEach` fixes this, because that hook runs even when the test fails.

### How do I act as a tenant user in a test?

Create the user inside the tenant with `$tenant->run()`, then call `actingAs($user, 'tenant')` (or whatever your tenant guard is called) and request a URL on the tenant's domain.

### Should every test create a tenant?

No. Create tenants for tests about identification, isolation, tenant routes and tenant data. Pure logic, validation and central features are faster and easier to read without one.

## How SaaS Laravel handles testing

If you'd like a head start, the [SaaS Laravel starter kits](/) come with a Pest 5 suite using `pestphp/pest-plugin-laravel`, plus Larastan and Pint, all run by `composer test`. `phpunit.xml` switches to in-memory SQLite, the `array` cache store and the `sync` queue, so tests never touch your development data. Tenant logic is easy to reach from tests: `tenancy()->initialize($tenant)` and `$tenant->run()` switch context, and the Tenant module creates tenants through a service class. The [Testing documentation](/docs/core/testing.html) has the details.

<BlogPostCta title="A Laravel SaaS with Pest built in" text="SaaS Laravel ships a Pest test suite, Larastan and Pint on a multi-tenant Laravel backend, with Vue, React or Svelte on the frontend." />
