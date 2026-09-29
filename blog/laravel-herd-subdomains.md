---
title: "Local Laravel Subdomains with Laravel Herd"
description: "Set up Laravel Herd subdomains for a multi-tenant app: .test domains, herd link and herd secure, APP_URL and SESSION_DOMAIN, alternatives and common pitfalls."
date: 2026-09-29
author: erag
category: saas
tags: [Local development, Multi-tenancy]
pageClass: blog-page
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/blog/laravel-herd-subdomains.html
  - - meta
    - property: og:title
      content: "Local Laravel Subdomains with Laravel Herd"
  - - meta
    - property: og:description
      content: "Set up Laravel Herd subdomains for a multi-tenant app: .test domains, herd link and herd secure, APP_URL and SESSION_DOMAIN, alternatives and common pitfalls."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/blog/laravel-herd-subdomains.html
  - - meta
    - name: twitter:title
      content: "Local Laravel Subdomains with Laravel Herd"
  - - meta
    - name: twitter:description
      content: "Set up Laravel Herd subdomains for a multi-tenant app: .test domains, herd link and herd secure, APP_URL and SESSION_DOMAIN, alternatives and common pitfalls."
---

# Local Laravel Subdomains with Laravel Herd: A Multi-Tenant Dev Setup

<BlogPostMeta />

A multi-tenant Laravel app that identifies tenants by subdomain needs those subdomains on your laptop too: `acme.my-saas.test`, `globex.my-saas.test` and every tenant you create while testing. **Laravel Herd subdomains** make this almost effortless, because Herd serves a site's subdomains without any extra DNS work.

This guide shows how to set it up, which `.env` values matter, how HTTPS and Vite fit in, what to use if you are not on Herd, and the pitfalls that cost the most time. For how subdomain identification works on the server side, read [Laravel Multi-Tenancy with Subdomains](/blog/laravel-multi-tenancy-subdomains.html).

## Why subdomains are awkward locally

Two things usually get in the way:

- **`/etc/hosts` has no wildcards.** You can map `acme.my-saas.test` to `127.0.0.1`, but you have to add a line for every tenant you create.
- **`php artisan serve` gives you `127.0.0.1:8000`.** An IP address has no subdomains, so there is nowhere to put the tenant.

What you actually want is a local domain where **the domain and all of its subdomains** reach the same Laravel app, on the standard port.

## How Laravel Herd subdomains work

Herd serves your projects on the `.test` top-level domain and resolves those names to your own machine. There are two ways a project becomes a site:

| Method | Result |
| --- | --- |
| Put the project in a parked directory (`~/Herd` by default) | The folder name becomes the site, e.g. `my-saas.test` |
| Run `herd link` inside the project | The folder is served as `<folder-name>.test`, or as `<name>.test` with `herd link <name>` |

Subdomains of a site are served by the same project. Once `my-saas.test` works, `acme.my-saas.test` reaches the same `public/index.php`, with `acme.my-saas.test` as the request host. That is exactly what tenant identification middleware needs: it reads the host and looks up the tenant.

## Step by step

### 1. Link the site

```bash
cd ~/code/my-saas
herd link my-saas        # my-saas.test and its subdomains
```

The link name must match the domain your app treats as central. If your `.env` says `my-saas.test` but you linked the folder as `saas.test`, every request looks like an unknown host.

### 2. Set the environment

```dotenv
APP_URL=http://my-saas.test
APP_DOMAIN=my-saas.test
SESSION_DOMAIN=null
```

| Key | What it does locally |
| --- | --- |
| `APP_URL` | Base URL used when Laravel builds links outside a request: queued emails, notifications, Artisan commands |
| `APP_DOMAIN` | Not a Laravel default. Many multi-tenant apps add it and use it in `central_domains` and to build `<subdomain>.APP_DOMAIN` |
| `SESSION_DOMAIN` | `null` gives each host its own session cookie, so tenants stay signed in separately |

Setting `SESSION_DOMAIN=.my-saas.test` shares one session cookie across every subdomain. That suits a single app spread over subdomains, but in a multi-tenant app it mixes tenant sessions together.

### 3. Create a tenant and open it

Create a tenant with the subdomain `acme` through your app, then open `http://acme.my-saas.test`. No hosts file entry, no restart.

## HTTPS with herd secure

Some features only work on a secure origin. [Passkeys](/blog/laravel-passkeys.html) (WebAuthn) are the common one: browsers refuse them on plain `http` sites other than `localhost`.

```bash
herd secure my-saas      # issues a local certificate and serves https
herd unsecure my-saas    # back to http
```

After securing the site, update `APP_URL` to `https://my-saas.test`. Links built inside a browser request follow that request, but emails sent from the queue use `APP_URL` and would still point at `http`.

::: tip Check a tenant over HTTPS
Valet-style certificates cover the site and its first-level subdomains (`*.my-saas.test`). Open one tenant URL over `https` after securing, to confirm your browser trusts it before you start testing passkeys.
:::

## Vite and tenant subdomains

