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

Arrays are how most Laravel apps move data around, and they don't tell you much. Which keys does `$data` have? Is `phone` optional? Is `created_at` a string or a Carbon instance? Spatie laravel-data swaps those loose arrays for small typed classes that describe the shape of your data in one place.

We'll cover what the package does, how to create Data objects from requests, arrays and models, how validation works, how to deal with snake_case input and relations, how to hand Data objects to Inertia, and when a plain array is still the better call.

## What spatie/laravel-data does

A Data object is a DTO (data transfer object): a class with typed public properties and no business logic. With `spatie/laravel-data`, a single class can play three roles:

| Role | Example |
| --- | --- |
| Input | Validate a request and hand a typed object to your service |
| Output | Turn an Eloquent model into exactly the fields a page needs |
| Contract | Describe the same shape for your TypeScript frontend |

What you get out of it is shared knowledge. Your editor, static analysis and the next developer all know what `$data->email` is, so typos turn into errors you see before production instead of `null` values you find afterwards.

Install it with Composer:

```bash
composer require spatie/laravel-data
php artisan vendor:publish --tag=data-config   # optional: publishes config/data.php
```

You also get `php artisan make:data` for generating new classes.

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

To create one, call the static `from()` method. It accepts a lot of different inputs:

```php
$customer = CustomerData::from(['name' => 'Ada', 'email' => 'ada@example.com']);
$customer = CustomerData::from($request);   // an HTTP request
$customer = CustomerData::from($model);     // an Eloquent model
```

After that, `$customer->phone` is a typed property, not an array key that may or may not exist.

## Validating requests with Data objects

Automatic validation is the feature we'd single out. Type-hint a Data class in a controller method and Laravel resolves it from the current request, validating it before your code runs:

```php
public function store(CustomerData $data, CustomerService $customers): RedirectResponse
{
    $customers->create($data);

    return to_route('customers.index');
}
```

When validation fails you get the usual redirect back with errors (or a 422 JSON response), same as with a Form Request.

### Inferred rules

The package looks at your property types and adds rules for you. For the class above:

| Property | Inferred rules |
| --- | --- |
| `string $name` | `required`, `string` |
| `?string $phone = null` | `nullable`, `string`; skipped entirely when the field is missing, because it has a default |
| `bool $marketingOptIn = false` | `required`, `boolean`; also skipped when the field is missing |
| A backed enum type | `Rule::enum()` for that enum |

### Your own rules, attributes and messages

For anything the types can't express, add a static `rules()` method. Be careful here: rules you return for a field **replace** the inferred rules for that field, so write out the complete list.

```php
public static function rules(): array
{
    return [
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', Rule::unique('customers', 'email')],
    ];
}
```

Static `attributes()` and `messages()` methods behave like their Form Request equivalents, so translated field names and messages work as you'd expect. For short rules you can use validation attributes on the property instead, such as `#[Max(255)]` or `#[Email]`.

One thing that surprises people: the package only validates automatically when the payload is a request. If you're building from a plain array (say from an import or an API webhook), call `CustomerData::validateAndCreate($array)`.

## Mapping snake_case input to camelCase properties

Forms and JSON usually send `marketing_opt_in`, while PHP code prefers `$marketingOptIn`. Rather than renaming by hand, add a name mapper to the class:

```php
use Spatie\LaravelData\Attributes\MapName;
use Spatie\LaravelData\Mappers\SnakeCaseMapper;

#[MapName(SnakeCaseMapper::class)]
class CustomerData extends Data
{
    // ...same properties as before
}
```

`MapName` works both ways. `marketing_opt_in` is read into `$marketingOptIn`, and it's written back out as `marketing_opt_in` when the object becomes an array. Just remember that the keys in `rules()` use the input names (`marketing_opt_in`), not the property names.

## Building Data objects from models

`from($model)` copies matching attributes on its own. When you need formatting, computed values or relations, add a static method whose name starts with `from`, and the package will call it whenever `from()` receives a matching type:

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

Lists are handled by `CustomerData::collect($customers)`. It works on paginators too and keeps the pagination metadata. Inside a query, you can map each page item with `->paginate(15)->through(fn ($c) => CustomerData::from($c))`.

### Relations without N+1 queries

