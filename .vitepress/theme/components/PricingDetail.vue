<script setup lang="ts">
import { computed } from 'vue';
import {
  backendStack,
  formatPrice,
  frontendCommon,
  includedFeatures,
  kits,
  plans,
  requirements,
  site,
  type PlanKey,
} from '../../site';
import FrameworkLogo from './FrameworkLogo.vue';
import SlIcon from './SlIcon.vue';

const props = defineProps<{ plan: PlanKey }>();

const plan = computed(() => plans[props.plan]);
const planKits = computed(() => plan.value.frameworks.map((key) => kits[key]));
const isBundle = computed(() => planKits.value.length > 1);
const firstKit = computed(() => planKits.value[0]);
const savings = computed(() => planKits.value.reduce((total, kit) => total + kit.price, 0) - plan.value.price);
</script>

<template>
  <div class="detail">
    <section class="detail-hero">
      <div class="detail-glow" />
      <div class="sl-container">
        <a class="detail-back" href="/pricing.html"><span class="vpi-arrow-left" /> All plans</a>
        <div class="detail-logos">
          <span v-for="kit in planKits" :key="kit.key" class="detail-logo"><FrameworkLogo :name="kit.key" :size="28" /></span>
        </div>
        <h1 class="sl-h1">{{ plan.name }}</h1>
        <p class="sl-lead">{{ plan.tagline }}</p>
        <div class="detail-meta">
          <span class="detail-amount">{{ formatPrice(plan.price) }}</span>
          <span class="sl-badge sl-badge--brand detail-badge"><SlIcon name="infinity" :size="13" /> Lifetime Access</span>
          <span class="sl-badge sl-badge--success detail-badge"><SlIcon name="refresh" :size="13" /> Weekly Updates</span>
          <span v-if="isBundle && savings > 0" class="sl-badge sl-badge--warning detail-badge">Save {{ formatPrice(savings) }}</span>
        </div>
        <p class="detail-note">{{ site.paymentNote }}</p>
      </div>
    </section>

    <div class="sl-container detail-layout">
      <div class="detail-main">
        <section class="block">
          <h2 class="block-title"><SlIcon name="layers" :size="20" /> Technologies</h2>
          <div v-if="isBundle" class="tech-kits">
            <div v-for="kit in planKits" :key="kit.key" class="tech-kit">
              <div class="tech-kit-head"><FrameworkLogo :name="kit.key" :size="20" /> {{ kit.title }}</div>
              <ul>
                <li v-for="item in kit.stack.slice(0, 5)" :key="item.label">{{ item.value }}</li>
              </ul>
            </div>
          </div>
          <dl v-else class="tech-list">
            <div v-for="item in firstKit.stack" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
          <p class="block-sub">Shared by every kit</p>
          <div class="tags">
            <span v-for="item in frontendCommon" :key="item">{{ item }}</span>
            <span v-for="item in backendStack" :key="item.label">{{ item.value }}</span>
          </div>
        </section>

        <section class="block">
          <h2 class="block-title"><SlIcon name="package" :size="20" /> Included features</h2>
          <div class="features">
            <details v-for="(feature, index) in includedFeatures" :key="feature.title" class="feature" :open="index === 0">
              <summary class="feature-summary">
                <SlIcon name="check" :size="16" class="check" />
                <span class="feature-heading">
                  <b>{{ feature.title }}</b>
                  <span class="feature-text">{{ feature.text }}</span>
                </span>
                <span class="feature-count">{{ feature.points.length }}</span>
                <SlIcon name="chevron-down" :size="16" class="feature-chevron" />
              </summary>
              <ul class="feature-points">
                <li v-for="point in feature.points" :key="point">{{ point }}</li>
              </ul>
            </details>
          </div>
        </section>

        <section class="block">
          <h2 class="block-title"><SlIcon name="server" :size="20" /> Requirements</h2>
          <dl class="tech-list">
            <div v-for="item in requirements" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </section>

        <section class="block">
          <h2 class="block-title"><SlIcon name="git" :size="20" /> What you receive</h2>
          <p class="sl-text">
            Access to {{ isBundle ? 'each starter kit GitHub repository' : 'the starter kit GitHub repository' }} with the full source
            code — backend, frontend, tests and configuration:
          </p>
          <ul class="repos">
            <li v-for="kit in planKits" :key="kit.key">
              <FrameworkLogo :name="kit.key" :size="18" />
              <a :href="kit.repo" target="_blank" rel="noopener">{{ kit.repo.replace('https://', '') }}</a>
            </li>
          </ul>
          <p class="sl-text license-note">
            Licensed under the <a class="sl-link" href="/license.html">SaaS Laravel Commercial License</a> — use it in unlimited
            projects for you or your clients; reselling or publishing the source code is not allowed.
          </p>
        </section>

        <section class="block">
          <h2 class="block-title"><SlIcon name="refresh" :size="20" /> Update policy</h2>
          <p class="sl-text">
            Weekly updates are pushed to the kit {{ isBundle ? 'repositories' : 'repository' }}. You pull them into your own
            project whenever you are ready — nothing changes in your app until you merge. Updates are included for life with
            no renewal fee. <a class="sl-link" href="/docs/purchase/updates.html">How updates work →</a>
          </p>
        </section>

        <section class="block">
          <h2 class="block-title"><SlIcon name="users" :size="20" /> Access &amp; support</h2>
          <ul class="sl-checklist">
            <li>
              <SlIcon name="check" :size="16" class="check" />
              Repository access is granted automatically as soon as your GitHub Sponsors payment goes through. Sponsor from the
              GitHub account you want to be invited.
            </li>
            <li>
              <SlIcon name="check" :size="16" class="check" />
              You receive a GitHub invitation to the {{ isBundle ? 'repositories' : 'repository' }} — accept it to start cloning.
            </li>
            <li>
              <SlIcon name="check" :size="16" class="check" />
              Support happens on GitHub, through issues on the kit repository.
            </li>
          </ul>
        </section>
      </div>

      <aside class="detail-aside">
        <div class="sl-card summary">
          <p class="summary-name">{{ plan.name }}</p>
          <p class="summary-price">{{ formatPrice(plan.price) }} <small>one-time</small></p>
          <ul class="sl-checklist summary-list">
            <li><SlIcon name="check" :size="16" class="check" />Lifetime Access</li>
            <li><SlIcon name="check" :size="16" class="check" />Weekly Updates</li>
            <li v-for="benefit in plan.benefits" :key="benefit"><SlIcon name="check" :size="16" class="check" />{{ benefit }}</li>
          </ul>
          <a class="sl-btn sl-btn--primary sl-btn--block" :href="plan.sponsorUrl" target="_blank" rel="noopener">
            <SlIcon name="github" :size="16" /> Sponsor / Purchase on GitHub
          </a>
          <a class="summary-how" href="/how-to-pay.html">How to pay</a>
        </div>
      </aside>
    </div>

    <section id="purchase" class="sl-container purchase-wrap">
      <div class="purchase">
        <div>
          <h2 class="purchase-title">Get the {{ plan.name }} for {{ formatPrice(plan.price) }}</h2>
          <p class="purchase-text">
            {{ site.paymentNote }}. After payment, your GitHub account automatically gets access to
            {{ isBundle ? 'all three repositories' : 'the repository' }}.
          </p>
        </div>
        <div class="purchase-actions">
          <a class="sl-btn sl-btn--lg purchase-btn" :href="plan.sponsorUrl" target="_blank" rel="noopener">
            <SlIcon name="github" :size="16" /> Sponsor / Purchase on GitHub
          </a>
          <a class="purchase-link" href="/how-to-pay.html">Read how to pay →</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.license-note {
  margin-top: 16px;
  font-size: 14px;
}

