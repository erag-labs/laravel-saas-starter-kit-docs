---
title: "Generate TypeScript Types from PHP in Laravel"
description: "Use the Laravel TypeScript transformer to turn PHP classes, enums and laravel-data objects into TypeScript types, with setup, attributes, writers and CI tips."
pageClass: blog-page
date: 2026-09-29
author: erag
category: architecture
tags: [TypeScript, Code quality]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-typescript-types-from-php.html
  - - meta
    - property: og:title
      content: "Generate TypeScript Types from PHP in Laravel"
  - - meta
    - property: og:description
      content: "Use the Laravel TypeScript transformer to turn PHP classes, enums and laravel-data objects into TypeScript types, with setup, attributes, writers and CI tips."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-typescript-types-from-php.html
  - - meta
    - name: twitter:title
      content: "Generate TypeScript Types from PHP in Laravel"
  - - meta
    - name: twitter:description
      content: "Use the Laravel TypeScript transformer to turn PHP classes, enums and laravel-data objects into TypeScript types, with setup, attributes, writers and CI tips."
---

# Laravel TypeScript Transformer: Keep Frontend Types in Sync with Your PHP

<BlogPostMeta />

When a Laravel backend feeds a Vue, React or Svelte frontend, every data shape tends to exist twice: once as a PHP class and once as a hand-written TypeScript type. The **Laravel TypeScript transformer** from Spatie removes the second copy by generating TypeScript types straight from your PHP classes and enums.

This guide explains why generated types are worth it, how to install and configure version 3 of the package, how it handles enums and laravel-data objects, how to shape the output, and how to keep the generated files fresh.

## Why generate TypeScript types from PHP

Picture a small change: you rename `is_active` to `status` in the data you send to a page. PHP is happy. The TypeScript interface in your frontend still says `is_active`, so the type checker is happy too. The bug only shows up when someone opens the page and sees an empty badge.

Generated types close that gap. PHP stays the single source of truth, and the frontend type checker (`vue-tsc`, `tsc` or `svelte-check`) points at every component that still uses the old name.

| Approach | Source of truth | Main risk |
| --- | --- | --- |
| Hand-written interfaces | PHP and TypeScript, kept in sync by hand | Silent drift after backend changes |
| Generated from PHP | PHP classes and enums | Stale output if you forget to regenerate |
| Untyped props (`any`) | Nothing | Mistakes surface only at runtime |

Types for data are one half of the picture. For URLs and HTTP methods, [typed routes with Laravel Wayfinder](/blog/laravel-wayfinder-typed-routes.html) do the same job for your routes and controllers.

## Installing the Laravel TypeScript transformer

Version 3 of `spatie/laravel-typescript-transformer` is a complete rewrite. The biggest change for Laravel users: configuration now lives in a service provider instead of a config file.

```bash
composer require spatie/laravel-typescript-transformer
php artisan typescript:install
```

`typescript:install` publishes `App\Providers\TypeScriptTransformerServiceProvider` and adds it to `bootstrap/providers.php`.

::: warning Dev dependency or not?
Because the provider is registered in `bootstrap/providers.php`, its parent class must exist wherever the app boots. If you install the package with `--dev` and deploy with `composer install --no-dev`, the app can't load that provider. Either install it as a normal dependency or register the provider only outside production.
:::

## Configuring the service provider

Everything is set up in the provider's `configure()` method with a fluent builder:

```php
protected function configure(TypeScriptTransformerConfigFactory $config): void
{
    $config
        ->transformer(AttributedClassTransformer::class)
        ->transformer(EnumTransformer::class)
        ->transformDirectories(app_path())
        ->writer(new GlobalNamespaceWriter('generated.d.ts'))
        ->formatter(PrettierFormatter::class);
}
```

| Method | What it sets |
| --- | --- |
| `transformer()` | Which classes become types, and how |
| `transformDirectories()` | Where to look for PHP classes (add every folder that holds your code) |
| `writer()` | How the output files are laid out |
| `outputDirectory()` | Where the files are written |
| `formatter()` | An optional formatter run on the generated files |
| `replaceType()` | Map a PHP class to a fixed TypeScript type |

Then generate the types:

```bash
php artisan typescript:transform
```

## Marking classes with #[TypeScript]

`AttributedClassTransformer` only picks up classes that carry the `#[TypeScript]` attribute, so nothing is exported by accident:

```php
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
class ProjectSummary
{
    public int $id;
    public string $name;
    public ?string $archivedAt;
}
```

That produces:

```ts
export type ProjectSummary = {
    id: number;
    name: string;
    archivedAt: string | null;
};
```

Nullable PHP types become a union with `null`, and `int` and `float` both become `number`. The attribute also accepts a `name` if the TypeScript type should be called something else.

## Enums: union types or TypeScript enums

`EnumTransformer` handles PHP enums in the scanned directories, with no attribute needed. By default a backed enum becomes a string union:

```ts
export type ProjectStatus = 'active' | 'archived';
```

