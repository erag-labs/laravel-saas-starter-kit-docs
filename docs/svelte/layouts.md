---
title: "Svelte Kit Layouts"
description: "How the Svelte kit picks app and sign-in layouts from Setup defaults and user settings, the sidebar and header layouts, and per-page layout overrides."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/svelte/layouts.html
  - - meta
    - property: og:title
      content: "Svelte Kit Layouts"
  - - meta
    - property: og:description
      content: "How the Svelte kit picks app and sign-in layouts from Setup defaults and user settings, the sidebar and header layouts, and per-page layout overrides."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/svelte/layouts.html
  - - meta
    - name: twitter:title
      content: "Svelte Kit Layouts"
  - - meta
    - name: twitter:description
      content: "How the Svelte kit picks app and sign-in layouts from Setup defaults and user settings, the sidebar and header layouts, and per-page layout overrides."
---

# Layouts <Badge type="tip" text="Svelte" />

Layouts live in `resources/js/layouts`. `app.ts` assigns a default layout by page name (see [Architecture](/docs/svelte/architecture#overview)); a page can pass props to it or replace it.

## Layout selection flow

Which shell a user sees is decided on the server and read on the client from the shared `layout` prop (`LayoutSettings`):

```text
Setup → Layout (global default, incl. auth layout)
  → Settings → Layout (user's own app layout, sidebar variant, collapsible mode)
  → LayoutService::getLayoutSettings() → shared `layout` prop
  → AppLayout.svelte / AuthLayout.svelte pick the matching component
```

- A user's saved setting wins over the global default.
- `auth_layout` always comes from the global default, because auth pages are shown before login.

Background on menus and layout settings: [Navigation & layouts](/docs/core/navigation-and-layouts).

## App layouts

`AppLayout.svelte` takes `breadcrumbs?: BreadcrumbItem[]` and a `children` snippet, and renders one of two shells based on `page.props.layout.app_layout`:

| `app_layout` | Component | Structure |
| --- | --- | --- |
| `sidebar` (default) | `app/AppSidebarLayout.svelte` | `AppSidebar` + `AppSidebarHeader` (breadcrumbs) + content |
| `header` | `app/AppHeaderLayout.svelte` | `AppHeader` top navigation (menus + breadcrumbs) + content |

Both shells also mount the `Toaster` (svelte-sonner) and the global `ConfirmDialog`.

In the sidebar shell, `AppSidebar` reads two more settings:

| Setting | Values | Default |
| --- | --- | --- |
| `sidebar_variant` | `inset`, `sidebar`, `floating` | `inset` |
| `sidebar_collapsible` | `icon`, `offcanvas`, `none` | `icon` |

The sidebar shows `menus` normally and `setupMenus` while the URL starts with `/setup`.

**Settings layout.** `settings/*` pages get `[AppLayout, SettingsLayout]`, so `layouts/settings/Layout.svelte` renders the Profile / Security / Appearance / Layout sub-navigation inside the app shell. The active item is detected with `isCurrentOrParentUrl` from `lib/currentUrl.svelte.ts`.

::: tip
To add another app-wide wrapper (for example a banner), put it in both `AppSidebarLayout.svelte` and `AppHeaderLayout.svelte` so it survives a switch between sidebar and header mode.
:::

## Auth layouts

`AuthLayout.svelte` takes `title` and `description` (translation keys; the layout translates them) and renders one of three designs from `page.props.layout.auth_layout`:

| `auth_layout` | Component | Look |
| --- | --- | --- |
| `card` (default) | `auth/AuthCardLayout.svelte` | Logo above a centred card on a muted background |
| `simple` | `auth/AuthSimpleLayout.svelte` | Logo, title and form on a plain background |
| `split` | `auth/AuthSplitLayout.svelte` | Dark left panel with logo and app `name`, form on the right |

## Per-page layout override

A page exports `layout` from its `<script module>` block. Imports the layout object needs (such as Wayfinder routes) go in the same block.

```svelte
<script module lang="ts">
    import { dashboard } from '@/routes';
    import { index } from '@/routes/users';

    export const layout = {
        breadcrumbs: [
            { title: 'modules.common.nav.dashboard', href: dashboard() },
            { title: 'modules.user.breadcrumbs.users', href: index() },
        ],
    };
</script>
```

What `layout` can be:

| Value | Effect | Used by |
| --- | --- | --- |
| Object (`{ breadcrumbs }`, `{ title, description }`) | Props for the default layout. Breadcrumb and auth titles are translation keys. | Most pages |
| `[]` | No layout (full-screen page) | `Home.svelte`, `auth/Maintenance.svelte`, `auth/Suspended.svelte` |
| Function of the page props | Choose a layout per request | `errors/Error.svelte`: `AppLayout` for signed-in users, `AuthLayout` for guests |

For values that depend on state, call `setLayoutProps()` from the page. `TwoFactorChallenge.svelte` swaps the title when the user switches to a recovery code; `AcceptInvitation.svelte` uses it when `mode === 'user'` to show the user-invitation wording.

::: details View more examples
Title and description on an auth page:

```svelte
<script module lang="ts">
    export const layout = {
        title: 'modules.auth.login.title',
        description: 'modules.auth.login.description',
    };
</script>
```

No layout:

```svelte
<script module lang="ts">
    export const layout = [];
</script>
```

Layout chosen per request (error page):

```svelte
<script module lang="ts">
    import AppLayout from '@/layouts/AppLayout.svelte';
    import AuthLayout from '@/layouts/AuthLayout.svelte';

    export const layout = (props: PageProps) =>
        props.auth.user ? AppLayout : AuthLayout;
</script>
```

Changing layout props at runtime:

```ts
import { setLayoutProps } from '@inertiajs/svelte';

$effect(() => {
    setLayoutProps({
        title: authConfigContent.title,
        description: authConfigContent.description,
    });
});
```
:::
