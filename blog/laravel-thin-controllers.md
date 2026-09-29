---
title: "Thin Controllers in Laravel"
description: "How to write Laravel thin controllers: the four jobs a controller has, Form Requests, authorization attributes, clean responses and a fat controller refactor."
pageClass: blog-page
date: 2026-09-29
author: erag
category: architecture
tags: [Architecture, Code quality]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-thin-controllers.html
  - - meta
    - property: og:title
      content: "Thin Controllers in Laravel"
  - - meta
    - property: og:description
      content: "How to write Laravel thin controllers: the four jobs a controller has, Form Requests, authorization attributes, clean responses and a fat controller refactor."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-thin-controllers.html
  - - meta
    - name: twitter:title
      content: "Thin Controllers in Laravel"
  - - meta
    - name: twitter:description
      content: "How to write Laravel thin controllers: the four jobs a controller has, Form Requests, authorization attributes, clean responses and a fat controller refactor."
---

# Laravel Thin Controllers: Keeping Controller Methods Small and Readable

<BlogPostMeta />

Most Laravel apps start out with tidy controllers and end up with 80-line `store()` methods that validate, authorize, query, send emails and build responses all at once. **Laravel thin controllers** fix that by giving the controller one narrow job: turn an HTTP request into a call to your application, then turn the result back into a response.

Below we look at the four things a controller should do, how to tell when one has grown too fat, a refactor from start to finish, how to get more out of Form Requests and authorization, and what's allowed to stay in the controller.

## What Laravel thin controllers do

A thin controller method does four things, in this order:

| Step | Question it answers | Where the work happens |
| --- | --- | --- |
| Authorize | May this user do this? | Route middleware, controller attributes or `FormRequest::authorize()` |
| Validate | Is the input acceptable? | A Form Request (or a Data object) |
| Delegate | Do the actual work | A service or action class |
| Respond | What does the user see next? | The controller itself |

Only the last step is written in the method body. The first two happen before your code runs, and the third is a single method call. What's left is a method you can read in five seconds.

## Signs your controller is too fat

Open your biggest controller and go through these questions. Every "yes" points at something to move out.

Does it call `$request->validate()` with more than a couple of rules? Does it contain `DB::transaction()`, or several `create()`/`update()` calls in a row? Does it send mail, dispatch jobs or call an external API? Does it build a query with more than one or two conditions?

Then look beyond the method itself. If the same logic also exists in a job, a command or another controller, it needs a shared home. Private helper methods that aren't about building responses are another giveaway. And if you can't test a business rule without making an HTTP request, that rule is in the wrong place.

## Refactoring a fat controller, step by step

Here's a typical fat method for opening a support ticket:

```php
public function store(Request $request)
{
    abort_unless($request->user()->can('create', Ticket::class), 403);
    $validated = $request->validate([
        'subject' => ['required', 'string', 'max:200'],
        'body' => ['required', 'string'],
    ]);
    $ticket = DB::transaction(function () use ($request, $validated) {
        $ticket = $request->user()->tickets()->create(['subject' => $validated['subject']]);
        $ticket->messages()->create(['user_id' => $request->user()->id, 'body' => $validated['body']]);
        return $ticket;
    });
    Notification::send(User::role('support')->get(), new TicketOpened($ticket));
    return redirect()->route('tickets.show', $ticket)->with('success', 'Ticket opened.');
}
```

It works. The problem is that four concerns are tangled together, so we'll pull them apart one at a time.

### 1. Move validation into a Form Request

Run `php artisan make:request StoreTicketRequest` and move the rules into its `rules()` method. Once you type-hint the request, Laravel validates it before the method runs.

### 2. Move authorization out of the body

You have three options here: a Form Request's `authorize()` method, a `can:` route middleware or, in Laravel 13, an attribute on the method (shown below).

### 3. Move the work into a service

The transaction and the notification are business logic. They belong in `TicketService::open()`, where a queued job or an email-to-ticket importer can reuse them. Our [guide to the Laravel service layer](/blog/laravel-service-layer-pattern.html) covers what goes inside that class.

### 4. Keep the response

Picking the redirect and the flash message is the controller's job, so that part stays.

Here's where we end up:

```php
#[Authorize('create', Ticket::class)]
public function store(StoreTicketRequest $request, TicketService $tickets): RedirectResponse
{
    $ticket = $tickets->open($request->user(), $request->validated());

    return to_route('tickets.show', $ticket)->with('success', __('Ticket opened.'));
}
```

The behaviour hasn't changed. Each piece just lives where you'd go looking for it.

## Form Requests do more than hold rules

For keeping a controller thin, the Form Request is the most useful tool you have. Beyond `rules()`, it offers hooks that take even more code out of the method:

