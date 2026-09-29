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

If a Laravel backend feeds your Vue, React or Svelte frontend, you've probably written the same data shape twice: once as a PHP class, and again as a TypeScript type that someone has to update by hand. The Laravel TypeScript transformer from Spatie gets rid of that second copy. It reads your PHP classes and enums and generates the TypeScript types for you.

Below we cover why we think generated types are worth the setup, how to install and configure version 3 of the package, how it treats enums and laravel-data objects, how to adjust the output, and how to stop the generated files going stale.

## Why generate TypeScript types from PHP

Take a small change. You rename `is_active` to `status` in the data a page receives. PHP doesn't complain. The TypeScript interface in the frontend still says `is_active`, so the type checker doesn't complain either. You find out when someone opens the page and the badge is empty.

Generated types close that gap. PHP stays the single source of truth, and the frontend type checker (`vue-tsc`, `tsc` or `svelte-check`) flags every component that still reads the old name.

| Approach | Source of truth | Main risk |
| --- | --- | --- |
| Hand-written interfaces | PHP and TypeScript, kept in sync by hand | Silent drift after backend changes |
| Generated from PHP | PHP classes and enums | Stale output if you forget to regenerate |
| Untyped props (`any`) | Nothing | Mistakes surface only at runtime |

We'd pick generated types every time. Their one real risk, stale output, is easy to catch in CI (more on that at the end), while drift between hand-written interfaces and PHP is silent by nature.

