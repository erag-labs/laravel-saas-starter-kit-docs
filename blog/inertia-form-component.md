---
title: "Inertia Forms with the Form Component"
description: "A practical guide to the Inertia Form component: field names, errors, slot props, reset and dirty state, file uploads, events and when to use useForm instead."
pageClass: blog-page
date: 2026-09-29
author: amit-gupta
category: frontend
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

Most forms in a Laravel app do the same job. Send some fields, show the validation errors, disable the button while it saves. The **Inertia Form component** does all of that with a plain HTML form. You give each input a `name`, and Inertia collects the values, submits them as an Inertia visit and hands the errors back. I'll go through how it works in Vue, React and Svelte, the props and slot values you'll actually use, edit forms, file uploads, and when I still reach for `useForm`.

The examples use Inertia v3. If you're upgrading, the changes are listed in [what's new in Inertia v3](/blog/inertia-js-v3-whats-new.html).

## What the Inertia Form component does

`Form` renders a normal `form` element. When it's submitted, it reads every named input inside, builds the request data and sends it through the Inertia router. If Laravel answers with a redirect and validation errors, those errors end up in the component's `errors` slot value, keyed by field name. You don't write `v-model`, you don't keep a state object, and you don't call `preventDefault()`.

On the server it's ordinary Laravel. Validate, save, redirect.

```php
public function store(StoreUserRequest $request, UserService $users): RedirectResponse
{
    $users->create($request->validated());

    return to_route('users.index');
}
```

The Form Request does the validation and the service does the saving, so the controller is a few lines long. That's how I like controllers to look.

## A first form in Vue, React and Svelte

The API is identical across the three adapters. What changes is how you read the slot values: Vue uses a scoped slot, React a render function and Svelte a snippet.

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

`action` also takes a route object from Laravel Wayfinder, so you don't have to hard-code URLs. I explain that setup in [typed routes with Laravel Wayfinder](/blog/laravel-wayfinder-typed-routes.html).

## How field names become request data

The component reads the DOM, so the `name` attribute decides what shape of data Laravel gets:

| Input name | Data sent |
| --- | --- |
| `email` | `{ email: '...' }` |
| `user.name` | `{ user: { name: '...' } }` |
| `skills[]` | `{ skills: ['...', '...'] }` |
| `report[tags][]` | `{ report: { tags: [...] } }` |
| `app\.name` | `{ 'app.name': '...' }` (escaped dot) |

Nested errors come back in dot notation. The error for `user.name` is `errors['user.name']`.

One small trap: give checkboxes an explicit `value`. Without one, the browser sends the string `"on"`, and that rarely matches a `boolean` or `in:` rule.

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

You get the same values on a template ref in Vue or a ref in React, so a parent can call `submit()` from a button that sits outside the form. Svelte's ref only exposes the methods.

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

In Vue templates you write these in kebab-case: `reset-on-success`, `set-defaults-on-success`. If you only learn two from this table, make it `resetOnSuccess` and `setDefaultsOnSuccess`. Those two are what login and settings forms need.

## Edit forms: default values and dirty state

For an edit form, set the initial values the uncontrolled way. React and Vue use `defaultValue` (and `defaultChecked`), while Svelte uses `value` and `checked`. Then add `setDefaultsOnSuccess` and use `isDirty`, so the Save and Discard buttons only show up once something has changed:

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

A native HTML form only supports GET and POST. `Form` submits through Inertia, though, so `method="patch"` just works. Wayfinder's `.form()` variant goes the other way: it posts and spoofs the method with Laravel's `_method` field.

## File uploads and progress

Add a file input and the component switches to sending `FormData` by itself. Show `progress` while the upload runs.

The part people usually get wrong is uploads on an update route. Submit with POST and spoof PUT or PATCH through `_method`, because PHP only parses multipart bodies on POST requests.

```vue
<Form action="/avatar" method="post" v-slot="{ progress, errors }">
    <input type="file" name="avatar" />
    <progress v-if="progress" :value="progress.percentage" max="100" />
    <p v-if="errors.avatar">{{ errors.avatar }}</p>
    <button type="submit">Upload</button>
</Form>
```

## Events

`Form` fires the usual visit callbacks: before, start, progress, success, error, finish and cancel. In Vue you listen with `@success` and `@error`. React and Svelte take `onSuccess` and `onError` props instead. A typical use is closing a modal after a save:

```tsx
<Form action="/roles" method="post" onSuccess={() => setOpen(false)}>
    {/* fields */}
</Form>
```

To tell the user it worked, I'd flash a toast from the controller rather than wire a message into every form. The setup is in [flash messages and toasts with Inertia](/blog/inertia-flash-messages-toasts.html).

## Live validation with Precognition

When the route has Laravel Precognition on it (the `precognitive` middleware), the component can validate a field before submit. Call `validate('email')` on change, then read `invalid('email')`, `valid('email')` and `validating`. Requests are debounced, 1.5 seconds by default (see `validationTimeout`). Files are skipped unless you set `validateFiles`.

## Nested inputs with useFormContext

Big forms end up split into components. Rather than passing `errors` down through props, a child can call `useFormContext()` to get the parent form's state and methods. It returns `undefined` when the component isn't inside a `Form`, so your shared input components can work either way.

## Form component vs useForm

| Choose `Form` when | Choose `useForm` when |
| --- | --- |
| Inputs are native or wrap native inputs | Values come from custom widgets (card pickers, drag and drop) |
| You want the least code | You need two-way binding to show live values elsewhere |
| Data comes straight from the fields | You build data in code or submit without a form element |
| — | You want form state kept in history with a remember key |

My default is `Form`. I only switch to `useForm` when one of the cases on the right actually applies. Both send the same Inertia visit, so the server side doesn't change either way.

## Frequently asked questions

### Does the Inertia Form component need v-model or useState?

No. It reads the values from the named inputs when you submit. You only need controlled state if something else on the page has to react to the value while the user is typing.

### How do I show a success message after submitting?

For a small inline "Saved" label next to the button, use `recentlySuccessful`. If the message has to survive a redirect to another page, flash it from Laravel with `Inertia::flash()` and show it as a toast.

### Why is my checkbox sending "on"?

A checked checkbox without a `value` attribute sends `"on"`. Add `value="1"`, or whatever value your validation rule expects.

### Can I keep two forms with the same field names on one page?

Yes. Give each form its own `errorBag`, and errors for `email` in one form won't show up in the other.

## Forms in SaaS Laravel

If you'd like to see these patterns in a finished app, the [SaaS Laravel starter kits](/) build nearly every form with the `Form` component and a Wayfinder route object: sign-in, registration, profile, security, users, roles, tenants and domains. The profile page uses `setDefaultsOnSuccess` with `isDirty` for its Save and Discard buttons. Login clears the password with `resetOnSuccess`, and modals close in a success callback. `useForm` is only kept for the layout card pickers. The patterns are listed in [Inertia v3 with Vue](/docs/vue/inertia.html), and the [Vue, React or Svelte comparison](/blog/vue-react-or-svelte-laravel-saas.html) shows how the kits differ.

<BlogPostCta title="Forms already wired to Laravel" text="SaaS Laravel kits ship auth, profile, user, role and tenant forms built with the Inertia Form component and Wayfinder, in Vue, React or Svelte." />