Nested data is where Data objects can quietly add queries. Wrap relation-based properties in `Lazy::whenLoaded()` so they're only included if the relation was eager loaded:

```php
orders: Lazy::whenLoaded(
    'orders',
    $customer,
    fn () => OrderData::collect($customer->orders),
),
```

On the detail page, load `orders` with `with('orders')` and they appear. Leave it out on the index page and nothing gets queried. There are other lazy types as well, such as `Lazy::create()` for values you include explicitly with `->include('orders')`.

## Sending Data objects as Inertia props

You can pass a Data object straight to an Inertia page. Inertia converts it to an array while building the response:

```php
return Inertia::render('customers/Show', [
    'customer' => CustomerData::from($customer->load('orders')),
]);
```

We prefer this to passing the model, and the reason is safety. Only the properties you declared reach the browser, so a new `internal_notes` column or a hidden token can't slip into your page props by accident. Outside Inertia, returning a Data object from a controller gives you a JSON response.

Add the `#[TypeScript]` attribute and the Laravel TypeScript transformer can generate a matching TypeScript type for the frontend. The setup is in our post on [generating TypeScript types from PHP](/blog/laravel-typescript-types-from-php.html).

## When a plain array is the better choice

Data objects pay off at boundaries: request input, service input, page props. Inside those boundaries they're often just ceremony. A tiny array that lives inside one method, like query options or a lookup table, doesn't need a class.

They also aren't the place for business logic. A Data object shouldn't save models, send emails or decide permissions; that work belongs in your [Laravel service layer](/blog/laravel-service-layer-pattern.html). Authorization is similar. Use policies, gates or middleware, because Data objects have no `authorize()` hook.

Finally, watch out for huge relation graphs. Transforming thousands of nested objects isn't free, so paginate and load only what the page actually shows.

How do they stack up against the tools Laravel already gives you?

| Need | Form Request | API Resource | Data object |
| --- | --- | --- | --- |
| Validate input | Yes | No | Yes |
| Typed properties | No | No | Yes |
| Transform models for output | No | Yes | Yes |
| Authorization hook | Yes | No | No |
| Generate TypeScript types | No | No | Yes, with the transformer |

Plenty of apps use both, and so would we: Data objects for most forms, Form Requests for small endpoints like "confirm your password". For how controllers put them to work, see [thin controllers in Laravel](/blog/laravel-thin-controllers.html).

## Frequently asked questions

### Is spatie/laravel-data the same as spatie/data-transfer-object?

No. `spatie/data-transfer-object` is Spatie's older DTO package, and it's deprecated. `spatie/laravel-data` is the Laravel-specific successor, with request validation, model mapping and TypeScript support built in.

### Does laravel-data replace Form Requests?

For most forms it can, since a Data object validates input and gives you typed properties. Form Requests are still useful when you need `authorize()` or when the input never leaves the controller.

### Can I use laravel-data for JSON APIs?

Yes. Return a Data object, a collection or a paginated collection from a controller and it becomes a JSON response. Paginated collections include the pagination links and metadata.

### Does laravel-data slow down my app?

The package uses reflection to analyse each class. In production, run `php artisan data:cache-structures` to cache that analysis. It scans the directories listed under `structure_caching` in `config/data.php`, so add your own Data folders there if they live outside `app/Data`.

## How SaaS Laravel uses Data objects

The SaaS Laravel kits already use spatie/laravel-data 4 across the backend, if you'd like to see these patterns in a real codebase. Each [feature module](/blog/modular-laravel-architecture.html) keeps its Data classes in its own `Data` folder (`TenantRegisterData`, `DomainData`, `UserData`, `RoleData` and more), using `#[MapName(SnakeCaseMapper::class)]`, translated `rules()`, `attributes()` and `messages()`, `fromModel()` methods, and lazy properties for relations such as a user's roles or a tenant's domains. Controllers type-hint these classes, and `#[TypeScript]` classes are exported as TypeScript types for the Vue, React and Svelte frontends. The [architecture documentation](/docs/core/architecture.html) shows how the layers fit together.

<BlogPostCta title="Typed data from backend to frontend" text="SaaS Laravel uses spatie/laravel-data with generated TypeScript types, services and thin controllers, plus multi-tenancy and authentication, in Vue, React or Svelte." />
