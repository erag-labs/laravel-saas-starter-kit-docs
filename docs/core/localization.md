---
title: "Laravel Localization in 17 Languages"
description: "17 languages with one translation file per feature, per-user and per-domain language, translated validation messages and frontend translation helpers."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/core/localization.html
  - - meta
    - property: og:title
      content: "Laravel Localization in 17 Languages"
  - - meta
    - property: og:description
      content: "17 languages with one translation file per feature, per-user and per-domain language, translated validation messages and frontend translation helpers."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/core/localization.html
  - - meta
    - name: twitter:title
      content: "Laravel Localization in 17 Languages"
  - - meta
    - name: twitter:description
      content: "17 languages with one translation file per feature, per-user and per-domain language, translated validation messages and frontend translation helpers."
---

# Localization

The kits ship with **17 languages**. Translations are written once, as Laravel PHP files, and shared with the frontend, so the backend and the components always use the same strings.

```text
lang/<locale>/*.php
  → php artisan erag:generate-lang
  → resources/js/lang/<locale>/*.json
  → shared as the Inertia `lang` prop
  → __('...') in components
```

The sharing is done by `erag/laravel-lang-sync-inertia` (PHP) and `@erag/lang-sync-inertia` (JS).

## Languages

Defined in `Modules\Settings\Enums\LanguageEnum`:

| Code | Language | Code | Language |
| --- | --- | --- | --- |
| `en` | English (default) | `nl` | Dutch |
| `hi` | Hindi | `id` | Indonesian |
| `es` | Spanish | `bn` | Bengali |
| `fr` | French | `pl` | Polish |
| `de` | German | `vi` | Vietnamese |
| `it` | Italian | `th` | Thai |
| `pt` | Portuguese | `ko` | Korean |
| `ru` | Russian | `tr` | Turkish |
| `ja` | Japanese | | |

`LanguageEnum::DEFAULT` is English; `LanguageEnum::resolve()` falls back to it for unknown codes.

## File layout

Laravel's core files sit at the top of each locale; kit strings are split into one file per feature under `modules/`.

```text
lang/<locale>/
├── auth.php  pagination.php  passwords.php  validation.php     # Laravel core
└── modules/                                                    # one file per feature
    ├── auth.php  common.php  dashboard.php  domain.php  errors.php  home.php  layout.php
    └── maintenance.php  menu.php  role.php  security.php  settings.php  tenant.php  user.php

resources/js/lang/<locale>/        # generated JSON, same structure
```

## How the locale is resolved

`SetUserLocale` runs on every web request and uses the first value that exists:

1. **User language**: `users.locale`, if the signed-in user picked one
2. **Domain default**: `domains.locale` of the current tenant domain (tenant context only)
3. **App default**: `APP_LOCALE` (`en`)

Users change their language in **Profile** or from the **user menu** (`PATCH /settings/language`, route `language.update`). Choosing **Default** stores `null`, so the user follows the domain or app default.

| Shared prop | Content |
| --- | --- |
| `locale` | Active locale |
| `userLocale` | User's choice, or `null` |
| `defaultLocale` | Domain or app default |
| `languages` | Options for language selects |

**Related files**: `Modules/Settings/Http/Middleware/SetUserLocale.php`, `Modules/Settings/Enums/LanguageEnum.php`.

## Using translations

The key is the file path plus the array path. PHP uses `/` for sub-folders; components use `.` everywhere.

| Where | Key format | Example |
| --- | --- | --- |
| PHP | `modules/<file>.<key>` | `__('modules/tenant.toasts.created')` |
| Components | `modules.<file>.<key>` | `__('modules.tenant.index.title')` |

Placeholders work like Laravel in both: `__('modules/user.notifications.invitation.expires', ['days' => 7])` in PHP, `__('...', { name: user.name })` in components. `transChoice` handles pluralization.

Translations are also used in two places you do not call yourself:

- **Data objects** translate validation attribute names and messages in `attributes()` and `messages()`.
- **Menu titles** use `modules/common.nav.<slug>` (dots and dashes in the slug become underscores), falling back to the `title` column.

### In components

Import the helper for **your framework from its subpath**:

::: code-group

```vue [Vue]
<script setup lang="ts">
import { vueLang } from '@erag/lang-sync-inertia/vue';

const { __ } = vueLang();
</script>

<template>
    <h1>{{ __('modules.tenant.index.title') }}</h1>
</template>
```

```tsx [React]
import { reactLang } from '@erag/lang-sync-inertia/react';

export default function Title() {
    const { __ } = reactLang();

    return <h1>{__('modules.tenant.index.title')}</h1>;
}
```

```svelte [Svelte]
<script lang="ts">
    import { svelteLang } from '@erag/lang-sync-inertia/svelte';

    const { __ } = svelteLang();
</script>

<h1>{__('modules.tenant.index.title')}</h1>
```

:::

The helper also returns `trans` and `transChoice`.

::: warning Always use the subpath import
Import from `@erag/lang-sync-inertia/vue`, `/react` or `/svelte`. The root import `@erag/lang-sync-inertia` breaks the build in the kits.
:::

## Generating frontend JSON

The frontend reads the generated JSON, not the PHP files. After editing any file in `lang/`, regenerate and commit the output:

```bash
php artisan erag:generate-lang
```

| Config key (`config/inertia-lang.php`) | Value |
| --- | --- |
| `lang_path` (source) | `lang/` |
| `output_lang` (output) | `resources/js/lang/` |

The backend shares a merge of this generated JSON and any runtime-loaded translations.

## Adding a translation key

1. Add the key to `lang/en/modules/<feature>.php`.
2. Add the same key to the other 16 locales (missing keys fall back to the raw key string on the frontend).
3. Run `php artisan erag:generate-lang`.
4. Use it: `__('modules/<feature>.key')` in PHP, `__('modules.<feature>.key')` in components.

For a new feature, create `lang/<locale>/modules/<feature>.php` in every locale.

## Adding a language

1. Add a case and a label to `Modules\Settings\Enums\LanguageEnum`, for example `case Swedish = 'sv';` and `self::Swedish => 'Svenska'` in `label()`.
2. Copy `lang/en` to `lang/sv` and translate it.
3. Run `php artisan erag:generate-lang`.
4. Run `php artisan typescript:transform` so the enum type in `resources/js/types` is updated.

The new language then appears in the profile, user menu and domain settings selects.
