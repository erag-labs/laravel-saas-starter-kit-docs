---
title: "Inertia Forms with the Form Component"
description: "A practical guide to the Inertia Form component: field names, errors, slot props, reset and dirty state, file uploads, events and when to use useForm instead."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
tags: [Inertia, Frontend]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/inertia-form-component.html
  - - meta
    - property: og:title
      content: "Inertia Forms with the Form Component"
  - - meta
    - property: og:description
      content: "A practical guide to the Inertia Form component: field names, errors, slot props, reset and dirty state, file uploads, events and when to use useForm instead."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/inertia-form-component.html
  - - meta
    - name: twitter:title
      content: "Inertia Forms with the Form Component"
  - - meta
    - name: twitter:description
      content: "A practical guide to the Inertia Form component: field names, errors, slot props, reset and dirty state, file uploads, events and when to use useForm instead."
---

# The Inertia Form Component: Laravel Forms With Less Frontend Code

<BlogPostMeta />

Most forms in a Laravel app do the same thing: send some fields, show validation errors, disable the button while saving. The **Inertia Form component** handles all of that with a plain HTML form. You give inputs a `name`, and Inertia collects the values, submits them as an Inertia visit and hands the errors back. This guide covers how it works in Vue, React and Svelte, the props and slot values you will actually use, edit forms, file uploads, and when `useForm` is still the better tool.

