---
title: "Laravel Boost: AI Coding Agents for Laravel"
description: "Laravel Boost gives AI coding agents real context on your app: what boost:install writes, guidelines, skills, the MCP tools and how to keep it all up to date."
pageClass: blog-page
date: 2026-09-29
author: erag
category: tooling
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

An AI coding agent only knows what it can see, and in a Laravel app it usually can't see much: not your schema, not your package versions, not the error in the log. Laravel Boost is Laravel's first-party answer to that. It gives agents version-aware guidelines, task-specific skills and an MCP server that can read your routes, schema, logs and documentation. Here we go through what Boost installs, which files it writes for each agent, how the MCP tools work and how to keep it all current.

## What Laravel Boost is

Boost is a dev dependency (`laravel/boost`, MIT licensed) made of three parts that work together:

| Part | What it is | When the agent uses it |
| --- | --- | --- |
| Guidelines | A generated block of rules in `AGENTS.md` or `CLAUDE.md` | Every session, loaded up front |
| Skills | Folders with a `SKILL.md` file for one domain (Pest, Wayfinder, Fortify…) | On demand, when the task matches |
| MCP server | `php artisan boost:mcp`, exposing tools about your running app | Whenever the agent needs facts, not guesses |

The split makes sense once you see it. Guidelines keep the always-on context short, and skills hold the detail that only matters for some tasks. The MCP server covers questions no static file can answer, like "which columns does this table have?"

## Installing Laravel Boost

Add it as a dev dependency and run the installer:

```bash
composer require laravel/boost --dev
php artisan boost:install
```

The installer asks which agents you use and which features you want (guidelines, skills, MCP). Then it detects your installed packages and writes the matching files. Your answers go into `boost.json`, so later updates repeat the same choices:

```json
{
    "agents": ["claude_code", "codex", "junie"],
    "guidelines": true,
    "mcp": true,
    "skills": ["pest-testing", "wayfinder-development"]
}
```

## What boost:install writes for each agent

Every agent looks for its files somewhere different, and Boost knows the defaults:

| Agent | Guidelines | Skills | MCP config |
| --- | --- | --- | --- |
| Claude Code | `CLAUDE.md` | `.claude/skills` | `.mcp.json` |
| Codex | `AGENTS.md` | `.agents/skills` | `.codex/config.toml` |
| Junie | `AGENTS.md` | `.junie/skills` | `.junie/mcp/mcp.json` |
| Cursor | `AGENTS.md` | `.cursor/skills` | `.cursor/mcp.json` |
| GitHub Copilot | `AGENTS.md` | `.github/skills` | `.vscode/mcp.json` |

Boost 2.x also supports Amp, Antigravity, Kiro, OpenCode, Zed and a few others. You can override any of these paths in `config/boost.php` under `boost.agents.<agent>`.

The MCP entry looks much the same everywhere. It just starts the server with Artisan:

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

Junie is the odd one out. For Junie, Boost writes absolute paths to PHP and `artisan`, and those are specific to your machine, so look at that file before you commit it.

## Guidelines: the always-on rules

Boost builds the guidelines from its own core rules plus a section for each package it finds: Laravel, PHP, Pest, Pint, Inertia, Wayfinder, Tailwind and so on. The whole thing is wrapped in a `<laravel-boost-guidelines>` block.

Pay attention to that block. On every update, Boost **replaces everything inside the block** and leaves anything outside it alone. That gives you two safe places for your own rules. You can write team rules above or below the block (never inside it), or you can drop Markdown or Blade files into `.ai/guidelines/`, which Boost then includes in the generated block for every agent. We prefer the `.ai/guidelines/` route when a team uses more than one agent, since the rules end up in every agent's file.

Packages can ship guidelines of their own in `resources/boost/guidelines`. Inertia and [Laravel Wayfinder](/blog/laravel-wayfinder-typed-routes.html) both do, which is why their rules show up as soon as they're installed.

## Skills: detail on demand

A skill is a folder containing a `SKILL.md` file. Its frontmatter tells the agent when to load it:

```md
---
name: pest-testing
description: "Use this skill for Pest PHP testing in Laravel projects only..."
---

# Pest Testing
...
```

Up front, the agent reads only the `name` and `description`. It opens the full file when a task matches, so the context stays small but the agent still gets deep, version-specific advice when it needs it.

Some skills come with Boost itself, such as `infer-conventions`. Others come from installed packages via `resources/boost/skills`; Fortify, Wayfinder, Pest and spatie/laravel-permission all ship skills this way. You can also write your own in `.ai/skills/<name>/SKILL.md`, or pull one from GitHub with `php artisan boost:add-skill owner/repo`.