.detail-hero {
  position: relative;
  padding: 48px 0 56px;
  overflow: hidden;
  border-bottom: 1px solid var(--sl-border);
}

.detail-glow {
  position: absolute;
  inset: -200px 0 auto;
  height: 600px;
  background: var(--sl-glow);
  pointer-events: none;
}

.detail-hero .sl-container {
  position: relative;
}

.detail-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 28px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.detail-back:hover {
  color: var(--vp-c-brand-1);
}

.detail-logos {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.detail-logo {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 1px solid var(--sl-border);
  border-radius: 14px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow-sm);
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 28px;
}

.detail-amount {
  margin-right: 8px;
  font-size: 48px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  background: var(--sl-gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.detail-badge {
  padding: 4px 10px;
  font-size: 12.5px;
}

.detail-note {
  margin-top: 16px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  align-items: start;
  gap: 48px;
  padding-top: 48px;
}

.block {
  padding: 32px 0;
  border-top: 1px solid var(--sl-border);
}

.block:first-child {
  padding-top: 0;
  border-top: 0;
}

.block-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}

.block-title :deep(.sl-icon) {
  color: var(--vp-c-brand-1);
}

.block-sub {
  margin: 20px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.tech-list {
  margin: 0;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius-sm);
  background: var(--sl-surface);
}

.tech-list div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 16px;
  border-top: 1px solid var(--sl-border);
  font-size: 14px;
}

