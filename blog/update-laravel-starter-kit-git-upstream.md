---
title: "Keeping a Starter Kit Up to Date with Git"
description: "A git upstream merge workflow for starter kits: set up origin and upstream, preview changes, merge on a branch, resolve conflicts and run the post-merge steps."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: tooling
tags: [Git, Workflow]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/update-laravel-starter-kit-git-upstream.html
  - - meta
    - property: og:title
      content: "Keeping a Starter Kit Up to Date with Git"
  - - meta
    - property: og:description
      content: "A git upstream merge workflow for starter kits: set up origin and upstream, preview changes, merge on a branch, resolve conflicts and run the post-merge steps."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/update-laravel-starter-kit-git-upstream.html
  - - meta
    - name: twitter:title
      content: "Keeping a Starter Kit Up to Date with Git"
  - - meta
    - name: twitter:description
      content: "A git upstream merge workflow for starter kits: set up origin and upstream, preview changes, merge on a branch, resolve conflicts and run the post-merge steps."
---

# Git Upstream Merge: How to Pull Starter Kit Updates into Your Own Project

<BlogPostMeta />

A starter kit saves weeks at the start, but it keeps changing after you begin: security fixes, framework upgrades, new features. A **git upstream merge** lets you bring those changes into your own project without copying files by hand. This guide covers setting up the remotes, previewing an update, merging it safely, resolving conflicts and keeping future updates small.

## Origin and upstream: two remotes, two jobs

Git lets one repository talk to several remote repositories. By convention, a project built on someone else's code uses two:

| Remote | Points to | You push? | You pull? |
| --- | --- | --- | --- |
| `origin` | Your own project repository | Yes | Yes |
| `upstream` | The starter kit's repository | No | Yes, when you want an update |

Your team works against `origin` as usual. `upstream` is only read from. Because your project and the kit share history, Git knows which kit changes you already have and only brings in new ones.

## Setting up the remotes

### You cloned the kit directly

After `git clone`, the kit is called `origin`. Rename it and add your own repository:

```bash
git remote rename origin upstream
git remote add origin git@github.com:your-org/my-saas.git
git push -u origin main
```

This is the best starting point: your project begins with the kit's full history, so every later merge is a normal merge.

### You started from a copy

If you downloaded a zip or copied files into an existing repository, there is no shared history. Add the kit as `upstream` and merge once with `--allow-unrelated-histories`:

```bash
git remote add upstream https://github.com/vendor/starter-kit.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories
```

Expect many conflicts on this first merge, because Git has no common ancestor to compare against. Resolve them once; after that, Git has a merge base and future updates behave normally.

### Optional: block accidental pushes to upstream

You never want `git push upstream` to reach the kit repository. Setting a push URL that doesn't exist makes that mistake fail harmlessly:

```bash
git remote set-url --push upstream no-push
git remote -v
```

## See what changed before you merge

Fetching downloads the kit's new commits without touching your files. Then compare:

```bash
git fetch upstream
git log --oneline HEAD..upstream/main     # commits you don't have yet
git diff --stat HEAD...upstream/main      # files the kit changed since you last merged
```

The three-dot `diff` compares against the merge base, so it shows only the kit's changes, not your own work. Read the kit's release notes alongside the log. They tell you about new migrations, new commands and anything you must run afterwards.

## The git upstream merge, step by step

Always merge on a separate branch. If something goes wrong, your main branch is untouched.

```bash
git checkout main
git pull origin main
git checkout -b kit-update
git merge upstream/main
```

If Git reports no conflicts, go straight to the post-merge steps below. If it does, resolve them first. When everything works, merge `kit-update` into `main` like any other feature branch, ideally through a pull request so a teammate can look at it.

Use `git merge`, not `git rebase`, for this. A rebase rewrites your published commits, which breaks every teammate's local copy and makes the next update harder.

## Resolving conflicts

A conflict means both you and the kit changed the same lines. List the conflicted files:

```bash
git status
git diff --name-only --diff-filter=U
```

Then decide per file:

| Kind of file | Usual approach |
| --- | --- |
| Kit file you never meant to change | Take the kit's version: `git checkout --theirs <file>` |
| Kit file you customised on purpose | Merge by hand, keeping both changes |
| Your own file the kit doesn't touch | Take yours: `git checkout --ours <file>` |
| Generated files (types, compiled translations) | Take either side, then re-run the generator |
| `composer.lock`, `package-lock.json` | Take the kit's version, then re-install and re-add your own packages |

