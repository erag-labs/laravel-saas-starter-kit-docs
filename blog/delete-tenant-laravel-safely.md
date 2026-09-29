---
title: "Deleting Tenants Safely in Laravel"
description: "How to delete a tenant in Laravel safely: what stancl/tenancy removes, what it leaves behind, the soft delete trap, and a deletion flow you can retry."
pageClass: blog-page
date: 2026-09-29
author: erag
category: multi-tenancy
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

Sooner or later a customer leaves, a trial runs out or a test workspace needs to go. When you delete a tenant in Laravel and each tenant has its own database, one click can drop that whole database. There's no undo.

Tenant creation gets most of the attention, so this post looks at the other end. Below we walk through what [stancl/tenancy](https://tenancyforlaravel.com) version 3 actually does when a tenant is deleted, what it leaves behind, a soft delete trap that catches people, and a deletion flow that's safe to run and safe to retry. If you want the wider picture of database-per-tenant apps first, start with [our multi-tenant SaaS walkthrough](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## What happens when you delete a tenant in Laravel with stancl/tenancy

Calling `$tenant->delete()` on the model runs this sequence:

```text
DeletingTenant event
  → DELETE FROM tenants (domains removed by the foreign key cascade)
TenantDeleted event
  → JobPipeline: DeleteDatabase
      → DROP DATABASE tenantacme
```

The drop itself is wired up in the published `TenancyServiceProvider`:

```php
Events\TenantDeleted::class => [
    JobPipeline::make([
        Jobs\DeleteDatabase::class,
    ])->send(fn (Events\TenantDeleted $event) => $event->tenant)
      ->shouldBeQueued(false),
],
```

The order is the first thing to notice. The database is dropped after the row is already gone. So if the drop fails (maybe the database user lacks the privilege, or someone already removed the database by hand), there's no tenant row left to retry from.

It also only works through model events. `Tenant::query()->where(...)->delete()` runs one SQL statement and fires nothing, which means no database gets dropped and you're left with orphans.

One more detail: with the MySQL and PostgreSQL managers, the drop has no `IF EXISTS`. Deleting a tenant whose database is already missing throws an error.

## What a deleted tenant leaves behind

The package cleans up the tenant row, its domains and its database. The rest is on you:

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

Files and cache are the two rows that are easiest to miss. With the default filesystem bootstrapper, a tenant's `storage_path()` becomes `storage/tenant` followed by the tenant ID, and the `local` and `public` disks sit inside it. Our post on [tenant-aware cache and file storage](/blog/laravel-tenant-cache-filesystem.html) explains how those paths and cache tags are built.

## Why SoftDeletes on the Tenant model won't save you

Adding Laravel's `SoftDeletes` trait to the `Tenant` model feels like a cheap safety net. It isn't one. Eloquent fires the `deleted` model event for soft deletes as well, and stancl/tenancy maps that event to `TenantDeleted`. The row survives with a `deleted_at` value, but **the database is dropped anyway**.

If you want a state you can recover from, use an explicit status instead, something like `scheduled_for_deletion` with a date, and block access while it's set. Call `delete()` only when you really mean it.

## A safer tenant deletion flow

We treat deletion as a process with a waiting period, not a button that acts the moment it's clicked.

1. Block access. Suspend the workspace so nobody can add new data. Our post on [suspending customer accounts](/blog/suspend-tenant-accounts-saas.html) shows how to do that without deleting anything.
2. Schedule the deletion. Store the date, tell the customer, and give them a window to change their mind or download an export.
3. Stop outside services. Cancel the subscription with your billing provider and remove custom domain certificates and search indexes.
4. Take a final backup and keep it for as long as your terms and privacy policy promise, then delete it. [Backups for a multi-database Laravel SaaS](/blog/laravel-multi-database-backups.html) covers per-tenant backups.
5. Delete in a queued job: clean up files and cache, drop the database, remove the tenant, and log each step.

For the last step, a scheduled command can pick up tenants whose deletion date has passed and dispatch one job per tenant. That way a single failure doesn't hold up the rest.

## Make the drop happen before the row disappears

By default the database goes after the row. For a retryable process you want it the other way round, so the tenant row is still there if anything fails. Move `DeleteDatabase` from `TenantDeleted` to `DeletingTenant` in `TenancyServiceProvider`:

```php
Events\DeletingTenant::class => [
    JobPipeline::make([
        Jobs\DeleteDatabase::class,
    ])->send(fn (Events\DeletingTenant $event) => $event->tenant)
      ->shouldBeQueued(false),
],
Events\TenantDeleted::class => [],
```

The pipeline runs synchronously, so an exception during the drop stops the model delete. The row stays put, and you can fix the problem and run the job again. We'd make this change in any app where deletion is automated.

A deletion job built on top of it could look like this:

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

Inside `run()`, stancl/tenancy's cache manager adds the tenant tag to every call, so `flush()` only clears that tenant's entries. You need a cache store that supports tags, such as Redis. If the files live on S3, delete the tenant's prefix there rather than a local folder.

## Finding orphaned tenant databases

Even a careful flow produces orphans now and then: a failed drop, a manual delete in the database console, an old bug. A small scheduled check keeps them visible. List the databases on your server that start with your tenant prefix, compare them with the tenant IDs in the central `tenants` table, and report the difference.

Don't drop anything automatically, though. A person should look at an orphaned database before it's removed.

## Frequently asked questions

### Does deleting a tenant with stancl/tenancy delete its database?

Yes, as long as you delete the tenant model and `TenantDeleted` is mapped to the `DeleteDatabase` job, which it is in the published `TenancyServiceProvider`. Query-builder deletes fire no model events, so the database stays where it is.

### Can I restore a deleted tenant?

Only from a backup. A dropped database can't be brought back, and the tenant row and domains are gone too. That's why the flow above suspends first, waits, and takes a final backup before anything is deleted.

### Should tenant deletion run in a queue?

For real customers, yes. Dropping a large database, deleting files and calling external services can take longer than a web request should. A queued job can also be retried, and the admin never sees an error page halfway through.

### What happens to queued jobs of a deleted tenant?

When a worker picks up a job that belongs to a deleted tenant, tenancy can't be initialized and the job fails with a "tenant could not be identified" exception. Suspend the tenant first and let the queue drain before you delete.

## How SaaS Laravel handles tenant deletion

If you'd rather not build this part yourself, the [SaaS Laravel starter kits](/) already cover the basics. Deleting a tenant is a central-only action behind the `Delete Tenant` permission. The admin gets a confirmation dialog showing the company and domain, with a warning that the action can't be undone. `TenantService::deleteTenant()` removes the tenant's domains and then the tenant through the model, and the `TenantDeleted` pipeline drops the tenant database. For customers who should lose access but keep their data, there's also a Suspended workspace status that blocks every tenant page. See [Maintenance and suspension](/docs/core/maintenance-and-suspension.html).

<BlogPostCta title="Tenant lifecycle, handled centrally" text="SaaS Laravel lets platform admins create, suspend and delete tenant workspaces behind permissions, with a database per tenant, in Vue, React or Svelte." />
