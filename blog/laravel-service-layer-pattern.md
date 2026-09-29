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

# The Laravel Service Layer: Where Your Business Logic Should Live

<BlogPostMeta />

Once an app grows past a few CRUD screens, the same workflow starts turning up in a controller, a seeder and an import command, each copy slightly different. A **Laravel service layer** is how we stop that. It's a set of plain PHP classes that hold your business logic, meaning the rules and workflows that make your product what it is. Controllers, jobs and Artisan commands call those classes instead of doing the work themselves.

Below we cover what a service class is, what should and shouldn't go in one, how to handle database transactions and side effects like emails and queued jobs, and the habits that slowly turn a clean service layer into a mess.

## What a Laravel service layer is

Laravel doesn't ship a `Services` folder or a base class for services. A service is simply a class you write, usually named after a feature: `ProjectService`, `InvoiceService`, `TeamService`. Each public method is one thing your application can do, like creating a project, cancelling an invoice or inviting a team member.

The idea behind it is that a use case lives in exactly one place. Say creating a project means inserting a row, attaching the owner as a member and setting up default settings. That sequence belongs in `ProjectService::create()`. It shouldn't be copied into a controller, a seeder and an import command.

What you get back is a single source of truth: change the rule once and every caller picks it up. A web form, an API endpoint, a queued job and a console command can all call the same method. Testing gets easier too, because you can call the method directly without faking an HTTP request.

## Writing your first service class

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

Look at what the method takes and gives back. In goes the acting user and a typed input object; out comes the model it created. It has no idea about the HTTP request, sessions, redirects or Inertia pages, and that's exactly why you can call it from anywhere.

All the caller has to do is pass the input along:

```php
public function store(ProjectData $data, ProjectService $projects): RedirectResponse
{
    $projects->create(auth()->user(), $data);

    return to_route('projects.index');
}
```

Keeping that caller small is a topic of its own, and we cover it in [thin controllers in Laravel](/blog/laravel-thin-controllers.html). The typed `ProjectData` input comes from [spatie/laravel-data](/blog/laravel-data-objects.html), though a plain validated array works as well.

## What belongs in a service class

Writing the class is the easy bit. Deciding what goes inside it is where teams disagree. We use this table as a rule of thumb:

| Belongs in a service | Belongs somewhere else |
| --- | --- |
| Multi-step workflows (create, provision, invite) | Reading the request or session (the controller does that) |
| Database writes that must succeed together | Validation rules: Form Requests or Data objects |
| Business rules ("a project can have at most 10 members on this plan") | Returning views, redirects or JSON |
| Calls to third-party APIs | Reusable query constraints: model scopes |
| Deciding which emails, events or jobs to trigger | Formatting data for the page: Data objects or resources |

Here's a quick test we like. Could you call the method from `php artisan tinker` with real arguments and have it work? Then it's a proper service method. If it needs `request()` to exist, an HTTP concern has leaked in.

## Transactions: keep related writes together

When a use case writes to more than one table, wrap those writes in `DB::transaction()`. If any statement throws an exception, Laravel rolls everything back, and you never end up with a project that has no owner.

The transaction lives in the service because the service is the only layer that knows which writes form one unit of work. A controller has no business knowing that creating a project touches three tables.

Keep transactions short. A transaction holds locks until it commits, so do the database work inside and everything slow outside. That also means no external API calls in there: a payment or email API call can't be rolled back, and a slow response keeps your locks open.

Let exceptions escape the closure, too. Throwing inside it is what triggers the rollback, so catching and ignoring errors in there defeats the point. And where it makes sense, retry on deadlocks: the second argument in `DB::transaction($callback, 3)` re-runs the closure when the database reports one.

## Side effects after the commit

Emails, notifications and queued jobs are the classic trap here. Send an invitation email inside a transaction, have the transaction roll back, and the user now has an email for an account that doesn't exist.

The simplest fix is ordering. Finish the transaction first, then trigger the side effects:

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

Queued jobs add a second problem. A worker can pick up a job before the transaction that created its data has committed, and then fail to find the row. Laravel offers three ways to wait for the commit, each with a different reach:

