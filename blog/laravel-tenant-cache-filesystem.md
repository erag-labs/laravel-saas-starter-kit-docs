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

You gave every tenant its own database, so their data is separate. Except the cache and the `storage` folder are still shared by default, and that's where leaks happen. Here I'll walk through how **Laravel tenancy cache** scoping works with stancl/tenancy, which cache stores support it, the calls that quietly skip it, and how tenant file storage, S3 and public file URLs behave.

The examples use [stancl/tenancy](https://tenancyforlaravel.com) version 3. If you want the bigger picture first, read [How to Build a Multi-Tenant SaaS with Laravel](/blog/multi-tenant-saas-laravel-database-per-tenant.html).

## Why cache and files leak between tenants

Take a dashboard that caches its numbers:

```php
$stats = Cache::remember('dashboard.stats', 600, fn () => $this->stats->build());
```

During Acme's request, this builds Acme's stats and stores them under `dashboard.stats`. Ten seconds later Globex opens its dashboard, finds a fresh `dashboard.stats` and shows Acme's numbers. The database was isolated. The cache key wasn't.

Files have exactly the same problem. `Storage::put('exports/invoices.csv', $csv)` writes to the same path for every tenant, and whoever writes last wins.

## How the Laravel tenancy cache bootstrapper works

Add `CacheTenancyBootstrapper` to the `bootstrappers` array in `config/tenancy.php`. When tenancy starts, it swaps Laravel's cache manager for one that adds a tag to every call made through the `Cache` facade, the `cache()` helper or an injected cache manager:

```php
// config/tenancy.php
'cache' => [
    'tag_base' => 'tenant', // tag = "tenant" + tenant key, e.g. "tenant42"
],
```

So `Cache::remember('dashboard.stats', ...)` inside tenant 42 turns into a tagged call for `tenant42`. You don't change your code, and each tenant gets its own entries.

You also get two handy side effects. Calling `Cache::flush()` inside a tenant flushes only that tenant's tag, not the whole cache. And you can clear one tenant's cache from the command line with `php artisan cache:clear --tags=tenant42`.

If you use tags of your own, they're added alongside the tenant tag: `Cache::tags('reports')` inside tenant 42 uses both `tenant42` and `reports`.

## Choose a cache store that supports tags

Tagging only works on stores that implement tags. For the others, Laravel throws `BadMethodCallException: This cache store does not support tagging.`

| Store | Tags | Use with the cache bootstrapper? |
| --- | --- | --- |
| `redis` | Yes | Yes, the usual choice in production |
| `memcached` | Yes | Yes |
| `array` | Yes | Yes, but per-process only (tests) |
| `database` | No | No |
| `file` | No | No |
| `dynamodb` | No | No |

Look closely at the `array` row, because it hides a trap. Test suites usually run with `CACHE_STORE=array`, which supports tags, while production might use `database` or `file`. Your tests pass, and then the first tenant request that touches the cache fails. I'd always run at least one test against the store you actually deploy with; [Testing Multi-Tenant Laravel Apps with Pest](/blog/test-multi-tenant-laravel-pest.html) covers how.

Can't use a tag-capable store? Then leave the cache bootstrapper out and put the tenant key into your cache keys yourself:

```php
function tenant_cache_key(string $key): string
{
    return 'tenant'.tenant()?->getTenantKey().':'.$key;
}
```

If you have the choice, though, I'd go with Redis and the bootstrapper. Manual prefixes work until someone forgets one.

## Calls that skip tenant scoping

The tenant cache manager only tags calls that go through its magic methods. Ask for a store explicitly and you get the plain, untagged repository back:

```php
Cache::get('plan.limits');           // tagged: tenant42
Cache::store()->get('plan.limits');  // NOT tagged: shared by all tenants
Cache::driver('redis')->get('x');    // NOT tagged
```

Your own code rarely does this. Packages do. spatie/laravel-permission, for example, caches all roles and permissions through `store()` under a single key, `spatie.permission.cache`. With a shared cache store, tenants can read each other's permission cache. stancl's documentation recommends changing the key when tenancy starts:

```php
Events\TenancyBootstrapped::class => [
    function (Events\TenancyBootstrapped $event) {
        app(\Spatie\Permission\PermissionRegistrar::class)->cacheKey =
            'spatie.permission.cache.tenant.'.$event->tenancy->tenant->getTenantKey();
    },
],
```

Reset it in a `TenancyEnded` listener so the central app goes back to its own key.

Sometimes you **want** shared data, like exchange rates or the list of plans. For that stancl provides `global_cache()`, which returns an untagged cache manager:

```php
$rates = global_cache()->remember('exchange-rates', 3600, fn () => $this->rates->fetch());
```

## Direct Redis calls

The cache bootstrapper covers the cache and nothing else. If you call the `Redis` facade directly, say for counters or rate limits, enable `RedisTenancyBootstrapper` too. It prefixes keys for the connections listed in `tenancy.redis.prefixed_connections`, and it needs the phpredis extension. Don't prefix the connection your queue uses, or workers won't find tenant jobs. [Queued Jobs in a Multi-Tenant Laravel App](/blog/laravel-multi-tenant-queues.html) explains why.

## Tenant file storage

`FilesystemTenancyBootstrapper` keeps files apart per tenant. When tenancy starts, it does three things:

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

With that configuration, tenant 42's files land here:

| Call | Path |
| --- | --- |
| `storage_path('reports')` | `storage/tenant42/reports` |
| `Storage::disk('local')->put('a.csv', ...)` | `storage/tenant42/app/a.csv` |
| `Storage::disk('public')->put('logo.png', ...)` | `storage/tenant42/app/public/logo.png` |

Disks that aren't in the list are left alone. So if you add an `uploads` disk and forget to list it, it's still shared between every tenant.

### S3 and other cloud disks

Add `s3` to `tenancy.filesystem.disks`. Without a `root_override` entry, the bootstrapper appends the suffix to the disk's `root`, so tenant 42's objects go under a `tenant42/` prefix in the same bucket. I like this setup: one bucket, one set of credentials, and it's easy to list, back up or delete a single tenant's files.

## Serving public tenant files

`php artisan storage:link` creates one `public/storage` symlink pointing at the central `storage/app/public`. Tenant public files live somewhere else, so that link never reaches them.

Be careful with `Storage::disk('public')->url($path)`. The bootstrapper changes the disk's root but not its `url`, so the URL still points at `/storage/...`, the central folder, and you get a 404.

Use `tenant_asset()` instead. It points at a route stancl registers, `/tenancy/assets/{path}`, which serves the file from the current tenant's `storage/app/public` and rejects any path outside that folder:

```php
$logoUrl = tenant_asset('logos/'.$workspace->logo_path);
// https://acme.your-saas.com/tenancy/assets/logos/acme.png
```

On S3, return the disk's URL, or a `temporaryUrl()` for private files. The tenant prefix is already part of the path.

### asset() and your Vite build

With `asset_helper_tenancy` set to `true` (the default), `asset()` inside a tenant also points at `/tenancy/assets`. That's convenient for tenant files. The trouble is that Laravel's Vite integration builds its URLs with `asset()` too, so your compiled scripts and styles can end up being requested from the tenant storage folder.

stancl offers two fixes. You can set `asset_helper_tenancy` to `false` and call `tenant_asset()` explicitly for tenant files, or you can enable the `ViteBundler` feature, which makes Vite use `global_asset()`. Either way, test a production build (`npm run build`) on a tenant domain. The dev server won't show you this problem.

## Cleaning up

Deleting a tenant with stancl's default `DeleteDatabase` job drops the database, and that's all. It doesn't remove `storage/tenant42`, the `tenant42/` prefix on S3 or the cached entries. Add those steps to your deletion pipeline yourself; [Deleting Tenants Safely in Laravel](/blog/delete-tenant-laravel-safely.html) walks through it.

## Frequently asked questions

### Can I use the database cache driver with stancl/tenancy?

Not together with `CacheTenancyBootstrapper`. The database store doesn't support tags, so every tenant cache call would throw. Use Redis or Memcached for the cache, or drop the bootstrapper and add the tenant key to your cache keys yourself.

### Does Cache::flush() clear the cache for every tenant?

Not when you call it inside a tenant. With the cache bootstrapper, `Cache::flush()` flushes only the current tenant's tag. From the central context, or with `php artisan cache:clear` and no tags, it clears the whole store.

### Where are a tenant's uploaded files stored?

On the disks listed in `tenancy.filesystem.disks`, under a tenant folder: `storage/tenant42/app` for `local`, `storage/tenant42/app/public` for `public`, and a `tenant42/` prefix for cloud disks. Any other disk is shared.

### How do I share cached data between tenants?

Use `global_cache()`, which skips the tenant tag, or cache it from the central context. Keep shared data to things that really are identical for everyone, like plans or exchange rates.

## Cache and file isolation in SaaS Laravel

The [SaaS Laravel starter kits](/) already enable the database, cache, filesystem and queue bootstrappers. The `local` and `public` disks and `storage_path()` are suffixed per tenant (`storage/tenant{id}/...`), and each tenant database also gets its own `cache` and `cache_locks` tables. The test suite runs with the `array` cache store. The details are under [What is tenant-aware](/docs/core/multi-tenancy.html#what-is-tenant-aware) in the documentation.

<BlogPostCta title="Tenant isolation beyond the database" text="SaaS Laravel switches the database, cache, file disks and queued jobs per tenant, with Vue, React or Svelte on the same Laravel backend." />
