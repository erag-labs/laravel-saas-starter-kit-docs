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

An AI coding agent can read your Laravel project, edit files and run commands. Sometimes the result is great, and sometimes it's confidently wrong. Whether AI coding works for you depends less on the agent and more on the codebase and the workflow around it. Below I'll walk through how I'd prepare a Laravel project, how to write tasks an agent can finish, how tests act as guardrails, and what I'd check before merging.

## Where agents help and where they need care

If you're wondering what to hand over first, pick tasks where the answer already exists somewhere in your code. Agents are good at repeating a pattern. They need the most supervision where a mistake is quiet: nothing crashes, but the behaviour is wrong.

| Usually a good fit | Needs close review |
| --- | --- |
| A new CRUD screen that mirrors an existing one | Authorization and policies |
| Form Requests, resources and data objects | Migrations on tables with production data |
| Pest tests for existing behaviour | Anything that switches tenant or database context |
| Renaming, moving and small refactors | Payments, emails and other side effects |
| Translation keys and UI copy | New Composer or npm dependencies |

Notice that the right-hand column isn't about how clever a model is. It's about how expensive a quiet mistake would be, and how easy it is for you to spot one in review.

## Setting up a Laravel codebase for AI coding

Every session, an agent starts out knowing nothing about your project. You fill that gap with context, and it helps to think of it in layers: a short rules file that always loads, longer skills that load when needed, and tools that let the agent look things up instead of guessing.

### A guidelines file

Most agents read a Markdown file in the project root when a session starts. Many tools use `AGENTS.md`; Claude Code uses `CLAUDE.md`. Keep it short and specific. A good test is to write down what a new developer would ask you in their first week:

```md
## Project rules
- Laravel 13, Inertia v3 with Vue, Pest 5. Check versions before using an API.
- Features live in Modules/<Name>. Controllers stay thin; logic goes in Services.
- Validation goes in Form Requests, never inline in controllers.
- Run `vendor/bin/pint` on changed PHP files.
- Never add a Composer or npm dependency without asking.
```

One thing that makes a real difference: say *why*. "Use Form Requests so validation is reusable and testable" gives the agent enough to handle a case your rule never mentioned. A bare command doesn't.

### Skills for the detail

It's tempting to put everything in that one file. I wouldn't, because it loads every session. Skills are the better home for long explanations. Each one is a folder with a `SKILL.md` file, and its `description` tells the agent when to open it. You might have one for testing, one for your frontend and one for multi-tenancy, and the agent only reads the detail when the task calls for it.

### MCP tools for facts

An agent that guesses a column name writes broken code. An MCP server lets it ask the application instead: the database schema, the route list, the last exception, documentation for the package versions you actually have installed. You don't need to build this yourself, because [Laravel Boost](/blog/laravel-boost-ai-agents.html) bundles guidelines, skills and an MCP server for Laravel in one package.

## Write tasks an agent can finish

When I see a bad result, the task was usually vague. A good one has a clear scope, points at an example and says how to check the result:

```text
Add an "archived" filter to the projects index page.
- Follow the existing "status" filter in ProjectController and Index.vue.
- Add the query logic to ProjectService, not the controller.
- Add a Pest feature test for the filter.
- Done when `php artisan test --filter=ProjectIndex` passes.
```

Keep it to one change per task. "Add the filter" and "redesign the table" sound related, but they're two tasks, and bundling them makes both harder to review. Naming a sibling file helps more than you'd expect, too: "do it like `UserController`" is worth a paragraph of written rules.

For anything bigger, ask for a plan first. Read it, correct it, and only then let the agent write code, since fixing a plan is much cheaper than fixing a diff. And when you move on to something unrelated, start a fresh session. Old context has a way of leaking into the new task.

## Tests and static analysis as guardrails for agents

Agents are fast at producing code that looks right. Automated checks tell you whether it *is* right, and the agent can run them itself and fix what fails.

| Check | Command | Catches |
| --- | --- | --- |
| Tests | `php artisan test --filter=...` | Wrong behaviour, broken flows |
| Static analysis | `vendor/bin/phpstan analyse` | Wrong types, missing methods, undefined properties |
| Code style | `vendor/bin/pint --test` | Formatting drift in PHP |
| Frontend | `npm run lint` and a type check | Broken imports, wrong props |

If you can only give an agent one contract, make it a feature test. It describes behaviour rather than implementation, so the agent has room to write the code its own way while still being held to the result:

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

