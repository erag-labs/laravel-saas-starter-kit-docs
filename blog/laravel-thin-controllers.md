---
title: "Thin Controllers in Laravel"
description: "How to write Laravel thin controllers: the four jobs a controller has, Form Requests, authorization attributes, clean responses and a fat controller refactor."
pageClass: blog-page
date: 2026-09-29
author: erag
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

# Laravel Thin Controllers: Small, Readable Controller Methods

<BlogPostMeta />

Most Laravel apps start with tidy controllers and end up with 80-line `store()` methods that validate, authorize, query, send emails and build responses all at once. **Laravel thin controllers** fix that by giving the controller one narrow job: translate an HTTP request into a call to your application, and translate the result back into a response.

This guide covers the four things a controller should do, the signs a controller has grown too fat, a step-by-step refactor, how to get the most out of Form Requests and authorization, and what is allowed to stay in the controller.

## What Laravel thin controllers do

A thin controller method does four things, in this order:

| Step | Question it answers | Where the work happens |
| --- | --- | --- |
| **Authorize** | May this user do this? | Route middleware, controller attributes or `FormRequest::authorize()` |
| **Validate** | Is the input acceptable? | A Form Request (or a Data object) |
| **Delegate** | Do the actual work | A service or action class |
| **Respond** | What does the user see next? | The controller itself |

Only the last step is written in the method body. The first two happen before your code runs, and the third is a single method call. The result is a method you can read in five seconds.

## Signs your controller is too fat

Use this checklist on your biggest controller. Each "yes" is something to move out:

- It calls `$request->validate()` with more than a couple of rules.
- It contains `DB::transaction()` or several `create()`/`update()` calls in a row.
- It sends mail, dispatches jobs or calls an external API.
- It builds a query with more than one or two conditions.
- The same logic also exists in a job, command or another controller.
- It has private helper methods that aren't about building responses.
- You can't test the business rule without making an HTTP request.

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

It works, but four concerns are mixed together. Let's pull them apart.

**1. Move validation into a Form Request.** Run `php artisan make:request StoreTicketRequest` and move the rules into its `rules()` method. Type-hinting the request validates it before the method runs.

**2. Move authorization out of the body.** Use a Form Request's `authorize()` method, a `can:` route middleware or, in Laravel 13, an attribute on the method (shown below).

**3. Move the work into a service.** The transaction and the notification are business logic. They belong in `TicketService::open()`, where a queued job or an email-to-ticket importer can reuse them. The [Laravel service layer guide](/blog/laravel-service-layer-pattern.html) covers what goes inside that class.

**4. Keep the response.** Choosing the redirect and the flash message is the controller's job.

The result:

```php
#[Authorize('create', Ticket::class)]
public function store(StoreTicketRequest $request, TicketService $tickets): RedirectResponse
{
    $ticket = $tickets->open($request->user(), $request->validated());

    return to_route('tickets.show', $ticket)->with('success', __('Ticket opened.'));
}
```

Same behaviour, but each piece now lives where you'd look for it.

## Form Requests do more than hold rules

A Form Request is the controller's best tool for staying thin. Beyond `rules()`, it has hooks that remove more code from the method:

| Method | Use it for |
| --- | --- |
| `authorize()` | Returning `false` sends a 403 before the controller runs |
| `attributes()` | Human-friendly or translated field names in error messages |
| `messages()` | Custom messages for specific rules |
| `prepareForValidation()` | Normalising input first, such as trimming a slug or lowercasing an email |
| `after()` | Extra checks after the normal rules have passed |

In the controller, `$request->validated()` returns only validated fields, `$request->validated('subject')` returns one of them, and `$request->safe()->only(['subject'])` returns a subset. Never pass `$request->all()` to a model — it includes fields you didn't validate.

If several requests share rules (a profile form and a registration form both validate `email`), put the rules in a trait and use it in both classes instead of copying them.

An alternative to Form Requests is a typed Data object that validates itself. The trade-offs are covered in [Laravel Data objects with spatie/laravel-data](/blog/laravel-data-objects.html).

## Authorization outside the method body

Authorization checks inside the method are easy to forget on the next action you add. Put them where they apply automatically:

- **Route middleware.** `->middleware('can:update,ticket')` on the route, or a package middleware such as `permission:Edit Tickets` from spatie/laravel-permission.
- **Controller attributes (Laravel 13).** `#[Middleware]` and `#[Authorize]` can be placed on the class or on a method. Class-level attributes accept `only` and `except`.
- **Form Request `authorize()`.** Useful when the check depends on the input itself.

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

## What is allowed to stay in the controller

Thin doesn't mean empty. These are HTTP concerns, and they belong in the controller:

- **Reading query-string filters** like `search`, `status` or `sort`, and passing them to a service or query.
- **Choosing the response:** which Inertia page to render, which props to send, where to redirect.
- **Flash messages and toasts** after a successful action.
- **Request-specific guards** such as "you can't delete your own account", which return an error to the form rather than throwing deep inside a service.

A typical index method stays readable even with filters:

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

Two conventions keep controllers from growing sideways:

- **Stick to the resource methods.** `index`, `create`, `store`, `show`, `edit`, `update` and `destroy` cover most screens. When you need `approve` or `archive`, consider a small dedicated controller, such as `TicketArchiveController`.
- **Use single-action controllers for one-off endpoints.** `php artisan make:controller CloseTicketController --invokable` creates a class with just `__invoke()`, which you register with `Route::post('tickets/{ticket}/close', CloseTicketController::class)`.

Constructor or method injection both work for services. Method injection keeps each action's dependencies visible; constructor injection avoids repeating the same service in every method.

## Frequently asked questions

### How long should a controller method be?

There's no official limit, but most thin controller methods fit in 5 to 15 lines. If a method needs comments to explain its steps, those steps probably belong in a service.

### Is it wrong to use Eloquent directly in a controller?

Not for simple reads. `Ticket::latest()->paginate()` in an index method is perfectly clear. Move queries out when they grow conditions, get reused, or mix with writes and side effects.

### Where should flash messages be set?

In the controller, after the service call succeeds. The message describes what the user sees next, which is a response concern — a service shouldn't know that a toast exists.

### Do thin controllers make testing easier?

Yes. The business logic can be tested by calling the service directly, while feature tests only need to check authorization, validation and the response.

## Thin controllers in SaaS Laravel

The SaaS Laravel kits follow this shape across their modules. A typical method such as `TenantController::store()` receives a validated Data object, calls `TenantService`, flashes a toast with `Inertia::flash()` and redirects. Smaller forms use Form Requests like `PasswordUpdateRequest`, authorization is applied with `permission:` route middleware, and shared validation rules live in traits such as `ProfileValidationRules`. The [architecture documentation](/docs/core/architecture.html) describes each layer, and the [modular Laravel architecture guide](/blog/modular-laravel-architecture.html) shows how the modules are organised.

<BlogPostCta title="Controllers that stay small" text="SaaS Laravel ships feature modules with thin controllers, services and typed Data objects, plus multi-tenancy, authentication and permissions, in Vue, React or Svelte." />
