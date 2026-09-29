---
title: "Testing a Laravel SaaS with Pest"
description: "Laravel Pest testing for SaaS apps: what to test, setup, feature tests, permissions, Inertia pages, datasets, fakes, architecture tests and a fast suite."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Testing, Code quality]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-saas-testing-pest.html
  - - meta
    - property: og:title
      content: "Testing a Laravel SaaS with Pest"
  - - meta
    - property: og:description
      content: "Laravel Pest testing for SaaS apps: what to test, setup, feature tests, permissions, Inertia pages, datasets, fakes, architecture tests and a fast suite."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-saas-testing-pest.html
  - - meta
    - name: twitter:title
      content: "Testing a Laravel SaaS with Pest"
  - - meta
    - name: twitter:description
      content: "Laravel Pest testing for SaaS apps: what to test, setup, feature tests, permissions, Inertia pages, datasets, fakes, architecture tests and a fast suite."
---

# Laravel Pest Testing for SaaS Apps: What to Test and How

<BlogPostMeta />

A SaaS product changes every week, and every change can break sign-in, permissions or the workflows customers rely on. **Laravel Pest testing** gives you a fast, readable safety net for exactly those paths.

This guide covers what is worth testing in a Laravel SaaS, how to set Pest up, and how to test HTTP flows, permissions, Inertia pages, validation and side effects. It also covers architecture tests and how to keep the suite fast as it grows.

## What to test in a Laravel SaaS

You don't need 100% coverage. You need tests where a bug would cost you customers or support time:

| Area | Example test | Type |
| --- | --- | --- |
| Authentication | Users can log in, log out, reset a password | Feature |
| Authorization | A user without permission gets a 403 | Feature |
| Core workflows | Creating a project stores it and redirects | Feature |
| Validation | Invalid input returns errors for the right fields | Feature + dataset |
| Side effects | An invitation sends one notification | Feature + fake |
| Domain logic | A service calculates the right result | Unit or feature |
| Conventions | No `dd()` left in the code | Architecture |

Feature tests, which send a request through the whole app, give the most confidence per line of code. Unit tests are best for pure logic that doesn't need the framework.

## Setting up Pest for Laravel testing

Pest is a testing framework built on PHPUnit with a shorter, function-based syntax. Install it with the Laravel plugin:

```bash
composer require pestphp/pest pestphp/pest-plugin-laravel --dev --with-all-dependencies
vendor/bin/pest --init
```

`--init` creates `tests/Pest.php`. That file binds your feature tests to Laravel's `TestCase` and resets the database for every test:

```php
pest()->extend(Tests\TestCase::class)
    ->use(Illuminate\Foundation\Testing\RefreshDatabase::class)
    ->in('Feature');
```

Then point the test environment at fast, isolated drivers in `phpunit.xml`:

| Variable | Test value | Why |
| --- | --- | --- |
| `DB_CONNECTION` / `DB_DATABASE` | `sqlite` / `:memory:` | Fast, and never touches your real data |
| `QUEUE_CONNECTION` | `sync` | Jobs run immediately |
| `MAIL_MAILER` | `array` | No real emails |
| `CACHE_STORE`, `SESSION_DRIVER` | `array` | No state between tests |
| `BCRYPT_ROUNDS` | `4` | Password hashing stays fast |

In-memory SQLite is quick, but it isn't MySQL or PostgreSQL. If you rely on database-specific features such as JSON columns or full-text search, run CI against the same engine as production.

## Writing feature tests with Pest

A feature test reads like a sentence. Create data with factories, act as a user and assert on the response:

```php
use App\Models\User;

test('guests are redirected to the login page', function () {
    $this->get(route('dashboard'))->assertRedirect(route('login'));
});

test('verified users can open the dashboard', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('dashboard'))->assertOk();
});
```

Use route names instead of URLs, so tests survive URL changes. Prefer specific assertions such as `assertOk()`, `assertForbidden()` and `assertNotFound()` over `assertStatus(...)`. They make failures easier to read.

## Testing permissions and authorization

Authorization bugs are the ones that leak data, so test both sides of every important rule:

```php
test('members without permission cannot delete projects', function () {
    $project = Project::factory()->create();

    $this->actingAs(User::factory()->create())
        ->delete(route('projects.destroy', $project))
        ->assertForbidden();

    expect($project->fresh())->not->toBeNull();
});
```

Then add the positive case, where the user has the permission and the project is gone. If you use Spatie's package, `$user->givePermissionTo(...)` sets that up in one line. The [Spatie roles and permissions guide](/blog/laravel-roles-permissions-spatie.html) covers the package itself.

## Testing Inertia pages

With Inertia, a controller returns a page component and props instead of HTML. `assertInertia()` lets you check both:

```php
use Inertia\Testing\AssertableInertia as Assert;

test('the projects page lists the projects', function () {
    Project::factory()->count(3)->create();

    $this->actingAs(User::factory()->create())
        ->get(route('projects.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('projects/Index')
            ->has('projects', 3)
        );
});
```

By default, `component()` also checks that the page file exists (`inertia.testing.ensure_pages_exist`), so a renamed Vue, React or Svelte page fails the test instead of failing in the browser. It's also a good place to assert that sensitive fields, such as tokens or 2FA secrets, are **missing** from the props.

