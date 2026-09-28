---
title: "Starter Kit Repository Access"
description: "How your GitHub account is invited to the starter kit repository after a GitHub Sponsors payment, and how to clone the private repository."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/purchase/repository-access.html
  - - meta
    - property: og:title
      content: "Starter Kit Repository Access"
  - - meta
    - property: og:description
      content: "How your GitHub account is invited to the starter kit repository after a GitHub Sponsors payment, and how to clone the private repository."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/purchase/repository-access.html
  - - meta
    - name: twitter:title
      content: "Starter Kit Repository Access"
  - - meta
    - name: twitter:description
      content: "How your GitHub account is invited to the starter kit repository after a GitHub Sponsors payment, and how to clone the private repository."
---

# Repository access

Each starter kit lives in its own private GitHub repository:

| Kit | Repository |
| --- | --- |
| <Badge type="tip" text="Vue" /> | `erag-labs/saas-laravel-starter-kit-vue` |
| <Badge type="tip" text="React" /> | `erag-labs/saas-laravel-starter-kit-react` |
| <Badge type="tip" text="Svelte" /> | `erag-labs/saas-laravel-starter-kit-svelte` |

The **All Starter Kits** bundle gives you access to all three repositories.

## What you get

- The full source of the kit (Laravel backend + your framework's frontend)
- Lifetime access with weekly updates, pushed to the same repository
- No recurring subscription

## How access is granted

```text
Pay through GitHub Sponsors → your GitHub account is invited automatically → accept the invitation
```

1. Choose a kit on the [pricing page](/pricing) and pay through GitHub Sponsors (see [How to pay](/how-to-pay)).
2. Your GitHub account is **automatically** invited to the kit repository (or all three for the bundle) as soon as the payment goes through.
3. GitHub emails you the invitation. Accept it, or open the repository URL while signed in and accept the banner.

::: info Automatic access
Access is provisioned automatically for the GitHub account that made the sponsorship, so sponsor from the account that should receive access.
:::

If the invitation does not arrive, open an issue or contact the maintainer through GitHub.

## Clone the repository

::: code-group

```bash [Vue]
git clone https://github.com/erag-labs/saas-laravel-starter-kit-vue.git my-saas
```

```bash [React]
git clone https://github.com/erag-labs/saas-laravel-starter-kit-react.git my-saas
```

```bash [Svelte]
git clone https://github.com/erag-labs/saas-laravel-starter-kit-svelte.git my-saas
```

:::

::: tip Authentication
Cloning a private repository over HTTPS needs GitHub authentication: GitHub CLI (`gh auth login`), a credential helper or a personal access token. SSH works too, for example `git@github.com:erag-labs/saas-laravel-starter-kit-vue.git`.
:::

Next:

- Set up your own `origin` and keep the kit as `upstream` so you can pull updates. See [Updates → Recommended remote setup](/docs/purchase/updates#recommended-remote-setup).
- Continue with [Installation](/docs/getting-started/installation).
