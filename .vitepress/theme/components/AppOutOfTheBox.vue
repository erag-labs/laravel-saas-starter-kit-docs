<script setup lang="ts">
import SlIcon, { type IconName } from './SlIcon.vue';

const ready = [
  'Multi-tenant workspaces with a database per tenant',
  'Authentication with two-factor codes and passkeys',
  'Admin dashboard with permission-aware menus',
  'Users, roles and permissions with queued invitations',
  'Profile, security, appearance and layout settings',
  '17 languages, chosen per user and per domain',
];

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: 'layout', title: 'Configurable layouts', text: 'Sidebar or header app layouts and card, simple or split sign-in pages.' },
  { icon: 'wrench', title: 'Fully customizable', text: 'All the code lives in your application, so you control everything.' },
  { icon: 'layers', title: 'Vue, React or Svelte', text: 'The same Laravel backend with the frontend you already know.' },
  { icon: 'zap', title: 'Tailwind CSS v4', text: 'Built with the latest Tailwind CSS utilities and design tokens.' },
  { icon: 'code', title: 'TypeScript supported', text: 'Typed routes with Wayfinder and types generated from Data classes.' },
  { icon: 'package', title: 'shadcn UI', text: 'shadcn-vue, shadcn/ui and shadcn-svelte components in every kit.' },
  { icon: 'git', title: 'Built-in CI workflow', text: 'A GitHub Actions workflow runs the test suite on pushes to main and on pull requests.' },
  { icon: 'sun', title: 'Light and dark', text: 'Light, dark and system appearance, remembered in the browser.' },
];
</script>

<template>
  <section id="features" class="sl-section box" aria-labelledby="out-of-the-box-title">
    <div class="box-glow" aria-hidden="true" />
    <div class="sl-container box-layout">
      <div class="box-intro">
        <p class="sl-eyebrow">Out of the box</p>
        <h2 id="out-of-the-box-title" class="sl-h2">An authenticated application out of the box</h2>
        <p class="sl-lead box-lead">Install a kit and start with a working product — not an empty Laravel project.</p>
        <p class="sl-text box-description">
          Every kit ships the same production-ready Laravel backend with a polished Vue, React or Svelte frontend. Sign-in,
          tenant management, users and settings already work end to end, so your first day goes into the features that make
          your product different.
        </p>
        <p class="box-ready-label">Ready on install</p>
        <ul class="box-ready">
          <li v-for="item in ready" :key="item">
            <span class="box-ready-check"><SlIcon name="check" :size="12" /></span>{{ item }}
          </li>
        </ul>
        <a class="sl-link box-link" href="/docs.html">Read the docs →</a>
      </div>

      <div class="box-grid">
        <div v-for="feature in features" :key="feature.title" class="box-card">
          <span class="box-icon"><SlIcon :name="feature.icon" :size="18" /></span>
          <h3 class="box-title">{{ feature.title }}</h3>
          <p class="box-text">{{ feature.text }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.box {
  position: relative;
  overflow: hidden;
  border-top: 1px solid var(--sl-border);
}

.box-glow {
  position: absolute;
  top: -180px;
  right: -120px;
  width: 620px;
  height: 620px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--vp-c-brand-soft), transparent 65%);
  pointer-events: none;
}

.box-layout {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  align-items: start;
  gap: 64px;
}

.box-intro .sl-eyebrow {
  display: flex;
  line-height: 1;
}

.box-lead {
  margin-top: 16px;
}

.box-description {
  margin-top: 14px;
  font-size: 15px;
  line-height: 1.7;
}

.box-ready-label {
  margin: 28px 0 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.box-ready {
  display: grid;
  gap: 12px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.box-ready li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: var(--vp-c-text-1);
}

.box-ready-check {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sl-gradient);
  color: #fff;
}

.box-link {
  display: inline-block;
  margin-top: 28px;
}

.box-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.box-card {
  position: relative;
  padding: 22px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow-sm);
  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}

.box-card:hover {
  border-color: var(--sl-border-strong);
  box-shadow: 0 12px 32px -16px rgba(79, 70, 229, 0.35);
  transform: translateY(-3px);
}

.box-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  transition:
    background 0.25s ease,
    color 0.25s ease;
}

.box-card:hover .box-icon {
  background: var(--sl-gradient);
  color: #fff;
}

.box-title {
  margin: 16px 0 0;
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--vp-c-text-1);
}

.box-text {
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

@media (max-width: 960px) {
  .box-layout {
    grid-template-columns: 1fr;
    gap: 40px;
  }

}

@media (max-width: 560px) {
  .box-grid {
    grid-template-columns: 1fr;
  }

  .box-glow {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .box-card,
  .box-icon {
    transition: none;
  }

  .box-card:hover {
    transform: none;
  }
}
</style>
