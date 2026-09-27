---
title: "Composer & npm Packages Used"
description: "The key Composer and npm packages used by the kits, with their version constraints and what each one is used for in the backend and frontend."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/reference/packages.html
  - - meta
    - property: og:title
      content: "Composer & npm Packages Used"
  - - meta
    - property: og:description
      content: "The key Composer and npm packages used by the kits, with their version constraints and what each one is used for in the backend and frontend."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/reference/packages.html
  - - meta
    - name: twitter:title
      content: "Composer & npm Packages Used"
  - - meta
    - name: twitter:description
      content: "The key Composer and npm packages used by the kits, with their version constraints and what each one is used for in the backend and frontend."
---

# Packages

Version constraints are taken from each kit's `composer.json` and `package.json`.

## Backend (all kits)

| Package | Constraint | Used for |
| --- | --- | --- |
| `laravel/framework` | `^13.17` | Framework |
| `inertiajs/inertia-laravel` | `^3.0` | Inertia v3 server adapter, shared props, flash data |
| `laravel/fortify` | `^1.37.2` | Headless auth: login, registration, reset, verification, 2FA, passkeys |
| `stancl/tenancy` | `^3.10` | Multi-database tenancy, domain identification, tenant commands |
| `spatie/laravel-permission` | `^8.3` | Roles and permissions |
| `spatie/laravel-data` | `^4.23` | Data objects for validation and typed props |
| `laravel/wayfinder` | `^0.1.14` | Typed TypeScript route/action functions |
| `erag/laravel-lang-sync-inertia` | `^2.3` | Shares `lang/` translations with Inertia, `erag:generate-lang` |
| `laravel/chisel` | `^0.1.0` | Toolkit for scripts that remove unwanted code, files and dependencies |
| `laravel/tinker` | `^3.0` | REPL |

### Dev

| Package | Constraint | Used for |
| --- | --- | --- |
| `pestphp/pest` + `pestphp/pest-plugin-laravel` | `^5.1` / `^5.0` | Tests |
| `larastan/larastan` | `^3.9` | Static analysis (`composer types:check`) |
| `laravel/pint` | `^1.27` | Code style |
| `laravel/boost` | `^2.2` | AI agent guidelines, skills and MCP server |
| `spatie/laravel-typescript-transformer` | `^3.3` | `php artisan typescript:transform` |
| `laravel/pail` | `^1.2.5` | Log tailing in `composer dev` |
| `laravel/pao` | `^1.0.6` | Agent-optimized output for PHP testing tools |
| `laravel/sail` | `^1.53` | Docker environment (installed, not the default setup) |
| `nunomaduro/collision`, `mockery/mockery`, `fakerphp/faker` | | Testing utilities |

## Frontend (all kits)

| Package | Constraint | Used for |
| --- | --- | --- |
| `vite` | `^8.0.0` | Bundler |
| `laravel-vite-plugin` | `^3.0.0` | Laravel integration |
| `@inertiajs/vite` | `^3.0.0` | Inertia Vite plugin (page resolution) |
| `@laravel/vite-plugin-wayfinder` | `^0.1.3` | Regenerates Wayfinder files during dev/build |
| `tailwindcss` + `@tailwindcss/vite` | v4 | Styling |
| `typescript` | `^5` | Types |
| `@erag/lang-sync-inertia` | `^3.1.0` | Translation helpers (`__`, `trans`, `transChoice`) |
| `@laravel/passkeys` | `^0.2.0` | WebAuthn in the browser |
| `eslint`, `prettier` (+ plugins) | `^9`, `^3` | Linting and formatting |

## Per framework

| | <Badge type="tip" text="Vue" /> | <Badge type="tip" text="React" /> | <Badge type="tip" text="Svelte" /> |
| --- | --- | --- | --- |
| Framework | `vue ^3.5.13` | `react ^19.2.0` | `svelte ^5.16.0` |
| Inertia adapter | `@inertiajs/vue3 ^3.0.0` | `@inertiajs/react ^3.0.0` | `@inertiajs/svelte ^3.0.0` |
| Headless UI | `reka-ui ^2.9.8` (shadcn-vue) | `@radix-ui/*` (shadcn/ui) | `bits-ui ^2.15.0` (shadcn-svelte) |
| Icons | `@lucide/vue`, `@iconify/vue` | `lucide-react`, `@iconify/react` | `lucide-svelte`, `@iconify/svelte` |
| Toasts | `vue-sonner` | `sonner` | `svelte-sonner` |
| Drag and drop | `vue-draggable-plus` | `sortablejs` | `sortablejs` |
| OTP input | `vue-input-otp` | `input-otp` | none (own component in `components/ui/input-otp`) |
| Type check | `vue-tsc` | `tsc` | `svelte-check` |

## Translations: erag/laravel-lang-sync-inertia

The backend package `erag/laravel-lang-sync-inertia` (`^2.3`) and the frontend package `@erag/lang-sync-inertia` (`^3.1.0`) work together:

```text
lang/<locale>/**/*.php → php artisan erag:generate-lang → resources/js/lang/<locale>/*.json → __() in components
```

| Part | Details |
| --- | --- |
| Config | `config/inertia-lang.php` (`lang_path` = `lang/`, `output_lang` = `resources/js/lang`). The kits already include it; in a new project publish it with `php artisan erag:install-lang`. |
| Export | `php artisan erag:generate-lang` converts the PHP files to JSON |
| Sharing | The service provider shares a `lang` Inertia prop for the active locale |
| Frontend helpers | `__()`, `trans()`, `transChoice()`, `trans_choice()` with `:placeholder` replacement and Laravel-style pluralization |

Import the helper from the **framework subpath**, never the package root:

::: code-group

```ts [Vue]
import { vueLang } from '@erag/lang-sync-inertia/vue';

const { __ } = vueLang();
```

```ts [React]
import { reactLang } from '@erag/lang-sync-inertia/react';

const { __ } = reactLang();
```

```ts [Svelte]
import { svelteLang } from '@erag/lang-sync-inertia/svelte';

const { __ } = svelteLang();
```

:::

The package declares `node >= 24` in its `engines` field. See [Localization](/docs/core/localization).

## Documentation site

This site uses VitePress `1.6.4`.
