<script setup lang="ts">
import { site } from '../../site';
import SlIcon from './SlIcon.vue';

const columns: { title: string; links: { text: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'Product',
    links: [
      { text: 'Vue Starter Kit', href: '/kits/vue.html' },
      { text: 'React Starter Kit', href: '/kits/react.html' },
      { text: 'Svelte Starter Kit', href: '/kits/svelte.html' },
      { text: 'Pricing', href: '/pricing.html' },
    ],
  },
  {
    title: 'Documentation',
    links: [
      { text: 'Getting Started', href: '/docs.html' },
      { text: 'Local Development', href: '/docs/getting-started/local-development.html' },
      { text: 'Architecture', href: '/docs/core/architecture.html' },
      { text: 'FAQ', href: '/docs/reference/faq.html' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { text: 'GitHub', href: site.githubProfile, external: true },
      { text: 'Updates', href: '/docs/purchase/updates.html' },
    ],
  },
];

const year = new Date().getFullYear();
</script>

<template>
  <footer class="footer">
    <div class="sl-container footer-inner">
      <div class="footer-brand">
        <a href="/" class="footer-logo"><img src="/logo.svg" alt="" width="28" height="28" />{{ site.name }}</a>
        <p>Laravel SaaS starter kits for Vue, React and Svelte. {{ site.accessNote }}</p>
      </div>
      <nav v-for="column in columns" :key="column.title" class="footer-col" :aria-label="column.title">
        <h2>{{ column.title }}</h2>
        <ul>
          <li v-for="link in column.links" :key="link.text">
            <a
              :href="link.href"
              :target="link.external ? '_blank' : undefined"
              :rel="link.external ? 'noopener' : undefined"
            >{{ link.text }}</a>
          </li>
        </ul>
      </nav>
    </div>
    <div class="sl-container footer-bottom">
      <span>© {{ year }} {{ site.name }}</span>
      <a :href="site.githubProfile" target="_blank" rel="noopener" aria-label="GitHub"><SlIcon name="github" :size="20" /></a>
    </div>
    <div class="footer-wordmark" aria-hidden="true">{{ site.name }}</div>
  </footer>
</template>

<style scoped>
.footer {
  margin-top: 40px;
  padding: 64px 0 0;
  overflow: hidden;
  border-top: 1px solid var(--sl-border);
  background: var(--sl-surface-muted);
}

.footer-wordmark {
  margin-top: 40px;
  margin-bottom: -0.2em;
  background: var(--sl-gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  font-size: clamp(56px, 15vw, 210px);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.05em;
  text-align: center;
  white-space: nowrap;
  color: transparent;
  user-select: none;
}

.footer-inner {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: 40px;
}

.footer-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.footer-brand p {
  max-width: 320px;
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.footer-col h2 {
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vp-c-text-1);
}

.footer-col ul {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.footer-col a {
  font-size: 14px;
  color: var(--vp-c-text-2);
  transition: color 0.2s;
}

.footer-col a:hover {
  color: var(--vp-c-brand-1);
}

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--sl-border);
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.footer-bottom a {
  display: flex;
  color: var(--vp-c-text-2);
}

.footer-bottom a:hover {
  color: var(--vp-c-brand-1);
}

@media (max-width: 860px) {
  .footer-inner {
    grid-template-columns: repeat(3, 1fr);
  }

  .footer-brand {
    grid-column: 1 / -1;
  }
}

@media (max-width: 520px) {
  .footer-inner {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
