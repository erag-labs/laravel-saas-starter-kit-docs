---
title: "Vue Kit Components (shadcn-vue)"
description: "Common form components, the confirm dialog, shadcn-vue primitives, icons, toasts and app shell components in the Vue kit, with a small usage example."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/vue/components.html
  - - meta
    - property: og:title
      content: "Vue Kit Components (shadcn-vue)"
  - - meta
    - property: og:description
      content: "Common form components, the confirm dialog, shadcn-vue primitives, icons, toasts and app shell components in the Vue kit, with a small usage example."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/vue/components.html
  - - meta
    - name: twitter:title
      content: "Vue Kit Components (shadcn-vue)"
  - - meta
    - name: twitter:description
      content: "Common form components, the confirm dialog, shadcn-vue primitives, icons, toasts and app shell components in the Vue kit, with a small usage example."
---

# Components <Badge type="tip" text="Vue" />

## Overview

Components live in `resources/js/components`, in three groups:

| Folder | What it holds |
| --- | --- |
| `components/common/` | The kit's own form kit: `Common*` inputs, buttons, tooltip, icon and `ConfirmDialog` |
| `components/ui/` | shadcn-vue primitives built on reka-ui |
| `components/` | App shell and feature components (`AppSidebar`, `AppHeader`, `UserMenuContent`, …) |

Build pages with the `Common*` components first. They wire up the label, `id`, `aria-*` attributes and the error message, so a field is one line.

Page-only components live next to their page in `Partials/` (for example `pages/tenants/Partials/DomainModal.vue`), not in `components/`.

## Common form components

| Component | Purpose |
| --- | --- |
| `CommonInput` | Text-like input (`type` defaults to `text`) |
| `CommonPassword` | Password input with a show/hide toggle. Exposes `focus()` via a template ref |
| `CommonTextarea` | Textarea with `rows` (default `3`) and `maxlength` |
| `CommonSelect` | shadcn-vue `Select` with a label. Takes `options: SelectOption[]` and exports the `SelectOption` type |
| `CommonRadio` | reka-ui radio group. Takes `options: SelectOption[]` |
| `CommonCheckbox` | Checkbox with a boolean `v-model` and optional `value` |
| `CommonLabel` | Label with `required` (asterisk), `optional` (translated tag) and `hint` |
| `CommonError` | Renders `message` in a `role="alert"` paragraph, nothing when empty |
| `CommonButton` | Button with a `loading` state (disabled + spinner) |
| `CommonButtonRow` | Save / Discard bar for settings forms, shown when the form is dirty |
| `CommonTooltip` | Wraps its slot in a tooltip (`content`, `side`) |
| `ConfirmDialog` | Global confirm dialog, opened with `useConfirmDialog()` |

Shared behaviour of the input components:

- Common props: `name`, `id`, `label`, `error`, `required`, `disabled`.
- An `id` is generated when you don't pass one.
- Other attributes (`autofocus`, `class`, `data-test`, …) go to the underlying element.
- Inside an Inertia `<Form>` you only need `name` and `error`. Prefill with `:default-value`.
- Outside a `<Form>`, bind a value with `v-model`.

