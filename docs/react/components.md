---
title: "React Kit Components (shadcn/ui)"
description: "Common form components, the confirm dialog, shadcn/ui primitives, icons, toasts and app shell components in the React kit, with a small usage example."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/react/components.html
  - - meta
    - property: og:title
      content: "React Kit Components (shadcn/ui)"
  - - meta
    - property: og:description
      content: "Common form components, the confirm dialog, shadcn/ui primitives, icons, toasts and app shell components in the React kit, with a small usage example."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/react/components.html
  - - meta
    - name: twitter:title
      content: "React Kit Components (shadcn/ui)"
  - - meta
    - name: twitter:description
      content: "Common form components, the confirm dialog, shadcn/ui primitives, icons, toasts and app shell components in the React kit, with a small usage example."
---

# Components <Badge type="tip" text="React" />

## Overview

Components live in `resources/js/components`, in three groups:

| Folder | What it holds |
| --- | --- |
| `components/common/` | The kit's own components: `Common*` inputs, buttons, tooltip, icon and `ConfirmDialog` |
| `components/ui/` | shadcn/ui primitives built on Radix UI (`button.tsx`, `dialog.tsx`, `select.tsx`, `sidebar.tsx`, …) |
| `components/` | App shell and feature components (`AppSidebar`, `AppHeader`, `UserMenuContent`, `ErrorStatus`, …) |

Reach for `Common*` components first. They wire up the label, `id`, `aria-*` attributes and the error message, so a field is one line. Each file has both a named and a default export.

::: tip
Page-only components live next to their page in `partials/` (for example `pages/tenants/partials/domain-modal.tsx`), not in `components/`.
:::

## Common form components

| Component | File | Purpose |
| --- | --- | --- |
| `CommonInput` | `common-input.tsx` | Text, email, number, … input with label and error |
| `CommonPassword` | `common-password.tsx` | Password input with a show/hide toggle |
| `CommonTextarea` | `common-textarea.tsx` | Textarea with label and error |
| `CommonSelect` | `common-select.tsx` | shadcn/ui `Select` with label; exports the `SelectOption` type |
| `CommonRadio` | `common-radio.tsx` | Radio group from `SelectOption[]` |
| `CommonCheckbox` | `common-checkbox.tsx` | Radix checkbox with label; notifies `<Form>` dirty tracking |
| `CommonLabel` | `common-label.tsx` | Label with `required` asterisk, `optional` tag and `hint` |
| `CommonError` | `common-error.tsx` | `role="alert"` error text; renders nothing when empty |
| `CommonButton` | `common-button.tsx` | `Button` with a `loading` state (disabled + spinner) |
| `CommonButtonRow` | `common-button-row.tsx` | Save / Discard bar that appears when a form is dirty |
| `CommonTooltip` | `common-tooltip.tsx` | Tooltip around any trigger |
| `ConfirmDialog` | `confirm-dialog.tsx` | Promise-based confirm dialog, opened with `useConfirmDialog()` |

All input components share the same basics:

- They accept `label`, `error`, `required` and `disabled`.
- They generate an `id` with `useId()` when you don't pass one.
- Other props (`autoFocus`, `tabIndex`, `className`, `data-test`, …) go to the underlying element.
- Inside an Inertia `<Form>` you only need `name` and `error`. Use `defaultValue` to prefill.
- Outside a `<Form>`, control the value with `value` + `onChange` / `onValueChange`.

::: details View props of each component
| Component | Props |
| --- | --- |
| `CommonInput` | All `<input>` props (`ComponentProps<'input'>`) + `label?`, `error?` |
| `CommonPassword` | `<input>` props except `type` + `label?`, `error?` |
| `CommonTextarea` | `<textarea>` props + `label?`, `error?` |
| `CommonSelect` | `options: SelectOption[]` (required), `name`, `label`, `placeholder` (defaults to translated "Select an option"), `error`, `required`, `value` / `defaultValue` (`string \| number`), `onValueChange(value: string)`. Other props go to `SelectTrigger`. `SelectOption` is `{ label, value, disabled? }` |
| `CommonRadio` | `options: SelectOption[]` (required), `name`, `label`, `disabled`, `required`, `error`, `value`, `defaultValue`, `onValueChange(value: string \| number)`, plus `<div>` props |
| `CommonCheckbox` | Radix `Checkbox` props (`name`, `value`, `checked`, `defaultChecked`, …) + `label`, `error`, `onCheckedChange(checked: boolean)`. Dispatches a `change` event after toggling so `<Form>` sees it |
| `CommonLabel` | `htmlFor`, `label`, `required` (red asterisk), `optional` (translated "Optional" tag), `hint` (right-aligned text), `disabled`, `className`, `children` |
| `CommonError` | `message`, `id`, `className` |
| `CommonTooltip` | `content: ReactNode`, `side` (default `top`), `delayDuration` (default `200`), `disabled`, `contentClassName`, `children`. With no `content` or when `disabled`, only the children render |
:::