Examples use Inertia v3. If you are upgrading, [what's new in Inertia v3](/blog/inertia-js-v3-whats-new.html) lists the changes.

## What the Inertia Form component does

`Form` renders a normal `form` element. On submit it reads every named input inside it, builds the request data, and sends it with the Inertia router. When Laravel responds with a redirect and validation errors, the errors land in the component's `errors` slot value, keyed by field name. There is no `v-model`, no state object and no `preventDefault()`.

The server side stays ordinary Laravel: validate, save, redirect.

```php
public function store(StoreUserRequest $request, UserService $users): RedirectResponse
{
    $users->create($request->validated());

    return to_route('users.index');
}
```

Validation lives in the Form Request and the saving in a service, so the controller stays a few lines long.

## A first form in Vue, React and Svelte

The API is the same in all three adapters. Only the way you read the slot values changes: a scoped slot in Vue, a render function in React and a snippet in Svelte.

::: code-group

```vue [Vue]
<Form action="/users" method="post" v-slot="{ errors, processing }">
    <input name="name" />
    <p v-if="errors.name">{{ errors.name }}</p>
    <input name="email" type="email" />
    <p v-if="errors.email">{{ errors.email }}</p>
    <button type="submit" :disabled="processing">Create user</button>
</Form>
```

```tsx [React]
<Form action="/users" method="post">
    {({ errors, processing }) => (
        <>
            <input name="name" />
            {errors.name && <p>{errors.name}</p>}
            <input name="email" type="email" />
            {errors.email && <p>{errors.email}</p>}
            <button type="submit" disabled={processing}>Create user</button>
        </>
    )}
</Form>
```

```svelte [Svelte]
<Form action="/users" method="post">
    {#snippet children({ errors, processing })}
        <input name="name" />
        {#if errors.name}<p>{errors.name}</p>{/if}
        <input name="email" type="email" />
        {#if errors.email}<p>{errors.email}</p>{/if}
        <button type="submit" disabled={processing}>Create user</button>
    {/snippet}
</Form>
```

:::

`action` also accepts a route object from Laravel Wayfinder, so you don't hard-code URLs. That setup is explained in [typed routes with Laravel Wayfinder](/blog/laravel-wayfinder-typed-routes.html).

## How field names become request data

Because the component reads the DOM, the `name` attribute decides the shape of the data Laravel receives:

| Input name | Data sent |
| --- | --- |
| `email` | `{ email: '...' }` |
| `user.name` | `{ user: { name: '...' } }` |
| `skills[]` | `{ skills: ['...', '...'] }` |
| `report[tags][]` | `{ report: { tags: [...] } }` |
| `app\.name` | `{ 'app.name': '...' }` (escaped dot) |

Nested errors come back in dot notation, so the error for `user.name` is `errors['user.name']`.

Give checkboxes an explicit `value`. Without it the browser sends the string `"on"`, which rarely matches a `boolean` or `in:` rule.

## Slot values: state and methods

| Name | What it gives you |
| --- | --- |
| `errors`, `hasErrors` | Validation errors per field, and whether there are any |
| `processing` | `true` while the request is in flight |
| `progress` | Upload progress (`percentage`) when files are sent |
| `wasSuccessful` | `true` after the last submit succeeded |
| `recentlySuccessful` | `true` for two seconds after success, handy for a "Saved" label |
| `isDirty` | Whether any field differs from its default value |
| `submit()`, `reset()`, `cancel()` | Submit, reset fields (all or named ones), abort the request |
| `clearErrors()`, `setError()` | Manage errors on the client |
| `defaults()` | Make the current values the new defaults |

The same values are exposed on a template ref (Vue) or a ref (React), so a parent can call `submit()` from a button outside the form. In Svelte the ref exposes the methods only.

## Props worth knowing

| Prop | Use it to |
| --- | --- |
| `resetOnSuccess` | Clear all fields, or only listed ones like `['password']`, after success |
| `resetOnError` | Clear fields after a failed submit, e.g. a one-time code |
| `setDefaultsOnSuccess` | Treat saved values as the new baseline, so `isDirty` goes back to `false` |
| `transform` | Change the data just before it is sent |
| `options` | Visit options such as `preserveScroll`, `preserveState`, `only` |
| `errorBag` | Keep errors apart when two forms on one page share field names |
| `disableWhileProcessing` | Add the `inert` attribute to the form while it submits |
| `showProgress` | Turn the progress bar off for small background saves |
| `optimistic` | Update page props before the server answers (new in v3) |

In Vue templates these are kebab-case: `reset-on-success`, `set-defaults-on-success`.

## Edit forms: default values and dirty state

For an edit form, set initial values the uncontrolled way. React and Vue use `defaultValue` (and `defaultChecked`), Svelte uses `value` and `checked`. Add `setDefaultsOnSuccess` and use `isDirty` to show Save and Discard buttons only when something changed:

```vue
<Form
    action="/settings/profile"
    method="patch"
    set-defaults-on-success
    v-slot="{ errors, processing, isDirty, reset }"
>
    <input name="name" :defaultValue="user.name" />
    <p v-if="errors.name">{{ errors.name }}</p>
    <button v-if="isDirty" type="button" @click="reset()">Discard</button>
    <button type="submit" :disabled="processing || !isDirty">Save</button>
</Form>
```

A native HTML form only supports GET and POST, but `Form` submits through Inertia, so `method="patch"` works. Wayfinder's `.form()` variant takes the other route: it posts and spoofs the method with Laravel's `_method` field.

## File uploads and progress

Add a file input and the component sends the data as `FormData` on its own. Show `progress` while the upload runs. For an upload on an update route, submit with POST and spoof PUT or PATCH through `_method`, because PHP only parses multipart bodies on POST requests.

```vue
<Form action="/avatar" method="post" v-slot="{ progress, errors }">
    <input type="file" name="avatar" />
    <progress v-if="progress" :value="progress.percentage" max="100" />
    <p v-if="errors.avatar">{{ errors.avatar }}</p>
    <button type="submit">Upload</button>
</Form>
```

## Events

`Form` fires the usual visit callbacks: before, start, progress, success, error, finish and cancel. Vue listens with `@success` and `@error`. React and Svelte use `onSuccess` and `onError` props. A common case is closing a modal after a save:

```tsx
<Form action="/roles" method="post" onSuccess={() => setOpen(false)}>
    {/* fields */}
</Form>
```

To tell the user it worked, flash a toast from the controller instead of wiring it into every form. See [flash messages and toasts with Inertia](/blog/inertia-flash-messages-toasts.html).

## Live validation with Precognition

With Laravel Precognition on the route (the `precognitive` middleware), the component can validate a field before submit. Call `validate('email')` on change, then read `invalid('email')`, `valid('email')` and `validating`. Requests are debounced (1.5 seconds by default, see `validationTimeout`), and files are skipped unless you set `validateFiles`.

## Nested inputs with useFormContext

Big forms get split into components. Instead of passing `errors` down through props, a child can call `useFormContext()` to get the parent form's state and methods. It returns `undefined` when the component is not inside a `Form`, so shared input components can work in both cases.

## Form component vs useForm

| Choose `Form` when | Choose `useForm` when |
| --- | --- |
| Inputs are native or wrap native inputs | Values come from custom widgets (card pickers, drag and drop) |
| You want the least code | You need two-way binding to show live values elsewhere |
| Data comes straight from the fields | You build data in code or submit without a form element |
| — | You want form state kept in history with a remember key |

Both send the same Inertia visit, so the server side does not change when you switch.

## Frequently asked questions

### Does the Inertia Form component need v-model or useState?

No. It reads values from the named inputs when you submit. You only need controlled state if something else on the page has to react to the value while the user types.

### How do I show a success message after submitting?

Use `recentlySuccessful` for a small inline "Saved" label next to the button. For a message that should survive a redirect to another page, flash it from Laravel with `Inertia::flash()` and show it as a toast.

### Why is my checkbox sending "on"?

A checkbox without a `value` attribute sends `"on"` when checked. Add `value="1"` (or any value your validation rule expects).

### Can I keep two forms with the same field names on one page?

Yes. Give each form its own `errorBag` so errors for `email` in one form don't show up in the other.

## Forms in SaaS Laravel

The [SaaS Laravel starter kits](/) build nearly every form with the `Form` component and a Wayfinder route object: sign-in, registration, profile, security, users, roles, tenants and domains. The profile page uses `setDefaultsOnSuccess` with `isDirty` for its Save and Discard buttons. Login clears the password with `resetOnSuccess`, and modals close in a success callback. `useForm` is kept for the layout card pickers. The patterns are listed in [Inertia v3 with Vue](/docs/vue/inertia.html), and the [Vue, React or Svelte guide](/blog/vue-react-or-svelte-laravel-saas.html) shows how the kits differ.

<BlogPostCta title="Forms already wired to Laravel" text="SaaS Laravel kits ship auth, profile, user, role and tenant forms built with the Inertia Form component and Wayfinder, in Vue, React or Svelte." />
