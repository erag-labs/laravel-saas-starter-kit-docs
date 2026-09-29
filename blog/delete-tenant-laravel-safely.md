---
title: "Deleting Tenants Safely in Laravel"
description: "How to delete a tenant in Laravel safely: what stancl/tenancy removes, what it leaves behind, the soft delete trap, and a deletion flow you can retry."
pageClass: blog-page
date: 2026-09-29
author: erag
tags: [Multi-tenancy, Operations]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/delete-tenant-laravel-safely.html
  - - meta
    - property: og:title
      content: "Deleting Tenants Safely in Laravel"
  - - meta
    - property: og:description
      content: "How to delete a tenant in Laravel safely: what stancl/tenancy removes, what it leaves behind, the soft delete trap, and a deletion flow you can retry."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/delete-tenant-laravel-safely.html
  - - meta
    - name: twitter:title
      content: "Deleting Tenants Safely in Laravel"
  - - meta
    - name: twitter:description
      content: "How to delete a tenant in Laravel safely: what stancl/tenancy removes, what it leaves behind, the soft delete trap, and a deletion flow you can retry."
---

# How to Delete a Tenant in Laravel Without Losing the Wrong Data

<BlogPostMeta />

Creating tenants gets all the attention, but sooner or later a customer leaves, a trial expires or a test workspace has to go. When you **delete a tenant in Laravel** with a database per tenant, one click can drop a whole database, and there is no undo.