The Vite dev server runs on its own port, so a page on `acme.my-saas.test` loads scripts from a different origin. `laravel-vite-plugin` handles most of this for you.

**CORS.** Its default allowed origins are `APP_URL`, any `http` or `https` origin ending in `.test`, and Vite's own defaults (`localhost`, `*.localhost`, `127.0.0.1`). Tenant subdomains on Herd are covered. On any other domain, such as `nip.io`, only the `APP_URL` host is allowed, so set `server.cors` in `vite.config` yourself.

**TLS.** When the site is secured, the plugin looks for a Herd or Valet certificate and serves Vite over HTTPS. It looks for a certificate named after the **project folder**, such as `my-saas.test`. If the folder name differs from the Herd link name, tell it which site to use:

```ts
laravel({
    input: ['resources/css/app.css', 'resources/js/app.ts'],
    refresh: true,
    detectTls: 'my-saas.test',
}),
```

## Alternatives to Herd

Herd is the simplest option, but any setup works as long as the domain **and all of its subdomains** reach your app.

| Option | Wildcards | Notes |
| --- | --- | --- |
| Laravel Valet (macOS) | Yes | Same `.test` approach with `valet link` and `valet secure` |
| dnsmasq + your own web server | Yes | Resolve `*.test` to `127.0.0.1`, then serve `my-saas.test` and `*.my-saas.test` from `public/` |
| `/etc/hosts` | No | One line per tenant; fine for two or three test tenants |
| `*.localhost` | Yes, in the browser | Chrome and Firefox resolve any `*.localhost` name to your machine; command-line tools may not |
| Public wildcard DNS such as `localtest.me` or `nip.io` | Yes | Names resolve to `127.0.0.1` through public DNS, so you need to be online |

For dnsmasq on macOS, two lines do the resolving: `address=/.test/127.0.0.1` in the dnsmasq config, and a file `/etc/resolver/test` containing `nameserver 127.0.0.1`. You still need a web server that answers for the wildcard host.

The public DNS services are handy with Docker setups such as Laravel Sail: `acme.127.0.0.1.nip.io` resolves to `127.0.0.1`. Some routers and DNS resolvers filter answers that point at private addresses, so if the name does not resolve, try another network or resolver.

::: warning Mind the port
If your app runs on a port other than 80 or 443, every tenant URL needs that port. Apps that build tenant links from a stored domain (`https://acme.my-saas.test/path`) usually leave the port out, so those links break. Run the app on the standard ports where you can.
:::

## Common pitfalls

- **Opening `127.0.0.1:8000`.** It is not your central domain, so a tenancy-aware app treats it as an unknown tenant. Open `APP_URL` instead.
- **Link name and `APP_DOMAIN` disagree.** Keep the Herd site name, `APP_URL` and `APP_DOMAIN` in sync.
- **`APP_URL` still on `http` after `herd secure`.** Emails and queued links point at the wrong scheme.
- **A shared `SESSION_DOMAIN`.** Signing in to one tenant affects the others.
- **Vite assets blocked on tenant hosts.** Check the CORS origins and the `detectTls` host described above.
- **Cached config.** After changing `.env`, run `php artisan config:clear` if you cached the configuration.
- **Choosing another TLD.** Avoid `.dev`, which browsers force onto HTTPS, and `.local`, which macOS uses for Bonjour. `.test` is reserved for exactly this use.

## Frequently asked questions

### Do Laravel Herd subdomains need any configuration?

No. Once a site is linked or parked, its subdomains are served by the same project. You only configure your app, mainly `APP_URL`, `APP_DOMAIN` and `SESSION_DOMAIN`.

### Why does my tenant subdomain return a 404 in Herd?

Usually the host does not match your configuration: the Herd link name differs from `APP_DOMAIN`, or the tenant's domain was stored with a different suffix. Check the `domains` table against the host in the browser.

### Can I use Herd subdomains with Laravel Sail?

Herd and Sail are separate ways to run the app. With Sail, use a wildcard DNS option such as dnsmasq, `*.localhost` or a public wildcard DNS service, and keep the app on port 80.

### Do I need HTTPS locally?

Only for features that require a secure origin, such as passkeys. `herd secure` gives you HTTPS in one command; remember to update `APP_URL` afterwards.

## How SaaS Laravel handles local development

The [SaaS Laravel starter kits](/) are set up and tested with Herd. The Vue kit's `.env.example` uses `APP_URL=http://vue.test`, `APP_DOMAIN=vue.test` and `SESSION_DOMAIN=null`, so `herd link vue` is all you need for `vue.test` and every `*.vue.test` tenant. Tenant links are built as `scheme://<domain>/path`, with the scheme taken from `APP_URL`, which is why the kits expect standard ports. The [local development guide](/docs/getting-started/local-development.html) covers the full first run, and the [Domains](/docs/core/domains.html) page explains how tenant subdomains are stored.

<BlogPostCta title="Tenant subdomains that work on day one" text="SaaS Laravel runs on Herd with wildcard tenant subdomains out of the box, and ships the same Laravel backend with Vue, React or Svelte." />