### CommonButton and CommonButtonRow

`CommonButton` defaults to `type="button"`. While `loading` is true it is disabled and shows a `Spinner` in place of its children.

| Prop | Values | Default |
| --- | --- | --- |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` |
| `variant` | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` | `default` |
| `size` | `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg` | `default` |
| `loading` | `boolean` | — |

`CommonButtonRow` is the Save / Discard bar on settings forms. In the default `bottom-pop` position it slides in only when `isDirty` is true. Save calls `requestSubmit()` on the closest `<form>`, so it works inside `<Form>` without extra wiring.

::: details View CommonButtonRow props
| Prop | Type | Default |
| --- | --- | --- |
| `isDirty`, `processing` | `boolean` | `false` |
| `position` | `'bottom-pop' \| 'top-pop' \| 'inline' \| 'sticky-bottom'` | `'bottom-pop'` |
| `saveVariant`, `discardVariant` | button variant | `'default'`, `'outline'` |
| `saveText`, `discardText`, `message` | `string` | translated defaults |
| `showDiscard` | `boolean` | `true` |
| `alwaysVisible`, `saveDisabled` | `boolean` | `false` |
| `onSave`, `onDiscard` | `() => void` | — |
| `className` | `string` | — |
:::

### ConfirmDialog

`ConfirmDialog` is mounted once by the app layouts. Call `confirm()` from `useConfirmDialog()` anywhere; it returns a `Promise<boolean>`.

```tsx
const { confirm } = useConfirmDialog();

if (await confirm({ title, message, confirmVariant: 'destructive' })) {
    router.delete(destroy.url(user.id), { preserveScroll: true });
}
```

Useful options (all optional): `warning`, `itemDetails`, `icon` (`danger`, `warning`, `info`, `question`, `success`), `size` (`sm`–`xl`), `warningVariant`, `highlight`, `confirmationKeyword` (user must type it to enable the button), `closeOnBackdrop`, `closeOnEscape`, `showCancelButton`. `setLoading(true)` shows a spinner on the confirm button.

::: warning
`ConfirmDialog` is only mounted by `app-sidebar-layout.tsx` and `app-header-layout.tsx`. Pages rendered with `AuthLayout` or no layout cannot use `confirm()`.
:::

::: details View full example (delete user)
```tsx
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

const { confirm } = useConfirmDialog();

const handleDeleteUser = async (user: UserManagementUser) => {
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
};
```
:::

## UI primitives (shadcn)

`components/ui/*.tsx` holds shadcn/ui components (new-york style, configured in `components.json` at the project root). Use them directly when a `Common*` wrapper doesn't fit, for example dialogs, cards and badges.

Available: `alert`, `avatar`, `badge`, `breadcrumb`, `button`, `card`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `icon`, `input`, `input-otp`, `label`, `navigation-menu`, `placeholder-pattern`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `spinner`, `toggle`, `toggle-group`, `tooltip`.

```tsx
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
```

## Icons & toasts