Data types are only half of it, though. For URLs and HTTP methods, [Laravel Wayfinder's typed routes](/blog/laravel-wayfinder-typed-routes.html) do the same job for your routes and controllers.

## Installing the Laravel TypeScript transformer

Version 3 of `spatie/laravel-typescript-transformer` is a complete rewrite. If you've used an older version, the first thing you'll notice is that configuration has moved out of a config file and into a service provider.

```bash
composer require spatie/laravel-typescript-transformer
php artisan typescript:install
```

`typescript:install` publishes `App\Providers\TypeScriptTransformerServiceProvider` and adds it to `bootstrap/providers.php`.

::: warning Dev dependency or not?
The provider is registered in `bootstrap/providers.php`, so its parent class has to exist wherever the app boots. Install the package with `--dev`, deploy with `composer install --no-dev`, and the app can't load that provider. Either install it as a normal dependency or only register the provider outside production.
:::

## Configuring the service provider

All of the setup happens in the provider's `configure()` method, through a fluent builder:

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

If some of your code lives outside `app/`, for example in a `Modules/` folder, pass those directories to `transformDirectories()` as well. Classes in folders it doesn't scan never become types.

With that in place, generate the types:

```bash
php artisan typescript:transform
```

## Marking classes with #[TypeScript]

`AttributedClassTransformer` only picks up classes that carry the `#[TypeScript]` attribute. We like that choice: nothing ends up in your frontend types by accident.

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

Here's what it produces:

```ts
export type ProjectSummary = {
    id: number;
    name: string;
    archivedAt: string | null;
};
```

Nullable PHP types turn into a union with `null`, and both `int` and `float` become `number`. If the TypeScript type should have a different name, pass `name` to the attribute.

## Enums: union types or TypeScript enums

Enums don't need an attribute at all. `EnumTransformer` handles every PHP enum in the scanned directories, and by default a backed enum comes out as a string union:

```ts
export type ProjectStatus = 'active' | 'archived';
```

Pass `new EnumTransformer(useUnionEnums: false)` if you'd rather have a real TypeScript `enum`. The trade-off is straightforward. Union types are lighter, because they disappear at compile time. A TypeScript `enum` exists at runtime, so you can loop over its values, which is exactly what you need to build a select box. If your UI renders enum options in dropdowns, we'd go with real enums.

## Laravel TypeScript transformer and laravel-data

Using [spatie/laravel-data](/blog/laravel-data-objects.html) for your DTOs? Register the Data extension. It adds a transformer that understands Data classes:

```php
$config->extension(new LaravelDataTypeScriptTransformerExtension());
```

You'll notice the difference in two places. The first is mapped names. With `#[MapName(SnakeCaseMapper::class)]`, a PHP property `createdAt` reaches the browser as `created_at`, and the Data transformer writes `created_at` into the TypeScript type too. The type matches the JSON the page actually receives.

The second is lazy properties. A property typed `Lazy|array` is only included when you ask for it, so the transformer marks it optional (`roles?: ...`). That forces the frontend to deal with the case where it's missing.

On top of that, the Laravel extension maps Carbon dates to `string`, since that's what they turn into once serialised to JSON.

## Shaping the output

Sometimes the generated type isn't quite precise enough. These attributes let you correct it:

| Attribute | Effect |
| --- | --- |
| `#[Optional]` | Marks a property (or every property of a class) as optional |
| `#[Hidden]` | Leaves a property out of the type |
| `#[TypeScriptType('...')]` | Sets the type using PHP docblock syntax, such as `array<int, string>` |
| `#[LiteralTypeScriptType('...')]` | Writes the TypeScript you give it, as-is |

The gap you'll run into most is untyped arrays. A property declared as plain `array` becomes `Array<any>`. Add a docblock like `/** @var array<int, string> */` (or `@param` on a promoted constructor property) and you get `string[]` instead.

## Choosing a writer

The writer decides how the output files are laid out:

| Writer | Output | Good for |
| --- | --- | --- |
| `GlobalNamespaceWriter` | One `.d.ts` file with global namespaces | Small apps, no imports needed |
| `FlatModuleWriter` | One module file with every type exported | A single import path |
| `ModuleWriter` | One module per PHP namespace | Larger or modular apps |

`ModuleWriter` mirrors your namespaces, so each feature module's types land in their own folder. In a [modular Laravel app](/blog/modular-laravel-architecture.html), that lets you pull in each module's types with `import type` from its own folder. Our rule: `GlobalNamespaceWriter` is fine while the app is small, and `ModuleWriter` pays off once the code is split into modules.

## Keeping generated types fresh

Generated types only help while they're current, so a few habits matter.

Regenerate after backend changes. Run `php artisan typescript:transform` whenever you touch a transformed class or enum. There's also a `--watch` mode, which needs the `chokidar` npm package.

Next, decide whether to commit the output. If you commit the files, run the command in CI and fail the build on a diff with `git diff --exit-code`. If you don't, generate them before type-checking. We prefer committing them, because type changes then show up in the pull request right next to the PHP change that caused them.

Keep an eye on the formatter as well. `PrettierFormatter` runs Prettier through `npx`, so Node has to be available wherever you generate types. If that's awkward in your pipeline, drop the formatter.

Finally, actually use the types for your page props, whether that's `defineProps`, React props or Svelte `$props()`. **Generated types that no component imports can't catch anything.**

## Frequently asked questions

### Does the Laravel TypeScript transformer work with Vue, React and Svelte?

Yes. It writes plain TypeScript with no framework dependency, so any frontend that compiles TypeScript can import the types. The only thing that differs between frameworks is how you type component props.

### Do I have to add #[TypeScript] to every class?

Only for classes handled by `AttributedClassTransformer`. Enums are picked up by `EnumTransformer` without an attribute, and with the laravel-data extension, Data classes in the scanned directories are handled too. We still add the attribute to Data classes, because it makes the intent obvious to other developers.

### Can it generate types for Eloquent models?

Not with the setup shown here. Models get most of their attributes from the database at runtime, so their shape isn't declared in PHP. You're usually better off sending a Data object or a small typed class to the frontend and generating the type from that.

### What changed in version 3?

Version 3 is a rewrite. Laravel apps now configure it in a service provider instead of a config file, collectors were replaced by transformers, type inference uses PHPStan-style docblock types, and there's a new watch mode. The package's upgrade guide suggests re-implementing your setup rather than migrating it line by line.

## Generated types in the SaaS Laravel kits

All three [SaaS Laravel kits](/) come with `spatie/laravel-typescript-transformer` already configured. The provider scans `app/` and `Modules/`, registers the Laravel and laravel-data extensions, and generates TypeScript enums (`useUnionEnums: false`). A small custom module writer emits `import type` statements and mirrors the PHP namespaces under `resources/js/types`. Data classes such as `UserData` and `DomainData` use `#[TypeScript]` with a snake_case mapper, and pages import them from `@/types/Modules/...`. `composer lint` runs `typescript:transform`, and the generated types are committed. The [typed frontend overview](/docs/core/architecture.html#typed-frontend) and the [generated files table](/docs/getting-started/local-development.html#generated-files) have the details.

<BlogPostCta title="Frontend types generated from PHP" text="SaaS Laravel kits generate TypeScript types from laravel-data objects and enums, and pair them with Wayfinder routes in Vue, React or Svelte." />
