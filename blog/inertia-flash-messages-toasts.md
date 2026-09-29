---
title: "Flash Messages and Toasts with Inertia"
description: "Show an Inertia flash message as a toast after a Laravel redirect: Inertia::flash(), the flash event, typed payloads and Vue, React and Svelte examples."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: frontend
tags: [Inertia, Frontend]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/inertia-flash-messages-toasts.html
  - - meta
    - property: og:title
      content: "Flash Messages and Toasts with Inertia"
  - - meta
    - property: og:description
      content: "Show an Inertia flash message as a toast after a Laravel redirect: Inertia::flash(), the flash event, typed payloads and Vue, React and Svelte examples."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/inertia-flash-messages-toasts.html
  - - meta
    - name: twitter:title
      content: "Flash Messages and Toasts with Inertia"
  - - meta
    - name: twitter:description
      content: "Show an Inertia flash message as a toast after a Laravel redirect: Inertia::flash(), the flash event, typed payloads and Vue, React and Svelte examples."
---

# Inertia Flash Messages: Laravel Toasts After Redirects, Done Properly

<BlogPostMeta />

"User created", "Settings saved", "Invitation sent": every SaaS needs short confirmations after an action. In a Blade app you flash a message to the session and print it in the layout. An **Inertia flash message** works a little differently, because the page is a Vue, React or Svelte component and the message should pop up as a toast, once. This guide covers the classic shared-props approach and its problems, Inertia's `Inertia::flash()`, the client-side `flash` event, typed payloads, and where to mount the toaster.

## Three kinds of feedback

Before writing any code, decide which kind of message you need. Each one has its own tool:

| Situation | Best tool |
| --- | --- |
| A field is invalid | Validation errors, shown next to the field (`errors.email`) |
| A form on the same page saved | An inline "Saved" label, e.g. the Form component's `recentlySuccessful` |
| An action finished and the user was redirected | A flash message shown as a toast |

This post is about the third row. Validation errors already reach your forms automatically, as explained in the [Inertia Form component guide](/blog/inertia-form-component.html).

## The old way: session flash as a shared prop

Before Inertia had flash data, the common pattern was to flash to the session and share it on every response:

```php
// app/Http/Middleware/HandleInertiaRequests.php
public function share(Request $request): array
{
    return [
        ...parent::share($request),
        'flash' => [
            'success' => fn () => $request->session()->get('success'),
        ],
    ];
}
```

The controller calls `return back()->with('success', 'Saved.')`, and a component watches `page.props.flash.success`. It works, but it has rough edges:

- **It lives in the page props.** Inertia stores props in browser history, so the message is saved with the page. Go back to that page and a watcher can show the toast again.
- **Same message twice.** Two identical messages in a row don't change the prop's value, so a watcher may not fire the second time.
- **Every response carries it.** The key is on every page, even when it is `null`.

## Sending an Inertia flash message with Inertia::flash()

The Laravel adapter has a dedicated API for one-time data. `Inertia::flash()` stores values in the session for the next Inertia response. That response sends them next to the props, not inside them:

```php
use Inertia\Inertia;

public function store(StoreProjectRequest $request, ProjectService $projects): RedirectResponse
{
    $projects->create($request->validated());

    Inertia::flash('toast', ['type' => 'success', 'message' => __('Project created.')]);

    return to_route('projects.index');
}
```

A few variations work too:

```php
Inertia::flash(['toast' => $toast, 'newProjectId' => $project->id]);

return Inertia::flash('toast', $toast)->back();

return Inertia::render('projects/Show', $props)->flash('highlight', $project->id);
```

The key can also be a PHP enum. A backed enum uses its value and a unit enum uses its name. The data survives the redirect and is removed from the session once it has been delivered.

## How flash data reaches the browser

On the client, flash data sits on the page object as `page.flash`, next to `page.props`. Two details make it a good fit for toasts:

1. **It is not saved in history state.** Pressing Back doesn't bring the message back.
2. **It fires an event.** Each time a response or the first page load brings flash data, the router fires `flash` (and the DOM event `inertia:flash`) with the data in `event.detail.flash`.

So the toast code does not belong in a page. You register one listener when the app starts.

## Showing toasts with the flash event

The examples use sonner, which has a port for each framework (`vue-sonner`, `sonner`, `svelte-sonner`). Any toast library works the same way.

::: code-group

```ts [Vue]
// resources/js/lib/flashToast.ts, called once from app.ts
import { router } from '@inertiajs/vue3';
import { toast } from 'vue-sonner';

export function initializeFlashToast(): void {
    router.on('flash', (event) => {
        const data = event.detail.flash.toast;

        if (data) {
            toast[data.type](data.message);
        }
    });
}
```