Pass `new EnumTransformer(useUnionEnums: false)` to generate a real TypeScript `enum` instead. Union types are lighter, since they disappear at compile time. A TypeScript `enum` exists at runtime, so you can loop over its values to build a select box.

## Laravel TypeScript transformer and laravel-data

If you use [spatie/laravel-data](/blog/laravel-data-objects.html) for DTOs, register the Data extension. It adds a transformer that understands Data classes:

```php
$config->extension(new LaravelDataTypeScriptTransformerExtension());
```

This matters in two places:

- **Mapped names.** With `#[MapName(SnakeCaseMapper::class)]`, a PHP property `createdAt` is sent to the browser as `created_at`. The Data transformer writes `created_at` in the TypeScript type too, so the type matches the JSON the page actually receives.
- **Lazy properties.** A property typed `Lazy|array` is only included when you ask for it. The transformer marks it optional (`roles?: ...`), which forces the frontend to handle the missing case.

The Laravel extension also maps Carbon dates to `string`, because that's what they become once serialised to JSON.

## Shaping the output

When the generated type isn't precise enough, a few attributes help:

| Attribute | Effect |
| --- | --- |
| `#[Optional]` | Marks a property (or every property of a class) as optional |
| `#[Hidden]` | Leaves a property out of the type |
| `#[TypeScriptType('...')]` | Sets the type using PHP docblock syntax, such as `array<int, string>` |
| `#[LiteralTypeScriptType('...')]` | Writes the TypeScript you give it, as-is |

Untyped arrays are the most common gap. A property declared as plain `array` becomes `Array<any>`. Add a docblock such as `/** @var array<int, string> */` (or `@param` on a promoted constructor property) and the output becomes `string[]`.

## Choosing a writer

The writer decides the file layout:

| Writer | Output | Good for |
| --- | --- | --- |
| `GlobalNamespaceWriter` | One `.d.ts` file with global namespaces | Small apps, no imports needed |
| `FlatModuleWriter` | One module file with every type exported | A single import path |
| `ModuleWriter` | One module per PHP namespace | Larger or modular apps |

`ModuleWriter` mirrors your namespaces, so types from a feature module end up in their own folder. In a [modular Laravel architecture](/blog/modular-laravel-architecture.html) you can then import each module's types with `import type` from its own folder.

## Keeping generated types fresh

Generated types are only useful when they're current. A few habits help:

- **Regenerate after backend changes.** Run `php artisan typescript:transform` whenever you touch a transformed class or enum. The command also has a `--watch` mode, which needs the `chokidar` npm package.
- **Commit the output or check it in CI.** If you commit the files, run the command in CI and fail the build on a diff with `git diff --exit-code`. If you don't commit them, generate them before type-checking.
- **Mind the formatter.** `PrettierFormatter` runs Prettier through `npx`, so Node must be available wherever you generate types. Drop the formatter if that's a problem.
- **Type your page props.** Use the generated types in `defineProps`, React props or Svelte `$props()`. Generated types that no component imports can't catch anything.

## Frequently asked questions

### Does the Laravel TypeScript transformer work with Vue, React and Svelte?

Yes. It writes plain TypeScript with no framework dependency, so any frontend that compiles TypeScript can import the types. Only the way you type component props differs between frameworks.

### Do I have to add #[TypeScript] to every class?

Only for classes handled by `AttributedClassTransformer`. Enums are picked up by `EnumTransformer` without an attribute, and with the laravel-data extension, Data classes in the scanned directories are handled too. Adding the attribute anyway makes the intent obvious to other developers.

### Can it generate types for Eloquent models?

Not with the setup shown here. Models get most of their attributes from the database at runtime, so their shape isn't declared in PHP. It's usually better to send a Data object or a small typed class to the frontend and generate the type from that.

### What changed in version 3?

Version 3 is a rewrite. Laravel apps now configure it in a service provider instead of a config file, collectors were replaced by transformers, PHPStan-style docblock types are used for inference, and a watch mode was added. The package's upgrade guide suggests re-implementing your setup rather than migrating it line by line.

## How SaaS Laravel handles this

All three [SaaS Laravel kits](/) ship with `spatie/laravel-typescript-transformer` already configured. The provider scans `app/` and `Modules/`, registers the Laravel and laravel-data extensions, and generates TypeScript enums (`useUnionEnums: false`). A small custom module writer emits `import type` statements and mirrors the PHP namespaces under `resources/js/types`. Data classes such as `UserData` and `DomainData` use `#[TypeScript]` with a snake_case mapper, and pages import them from `@/types/Modules/...`. `composer lint` runs `typescript:transform`, and the generated types are committed. See the [typed frontend overview](/docs/core/architecture.html#typed-frontend) and the [generated files table](/docs/getting-started/local-development.html#generated-files).

<BlogPostCta title="Frontend types generated from PHP" text="SaaS Laravel kits generate TypeScript types from laravel-data objects and enums, and pair them with Wayfinder routes — in Vue, React or Svelte." />
