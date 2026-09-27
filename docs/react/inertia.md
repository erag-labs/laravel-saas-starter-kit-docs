---
title: "Inertia v3 with React"
description: "Inertia v3 patterns in the React kit: how pages receive data, the Form component, useForm, visits, shared props, flash toasts and typed Wayfinder routes."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/react/inertia.html
  - - meta
    - property: og:title
      content: "Inertia v3 with React"
  - - meta
    - property: og:description
      content: "Inertia v3 patterns in the React kit: how pages receive data, the Form component, useForm, visits, shared props, flash toasts and typed Wayfinder routes."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/react/inertia.html
  - - meta
    - name: twitter:title
      content: "Inertia v3 with React"
  - - meta
    - name: twitter:description
      content: "Inertia v3 patterns in the React kit: how pages receive data, the Form component, useForm, visits, shared props, flash toasts and typed Wayfinder routes."
---

# Inertia <Badge type="tip" text="React" />

The kit uses Inertia v3 (`@inertiajs/react` ^3, `inertiajs/inertia-laravel` ^3). There is no Axios and no API: every request is an Inertia visit, a `<Form>` submit or a `useHttp` call.

## How pages receive data

```text
Controller → Inertia::render('users/index', props)
  → page component props      (page-specific data)
  → usePage().props           (shared props, every page)
  → Page.layout / setLayoutProps  (breadcrumbs, titles for the layout)
```

