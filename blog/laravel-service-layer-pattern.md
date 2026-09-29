---
title: "The Service Layer Pattern in Laravel"
description: "The Laravel service layer explained: what belongs in a service class, how to use transactions, when to send emails and jobs, and mistakes to avoid."
pageClass: blog-page
date: 2026-09-29
author: erag
category: architecture
tags: [Architecture, Code quality]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-service-layer-pattern.html
  - - meta
    - property: og:title
      content: "The Service Layer Pattern in Laravel"
  - - meta
    - property: og:description
      content: "The Laravel service layer explained: what belongs in a service class, how to use transactions, when to send emails and jobs, and mistakes to avoid."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-service-layer-pattern.html
  - - meta
    - name: twitter:title
      content: "The Service Layer Pattern in Laravel"
  - - meta
    - name: twitter:description
      content: "The Laravel service layer explained: what belongs in a service class, how to use transactions, when to send emails and jobs, and mistakes to avoid."
---

# Laravel Service Layer: Where Your Business Logic Should Live

<BlogPostMeta />

A **Laravel service layer** is a set of plain PHP classes that hold your business logic — the rules and workflows that make your product what it is. Controllers, jobs and Artisan commands call those classes instead of doing the work themselves.

This guide explains what a service class is, what belongs in it (and what doesn't), how to handle database transactions and side effects like emails and queued jobs, and the mistakes that turn a clean service layer into a mess.

## What a Laravel service layer is

Laravel doesn't ship a `Services` folder or a base class for services. A service is just a class you write, usually named after a feature: `ProjectService`, `InvoiceService`, `TeamService`. Each public method is one thing your application can do: create a project, cancel an invoice, invite a team member.

The idea is simple: a use case should live in exactly one place. If creating a project means inserting a row, attaching the owner as a member and setting up default settings, that sequence belongs in `ProjectService::create()`, not copied into a controller, a seeder and an import command.

You get three things from that:

- **One source of truth.** Change the rule once and every caller gets it.
- **Reuse.** A web form, an API endpoint, a queued job and a console command can all call the same method.
- **Testability.** You can test the logic by calling the method directly, without faking an HTTP request.

## A service class, step by step

A service is an ordinary class. Laravel's container builds it for you, so you can type-hint it anywhere and inject its own dependencies through the constructor:

```php
class ProjectService
{
    public function create(User $owner, ProjectData $data): Project
    {
        return DB::transaction(function () use ($owner, $data): Project {
            $project = $owner->projects()->create(['name' => $data->name]);

            $project->members()->attach($owner, ['role' => 'owner']);
            $project->settings()->create(['visibility' => 'private']);

            return $project;
        });
    }
}
```

Notice what the method receives and returns. It takes the acting user and a typed input object, and it returns the model it created. It knows nothing about the HTTP request, sessions, redirects or Inertia pages. That is what makes it callable from anywhere.

The caller only has to pass the input along:

```php
public function store(ProjectData $data, ProjectService $projects): RedirectResponse
{
    $projects->create(auth()->user(), $data);

    return to_route('projects.index');
}
```

Keeping that caller small is its own topic, covered in [thin controllers in Laravel](/blog/laravel-thin-controllers.html). The typed `ProjectData` input comes from [spatie/laravel-data](/blog/laravel-data-objects.html), but a plain validated array works too.

## What belongs in a service class

The hardest part of a service layer isn't writing the class. It's deciding what goes inside it. This table is a good rule of thumb:

| Belongs in a service | Belongs somewhere else |
| --- | --- |
| Multi-step workflows (create, provision, invite) | Reading the request or session — the controller does that |
| Database writes that must succeed together | Validation rules — Form Requests or Data objects |
| Business rules ("a project can have at most 10 members on this plan") | Returning views, redirects or JSON |
| Calls to third-party APIs | Reusable query constraints — model scopes |
| Deciding which emails, events or jobs to trigger | Formatting data for the page — Data objects or resources |

A useful test: if you can imagine calling the method from `php artisan tinker` with real arguments and it works, it's a proper service method. If it needs `request()` to exist, some HTTP concern has leaked in.

## Transactions: keep related writes together

When a use case writes to more than one table, wrap the writes in `DB::transaction()`. If any statement throws an exception, Laravel rolls back everything, so you never end up with a project that has no owner.

The transaction belongs in the service, because the service is the only layer that knows which writes form one unit of work. A controller shouldn't know that creating a project touches three tables.

A few rules keep transactions healthy:

- **Keep them short.** A transaction holds locks until it commits. Do the database work inside, and everything slow outside.
- **Don't call external APIs inside.** A payment or email API call can't be rolled back, and a slow response keeps your locks open.
- **Let exceptions escape.** Throwing inside the closure is what triggers the rollback. Don't catch and ignore errors inside it.
- **Retry on deadlocks when it makes sense.** The second argument, `DB::transaction($callback, 3)`, re-runs the closure when the database reports a deadlock.

## Side effects after the commit

Emails, notifications and queued jobs are the classic trap. If you send an invitation email inside a transaction and the transaction then rolls back, the user gets an email for an account that doesn't exist.

The simplest fix is ordering: finish the transaction first, then trigger the side effects.

```php
public function invite(Team $team, InviteData $data): User
{
    $user = DB::transaction(function () use ($team, $data): User {
        $user = User::create(['name' => $data->name, 'email' => $data->email]);
        $team->members()->attach($user);

        return $user;
    });

    $user->notify(new TeamInvitation($team)); // only runs after a successful commit

    return $user;
}
```

Queued jobs have a second problem: a worker can pick up a job before the transaction that created its data has committed, and then fail to find the row. Laravel gives you three ways to wait for the commit:

| Option | Scope |
| --- | --- |
| `dispatch(new SyncProject($project))->afterCommit()` | One dispatch |
| Implement `ShouldQueueAfterCommit` on the job, listener or notification | Every dispatch of that class |
| `'after_commit' => true` on the connection in `config/queue.php` | Every job on that queue connection |

For anything that isn't a job, `DB::afterCommit(fn () => ...)` runs a callback after the current transaction commits, or immediately if there is no open transaction.

## Services that use other services

Services can depend on each other through constructor injection. A `TeamService` that needs to assign roles can receive a `PermissionService` instead of writing to the permission tables itself.

Two rules prevent this from getting tangled:

1. **Depend on another service, not on its tables.** If team logic writes directly to the roles tables, a change in the permission feature breaks teams in ways nobody expects.
2. **Point dependencies one way.** If `TeamService` needs `PermissionService`, `PermissionService` must never need `TeamService`. Circular dependencies are a sign that a responsibility sits in the wrong class.

In a feature-based codebase, this is exactly the boundary between modules. The [modular Laravel architecture guide](/blog/modular-laravel-architecture.html) shows how to keep those dependencies pointing in one direction.

## Service classes vs action classes

Some teams prefer **action classes**: one class per use case with a single method, such as `CreateProject::handle()` or `InviteTeamMember::handle()`. Fortify's own actions follow this style — `CreateNewUser` is one class with one `create()` method.

| | Service class | Action class |
| --- | --- | --- |
| Shape | Several related methods | One method |
| Good for | A feature with many use cases sharing helpers | Large, isolated use cases |
| Risk | Grows into a "god class" | Many tiny files to navigate |

Both are a service layer. Pick one style per project, or use services by default and extract an action when a single method grows too large.

## Common mistakes

Watch for these signs that your service layer is drifting:

- **Services that read `request()` or `auth()` internally.** Pass the user and the input in as arguments instead.
- **Services that return responses.** `RedirectResponse` or `Inertia::render()` in a service ties it to HTTP.
- **Pass-through services.** A method that only calls `Project::create($data)` adds a file without adding value. It's fine to start simple and add the service when real logic appears.
- **God services.** A 1,500-line `UserService` that handles profiles, billing and exports is three services waiting to be split.
- **Static methods everywhere.** Static calls can't receive injected dependencies and are awkward to swap in tests.
- **Queries copied between services.** If several services build the same complex query, move it into a model scope or, if it really earns it, a [repository](/blog/laravel-repository-pattern.html).

## Frequently asked questions

### Do I need a service layer in a small Laravel app?

No. If a controller method is three lines of Eloquent, a service adds a file without adding clarity. Introduce services when a use case has several steps, needs a transaction, or is called from more than one place.

### Should service methods accept arrays or objects?

Typed objects are easier to read and refactor, because your editor and static analysis know exactly which fields exist. Validated arrays work too, but document their shape with a PHPDoc array type so the next developer doesn't have to guess.

### Should a service class be a singleton?

Usually it doesn't matter. Keep services stateless — no properties that change between calls — and the container can create them as often as it likes. Bind one as a singleton only when it's expensive to build or deliberately caches something for the request.

### Can a service throw a validation error?

Yes, for business rules that can only be checked during the workflow, such as a name that another tenant claimed a moment ago. Throwing `ValidationException::withMessages()` from the service shows the error on the right form field in both Blade and Inertia apps.

## How SaaS Laravel uses a service layer

In the SaaS Laravel kits, every feature module has its own services — `TenantService`, `DomainService`, `UserService`, `RoleService`, `PermissionService`, `MenuService` and `LayoutService` among them — and controllers pass Data objects into them. Services own the transactions (for example, `UserService::createUser()` saves the user and assigns the role in one `DB::transaction()` and sends the invitation email only after it commits), and cross-module work goes through injection, such as `UserService` receiving `PermissionService`. The layers are described in the [architecture documentation](/docs/core/architecture.html).

<BlogPostCta title="Start from a clean service layer" text="SaaS Laravel gives you feature modules with services, Data objects and thin controllers, plus multi-tenancy, authentication and permissions, in Vue, React or Svelte." />
