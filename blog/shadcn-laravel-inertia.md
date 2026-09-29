---
title: "shadcn for Laravel: Vue, React and Svelte"
description: "shadcn Laravel guide: set up shadcn/ui, shadcn-vue or shadcn-svelte in an Inertia app, configure components.json, theme with Tailwind v4 and wrap form fields."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: frontend
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

Most shadcn tutorials assume a JavaScript meta-framework, so if you're building on Laravel it's fair to wonder whether it fits. It does. shadcn has become the default way to build admin and SaaS interfaces, and it works just as well in a Laravel app with Inertia. There are three flavours: shadcn/ui for React, shadcn-vue and shadcn-svelte. I'll go through how each one fits a Laravel project: where the files go, what `components.json` needs, how theming works with Tailwind CSS v4, and how to connect the components to Laravel validation errors.

## What shadcn actually is

If you're expecting a component library you install and import from `node_modules`, shadcn isn't that. It's a collection of components that a CLI copies into your project as source files. You own the code. You can change any class or prop, and nothing breaks when a package updates.

Each component is built from a few layers. Underneath is an unstyled, accessible primitive (a dialog, select or dropdown, say) that handles focus and keyboard behaviour. Tailwind classes on top give it the look. And CSS variables hold the colours and radius, so one theme change restyles everything.

## The three ports compared

| | React | Vue | Svelte |
| --- | --- | --- | --- |
| Project | shadcn/ui | shadcn-vue | shadcn-svelte |
| Primitives | Radix UI (`@radix-ui/react-*`) | Reka UI (`reka-ui`) | Bits UI (`bits-ui`) |
| CLI | `npx shadcn@latest` | `npx shadcn-vue@latest` | `npx shadcn-svelte@latest` |
| Output | One file per component, `button.tsx` | A folder per component with `index.ts` | A folder per component with `index.ts` |
| Toasts | `sonner` | `vue-sonner` | `svelte-sonner` |
| Icons | `lucide-react` | `@lucide/vue` | `lucide-svelte` |

Across the three, the component names and the visual result are nearly identical. What changes is the syntax and the primitives underneath. If you haven't chosen the framework yet, [Vue, React or Svelte for your Laravel SaaS](/blog/vue-react-or-svelte-laravel-saas.html) may help.

## How shadcn fits a Laravel project

Compared with a standalone Vite app, the only real difference is the path. Your frontend lives in `resources/js`, and the stylesheet in `resources/css/app.css`. The CLI needs a path alias to write imports like `@/components/ui/button`, so declare it in `tsconfig.json`:

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": { "@/*": ["./resources/js/*"] }
    }
}
```

You might be wondering why that's needed when Laravel's Vite plugin already maps `@` to `resources/js`. The Vite mapping is what makes imports resolve at build time. The `tsconfig.json` entry is for your editor and the CLI, so all three agree.

## Configuring components.json

`components.json` sits at the project root and tells the CLI where things go. Here's a Laravel setup for shadcn-vue:

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

A few details differ by port. The one that applies everywhere: Tailwind v4 has no config file, so leave `tailwind.config` empty, because the theme lives in CSS.

- React adds `"tsx": true` and `"rsc": false`, since Inertia pages aren't React Server Components. It also has a `hooks` alias.
- Vue has a `composables` alias where the others use `hooks`.
- Svelte is the one to watch. Its aliases default to `$lib`, a SvelteKit convention that doesn't exist in Laravel, so point every alias at `@/...` instead.

## Adding components

Once `components.json` is in place, you add components by name:

```bash
npx shadcn@latest add dialog        # React
npx shadcn-vue@latest add dialog    # Vue
npx shadcn-svelte@latest add dialog # Svelte
```

The CLI writes the source into `resources/js/components/ui` and installs any npm packages the component needs, such as the primitive library.

Two habits will save you trouble here. **Commit before you run the CLI.** If you've already customised a component, the diff then shows exactly what the CLI wants to change. And only add what you use. Every component is code you maintain, so there's no reason to pull in the whole catalogue.

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

Dark mode is a `.dark` class on `<html>`. Toggle it with a small inline script in your Blade root view that reads the saved preference or the system setting. Doing it there means the page doesn't flash light before the first paint. Rebranding a SaaS is then just a matter of changing the variables in `:root` and `.dark`, while the components stay the same.

One more thing: if you publish Laravel's pagination views or use other Blade templates, add `@source` lines for them so Tailwind picks up their classes too.

## Wiring shadcn inputs to Laravel validation

shadcn gives you an `Input` and a `Label`, but neither knows anything about Laravel's error bag. Without help, every form repeats the same label, input and error markup. A thin wrapper per field type fixes that. Here's a React version:

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

Inside an Inertia form, you then pass `error={errors.email}` and nothing else. Don't skip the `aria-invalid` attribute. shadcn's input styles already include `aria-invalid:border-destructive`, so that attribute is what turns the field red, with no extra classes. For how Inertia collects those errors in the first place, see [the Inertia Form component guide](/blog/inertia-form-component.html).

## Customising without losing upstream fixes

Because you own the files, it's easy to drift a long way from upstream. That makes later fixes hard to pull in, so a few rules help.

**Extend variants rather than forking components.** Adding an `icon-sm` size to the button's variant map is a one-line change that stays easy to merge. Along the same lines, put app behaviour in wrappers. Loading spinners, error messages and translations belong in your own components, not in `components/ui`. I like to keep that UI folder boring: if a file there needs business logic, it probably belongs one level up.

Finally, mount global pieces once. The toaster and tooltip provider go in your app layout or root wrapper, not in every page.

## Frequently asked questions

### Can I use shadcn with Blade or Livewire?

Not directly. shadcn components are React, Vue or Svelte source files, so they need one of those frameworks. Inertia gives you that without leaving Laravel's routing and controllers.

### Is shadcn free for commercial Laravel projects?

Yes. shadcn/ui, shadcn-vue and shadcn-svelte are open source under the MIT licence. The copied components become part of your codebase, and you can ship them in commercial products.

### Do I need Tailwind CSS to use shadcn?

Yes. The styling is Tailwind utility classes plus CSS variables, and current versions of all three ports are built for Tailwind CSS v4, with the theme defined in CSS.

### Why do my shadcn imports fail after adding a component?

Usually the `@/` alias is missing from `tsconfig.json`, or the aliases in `components.json` don't match your folders. Check that `ui` points at `@/components/ui` and `utils` at the file that exports `cn()`.

## How SaaS Laravel uses shadcn

If you'd rather skip the setup, each SaaS Laravel kit already ships a configured `components.json` and a `resources/js/components/ui` folder: shadcn/ui on Radix in the React kit, shadcn-vue on Reka UI in the Vue kit, and shadcn-svelte on Bits UI in the Svelte kit. That includes dialog, select, sidebar, dropdown menu, input OTP, sonner and more. On top of them sit the kit's own `Common*` form components, which add the label, error message and accessibility attributes for Inertia forms. The component docs for [Vue](/docs/vue/components.html), [React](/docs/react/components.html) and [Svelte](/docs/svelte/components.html) list them all.

<BlogPostCta title="Get shadcn already set up for Laravel" text="SaaS Laravel kits ship shadcn components for Vue, React or Svelte with ready form wrappers, plus multi-tenancy, authentication and roles on Laravel." />