During a merge, **ours** is your branch and **theirs** is `upstream/main`. (It's the other way round during a rebase, which is one more reason to merge.) After fixing a file, mark it resolved with `git add <file>`, and finish with `git commit`.

For lock files, resolve `composer.json` and `package.json` by hand first. Then take the kit's lock file and let the package manager work it out: `npm install` picks up your extra packages from `package.json`, and `composer update vendor/package` for each package you added brings `composer.lock` back in line.

If the merge turns into a mess, you can always start over:

```bash
git merge --abort
```

### Let Git remember your resolutions

If you resolve the same conflict every update, turn on **rerere** ("reuse recorded resolution"). Git records how you fixed a conflict and applies the same fix next time:

```bash
git config rerere.enabled true
```

Check the result anyway. rerere repeats your last decision, which is only right if the surrounding code hasn't changed.

## After the merge: bring the app up to date

A merged update is only code. In a Laravel project you usually also need to:

1. Install dependencies: `composer install` and `npm install`.
2. Read new migrations, then run them. In a multi-tenant app, run the tenant migrations too.
3. Re-run code generators (typed routes, TypeScript types, translation files).
4. Re-run seeders that define data like permissions or menus, if they changed.
5. Build the frontend and run the test suite.

Back up the database before running new migrations in production, and deploy the update like any other release.

## Merge, rebase or cherry-pick: which to use

| Option | Use it when |
| --- | --- |
| Merge `upstream/main` | Regular updates. Keeps history intact and future merges simple |
| Cherry-pick one commit | You need a single urgent fix now and the full update later |
| Rebase onto upstream | Almost never for a shared project; it rewrites commits others depend on |

Cherry-picking is handy, but the same commit arrives again with the next full merge. Git usually recognises identical changes, but a cherry-picked fix you then edited can conflict.

## How to keep upstream merges small

Most of the pain comes from editing the kit's own files. Some habits keep conflicts rare:

- **Add, don't edit.** Build new features in new files, folders or modules instead of changing the kit's core files. A [modular Laravel architecture](/blog/modular-laravel-architecture.html) makes this natural.
- **Extend in new files.** Put your own translations, config and permissions in new files where the kit supports it.
- **Merge often.** A weekly update touches a handful of files. Skipping six months makes one large, risky merge.
- **Keep a short list of kit files you changed on purpose.** It makes conflicts quick to judge.
- **Commit generated files consistently,** and always regenerate them after a merge instead of hand-editing conflicts.

Update policy is also worth checking before you choose a kit, as covered in the [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html).

## Frequently asked questions

### What is the difference between origin and upstream in Git?

Both are just remote names. By convention, `origin` is the repository you push your work to, and `upstream` is the original project you pull updates from. Git treats them the same; the names only describe how you use them.

### Why does Git say "refusing to merge unrelated histories"?

Your project and the kit have no commit in common, usually because you started from a copy instead of a clone. Add `--allow-unrelated-histories` to the first merge. After that, the shared history exists and the flag isn't needed.

### How often should I merge upstream updates?

As often as the kit publishes them, or at least every few weeks. Small, frequent merges have few conflicts and are easy to test. Long gaps turn a routine update into a small migration project.

### Can I take only some changes from upstream?

Yes. `git cherry-pick <commit>` applies a single commit from `upstream/main`. Use it for urgent fixes, and still merge the full update later so you don't drift too far from the kit.

## How SaaS Laravel delivers updates

Each [SaaS Laravel](/) kit lives in its own private GitHub repository, and updates are pushed to its `main` branch every week. The documentation recommends cloning into a `vue`, `react` or `svelte` folder, renaming the kit remote to `upstream` and pushing your project to your own `origin`, then merging updates on a `kit-update` branch. The [updates guide](/docs/purchase/updates.html) lists the commands to run after each merge, including tenant migrations and the code generators, and the [release notes](/releases.html) show what changed. Cloning is described in [repository access](/docs/purchase/repository-access.html).

<BlogPostCta title="Weekly updates you merge with Git" text="SaaS Laravel is a one-time purchase with lifetime access and weekly updates pushed to your kit repository, ready to merge as your upstream." />
