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

"User created", "Settings saved", "Invitation sent". Every SaaS needs these little confirmations after an action. In a Blade app you'd flash a message to the session and print it in the layout, and you're done. An Inertia flash message works a bit differently, because the page is a Vue, React or Svelte component and you want the message to pop up as a toast exactly once. I'll start with the classic shared-props approach and why it gets awkward, then move on to `Inertia::flash()`, the client-side `flash` event, typed payloads, and where the toaster should live.

## Pick the right kind of feedback first

Before writing any code, it helps to decide what kind of message you actually need, because each one has its own tool:

| Situation | Best tool |
| --- | --- |
| A field is invalid | Validation errors, shown next to the field (`errors.email`) |
| A form on the same page saved | An inline "Saved" label, e.g. the Form component's `recentlySuccessful` |
| An action finished and the user was redirected | A flash message shown as a toast |

Everything below is about that last row. Validation errors already reach your forms on their own, as the [Inertia Form component guide](/blog/inertia-form-component.html) explains.

## The old way: session flash as a shared prop

Before Inertia had flash data, most apps flashed to the session and shared it on every response:

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

The controller calls `return back()->with('success', 'Saved.')`, and a component watches `page.props.flash.success`. That works, mostly. The trouble starts with where the message lives. Inertia stores props in browser history, so the message gets saved along with the page, and if the user goes back to it a watcher can show the toast again.

Repeated messages are another snag. If the same message arrives twice in a row, the prop's value doesn't change, so a watcher may simply not fire the second time. And every response carries the `flash` key, even when it's `null`.

## Sending an Inertia flash message with Inertia::flash()

The Laravel adapter has a dedicated API for one-time data. `Inertia::flash()` stores values in the session for the next Inertia response, and that response sends them next to the props rather than inside them:

```php
use Inertia\Inertia;

public function store(StoreProjectRequest $request, ProjectService $projects): RedirectResponse
{
    $projects->create($request->validated());

    Inertia::flash('toast', ['type' => 'success', 'message' => __('Project created.')]);

    return to_route('projects.index');
}
```

You're not tied to that exact form. These variations work as well:

```php
Inertia::flash(['toast' => $toast, 'newProjectId' => $project->id]);

return Inertia::flash('toast', $toast)->back();

return Inertia::render('projects/Show', $props)->flash('highlight', $project->id);
```

The key can also be a PHP enum: a backed enum uses its value, a unit enum uses its name. The data survives the redirect and is removed from the session once it's been delivered.

## How flash data reaches the browser

On the client, flash data sits on the page object as `page.flash`, right beside `page.props`. Two details make it a good fit for toasts.

First, it isn't saved in history state, so pressing Back doesn't bring the message back. Second, it fires an event. Each time a response (or the first page load) brings flash data, the router fires `flash`, plus the DOM event `inertia:flash`, with the data in `event.detail.flash`.

That second point changes where the code goes. The toast logic doesn't belong in a page at all. You register one listener when the app starts.

## Showing toasts with the flash event

I'm using sonner in the examples because it has a port for each framework (`vue-sonner`, `sonner`, `svelte-sonner`), but any toast library follows the same idea.

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

By default, `page.flash` is a loose record, so `data.type` comes through as `unknown`. You can fix that once with TypeScript declaration merging, and then every listener and every `usePage()` call is typed:

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

Keep the `type` values in line with your toast library's method names. That way `toast[data.type]` always points at a real function.

## Reading flash data inside a page

Not all flash data is a toast. Say you want to highlight the row that was just created. You can flash its ID and read it on the page from `usePage().flash` (Vue and React) or `page.flash` (Svelte):

```vue
<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { computed } from 'vue';

const page = usePage();
const highlightedId = computed(() => page.flash.newProjectId);
</script>
```

If you only care about one visit, pass an `onFlash` callback to that visit instead: `router.post(url, data, { onFlash: (flash) => { ... } })`.

There's also a client-side way in. `router.flash('toast', {...})` fires the same event, which comes in handy when a `useHttp` request finishes and there's no server redirect to carry the message.

## Where to mount the toaster

This part confused me at first, so it's worth spelling out. The listener only calls `toast()`. The `Toaster` component still has to be on the page to draw anything, and where you put it matters.

If you mount it once at the app root (for example with React's `withApp` option of `createInertiaApp`), toasts work on every page, sign-in pages included. If you mount it inside a persistent layout, toasts only appear on pages that use that layout. That's fine for an admin area, but **a message flashed on a redirect to the login page won't appear**. I'd go with the app root unless you have a reason not to.

Layouts that stay mounted between visits are covered in [persistent layouts in Inertia](/blog/inertia-persistent-layouts.html).

## Writing flash messages people actually read

Translate them on the server. Wrap messages in `__()` so they follow the user's locale; the frontend side is covered in [Laravel translations in Inertia apps](/blog/laravel-inertia-translations.html). And say what happened, briefly: "Invitation sent to ana@example.com" beats "Success!".

Use `error` toasts for business rules, not validation. "You can't delete the last admin" fits a toast, while "Email is required" belongs next to the field.

A couple of ordering rules catch people out, too:

- Flash before you redirect. `Inertia::flash()` writes to the session, so call it before returning the redirect.
- Don't flash on JSON endpoints. Flash data rides on Inertia responses, so a `useHttp` call should read its own response instead.

## Frequently asked questions

### Why does my Inertia flash message show up twice?

Most of the time it's either a shared prop that got saved in browser history, or two listeners registered at once. Switch to `Inertia::flash()`, which isn't stored in history, and register the `flash` listener once at app start (or clean it up in React's `useEffect`).

### Can I still use redirect()->with() in an Inertia app?

Yes, but only data you share in `HandleInertiaRequests` reaches the page, and it becomes a normal prop. For one-time toasts, `Inertia::flash()` is the simpler choice.

### Does flash data survive a redirect chain?

It does. Flash data is written to the session and delivered with the next Inertia response, and if one redirect leads to another, the adapter's middleware re-flashes it so nothing gets lost on the way.

### Can I show a toast without a server round trip?

Yes. Call your toast library directly, or use `router.flash()` if you'd like the same `flash` event pipeline to handle it.

## Flash toasts in SaaS Laravel

The [SaaS Laravel starter kits](/) use exactly this pattern. Controllers call `Inertia::flash('toast', ['type' => ..., 'message' => __(...)])` before redirecting, with `success`, `info`, `warning` or `error` as the type, and a single `flash` listener turns those into sonner toasts. In React it runs inside the `Toaster` mounted once in `app.tsx`. In Vue and Svelte it starts in `app.ts`, and the `Toaster` is mounted in the app layouts, so toasts show on dashboard pages but not on auth pages. There's more in [flash toasts in the Vue kit](/docs/vue/inertia.html) and the [Vue, React or Svelte comparison](/blog/vue-react-or-svelte-laravel-saas.html).

<BlogPostCta title="Toasts that just work after every action" text="SaaS Laravel kits flash translated toasts from Laravel controllers and show them with sonner, in Vue, React or Svelte on one shared Laravel backend." />
