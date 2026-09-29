---
title: "Laravel Boost: AI Coding Agents for Laravel"
description: "Laravel Boost gives AI coding agents real context on your app: what boost:install writes, guidelines, skills, the MCP tools and how to keep it all up to date."
pageClass: blog-page
date: 2026-09-29
author: erag
tags: [AI, Tooling]
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-boost-ai-agents.html
  - - meta
    - property: og:title
      content: "Laravel Boost: AI Coding Agents for Laravel"
  - - meta
    - property: og:description
      content: "Laravel Boost gives AI coding agents real context on your app: what boost:install writes, guidelines, skills, the MCP tools and how to keep it all up to date."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-boost-ai-agents.html
  - - meta
    - name: twitter:title
      content: "Laravel Boost: AI Coding Agents for Laravel"
  - - meta
    - name: twitter:description
      content: "Laravel Boost gives AI coding agents real context on your app: what boost:install writes, guidelines, skills, the MCP tools and how to keep it all up to date."
---

# Laravel Boost Explained: Guidelines, Skills and MCP Tools for AI Agents

<BlogPostMeta />

An AI coding agent only knows what it can see. **Laravel Boost** is Laravel's first-party package that gives agents the context they are missing: version-aware guidelines, task-specific skills and an MCP server that can read your routes, schema, logs and documentation. This post explains what Boost installs, which files it writes for each agent, how the MCP tools work and how to keep everything current.

## What Laravel Boost is

Boost is a dev dependency (`laravel/boost`, MIT licensed) with three parts that work together:

| Part | What it is | When the agent uses it |
| --- | --- | --- |
| Guidelines | A generated block of rules in `AGENTS.md` or `CLAUDE.md` | Every session, loaded up front |
| Skills | Folders with a `SKILL.md` file for one domain (Pest, Wayfinder, Fortify…) | On demand, when the task matches |
| MCP server | `php artisan boost:mcp`, exposing tools about your running app | Whenever the agent needs facts, not guesses |

The idea is simple. Guidelines keep the always-on context short. Skills hold the detail that only matters for some tasks. The MCP server answers questions that no static file can, such as "which columns does this table have?"

## Installing Laravel Boost

Install it as a dev dependency and run the installer:

```bash
composer require laravel/boost --dev
php artisan boost:install
```

The installer asks which agents you use and which features you want (guidelines, skills, MCP). It then detects your installed packages and writes the right files. Your choices are stored in `boost.json` so later updates repeat them:

```json
{
    "agents": ["claude_code", "codex", "junie"],
    "guidelines": true,
    "mcp": true,
    "skills": ["pest-testing", "wayfinder-development"]
}
```

## What boost:install writes for each agent

Each agent expects its files in a different place. Boost knows the defaults:

| Agent | Guidelines | Skills | MCP config |
| --- | --- | --- | --- |
| Claude Code | `CLAUDE.md` | `.claude/skills` | `.mcp.json` |
| Codex | `AGENTS.md` | `.agents/skills` | `.codex/config.toml` |
| Junie | `AGENTS.md` | `.junie/skills` | `.junie/mcp/mcp.json` |
| Cursor | `AGENTS.md` | `.cursor/skills` | `.cursor/mcp.json` |
| GitHub Copilot | `AGENTS.md` | `.github/skills` | `.vscode/mcp.json` |

Boost 2.x also supports Amp, Antigravity, Kiro, OpenCode, Zed and a few others. Each path can be overridden in `config/boost.php` under `boost.agents.<agent>`.

The MCP entry is the same idea everywhere: start the server with Artisan.

```json
{
    "mcpServers": {
        "laravel-boost": {
            "command": "php",
            "args": ["artisan", "boost:mcp"]
        }
    }
}
```

Junie is the exception: Boost writes absolute paths to PHP and `artisan` for it. Those paths are machine-specific, so check that file before you commit it.

## Guidelines: the always-on rules

Boost composes the guidelines from its own core rules plus a section for each package it detects: Laravel, PHP, Pest, Pint, Inertia, Wayfinder, Tailwind and so on. The result is wrapped in a `<laravel-boost-guidelines>` block.

That block matters. When Boost updates, it **replaces everything inside the block** and keeps anything you wrote outside it. So:

- Put team rules **above or below** the block, never inside it.
- Or add Markdown or Blade files to `.ai/guidelines/`. Boost includes them in the generated block for every agent.

Packages can ship their own guidelines too, in `resources/boost/guidelines`. Inertia and [Laravel Wayfinder](/blog/laravel-wayfinder-typed-routes.html) do this, which is why their rules appear once they are installed.

## Skills: detail on demand

A skill is a folder with a `SKILL.md` file. The frontmatter tells the agent when to load it:

```md
---
name: pest-testing
description: "Use this skill for Pest PHP testing in Laravel projects only..."
---

# Pest Testing
...
```

The agent reads only the `name` and `description` up front and opens the full file when a task matches. That keeps the context small while still giving deep, version-specific advice when it is needed.

Skills come from three places:

1. **Boost itself**, for example `infer-conventions`.
2. **Installed packages**, from `resources/boost/skills`. Fortify, Wayfinder, Pest and spatie/laravel-permission ship skills this way.
3. **Your own**, in `.ai/skills/<name>/SKILL.md`, or pulled from GitHub with `php artisan boost:add-skill owner/repo`.

Run `php artisan boost:list-skills` to see what is available. To keep a skill out of your agents' folders, list it in `boost.skills.exclude` in the config.

## The Laravel Boost MCP server and its tools

MCP (Model Context Protocol) lets an agent call tools that a server exposes. Boost's server runs inside your application, so its answers match your real code and database, not a generic Laravel app.

| Tool | What it gives the agent |
| --- | --- |
| `application-info` | PHP and Laravel versions, database engine, installed packages |
| `database-schema` | Tables, columns, indexes and foreign keys |
| `database-query` | Read-only SQL (`SELECT`, `SHOW`, `EXPLAIN`, `DESCRIBE`) |
| `database-connections` | The configured connection names |
| `search-docs` | Laravel ecosystem docs for your installed package versions |
| `last-error` / `read-log-entries` | The latest backend exception and log entries |
| `browser-logs` | Recent errors from the browser console |
| `get-absolute-url` | The correct scheme, host and port for a path or route |
| `record-rule` | Saves a project rule to `.ai/rules` |

`search-docs` is the one that pays off most. Agents often write code for an older version of a package. Searching docs that match your `composer.lock` avoids that. A `tinker` tool also exists, but it is disabled unless you set `boost.tinker_tool_enabled` to `true`.

Boost only switches on in the `local` environment or when `APP_DEBUG` is true, and you can turn it off completely with `BOOST_ENABLED=false`. It is not something that runs in production.

## Project rules with record-rule

Guidelines describe Laravel in general. **Project rules** describe your codebase: settled decisions, traps and constraints. Boost stores them as Markdown in `.ai/rules/`, with an `index.md` that maps file globs to rule files:

```md
| Applies to | Rule file |
| --- | --- |
| ** | .ai/rules/general.md |
```

When an agent learns something worth keeping, it can call `record-rule` with a glob, a title and a short note. Because the rules are committed, the next agent and your teammates inherit them. It is a shared memory that lives in the repository instead of in one person's chat history.

## Keeping Boost up to date

Guidelines and skills change as packages evolve. Refresh them with:

```bash
php artisan boost:update
```

It re-reads `boost.json`, regenerates the guideline block and syncs skills, and it asks about newly available guidelines or skills unless you pass `--no-discover`. Many projects run it in Composer's `post-update-cmd` so it happens after every `composer update`.

Review the diff afterwards, like any generated change. If you edited text inside the generated block, this is where it disappears.

## Tips for working with Laravel Boost

- **Commit the generated files.** Everyone on the team, and your CI agents, then work from the same context.
- **Keep guidelines short.** Everything in `AGENTS.md` or `CLAUDE.md` is loaded every session. Move long explanations into skills.
- **Align the files.** If you use several agents, make sure `AGENTS.md` and `CLAUDE.md` don't contradict each other on important rules such as testing.
- **Only install what you use.** Stale packages in `node_modules` or `vendor` can pull in guidelines for frameworks you don't use.

For how to work with agents day to day, such as sizing tasks and reviewing their output, see [using AI coding agents on a Laravel codebase](/blog/ai-coding-agents-laravel.html).

## Frequently asked questions

### Is Laravel Boost free?

Yes. `laravel/boost` is an open-source package under the MIT license. You install it with Composer as a dev dependency. The AI agent you connect to it may have its own pricing.

### Which AI agents work with Laravel Boost?

Boost 2.x writes files for Claude Code, Codex, Cursor, GitHub Copilot, Junie, Amp, Antigravity, Kiro, OpenCode, Zed and a few others. Any agent that reads `AGENTS.md` and supports MCP can use the guidelines and tools.

### Does Laravel Boost send my code or database anywhere?

The MCP server runs locally with `php artisan boost:mcp` and answers your agent's tool calls. What the agent does with those answers depends on the agent you use, so check its data policy. Keep production credentials out of your local `.env`.

### Can I edit AGENTS.md and CLAUDE.md after Boost generates them?

Yes, but only outside the `<laravel-boost-guidelines>` block, or through files in `.ai/guidelines/`. Text inside the block is replaced the next time you run `boost:update`.

## How SaaS Laravel uses Laravel Boost

Every [SaaS Laravel](/) kit ships with Boost already installed and configured for Claude Code, Codex, Junie and Antigravity. The kits include the generated `AGENTS.md` and `CLAUDE.md`, the MCP configuration, and skills for Fortify, Wayfinder, Pest, Inertia, Tailwind, laravel-data, stancl/tenancy and the translation package. `boost:update` runs after `composer update`. Note that the two guideline files set different testing rules by default, as explained in [AI agent rules about tests](/docs/core/testing.html#ai-agent-rules-about-tests). See where the files live in the [project structure](/docs/getting-started/project-structure.html).

<BlogPostCta title="An AI-ready Laravel SaaS codebase" text="SaaS Laravel ships Laravel Boost guidelines, skills and MCP config alongside multi-tenancy, Fortify auth and roles, in Vue, React or Svelte." />
