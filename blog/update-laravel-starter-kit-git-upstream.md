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

A starter kit saves you weeks at the start, but it doesn't stand still once you've begun. Security fixes, framework upgrades and new features keep landing in the kit, and you'll want them in your project too. A git upstream merge is how you bring those changes in without copying files across by hand.

I'll walk through the whole thing: setting up the remotes, previewing an update, merging it safely, resolving conflicts, and a few habits that keep future updates small.

## Origin and upstream: two remotes, two jobs

Git lets one repository talk to several remote repositories. When your project is built on someone else's code, the convention is to use two:

| Remote | Points to | You push? | You pull? |
| --- | --- | --- | --- |
| `origin` | Your own project repository | Yes | Yes |
| `upstream` | The starter kit's repository | No | Yes, when you want an update |

Your team works against `origin` as usual, and `upstream` is only ever read from. If you're wondering how Git knows what's new, it's the shared history: because your project and the kit have commits in common, Git can tell which kit changes you already have and brings in only the new ones.

## Setting up the remotes

### You cloned the kit directly

After `git clone`, the kit's repository is called `origin`. Rename it, then add your own repository:

```bash
git remote rename origin upstream
git remote add origin git@github.com:your-org/my-saas.git
git push -u origin main
```

If you can, start this way. Your project begins with the kit's full history, so every later merge is just a normal merge.

### You started from a copy

Maybe you downloaded a zip, or copied the files into a repository you already had. In that case there's no shared history. Add the kit as `upstream` and merge once with `--allow-unrelated-histories`:

```bash
git remote add upstream https://github.com/vendor/starter-kit.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories
```

Be ready for a lot of conflicts on this first merge, since Git has no common ancestor to compare against. You only have to resolve them once, though. After that Git has a merge base, and future updates behave normally.

### Optional: block accidental pushes to upstream

You never want `git push upstream` to reach the kit repository. If you set a push URL that doesn't exist, that mistake fails harmlessly:

```bash
git remote set-url --push upstream no-push
git remote -v
```

## See what changed before you merge

Fetching downloads the kit's new commits without touching any of your files. Once you've fetched, you can compare:

```bash
git fetch upstream
git log --oneline HEAD..upstream/main     # commits you don't have yet
git diff --stat HEAD...upstream/main      # files the kit changed since you last merged
```

Notice the three dots in the `diff`. They compare against the merge base, so you see only the kit's changes and not your own work. I'd read the kit's release notes next to the log, too, because they'll mention new migrations, new commands and anything you need to run afterwards.

## The git upstream merge, step by step

**Always merge on a separate branch.** Then if something goes wrong, your main branch hasn't been touched.

```bash
git checkout main
git pull origin main
git checkout -b kit-update
git merge upstream/main
```

No conflicts? Skip ahead to the post-merge steps below. If Git does report conflicts, resolve those first. Once everything works, merge `kit-update` into `main` like any other feature branch, ideally through a pull request so a teammate can take a look.

Use `git merge` here, not `git rebase`. A rebase rewrites commits you've already published, which breaks every teammate's local copy and makes the next update harder.

## Resolving conflicts

A conflict means you and the kit both changed the same lines. Start by listing the conflicted files:

```bash
git status
git diff --name-only --diff-filter=U
```

Then decide file by file:

| Kind of file | Usual approach |
| --- | --- |
| Kit file you never meant to change | Take the kit's version: `git checkout --theirs <file>` |
| Kit file you customised on purpose | Merge by hand, keeping both changes |
| Your own file the kit doesn't touch | Take yours: `git checkout --ours <file>` |
| Generated files (types, compiled translations) | Take either side, then re-run the generator |
| `composer.lock`, `package-lock.json` | Take the kit's version, then re-install and re-add your own packages |

The names can be confusing, so here's the rule: during a merge, **ours is your branch and theirs is `upstream/main`**. During a rebase it's the other way round, which is one more reason to stick with merging. After fixing a file, mark it resolved with `git add <file>`, and finish with `git commit`.

