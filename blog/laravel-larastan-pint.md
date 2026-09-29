---
title: "Larastan and Pint for Laravel Code Quality"
description: "Set up Larastan and Pint in a Laravel project: code style presets, PHPStan levels, baselines, Laravel-specific rules and a simple local and CI workflow."
pageClass: blog-page
date: 2026-09-29
author: erag
category: architecture
tags: [Code quality, Tooling]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-larastan-pint.html
  - - meta
    - property: og:title
      content: "Larastan and Pint for Laravel Code Quality"
  - - meta
    - property: og:description
      content: "Set up Larastan and Pint in a Laravel project: code style presets, PHPStan levels, baselines, Laravel-specific rules and a simple local and CI workflow."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-larastan-pint.html
  - - meta
    - name: twitter:title
      content: "Larastan and Pint for Laravel Code Quality"
  - - meta
    - name: twitter:description
      content: "Set up Larastan and Pint in a Laravel project: code style presets, PHPStan levels, baselines, Laravel-specific rules and a simple local and CI workflow."
---

# Larastan and Pint: Static Analysis and Code Style for Laravel Projects

<BlogPostMeta />

Nobody enjoys arguing about formatting in code review, and nobody enjoys finding a typo'd method name in production. Larastan and Pint take care of both. Pint makes every PHP file look the same, and Larastan reads your code to find bugs before it runs.

We'll go through what each tool does, how we configure them, how to adopt Larastan on an existing codebase without drowning in errors, and how to run both in your daily workflow and in CI.

## What Larastan and Pint each do

They solve different problems, which is why we run both:

| | Laravel Pint | Larastan |
| --- | --- | --- |
| Job | Code style fixer | Static analysis |
| Built on | PHP-CS-Fixer | PHPStan |
| Changes your files | Yes (unless you pass `--test`) | Never, it only reports |
| Finds | Inconsistent formatting, unused imports, style rules | Wrong types, unknown methods, null access, Laravel misuse |
| Speed | Seconds | Slower, depends on level and codebase size |

Neither one replaces tests. Static analysis tells you the code is consistent with its types; tests tell you it does the right thing. For that second half, see [our guide to testing a Laravel SaaS with Pest](/blog/laravel-saas-testing-pest.html).

## Setting up Laravel Pint

New Laravel applications already include Pint as a dev dependency. On older projects, install it and run it once:

```bash
composer require laravel/pint --dev
vendor/bin/pint
```

Without any configuration, Pint uses the `laravel` preset. These are the options you'll reach for most:

| Option | What it does |
| --- | --- |
| `--test` | Reports style issues without changing files, and exits with an error if it finds any |
| `--dirty` | Only files with uncommitted changes |
| `--diff=main` | Only files changed since branching off `main` |
| `--parallel` | Runs in parallel (marked experimental) |
| `--repair` | Fixes files but still exits with an error if anything changed |

### Configuring pint.json

Put a `pint.json` file in the project root to pick a preset and add or override rules. The built-in presets are `laravel`, `per`, `psr12`, `symfony` and `empty`.

```json
{
    "preset": "laravel",
    "rules": {
        "strict_comparison": true,
        "no_unused_imports": true,
        "global_namespace_import": {
            "import_classes": true
        }
    }
}
```

The rules come from PHP-CS-Fixer, so its rule list is your reference. Watch out for rules that change behaviour rather than layout: `strict_comparison` turns `==` into `===`, and `mb_str_functions` swaps `strlen()` for `mb_strlen()`. We think both are good habits, but read the first diff before you commit it.

## Setting up Larastan

Larastan is a PHPStan extension that understands Laravel's magic: facades, the container, Eloquent builders, relations and model attributes. Plain PHPStan sees most of that as unknown methods, which is why you want the extension rather than PHPStan on its own.

```bash
composer require larastan/larastan --dev
```

Next, create `phpstan.neon` in the project root:

```yaml
includes:
    - vendor/larastan/larastan/extension.neon

parameters:
    paths:
        - app/
        - config/
        - database/
        - routes/
    level: 5
```

Run it with `vendor/bin/phpstan analyse`. If some of your code lives outside `app/`, for example in a `Modules/` folder in a [modular Laravel app](/blog/modular-laravel-architecture.html), add that path as well. Code that isn't listed doesn't get analysed.

### Choosing a PHPStan level

PHPStan 2 has levels 0 to 10, and each level includes the checks of the levels below it:

