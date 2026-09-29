---
title: "Tenant-Aware Cache and File Storage in Laravel"
description: "How Laravel tenancy cache and file storage stay separate per tenant: cache tags, supported stores, calls that skip scoping, tenant disks, S3 and public URLs."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: multi-tenancy
tags: [Multi-tenancy, Performance]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-tenant-cache-filesystem.html
  - - meta
    - property: og:title
      content: "Tenant-Aware Cache and File Storage in Laravel"
  - - meta
    - property: og:description
      content: "How Laravel tenancy cache and file storage stay separate per tenant: cache tags, supported stores, calls that skip scoping, tenant disks, S3 and public URLs."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-tenant-cache-filesystem.html
  - - meta
    - name: twitter:title
      content: "Tenant-Aware Cache and File Storage in Laravel"
  - - meta
    - name: twitter:description
      content: "How Laravel tenancy cache and file storage stay separate per tenant: cache tags, supported stores, calls that skip scoping, tenant disks, S3 and public URLs."
---

# Laravel Tenancy Cache and File Storage: Keeping Every Tenant's Data Apart

<BlogPostMeta />

A separate database per tenant keeps rows apart, but the cache and the `storage` folder are still shared by default. This guide explains how **Laravel tenancy cache** scoping works with stancl/tenancy, which cache stores support it, the calls that quietly skip it, and how tenant file storage, S3 and public file URLs behave.

