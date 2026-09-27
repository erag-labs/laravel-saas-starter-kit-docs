<script setup lang="ts">
import { site } from '../../site';
import FrameworkLogo from './FrameworkLogo.vue';
import MockTenantList from './MockTenantList.vue';
import SlIcon from './SlIcon.vue';

const highlights = ['Multi-tenancy', 'Auth & passkeys', 'Roles & permissions', '17 languages'];
</script>

<template>
  <section class="hero">
    <div class="hero-glow" />
    <div class="hero-grid-bg" />
    <div class="sl-container hero-inner">
      <div class="hero-copy sl-reveal">
        <a href="/pricing.html" class="sl-pill hero-pill">
          <span class="hero-pill-dot" />{{ site.accessNote }}
          <span class="vpi-arrow-right hero-pill-arrow" />
        </a>
        <h1 class="sl-h1">
          Build Laravel SaaS Products <span class="sl-gradient-text">Faster</span>
        </h1>
        <p class="sl-lead">
          Production-ready Laravel 13 starter kits with multi-tenancy, authentication, roles &amp; permissions and
          localization — built on one shared backend with a Vue, React or Svelte frontend.
        </p>
        <div class="sl-actions hero-actions">
          <a class="sl-btn sl-btn--primary sl-btn--lg" href="#starter-kits">
            View Starter Kits <span class="vpi-arrow-right" />
          </a>
          <a class="sl-btn sl-btn--secondary sl-btn--lg" href="/docs.html">Read Documentation</a>
        </div>
        <ul class="hero-highlights">
          <li v-for="item in highlights" :key="item"><SlIcon name="check" :size="16" />{{ item }}</li>
        </ul>
        <div class="hero-frameworks">
          <span>Available for</span>
          <a href="/kits/vue.html" aria-label="Vue Starter Kit"><FrameworkLogo name="vue" :size="22" /></a>
          <a href="/kits/react.html" aria-label="React Starter Kit"><FrameworkLogo name="react" :size="22" /></a>
          <a href="/kits/svelte.html" aria-label="Svelte Starter Kit"><FrameworkLogo name="svelte" :size="22" /></a>
        </div>
      </div>
      <div class="hero-visual sl-reveal">
        <MockTenantList />
        <div class="hero-toast">
          <span class="hero-toast-icon"><SlIcon name="check" :size="14" /></span>
          Tenant created successfully.
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  padding: 72px 0 96px;
  overflow: hidden;
}

.hero-glow {
  position: absolute;
  inset: -160px 0 auto;
  height: 720px;
  background: var(--sl-glow);
  pointer-events: none;
}

.hero-grid-bg {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(var(--sl-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--sl-border) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 75%);
  opacity: 0.6;
  pointer-events: none;
}

.hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  align-items: center;
  gap: 56px;
}

.hero-pill {
  margin-bottom: 24px;
  text-decoration: none;
  transition: border-color 0.2s;
}

.hero-pill:hover {
  border-color: var(--sl-border-strong);
}

.hero-pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sl-success);
  box-shadow: 0 0 0 3px var(--sl-success-soft);
}

.hero-pill-arrow {
  width: 14px;
  height: 14px;
}

.hero-actions {
  margin-top: 32px;
}

.hero-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 28px 0 0;
  padding: 0;
  list-style: none;
}

.hero-highlights li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.hero-highlights :deep(.sl-icon) {
  color: var(--sl-success);
}

.hero-frameworks {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--sl-border);
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.hero-frameworks a {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  background: var(--sl-surface);
  transition: transform 0.2s, border-color 0.2s;
}

.hero-frameworks a:hover {
  transform: translateY(-2px);
  border-color: var(--sl-border-strong);
}

.hero-visual {
  position: relative;
  animation-delay: 0.12s;
}

.hero-toast {
  position: absolute;
  right: -12px;
  bottom: -22px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid var(--sl-border);
  border-radius: 12px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow-lg);
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  animation: toast-in 0.6s 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.hero-toast-icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--sl-success-soft);
  color: var(--sl-success);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 960px) {
  .hero {
    padding: 48px 0 72px;
  }

  .hero-inner {
    grid-template-columns: 1fr;
    gap: 48px;
  }

  .hero-toast {
    right: 12px;
  }
}

@media (max-width: 480px) {
  .hero-actions .sl-btn {
    width: 100%;
  }
}
</style>
