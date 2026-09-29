---
title: "shadcn for Laravel: Vue, React and Svelte"
description: "shadcn Laravel guide: set up shadcn/ui, shadcn-vue or shadcn-svelte in an Inertia app, configure components.json, theme with Tailwind v4 and wrap form fields."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
tags: [UI, Inertia]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/shadcn-laravel-inertia.html
  - - meta
    - property: og:title
      content: "shadcn for Laravel: Vue, React and Svelte"
  - - meta
    - property: og:description
      content: "shadcn Laravel guide: set up shadcn/ui, shadcn-vue or shadcn-svelte in an Inertia app, configure components.json, theme with Tailwind v4 and wrap form fields."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/shadcn-laravel-inertia.html
  - - meta
    - name: twitter:title
      content: "shadcn for Laravel: Vue, React and Svelte"
  - - meta
    - name: twitter:description
      content: "shadcn Laravel guide: set up shadcn/ui, shadcn-vue or shadcn-svelte in an Inertia app, configure components.json, theme with Tailwind v4 and wrap form fields."
---

# shadcn Laravel Guide: shadcn/ui, shadcn-vue and shadcn-svelte in Inertia Apps

<BlogPostMeta />

**shadcn** has become the default way to build admin and SaaS interfaces, and it works in a **Laravel** app with Inertia just as well as in a JavaScript meta-framework. There are three flavours: shadcn/ui for React, shadcn-vue and shadcn-svelte. This guide explains how each one fits a Laravel project: where the files go, what `components.json` needs, how theming works with Tailwind CSS v4, and how to connect the components to Laravel validation errors.

## What shadcn actually is

shadcn is not a component library you install and import from `node_modules`. It's a collection of components that a CLI copies into your project as source files. You own the code, you can change any class or prop, and nothing breaks when a package updates.

Each component combines three things:

- **An unstyled, accessible primitive**, such as a dialog, select or dropdown, that handles focus and keyboard behaviour
- **Tailwind classes** that give it the look
- **CSS variables** for colours and radius, so one theme change restyles everything

## The three ports compared

| | React | Vue | Svelte |
| --- | --- | --- | --- |
| Project | shadcn/ui | shadcn-vue | shadcn-svelte |
| Primitives | Radix UI (`@radix-ui/react-*`) | Reka UI (`reka-ui`) | Bits UI (`bits-ui`) |
| CLI | `npx shadcn@latest` | `npx shadcn-vue@latest` | `npx shadcn-svelte@latest` |
| Output | One file per component, `button.tsx` | A folder per component with `index.ts` | A folder per component with `index.ts` |
| Toasts | `sonner` | `vue-sonner` | `svelte-sonner` |
| Icons | `lucide-react` | `@lucide/vue` | `lucide-svelte` |

The component names and the visual result are nearly identical across the three. Only the syntax and the primitives underneath change. For choosing the framework itself, see [Vue, React or Svelte for your Laravel SaaS](/blog/vue-react-or-svelte-laravel-saas.html).

## How shadcn fits a Laravel project

