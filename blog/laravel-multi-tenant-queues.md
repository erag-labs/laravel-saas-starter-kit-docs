---
title: "Queued Jobs in a Multi-Tenant Laravel App"
description: "How Laravel tenancy queue jobs keep their tenant: the stancl queue bootstrapper, a central jobs table, dispatching per tenant, URLs, locks and scheduling."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
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

A queued job runs later, in a different process, with no request and no domain. In a multi-tenant app that raises one question for every job: which tenant does it belong to? This guide explains how **Laravel tenancy queue jobs** keep their tenant with stancl/tenancy, where the jobs should be stored, how to dispatch work for a specific tenant, and the mistakes that send a job to the wrong database.

The examples use [stancl/tenancy](https://tenancyforlaravel.com) version 3 with a database per tenant. If you are still setting up tenancy itself, start with [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## What goes wrong without tenant-aware queues

Picture a tenant user clicking "Export invoices". Your controller dispatches `ExportInvoices`, and a queue worker picks it up a second later.

The worker is a long-running `php artisan queue:work` process. It never saw the request, so it does not know the host, and tenancy is not initialized. `Invoice::all()` now runs against the **central** database. At best the table does not exist and the job fails. At worst a similar table exists and the job quietly exports the wrong data.

The fix is to store the tenant with the job and restore it before the job runs.

## How the queue bootstrapper works

stancl/tenancy ships `QueueTenancyBootstrapper`. Add it to the `bootstrappers` array in `config/tenancy.php` and it does two things:

1. **On dispatch**, if tenancy is initialized, it adds the current tenant key to the job payload.
2. **On processing**, it listens for Laravel's `JobProcessing` event, reads that key and calls `tenancy()->initialize()` before your `handle()` method runs.

The payload stored in the queue looks roughly like this:

```json
{
  "displayName": "App\\Jobs\\ExportInvoices",
  "job": "Illuminate\\Queue\\CallQueuedHandler@call",
  "data": { "command": "O:22:\"App\\Jobs\\ExportInvoices\"..." },
  "tenant_id": 42
}
```

Jobs without a `tenant_id` run in the central context. The bootstrapper also resets the context between jobs, so one worker can safely process jobs for many tenants in a row. It listens for `JobRetryRequested` too, so `php artisan queue:retry` restores the tenant as well.

Because tenancy starts before the job is unserialized, `SerializesModels` works as you would hope: an `Invoice` model passed to the constructor is re-fetched from the tenant database, not the central one.

## Keep the queue itself on the central database

With the `database` queue driver, the `jobs` table has to live somewhere. Put it in the **central** database, so one worker reads jobs for every tenant.

| Queue driver | What to check |
| --- | --- |
| `database` | Set `connection` in `config/queue.php` to your central connection name, not empty and not `tenant` |
| `redis` | Keep the queue's Redis connection out of `tenancy.redis.prefixed_connections` |
| `sqs`, `beanstalkd` | Nothing tenant-specific; the tenant key travels in the payload |
| `sync` | Runs immediately in the same process and context |

The `database` case catches people out. If the queue connection is left empty, Laravel uses the **default** database connection, and inside a tenant request the default connection is the tenant database. Jobs end up in each tenant's own `jobs` table, where no worker is looking.

```php
// config/queue.php
'database' => [
    'driver' => 'database',
    'connection' => env('DB_QUEUE_CONNECTION', env('DB_CONNECTION')),
    'table' => 'jobs',
    // ...
],
```

The same applies to `failed_jobs` and `job_batches`: point `queue.failed.database` and `queue.batching.database` at the central connection.

## Dispatching Laravel tenancy queue jobs for a specific tenant

Inside a tenant request you do not need to do anything: tenancy is initialized, so the tenant key is added automatically.

From the central context (an admin action, a webhook, a console command) there is no current tenant. Wrap the dispatch in `run()`, which initializes the tenant, runs your callback and restores the previous context:

```php
$tenant = Tenant::findOrFail($tenantId);

$tenant->run(function () use ($reportId) {
    GenerateMonthlyReport::dispatch($reportId);
});
```

Some jobs should always run centrally, even when dispatched inside a tenant, for example a job that writes to a central audit log. Give them their own queue connection and mark it central. The bootstrapper skips the tenant key for any connection with `'central' => true`:

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

## What a worker does not have

Restoring the tenant restores the database, cache, filesystem and anything else your bootstrappers switch. It does **not** bring back the request. Check your jobs for these:

| Inside a request | Inside a queued job |
| --- | --- |
| `request()` input | Empty. Pass the values you need to the job constructor |
| `auth()->user()` | `null`. Pass the user model or ID |
| The current host | Unknown. `url()` and `route()` fall back to `APP_URL`, the central domain |
| The session and flash data | Not available |
| The user's locale | The app default. Pass the locale to the job, or implement `HasLocalePreference` on the user for mail |

The host is the one that bites most often. A queued email built with `route('invoices.show', $invoice)` links to the central domain, not to `acme.your-saas.com`. Build tenant links from the tenant's stored domain instead, as shown in [User Invitations in Laravel with Signed URLs](/blog/laravel-user-invitations-signed-urls.html).

Also look for `request()` in jobs that currently run synchronously, such as steps in a tenant creation pipeline. They work today because they run inside the request. The day you queue them, `request()` is empty and the job quietly falls back to defaults.

## Unique jobs and overlapping locks

`ShouldBeUnique` and the `WithoutOverlapping` middleware use cache locks keyed by a string you choose. Two tenants running `SyncCalendar` for "calendar 7" have two different calendars, but they produce the same lock key if the key only contains the calendar ID.

Put the tenant key in every lock key. Then the lock is correct whether your lock store is tenant-scoped or shared:

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

`uniqueId()` is called when the job is dispatched, inside the tenant. `middleware()` runs in the worker after the bootstrapper has restored the tenant, so `tenant()` is available in both.

## Running a job for every tenant

Scheduled work, like nightly cleanup or monthly usage reports, usually has to run once per tenant. Schedule one central job or command that fans out:

```php
// routes/console.php
Schedule::call(function () {
    tenancy()->runForMultiple(null, function (Tenant $tenant) {
        PruneExpiredExports::dispatch();
    });
})->daily()->name('prune-exports')->onOneServer();
```

`runForMultiple(null, ...)` iterates over all tenants with a cursor, initializes each one and restores the original context at the end. Each dispatched job carries its own tenant key, so a failure for one tenant does not stop the others.

For existing Artisan commands, stancl also provides `tenants:run`, which runs a command inside every tenant (or the ones passed with `--tenants`):

```bash
php artisan tenants:run reports:generate --tenants=42
```

Skip tenants that are suspended or deleted inside the loop, so you do not queue work for workspaces nobody can open.

## Workers, fairness and deploys

- **One worker pool for all tenants.** You do not need a worker per tenant; the payload tells each job where to go.
- **Separate heavy work.** One large tenant importing a big file can fill the queue. Send imports and exports to their own queue with `onQueue('imports')` and give it its own workers.
- **Restart after deploys.** Workers keep your code in memory. Run `php artisan queue:restart` as part of every deployment, just as you would run [tenant migrations](/blog/laravel-tenant-migrations-seeders.html).
- **Log the tenant.** Add the tenant key to your log context in a job middleware, so a failed job points straight at the customer.
- **Tenant creation.** Creating the tenant database and running its migrations can be queued too. Just remember the tenant is not usable until that job finishes.

## Frequently asked questions

### Do I need a separate queue worker for each tenant?

No. With the jobs stored centrally and the queue bootstrapper enabled, one pool of workers processes jobs for every tenant. Each job initializes its own tenant from the payload and tenancy ends again afterwards.

### Why does my queued job read the central database?

Usually the job was dispatched from the central context, so no tenant key was added. Dispatch it inside `$tenant->run()`. Other causes: the bootstrapper is missing from `config/tenancy.php`, or the job was sent to a connection marked `'central' => true`.

### Can one job work with several tenants?

Yes, but make it a central job. Leave it without a tenant key and switch explicitly with `$tenant->run()` or `tenancy()->runForMultiple()` inside `handle()`. Dispatching one job per tenant is usually easier to retry and monitor.

### How do I retry failed tenant jobs?

The same way as any other job. The failed payload in `failed_jobs` still contains the tenant key, and the bootstrapper initializes that tenant again when you run `php artisan queue:retry`.

## How SaaS Laravel handles queues

The [SaaS Laravel starter kits](/) enable `QueueTenancyBootstrapper` and use the `database` queue driver, with the queue connection defaulting to the central `DB_CONNECTION`. Jobs dispatched inside a tenant are stored in the central `jobs` table, so the single `queue:listen` process started by `composer dev` handles every tenant. Tenant invitations, tenant admin password resets and user invitations are queued notifications whose links are built before queuing, on the tenant's domain rather than `APP_URL`. See [Local development → Queue worker](/docs/getting-started/local-development.html#queue-worker) and [Multi-tenancy](/docs/core/multi-tenancy.html).

<BlogPostCta title="Tenant-aware queues, already configured" text="SaaS Laravel keeps queued jobs in a central table and restores the tenant for each one, with Vue, React or Svelte on the same Laravel backend." />