::: details View props reference
| Component | Props |
| --- | --- |
| `CommonInput` | `type` (`'text'`), `name`, `id`, `label`, `placeholder`, `autocomplete`, `disabled`, `required`, `readonly`, `error`, `v-model: string \| number` |
| `CommonPassword` | Same as `CommonInput` without `type`; `v-model: string` |
| `CommonTextarea` | Input props plus `rows` (`3`) and `maxlength`; `v-model: string` |
| `CommonSelect` | `options` (required, `{ label, value, disabled? }[]`), `placeholder` (translated "Select an option"), `name`, `id`, `label`, `disabled`, `required`, `error`, `v-model: string \| number` |
| `CommonRadio` | `options` (required), `name`, `id`, `label`, `disabled`, `required`, `error`, `v-model` |
| `CommonCheckbox` | `name`, `id`, `label`, `value`, `disabled`, `required`, `error`, `v-model: boolean` |
| `CommonLabel` | `for`, `label`, `required`, `optional`, `hint`, `disabled`, `class`; content from the default slot or `label` |
| `CommonError` | `message` |
| `CommonButton` | `type` (`'button'`), `variant` (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`), `size` (`default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg`), `disabled`, `loading` |
| `CommonButtonRow` | `isDirty`, `processing` (`false`), `position` (`'bottom-pop'`, `'top-pop'`, `'inline'`, `'sticky-bottom'`), `saveVariant` (`'default'`), `discardVariant` (`'outline'`), `saveText`, `discardText`, `message` (translated defaults), `showDiscard` (`true`), `alwaysVisible`, `saveDisabled` (`false`). Events: `save`, `discard` |
| `CommonTooltip` | `content`, `side` (`'top'`), `delayDuration` (`200`), `disabled`, `contentClass`; `content` slot for rich content |
:::

### CommonButtonRow

With the default `bottom-pop` position the bar slides in only when `isDirty` is true. Save calls `requestSubmit()` on the closest `<form>`, so it works inside `<Form>` without extra wiring.

```vue
<Form v-bind="ProfileController.update.form()" set-defaults-on-success
      v-slot="{ errors, processing, isDirty, reset }">
    <CommonInput id="name" name="name" :default-value="user.name" :error="errors.name" />
    <CommonButtonRow :is-dirty="isDirty" :processing="processing" @discard="reset()" />
</Form>
```

### Confirm dialog

`ConfirmDialog` is mounted once by the app layouts. Call `confirm()` from any page; it returns a `Promise<boolean>`.

```ts
const { confirm } = useConfirmDialog();

if (await confirm({ title, message, confirmVariant: 'destructive' })) {
    router.delete(destroy.url(user.id), { preserveScroll: true });
}
```

Other options (all optional): `warning`, `itemDetails`, `confirmText`, `icon` (`danger`, `warning`, `info`, `question`, `success`), `size` (`sm` to `xl`), `warningVariant`, `highlight`, `confirmationKeyword` (user must type it to enable the button), `closeOnBackdrop`, `closeOnEscape`, `showCancelButton`. Call `setLoading(true)` to show a spinner on the confirm button.

::: warning
`ConfirmDialog` is only mounted by `AppSidebarLayout` and `AppHeaderLayout`. Pages rendered with `AuthLayout` or without a layout cannot use `confirm()`.
:::

::: details View full example (delete user)
```ts
import { useConfirmDialog } from '@/composables/useConfirmDialog';

const { confirm } = useConfirmDialog();

const isConfirmed = await confirm({
    title: __('modules.user.index.delete_confirm.title'),
    message: __('modules.user.index.delete_confirm.message', { name: user.name }),
    warning: __('modules.user.index.delete_confirm.warning'),
    itemDetails: [{ label: __('modules.user.index.delete_confirm.email'), value: user.email, code: true }],
    confirmText: __('modules.user.index.delete_confirm.confirm'),
    confirmVariant: 'destructive',
});

if (isConfirmed) {
    router.delete(destroy.url(user.id), { preserveScroll: true });
}
```
:::

## UI primitives (shadcn)

`components/ui/<name>/` holds shadcn-vue components (new-york-v4 style, configured in `components.json`). Each folder has an `index.ts`:

`alert`, `avatar`, `badge`, `breadcrumb`, `button`, `card`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `input`, `input-otp`, `label`, `navigation-menu`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `spinner`, `tooltip`.

```ts
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
```

Use them directly for layout and display (cards, badges, dialogs). For form fields, prefer the `Common*` wrappers.

## Icons & toasts

| Need | Use |
| --- | --- |
| Icon in a template | `@lucide/vue` components, e.g. `import { Plus } from '@lucide/vue'` |
| Icon stored as a string (menus in the database) | `CommonIcon` (Iconify) |
| Toast from the server | `Inertia::flash('toast', …)`, see [Inertia → Flash toasts](/docs/vue/inertia#flash-toasts) |
| Toast from the client | `import { toast } from 'vue-sonner'` |

`CommonIcon` takes `icon`, `class` and `click`. PascalCase names are converted to Lucide (`LayoutGrid` → `lucide:layout-grid`); names with a prefix are used as is.

```vue
<CommonIcon icon="lucide:building-2" class="size-4" />
```

::: warning
The `Toaster` is mounted only in `AppSidebarLayout` and `AppHeaderLayout`. Toasts do not show on auth pages or pages without a layout.
:::

## Usage example

A typical field, a tooltip action and a submit button:

```vue
<CommonInput name="email" type="email" :label="__('modules.auth.common.email_address')"
             required autocomplete="email" :error="errors.email" />

<CommonTooltip :content="__('modules.user.index.actions.edit')">
    <CommonButton variant="outline" size="icon-sm" @click="openEditModal(user)">
        <Edit3 class="size-4" />
    </CommonButton>
</CommonTooltip>

<CommonButton type="submit" :loading="processing">{{ __('modules.auth.login.submit') }}</CommonButton>
```

::: details View more examples
```vue
<script setup lang="ts">
import CommonSelect from '@/components/common/CommonSelect.vue';
import type { SelectOption } from '@/components/common/CommonSelect.vue';

defineProps<{ roleOptions: SelectOption[] }>();
</script>

<template>
    <CommonSelect id="role" name="role" :label="__('modules.user.form_modal.role')"
                  :options="roleOptions" :error="errors.role" />

    <CommonTextarea id="maintenance_message" name="message"
                    :model-value="maintenance.message ?? ''"
                    :label="__('modules.maintenance.form.message')"
                    :rows="3" :maxlength="500" :error="errors.message" />

    <CommonPassword id="password" name="password" required
                    autocomplete="current-password" :error="errors.password" />

    <CommonCheckbox id="remember" name="remember" :label="__('modules.auth.login.remember_me')" />

    <CommonRadio v-model="resetMethod" name="reset_method" :options="methodOptions" />

    <CommonLabel for="password" required>{{ __('modules.auth.common.password') }}</CommonLabel>
    <CommonError :message="errors.code" />
</template>
```
:::

## App shell components

| Component | Purpose |
| --- | --- |
| `AppShell`, `AppContent` | Wrap the sidebar provider and main content (`variant: 'sidebar' \| 'header'`) |
| `AppSidebar` | Sidebar with `NavMain` (from `menus`) or the setup menu (`setupMenus` on `/setup/*`), and `NavUser` |
| `AppSidebarHeader` | Top bar of the sidebar layout with the trigger and `Breadcrumbs` |
| `AppHeader` | Top navigation for the header layout (menus, breadcrumbs, user menu) |
| `NavMain`, `NavFooter`, `NavUser` | Sidebar menu tree, footer links, user dropdown |
| `UserMenuContent` | User dropdown: settings link, language switcher (`useLanguage().changeLanguage`), logout |
| `Breadcrumbs` | Renders `BreadcrumbItem[]`; titles are translation keys |
| `Heading` | Page or section heading. Props: `title`, `description?`, `variant?: 'default' \| 'small'` |
| `TextLink` | Styled Inertia `Link`. Props: `href`, `tabindex?`, `method?`, `as?` |
| `ErrorStatus` | Body of the error page for 403/404/500/503. Prop: `status: number` |
| `AlertError` | Destructive alert listing `errors: string[]` |
| `AppLogo`, `AppLogoIcon`, `PlaceholderPattern`, `UserInfo`, `AppearanceTabs` | Branding, placeholders, avatar + name, theme switcher |
| `DeleteUser` | Delete-account section on the profile page |
| `ManageTwoFactor`, `TwoFactorSetupModal`, `TwoFactorRecoveryCodes` | Two-factor setup on the security page |
| `ManagePasskeys`, `PasskeyRegister`, `PasskeyItem`, `PasskeyVerify` | Passkey management and passkey login |
