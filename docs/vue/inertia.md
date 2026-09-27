---
title: "Inertia v3 with Vue"
description: "Inertia v3 patterns in the Vue kit: how pages receive data, the Form component, useForm, visits, shared props, flash toasts and typed Wayfinder routes."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/vue/inertia.html
  - - meta
    - property: og:title
      content: "Inertia v3 with Vue"
  - - meta
    - property: og:description
      content: "Inertia v3 patterns in the Vue kit: how pages receive data, the Form component, useForm, visits, shared props, flash toasts and typed Wayfinder routes."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/vue/inertia.html
  - - meta
    - name: twitter:title
      content: "Inertia v3 with Vue"
  - - meta
    - name: twitter:description
      content: "Inertia v3 patterns in the Vue kit: how pages receive data, the Form component, useForm, visits, shared props, flash toasts and typed Wayfinder routes."
---

# Inertia <Badge type="tip" text="Vue" />

The kit uses Inertia v3 (`@inertiajs/vue3` ^3, `inertiajs/inertia-laravel` ^3). There is no Axios and no API: every request is an Inertia visit, a `<Form>` submit or a `useHttp` call.

## How pages receive data

```text
Controller → Inertia::render('users/Index', props)
  → props + shared props (HandleInertiaRequests)
  → pages/users/Index.vue via defineProps
```