.tech-list div:first-child {
  border-top: 0;
}

.tech-list dt {
  color: var(--vp-c-text-2);
}

.tech-list dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
  color: var(--vp-c-text-1);
}

.tech-kits {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.tech-kit {
  padding: 16px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius-sm);
  background: var(--sl-surface);
}

.tech-kit-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.tech-kit ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tags span {
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--vp-c-default-soft);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.features {
  overflow: hidden;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius-sm);
  background: var(--sl-surface);
}

.feature + .feature {
  border-top: 1px solid var(--sl-border);
}

.feature-summary {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  list-style: none;
  transition: background-color 0.2s ease;
}

.feature-summary::-webkit-details-marker {
  display: none;
}

.feature-summary:hover {
  background: var(--sl-surface-muted);
}

.feature-summary:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}

.feature-heading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.feature-heading b {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--vp-c-text-1);
}

.feature-text {
  font-size: 14px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.feature-count {
  flex-shrink: 0;
  margin-top: 2px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
  color: var(--vp-c-brand-1);
}

.feature-chevron {
  flex-shrink: 0;
  margin-top: 4px;
  color: var(--vp-c-text-3);
  transition: transform 0.2s ease;
}

.feature[open] .feature-chevron {
  transform: rotate(180deg);
}

.feature-points {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 24px;
  margin: 0;
  padding: 0 16px 16px 44px;
  list-style: none;
}

.feature-points li {
  position: relative;
  padding-left: 14px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.feature-points li::before {
  position: absolute;
  top: 0.62em;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  content: '';
}

@media (max-width: 640px) {
  .feature-points {
    grid-template-columns: 1fr;
    padding-left: 16px;
  }

  .feature-text {
    display: none;
  }
}

.check {
  margin-top: 3px;
  color: var(--sl-success);
}

.repos {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.repos li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius-sm);
  background: var(--sl-surface);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.repos a {
  color: var(--vp-c-brand-1);
}

.detail-aside {
  position: sticky;
  top: calc(var(--vp-nav-height) + 24px);
}

.summary {
  padding: 24px;
  box-shadow: var(--sl-shadow-lg);
}

.summary-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.summary-price {
  margin: 6px 0 18px;
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--vp-c-text-1);
}

.summary-price small {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--vp-c-text-3);
}

.summary-list {
  margin-bottom: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--sl-border);
}

.summary-list li {
  font-size: 14px;
}

.summary .sl-btn {
  padding: 0 14px;
  font-size: 14px;
  white-space: normal;
  text-align: center;
  line-height: 1.3;
}

.summary-how {
  display: block;
  margin-top: 12px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  color: var(--vp-c-text-2);
}

.summary-how:hover {
  color: var(--vp-c-brand-1);
}

.purchase-wrap {
  padding-top: 32px;
  padding-bottom: 64px;
}

.purchase {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  padding: 40px;
  border-radius: 24px;
  background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
  color: #fff;
  box-shadow: 0 32px 64px -32px rgba(67, 56, 202, 0.7);
}

.purchase > div:first-child {
  flex: 1 1 380px;
}

.purchase-title {
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.purchase-text {
  margin-top: 10px;
  max-width: 560px;
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
}

.purchase-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.purchase-btn {
  background: #fff;
  color: #3730a3;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.45);
}

.purchase-btn:hover {
  color: #3730a3;
  transform: translateY(-1px);
}

.purchase-link {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}

.purchase-link:hover {
  color: #fff;
}

@media (max-width: 960px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .detail-aside {
    position: static;
    order: -1;
  }
}

@media (max-width: 640px) {
  .tech-kits {
    grid-template-columns: 1fr;
  }

  .tech-list div {
    flex-direction: column;
    gap: 2px;
  }

  .tech-list dd {
    text-align: left;
  }

  .purchase {
    padding: 28px 20px;
  }

  .purchase-actions,
  .purchase-btn {
    width: 100%;
  }

  .purchase-btn {
    white-space: normal;
    text-align: center;
  }
}
</style>