```tsx [React]
// A hook used by the component that renders <Toaster />
import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function useFlashToast(): void {
    useEffect(() => {
        return router.on('flash', (event) => {
            const data = event.detail.flash.toast;
            if (data) toast[data.type](data.message);
        });
    }, []);
}
```

```ts [Svelte]
// resources/js/lib/flash-toast.ts, called once from app.ts
import { router } from '@inertiajs/svelte';
import { toast } from 'svelte-sonner';

export function initializeFlashToast(): void {
    router.on('flash', (event) => {
        const data = event.detail.flash.toast;

        if (data) {
            toast[data.type](data.message);
        }
    });
}
```

:::

`router.on()` returns a function that removes the listener. The React version returns it from `useEffect`, so the listener is cleaned up when the component unmounts.

## Type the toast payload

By default `page.flash` is a loose record, so `data.type` is `unknown`. Tell Inertia the shape once with TypeScript declaration merging, and every listener and `usePage()` call is typed:

```ts
// resources/js/types/global.d.ts
declare module '@inertiajs/core' {
    export interface InertiaConfig {
        flashDataType: {
            toast?: {
                type: 'success' | 'info' | 'warning' | 'error';
                message: string;
            };
        };
    }
}
```

Keep the `type` values in line with the methods of your toast library. Then `toast[data.type]` always points at a real function.

## Reading flash data inside a page

Not all flash data is a toast. Say you want to highlight the row that was just created. Flash its ID and read it on the page from `usePage().flash` (Vue and React) or `page.flash` (Svelte):

```vue
<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { computed } from 'vue';

const page = usePage();
const highlightedId = computed(() => page.flash.newProjectId);
</script>
```

For one visit only, pass an `onFlash` callback to that visit: `router.post(url, data, { onFlash: (flash) => { ... } })`.

You can also set flash data from the client with `router.flash('toast', {...})`. It fires the same event, which is handy when a `useHttp` request finishes and there is no server redirect.

## Where to mount the toaster

The listener only calls `toast()`. The `Toaster` component still has to be on the page to draw it, and where you put it matters:

- **Mounted once at the app root** (for example React's `withApp` option of `createInertiaApp`): toasts work on every page, including sign-in pages.
- **Mounted inside a persistent layout**: toasts only show on pages that use that layout. That is fine for an admin area, but a message flashed on a redirect to the login page won't appear.

Layouts that stay mounted between visits are covered in [persistent layouts in Inertia](/blog/inertia-persistent-layouts.html).

## Tips for good flash messages

- **Translate them on the server.** Wrap messages in `__()` so they follow the user's locale. [Laravel translations in Inertia apps](/blog/laravel-inertia-translations.html) covers the frontend side.
- **Say what happened, briefly.** "Invitation sent to ana@example.com" beats "Success!".
- **Use `error` toasts for business rules, not validation.** "You can't delete the last admin" fits a toast. "Email is required" belongs next to the field.
- **Flash before you redirect.** `Inertia::flash()` writes to the session, so call it before returning the redirect.
- **Don't flash on JSON endpoints.** Flash data rides on Inertia responses. A `useHttp` call should read its own response instead.

## Frequently asked questions

### Why does my Inertia flash message show up twice?

Usually because it is a shared prop saved in browser history, or because two listeners are registered. Use `Inertia::flash()`, which is not stored in history, and register the `flash` listener once at app start (or clean it up in React's `useEffect`).

### Can I still use redirect()->with() in an Inertia app?

Yes, but only data you share in `HandleInertiaRequests` reaches the page, and it becomes a normal prop. For one-time toasts, `Inertia::flash()` is simpler.

### Does flash data survive a redirect chain?

Flash data is written to the session and delivered with the next Inertia response. If a redirect leads to another redirect, the adapter's middleware re-flashes it so it isn't lost on the way.

### Can I show a toast without a server round trip?

Yes. Call your toast library directly, or use `router.flash()` if you want the same `flash` event pipeline to handle it.

## Flash toasts in SaaS Laravel

In the [SaaS Laravel starter kits](/), controllers call `Inertia::flash('toast', ['type' => ..., 'message' => __(...)])` before redirecting, with `success`, `info`, `warning` or `error` as the type. A single `flash` listener turns them into sonner toasts. In React it runs inside the `Toaster` mounted once in `app.tsx`. In Vue and Svelte it starts in `app.ts`, and the `Toaster` is mounted in the app layouts, so toasts show on dashboard pages but not on auth pages. See [flash toasts in the Vue kit](/docs/vue/inertia.html) and the [Vue, React or Svelte comparison](/blog/vue-react-or-svelte-laravel-saas.html).

<BlogPostCta title="Toasts that just work after every action" text="SaaS Laravel kits flash translated toasts from Laravel controllers and show them with sonner, in Vue, React or Svelte on one shared Laravel backend." />
