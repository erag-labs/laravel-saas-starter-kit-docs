---
title: "Backups for a Multi-Database Laravel SaaS"
description: "A Laravel database backup strategy for database-per-tenant SaaS apps: what to back up, dumping every tenant, retention, and restoring a single customer."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Multi-tenancy, Operations]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-multi-database-backups.html
  - - meta
    - property: og:title
      content: "Backups for a Multi-Database Laravel SaaS"
  - - meta
    - property: og:description
      content: "A Laravel database backup strategy for database-per-tenant SaaS apps: what to back up, dumping every tenant, retention, and restoring a single customer."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-multi-database-backups.html
  - - meta
    - name: twitter:title
      content: "Backups for a Multi-Database Laravel SaaS"
  - - meta
    - name: twitter:description
      content: "A Laravel database backup strategy for database-per-tenant SaaS apps: what to back up, dumping every tenant, retention, and restoring a single customer."
---

# Laravel Database Backup Strategy for Database-per-Tenant SaaS Apps

<BlogPostMeta />

A **Laravel database backup** is easy when there is one database: dump it every night and copy it somewhere safe. A database-per-tenant SaaS has a central database plus one database per customer, and the list grows every time someone signs up. This guide covers what to back up, how to find and dump every tenant database, how to keep backups consistent, where to store them, and how to restore one customer without touching anyone else.

## What to back up

The databases are only part of it. A complete backup of a multi-tenant Laravel app has five parts:

| Part | Where it lives | Notes |
| --- | --- | --- |
| Central database | One database | Tenants, domains, platform users, settings, queued jobs |
| Tenant databases | One per tenant | The customers' actual data |
| Tenant files | Local disk or object storage | With stancl/tenancy's filesystem bootstrapper, each tenant has its own folder under `storage` |
| `.env` and `APP_KEY` | The server | Without the key, encrypted columns such as 2FA secrets can't be read |
| Server configuration | nginx, Supervisor, cron | Easier to rebuild if it's in version control |

Keep `.env` backups separate from the database dumps and encrypt them. A leaked dump together with its `APP_KEY` exposes far more than a dump alone.

## Why one big dump isn't enough

You could run `mysqldump --all-databases` and call it done. The problem appears on the day you need it. Customers rarely lose *everything*; one customer deletes a project by accident, or one tenant's data gets corrupted by a bad import. Restoring that single tenant from one huge file means extracting one database from a dump of all of them.

Dumping **each database to its own file** keeps the main advantage of database-per-tenant: you can restore one customer and leave everyone else alone.

## Find the tenant databases from the central database

Don't discover tenant databases with `SHOW DATABASES LIKE 'tenant%'`. A prefix match can pick up databases from other apps on the same server, and it misses databases with custom names. The central database already knows the truth.

stancl/tenancy stores each tenant's database name in the tenant record when the database is created, and `$tenant->database()->getName()` returns it:

```php
$databases = collect([config('database.connections.mysql.database')]); // central first

Tenant::query()->cursor()->each(function (Tenant $tenant) use ($databases) {
    $databases->push($tenant->database()->getName());
});
```

## Dump each database

Use `mysqldump` with `--single-transaction`, which takes a consistent snapshot of InnoDB tables without locking them, so customers can keep working. Put the credentials in an option file instead of on the command line, where other users of the server could see them in the process list:

```php
function dumpDatabase(string $database, string $dir): void
{
    $file = "{$dir}/{$database}.sql";

    Process::timeout(900)->run([
        'mysqldump', '--defaults-extra-file=/etc/mysql/backup.cnf',
        '--single-transaction', "--result-file={$file}", $database,
    ])->throw();

    Process::run(['gzip', $file])->throw();
}
```

Passing the command as an array avoids shell escaping, and `throw()` turns a failed dump into an exception instead of a silently empty file. On PostgreSQL, `pg_dump --format=custom` plays the same role.

## Keep central and tenant backups consistent

The central database and the tenant databases are dumped at slightly different moments. Two rules keep that gap harmless:

1. **Dump the central database first**, then dump exactly the tenants listed in it. A tenant created during the run simply appears in the next backup.
2. **Record what you dumped.** Write a small manifest (tenant ID, database name, file, size, timestamp) next to the files. When you restore, you know which dump belongs to which tenant without guessing from file names.

## Scheduling the Laravel database backup

