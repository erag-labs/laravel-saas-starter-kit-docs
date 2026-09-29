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

If your multi-tenant Laravel app finds the tenant from the subdomain, you need those subdomains on your laptop too: `acme.my-saas.test`, `globex.my-saas.test` and every other tenant you create while testing. Laravel Herd subdomains take care of most of that, because Herd serves a site's subdomains from the same project with no extra DNS work on your side.

Below we cover the setup, the `.env` values that matter, how HTTPS and Vite fit in, what to use when you aren't on Herd, and the mistakes that tend to eat the most time. For the server side of subdomain identification, read [how tenant identification works with subdomains](/blog/laravel-multi-tenancy-subdomains.html) first.

## Why subdomains are awkward locally

The default tools don't get you far. `/etc/hosts` has no wildcards, so you can map `acme.my-saas.test` to `127.0.0.1`, but you'll be adding a line for every tenant you create. And `php artisan serve` gives you `127.0.0.1:8000`. An IP address has no subdomains, so there's nowhere to put the tenant at all.

What you want is a local domain where the domain and all of its subdomains reach the same Laravel app, on the standard port.

## How Laravel Herd subdomains work

Herd serves projects on the `.test` top-level domain and resolves those names to your own machine. A project becomes a site in one of two ways:

| Method | Result |
| --- | --- |
| Put the project in a parked directory (`~/Herd` by default) | The folder name becomes the site, e.g. `my-saas.test` |
| Run `herd link` inside the project | The folder is served as `<folder-name>.test`, or as `<name>.test` with `herd link <name>` |

Subdomains of a site go to the same project. Once `my-saas.test` works, `acme.my-saas.test` hits the same `public/index.php`, with `acme.my-saas.test` as the request host. That's all tenant identification middleware needs: it reads the host and looks up the tenant.

## Setting up a tenant app on Herd

### 1. Link the site

```bash
cd ~/code/my-saas
herd link my-saas        # my-saas.test and its subdomains
```

The link name has to match the domain your app treats as central. If `.env` says `my-saas.test` but you linked the folder as `saas.test`, every request looks like an unknown host.

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

You could set `SESSION_DOMAIN=.my-saas.test` to share one session cookie across every subdomain. That's fine for a single app spread over subdomains. In a multi-tenant app it mixes tenant sessions together, so we leave it at `null`.

### 3. Create a tenant and open it

Create a tenant with the subdomain `acme` through your app, then open `http://acme.my-saas.test`. You don't need a hosts file entry or a restart.

## HTTPS with herd secure

Some features only work on a secure origin. The one you'll probably hit first is [passkeys (WebAuthn)](/blog/laravel-passkeys.html), which browsers refuse on plain `http` sites other than `localhost`.

```bash
herd secure my-saas      # issues a local certificate and serves https
herd unsecure my-saas    # back to http
```

Once the site is secured, change `APP_URL` to `https://my-saas.test`. Links built during a browser request follow that request, but emails sent from the queue use `APP_URL`, so they'd keep pointing at `http`.

::: tip Check a tenant over HTTPS
Valet-style certificates cover the site and its first-level subdomains (`*.my-saas.test`). After securing, open one tenant URL over `https` and make sure your browser trusts it before you start testing passkeys.
:::

## Vite and tenant subdomains

The Vite dev server runs on its own port, so a page on `acme.my-saas.test` loads its scripts from a different origin. `laravel-vite-plugin` handles most of this for you.

Start with CORS. The plugin's default allowed origins are `APP_URL`, any `http` or `https` origin ending in `.test`, and Vite's own defaults (`localhost`, `*.localhost`, `127.0.0.1`), so tenant subdomains on Herd are already covered. On any other domain, such as `nip.io`, only the `APP_URL` host is allowed, and you'll need to set `server.cors` in `vite.config` yourself.

Then there's TLS. When the site is secured, the plugin looks for a Herd or Valet certificate and serves Vite over HTTPS. It looks for a certificate named after the **project folder**, such as `my-saas.test`. If your folder name differs from the Herd link name, tell it which site to use:

```ts
laravel({
    input: ['resources/css/app.css', 'resources/js/app.ts'],
    refresh: true,
    detectTls: 'my-saas.test',
}),
```

## Alternatives to Herd

Herd is the simplest route, but any setup works as long as the domain and all of its subdomains reach your app.

