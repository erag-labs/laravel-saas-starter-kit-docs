---
title: "Svelte Kit Components (shadcn-svelte)"
description: "Common form components, the confirm dialog, shadcn-svelte primitives, icons, toasts and app shell components in the Svelte kit, with a small usage example."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/svelte/components.html
  - - meta
    - property: og:title
      content: "Svelte Kit Components (shadcn-svelte)"
  - - meta
    - property: og:description
      content: "Common form components, the confirm dialog, shadcn-svelte primitives, icons, toasts and app shell components in the Svelte kit, with a small usage example."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/svelte/components.html
  - - meta
    - name: twitter:title
      content: "Svelte Kit Components (shadcn-svelte)"
  - - meta
    - name: twitter:description
      content: "Common form components, the confirm dialog, shadcn-svelte primitives, icons, toasts and app shell components in the Svelte kit, with a small usage example."
---

# Components <Badge type="tip" text="Svelte" />

## Overview

Components live in `resources/js/components` in three groups:

| Folder | What it holds |
| --- | --- |
| `components/common/` | The kit's own form kit: `Common*` inputs, buttons, tooltip, icon and `ConfirmDialog` |
| `components/ui/` | shadcn-svelte primitives built on bits-ui (`button`, `dialog`, `select`, `sidebar`, …) |
| `components/` | App shell and feature components (`AppHead`, `AppSidebar`, `AppHeader`, `UserMenuContent`, `ErrorStatus`, …) |

Build pages with the `Common*` components first. They wire up the label, `id`, `aria-*` attributes and the error message for you, so pages stay short and consistent.

::: tip
Page-only components live next to their page in `Partials/` (for example `pages/tenants/Partials/DomainModal.svelte`), not in `components/`.
:::

## Common form components

All files are in `components/common/`.

| Component | Purpose |
| --- | --- |
| `CommonInput` | Text-like input (`type` defaults to `'text'`) |
| `CommonPassword` | Password input with a show/hide toggle |
| `CommonTextarea` | Textarea with `rows` (default `3`) and `maxlength` |
| `CommonSelect` | shadcn-svelte `Select` with a label; exports the `SelectOption` type |
| `CommonRadio` | Radio group built from `SelectOption[]` |
| `CommonCheckbox` | Checkbox with label; binds `checked` |
| `CommonLabel` | Label with required asterisk, "Optional" tag and hint text |
| `CommonError` | Error message in a `role="alert"` paragraph; renders nothing when empty |
| `CommonButton` | `Button` primitive with a `loading` spinner state |
| `CommonButtonRow` | Save / Discard bar for edit forms |
| `CommonTooltip` | Tooltip that passes trigger props to its `children` snippet |
| `ConfirmDialog` | Global confirm modal, opened with `useConfirmDialog()` (see below) |

How the input components behave:

- They take `label`, `error`, `required` and `disabled`, and generate an `id` when you don't pass one.
- Remaining attributes (`autofocus`, `tabindex`, `data-test`, …) are passed to the underlying element.
- **Inside an Inertia `<Form>`:** set `name` and `error`; use `defaultValue` to prefill.
- **Outside a `<Form>`:** use `bind:value` (or `bind:checked` on the checkbox).

::: details Input props: CommonInput, CommonPassword, CommonTextarea
| Prop | Type | Notes |
| --- | --- | --- |
| `type` | `string` | `CommonInput` only, default `'text'` |
| `name`, `id`, `label`, `placeholder`, `autocomplete` | `string` | `autocomplete` not on `CommonTextarea` |
| `disabled`, `required`, `readonly` | `boolean` | |
| `error`, `class` | `string` | |
| `value` (bindable), `defaultValue` | `string \| number \| null` | `string \| null` on `CommonPassword` and `CommonTextarea` |
| `ref` (bindable) | `HTMLInputElement \| null` | `CommonInput` only |
| `rows`, `maxlength` | `number` | `CommonTextarea` only; `rows` defaults to `3` |
:::

::: details Choice props: CommonSelect, CommonRadio, CommonCheckbox
| Prop | Type | Used by |
| --- | --- | --- |
| `options` | `SelectOption[]` (`{ label, value, disabled? }`), required | Select, Radio |
| `name`, `id`, `label`, `error` | `string` | all |
| `placeholder` | `string`, defaults to translated "Select an option" | Select |
| `disabled`, `required` | `boolean` | all |
| `value` (bindable), `defaultValue` | `string \| number \| null` | Select, Radio |
| `onValueChange` | `(value: string \| number) => void` | Select, Radio |
| `checked` (bindable), `defaultValue` | `boolean` | Checkbox |
| `value` | `string` (submitted value) | Checkbox |
| `onCheckedChange` | `(checked: boolean) => void` | Checkbox |

