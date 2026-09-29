---
title: "Laravel Data Objects with spatie/laravel-data"
description: "A practical spatie laravel data guide: build typed Data objects, validate requests, map snake_case fields, handle relations and send clean props to Inertia."
pageClass: blog-page
date: 2026-09-29
author: erag
category: architecture
tags: [Architecture, Code quality]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-data-objects.html
  - - meta
    - property: og:title
      content: "Laravel Data Objects with spatie/laravel-data"
  - - meta
    - property: og:description
      content: "A practical spatie laravel data guide: build typed Data objects, validate requests, map snake_case fields, handle relations and send clean props to Inertia."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-data-objects.html
  - - meta
    - name: twitter:title
      content: "Laravel Data Objects with spatie/laravel-data"
  - - meta
    - name: twitter:description
      content: "A practical spatie laravel data guide: build typed Data objects, validate requests, map snake_case fields, handle relations and send clean props to Inertia."
---

# Spatie Laravel Data: Typed Data Objects for Requests, Models and Inertia

<BlogPostMeta />

Arrays are the default way to move data around a Laravel app, and they don't tell you much. Which keys does `$data` have? Is `phone` optional? Is `created_at` a string or a Carbon instance? **Spatie laravel-data** replaces those loose arrays with small typed classes that describe the shape of your data once.

This guide covers what the package does, how to create Data objects from requests, arrays and models, how validation works, how to handle snake_case input and relations, how to send Data objects to Inertia, and when a plain array is still the better choice.

## What spatie/laravel-data does

A Data object is a DTO (data transfer object): a class with typed, public properties and no business logic. With `spatie/laravel-data`, one class can play three roles:

| Role | Example |
| --- | --- |
| **Input** | Validate a request and hand a typed object to your service |
| **Output** | Turn an Eloquent model into exactly the fields a page needs |
| **Contract** | Describe the same shape for your TypeScript frontend |

The benefit is that your editor, static analysis and the next developer all know what `$data->email` is. Typos become errors you see before production, not `null` values you discover after.

Install it with Composer:

```bash
composer require spatie/laravel-data
php artisan vendor:publish --tag=data-config   # optional: publishes config/data.php
```

The package also adds `php artisan make:data` to generate a new class.

## Your first Data object

A Data class extends `Spatie\LaravelData\Data` and declares its fields as promoted constructor properties:

```php
use Spatie\LaravelData\Data;

class CustomerData extends Data
{
    public function __construct(
        public string $name,
        public string $email,
        public ?string $phone = null,
        public bool $marketingOptIn = false,
    ) {}
}
```

You create instances with the static `from()` method, which accepts many kinds of input:

```php
$customer = CustomerData::from(['name' => 'Ada', 'email' => 'ada@example.com']);
$customer = CustomerData::from($request);   // an HTTP request
$customer = CustomerData::from($model);     // an Eloquent model
```

From here on, `$customer->phone` is a typed property instead of an array key that might be missing.

## Validating requests with Data objects

The most useful feature is automatic validation. Type-hint a Data class in a controller method, and Laravel resolves it from the current request and validates it before your code runs:

```php
public function store(CustomerData $data, CustomerService $customers): RedirectResponse
{
    $customers->create($data);

    return to_route('customers.index');
}
```

If validation fails, you get the usual redirect back with errors (or a 422 JSON response), just like with a Form Request.

### Inferred rules

The package reads your property types and adds rules for you. For the class above:

| Property | Inferred rules |
| --- | --- |
| `string $name` | `required`, `string` |
| `?string $phone = null` | `nullable`, `string` — skipped entirely when the field is missing, because it has a default |
| `bool $marketingOptIn = false` | `required`, `boolean` — also skipped when the field is missing |
| A backed enum type | `Rule::enum()` for that enum |

### Your own rules, attributes and messages

For anything beyond types, add a static `rules()` method. Rules you return for a field **replace** the inferred rules for that field, so write the complete list:

```php
public static function rules(): array
{
    return [
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', Rule::unique('customers', 'email')],
    ];
}
```

Static `attributes()` and `messages()` methods work like their Form Request counterparts, so you can use translated field names and messages. For short rules, validation attributes such as `#[Max(255)]` or `#[Email]` on the property are an alternative.

By default the package validates automatically only when the payload is a request. To validate a plain array — from an import or an API webhook — call `CustomerData::validateAndCreate($array)`.

## Mapping snake_case input to camelCase properties

HTML forms and JSON usually send `marketing_opt_in`, while PHP code prefers `$marketingOptIn`. Instead of renaming by hand, add a name mapper to the class:

```php
use Spatie\LaravelData\Attributes\MapName;
use Spatie\LaravelData\Mappers\SnakeCaseMapper;

#[MapName(SnakeCaseMapper::class)]
class CustomerData extends Data
{
    // ...same properties as before
}
```

