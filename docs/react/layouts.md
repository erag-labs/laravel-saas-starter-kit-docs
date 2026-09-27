---
title: "React Kit Layouts"
description: "How the React kit picks app and sign-in layouts from Setup defaults and user settings, the sidebar and header layouts, and per-page layout overrides."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/react/layouts.html
  - - meta
    - property: og:title
      content: "React Kit Layouts"
  - - meta
    - property: og:description
      content: "How the React kit picks app and sign-in layouts from Setup defaults and user settings, the sidebar and header layouts, and per-page layout overrides."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/react/layouts.html
  - - meta
    - name: twitter:title
      content: "React Kit Layouts"
  - - meta
    - name: twitter:description
      content: "How the React kit picks app and sign-in layouts from Setup defaults and user settings, the sidebar and header layouts, and per-page layout overrides."
---

# Layouts <Badge type="tip" text="React" />

Layouts live in `resources/js/layouts`. Two wrapper components, `AppLayout` and `AuthLayout`, pick the actual design at runtime, so pages never import a specific variant.

## Layout selection flow

```text
Setup → Layout (global default)
  → Settings → Layout (user override, not the auth layout)
  → LayoutService → shared `layout` prop
  → app.tsx picks AppLayout / AuthLayout by page name
  → AppLayout / AuthLayout render the chosen variant
```

1. An admin sets the global defaults (app layout, sidebar variant, collapsible mode, auth layout) on **Setup → Layout**.
2. A user can override the app layout, sidebar variant and collapsible mode on **Settings → Layout**. The auth layout always comes from the global default.
3. The backend shares the result as the `layout` prop (`LayoutSettings`).
4. `app.tsx` assigns `AuthLayout` to `auth/*` pages, `[AppLayout, SettingsLayout]` to `settings/*` pages and `AppLayout` to everything else (see [Architecture → Overview](/docs/react/architecture#overview)).

Backend details are in [Navigation & layouts](/docs/core/navigation-and-layouts).

## App layouts

`app-layout.tsx` takes `breadcrumbs?: BreadcrumbItem[]` and renders one of two shells based on `layout.app_layout`:

| `app_layout` | Component | Structure |
| --- | --- | --- |
| `sidebar` (default) | `app/app-sidebar-layout.tsx` | `AppSidebar` + `AppSidebarHeader` (breadcrumbs) + content |
| `header` | `app/app-header-layout.tsx` | `AppHeader` top navigation (menus + breadcrumbs) + content |

Both shells mount the global `ConfirmDialog`. The sonner `Toaster` and `TooltipProvider` are added once for every page in `app.tsx` (`withApp`).

The sidebar shell also reads two settings:

| Setting | Values | Default |
| --- | --- | --- |
| `sidebar_variant` | `inset`, `sidebar`, `floating` | `inset` |
| `sidebar_collapsible` | `icon`, `offcanvas`, `none` | `icon` |

The sidebar shows `menus` normally and `setupMenus` while the URL starts with `/setup`.

**Settings layout.** `settings/layout.tsx` renders the Profile / Security / Appearance / Layout sub-navigation inside the app shell. The active item is detected with `useCurrentUrl().isCurrentOrParentUrl`.

::: tip
To add another app-wide wrapper (for example a banner), put it in both `app-sidebar-layout.tsx` and `app-header-layout.tsx`, or in `withApp` in `app.tsx` if it should also appear on auth pages.
:::

## Auth layouts

`auth-layout.tsx` takes `title` and `description` as translation keys (the layout translates them) and renders one of three designs based on `layout.auth_layout`:

| `auth_layout` | Component | Look |
| --- | --- | --- |
| `card` (default) | `auth/auth-card-layout.tsx` | Logo above a centred card on a muted background |
| `simple` | `auth/auth-simple-layout.tsx` | Logo, title and form on a plain background |
| `split` | `auth/auth-split-layout.tsx` | Dark left panel with logo and app `name`, form on the right |

## Per-page layout override

A page controls its layout through a static `layout` property:

| Goal | Set `Page.layout` to | Used by |
| --- | --- | --- |
| Pass props to the default layout | An object: `{ breadcrumbs }` or `{ title, description }` | Most pages |
| Change layout props at runtime | Call `setLayoutProps({...})` in an effect | `two-factor-challenge.tsx`, `accept-invitation.tsx` |
| No layout (full screen) | `[] as never[]` | `home.tsx`, `auth/maintenance.tsx`, `auth/suspended.tsx` |
| Pick a layout from props | A function returning a layout | `errors/error.tsx` |

Breadcrumbs on an app page (titles are translation keys, translated by `breadcrumbs.tsx`):

```tsx
UsersIndex.layout = {
    breadcrumbs: [
        { title: 'modules.common.nav.dashboard', href: dashboard() },
        { title: 'modules.user.breadcrumbs.users', href: index() },
    ],
};
```

::: details View other override examples
Title and description on an auth page:

```tsx
Login.layout = {
    title: 'modules.auth.login.title',
    description: 'modules.auth.login.description',
};
```

Dynamic title with `setLayoutProps`. `two-factor-challenge.tsx` swaps the title when the user switches to a recovery code. `accept-invitation.tsx` does the same when `mode === 'user'` to show the user-invitation wording.

```tsx
import { setLayoutProps } from '@inertiajs/react';

useEffect(() => {
    setLayoutProps({
        title: authConfigContent.title,
        description: authConfigContent.description,
    });
}, [authConfigContent.title, authConfigContent.description]);
```

No layout:

```tsx
Home.layout = [] as never[];
```

Layout chosen per request. The error page uses the app shell for signed-in users and the auth layout for guests:

```tsx
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';

ErrorPage.layout = (props: PageProps) =>
    props.auth.user ? AppLayout : AuthLayout;
```
:::

::: details View layouts folder
```text
layouts/
├── app-layout.tsx         # chooses app/app-sidebar-layout.tsx or app/app-header-layout.tsx
├── auth-layout.tsx        # chooses auth/auth-card-layout.tsx, auth-simple-layout.tsx or auth-split-layout.tsx
├── app/
│   ├── app-sidebar-layout.tsx
│   └── app-header-layout.tsx
├── auth/
│   ├── auth-card-layout.tsx
│   ├── auth-simple-layout.tsx
│   └── auth-split-layout.tsx
└── settings/layout.tsx    # Profile / Security / Appearance / Layout sub-navigation
```
:::
