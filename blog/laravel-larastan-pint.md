---
title: "Larastan and Pint for Laravel Code Quality"
description: "Set up Larastan and Pint in a Laravel project: code style presets, PHPStan levels, baselines, Laravel-specific rules and a simple local and CI workflow."
pageClass: blog-page
date: 2026-09-29
author: erag
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

Two tools cover most of the "boring" code quality work in a Laravel project. **Larastan and Pint** split the job neatly: Pint makes every PHP file look the same, and Larastan reads your code to find bugs before it runs.

This guide explains what each tool does, how to configure both, how to adopt Larastan on an existing codebase without drowning in errors, and how to wire them into your daily workflow and CI.

## What Larastan and Pint each do

They solve different problems, so you want both:

| | Laravel Pint | Larastan |
| --- | --- | --- |
| Job | Code style fixer | Static analysis |
| Built on | PHP-CS-Fixer | PHPStan |
| Changes your files | Yes (unless you pass `--test`) | Never, it only reports |
| Finds | Inconsistent formatting, unused imports, style rules | Wrong types, unknown methods, null access, Laravel misuse |
| Speed | Seconds | Slower, depends on level and codebase size |

Neither replaces tests. Static analysis tells you the code is consistent with its types. Tests tell you it does the right thing. For that half, see [testing a Laravel SaaS with Pest](/blog/laravel-saas-testing-pest.html).

## Setting up Laravel Pint

New Laravel applications already include Pint as a dev dependency. For older projects:

```bash
composer require laravel/pint --dev
vendor/bin/pint
```

With no configuration, Pint uses the `laravel` preset. The options you'll use most:

| Option | What it does |
| --- | --- |
| `--test` | Reports style issues without changing files, and exits with an error if it finds any |
| `--dirty` | Only files with uncommitted changes |
| `--diff=main` | Only files changed since branching off `main` |
| `--parallel` | Runs in parallel (marked experimental) |
| `--repair` | Fixes files but still exits with an error if anything changed |

### Configuring pint.json

A `pint.json` file in the project root picks a preset and adds or overrides rules. The built-in presets are `laravel`, `per`, `psr12`, `symfony` and `empty`.

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

Rules come from PHP-CS-Fixer, so its rule list is your reference. Be careful with rules that change behaviour rather than layout. `strict_comparison` turns `==` into `===`, and `mb_str_functions` swaps `strlen()` for `mb_strlen()`. Both are good habits, but review the first diff before committing it.

## Setting up Larastan

Larastan is a PHPStan extension that understands Laravel's magic: facades, the container, Eloquent builders, relations and model attributes. Plain PHPStan sees most of that as unknown methods.

```bash
composer require larastan/larastan --dev
```

Then create `phpstan.neon` in the project root:

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

Run it with `vendor/bin/phpstan analyse`. If your code lives outside `app/`, for example in a `Modules/` folder in a [modular Laravel architecture](/blog/modular-laravel-architecture.html), add that path too. Code that isn't listed isn't analysed.

### Choosing a PHPStan level

PHPStan 2 has levels 0 to 10. Each level includes the checks of the levels below it:

| Levels | Roughly checks |
| --- | --- |
| 0–2 | Unknown classes, functions and methods, undefined variables, invalid PHPDoc |
| 3–5 | Return types, property types, dead code, argument types |
| 6 | Missing type declarations |
| 7–8 | Partially wrong union types, calls on values that may be `null` |
| 9–10 | Strict handling of `mixed` |

For a new project, start high: 6 or more is realistic when you write typed code from day one. For an older codebase, start where the error count is manageable and raise the level over time.

## What Larastan catches in Laravel code

Besides type errors, Larastan adds Laravel-specific rules. A few that are on by default:

```php
// "Called 'env' outside of the config directory which returns null
// when the config is cached, use 'config'."
$key = env('STRIPE_SECRET');

// "Called 'count' on Laravel collection, but could have been
// retrieved as a query."
$total = User::all()->count();
```

It also reports relations that don't exist, as in `User::with('rols')`, and `Model::make()` calls that could be `new Model()`.

Larastan reads your migrations to learn which columns each model has. Stricter checks are available as opt-in parameters, such as `checkModelProperties`, `checkMissingTranslations` and `checkOctaneCompatibility`.

## Adopting Larastan on an existing codebase

Running Larastan on a large, older app for the first time can report hundreds of errors. A **baseline** lets you start clean without fixing everything at once:

```bash
vendor/bin/phpstan analyse --generate-baseline
```

This writes the current errors to `phpstan-baseline.neon`. Add that file to the `includes` in `phpstan.neon`, and from then on PHPStan only reports **new** errors. Shrink the baseline whenever you touch a file, and regenerate it when it gets smaller.

A few more tips:

- **Raise the level one step at a time**, and generate a new baseline each time if needed.
- **Prefer fixing over ignoring.** An `@phpstan-ignore` comment is fine for a real false positive, but add a short reason.
- **Give it memory.** On large projects, pass `--memory-limit=1G` if the analysis runs out of memory.

## Running Larastan and Pint every day

The tools only help if they run without anyone having to remember. Composer scripts give the whole team the same commands:

```json
"scripts": {
    "lint": "pint --parallel",
    "lint:check": "pint --parallel --test",
    "types:check": "phpstan analyse"
}
```

A sensible routine looks like this:

- **While coding:** run `vendor/bin/pint --dirty` before each commit, or let your editor run Pint on save.
- **Before pushing:** run `composer types:check` on the code you changed.
- **In CI:** run `pint --test` first because it's fast, then PHPStan, then the test suite. Fail the build on any error.
- **After upgrading Laravel or packages:** re-run PHPStan, because new stubs can surface new errors.
- **With AI coding agents:** give them the same commands. Agent output is easier to review when style is already fixed and types are checked.

## Frequently asked questions

### Do I need both Larastan and Pint?

Yes, if you want both consistent style and early bug detection. Pint only changes formatting and never tells you that a method doesn't exist. Larastan never touches formatting. They overlap very little and run in different steps.

### What PHPStan level should a Laravel project use?

There's no single answer. Level 5 catches many real bugs with little effort. Levels 6 to 8 need proper type declarations and null handling and pay off in larger codebases. Pick the highest level you can keep at zero errors, with a baseline for older code.

### Why does Larastan say a property doesn't exist on my model?

Larastan learns model attributes from your migrations and from `@property` docblocks. If a column is added somewhere Larastan doesn't scan, or the property is computed, add a `@property` annotation or an accessor with a proper return type.

### Can Pint format Blade templates?

Pint has a `--blade` option that enables its Blade formatting rule. Many teams format Blade and frontend files with Prettier instead and keep Pint for PHP only.

## How SaaS Laravel handles this

The [SaaS Laravel kits](/) ship with both tools configured. `pint.json` uses the `laravel` preset plus stricter rules such as `strict_comparison`, `date_time_immutable`, `mb_str_functions`, `global_namespace_import` and a fixed class element order. `phpstan.neon` runs Larastan at level 7 with the Carbon extension. `composer lint` fixes style, `composer lint:check` and `composer types:check` only report, and `composer test` runs Pint, frontend linting, PHPStan and Pest in one go. A GitHub Actions workflow runs the same checks on pushes to `main` and on pull requests. See [testing and code quality](/docs/core/testing.html) and the [Composer scripts reference](/docs/reference/commands.html#composer-scripts).

<BlogPostCta title="Start with the checks already wired" text="SaaS Laravel kits include Pint, Larastan at level 7, Pest and a CI workflow, alongside multi-tenancy, roles and Fortify authentication." />
