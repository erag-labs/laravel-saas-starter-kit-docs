---
title: "Using AI Coding Agents on a Laravel Codebase"
description: "AI coding in Laravel that holds up in review: guideline files, skills and MCP for context, well-sized tasks, tests as guardrails and a review checklist."
pageClass: blog-page
date: 2026-09-29
author: annu-gupta
category: tooling
tags: [AI, Workflow]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/ai-coding-agents-laravel.html
  - - meta
    - property: og:title
      content: "Using AI Coding Agents on a Laravel Codebase"
  - - meta
    - property: og:description
      content: "AI coding in Laravel that holds up in review: guideline files, skills and MCP for context, well-sized tasks, tests as guardrails and a review checklist."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/ai-coding-agents-laravel.html
  - - meta
    - name: twitter:title
      content: "Using AI Coding Agents on a Laravel Codebase"
  - - meta
    - name: twitter:description
      content: "AI coding in Laravel that holds up in review: guideline files, skills and MCP for context, well-sized tasks, tests as guardrails and a review checklist."
---

# AI Coding in Laravel: A Practical Workflow for Agents on a Real Codebase

<BlogPostMeta />

AI coding agents can read your Laravel project, edit files and run commands. Whether the result is useful depends less on the agent and more on the codebase and the workflow around it. This guide covers how to prepare a Laravel codebase for AI coding, how to write tasks an agent can finish, how to use tests and static analysis as guardrails, and what to check before you merge.

## Where agents help and where they need care

Agents do best when the answer already exists somewhere in your code and the task is to repeat a pattern. They need the most supervision where a mistake is quiet: nothing crashes, but the behaviour is wrong.

| Usually a good fit | Needs close review |
| --- | --- |
| A new CRUD screen that mirrors an existing one | Authorization and policies |
| Form Requests, resources and data objects | Migrations on tables with production data |
| Pest tests for existing behaviour | Anything that switches tenant or database context |
| Renaming, moving and small refactors | Payments, emails and other side effects |
| Translation keys and UI copy | New Composer or npm dependencies |

This is not about how smart a given model is. It is about how expensive a quiet mistake is, and how easy it is for you to spot one.

## Setting up a Laravel codebase for AI coding

An agent starts every session knowing nothing about your project. Three kinds of context fix that.

### 1. A guidelines file

Most agents read a Markdown file in the project root at the start of a session: `AGENTS.md` for many tools, `CLAUDE.md` for Claude Code. Keep it short and specific. Write down what a new developer would ask you in their first week:

```md
## Project rules
- Laravel 13, Inertia v3 with Vue, Pest 5. Check versions before using an API.
- Features live in Modules/<Name>. Controllers stay thin; logic goes in Services.
- Validation goes in Form Requests, never inline in controllers.
- Run `vendor/bin/pint` on changed PHP files.
- Never add a Composer or npm dependency without asking.
```

Rules that say *why* work better than bare commands. "Use Form Requests so validation is reusable and testable" helps the agent handle cases your rule didn't mention.

### 2. Skills for detail

Long explanations don't belong in a file that loads every session. Skills are folders with a `SKILL.md` file whose `description` tells the agent when to open it: one for testing, one for your frontend, one for multi-tenancy. The agent loads the detail only when the task needs it.

### 3. MCP tools for facts

An agent that guesses a column name writes broken code. An MCP server lets the agent ask the application instead: the database schema, the route list, the last exception, documentation for your installed package versions. [Laravel Boost](/blog/laravel-boost-ai-agents.html) provides guidelines, skills and an MCP server for Laravel in one package, so you don't have to build this yourself.

## Write tasks an agent can finish

The most common reason for a bad result is a vague task. A good task has a clear scope, points at an example and says how to check the result.

```text
Add an "archived" filter to the projects index page.
- Follow the existing "status" filter in ProjectController and Index.vue.
- Add the query logic to ProjectService, not the controller.
- Add a Pest feature test for the filter.
- Done when `php artisan test --filter=ProjectIndex` passes.
```

A few habits help:

- **One change per task.** "Add the filter" and "redesign the table" are two tasks.
- **Name a sibling file.** "Do it like `UserController`" is worth a paragraph of rules.
- **Ask for a plan first on anything bigger.** Read the plan, correct it, then let the agent write code. Fixing a plan is cheaper than fixing a diff.
- **Start a fresh session for a new task.** Old context from an unrelated task tends to leak into the new one.

## Tests and tools as guardrails

Agents are fast at producing code that looks right. Automated checks tell you whether it *is* right, and the agent can run them itself and fix what fails.

| Check | Command | Catches |
| --- | --- | --- |
| Tests | `php artisan test --filter=...` | Wrong behaviour, broken flows |
| Static analysis | `vendor/bin/phpstan analyse` | Wrong types, missing methods, undefined properties |
| Code style | `vendor/bin/pint --test` | Formatting drift in PHP |
| Frontend | `npm run lint` and a type check | Broken imports, wrong props |

