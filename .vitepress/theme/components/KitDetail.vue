<script setup lang="ts">
import { computed } from 'vue';
import {
  backendStack,
  formatPrice,
  frameworkKeys,
  frontendCommon,
  kits,
  site,
  type FrameworkKey,
} from '../../site';
import CTASection from './CTASection.vue';
import FeatureGrid from './FeatureGrid.vue';
import FrameworkLogo from './FrameworkLogo.vue';
import SectionHeading from './SectionHeading.vue';
import SlIcon from './SlIcon.vue';

const props = defineProps<{ framework: FrameworkKey }>();

const kit = computed(() => kits[props.framework]);
const otherKits = computed(() => frameworkKeys.filter((key) => key !== props.framework).map((key) => kits[key]));

const included = computed(() => [
  'Complete Laravel + ' + kit.value.name + ' source code',
  'Access to the ' + kit.value.repoName + ' repository',
  'Weekly updates pushed to the repository',
  'Pest feature tests, Larastan and Pint configured',
  '17 languages with synced frontend translations',
  'Documentation for the backend and the ' + kit.value.name + ' frontend',
]);
</script>

<template>
  <div class="kit" :class="`kit--${framework}`">
    <section class="kit-hero">
      <div class="kit-glow" />
      <div class="sl-container kit-hero-inner">
        <div class="kit-copy sl-reveal">
          <nav class="kit-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a><span>/</span><a href="/#starter-kits">Starter Kits</a><span>/</span>{{ kit.name }}
          </nav>
          <span class="kit-logo"><FrameworkLogo :name="framework" :size="40" /></span>
          <h1 class="sl-h1">{{ kit.title }}</h1>
          <p class="sl-lead">{{ kit.summary }}</p>
          <div class="sl-actions">
            <a class="sl-btn sl-btn--primary sl-btn--lg" href="#features">
              Explore features <span class="vpi-arrow-right" />
            </a>
            <a class="sl-btn sl-btn--secondary sl-btn--lg" :href="`/docs/${framework}.html`">Read the {{ kit.name }} docs</a>
          </div>
        </div>
        <div class="sl-card kit-stack sl-reveal">
          <h2 class="kit-stack-title">{{ kit.name }} frontend stack</h2>
          <dl>
            <div v-for="item in kit.stack" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
          <div class="kit-common">
            <span v-for="item in frontendCommon" :key="item">{{ item }}</span>
          </div>
        </div>
      </div>
    </section>

    <FeatureGrid
      id="features"
      eyebrow="Features"
      title="Everything included in the kit"
      :lead="`Every backend feature ships with a complete ${kit.name} interface — pages, dialogs, forms and toasts.`"
    />

    <section class="sl-section">
      <div class="sl-container split">
        <div>
          <SectionHeading
            :center="false"
            eyebrow="Conventions"
            :title="`Idiomatic ${kit.name}`"
            :lead="`The ${kit.name} kit follows the conventions of its ecosystem, type-checked with ${kit.typeCheck}.`"
          />
          <dl class="conventions">
            <div v-for="item in kit.conventions" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd><code>{{ item.value }}</code></dd>
            </div>
          </dl>
        </div>
        <div>
          <p class="snippet-label">Translations in a component</p>
          <pre class="sl-code"><code>{{ kit.langImport }}</code></pre>
          <p class="snippet-label snippet-label--gap">Typed routes with Wayfinder</p>
          <pre class="sl-code"><code>import { index } from '@/routes/tenants'