| Levels | Roughly checks |
| --- | --- |
| 0–2 | Unknown classes, functions and methods, undefined variables, invalid PHPDoc |
| 3–5 | Return types, property types, dead code, argument types |
| 6 | Missing type declarations |
| 7–8 | Partially wrong union types, calls on values that may be `null` |
| 9–10 | Strict handling of `mixed` |

On a new project we'd start high. Level 6 or above is realistic when you write typed code from the first commit. On an older codebase, start at whatever level gives you a manageable error count and raise it over time.

## What Larastan catches in Laravel code

On top of type errors, Larastan adds rules that are specific to Laravel. Two of the default ones look like this:

```php
// "Called 'env' outside of the config directory which returns null
// when the config is cached, use 'config'."
$key = env('STRIPE_SECRET');

// "Called 'count' on Laravel collection, but could have been
// retrieved as a query."
$total = User::all()->count();
```

It also reports relations that don't exist, as in `User::with('rols')`, and `Model::make()` calls that could be `new Model()`.

To know which columns each model has, Larastan reads your migrations. Stricter checks are there if you want them, as opt-in parameters such as `checkModelProperties`, `checkMissingTranslations` and `checkOctaneCompatibility`.

## Adopting Larastan on an existing codebase

The first run on a large, older app can report hundreds of errors. A **baseline** lets you start from zero without fixing everything at once:

```bash
vendor/bin/phpstan analyse --generate-baseline
```

That command writes the current errors to `phpstan-baseline.neon`. Add the file to the `includes` in `phpstan.neon`, and from then on PHPStan only reports new errors. Chip away at the baseline whenever you touch a file, and regenerate it as it gets smaller.

Raise the level one step at a time, generating a fresh baseline at each step if you need one. When something gets flagged, fix it rather than ignoring it. An `@phpstan-ignore` comment is fine for a genuine false positive, but add a short reason so the next person knows why it's there. On large projects the analysis can run out of memory; pass `--memory-limit=1G` when that happens.

## Running Larastan and Pint every day

These tools only help if they run without anyone having to remember them. Composer scripts give the whole team the same commands:

```json
"scripts": {
    "lint": "pint --parallel",
    "lint:check": "pint --parallel --test",
    "types:check": "phpstan analyse"
}
```

Here's the routine we'd suggest:

- While coding, run `vendor/bin/pint --dirty` before each commit, or let your editor run Pint on save.
- Before pushing, run `composer types:check` on the code you changed.
- In CI, run `pint --test` first because it's fast, then PHPStan, then the test suite, and fail the build on any error.
- After upgrading Laravel or packages, re-run PHPStan. New stubs can surface new errors.

If you use AI coding agents, give them the same commands. Agent output is much easier to review when the style is already fixed and the types are already checked.

## Frequently asked questions

### Do I need both Larastan and Pint?

Yes, if you want consistent style and early bug detection. Pint only changes formatting and will never tell you a method doesn't exist. Larastan never touches formatting. They barely overlap and they run as separate steps.

### What PHPStan level should a Laravel project use?

There's no single right answer. Level 5 catches plenty of real bugs for very little effort. Levels 6 to 8 need proper type declarations and null handling, and they pay off in larger codebases. Our rule of thumb: pick the highest level you can keep at zero errors, with a baseline for older code.

### Why does Larastan say a property doesn't exist on my model?

Larastan learns model attributes from your migrations and from `@property` docblocks. If the column is added somewhere Larastan doesn't scan, or the property is computed, add a `@property` annotation or an accessor with a proper return type.

### Can Pint format Blade templates?

Pint has a `--blade` option that turns on its Blade formatting rule. Plenty of teams format Blade and frontend files with Prettier instead and keep Pint for PHP only.

## Larastan and Pint in the SaaS Laravel kits

If you'd rather not set all this up yourself, the [SaaS Laravel kits](/) come with both tools configured. `pint.json` uses the `laravel` preset plus stricter rules such as `strict_comparison`, `date_time_immutable`, `mb_str_functions`, `global_namespace_import` and a fixed class element order. `phpstan.neon` runs Larastan at level 7 with the Carbon extension. `composer lint` fixes style, `composer lint:check` and `composer types:check` only report, and `composer test` runs Pint, frontend linting, PHPStan and Pest in one go. A GitHub Actions workflow runs the same checks on pushes to `main` and on pull requests. The details are in [testing and code quality](/docs/core/testing.html) and the [Composer scripts reference](/docs/reference/commands.html#composer-scripts).

<BlogPostCta title="Start with the checks already wired" text="SaaS Laravel kits include Pint, Larastan at level 7, Pest and a CI workflow, alongside multi-tenancy, roles and Fortify authentication." />