| Need | Use |
| --- | --- |
| Icon in your own JSX | A `lucide-react` component: `<Plus className="size-4" />` |
| Icon from a string (menus, database) | `CommonIcon`: `<CommonIcon icon="lucide:building-2" className="size-4" />` |
| Icon that may be either | `NavItemIcon` (accepts a string or a Lucide component) |
| Toast from the server | `Inertia::flash('toast', …)` in the controller. See [Inertia → Flash toasts](/docs/react/inertia#flash-toasts) |
| Toast from the client | `import { toast } from 'sonner'` |

`CommonIcon` renders Iconify icons. Names with a prefix (`lucide:…`) are used as is; PascalCase names are converted to Lucide (`LayoutGrid` → `lucide:layout-grid`). Props: `icon`, `className`, `click`.

## Usage example

A typical edit form (from the profile page): inputs inside an Inertia `<Form>`, with the Save / Discard bar.

```tsx
<Form {...ProfileController.update.form()} setDefaultsOnSuccess>
    {({ errors, processing, isDirty, reset }) => (
        <>
            <CommonInput name="name" defaultValue={user.name} error={errors.name} />
            <CommonButtonRow isDirty={isDirty} processing={processing} onDiscard={() => reset()} />
        </>
    )}
</Form>
```

::: details View more field examples
```tsx
<CommonInput
    id="email"
    type="email"
    name="email"
    label={__('modules.auth.common.email_address')}
    required
    autoComplete="email"
    error={errors.email}
/>

<CommonPassword id="password" name="password" required autoComplete="current-password" error={errors.password} />

<CommonTextarea
    id="maintenance_message"
    name="message"
    defaultValue={maintenance.message ?? ''}
    label={__('modules.maintenance.form.message')}
    rows={3}
    maxLength={500}
    error={errors.message}
/>

<CommonSelect
    id="locale"
    name="locale"
    label={__('modules.settings.language.label')}
    value={localeValue}
    onValueChange={setLocaleValue}
    options={languageOptions}
    error={errors.locale}
/>

<CommonRadio
    value={resetMethod}
    onValueChange={(value) => setResetMethod(String(value))}
    name="reset_method"
    options={methodOptions}
/>

<CommonLabel htmlFor="password" required>
    {__('modules.auth.common.password')}
</CommonLabel>
<CommonError message={errors.code} />

<CommonButton type="submit" className="w-full" loading={processing}>
    {__('modules.auth.login.submit')}
</CommonButton>

<CommonTooltip content={__('modules.user.index.actions.edit')}>
    <CommonButton variant="outline" size="icon-sm" onClick={() => openEditModal(user)}>
        <Edit3 className="size-4" />
    </CommonButton>
</CommonTooltip>
```
:::

## App shell components

| Component (file) | Purpose |
| --- | --- |
| `AppShell`, `AppContent` (`app-shell.tsx`, `app-content.tsx`) | Wrap the sidebar provider and main content (`variant: 'sidebar' \| 'header'`) |
| `AppSidebar` (`app-sidebar.tsx`) | Sidebar with `NavMain` (from `menus`) or the setup menu (`setupMenus` on `/setup/*`), and `NavUser` |
| `AppSidebarHeader` (`app-sidebar-header.tsx`) | Top bar of the sidebar layout with the trigger and `Breadcrumbs` |
| `AppHeader` (`app-header.tsx`) | Top navigation for the header layout (menus, breadcrumbs, user menu) |
| `NavMain`, `NavFooter`, `NavUser`, `NavItemIcon` | Sidebar menu tree, footer links, user dropdown, string-or-component icon |
| `UserMenuContent` (`user-menu-content.tsx`) | User dropdown: settings link, language switcher, logout |
| `Breadcrumbs` (`breadcrumbs.tsx`) | Renders `BreadcrumbItem[]`; titles are translation keys |
| `Heading` (`heading.tsx`) | Page/section heading. Props: `title`, `description?`, `variant?: 'default' \| 'small'` |
| `TextLink` (`text-link.tsx`) | Styled Inertia `Link`; accepts all `Link` props |
| `ErrorStatus` (`error-status.tsx`) | Body of the error page for 403/404/500/503. Prop: `status: number` |
| `AlertError` (`alert-error.tsx`) | Destructive alert listing `errors: string[]` |
| `AppLogo`, `AppLogoIcon`, `UserInfo`, `AppearanceTabs` | Branding, avatar + name, theme switcher |
| `DeleteUser` (`delete-user.tsx`) | Delete-account section on the profile page |
| `ManageTwoFactor`, `TwoFactorSetupModal`, `TwoFactorRecoveryCodes` | Two-factor setup on the security page |
| `ManagePasskeys`, `PasskeyRegister`, `PasskeyItem`, `PasskeyVerify` | Passkey management and passkey login |

`input-error.tsx` and `password-input.tsx` are not used by any page. Use `CommonError` and `CommonPassword` instead.
