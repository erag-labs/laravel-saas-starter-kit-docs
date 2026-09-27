<script setup lang="ts">
import SectionHeading from './SectionHeading.vue';
import SlIcon, { type IconName } from './SlIcon.vue';

const items: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'terminal',
    title: 'Two commands to run',
    text: 'composer setup installs everything and builds assets. composer dev starts the server, queue, logs and Vite together.',
  },
  {
    icon: 'code',
    title: 'Typed routes and data',
    text: 'Wayfinder generates route functions in resources/js; Spatie Data classes are transformed into TypeScript types.',
  },
  {
    icon: 'flask',
    title: 'One command to verify',
    text: 'composer test runs linting, type checks and the Pest suite. composer lint fixes style across PHP and TypeScript.',
  },
  {
    icon: 'bot',
    title: 'Agent-friendly codebase',
    text: 'Laravel Boost ships guidelines and skills so AI coding agents understand the project from the first prompt.',
  },
];
</script>

<template>
  <section class="sl-section">
    <div class="sl-container dx">
      <div class="dx-copy">
        <SectionHeading
          :center="false"
          eyebrow="Developer experience"
          title="Clone it. Run it. Ship it."
          lead="Designed for Laravel Herd with *.test domains and wildcard subdomains, so tenant workspaces work locally without extra setup."
        />
        <div class="dx-items">
          <div v-for="item in items" :key="item.title" class="dx-item">
            <span class="dx-icon"><SlIcon :name="item.icon" :size="18" /></span>
            <div>
              <h3 class="sl-h3 dx-title">{{ item.title }}</h3>
              <p class="sl-text dx-text">{{ item.text }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="dx-terminal">
        <div class="dx-terminal-bar"><i /><i /><i /><span>~/code/my-saas</span></div>
        <pre class="dx-terminal-body"><code><span class="dim"># install dependencies, create .env, migrate, build</span>
<span class="prompt">$</span> composer setup
<span class="ok">✓</span> Application key set
<span class="ok">✓</span> Migrations complete
<span class="ok">✓</span> Assets built

<span class="dim"># server + queue + logs + vite</span>
<span class="prompt">$</span> composer dev
<span class="tag s">server</span> Server running on http://127.0.0.1:8000
<span class="tag q">queue</span>  Processing jobs from the [default] queue
<span class="tag l">logs</span>   Tailing application logs
<span class="tag v">vite</span>   VITE ready — local dev server

<span class="dim"># lint, type check and run the Pest suite</span>
<span class="prompt">$</span> composer test</code></pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dx {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 64px;
}

.dx-copy :deep(.sl-heading) {
  margin-bottom: 32px;
}

.dx-items {
  display: grid;
  gap: 20px;
}

.dx-item {
  display: flex;
  gap: 14px;
}

.dx-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.dx-title {
  font-size: 16px;
}

.dx-text {
  margin-top: 4px;
  font-size: 14.5px;
}

.dx-terminal {
  overflow: hidden;
  border-radius: var(--sl-radius);
  background: #0d0e1c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: var(--sl-shadow-lg);
}

.dx-terminal-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dx-terminal-bar i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
}

.dx-terminal-bar span {
  margin-left: 10px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: #8b90c0;
}

.dx-terminal-body {
  margin: 0;
  padding: 20px 22px 24px;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.75;
  color: #e3e6ff;
}

.dim {
  color: #6b70a3;
}

.prompt {
  color: #a78bfa;
}

.ok {
  color: #34d399;
}

.tag {
  display: inline-block;
  min-width: 52px;
  font-weight: 600;
}

.tag.s {
  color: #60a5fa;
}

.tag.q {
  color: #f472b6;
}

.tag.l {
  color: #fbbf24;
}

.tag.v {
  color: #a5b4fc;
}

@media (max-width: 960px) {
  .dx {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}
</style>