Import the option type from the component's module script:

```ts
import type { SelectOption } from '@/components/common/CommonSelect.svelte';
```
:::

::: details Label and error props: CommonLabel, CommonError
- `CommonLabel`: `for`, `label`, `required`, `optional`, `hint`, `disabled`, `class`, and a `children` snippet. Wraps the `Label` primitive.
- `CommonError`: `message`, `id`, `class`.
:::

::: details Button props: CommonButton, CommonButtonRow
**CommonButton.** While `loading` is true the button is disabled and shows a spinner instead of its content. Other attributes (`onclick`, `tabindex`, …) pass through.

| Prop | Type | Default |
| --- | --- | --- |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` |
| `variant` | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` | `default` |
| `size` | `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg` | `default` |
| `disabled`, `loading` | `boolean` | `false` |
| `class` | `string` | `''` |

**CommonButtonRow.** With the default `bottom-pop` position it slides in only when the form is dirty. Save calls `requestSubmit()` on the closest `<form>`, so it works inside `<Form>` without extra wiring.

| Prop | Type | Default |
| --- | --- | --- |
| `isDirty`, `processing` | `boolean` | `false` |
| `position` | `'bottom-pop' \| 'top-pop' \| 'inline' \| 'sticky-bottom'` | `'bottom-pop'` |
| `saveVariant`, `discardVariant` | button variant | `'default'`, `'outline'` |
| `saveText`, `discardText`, `message` | `string` | translated defaults |
| `showDiscard` | `boolean` | `true` |
| `alwaysVisible`, `saveDisabled` | `boolean` | `false` |
| `onSave`, `onDiscard` | `() => void` | |
:::

::: details Tooltip props: CommonTooltip
Props: `content` (`string` or snippet), `side` (default `top`), `delayDuration` (default `200`), `disabled`, `contentClass`. The `children` snippet receives `{ props }`; spread them onto the trigger element.

```svelte
<CommonTooltip content={__('modules.user.index.actions.edit')}>
    {#snippet children({ props })}
        <CommonButton {...props} variant="outline" size="icon-sm" onclick={() => openEditModal(user)}>
            <Edit3 class="size-4" />
        </CommonButton>
    {/snippet}
</CommonTooltip>
```
:::

### Confirm dialog

Use `ConfirmDialog` for destructive actions instead of `window.confirm`.

- It is mounted once in each app layout; you never render it yourself.
- Its state is a module-level `$state` in `lib/confirmDialog.svelte.ts`.
- `confirm(options)` returns a `Promise<boolean>`.

```ts
const { confirm } = useConfirmDialog();

const isConfirmed = await confirm({
    title: __('modules.user.index.delete_confirm.title'),
    confirmVariant: 'destructive',
});

if (isConfirmed) {
    router.delete(destroy.url(user.id), { preserveScroll: true });
}
```

Other options (all optional): `warning`, `itemDetails`, `confirmText`, `icon` (`danger`, `warning`, `info`, `question`, `success`), `size` (`sm`–`xl`), `warningVariant`, `highlight`, `confirmationKeyword` (user must type it to enable the button), `closeOnBackdrop`, `closeOnEscape`, `showCancelButton`. `setLoading(true)` shows a spinner on the confirm button.

::: warning
`ConfirmDialog` is only mounted by `AppSidebarLayout.svelte` and `AppHeaderLayout.svelte`. Pages rendered with `AuthLayout` or no layout cannot use `confirm()`.
:::

::: details View full example (delete a user)
```ts
import { router } from '@inertiajs/svelte';
import { useConfirmDialog } from '@/lib/confirmDialog.svelte';
import { destroy } from '@/routes/users';

const { confirm } = useConfirmDialog();

async function handleDeleteUser(user: UserManagementUser): Promise<void> {
    const isConfirmed = await confirm({
        title: __('modules.user.index.delete_confirm.title'),
        message: __('modules.user.index.delete_confirm.message', { name: user.name }),
        warning: __('modules.user.index.delete_confirm.warning'),
        itemDetails: [{ label: __('modules.user.index.delete_confirm.email'), value: user.email, code: true }],
        confirmText: __('modules.user.index.delete_confirm.confirm'),
        confirmVariant: 'destructive',
    });

    if (!isConfirmed) {
        return;
    }

    router.delete(destroy.url(user.id), { preserveScroll: true });
}
```
:::

## UI primitives (shadcn)

`components/ui/<name>/` holds shadcn-svelte components (new-york-v4 style, configured in `components.json` at the project root):

`alert`, `avatar`, `badge`, `breadcrumb`, `button`, `card`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `input`, `input-otp`, `label`, `navigation-menu`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `spinner`, `tooltip`.