Whatever your testing policy is, write it in the guidelines file. Some teams want every change tested and the affected tests run. Others would rather the agent leave tests to them. Either is fine; an unclear policy is what causes trouble. If you want more on the tools themselves, I'd read [testing a Laravel SaaS with Pest](/blog/laravel-saas-testing-pest.html) and the post on [Larastan and Pint for code quality](/blog/laravel-larastan-pint.html).

**An agent told to "make the tests pass" may change the test instead of the code.** Say explicitly that existing tests must not be deleted or weakened without asking.

## Reviewing agent output before you merge

Treat agent code like a pull request from a new teammate who works very fast. Read the diff, not the summary. Here's what I'd check:

- Authorization: every new route or action checks a policy, gate or permission.
- Validation: input goes through a Form Request, and there's no `$request->all()` passed to `create()`.
- Queries: no N+1 queries in loops, and eager loading wherever lists are rendered.
- Migrations: correct folder, a working `down()` method, and safe on tables that already hold data.
- Config: no `env()` calls outside `config/` files, because they return `null` once config is cached.
- Dependencies: no packages you didn't ask for, and lock files changed only when you expected them to.
- Tests: new behaviour is covered, and no existing test was deleted or loosened.
- Leftovers: no debug calls, commented-out code or stray files.

That list only stays realistic if the diffs are small. I'd take several small, reviewed commits over one big one that I end up skimming.

## Laravel traps agents fall into

A handful of mistakes come up again and again in Laravel projects specifically.

### Tenant context

In a multi-tenant app, code in a queued job, command or seeder may run without a tenant initialised, and then it quietly reads the central database. Show the agent how your app switches context, and turn that into a rule.

### Generated files

Typed routes, TypeScript types and translation JSON are all generated. An agent may edit them by hand, and the next generator run silently undoes the change. Tell it which commands regenerate each one.

### Architecture drift and outdated APIs

Without a rule, business logic creeps into controllers and models. If your code follows a [modular Laravel architecture](/blog/modular-laravel-architecture.html) with services, say so and link an example. Agents may also write code for an older Laravel or package version. Stating your versions in the guidelines, or giving the agent version-aware docs search, cuts this down a lot.

## Keeping an agent safe to work with

Work on a branch and commit often, so any change is one `git reset` away. Use the agent's permission settings, too: let it read files and run tests freely, but require approval for commands that install packages, delete files or touch the network.

Never put production credentials in a local `.env` the agent can read, and give database tools read-only access. Then review before you push. The agent writes the code, but you're still the one merging it.

## Frequently asked questions

### Do AI coding agents follow Laravel conventions?

They follow the conventions they can see. With no context, an agent falls back on general Laravel habits, and those may not match your project. Give it a guidelines file, a sibling file to copy and version-aware documentation, and the output lines up with your codebase much more closely.

### What should go in an AGENTS.md file for a Laravel project?

Your stack and versions, where code lives, the commands to test and lint, your architecture rules (thin controllers, services, Form Requests), your testing policy, and anything the agent must never do without asking, like adding dependencies. Keep it short and move the long how-tos into skills.

### Should I let an agent run migrations?

Locally, on a database you don't mind throwing away, it's usually fine and it speeds up the loop. Never let it run migrations against staging or production, though, and read every new migration yourself before it's merged.

### How do I stop an agent from changing too much at once?

Give it one clearly scoped task, name the files or modules it's allowed to touch, and ask for a plan before code on anything larger. Small diffs are easier for you to review and easier for the agent to get right.

## How SaaS Laravel supports AI coding

If you'd rather not set all of this up by hand, the [SaaS Laravel](/) kits already ship with Laravel Boost guidelines in `AGENTS.md` and `CLAUDE.md`, skills in `.agents/skills` and `.claude/skills`, and an MCP configuration. That means an agent knows the stack, the module structure and the testing tools from the first prompt. The Vue kit also includes project rules in `.ai/rules`. One thing to know: the two guideline files set different testing policies by default. You can align them as described in [AI agent rules about tests](/docs/core/testing.html#ai-agent-rules-about-tests).

<BlogPostCta title="A Laravel SaaS codebase agents can read" text="SaaS Laravel comes with Laravel Boost guidelines, skills and MCP config, a modular backend, Pest tests and Larastan, in Vue, React or Svelte." />
