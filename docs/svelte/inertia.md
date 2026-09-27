---
title: "Inertia v3 with Svelte"
description: "Inertia v3 patterns in the Svelte kit: how pages receive data, the Form component, useForm, visits, shared props, flash toasts and typed Wayfinder routes."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/svelte/inertia.html
  - - meta
    - property: og:title
      content: "Inertia v3 with Svelte"
  - - meta
    - property: og:description
      content: "Inertia v3 patterns in the Svelte kit: how pages receive data, the Form component, useForm, visits, shared props, flash toasts and typed Wayfinder routes."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/svelte/inertia.html
  - - meta
    - name: twitter:title
      content: "Inertia v3 with Svelte"
  - - meta
    - name: twitter:description
      content: "Inertia v3 patterns in the Svelte kit: how pages receive data, the Form component, useForm, visits, shared props, flash toasts and typed Wayfinder routes."
---

# Inertia <Badge type="tip" text="Svelte" />

The kit uses Inertia v3 (`@inertiajs/svelte` ^3, `inertiajs/inertia-laravel` ^3). There is no Axios and no REST API: every request is an Inertia visit, a `<Form>` submit or a `useHttp` call.

## How pages receive data

```text
Controller → Inertia::render('users/Index', [...page props])
           + HandleInertiaRequests shared props (auth, menus, layout, …)
           → pages/users/Index.svelte
               page props   → $props()
               shared props → page.props (from @inertiajs/svelte)
```