`php artisan boost:list-skills` shows what's available. If you want to keep a skill out of your agents' folders, list it in `boost.skills.exclude` in the config.

## The Laravel Boost MCP server and its tools

MCP (Model Context Protocol) lets an agent call tools that a server exposes. Boost's server runs inside your application, so the answers reflect your real code and database rather than some generic Laravel app.

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

If we had to pick one, it'd be `search-docs`. Agents often write code for an older version of a package, and searching docs that match your `composer.lock` avoids that. There's also a `tinker` tool, but it stays disabled unless you set `boost.tinker_tool_enabled` to `true`.

Boost only switches on in the `local` environment or when `APP_DEBUG` is true, and `BOOST_ENABLED=false` turns it off entirely. It's not something that runs in production.

## Project rules with record-rule

Guidelines describe Laravel in general. Project rules describe your codebase: decisions you've settled, traps, constraints. Boost keeps them as Markdown in `.ai/rules/`, with an `index.md` that maps file globs to rule files:

```md
| Applies to | Rule file |
| --- | --- |
| ** | .ai/rules/general.md |
```

When an agent learns something worth keeping, it can call `record-rule` with a glob, a title and a short note. The rules are committed, so the next agent and your teammates inherit them. Think of it as shared memory that lives in the repository instead of in one person's chat history.

## Keeping Boost up to date

Guidelines and skills change as packages evolve. To refresh them, run:

```bash
php artisan boost:update
```

This re-reads `boost.json`, regenerates the guideline block and syncs skills. It also asks about newly available guidelines or skills unless you pass `--no-discover`. Plenty of projects put it in Composer's `post-update-cmd` so it runs after every `composer update`.

Review the diff afterwards, as you would any generated change. If someone edited text inside the generated block, this is the moment it vanishes.

## Tips for working with Laravel Boost

Commit the generated files. That way everyone on the team, and your CI agents, work from the same context.

Keep guidelines short, because everything in `AGENTS.md` or `CLAUDE.md` is loaded in every session. Long explanations belong in skills. If you use several agents, also check that `AGENTS.md` and `CLAUDE.md` don't contradict each other on important rules such as testing.

And only install what you actually use. Stale packages in `node_modules` or `vendor` can pull in guidelines for frameworks you've long since dropped.

For the day-to-day side of working with agents, like sizing tasks and reviewing their output, see [using AI coding agents on a Laravel codebase](/blog/ai-coding-agents-laravel.html).

## Frequently asked questions

### Is Laravel Boost free?

Yes. `laravel/boost` is an open-source package under the MIT license, installed with Composer as a dev dependency. The AI agent you connect to it may have its own pricing.

### Which AI agents work with Laravel Boost?

Boost 2.x writes files for Claude Code, Codex, Cursor, GitHub Copilot, Junie, Amp, Antigravity, Kiro, OpenCode, Zed and a few others. Any agent that reads `AGENTS.md` and supports MCP can use the guidelines and tools.

### Does Laravel Boost send my code or database anywhere?

The MCP server runs locally with `php artisan boost:mcp` and answers your agent's tool calls. What the agent then does with those answers depends on the agent, so check its data policy. And keep production credentials out of your local `.env`.

### Can I edit AGENTS.md and CLAUDE.md after Boost generates them?

Yes, as long as you stay outside the `<laravel-boost-guidelines>` block or use files in `.ai/guidelines/`. Anything inside the block is replaced the next time you run `boost:update`.

## How SaaS Laravel uses Laravel Boost

If you'd rather skip the setup, every [SaaS Laravel](/) kit already has Boost installed and configured for Claude Code, Codex, Junie and Antigravity. The kits include the generated `AGENTS.md` and `CLAUDE.md`, the MCP configuration, and skills for Fortify, Wayfinder, Pest, Inertia, Tailwind, laravel-data, stancl/tenancy and the translation package, and `boost:update` runs after `composer update`. One thing to know: the two guideline files set different testing rules by default, as explained in [AI agent rules about tests](/docs/core/testing.html#ai-agent-rules-about-tests). The [project structure](/docs/getting-started/project-structure.html) page shows where the files live.

<BlogPostCta title="An AI-ready Laravel SaaS codebase" text="SaaS Laravel ships Laravel Boost guidelines, skills and MCP config alongside multi-tenancy, Fortify auth and roles, in Vue, React or Svelte." />
