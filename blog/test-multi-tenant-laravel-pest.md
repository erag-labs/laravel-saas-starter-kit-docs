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

The most expensive bug in a multi-tenant app is one customer seeing another customer's data, and it is exactly the bug a normal test suite does not look for. This guide shows how to **test Laravel tenancy** with Pest: setting up the test database, creating tenants in tests, proving isolation, testing requests on tenant domains, and the fakes that behave differently once tenancy is involved.

The examples use Pest with `pestphp/pest-plugin-laravel` and [stancl/tenancy](https://tenancyforlaravel.com) version 3 with a database per tenant. The setup itself is covered in [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html); for testing a Laravel SaaS in general (factories, auth, permissions), see [Testing a Laravel SaaS with Pest](/blog/laravel-saas-testing-pest.html).

## What to test in a multi-tenant app

You do not need to run every test inside a tenant. Focus on the places where tenancy changes behaviour:

| Area | What to prove |
| --- | --- |
| Identification | A tenant host initializes the right tenant; an unknown host returns 404 |
| Isolation | Data created in tenant A is not visible in tenant B |
| Central vs tenant | Central pages are blocked on tenant hosts and the other way round |
| Authentication | Tenant users cannot sign in centrally, or on another tenant |
| Tenant lifecycle | Creating a tenant creates its database, runs migrations and seeds it |
| Background work | Queued jobs run in the tenant they were dispatched from |
| Cache and files | Tenant cache entries and files do not collide |

Everything else, like validation rules or a service's calculations, can be tested once in whichever context is simplest.

## Setting up the test database

Database-per-tenant tests create real databases, which rules out some usual shortcuts. stancl's documentation notes that with multi-database tenancy you cannot use in-memory SQLite databases or the `RefreshDatabase` trait, because tenancy switches the default database connection during the test.

| Approach | Central database | Tenant databases | Trade-off |
| --- | --- | --- | --- |
| SQLite files | A file such as `database/testing.sqlite` | One file per tenant in `database/` | Fast, no server needed |
| A test MySQL or PostgreSQL server | A dedicated test database | Created by the tenancy pipeline | Matches production, slower |

In both cases, use `DatabaseMigrations` for tenant tests, and delete every tenant after each test. Deleting the tenant fires `TenantDeleted`, and the `DeleteDatabase` job in stancl's default `TenancyServiceProvider` removes the tenant database or file.

Give test tenants their own database prefix, so a test run never touches a development tenant with the same ID:

```php
// tests/TestCase.php
protected function setUp(): void
{
    parent::setUp();

    config(['tenancy.database.prefix' => 'test_tenant_']);
}
```

With SQLite, also set `tenancy.database.suffix` to `.sqlite`. Tenant files then match the usual `*.sqlite` rule in `database/.gitignore`, in case a crashed run leaves one behind.

## Organising Pest for central and tenant tests

Split tests into folders and give each its own setup in `tests/Pest.php`. Pest lets you attach hooks per folder:

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

Add a small helper that creates a tenant with a domain. Creating the tenant triggers your `TenantCreated` pipeline, so the database is created, migrated and seeded just as in production:

```php
function createTenant(string $subdomain = 'acme'): Tenant
{
    $tenant = Tenant::create();
    $tenant->domains()->create(['domain' => "{$subdomain}.your-saas.test"]);

    return $tenant;
}
```

If your app creates tenants through a service class (with a first admin, default roles and so on), call that service instead, so the tests cover the real flow.

## Test Laravel tenancy isolation with two tenants

The most valuable tenancy test is short: create data in one tenant and prove another tenant cannot see it.

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

`$tenant->run()` initializes the tenant, runs the callback and restores the previous context, so the test ends where it started. Use `tenancy()->initialize($tenant)` instead when a whole test should run inside one tenant, and let the `afterEach` hook end tenancy.

Write the same pair for every table that holds customer data and is reached in an unusual way: raw queries, a second connection, a reporting view or an export job.

## Testing requests on tenant domains

Feature tests can call a full URL. Laravel sets the request host from it, so your identification middleware sees the tenant domain:

```php
it('shows the dashboard on a tenant domain', function () {
    $tenant = createTenant('acme');
    $user = $tenant->run(fn () => User::factory()->create());

    $this->actingAs($user, 'tenant')
        ->get('http://acme.your-saas.test/dashboard')
        ->assertOk();
});
```

Pass the guard name to `actingAs()` if tenant users have their own guard. The user is created inside the tenant, so it exists in the tenant database.

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

The expected status depends on how you handle a missing tenant. The 404 above assumes you render `TenantCouldNotBeIdentifiedException` as a 404, in `bootstrap/app.php`.

## Fakes that behave differently with tenancy

**Events.** stancl/tenancy is built on events: creating a tenant, creating its database and initializing tenancy all fire events. A bare `Event::fake()` stops that chain, so no database is created and tenancy never starts. Fake only the events you assert on:

```php
Event::fake([InvoicePaid::class]);
```

**Queues.** With `Queue::fake()`, jobs are recorded but never serialized, and the queue bootstrapper does not add the tenant key to the payload. `assertPushed()` proves a job was dispatched, not that it will run in the right tenant. Test the job itself by calling `handle()` inside `$tenant->run()`, and read [Queued Jobs in a Multi-Tenant Laravel App](/blog/laravel-multi-tenant-queues.html) for the setup that makes this reliable.

**Storage.** `FilesystemTenancyBootstrapper` forgets and rebuilds the tenant disks when tenancy starts. If you call `Storage::fake('public')` before the tenant is initialized, the fake is thrown away and files go to the real tenant folder. Call it after initializing the tenant.

## Testing cache isolation

Test suites usually run with `CACHE_STORE=array`. The array store supports cache tags, so stancl's cache bootstrapper works in tests even if your production store does not. A tenant cache call against the `database` or `file` store throws an exception that your tests never see.

Add one test that runs a cached code path inside a tenant with the store you use in production, for example in a CI job with Redis. The details are in [Tenant-Aware Cache and File Storage in Laravel](/blog/laravel-tenant-cache-filesystem.html).

## Keeping tenant tests fast

Every `createTenant()` creates a database and runs all tenant migrations and seeders. A few habits keep that manageable:

- **Create only the tenants you need.** Most tests need one tenant; isolation tests need two.
- **Keep tenant seeders small in tests.** Seed only what the flow under test requires.
- **Group them.** Add `->group('tenancy')` to tenant tests, so you can run the fast central tests on their own with `--exclude-group=tenancy`.
- **Parallel runs.** When running tests in parallel, add Laravel's `ParallelTesting::token()` to the tenant database prefix, so two processes never create the same tenant database.

## Frequently asked questions

### Can I use RefreshDatabase with stancl/tenancy?

Not for tests that create tenants in a multi-database setup. stancl's documentation says `RefreshDatabase` and in-memory SQLite do not work there because tenancy switches the default connection. Use `DatabaseMigrations` and delete tenants after each test. Central-only tests can keep `RefreshDatabase`.

### Why do my tenant tests leave database files behind?

Tenant databases are only removed when the tenant is deleted. If a test fails before the cleanup, or the `afterEach` hook is missing, the file or database stays. Delete tenants in `afterEach`, which runs even when the test fails.

### How do I act as a tenant user in a test?

Create the user inside the tenant with `$tenant->run()`, then call `actingAs($user, 'tenant')` (or your tenant guard) and request a URL on the tenant's domain.

### Should every test create a tenant?

No. Create tenants for tests about identification, isolation, tenant routes and tenant data. Pure logic, validation and central features are faster and clearer without one.

## How SaaS Laravel handles testing

The [SaaS Laravel starter kits](/) ship a Pest 5 suite with `pestphp/pest-plugin-laravel`, plus Larastan and Pint, all run by `composer test`. `phpunit.xml` switches to in-memory SQLite, the `array` cache store and the `sync` queue, so tests never touch your development data. Tenant logic is easy to reach from tests: `tenancy()->initialize($tenant)` and `$tenant->run()` switch context, and the Tenant module creates tenants through a service class. See the [Testing documentation](/docs/core/testing.html).

<BlogPostCta title="A Laravel SaaS with Pest built in" text="SaaS Laravel ships a Pest test suite, Larastan and Pint on a multi-tenant Laravel backend, with Vue, React or Svelte on the frontend." />
