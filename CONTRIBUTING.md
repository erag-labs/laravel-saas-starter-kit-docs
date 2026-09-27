# Contributing

Thanks for helping improve the SaaS Laravel website and documentation.

This repository is the source of [saas-laravel.com](https://saas-laravel.com). It covers the website and documentation only — the starter kits themselves live in private repositories that you get access to after purchase.

## Ways to help

- **Report a documentation problem** — a typo, a broken link, outdated steps or something unclear.
- **Report a website bug** — a layout issue, a broken page or something that doesn't work on your device.
- **Suggest an improvement** — a missing guide, a better example or a clearer explanation.

Please [open an issue](../../issues/new/choose) and pick the matching template.

## Pull requests

Small fixes such as typos and broken links are welcome as pull requests.

1. Fork the repository and create a branch from `main`.
2. Make your change and check it locally (see below).
3. Open a pull request and fill in the template.

This repository is updated automatically, so pull requests are not merged here directly. Accepted changes are applied to the next update of the site and your pull request is then closed. You will be credited in the commit.

For larger changes, open an issue first so we can agree on the approach.

## Run the site locally

Requires Node.js 18 or newer.

```bash
npm ci
npm run docs:dev
```

Before opening a pull request, make sure the production build passes:

```bash
npm run docs:build
```

## Writing guidelines

- Use plain, concise English and short sentences.
- Explain the concept first, then show a small example.
- Keep code examples short. Put longer examples in a `::: details` block.
- Every command, file name and feature must match the starter kits exactly — do not document features that don't exist.
- Use tables for comparisons and settings.
- Keep each page's `title` and `description` frontmatter unique.

## Kit support and purchases

- Questions about a kit you bought: open an issue in the kit repository you have access to.
- Questions about buying: see [How to pay](https://saas-laravel.com/how-to-pay.html).

## Code of Conduct

By taking part, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