The examples use [stancl/tenancy](https://tenancyforlaravel.com) version 3. For the bigger picture, see [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## Why cache and files leak between tenants

Consider a dashboard that caches its numbers:

```php
$stats = Cache::remember('dashboard.stats', 600, fn () => $this->stats->build());
```

Inside Acme's request, this builds Acme's stats and stores them under `dashboard.stats`. Ten seconds later Globex opens its dashboard, finds a fresh `dashboard.stats` and shows Acme's numbers. The database was isolated; the cache key was not.

Files have the same problem. `Storage::put('exports/invoices.csv', $csv)` writes to the same path for every tenant, and the last one wins.

## How the Laravel tenancy cache bootstrapper works

Add `CacheTenancyBootstrapper` to the `bootstrappers` array in `config/tenancy.php`. When tenancy starts, it replaces Laravel's cache manager with one that adds a tag to every call made through the `Cache` facade, the `cache()` helper or an injected cache manager:

```php
// config/tenancy.php
'cache' => [
    'tag_base' => 'tenant', // tag = "tenant" + tenant key, e.g. "tenant42"
],
```

So `Cache::remember('dashboard.stats', ...)` inside tenant 42 becomes a tagged call for `tenant42`. Your code stays the same and each tenant gets its own entries.

Two useful side effects:

- `Cache::flush()` inside a tenant flushes only that tenant's tag, not the whole cache.
- You can clear one tenant's cache from the command line with `php artisan cache:clear --tags=tenant42`.

If you use your own tags, they are added to the tenant tag: `Cache::tags('reports')` inside tenant 42 uses `tenant42` and `reports`.

## Choose a cache store that supports tags

Tagging only works with stores that implement tags. Laravel throws `BadMethodCallException: This cache store does not support tagging.` for the others.

| Store | Tags | Use with the cache bootstrapper? |
| --- | --- | --- |
| `redis` | Yes | Yes, the usual choice in production |
| `memcached` | Yes | Yes |
| `array` | Yes | Yes, but per-process only (tests) |
| `database` | No | No |
| `file` | No | No |
| `dynamodb` | No | No |

The `array` row hides a trap. Test suites usually run with `CACHE_STORE=array`, which supports tags, while production may use `database` or `file`. Your tests pass and the first tenant request that touches the cache fails. Run at least one test against the store you deploy with; [Testing Multi-Tenant Laravel Apps with Pest](/blog/test-multi-tenant-laravel-pest.html) covers this.

If you cannot use a tag-capable store, leave the cache bootstrapper out and put the tenant key in your cache keys yourself:

```php
function tenant_cache_key(string $key): string
{
    return 'tenant'.tenant()?->getTenantKey().':'.$key;
}
```

## Calls that skip tenant scoping

The tenant cache manager only tags calls that go through its magic methods. Asking for a store explicitly returns the plain, untagged repository:

```php
Cache::get('plan.limits');           // tagged: tenant42
Cache::store()->get('plan.limits');  // NOT tagged: shared by all tenants
Cache::driver('redis')->get('x');    // NOT tagged
```

Your own code rarely does this, but packages do. spatie/laravel-permission, for example, caches all roles and permissions through `store()` under one key, `spatie.permission.cache`. With a shared cache store, tenants can read each other's permission cache. stancl's documentation recommends changing the key when tenancy starts:

```php
Events\TenancyBootstrapped::class => [
    function (Events\TenancyBootstrapped $event) {
        app(\Spatie\Permission\PermissionRegistrar::class)->cacheKey =
            'spatie.permission.cache.tenant.'.$event->tenancy->tenant->getTenantKey();
    },
],
```

Reset it in a `TenancyEnded` listener, so the central app goes back to its own key.

Sometimes you **want** shared data, like exchange rates or the list of plans. stancl provides `global_cache()`, which returns an untagged cache manager:

```php
$rates = global_cache()->remember('exchange-rates', 3600, fn () => $this->rates->fetch());
```

## Direct Redis calls

The cache bootstrapper covers the cache only. If you call the `Redis` facade directly, for counters or rate limits, enable `RedisTenancyBootstrapper` too. It prefixes keys for the connections listed in `tenancy.redis.prefixed_connections` and needs the phpredis extension. Do not prefix the connection your queue uses, or workers will not find tenant jobs; see [Queued Jobs in a Multi-Tenant Laravel App](/blog/laravel-multi-tenant-queues.html).

## Tenant file storage

`FilesystemTenancyBootstrapper` separates files per tenant. When tenancy starts it does three things:

1. Suffixes `storage_path()` with `tenant` + tenant key.
2. Changes the `root` of every disk listed in `tenancy.filesystem.disks`.
3. Makes `asset()` point at tenant files (more on that below).

```php
// config/tenancy.php
'filesystem' => [
    'suffix_base' => 'tenant',
    'disks' => ['local', 'public'],
    'root_override' => [
        'local' => '%storage_path%/app/',
        'public' => '%storage_path%/app/public/',
    ],
],
```

With that configuration, tenant 42's files end up here:

| Call | Path |
| --- | --- |
| `storage_path('reports')` | `storage/tenant42/reports` |
| `Storage::disk('local')->put('a.csv', ...)` | `storage/tenant42/app/a.csv` |
| `Storage::disk('public')->put('logo.png', ...)` | `storage/tenant42/app/public/logo.png` |

Disks not in the list are not touched, so an extra `uploads` disk would still be shared.

### S3 and other cloud disks

Add `s3` to `tenancy.filesystem.disks`. Without a `root_override` entry, the bootstrapper appends the suffix to the disk's `root`, so tenant 42's objects are stored under a `tenant42/` prefix in the same bucket. That keeps one bucket and one set of credentials, and makes it easy to list, back up or delete one tenant's files.

## Serving public tenant files

`php artisan storage:link` creates one `public/storage` symlink to the **central** `storage/app/public`. Tenant public files live elsewhere, so that link does not reach them.

Watch out for `Storage::disk('public')->url($path)`. The bootstrapper changes the disk root but not its `url`, so the URL still points at `/storage/...`, the central folder, and returns a 404.

Use `tenant_asset()` instead. It points at a route stancl registers, `/tenancy/assets/{path}`, which serves the file from the current tenant's `storage/app/public` and rejects paths outside that folder:

```php
$logoUrl = tenant_asset('logos/'.$workspace->logo_path);
// https://acme.your-saas.com/tenancy/assets/logos/acme.png
```

For S3, return the disk's URL or a `temporaryUrl()` for private files; the tenant prefix is already part of the path.

### asset() and your Vite build

With `asset_helper_tenancy` set to `true` (the default), `asset()` inside a tenant also points at `/tenancy/assets`. That is handy for tenant files, but Laravel's Vite integration builds its URLs with `asset()` too, so compiled scripts and styles can end up requested from the tenant storage folder.

Pick one of the fixes stancl offers: set `asset_helper_tenancy` to `false` and use `tenant_asset()` explicitly for tenant files, or enable the `ViteBundler` feature, which makes Vite use `global_asset()`. Check a production build (`npm run build`) on a tenant domain, not only the dev server.

## Cleaning up

Deleting a tenant with stancl's default `DeleteDatabase` job drops the database. It does not remove `storage/tenant42`, the `tenant42/` prefix on S3 or cached entries. Add those steps to your deletion pipeline; [Deleting Tenants Safely in Laravel](/blog/delete-tenant-laravel-safely.html) walks through it.

## Frequently asked questions

### Can I use the database cache driver with stancl/tenancy?

Not together with `CacheTenancyBootstrapper`, because the database store does not support tags and every tenant cache call would throw. Use Redis or Memcached for the cache, or remove the bootstrapper and add the tenant key to your cache keys yourself.

### Does Cache::flush() clear the cache for every tenant?

Not inside a tenant. With the cache bootstrapper, `Cache::flush()` flushes only the current tenant's tag. Run from the central context, or with `php artisan cache:clear` and no tags, it clears the whole store.

### Where are a tenant's uploaded files stored?

On disks listed in `tenancy.filesystem.disks`, under a tenant folder: `storage/tenant42/app` for `local`, `storage/tenant42/app/public` for `public`, and a `tenant42/` prefix for cloud disks. Other disks are shared.

### How do I share cached data between tenants?

Use `global_cache()`, which skips the tenant tag, or cache it from the central context. Keep shared data to things that are truly the same for everyone, like plans or exchange rates.

## How SaaS Laravel handles this

The [SaaS Laravel starter kits](/) enable the database, cache, filesystem and queue bootstrappers. The `local` and `public` disks and `storage_path()` are suffixed per tenant (`storage/tenant{id}/...`), and each tenant database also gets its own `cache` and `cache_locks` tables. The test suite runs with the `array` cache store. See [What is tenant-aware](/docs/core/multi-tenancy.html#what-is-tenant-aware) in the documentation.

<BlogPostCta title="Tenant isolation beyond the database" text="SaaS Laravel switches the database, cache, file disks and queued jobs per tenant, with Vue, React or Svelte on the same Laravel backend." />