This guide explains what actually happens when a tenant is deleted with [stancl/tenancy](https://tenancyforlaravel.com) version 3, what is left behind, a trap with soft deletes, and a deletion flow that is safe to run and safe to retry. For the bigger picture of database-per-tenant apps, see [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## What happens when you delete a tenant in Laravel with stancl/tenancy

Calling `$tenant->delete()` on the model runs this sequence:

```text
DeletingTenant event
  → DELETE FROM tenants (domains removed by the foreign key cascade)
TenantDeleted event
  → JobPipeline: DeleteDatabase
      → DROP DATABASE tenantacme
```

The drop comes from the published `TenancyServiceProvider`:

```php
Events\TenantDeleted::class => [
    JobPipeline::make([
        Jobs\DeleteDatabase::class,
    ])->send(fn (Events\TenantDeleted $event) => $event->tenant)
      ->shouldBeQueued(false),
],
```

Three details matter here:

- **The database is dropped after the row is gone.** If the drop fails, for example because the database user lacks the privilege or the database was already removed by hand, the tenant row no longer exists, so there is nothing left to retry from.
- **It only works through model events.** `Tenant::query()->where(...)->delete()` runs a single SQL statement and fires no events, so no database is dropped. You end up with orphaned databases.
- **With the MySQL and PostgreSQL managers, the drop has no `IF EXISTS`.** Deleting a tenant whose database is already missing throws an error.

## What a deleted tenant leaves behind

The package removes the tenant row, its domains and its database. Everything else is up to you:

| Resource | Removed by stancl/tenancy? | What to do |
| --- | --- | --- |
| `tenants` row and `domains` rows | Yes | Nothing |
| Tenant database | Yes, via `TenantDeleted` | Take a final backup first |
| Per-tenant MySQL user (if you use `PermissionControlledMySQLDatabaseManager`) | Yes, with the database | Nothing |
| Files under the tenant's storage folder | No | Delete the folder or bucket prefix |
| Cached values tagged for the tenant | No | Flush the tenant's cache tag |
| Queued jobs for the tenant | No | They fail when processed, because the tenant cannot be found |
| Billing subscription, search indexes, TLS certificates | No | Cancel or remove them in their own systems |
| Central records that mention the tenant | Only those with a cascading foreign key | Decide per table: delete, anonymise or keep |

The file and cache rows are easy to miss. With the default filesystem bootstrapper, a tenant's `storage_path()` becomes `storage/tenant` followed by the tenant ID, and the `local` and `public` disks live inside it. [Tenant-Aware Cache and File Storage](/blog/laravel-tenant-cache-filesystem.html) explains how those paths and cache tags are built.

## The soft delete trap

Adding Laravel's `SoftDeletes` trait to the `Tenant` model looks like an easy safety net. It is not. Eloquent fires the `deleted` model event for soft deletes too, and stancl/tenancy maps that event to `TenantDeleted`. The tenant row is kept with a `deleted_at` value, but **the database is dropped anyway**.

If you want a recoverable state, use an explicit status instead, such as `scheduled_for_deletion` with a date, and block access while it is set. Only call `delete()` when you really mean it.

## A safer tenant deletion flow

Treat deletion as a process with a waiting period, not a button that acts immediately.

1. **Block access.** Suspend the workspace so nobody can create new data. [Suspending Customer Accounts in a SaaS](/blog/suspend-tenant-accounts-saas.html) covers how to do that without deleting anything.
2. **Schedule the deletion.** Store the date, tell the customer, and give them a window to change their mind or download an export.
3. **Stop outside services.** Cancel the subscription with your billing provider and remove custom domain certificates and search indexes.
4. **Take a final backup.** Keep it for the period your terms and privacy policy promise, then delete it. [Backups for a Multi-Database Laravel SaaS](/blog/laravel-multi-database-backups.html) covers per-tenant backups.
5. **Delete in a queued job.** Clean up files and cache, drop the database, then remove the tenant, and log each step.

A scheduled command can pick up tenants whose deletion date has passed and dispatch one job per tenant, so a single failure does not stop the rest.

## Make the drop happen before the row disappears

The default order drops the database after the row is deleted. For a retryable process, you want the opposite: if anything fails, the tenant row should still be there. Move `DeleteDatabase` from `TenantDeleted` to `DeletingTenant` in `TenancyServiceProvider`:

```php
Events\DeletingTenant::class => [
    JobPipeline::make([
        Jobs\DeleteDatabase::class,
    ])->send(fn (Events\DeletingTenant $event) => $event->tenant)
      ->shouldBeQueued(false),
],
Events\TenantDeleted::class => [],
```

Because the pipeline runs synchronously, an exception during the drop stops the model delete. The tenant row stays, and you can fix the problem and run the job again.

A deletion job built on that could look like this:

```php
public function handle(): void
{
    $id = $this->tenant->getTenantKey();

    $this->tenant->run(fn () => cache()->flush()); // flushes this tenant's tag

    File::deleteDirectory(storage_path('tenant'.$id));

    $this->tenant->delete(); // DeletingTenant drops the database first

    Log::info('Tenant deleted', ['tenant' => $id]);
}
```

Inside `run()`, stancl/tenancy's cache manager adds the tenant tag to every call, so `flush()` only clears that tenant's entries. That requires a cache store that supports tags, such as Redis. If your files live on S3, delete the tenant's prefix there instead of a local folder.

## Clean up orphans

Even with a careful flow, orphans appear: a failed drop, a manual delete in the database console, or an old bug. A small scheduled check keeps them visible. List the databases on your server that start with your tenant prefix, compare them with the tenant IDs in the central `tenants` table, and report the difference. Do not drop anything automatically. A human should look at an orphaned database before it is removed.

## Frequently asked questions

### Does deleting a tenant with stancl/tenancy delete its database?

Yes, when you delete the tenant model and `TenantDeleted` is mapped to the `DeleteDatabase` job, as it is in the published `TenancyServiceProvider`. Query-builder deletes fire no model events, so they leave the database in place.

### Can I restore a deleted tenant?

Only from a backup. Dropping a database cannot be undone, and the tenant row and domains are gone too. That is why the flow above suspends first, waits, and takes a final backup before anything is deleted.

### Should tenant deletion run in a queue?

For real customers, yes. Dropping a large database, deleting files and calling external services can take longer than a web request should. A queued job can also be retried, and a failure does not show the admin an error page halfway through.

### What happens to queued jobs of a deleted tenant?

When the worker picks up a job that belongs to a deleted tenant, tenancy cannot be initialized and the job fails with a "tenant could not be identified" exception. Suspend the tenant first and let the queue drain before deleting.

## How SaaS Laravel handles tenant deletion

In the [SaaS Laravel starter kits](/), deleting a tenant is a central-only action behind the `Delete Tenant` permission. The admin sees a confirmation dialog with the company and domain and a warning that the action cannot be undone. `TenantService::deleteTenant()` removes the tenant's domains and then the tenant through the model, and the `TenantDeleted` pipeline drops the tenant database. For customers who should lose access without losing data, the kits also have a Suspended workspace status that blocks every tenant page. See [Maintenance and suspension](/docs/core/maintenance-and-suspension.html).

<BlogPostCta title="Tenant lifecycle, handled centrally" text="SaaS Laravel lets platform admins create, suspend and delete tenant workspaces behind permissions, with a database per tenant, in Vue, React or Svelte." />
