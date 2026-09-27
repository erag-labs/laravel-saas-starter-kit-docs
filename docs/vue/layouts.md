---
title: "Vue Kit Layouts"
description: "How the Vue kit picks app and sign-in layouts from Setup defaults and user settings, the sidebar and header layouts, and per-page layout overrides."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/vue/layouts.html
  - - meta
    - property: og:title
      content: "Vue Kit Layouts"
  - - meta
    - property: og:description
      content: "How the Vue kit picks app and sign-in layouts from Setup defaults and user settings, the sidebar and header layouts, and per-page layout overrides."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/vue/layouts.html
  - - meta
    - name: twitter:title
      content: "Vue Kit Layouts"
  - - meta
    - name: twitter:description
      content: "How the Vue kit picks app and sign-in layouts from Setup defaults and user settings, the sidebar and header layouts, and per-page layout overrides."
---

# Layouts <Badge type="tip" text="Vue" />

Layouts live in `resources/js/layouts`. Two wrapper layouts, `AppLayout.vue` and `AuthLayout.vue`, pick the actual design at runtime from the shared `layout` prop.

## Layout selection flow

```text
1. app.ts picks the wrapper by page name
     auth/*      → AuthLayout
     settings/*  → AppLayout + settings/Layout.vue
     anything else → AppLayout
2. The page can override it with defineOptions({ layout })
3. The wrapper reads page.props.layout (LayoutSettings)
     AppLayout  → app_layout  → sidebar | header
     AuthLayout → auth_layout → card | simple | split
```

Where the `layout` values come from (`LayoutService::getLayoutSettings()`):

| Setting | Source |
| --- | --- |
| Global default | **Setup → Layout** (row with no user) |
| `app_layout`, `sidebar_variant`, `sidebar_collapsible` | The user's own **Settings → Layout** if saved, otherwise the global default |
| `auth_layout` | Always the global default |

More on the backend side: [Navigation & layouts](/docs/core/navigation-and-layouts).

## App layouts

`AppLayout.vue` takes one prop, `breadcrumbs?: BreadcrumbItem[]`, and renders one of two shells:

| `app_layout` | Component | Structure |
| --- | --- | --- |
| `sidebar` (default) | `layouts/app/AppSidebarLayout.vue` | `AppSidebar` + `AppSidebarHeader` (breadcrumbs) + content |
| `header` | `layouts/app/AppHeaderLayout.vue` | `AppHeader` top navigation (menus + breadcrumbs) + content |

Both shells also mount the `Toaster` (vue-sonner) and the global `ConfirmDialog`.

The sidebar shell reads two more settings:

| Setting | Values | Default |
| --- | --- | --- |
| `sidebar_variant` | `inset`, `sidebar`, `floating` | `inset` |
| `sidebar_collapsible` | `icon`, `offcanvas`, `none` | `icon` |

The sidebar shows `menus`, or `setupMenus` while the URL is under `/setup`.

**Settings layout.** `settings/*` pages get `[AppLayout, SettingsLayout]`, so `layouts/settings/Layout.vue` renders the Profile / Security / Appearance / Layout sub-navigation inside the app shell. The active item comes from `useCurrentUrl().isCurrentOrParentUrl`.

::: tip
Adding an app-wide wrapper (for example a banner)? Put it in both `AppSidebarLayout.vue` and `AppHeaderLayout.vue` so it survives a switch between sidebar and header mode.
:::

## Auth layouts

`AuthLayout.vue` takes `title` and `description` as translation keys (it translates them) and renders one of three designs:

| `auth_layout` | Component | Look |
| --- | --- | --- |
| `card` (default) | `layouts/auth/AuthCardLayout.vue` | Logo above a centred card on a muted background |
| `simple` | `layouts/auth/AuthSimpleLayout.vue` | Logo, title and form on a plain background |
| `split` | `layouts/auth/AuthSplitLayout.vue` | Dark left panel with logo and app `name`, form on the right |

## Per-page layout override

A page passes props to its default layout, or replaces it, with `defineOptions`:

```vue
<script setup lang="ts">
defineOptions({
    layout: {
        breadcrumbs: [
            { title: 'modules.common.nav.dashboard', href: dashboard() },
            { title: 'modules.user.breadcrumbs.users', href: index() },
        ],
    },
});
</script>
```

| Goal | `layout` value | Used by |
| --- | --- | --- |
| Breadcrumbs on an app page | `{ breadcrumbs: [...] }` (titles are translation keys) | Most app pages |
| Title and description on an auth page | `{ title: 'modules.auth.login.title', description: '...' }` | Auth pages |
| No layout (full screen) | `[]` | `Home.vue`, `auth/Maintenance.vue`, `auth/Suspended.vue` |
| Layout chosen from props | `(props: PageProps) => (props.auth.user ? AppLayout : AuthLayout)` | `errors/Error.vue` |

### Changing layout props at runtime

`defineOptions` is static. When a value depends on state, call `setLayoutProps()`:

- `TwoFactorChallenge.vue` swaps the title when the user switches to a recovery code.
- `AcceptInvitation.vue` calls it once when `mode === 'user'` to show the user-invitation wording.

::: details View setLayoutProps example
```ts
import { setLayoutProps } from '@inertiajs/vue3';
import { watchEffect } from 'vue';

watchEffect(() => {
    setLayoutProps({
        title: authConfigContent.value.title,
        description: authConfigContent.value.description,
    });
});
```
:::

::: details View layout chosen per request (errors/Error.vue)
```vue
<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';

defineOptions({
    layout: (props: PageProps) => (props.auth.user ? AppLayout : AuthLayout),
});
</script>
```
:::