- **Page props** come from the controller. Declare them with `defineProps<{ ... }>()`.
- **Shared props** (user, permissions, menus, layout settings, locale) are added to every page. See [Shared props](#shared-props).
- **Layout props** (breadcrumbs, auth page title) are set by the page with `defineOptions({ layout })` or `setLayoutProps()`. See [Layouts](/docs/vue/layouts#per-page-layout-override).

## Forms

Most forms use the `<Form>` component:

1. Spread a Wayfinder `.form()` object into it.
2. Give inputs a `name`. No `v-model` needed.
3. Read `errors`, `processing` and friends from the default slot.

```vue
<Form v-bind="store.form()" :reset-on-success="['password']" v-slot="{ errors, processing }">
    <CommonInput name="email" type="email" :error="errors.email" />
    <CommonPassword name="password" :error="errors.password" />
    <CommonButton type="submit" :loading="processing">
        {{ __('modules.auth.login.submit') }}
    </CommonButton>
</Form>
```

`<Form>` props used in the kit:

| Prop / event | Used for | Example |
| --- | --- | --- |
| `reset-on-success` | Clear fields (or listed fields) after success | Login, Security |
| `reset-on-error` | Clear fields after a failed submit | Two-factor challenge, Accept invitation |
| `set-defaults-on-success` | Make saved values the new defaults, so `isDirty` resets | Profile |
| `:transform` | Change data before sending | Profile (`transformLocale` from `useLanguage()`) |
| `:action` + `:key` | Switch between `store()` and `update(id)` in one modal and re-mount the form | `UserFormModal.vue` |
| `:options="{ preserveScroll: true }"` | Visit options | `UserFormModal.vue` |
| `@success`, `@error` | Callbacks | Close a modal, clear the 2FA code |

::: details View edit form (Profile)
```vue
<Form
    v-bind="ProfileController.update.form()"
    :transform="transformLocale"
    set-defaults-on-success
    v-slot="{ errors, processing, isDirty, reset }"
>
    <CommonInput name="name" :default-value="user.name" :error="errors.name" />
    <CommonSelect name="locale" :model-value="toLocaleValue(userLocale)" :options="languageOptions" />
    <CommonButtonRow :is-dirty="isDirty" :processing="processing" @discard="reset()" />
</Form>
```
:::

::: details View create/edit modal (UserFormModal)
```vue
<Form
    :key="formKey"
    :action="selectedUser ? update(selectedUser.id) : store()"
    :options="{ preserveScroll: true }"
    reset-on-success
    @success="handleSuccess"
    novalidate
    v-slot="{ errors, processing }"
>
    <CommonInput name="name" :default-value="selectedUser?.name ?? ''" :error="errors.name" />
    <CommonButton type="submit" :loading="processing">{{ submitLabel }}</CommonButton>
</Form>
```
:::

### `useForm`

Use `useForm` when the form is not built from native inputs, like the card pickers on **Settings → Layout** and **Setup → Layout**.

```ts
const form = useForm({ app_layout: props.layoutSettings?.app_layout || 'sidebar' });

form.patch('/settings/layout', {
    preserveScroll: true,
    onSuccess: () => form.defaults(),
});
```

## Visits, links and requests

| Need | Use | Example in the kit |
| --- | --- | --- |
| Navigate with a link | `Link` (or `TextLink`) with a Wayfinder object as `href` | `<Link :href="edit()" prefetch>` |
| Search, filter, delete, one-off action | `router.get/post/patch/put/delete` with `.url()` | User search, user delete |
| Refresh or clear data | `router.reload()`, `router.visit()`, `router.flushAll()` | `flushAll()` on logout in `UserMenuContent.vue` |
| JSON without a page visit | `useHttp().submit(route())` | QR code and recovery codes in `useTwoFactorAuth.ts` |

```ts
router.get(index.url(), { search: value.trim() || undefined }, { preserveScroll: true, replace: true });

router.delete(destroy.url(user.id), { preserveScroll: true });
```

::: details View useHttp example
```ts
import { useHttp } from '@inertiajs/vue3';
import { qrCode } from '@/routes/two-factor';

const http = useHttp();
const { svg } = (await http.submit(qrCode())) as { svg: string; url: string };
```
:::

## Shared props

`types/global.d.ts` registers `SharedData` with Inertia, so `usePage().props` is typed everywhere. It also declares a global `PageProps<T>` (`T & SharedData`) for `usePage<PageProps>()` and layout callbacks.

The full list of shared props is in [Architecture → Shared props](/docs/vue/architecture#shared-props).

::: details View the type registration
```ts
declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: SharedData;
    }
}
```
:::

## Flash toasts

```text
Inertia::flash('toast', [...]) → router 'flash' event
  → lib/flashToast.ts → vue-sonner toast[type](message)
```

Controllers flash a toast before redirecting:

```php
Inertia::flash('toast', ['type' => 'success', 'message' => __('modules/tenant.toasts.created')]);
```

- `type` is `success`, `info`, `warning` or `error` (`FlashToast` in `types/ui.ts`).
- `initializeFlashToast()` is started in `app.ts`.
- To show a toast from the client: `import { toast } from 'vue-sonner'`.

::: warning
The `Toaster` is mounted only in the app layouts, so toasts do not show on auth pages.
:::

::: details View lib/flashToast.ts
```ts
export function initializeFlashToast(): void {
    router.on('flash', (event) => {
        const flash = (event as CustomEvent).detail?.flash;
        const data = flash?.toast as FlashToast | undefined;

        if (!data) {
            return;
        }

        toast[data.type](data.message);
    });
}
```
:::

## Wayfinder routes

Wayfinder generates typed functions for named routes and controller methods. The Vite plugin runs with `formVariants: true`, so every function also has `.form()`.

| Call | Returns | Use with |
| --- | --- | --- |
| `index()` | `{ url, method }` | `Link :href`, `<Form :action>`, `useHttp().submit()` |
| `index.url()` | `string` | `router.get()`, `useForm().patch()` |
| `destroy.url(id)` | `string` with the parameter | `router.delete()` |
| `store.form()` | `{ action, method }` (method spoofing via `_method`) | `<Form v-bind>` |

| Import path | Contains |
| --- | --- |
| `@/routes/<name>` | Named routes, e.g. `@/routes/users` → `index`, `store`, `update`, `destroy` |
| `@/actions/Modules/<Module>/Http/Controllers/<Controller>` | Controller methods, e.g. `ProfileController.update.form()` |

::: tip
New route and the import is missing? Keep `npm run dev` running (the Vite plugin regenerates on PHP changes) or run `php artisan wayfinder:generate --with-form`.
:::