## Validation with datasets

Datasets run the same test with different inputs. They are perfect for validation rules:

```php
test('project names are validated', function (mixed $name) {
    $this->actingAs(User::factory()->create())
        ->post(route('projects.store'), ['name' => $name])
        ->assertSessionHasErrors('name');
})->with([
    'missing' => [null],
    'too long' => [str_repeat('a', 256)],
    'not a string' => [['array']],
]);
```

Each named case shows up separately in the output, so you can see at a glance which rule broke.

## Faking emails, notifications and queues

A SaaS sends invitations, receipts and alerts. You want to assert that they are sent without sending anything real. Laravel's fakes swap the real implementation for an in-memory recorder:

```php
use Illuminate\Support\Facades\Notification;

test('inviting a user sends one invitation', function () {
    Notification::fake();

    $this->actingAs(User::factory()->create())->post(route('users.store'), [
        'name' => 'New User',
        'email' => 'new@example.com',
        'send_invitation' => true,
    ]);

    $invited = User::where('email', 'new@example.com')->firstOrFail();
    Notification::assertSentTo($invited, UserInvitation::class);
});
```

`Mail::fake()`, `Queue::fake()`, `Event::fake()` and `Http::fake()` work the same way. `Http::fake()` is especially useful for code that calls payment providers or other external APIs.

## Architecture tests

Architecture tests check your code's structure instead of its behaviour. You describe a rule once, and Pest checks every class against it:

```php
arch('no debugging calls')
    ->expect(['dd', 'dump', 'ray'])
    ->not->toBeUsed();

arch('models extend Eloquent')
    ->expect('App\Models')
    ->toExtend(Illuminate\Database\Eloquent\Model::class);
```

Pest also ships presets such as `arch()->preset()->php()` and `arch()->preset()->laravel()`. They are opinionated: the Laravel preset, for example, bans `env()` outside config and only allows resource-style public methods on controllers, and it only looks at the `App` namespace. Try a preset, keep what fits, and write your own rules for the rest. In a [modular Laravel architecture](/blog/modular-laravel-architecture.html), rules like "this module must not use that one" keep boundaries from eroding quietly.

## Keeping the suite fast

A slow suite is a suite nobody runs. Some habits that keep it quick:

- **Run in parallel.** `vendor/bin/pest --parallel` splits tests across processes.
- **Run what you changed.** `--dirty` runs only tests with uncommitted changes. Pest 5's `--tia` goes further: it re-runs only the tests affected by your changes and replays the rest from cache.
- **Shard in CI.** Pest 5 can balance shards by run time: record timings with `--update-shards`, then run `--shard=1/4` on each CI machine.
- **Migrate lazily.** `LazilyRefreshDatabase` only migrates when a test actually touches the database.
- **Keep factories lean.** Create only the related models a test needs. Heavy factory states are a common hidden cost.

Pair the suite with static analysis and style checks in CI, as described in [Larastan and Pint for Laravel code quality](/blog/laravel-larastan-pint.html).

### Multi-tenant apps

Tenant-aware code needs extra care: creating tenant databases, switching tenant context and cleaning up afterwards. That topic has its own guide: [testing multi-tenant Laravel apps with Pest](/blog/test-multi-tenant-laravel-pest.html).

## Frequently asked questions

### Is Pest better than PHPUnit for Laravel?

Pest runs on top of PHPUnit, so both are equally capable. Pest's syntax is shorter and adds datasets, architecture tests and a nicer CLI. Laravel supports both, and Pest can run existing PHPUnit test classes, so you can switch gradually.

### Should I use SQLite or MySQL for tests?

In-memory SQLite is the fastest option and works for most apps. If you use database-specific features, or have had bugs that only appeared on MySQL or PostgreSQL, run at least your CI suite on the production engine.

### How many tests does a SaaS need?

Start with the paths that would hurt most if they broke: sign-in, permissions, tenant or account isolation, and your main workflow. Add a test for every bug you fix. Coverage numbers matter less than covering the flows customers depend on.

### How do I test code that calls an external API?

Wrap the API in a service class and call `Http::fake()` in the test to return a fixed response. Then assert both what your code did with the response and which requests it sent, without ever hitting the real service.

## How SaaS Laravel handles testing

The [SaaS Laravel kits](/) ship with Pest 5 and the Laravel plugin. They include feature tests for login, registration, password reset and confirmation, email verification, the two-factor challenge, profile and security settings, and the dashboard. A `skipUnlessFortifyHas()` helper skips auth tests cleanly when you turn off a Fortify feature. Tests run on in-memory SQLite, and the React and Svelte kits also include tenancy tests for tenant creation and tenant sign-in. `composer test` runs Pint, frontend linting, Larastan and Pest, and a GitHub Actions workflow runs the same checks. Read the [testing documentation](/docs/core/testing.html) for commands and examples.

<BlogPostCta title="A tested SaaS foundation" text="SaaS Laravel kits come with Pest tests for authentication and settings, Larastan, Pint and a CI workflow, plus multi-tenancy and roles in Vue, React or Svelte." />