- **Page props** are what the controller passes. Type them in the `$props()` destructure, often with a type from `@/types`.
- **Shared props** are on every page. See [Shared props](#shared-props).
- **Flash data** (toasts) arrives with the response and is handled once in `app.ts`. See [Flash toasts](#flash-toasts).

### Page title and layout props

- **Title.** The kit doesn't use Inertia's `Head`. Pages render `<AppHead title={__('modules.user.index.title')} />`, which writes `<title>` through `<svelte:head>`.
- **Layout props.** Static values go in `export const layout = { … }` inside `<script module>`; values that depend on state go through `setLayoutProps()`. See [Layouts → Per-page layout override](/docs/svelte/layouts#per-page-layout-override).

## Forms

Most forms use Inertia's `<Form>` component:

- Spread a Wayfinder `.form()` object into it, so the URL and method come from the Laravel route.
- Read `errors`, `processing`, `isDirty` and `reset` from the `children` snippet.
- Inputs only need a `name`; the `Common*` components show `error` for you.

```svelte
<Form {...store.form()} resetOnSuccess={['password']} class="flex flex-col gap-6">
    {#snippet children({ errors, processing })}
        <CommonInput name="email" type="email" error={errors.email} />
        <CommonPassword name="password" error={errors.password} />
        <CommonButton type="submit" loading={processing}>{__('modules.auth.login.submit')}</CommonButton>
    {/snippet}
</Form>
```

Common variations used in the kit:

| Pattern | Where | How |
| --- | --- | --- |
| Edit form with Save / Discard bar | `settings/Profile.svelte` | `setDefaultsOnSuccess` keeps `isDirty` accurate after saving; `transform={language.transformLocale}` maps the "Default" language to `null` |
| Create and edit in one modal | `users/Partials/UserFormModal.svelte`, `roles/Partials/RoleFormModal.svelte` | `action` switches between `store()` and `update(id)`; `{#key}` re-mounts the form |
| Non-input fields (card pickers) | `settings/Layout.svelte`, `setup/Layout.svelte` | `useForm` instead of `<Form>` |

::: details View edit form example (profile)
```svelte
<Form
    {...ProfileController.update.form()}
    transform={language.transformLocale}
    setDefaultsOnSuccess
    class="space-y-6"
>
    {#snippet children({ errors, processing, isDirty, reset })}
        <CommonInput name="name" defaultValue={user.name} error={errors.name} />
        <CommonSelect
            name="locale"
            defaultValue={language.toLocaleValue(language.userLocale)}
            options={languageOptions}
            error={errors.locale}
        />
        <CommonButtonRow {isDirty} {processing} onDiscard={() => reset()} />
    {/snippet}
</Form>
```

`language` is `useLanguage()` from `lib/language.ts`.
:::

::: details View create/edit modal example
```svelte
<script lang="ts">
    const formKey = $derived(selectedUser?.id ?? 'create');
    const formAction = $derived(selectedUser ? update(selectedUser.id) : store());
</script>

{#key formKey}
    <Form
        action={formAction}
        options={{ preserveScroll: true }}
        resetOnSuccess
        onSuccess={handleSuccess}
        novalidate
        class="space-y-4"
    >
        {#snippet children({ errors, processing })}
            <CommonInput name="name" defaultValue={selectedUser?.name ?? ''} error={errors.name} />
        {/snippet}
    </Form>
{/key}
```
:::

::: details View useForm example (layout pickers)
The returned form is reactive; read and assign fields directly.

```svelte
<script lang="ts">
    import { useForm } from '@inertiajs/svelte';
    import { untrack } from 'svelte';

    const form = useForm(
        untrack(() => ({
            app_layout: layoutSettings?.app_layout || 'sidebar',
            sidebar_variant: layoutSettings?.sidebar_variant || 'inset',
            sidebar_collapsible: layoutSettings?.sidebar_collapsible || 'icon',
        })),
    );

    const submit = (event?: Event) => {
        event?.preventDefault();

        form.patch('/settings/layout', {
            preserveScroll: true,
            onSuccess: () => {
                form.defaults();
            },
        });
    };
</script>

<button type="button" onclick={() => (form.app_layout = 'sidebar')}>…</button>
```
:::

## Visits, links and requests

| Need | Use | Example in the kit |
| --- | --- | --- |
| Navigation link | `<Link href={edit()} prefetch>` or `TextLink` | `UserMenuContent.svelte`, auth pages |
| Search, delete, one-off action | `router.get/post/put/patch/delete` with `.url()` | Users search, deletes |
| Reload or redirect | `router.reload()`, `router.visit()` | `ManagePasskeys.svelte`, `tenants/Show.svelte` |
| Clear cached pages on logout | `router.flushAll()` | `UserMenuContent.svelte` |
| JSON without a page visit | `useHttp()` | `lib/twoFactorAuth.svelte.ts` (QR code, setup key, recovery codes) |

The users page debounces the search input with `useDebounce` and sends it in an `$effect`. The real page also skips the request when the value hasn't changed since the last search.

::: details View search and useHttp examples
```ts
import { router } from '@inertiajs/svelte';
import { untrack } from 'svelte';
import { useDebounce } from '@/lib/debounce.svelte';
import { destroy, index } from '@/routes/users';

let search = $state(untrack(() => props.filters.search));
const debouncedSearch = useDebounce(() => search, 300);

$effect(() => {
    const value = debouncedSearch.value;

    router.get(
        index.url(),
        { search: value.trim() ? value.trim() : undefined },
        { preserveScroll: true, replace: true },
    );
});

router.delete(destroy.url(user.id), { preserveScroll: true });
```

```ts
import { useHttp } from '@inertiajs/svelte';
import { qrCode } from '@/routes/two-factor';

const http = useHttp();
const { svg } = (await http.submit(qrCode())) as { svg: string; url: string };
```
:::

## Shared props

Shared props come from `HandleInertiaRequests` and are read from the reactive `page` object:

```svelte
<script lang="ts">
    import { page } from '@inertiajs/svelte';

    const user = $derived(page.props.auth.user);
</script>
```

`types/global.d.ts` augments Inertia (`InertiaConfig.sharedPageProps = SharedData`), so `page.props` is typed everywhere. It also declares a global `PageProps<T>` (`T & SharedData`), used in layout callbacks such as the error page's `export const layout = (props: PageProps) => …`.

The full list of shared props is in [Architecture → Shared props](/docs/svelte/architecture#shared-props).

## Flash toasts

A controller flashes a toast and redirects; the next page shows it.

```text
Inertia::flash('toast', ['type' => 'success', 'message' => …])
  → router 'flash' event
  → lib/flash-toast.ts (started in app.ts)
  → toast[type](message) from svelte-sonner
```

```php
Inertia::flash('toast', ['type' => 'success', 'message' => __('modules/tenant.toasts.created')]);
```

- `type` is `success`, `info`, `warning` or `error` (`FlashToast` in `types/ui.ts`).
- To show a toast from the client, `import { toast } from 'svelte-sonner'`.
- The `Toaster` is mounted only in the app layouts, so flash toasts do not show on auth pages.

::: details View lib/flash-toast.ts
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

Wayfinder generates typed functions for named routes (`@/routes/<name>`) and controller actions (`@/actions/Modules/<Module>/Http/Controllers/<Controller>`). The Vite plugin runs with `formVariants: true`, so every function also has `.form()`.

| Call | Returns | Use with |
| --- | --- | --- |
| `index()` | `{ url, method }` | `<Link href>`, `<Form action>`, `useHttp().submit()` |
| `index.url()` | `string` | `router.get()`, `form.patch()` |
| `destroy.url(id)` | `string` with the parameter | `router.delete()` |
| `store.form()` | `{ action, method }` (method spoofing via `_method`) | `<Form {...store.form()}>` |

```ts
import ProfileController from '@/actions/Modules/Settings/Http/Controllers/ProfileController';
import { destroy } from '@/routes/users';

destroy.url(user.id);             // '/users/5'
ProfileController.update.form();  // { action: '/settings/profile?_method=PATCH', method: 'post' }
```

::: tip
New route and the import is missing? Keep `npm run dev` running (the Vite plugin regenerates on PHP changes) or run `php artisan wayfinder:generate --with-form`.
:::
