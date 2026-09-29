---
title: "Queued Jobs in a Multi-Tenant Laravel App"
description: "How Laravel tenancy queue jobs keep their tenant: the stancl queue bootstrapper, a central jobs table, dispatching per tenant, URLs, locks and scheduling."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: multi-tenancy
tags: [Multi-tenancy, Queues]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-multi-tenant-queues.html
  - - meta
    - property: og:title
      content: "Queued Jobs in a Multi-Tenant Laravel App"
  - - meta
    - property: og:description
      content: "How Laravel tenancy queue jobs keep their tenant: the stancl queue bootstrapper, a central jobs table, dispatching per tenant, URLs, locks and scheduling."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-multi-tenant-queues.html
  - - meta
    - name: twitter:title
      content: "Queued Jobs in a Multi-Tenant Laravel App"
  - - meta
    - name: twitter:description
      content: "How Laravel tenancy queue jobs keep their tenant: the stancl queue bootstrapper, a central jobs table, dispatching per tenant, URLs, locks and scheduling."
---

# Laravel Tenancy Queue Jobs: Running Background Work for the Right Tenant

<BlogPostMeta />

A queued job runs later, in a different process, with no request and no domain. So in a multi-tenant app every job has to answer one question: which tenant is this for? Get it wrong and your Laravel tenancy queue jobs read from the wrong database. Below I'll go through how stancl/tenancy keeps the tenant attached to a job, where the jobs table should live, how I dispatch work for a specific tenant, and the mistakes that quietly send a job somewhere it shouldn't go.

I'm using [stancl/tenancy](https://tenancyforlaravel.com) version 3 with a database per tenant. If tenancy itself isn't set up yet, read [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html) first.

## What breaks when the queue doesn't know the tenant

Say a tenant user clicks "Export invoices". Your controller dispatches `ExportInvoices`, and a worker picks it up a second later.

That worker is a long-running `php artisan queue:work` process. It never saw the request. It doesn't know the host, and tenancy was never initialized. So `Invoice::all()` runs against the **central** database. If you're lucky, the table isn't there and the job fails loudly. If you're unlucky, a similar table exists and the job exports the wrong data without a single error.

The fix is simple to describe: store the tenant with the job, and restore it before the job runs.

## How the queue bootstrapper works

stancl/tenancy ships `QueueTenancyBootstrapper`. Add it to the `bootstrappers` array in `config/tenancy.php`. From then on, when a job is dispatched while tenancy is initialized, it writes the current tenant key into the job payload. When a worker processes the job, the bootstrapper listens for Laravel's `JobProcessing` event, reads that key and calls `tenancy()->initialize()` before your `handle()` method runs.

The stored payload looks roughly like this:

```json
{
  "displayName": "App\\Jobs\\ExportInvoices",
  "job": "Illuminate\\Queue\\CallQueuedHandler@call",
  "data": { "command": "O:22:\"App\\Jobs\\ExportInvoices\"..." },
  "tenant_id": 42
}
```

A job without a `tenant_id` runs in the central context. Between jobs the bootstrapper resets the context, which is why one worker can safely chew through jobs for many tenants in a row. It also listens for `JobRetryRequested`, so `php artisan queue:retry` brings the tenant back too.

One nice side effect: tenancy starts before the job is unserialized. That means `SerializesModels` does what you'd expect, and an `Invoice` passed to the constructor is re-fetched from the tenant database, not the central one.

## Keep the jobs table in the central database

With the `database` driver, the `jobs` table has to live somewhere. I put it in the central database so one worker can read jobs for every tenant.

| Queue driver | What to check |
| --- | --- |
| `database` | Set `connection` in `config/queue.php` to your central connection name, not empty and not `tenant` |
| `redis` | Keep the queue's Redis connection out of `tenancy.redis.prefixed_connections` |
| `sqs`, `beanstalkd` | Nothing tenant-specific; the tenant key travels in the payload |
| `sync` | Runs immediately in the same process and context |

The `database` row is the one people get wrong. Leave the queue connection empty and Laravel uses the default database connection. Inside a tenant request, the default connection is the tenant database. So your jobs land in each tenant's own `jobs` table, where no worker is ever looking.

```php
// config/queue.php
'database' => [
    'driver' => 'database',
    'connection' => env('DB_QUEUE_CONNECTION', env('DB_CONNECTION')),
    'table' => 'jobs',
    // ...
],
```

Do the same for `failed_jobs` and `job_batches` by pointing `queue.failed.database` and `queue.batching.database` at the central connection.

## Dispatching Laravel tenancy queue jobs for a specific tenant

Inside a tenant request there's nothing to do. Tenancy is initialized, so the key gets added for you.

It's different from the central context: an admin action, a webhook, a console command. There's no current tenant there. I wrap the dispatch in `run()`, which initializes the tenant, runs the callback and puts the previous context back:

```php
$tenant = Tenant::findOrFail($tenantId);

$tenant->run(function () use ($reportId) {
    GenerateMonthlyReport::dispatch($reportId);
});
```

Some jobs should always run centrally, even if you dispatch them from inside a tenant. A job that writes to a central audit log is a good example. Give those jobs their own queue connection and mark it central. The bootstrapper won't add a tenant key for any connection with `'central' => true`:

```php
// config/queue.php
'central' => [
    'driver' => 'database',
    'connection' => env('DB_CONNECTION'),
    'table' => 'jobs',
    'queue' => 'central',
    'central' => true,
],
```

```php
RecordPlatformUsage::dispatch($tenant->getTenantKey())->onConnection('central');
```