The only real difference from a standalone Vite app is the path: your frontend lives in `resources/js`, and the stylesheet in `resources/css/app.css`. The CLI needs a path alias to write imports like `@/components/ui/button`, so declare it in `tsconfig.json`:

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": { "@/*": ["./resources/js/*"] }
    }
}
```

Laravel's Vite plugin already maps `@` to `resources/js`, so imports resolve at build time. The `tsconfig.json` entry makes the editor and the CLI agree.

## Configuring components.json

`components.json` at the project root tells the CLI where things go. A Laravel setup for shadcn-vue looks like this:

```json
{
    "$schema": "https://shadcn-vue.com/schema.json",
    "style": "new-york",
    "tailwind": { "config": "", "css": "resources/css/app.css", "baseColor": "neutral", "cssVariables": true },
    "aliases": {
        "components": "@/components",
        "ui": "@/components/ui",
        "utils": "@/lib/utils",
        "composables": "@/composables"
    },
    "iconLibrary": "lucide"
}
```

Port-specific details worth knowing:

- **Tailwind v4 has no config file.** Leave `tailwind.config` empty, because the theme lives in CSS.
- **React** adds `"tsx": true` and `"rsc": false`, since Inertia pages aren't React Server Components. It also has a `hooks` alias.
- **Svelte** defaults its aliases to `$lib`, a SvelteKit convention that doesn't exist in Laravel. Point every alias at `@/...` instead.
- **Vue** has a `composables` alias where the others use `hooks`.

## Adding components

With `components.json` in place, add components by name:

```bash
npx shadcn@latest add dialog        # React
npx shadcn-vue@latest add dialog    # Vue
npx shadcn-svelte@latest add dialog # Svelte
```

The CLI writes the source into `resources/js/components/ui` and installs any npm packages the component needs, such as the primitive library. Two habits save trouble:

- **Commit before you run it.** If you have already customised a component, the diff shows exactly what the CLI wants to change.
- **Add only what you use.** Every component is code you maintain, so there's no reason to pull in the whole catalogue.

## Theming with CSS variables and Tailwind v4

shadcn's theme is a set of CSS variables in `app.css`. Tailwind v4 maps them to utilities with `@theme inline`, so `bg-primary` or `border-border` read the current variable:

```css
@import 'tailwindcss';
@custom-variant dark (&:is(.dark *));

@theme inline {
    --color-primary: var(--primary);
    --color-border: var(--border);
    --radius-lg: var(--radius);
}

:root { --primary: hsl(0 0% 9%); --border: hsl(0 0% 92.8%); --radius: 0.5rem; }
.dark { --primary: hsl(0 0% 98%); --border: hsl(0 0% 14.9%); }
```

Dark mode is a `.dark` class on `<html>`. Toggle it with a small inline script in your Blade root view that reads the saved preference or the system setting, so the page doesn't flash light before the first paint. To rebrand a SaaS, change the variables in `:root` and `.dark`. The components stay the same.

If you publish Laravel's pagination views or use other Blade templates, add `@source` lines for them so Tailwind picks up their classes too.

## Wiring shadcn inputs to Laravel validation

Out of the box, shadcn gives you an `Input` and a `Label`, but no idea of Laravel's error bag. Every form ends up repeating the same label, input and error markup. A thin wrapper per field type fixes that. Here is a React version:

```tsx
export function TextField({ name, label, error, ...props }: TextFieldProps) {
    const id = props.id ?? name;

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} name={name} aria-invalid={!!error} {...props} />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
```

Inside an Inertia form you then pass `error={errors.email}` and nothing else. The `aria-invalid` attribute matters here, because shadcn's input styles already include `aria-invalid:border-destructive`, so the field turns red without extra classes. How Inertia collects those errors is covered in [the Inertia Form component guide](/blog/inertia-form-component.html).

## Customising without losing upstream fixes

Because you own the files, it's easy to drift far from upstream. A few rules keep updates manageable:

- **Extend variants, don't fork components.** Adding an `icon-sm` size to the button's variant map is a one-line change that stays easy to merge.
- **Put app behaviour in wrappers.** Loading spinners, error messages and translations belong in your own components, not in `components/ui`.
- **Keep the UI folder boring.** If a file in `components/ui` needs business logic, it probably belongs one level up.
- **Mount global pieces once.** The toaster and tooltip provider go in your app layout or root wrapper, not in every page.

## Frequently asked questions

### Can I use shadcn with Blade or Livewire?

Not directly. shadcn components are React, Vue or Svelte source files, so they need one of those frameworks. With Inertia you get that without leaving Laravel's routing and controllers.

### Is shadcn free for commercial Laravel projects?

Yes. shadcn/ui, shadcn-vue and shadcn-svelte are open source under the MIT licence. The copied components become part of your codebase, and you can ship them in commercial products.

### Do I need Tailwind CSS to use shadcn?

Yes. The styling is Tailwind utility classes plus CSS variables. Current versions of all three ports are built for Tailwind CSS v4, with the theme defined in CSS.

### Why do my shadcn imports fail after adding a component?

Usually the `@/` alias is missing in `tsconfig.json`, or the aliases in `components.json` don't match your folders. Check that `ui` points at `@/components/ui` and `utils` at the file that exports `cn()`.

## How SaaS Laravel uses shadcn

Each SaaS Laravel kit ships a configured `components.json` and a `resources/js/components/ui` folder: shadcn/ui on Radix in the React kit, shadcn-vue on Reka UI in the Vue kit, and shadcn-svelte on Bits UI in the Svelte kit. That includes dialog, select, sidebar, dropdown menu, input OTP, sonner and more. On top of them sit the kit's own `Common*` form components, which add the label, error message and accessibility attributes for Inertia forms. See the component docs for [Vue](/docs/vue/components.html), [React](/docs/react/components.html) and [Svelte](/docs/svelte/components.html).

<BlogPostCta title="Get shadcn already set up for Laravel" text="SaaS Laravel kits ship shadcn components for Vue, React or Svelte with ready form wrappers, plus multi-tenancy, authentication and roles on Laravel." />