| Option | Scope |
| --- | --- |
| `dispatch(new SyncProject($project))->afterCommit()` | One dispatch |
| Implement `ShouldQueueAfterCommit` on the job, listener or notification | Every dispatch of that class |
| `'after_commit' => true` on the connection in `config/queue.php` | Every job on that queue connection |

We'd reach for `ShouldQueueAfterCommit` on classes that are always dispatched from inside a transaction, so nobody has to remember the per-call version. For anything that isn't a job, `DB::afterCommit(fn () => ...)` runs a callback once the current transaction commits, or straight away if no transaction is open.

## Services that use other services

Services can depend on each other through constructor injection. A `TeamService` that needs to assign roles can receive a `PermissionService` rather than writing to the permission tables itself.

Two rules keep this from getting tangled. First, depend on the other service, not on its tables. If team logic writes directly to the roles tables, a change in the permission feature breaks teams in ways nobody expects. Second, **point dependencies one way**. If `TeamService` needs `PermissionService`, then `PermissionService` must never need `TeamService`. A circular dependency usually means some responsibility sits in the wrong class.

In a feature-based codebase, this is the same line as the boundary between modules. Our [modular Laravel architecture guide](/blog/modular-laravel-architecture.html) shows how to keep those dependencies pointing in one direction.

## Service classes vs action classes

Some teams prefer action classes instead: one class per use case with a single method, such as `CreateProject::handle()` or `InviteTeamMember::handle()`. Fortify's own actions follow this style. `CreateNewUser` is one class with one `create()` method.

| | Service class | Action class |
| --- | --- | --- |
| Shape | Several related methods | One method |
| Good for | A feature with many use cases sharing helpers | Large, isolated use cases |
| Risk | Grows into a "god class" | Many tiny files to keep track of |

Both count as a service layer. Pick one style per project. Our default is services, and we extract an action only when a single method grows too large.

## Mistakes that erode a service layer

These are the signs we look for when a service layer starts drifting.

The most common one is a service that reads `request()` or `auth()` internally. Pass the user and the input in as arguments instead. Close behind it is a service that returns responses: a `RedirectResponse` or `Inertia::render()` in a service ties it to HTTP.

Pass-through services are a milder problem. A method that only calls `Project::create($data)` adds a file without adding value. Starting simple is fine; add the service when real logic shows up.

At the other extreme sits the god service. A 1,500-line `UserService` handling profiles, billing and exports is three services waiting to be split.

Static methods everywhere are another smell. Static calls can't receive injected dependencies and are awkward to swap in tests.

Finally, watch for queries copied between services. If several services build the same complex query, move it into a model scope or, if it truly earns it, a [repository](/blog/laravel-repository-pattern.html).

## Frequently asked questions

### Do I need a service layer in a small Laravel app?

No. When a controller method is three lines of Eloquent, a service adds a file without adding clarity. Bring services in when a use case has several steps, needs a transaction, or gets called from more than one place.

### Should service methods accept arrays or objects?

We prefer typed objects. They're easier to read and refactor, because your editor and static analysis know exactly which fields exist. Validated arrays work too, but document their shape with a PHPDoc array type so the next developer doesn't have to guess.

### Should a service class be a singleton?

Usually it doesn't matter. Keep services stateless, with no properties that change between calls, and the container can create them as often as it likes. Bind one as a singleton only when it's expensive to build or deliberately caches something for the request.

### Can a service throw a validation error?

Yes, for business rules that can only be checked mid-workflow, such as a name another tenant claimed a moment ago. Throwing `ValidationException::withMessages()` from the service shows the error on the right form field in both Blade and Inertia apps.

## How SaaS Laravel uses a service layer

In the SaaS Laravel kits, every feature module has its own services, among them `TenantService`, `DomainService`, `UserService`, `RoleService`, `PermissionService`, `MenuService` and `LayoutService`. Controllers pass Data objects into them. The services own the transactions: `UserService::createUser()`, for example, saves the user and assigns the role in one `DB::transaction()` and sends the invitation email only after it commits. Cross-module work goes through injection, such as `UserService` receiving `PermissionService`. If you want to see how the layers fit together, the [architecture documentation](/docs/core/architecture.html) describes them.

<BlogPostCta title="Start from a clean service layer" text="SaaS Laravel gives you feature modules with services, Data objects and thin controllers, plus multi-tenancy, authentication and permissions, in Vue, React or Svelte." />