## Things a queue worker doesn't have

Restoring the tenant brings back the database, cache, filesystem and whatever else your bootstrappers switch. It doesn't bring back the request. Go through your jobs with this table in mind:

| Inside a request | Inside a queued job |
| --- | --- |
| `request()` input | Empty. Pass the values you need to the job constructor |
| `auth()->user()` | `null`. Pass the user model or ID |
| The current host | Unknown. `url()` and `route()` fall back to `APP_URL`, the central domain |
| The session and flash data | Not available |
| The user's locale | The app default. Pass the locale to the job, or implement `HasLocalePreference` on the user for mail |

The host is the one that bites most often. A queued email built with `route('invoices.show', $invoice)` links to the central domain instead of `acme.your-saas.com`. Build tenant links from the tenant's stored domain, the way I do in [User Invitations in Laravel with Signed URLs](/blog/laravel-user-invitations-signed-urls.html).

I'd also search for `request()` in code that runs synchronously today, like the steps of a tenant creation pipeline. It works now because it runs inside the request. The day you queue it, `request()` is empty and the job silently falls back to defaults.

## Unique jobs and overlapping locks

`ShouldBeUnique` and the `WithoutOverlapping` middleware both use cache locks keyed by a string you pick. Now imagine two tenants running `SyncCalendar` for "calendar 7". They're two different calendars, but if the key only holds the calendar ID, they get the same lock.

My rule: put the tenant key in every lock key. Then the lock is right whether your lock store is tenant-scoped or shared.

```php
class SyncCalendar implements ShouldQueue, ShouldBeUnique
{
    public function __construct(public int $calendarId) {}

    public function uniqueId(): string
    {
        return tenant()?->getTenantKey().':'.$this->calendarId;
    }

    public function middleware(): array
    {
        return [new WithoutOverlapping(tenant()?->getTenantKey().':'.$this->calendarId)];
    }
}
```

`uniqueId()` is called at dispatch time, inside the tenant. `middleware()` runs in the worker after the bootstrapper has restored the tenant. So `tenant()` is available in both places.

## Running a job for every tenant

Scheduled work like nightly cleanup or monthly usage reports usually needs to run once per tenant. I schedule one central job or command that fans out:

```php
// routes/console.php
Schedule::call(function () {
    tenancy()->runForMultiple(null, function (Tenant $tenant) {
        PruneExpiredExports::dispatch();
    });
})->daily()->name('prune-exports')->onOneServer();
```

`runForMultiple(null, ...)` walks through all tenants with a cursor, initializes each one, and restores the original context at the end. Every dispatched job carries its own tenant key, so if one tenant's job fails, the rest still run.

For Artisan commands you already have, stancl gives you `tenants:run`. It runs a command inside every tenant, or just the ones you pass with `--tenants`:

```bash
php artisan tenants:run reports:generate --tenants=42
```

Skip suspended or deleted tenants inside the loop. There's no point queuing work for a workspace nobody can open.

## Workers, fairness and deploys

You don't need a worker per tenant. One pool handles everyone, because the payload tells each job where to go.

What you do need to think about is fairness. One big tenant importing a huge file can fill the queue for everybody. I send imports and exports to their own queue with `onQueue('imports')` and give that queue its own workers.

A few more habits I'd keep:

- Workers hold your code in memory, so run `php artisan queue:restart` on every deploy, right alongside your [tenant migrations](/blog/laravel-tenant-migrations-seeders.html).
- Add the tenant key to your log context in a job middleware. A failed job then points straight at the customer.
- Creating the tenant database and running its migrations can be queued as well. Just remember the tenant isn't usable until that job has finished.

## Frequently asked questions

### Do I need a separate queue worker for each tenant?

No. Keep the jobs in the central database, enable the queue bootstrapper, and one pool of workers handles every tenant. Each job initializes its own tenant from the payload, and tenancy ends again when it's done.

### Why does my queued job read the central database?

Most of the time the job was dispatched from the central context, so no tenant key was added. Dispatch it inside `$tenant->run()`. If that's not it, check whether the bootstrapper is missing from `config/tenancy.php`, or whether the job went to a connection marked `'central' => true`.

### Can one job work with several tenants?

Yes, but make it a central job. Dispatch it without a tenant key and switch explicitly inside `handle()` with `$tenant->run()` or `tenancy()->runForMultiple()`. That said, I'd usually dispatch one job per tenant instead. It's easier to retry and easier to monitor.

### How do I retry failed tenant jobs?

Exactly like any other job. The payload in `failed_jobs` still holds the tenant key, and the bootstrapper initializes that tenant again when you run `php artisan queue:retry`.

## Queue setup in the SaaS Laravel kits

The [SaaS Laravel starter kits](/) enable `QueueTenancyBootstrapper` and use the `database` queue driver, with the queue connection defaulting to the central `DB_CONNECTION`. Jobs dispatched inside a tenant go into the central `jobs` table, so the single `queue:listen` process that `composer dev` starts handles every tenant. Tenant invitations, tenant admin password resets and user invitations are queued notifications, and their links are built before queuing, on the tenant's domain rather than `APP_URL`. More detail in [Local development → Queue worker](/docs/getting-started/local-development.html#queue-worker) and [Multi-tenancy](/docs/core/multi-tenancy.html).

<BlogPostCta title="Tenant-aware queues, already configured" text="SaaS Laravel keeps queued jobs in a central table and restores the tenant for each one, with Vue, React or Svelte on the same Laravel backend." />