Feature tests are the best contract to give an agent, because they describe behaviour, not implementation:

```php
it('hides archived projects by default', function () {
    $user = User::factory()->create();
    Project::factory()->for($user)->create(['name' => 'Live']);
    Project::factory()->for($user)->archived()->create(['name' => 'Old']);

    $this->actingAs($user)
        ->get(route('projects.index'))
        ->assertOk()
        ->assertSee('Live')
        ->assertDontSee('Old');
});
```

Decide your testing policy and write it in the guidelines file. Some teams want every change tested and the affected tests run; others want the agent to leave tests to them. Both are fine. An unclear policy is what causes trouble. For more on the tools themselves, see [testing a Laravel SaaS with Pest](/blog/laravel-saas-testing-pest.html) and [Larastan and Pint for Laravel code quality](/blog/laravel-larastan-pint.html).

One warning: an agent asked to "make the tests pass" may change the test instead of the code. Say explicitly that existing tests must not be deleted or weakened without asking.

## Reviewing agent output

Review agent code the way you would review a pull request from a new teammate who works fast. Read the diff, not the summary.

- **Authorization.** Every new route or action checks a policy, gate or permission.
- **Validation.** Input is validated in a Form Request; no `$request->all()` passed to `create()`.
- **Queries.** No N+1 queries in loops; eager loading where lists are rendered.
- **Migrations.** Correct folder, a working `down()` method, and safe on tables that already have data.
- **Config.** No `env()` calls outside `config/` files, because they return `null` once config is cached.
- **Dependencies.** No new packages you didn't ask for; lock files changed only when expected.
- **Tests.** New behaviour is covered, and no existing test was deleted or loosened.
- **Leftovers.** No debug calls, commented-out code or stray files.

Keep diffs small so this review stays realistic. Several small reviewed commits are better than one large one you skim.

## Laravel traps agents fall into

Some mistakes come up again and again in Laravel projects:

- **Tenant context.** In a multi-tenant app, code in a queued job, command or seeder may run without a tenant initialised and read the central database. Point the agent at how your app switches context, and put it in a rule.
- **Generated files.** Typed routes, TypeScript types and translation JSON are generated. An agent may edit them by hand, and the next generator run silently undoes the change. Tell it which commands regenerate them.
- **Architecture drift.** Without a rule, business logic ends up in controllers or models. If your code follows a [modular Laravel architecture](/blog/modular-laravel-architecture.html) with services, say so and link an example.
- **Outdated APIs.** Agents may write code for an older Laravel or package version. Stating versions in the guidelines, or giving the agent version-aware docs search, reduces this.

## Keep it safe

- Work on a branch and commit often, so any change is one `git reset` away.
- Use the agent's permission settings: allow reading and running tests freely, and require approval for commands that install packages, delete files or touch the network.
- Never put production credentials in a local `.env` an agent can read, and give database tools read-only access.
- Review before you push. The agent writes the code; you are still the one merging it.

## Frequently asked questions

### Do AI coding agents follow Laravel conventions?

They follow the conventions they can see. Without context, an agent falls back on general Laravel habits, which may not match your project. A guidelines file, a sibling file to copy and version-aware documentation make the output match your codebase much more closely.

### What should go in an AGENTS.md file for a Laravel project?

The stack and versions, where code lives, the commands to test and lint, your architecture rules (thin controllers, services, Form Requests), your testing policy and anything the agent must never do without asking, such as adding dependencies. Keep it short; move long how-tos into skills.

### Should I let an agent run migrations?

Locally, on a disposable database, it is usually fine and speeds up the loop. Never let it run migrations against staging or production. Read every new migration yourself before it is merged.

### How do I stop an agent from changing too much at once?

Give it one clearly scoped task, name the files or modules it may touch, and ask for a plan before code on anything larger. Small diffs are easier for you to review and easier for the agent to get right.

## How SaaS Laravel supports AI coding

The [SaaS Laravel](/) kits ship with Laravel Boost guidelines in `AGENTS.md` and `CLAUDE.md`, skills in `.agents/skills` and `.claude/skills`, and an MCP configuration, so agents know the stack, the module structure and the testing tools from the first prompt. The Vue kit also includes project rules in `.ai/rules`. The two guideline files set different testing policies by default, which you can align as described in [AI agent rules about tests](/docs/core/testing.html#ai-agent-rules-about-tests).

<BlogPostCta title="A Laravel SaaS codebase agents can read" text="SaaS Laravel comes with Laravel Boost guidelines, skills and MCP config, a modular backend, Pest tests and Larastan, in Vue, React or Svelte." />