Lock files need a slightly different order. Resolve `composer.json` and `package.json` by hand first. Then take the kit's lock file and let the package manager sort it out: `npm install` picks up your extra packages from `package.json`, and running `composer update vendor/package` for each package you added brings `composer.lock` back in line.

And if the merge turns into a mess, you can always start again:

```bash
git merge --abort
```

### Let Git remember your resolutions

Do you find yourself resolving the same conflict every update? Turn on rerere ("reuse recorded resolution"). Git records how you fixed a conflict and applies the same fix next time:

```bash
git config rerere.enabled true
```

Still check the result. rerere repeats your last decision, and that's only right if the code around it hasn't changed.

## After the merge: bring the app up to date

A merged update is only code. In a Laravel project you'll usually also need to:

1. Install dependencies: `composer install` and `npm install`.
2. Read new migrations, then run them. In a multi-tenant app, run the tenant migrations too.
3. Re-run code generators (typed routes, TypeScript types, translation files).
4. Re-run seeders that define data like permissions or menus, if they changed.
5. Build the frontend and run the test suite.

Back up the database before you run new migrations in production, and deploy the update like any other release.

## Merge, rebase or cherry-pick: which to use

| Option | Use it when |
| --- | --- |
| Merge `upstream/main` | Regular updates. Keeps history intact and future merges simple |
| Cherry-pick one commit | You need a single urgent fix now and the full update later |
| Rebase onto upstream | Almost never for a shared project; it rewrites commits others depend on |

Cherry-picking is handy, but keep in mind that the same commit comes in again with the next full merge. Git usually recognises identical changes. A cherry-picked fix that you then edited, though, can conflict.

## How to keep upstream merges small

Most of the pain comes from editing the kit's own files. So the biggest habit is to add rather than edit: build new features in new files, folders or modules instead of changing the kit's core files. A [modular Laravel architecture](/blog/modular-laravel-architecture.html) makes that feel natural. The same goes for your own translations, config and permissions, which can live in new files wherever the kit supports it.

Merge often, too. A weekly update touches a handful of files, while skipping six months turns it into one large, risky merge.

Two smaller habits help when conflicts do happen. Keep a short list of the kit files you changed on purpose, so you can judge each conflict quickly. And commit generated files consistently, then always regenerate them after a merge rather than hand-editing their conflicts.

Before you buy a kit at all, check how it handles updates. The [Laravel SaaS starter kit buyer's guide](/blog/laravel-saas-starter-kit.html) covers that.

## Frequently asked questions

### What is the difference between origin and upstream in Git?

They're both just remote names. By convention, `origin` is the repository you push your work to, and `upstream` is the original project you pull updates from. Git treats them exactly the same; the names only describe how you use them.

### Why does Git say "refusing to merge unrelated histories"?

Your project and the kit don't share a single commit, usually because you started from a copy instead of a clone. Add `--allow-unrelated-histories` to the first merge. After that the shared history exists, and you won't need the flag again.

### How often should I merge upstream updates?

As often as the kit publishes them, or at least every few weeks. Small, frequent merges have few conflicts and are easy to test, while long gaps turn a routine update into a small migration project.

### Can I take only some changes from upstream?

Yes. `git cherry-pick <commit>` applies a single commit from `upstream/main`. I'd keep it for urgent fixes and still merge the full update later, so you don't drift too far from the kit.

## How SaaS Laravel delivers updates

Each [SaaS Laravel](/) kit lives in its own private GitHub repository, and updates are pushed to its `main` branch every week. The docs suggest exactly the setup above: clone into a `vue`, `react` or `svelte` folder, rename the kit remote to `upstream`, push your project to your own `origin`, then merge updates on a `kit-update` branch. The [updates guide](/docs/purchase/updates.html) lists the commands to run after each merge, including tenant migrations and the code generators, and the [release notes](/releases.html) show what changed. Cloning is explained in [repository access](/docs/purchase/repository-access.html).

<BlogPostCta title="Weekly updates you merge with Git" text="SaaS Laravel is a one-time purchase with lifetime access and weekly updates pushed to your kit repository, ready to merge as your upstream." />