| Method | Use it for |
| --- | --- |
| `authorize()` | Returning `false` sends a 403 before the controller runs |
| `attributes()` | Human-friendly or translated field names in error messages |
| `messages()` | Custom messages for specific rules |
| `prepareForValidation()` | Normalising input first, such as trimming a slug or lowercasing an email |
| `after()` | Extra checks after the normal rules have passed |

Inside the controller, `$request->validated()` returns only the validated fields, `$request->validated('subject')` returns a single one, and `$request->safe()->only(['subject'])` returns a subset. **Never pass `$request->all()` to a model**, because it includes fields you didn't validate.

When several requests share rules (say a profile form and a registration form both validate `email`), we put those rules in a trait and use it in both classes rather than copying them.

The alternative to Form Requests is a typed Data object that validates itself. We compare the two approaches in [Laravel Data objects with spatie/laravel-data](/blog/laravel-data-objects.html).

## Authorization outside the method body

An authorization check inside the method is easy to forget on the next action you add. We'd rather put checks somewhere they apply automatically.

Route middleware is the most familiar option: `->middleware('can:update,ticket')` on the route, or a package middleware such as `permission:Edit Tickets` from spatie/laravel-permission. Laravel 13 adds controller attributes, `#[Middleware]` and `#[Authorize]`, which you can place on the class or on a single method. Class-level attributes accept `only` and `except`. The Form Request's `authorize()` is still handy when the check depends on the input itself.

```php
use Illuminate\Routing\Attributes\Controllers\Authorize;
use Illuminate\Routing\Attributes\Controllers\Middleware;

#[Middleware('auth')]
class TicketController extends Controller
{
    #[Authorize('update', 'ticket')]
    public function update(UpdateTicketRequest $request, Ticket $ticket, TicketService $tickets): RedirectResponse
    {
        // ...
    }
}
```

The second argument of `#[Authorize]` names the route parameter (`ticket`), so the policy receives the bound model.

## What can stay in the controller

Thin doesn't mean empty. Some things are HTTP concerns, and they belong in the controller.

Reading query-string filters like `search`, `status` or `sort` and passing them on to a service or query is one. Choosing the response is another: which Inertia page to render, which props to send, where to redirect. Flash messages and toasts after a successful action live here too.

So do request-specific guards, such as "you can't delete your own account". Those should return an error to the form rather than throw from deep inside a service.

Even with filters, a typical index method stays readable:

```php
public function index(Request $request, TicketService $tickets): Response
{
    $search = $request->string('search')->trim()->value() ?: null;

    return Inertia::render('tickets/Index', [
        'tickets' => $tickets->paginate($search),
        'filters' => ['search' => $search ?? ''],
    ]);
}
```

## Resource and single-action controllers

Controllers can also grow sideways, collecting more and more actions. Two conventions help.

First, stick to the resource methods. `index`, `create`, `store`, `show`, `edit`, `update` and `destroy` cover most screens. When you need `approve` or `archive`, consider a small dedicated controller such as `TicketArchiveController`.

Second, use single-action controllers for one-off endpoints. `php artisan make:controller CloseTicketController --invokable` creates a class with only `__invoke()`, which you register with `Route::post('tickets/{ticket}/close', CloseTicketController::class)`.

Services can be injected through the constructor or the method, and both work. Method injection keeps each action's dependencies visible, while constructor injection saves you repeating the same service in every method. We lean towards method injection when a controller's actions use different services, and the constructor when they all share one.

## Frequently asked questions

### How long should a controller method be?

There's no official limit, but most thin controller methods fit in 5 to 15 lines. If a method needs comments to explain its steps, those steps probably belong in a service.

### Is it wrong to use Eloquent directly in a controller?

Not for simple reads. `Ticket::latest()->paginate()` in an index method is perfectly clear. Move a query out once it grows conditions, gets reused, or gets mixed up with writes and side effects.

### Where should flash messages be set?

In the controller, after the service call succeeds. The message describes what the user sees next, which makes it a response concern. A service shouldn't even know that toasts exist.

### Do thin controllers make testing easier?

Yes. You can test the business logic by calling the service directly, and your feature tests only need to check authorization, validation and the response.

## Thin controllers in SaaS Laravel

The SaaS Laravel kits follow this shape across their modules. A typical method such as `TenantController::store()` receives a validated Data object, calls `TenantService`, flashes a toast with `Inertia::flash()` and redirects. Smaller forms use Form Requests like `PasswordUpdateRequest`, authorization comes from `permission:` route middleware, and shared validation rules live in traits such as `ProfileValidationRules`. The [architecture documentation](/docs/core/architecture.html) describes each layer, and our [modular Laravel architecture guide](/blog/modular-laravel-architecture.html) shows how the modules are organised.

<BlogPostCta title="Controllers that stay small" text="SaaS Laravel ships feature modules with thin controllers, services and typed Data objects, plus multi-tenancy, authentication and permissions, in Vue, React or Svelte." />