For a few dozen tenants, one scheduled command that loops over every database is fine:

```php
Schedule::command('backup:databases')
    ->dailyAt('03:00')
    ->withoutOverlapping()
    ->onOneServer();
```

With hundreds of tenants, dispatch one queued job per tenant instead. A failed dump then retries on its own without holding up the others, and you can spread the load over several workers. Alert on failures: a backup that has quietly failed for three weeks is worse than none, because everyone believes it exists.

## Storage, encryption and retention

- **Off-site.** Copy backups to object storage in a different account or region from your servers. A backup on the same disk dies with the disk.
- **Encrypted.** Encrypt dumps before upload, or use server-side encryption with keys you control.
- **Write-protected.** The server that creates backups shouldn't be able to delete old ones. Versioning or object lock on the bucket protects you against a compromised server or a buggy cleanup script.

A simple rotation keeps storage costs predictable:

| Keep | For |
| --- | --- |
| Daily backups | 7–14 days |
| Weekly backups | 4–8 weeks |
| Monthly backups | 6–12 months, or what your contracts require |

## Managed database snapshots

Managed databases usually offer automatic snapshots and point-in-time recovery from binary logs or WAL. Use them: they are excellent for disasters, such as a lost server or a bad migration across every tenant.

They are clumsy for a single tenant, though, because a snapshot restores the whole instance. To recover one customer from a snapshot, restore it to a temporary instance, dump that one tenant's database, and import it into production. Per-tenant dumps make this a one-step job, which is why many teams keep both.

## Restoring a single tenant

1. **Pause the tenant**, so nobody writes data during the restore. A per-tenant maintenance flag is ideal; see [maintenance mode for multi-tenant Laravel apps](/blog/laravel-multi-tenant-maintenance-mode.html).
2. **Keep the current database**, by renaming it or dumping it first. You may need something from it later.
3. **Import the backup** into an empty database with the tenant's database name.
4. **Check the central records.** The tenant row and its domains must still exist in the central database, and point to that database name.
5. **Clear that tenant's cache**, then reopen the workspace and check it as the customer would.

```bash
gunzip < tenant42.sql.gz | mysql --defaults-extra-file=/etc/mysql/backup.cnf tenant42
```

If your schema has moved on since the backup, run your tenant migrations for that tenant after the import.

## Test your restores

A backup you've never restored is a guess. Once a month, restore a random tenant and the central database to a staging server, sign in, and open a few pages. Time it, too: "how long until this customer is back?" is the first question you'll be asked.

## Before you delete a tenant

With stancl/tenancy's default event setup, deleting a tenant drops its database in the same request. Take a final dump first and keep it for your retention period. The full process is in [deleting tenants safely](/blog/delete-tenant-laravel-safely.html).

## Frequently asked questions

### How often should I back up a multi-tenant Laravel app?

Daily dumps are the minimum for a SaaS. If losing a day of customer data is unacceptable, add point-in-time recovery from your database provider, so you can restore to any moment between dumps.

### Can I restore one tenant without affecting the others?

Yes, if each tenant database is dumped to its own file. Pause that tenant, import its dump into its database, and the other tenants never notice.

### Is mysqldump safe to run on a live database?

For InnoDB tables, `--single-transaction` gives a consistent snapshot without locking tables, so the app keeps working. Schedule dumps outside peak hours anyway, because they add load.

### Do I need to back up the APP_KEY?

Yes, separately and securely. Laravel uses it to decrypt encrypted data such as 2FA secrets and encrypted casts. A database restored without the matching key is only partly usable.

## Backups and SaaS Laravel

The SaaS Laravel kits don't include a backup tool, so plan one with the steps above before launch. What the kits do tell you: the central database is the one in `DB_DATABASE`, and tenant databases are named `tenant1`, `tenant2` and so on, from the tenancy prefix and the tenant ID. Tenant files on the local and public disks live under `storage/tenant<id>`. Deleting a tenant in the admin area drops its database straight away. Running `migrate:fresh` on the central database does not drop tenant databases. See the [database documentation](/docs/core/database.html), what to plan in [deploying a Laravel SaaS](/blog/deploy-laravel-saas.html), or the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html).

<BlogPostCta title="One database per customer" text="SaaS Laravel gives every tenant its own database with stancl/tenancy, so you can back up and restore customers one by one, in Vue, React or Svelte." />
