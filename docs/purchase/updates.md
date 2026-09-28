---
title: "Weekly Starter Kit Updates"
description: "Weekly updates are pushed to your kit repository. Set the kit as your upstream remote and merge updates into your own project when you are ready."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/purchase/updates.html
  - - meta
    - property: og:title
      content: "Weekly Starter Kit Updates"
  - - meta
    - property: og:description
      content: "Weekly updates are pushed to your kit repository. Set the kit as your upstream remote and merge updates into your own project when you are ready."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/purchase/updates.html
  - - meta
    - name: twitter:title
      content: "Weekly Starter Kit Updates"
  - - meta
    - name: twitter:description
      content: "Weekly updates are pushed to your kit repository. Set the kit as your upstream remote and merge updates into your own project when you are ready."
---

# Updates

Your purchase includes **lifetime access with weekly updates**. It is a one-time payment, not a subscription.

## How updates are delivered

```text
Weekly updates → your kit repository (main) → your upstream/main → merge into your project
```

- Every update is pushed to your kit repository (`saas-laravel-starter-kit-vue`, `-react` or `-svelte`).
- Updates are published weekly. Your kit repository's `main` branch always has the latest version.
- See what changed in each update on the [Release Notes](/releases) page.
- To get notified, watch the repository on GitHub (**Watch → Custom → Releases/All activity**).

## Recommended remote setup

Keep the kit as `upstream` and your own repository as `origin`:

<PrivateRepoNotice />

| Remote | Points to |
| --- | --- |
| `origin` | Your project, e.g. `git@github.com:your-org/my-saas.git` |
| `upstream` | The kit, e.g. `https://github.com/erag-labs/saas-laravel-starter-kit-vue.git` |

::: code-group

```bash [Cloned the kit directly]
git remote rename origin upstream
git remote add origin git@github.com:your-org/my-saas.git
git push -u origin main
```

```bash [Started from a copy]
git remote add upstream https://github.com/erag-labs/saas-laravel-starter-kit-vue.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories
```

:::

Check the result with `git remote -v`. With the All Starter Kits bundle, add each kit you use as the `upstream` of the project based on it.

## Pulling an update

1. Merge the kit on a separate branch:

   ```bash
   git checkout -b kit-update
   git fetch upstream
   git log --oneline HEAD..upstream/main    # what changed
   git merge upstream/main
   ```

2. Resolve conflicts, then bring dependencies, databases and generated files up to date (commands below).
3. Merge `kit-update` into your main branch when everything passes.

::: details Commands to run after merging
```bash
composer install
npm install
php artisan migrate
php artisan tenants:migrate
php artisan erag:generate-lang
php artisan typescript:transform
php artisan wayfinder:generate --with-form
npm run build
php artisan test --compact
```
:::

::: warning Check new migrations
Read new files in `database/migrations` and `database/migrations/tenant` before running them in production, and back up your databases first. Seeders may also change (menus, permissions); re-run them where needed (see [Users, roles & permissions](/docs/core/users-roles-permissions#adding-a-permission)).
:::

::: tip Fewer conflicts
- Add new features as new modules in `Modules/` and new pages/components instead of editing kit files in place.
- Keep your translations in new files under `lang/<locale>/modules/`.
- Add new permissions in new files in `config/permissions/`.
- Generated files (`resources/js/lang`, `resources/js/types`) conflict often. Take either side, then re-run the generators above.
:::

## Cherry-picking

To take a single fix only:

```bash
git fetch upstream
git log --oneline upstream/main
git cherry-pick <commit-sha>
```