- **Page props** arrive as the component's props, destructured in the signature. Type them with a local `Props` type or a type from `@/types` (for example `UserIndexProps` in `types/Users/users.ts`).
- **Shared props** (user, permissions, menus, locale, layout settings) come from `usePage().props`. See [Shared props](#shared-props).
- **Layout props** are static on `Page.layout` or dynamic via `setLayoutProps()`. See [Layouts](/docs/react/layouts#per-page-layout-override).

```tsx
import type { UserIndexProps } from '@/types';

export default function UsersIndex({ users, stats, filters }: UserIndexProps) { … }
```

## Forms

Most forms use the Inertia `<Form>` component:

1. Spread a Wayfinder `.form()` object into it. That sets `action` and `method`.
2. Give each input a `name`. No state or `onChange` needed.
3. Read `errors`, `processing`, `isDirty` and `reset` from the render-prop child.

```tsx
<Form {...store.form()} resetOnSuccess={['password']} className="flex flex-col gap-6">
    {({ errors, processing }) => (
        <>
            <CommonInput name="email" type="email" error={errors.email} />
            <CommonPassword name="password" error={errors.password} />
            <CommonButton type="submit" loading={processing}>{__('modules.auth.login.submit')}</CommonButton>
        </>
    )}
</Form>
```

The kit uses a few more `<Form>` props for common cases:

| Prop | Use | Example |
| --- | --- | --- |
| `resetOnSuccess` | Clear fields (all, or listed ones) after success | Login clears `password` |
| `setDefaultsOnSuccess` | Treat saved values as the new baseline so `isDirty` resets | Profile form with `CommonButtonRow` |
| `transform` | Change data before sending | Profile maps the "Default" language to `null` with `transformLocale` |
| `options` with `preserveScroll: true` | Keep scroll position | User and role modals |
| `key` | Re-mount the form when switching create/edit | `user-form-modal.tsx` |

::: details View edit form (profile page)
```tsx
<Form
    {...ProfileController.update.form()}
    transform={transformLocale}
    setDefaultsOnSuccess
    className="space-y-6"
>
    {({ errors, processing, isDirty, reset }) => (
        <>
            <CommonInput name="name" defaultValue={user.name} error={errors.name} />
            <CommonSelect
                name="locale"
                value={localeValue}
                onValueChange={setLocaleValue}
                options={languageOptions}
                error={errors.locale}
            />
            <CommonButtonRow
                isDirty={isDirty}
                processing={processing}
                onDiscard={() => {
                    reset();
                    setLocaleValue(toLocaleValue(userLocale));
                }}
            />
        </>
    )}
</Form>
```

`transformLocale` and `toLocaleValue` come from `hooks/use-language.ts`.
:::

::: details View create/edit in one modal (user-form-modal.tsx)
The modal switches between `store.form()` and `update.form(id)` and re-mounts the form with `key`. It exposes `open()` / `close()` to the page through `useImperativeHandle` (`UserFormModalHandle`).

```tsx
const formAction = selectedUser ? update.form(selectedUser.id) : store.form();

<Form
    key={formKey}
    {...formAction}
    options={{ preserveScroll: true }}
    resetOnSuccess
    onSuccess={handleSuccess}
    noValidate
    className="space-y-4"
>
    {({ errors, processing }) => (
        <CommonInput name="name" defaultValue={selectedUser?.name ?? ''} error={errors.name} />
    )}
</Form>
```
:::

### `useForm` for custom inputs

When a form is not built from native inputs, use `useForm` instead. The card pickers on **Settings → Layout** and **Setup → Layout** do this: they call `setData()` on click and submit with `patch(update.url(), { onSuccess: () => setDefaults() })`.

::: details View useForm example (settings/layout.tsx)
```tsx
import { useForm } from '@inertiajs/react';
import { update } from '@/routes/layout';

const { data, setData, patch, processing, isDirty, reset, setDefaults } = useForm({
    app_layout: layoutSettings?.app_layout || 'sidebar',
    sidebar_variant: layoutSettings?.sidebar_variant || 'inset',
    sidebar_collapsible: layoutSettings?.sidebar_collapsible || 'icon',
});

const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    patch(update.url(), {
        preserveScroll: true,
        onSuccess: () => setDefaults(),
    });
};
```
:::

## Visits, links and requests

Use `<Form>` for forms and the calls below for everything else. All of them take Wayfinder routes (see [Wayfinder routes](#wayfinder-routes)).

| Need | Use | Example in the kit |
| --- | --- | --- |
| Navigation link | `<Link href={edit()} prefetch>` or `<TextLink href={register()}>` | `user-menu-content.tsx`, `auth/login.tsx` |
| Search, delete, one-off action | `router.get/post/patch/put/delete(route.url(), data, options)` | Users search, delete buttons |
| Reload current props | `router.reload()` | `manage-passkeys.tsx` |
| Clear the prefetch cache | `router.flushAll()` | Logout in `user-menu-content.tsx` |
| JSON without a page visit | `useHttp().submit(route())` | QR code and recovery codes in `use-two-factor-auth.ts` |

The users page debounces its search with `useDebounceFn` from `hooks/use-debounce.ts`:

```tsx
const debouncedSearch = useDebounceFn((value: string) => {
    router.get(
        index.url(),
        { search: value.trim() ? value.trim() : undefined },
        { preserveScroll: true, replace: true },
    );
}, 300);
```

## Shared props

`HandleInertiaRequests` shares the same props on every page (full list in [Architecture → Shared props](/docs/react/architecture#shared-props)).

```tsx
const { auth, locale } = usePage().props;
```

`types/global.d.ts` registers `SharedData` with Inertia (`InertiaConfig.sharedPageProps`), so `usePage().props` is typed without a generic. It also declares a global `PageProps<T>` (`T & SharedData`), used in layout callbacks such as `ErrorPage.layout = (props: PageProps) => …`.

Prefer the hooks over reading shared props by hand: `usePermission()` for `auth.permissions`, `useLanguage()` for languages and locale.

## Flash toasts

A controller flashes a toast, and it shows up on the next page with no frontend code.

```text
Inertia::flash('toast', [...]) → router 'flash' event → useFlashToast() → sonner toast
```

```php
Inertia::flash('toast', ['type' => 'success', 'message' => __('modules/tenant.toasts.created')]);
```

- `type` is `success`, `info`, `warning` or `error`.
- `useFlashToast()` (`hooks/use-flash-toast.ts`) is called by the `Toaster` in `components/ui/sonner.tsx`, which `app.tsx` mounts once for every page.
- For a toast from the client, `import { toast } from 'sonner'`.

::: details View useFlashToast
```tsx
export function useFlashToast(): void {
    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data) {
                return;
            }

            toast[data.type](data.message);
        });
    }, []);
}
```
:::

## Wayfinder routes

Wayfinder generates typed functions for named routes (`@/routes/<name>`) and controller actions (`@/actions/Modules/<Module>/Http/Controllers/<Controller>`). Use them instead of hard-coded URLs.

| Call | Returns | Use with |
| --- | --- | --- |
| `index()` | `{ url, method }` | `<Link href>`, `useHttp().submit()` |
| `index.url()` | `string` | `router.get()`, `useForm().patch()` |
| `destroy.url(id)` | `string` with the parameter | `router.delete()` |
| `store.form()` | `{ action, method }` (method spoofing via `_method`) | `<Form {...store.form()}>` |

```ts
dashboard();                      // { url: '/dashboard', method: 'get' }
destroy.url(user.id);             // '/users/5'
ProfileController.update.form();  // { action: '/settings/profile?_method=PATCH', method: 'post' }
```

::: tip
New route and the import is missing? Keep `npm run dev` running (the Vite plugin regenerates on PHP changes) or run `php artisan wayfinder:generate --with-form`.
:::