index.url()</code></pre>
        </div>
      </div>
    </section>

    <section class="sl-section sl-section--muted">
      <div class="sl-container split">
        <div>
          <SectionHeading
            :center="false"
            eyebrow="Shared backend"
            title="The same Laravel backend in every kit"
            lead="The backend code is identical across the Vue, React and Svelte kits. Only resources/js changes."
          />
          <ul class="sl-checklist">
            <li v-for="item in included" :key="item">
              <SlIcon name="check" :size="16" class="kit-check" />{{ item }}
            </li>
          </ul>
        </div>
        <div class="sl-card backend">
          <dl>
            <div v-for="item in backendStack" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>

    <section class="sl-section others">
      <div class="sl-container">
        <p class="others-title">Prefer another frontend?</p>
        <div class="others-grid">
          <a v-for="other in otherKits" :key="other.key" :href="`/kits/${other.key}.html`" class="sl-card other">
            <FrameworkLogo :name="other.key" :size="28" />
            <span>
              <strong>{{ other.title }}</strong>
              <small>{{ other.tagline }}</small>
            </span>
            <span class="vpi-arrow-right other-arrow" />
          </a>
        </div>
      </div>
    </section>

    <CTASection
      :title="`Start building with ${kit.name}`"
      :text="`${formatPrice(kit.price)} one-time for the ${kit.title}, or ${formatPrice(site.bundlePrice)} for all three kits. Lifetime access with weekly updates.`"
      :primary-text="`Get the ${kit.name} kit`"
      :primary-link="`/pricing/${framework}.html`"
      secondary-text="Compare all plans"
      secondary-link="/pricing.html"
    />
  </div>
</template>

<style scoped>
.kit {
  --accent: var(--vp-c-brand-1);
}

.kit--vue {
  --accent: var(--sl-vue);
}

.kit--react {
  --accent: var(--sl-react);
}

.kit--svelte {
  --accent: var(--sl-svelte);
}

.kit-hero {
  position: relative;
  padding: 56px 0 88px;
  overflow: hidden;
}

.kit-glow {
  position: absolute;
  inset: -200px 0 auto;
  height: 700px;
  background: radial-gradient(50% 50% at 30% 30%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%),
    var(--sl-glow);
  pointer-events: none;
}

.kit-hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  align-items: center;
  gap: 56px;
}

.kit-crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 28px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.kit-crumbs a:hover {
  color: var(--vp-c-brand-1);
}

.kit-logo {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin-bottom: 24px;
  border: 1px solid var(--sl-border);
  border-radius: 20px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
}



.kit-stack {
  padding: 28px;
  box-shadow: var(--sl-shadow-lg);
  border-top: 3px solid var(--accent);
  animation-delay: 0.1s;
}

.kit-stack-title {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

dl {
  margin: 0;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  border-top: 1px solid var(--sl-border);
  font-size: 14px;
}

dt {
  color: var(--vp-c-text-2);
}

dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
  color: var(--vp-c-text-1);
}

.kit-common {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}

.kit-common span {
  padding: 3px 9px;
  border-radius: 7px;
  background: var(--vp-c-default-soft);
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 56px;
}

.split :deep(.sl-heading) {
  margin-bottom: 28px;
}

.conventions dd code {
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}

.snippet-label {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.snippet-label--gap {
  margin-top: 20px;
}

.kit-check {
  margin-top: 3px;
  color: var(--sl-success);
}

.backend {
  padding: 12px 24px;
}

.backend dl div:first-child {
  border-top: 0;
}

.others {
  padding-bottom: 32px;
}

.others-title {
  margin-bottom: 20px;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--vp-c-text-2);
}

.others-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  max-width: 820px;
  margin: 0 auto;
}

.other {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 22px;
  transition: transform 0.2s, border-color 0.2s;
}

.other:hover {
  transform: translateY(-2px);
  border-color: var(--sl-border-strong);
}

.other strong {
  display: block;
  font-size: 15px;
  color: var(--vp-c-text-1);
}

.other small {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.other-arrow {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--vp-c-text-3);
}

@media (max-width: 960px) {
  .kit-hero-inner,
  .split {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}

@media (max-width: 640px) {
  .others-grid {
    grid-template-columns: 1fr;
  }

  dl div {
    flex-direction: column;
    gap: 2px;
  }

  dd {
    text-align: left;
  }
}
</style>
