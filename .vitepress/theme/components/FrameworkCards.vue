<script setup lang="ts">
import { frameworkKeys, kits, type FrameworkKey } from '../../site';
import FrameworkLogo from './FrameworkLogo.vue';
import SectionHeading from './SectionHeading.vue';
import SlIcon from './SlIcon.vue';

withDefaults(defineProps<{ heading?: boolean }>(), { heading: true });

const versions: Record<FrameworkKey, string> = { vue: 'Vue 3.5', react: 'React 19', svelte: 'Svelte 5' };
</script>

<template>
  <section id="starter-kits" class="sl-section">
    <div class="sl-container">
      <SectionHeading
        v-if="heading"
        eyebrow="Starter kits"
        title="Pick your frontend. Keep the same backend."
        lead="All three kits share an identical Laravel backend. Choose the frontend your team knows best — or get all three."
      />
      <div class="cards">
        <article v-for="key in frameworkKeys" :key="key" class="sl-card card" :class="`card--${key}`">
          <div class="card-top">
            <span class="card-logo"><FrameworkLogo :name="key" :size="30" /></span>
            <span class="card-version">{{ versions[key] }} · Inertia v3</span>
          </div>
          <h3 class="sl-h3">{{ kits[key].title }}</h3>
          <p class="sl-text">{{ kits[key].tagline }}</p>
          <ul class="sl-checklist card-list">
            <li v-for="item in kits[key].stack.slice(0, 4)" :key="item.label">
              <SlIcon name="check" :size="16" class="card-check" />
              <span><b>{{ item.label }}:</b> {{ item.value }}</span>
            </li>
          </ul>
          <div class="card-actions">
            <a class="sl-btn sl-btn--primary" :href="`/kits/${key}.html`">View Details</a>
            <a class="sl-btn sl-btn--secondary" :href="`/docs/${key}.html`">View Docs</a>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.card {
  --accent: var(--vp-c-brand-1);
  display: flex;
  flex-direction: column;
  padding: 28px;
  transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s;
}

.card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  border-radius: var(--sl-radius) var(--sl-radius) 0 0;
  background: var(--accent);
  opacity: 0.85;
}

.card--vue {
  --accent: var(--sl-vue);
}

.card--react {
  --accent: var(--sl-react);
}

.card--svelte {
  --accent: var(--sl-svelte);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--sl-shadow-lg);
  border-color: var(--sl-border-strong);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.card-logo {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 1px solid var(--sl-border);
  border-radius: 14px;
  background: var(--sl-surface-muted);
}

.card-version {
  padding: 4px 12px;
  border: 1px solid var(--sl-border);
  border-radius: 999px;
  background: var(--sl-surface-muted);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.card-list {
  margin: 20px 0 28px;
  flex-grow: 1;
}

.card-list li {
  font-size: 14px;
}

.card-list b {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.card-check {
  margin-top: 3px;
  color: var(--accent);
}

.card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.card-actions .sl-btn {
  padding: 0 12px;
}

@media (max-width: 960px) {
  .cards {
    grid-template-columns: 1fr;
    max-width: 560px;
    margin: 0 auto;
  }
}
</style>
