<script setup lang="ts">
import { frameworkKeys, kits } from '../../site';
import FrameworkLogo from './FrameworkLogo.vue';
import SectionHeading from './SectionHeading.vue';

const modules = ['Auth', 'Dashboard', 'Menu', 'RolePermission', 'Settings', 'Tenant', 'User'];
const packages = ['Fortify', 'stancl/tenancy', 'spatie/laravel-permission', 'spatie/laravel-data', 'Wayfinder'];
const sharedProps = ['auth', 'locale', 'languages', 'menus', 'layout', 'flash'];
</script>

<template>
  <section id="starter-kits" class="sl-section sl-section--muted">
    <div class="sl-container">
      <SectionHeading
        eyebrow="Architecture"
        title="Three frameworks. One backend."
        lead="The Laravel code is identical in every kit — only resources/js changes. Learn the backend once and move between frontends freely."
      />
      <div class="diagram">
        <div class="tier tier--backend">
          <div class="tier-head">
            <FrameworkLogo name="laravel" :size="26" />
            <div>
              <strong>Laravel 13 backend</strong>
              <span>Identical in all three kits</span>
            </div>
          </div>
          <div class="tier-label">Modules/</div>
          <div class="chips">
            <span v-for="module in modules" :key="module" class="chip chip--module">{{ module }}</span>
          </div>
          <div class="tier-label">Packages</div>
          <div class="chips">
            <span v-for="item in packages" :key="item" class="chip">{{ item }}</span>
          </div>
        </div>

        <div class="connector"><span /></div>

        <div class="tier tier--bridge">
          <strong>Inertia v3</strong>
          <span class="bridge-text">Server-side routing, shared props:</span>
          <div class="chips chips--center">
            <code v-for="prop in sharedProps" :key="prop">{{ prop }}</code>
          </div>
        </div>

        <div class="connector connector--split"><span /><span /><span /></div>

        <div class="frontends">
          <a v-for="key in frameworkKeys" :key="key" :href="`/kits/${key}.html`" class="tier tier--front" :class="`tier--${key}`">
            <FrameworkLogo :name="key" :size="28" />
            <strong>{{ kits[key].name }}</strong>
            <span>{{ kits[key].stack[2].value }}</span>
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.diagram {
  max-width: 880px;
  margin: 0 auto;
}

.tier {
  position: relative;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
}

.tier--backend {
  padding: 24px;
  border-color: rgba(255, 45, 32, 0.25);
}

.tier-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.tier-head strong {
  display: block;
  font-size: 17px;
  color: var(--vp-c-text-1);
}

.tier-head span {
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.tier-label {
  margin: 14px 0 8px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chips--center {
  justify-content: center;
}

.chip {
  padding: 5px 10px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--sl-surface-muted);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.chip--module {
  border-color: var(--sl-border-strong);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.connector {
  display: flex;
  justify-content: center;
  height: 44px;
}

.connector span {
  width: 2px;
  height: 100%;
  background: linear-gradient(var(--vp-c-brand-3), var(--sl-violet));
  background-size: 100% 200%;
  opacity: 0.6;
}

.connector--split {
  justify-content: space-between;
  padding: 0 calc(100% / 6 - 1px);
}

.tier--bridge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
  background: var(--sl-gradient);
  border: 0;
  color: #fff;
  box-shadow: 0 16px 40px -16px rgba(99, 102, 241, 0.7);
}

.tier--bridge strong {
  font-size: 18px;
}

.bridge-text {
  font-size: 13px;
  opacity: 0.85;
}

.tier--bridge code {
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.16);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: #fff;
}

.frontends {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.tier--front {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 22px 16px;
  text-align: center;
  text-decoration: none;
  transition: transform 0.2s, border-color 0.2s;
}

.tier--front:hover {
  transform: translateY(-3px);
  border-color: var(--sl-border-strong);
}

.tier--front strong {
  font-size: 16px;
  color: var(--vp-c-text-1);
}

.tier--front span {
  font-size: 12.5px;
  color: var(--vp-c-text-2);
}

.tier--vue {
  border-top: 3px solid var(--sl-vue);
}

.tier--react {
  border-top: 3px solid var(--sl-react);
}

.tier--svelte {
  border-top: 3px solid var(--sl-svelte);
}

@media (max-width: 640px) {
  .frontends {
    gap: 8px;
  }

  .tier--front {
    padding: 16px 8px;
  }

  .tier--front span {
    display: none;
  }
}
</style>