Import from the folder's `index.ts`:

```ts
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
```

## Icons & toasts

| Need | Use |
| --- | --- |
| Icon in a component | `lucide-svelte`, one import per icon: `import Plus from 'lucide-svelte/icons/plus'` |
| Icon from a string (database menus) | `CommonIcon` with an Iconify name: `<CommonIcon icon="lucide:building-2" class="size-4" />` |
| Toast from the server | `Inertia::flash('toast', …)`; see [Inertia → Flash toasts](/docs/svelte/inertia#flash-toasts) |
| Toast from the client | `import { toast } from 'svelte-sonner'` |

`CommonIcon` converts PascalCase names to Lucide (`LayoutGrid` → `lucide:layout-grid`) and uses names that already have a prefix as is. Props: `icon`, `class`, `click` (click handler).

The `Toaster` (`components/ui/sonner`) is mounted only in the two app layouts (`AppSidebarLayout`, `AppHeaderLayout`), so toasts do not appear on auth pages or pages without a layout.

## Usage example

A settings form with a prefilled input and the Save / Discard bar:

```svelte
<Form {...ProfileController.update.form()} setDefaultsOnSuccess>
    {#snippet children({ errors, processing, isDirty, reset })}
        <CommonInput name="name" defaultValue={user.name} error={errors.name} />
        <CommonButtonRow {isDirty} {processing} onDiscard={() => reset()} />
    {/snippet}
</Form>
```

::: details View more examples
```svelte
<CommonInput
    id="email"
    type="email"
    name="email"
    label={__('modules.auth.common.email_address')}
    required
    autocomplete="email"
    error={errors.email}
/>

<CommonTextarea
    id="maintenance_message"
    name="message"
    defaultValue={maintenance.message ?? ''}
    label={__('modules.maintenance.form.message')}
    rows={3}
    maxlength={500}
    error={errors.message}
/>

<CommonSelect
    id="locale"
    name="locale"
    label={__('modules.settings.language.label')}
    defaultValue={language.toLocaleValue(language.userLocale)}
    options={languageOptions}
    error={errors.locale}
/>

<CommonRadio bind:value={resetMethod} name="reset_method" options={methodOptions} />

<CommonCheckbox
    id="send_invitation"
    bind:checked={sendInvitation}
    name="send_invitation"
    value="1"
    label={__('modules.user.form_modal.send_invitation')}
/>

<CommonLabel for="password" required>{__('modules.auth.common.password')}</CommonLabel>
<CommonError message={errors.code} />

<CommonButton type="submit" class="w-full" loading={processing}>
    {__('modules.auth.login.submit')}
</CommonButton>
```
:::

## App shell components

| Component | Purpose |
| --- | --- |
| `AppHead` | Sets `<title>` as `"{title} - {VITE_APP_NAME}"` through `<svelte:head>`. Props: `title`, `children` snippet for extra head tags |
| `AppShell`, `AppContent` | Wrap the sidebar provider and main content (`variant: 'sidebar' \| 'header'`) |
| `AppSidebar` | Sidebar with `NavMain` (from `menus`) or the setup menu (`setupMenus` on `/setup/*`), and `NavUser` |
| `AppSidebarHeader` | Top bar of the sidebar layout with the trigger and `Breadcrumbs` |
| `AppHeader` | Top navigation for the header layout (menus, breadcrumbs, user menu) |
| `NavMain`, `NavFooter`, `NavUser` | Sidebar menu tree, footer links, user dropdown |
| `UserMenuContent` | User dropdown: settings link, language switcher (`changeLanguage`), logout |
| `Breadcrumbs` | Renders `BreadcrumbItem[]`; titles are translation keys |
| `Heading` | Page/section heading. Props: `title`, `description?`, `variant?: 'default' \| 'small'` |
| `TextLink` | Styled Inertia `Link`. Props: `href`, `tabindex?`, `method?`, `as?` |
| `ErrorStatus` | Body of the error page for 403/404/500/503. Prop: `status: number` |
| `AlertError` | Destructive alert listing `errors: string[]` |
| `AppLogo`, `AppLogoIcon`, `PlaceholderPattern`, `UserInfo`, `AppearanceTabs` | Branding, placeholders, avatar + name, theme switcher |
| `DeleteUser` | Delete-account section on the profile page |
| `ManageTwoFactor`, `TwoFactorSetupModal`, `TwoFactorRecoveryCodes` | Two-factor setup on the security page |
| `ManagePasskeys`, `PasskeyRegister`, `PasskeyItem`, `PasskeyVerify` | Passkey management and passkey login |

`InputError.svelte` and `PasswordInput.svelte` are not used by any page. Use `CommonError` and `CommonPassword` instead.