| Option | Wildcards | Notes |
| --- | --- | --- |
| Laravel Valet (macOS) | Yes | Same `.test` approach with `valet link` and `valet secure` |
| dnsmasq + your own web server | Yes | Resolve `*.test` to `127.0.0.1`, then serve `my-saas.test` and `*.my-saas.test` from `public/` |
| `/etc/hosts` | No | One line per tenant; fine for two or three test tenants |
| `*.localhost` | Yes, in the browser | Chrome and Firefox resolve any `*.localhost` name to your machine; command-line tools may not |
| Public wildcard DNS such as `localtest.me` or `nip.io` | Yes | Names resolve to `127.0.0.1` through public DNS, so you need to be online |

With dnsmasq on macOS, two lines do the resolving: `address=/.test/127.0.0.1` in the dnsmasq config, and a file `/etc/resolver/test` containing `nameserver 127.0.0.1`. You still need a web server that answers for the wildcard host.

The public DNS services come in handy with Docker setups such as Laravel Sail, where `acme.127.0.0.1.nip.io` resolves to `127.0.0.1`. Some routers and DNS resolvers filter answers that point at private addresses, though. If the name doesn't resolve, try another network or resolver.

::: warning Mind the port
If your app runs on a port other than 80 or 443, every tenant URL needs that port. Apps that build tenant links from a stored domain (`https://acme.my-saas.test/path`) usually leave the port out, so those links break. Run the app on the standard ports wherever you can.
:::

## Where local tenant subdomains go wrong

Most problems come down to hosts and URLs that don't agree. Opening `127.0.0.1:8000` is the classic one: it isn't your central domain, so a tenancy-aware app treats it as an unknown tenant. Open `APP_URL` instead. The same thing happens more quietly when the Herd link name and `APP_DOMAIN` disagree, so keep the Herd site name, `APP_URL` and `APP_DOMAIN` in sync.

A few others we'd check before digging deeper:

- `APP_URL` still says `http` after `herd secure`, so emails and queued links point at the wrong scheme.
- `SESSION_DOMAIN` is shared across subdomains, and signing in to one tenant affects the others.
- Vite assets are blocked on tenant hosts. Check the CORS origins and the `detectTls` host described above.
- The config is cached. After changing `.env`, run `php artisan config:clear` if you cached the configuration.

Also think twice about the TLD. Avoid `.dev`, which browsers force onto HTTPS, and `.local`, which macOS uses for Bonjour. `.test` is reserved for exactly this kind of use.

## Frequently asked questions

### Do Laravel Herd subdomains need any configuration?

No. Once a site is linked or parked, its subdomains are served by the same project. The only configuration is in your app, mainly `APP_URL`, `APP_DOMAIN` and `SESSION_DOMAIN`.

### Why does my tenant subdomain return a 404 in Herd?

Usually the host doesn't match your configuration. Either the Herd link name differs from `APP_DOMAIN`, or the tenant's domain was stored with a different suffix. Compare the `domains` table with the host in your browser.

### Can I use Herd subdomains with Laravel Sail?

Herd and Sail are two separate ways to run the app. With Sail, use a wildcard DNS option such as dnsmasq, `*.localhost` or a public wildcard DNS service, and keep the app on port 80.

### Do I need HTTPS locally?

Only for features that need a secure origin, such as passkeys. `herd secure` gives you HTTPS in one command. Just remember to update `APP_URL` afterwards.

## How SaaS Laravel handles local development

The [SaaS Laravel starter kits](/) are set up and tested with Herd. The Vue kit's `.env.example` uses `APP_URL=http://vue.test`, `APP_DOMAIN=vue.test` and `SESSION_DOMAIN=null`, so `herd link vue` is all it takes to get `vue.test` and every `*.vue.test` tenant. Tenant links are built as `scheme://<domain>/path`, with the scheme taken from `APP_URL`, which is why the kits expect standard ports. If you'd rather start from there, the [local development guide](/docs/getting-started/local-development.html) covers the full first run, and the [Domains](/docs/core/domains.html) page explains how tenant subdomains are stored.

<BlogPostCta title="Tenant subdomains that work on day one" text="SaaS Laravel runs on Herd with wildcard tenant subdomains out of the box, and ships the same Laravel backend with Vue, React or Svelte." />