`MapName` works in both directions: `marketing_opt_in` is read into `$marketingOptIn`, and it's written back as `marketing_opt_in` when the object is transformed to an array. Remember that the keys in `rules()` use the input names (`marketing_opt_in`), not the property names.

## Building Data objects from models

`from($model)` copies matching attributes automatically. When you need formatting, computed values or relations, add a static method whose name starts with `from`. The package calls it automatically when `from()` receives a matching type:

```php
public static function fromModel(Customer $customer): self
{
    return new self(
        name: $customer->name,
        email: $customer->email,
        phone: $customer->phone,
        marketingOptIn: (bool) $customer->marketing_opt_in,
    );
}
```

For lists, `CustomerData::collect($customers)` maps a collection. It also works on paginators and keeps the pagination metadata. In a query you can map each page item with `->paginate(15)->through(fn ($c) => CustomerData::from($c))`.

### Relations without N+1 queries

Nested data is where Data objects can quietly cause extra queries. Wrap relation-based properties in `Lazy::whenLoaded()` so they're only included when the relation was eager loaded:

```php
orders: Lazy::whenLoaded(
    'orders',
    $customer,
    fn () => OrderData::collect($customer->orders),
),
```

Load `orders` with `with('orders')` on the detail page and the orders appear. Leave it out on the index page and nothing is queried. Other lazy types exist too, such as `Lazy::create()` for values you include explicitly with `->include('orders')`.

## Sending Data objects as Inertia props

A Data object can be passed straight to an Inertia page. Inertia turns it into an array when it builds the response:

```php
return Inertia::render('customers/Show', [
    'customer' => CustomerData::from($customer->load('orders')),
]);
```

This is safer than passing the model. Only the properties you declared reach the browser, so a new `internal_notes` column or a hidden token doesn't leak into your page props by accident. Returning a Data object from a controller outside Inertia gives you a JSON response.

Add the `#[TypeScript]` attribute and the Laravel TypeScript transformer can generate a matching TypeScript type for your frontend. That setup is covered in [generating TypeScript types from PHP](/blog/laravel-typescript-types-from-php.html).

## When not to use Data objects

Data objects are worth it at boundaries: request input, service input, page props. They're not worth it everywhere:

- **Tiny local arrays** inside one method, such as query options or a lookup table.
- **Business logic.** A Data object shouldn't save models, send emails or decide permissions — that belongs in your [Laravel service layer](/blog/laravel-service-layer-pattern.html).
- **Authorization.** Use policies, gates or middleware. Data objects have no `authorize()` hook.
- **Huge relation graphs.** Transforming thousands of nested objects has a cost. Paginate and load only what the page shows.

How do they compare with the tools Laravel already has?

| Need | Form Request | API Resource | Data object |
| --- | --- | --- | --- |
| Validate input | Yes | No | Yes |
| Typed properties | No | No | Yes |
| Transform models for output | No | Yes | Yes |
| Authorization hook | Yes | No | No |
| Generate TypeScript types | No | No | Yes, with the transformer |

Many apps use both: Data objects for most forms, and Form Requests for small endpoints like "confirm your password". How controllers use them is covered in [thin controllers in Laravel](/blog/laravel-thin-controllers.html).

## Frequently asked questions

### Is spatie/laravel-data the same as spatie/data-transfer-object?

No. `spatie/data-transfer-object` is Spatie's older, deprecated DTO package. `spatie/laravel-data` is its Laravel-specific successor, with request validation, model mapping and TypeScript support built in.

### Does laravel-data replace Form Requests?

It can for most forms, since a Data object validates input and gives you typed properties. Form Requests are still handy when you need their `authorize()` method or when the input never leaves the controller.

### Can I use laravel-data for JSON APIs?

Yes. Return a Data object, a collection or a paginated collection from a controller and it becomes a JSON response. Paginated collections include the pagination links and metadata.

### Does laravel-data slow down my app?

The package uses reflection to analyse each class. In production, `php artisan data:cache-structures` caches that analysis. It scans the directories listed under `structure_caching` in `config/data.php`, so add your own Data folders there if they live outside `app/Data`.

## How SaaS Laravel uses Data objects

The SaaS Laravel kits use spatie/laravel-data 4 throughout the backend. Each [feature module](/blog/modular-laravel-architecture.html) keeps its Data classes in its own `Data` folder — `TenantRegisterData`, `DomainData`, `UserData`, `RoleData` and more — with `#[MapName(SnakeCaseMapper::class)]`, translated `rules()`, `attributes()` and `messages()`, `fromModel()` methods, and lazy properties for relations such as a user's roles or a tenant's domains. Controllers type-hint these classes, and `#[TypeScript]` classes are exported as TypeScript types for the Vue, React and Svelte frontends. See the [architecture documentation](/docs/core/architecture.html) for how the layers fit together.

<BlogPostCta title="Typed data from backend to frontend" text="SaaS Laravel uses spatie/laravel-data with generated TypeScript types, services and thin controllers, plus multi-tenancy and authentication, in Vue, React or Svelte." />
