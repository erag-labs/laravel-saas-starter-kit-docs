# SaaS Laravel — Website & Documentation

Source of [saas-laravel.com](https://saas-laravel.com): the product website and documentation for the **SaaS Laravel starter kits** — production-ready, multi-tenant Laravel 13 + Inertia v3 kits for **Vue**, **React** and **Svelte** that share one backend.

- **Website:** https://saas-laravel.com
- **Documentation:** https://saas-laravel.com/docs.html
- **Pricing:** https://saas-laravel.com/pricing.html
- **How to pay:** https://saas-laravel.com/how-to-pay.html

## What the kits include

| Area | Highlights |
| --- | --- |
| Multi-tenancy | Database per tenant (stancl/tenancy), subdomain identification, workspace status and admin invitations |
| Domains | Primary and secondary domains with a per-domain app name, default language and sign-in features |
| Authentication | Laravel Fortify with email verification, two-factor authentication and passkeys |
| Access control | Spatie roles and permissions, protected system roles and queued user invitations |
| Operations | Global maintenance mode with bypass link and allowed IPs, per-workspace suspension |
| Localization | 17 languages with per-user and per-domain defaults |
| Frontend | Vue 3.5, React 19 or Svelte 5 with TypeScript, Tailwind CSS v4 and shadcn components |
| Quality | Pest, Larastan, Pint, ESLint, Prettier and Laravel Boost |

Vue is **$29**, React **$30** and Svelte **$33**, or **$79** for all three (save $13) — a one-time payment with lifetime access and weekly updates.

## Tech stack

- [VitePress](https://vitepress.dev) 1.x with a custom theme in `.vitepress/theme`
- Vue 3 single-file components for the marketing pages
- No UI or carousel libraries — plain CSS and native browser APIs

## Local development

Requires Node.js 18 or newer (CI uses Node.js 22).

```bash
npm ci
npm run docs:dev
```

The site runs at `http://localhost:5173`.

| Command | Description |
| --- | --- |
| `npm run docs:dev` | Start the dev server with hot reload |
| `npm run docs:build` | Build the static site into `.vitepress/dist` |
| `npm run docs:preview` | Preview the production build locally |

## Project structure

```text
.
├── .vitepress/
│   ├── config.mts          # Site config, navigation and sidebar
│   ├── site.ts             # Prices, kits, plans, features and FAQs
│   ├── seo.ts              # Meta tags, JSON-LD, sitemap and llms.txt
│   └── theme/              # Layout, styles and page components
├── docs/                   # Documentation pages
│   ├── getting-started/
│   ├── core/
│   ├── vue/  react/  svelte/
│   ├── purchase/
│   └── reference/
├── kits/                   # Starter kit pages
├── pricing/                # Pricing detail pages
├── public/                 # Static files: robots.txt, icons, social images, CNAME
├── index.md                # Home page
├── docs.md                 # Documentation introduction
├── pricing.md              # Pricing overview
└── how-to-pay.md           # Purchase guide
```

## SEO

Every build generates:

- `sitemap.xml` with every public page
- `robots.txt` that allows search engines and AI crawlers
- `llms.txt` and `llms-full.txt` for AI assistants
- Canonical, Open Graph and Twitter tags on every page, plus JSON-LD structured data

Page titles and descriptions live in each page's frontmatter.

## Deployment

Every push to `main` runs the **Deploy Docs** workflow (`.github/workflows/deploy-docs.yml`), which builds the site with VitePress and deploys it to GitHub Pages on the custom domain `saas-laravel.com` (see `public/CNAME`).

## Contributing

Found a typo or something unclear? Open an issue or a pull request — accepted changes are applied to the next update of the site.
