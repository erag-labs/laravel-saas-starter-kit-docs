<script setup lang="ts">
import { formatPrice, planOrder, plans, site } from '../../site';
import FrameworkLogo from './FrameworkLogo.vue';
import SectionHeading from './SectionHeading.vue';
import SlIcon from './SlIcon.vue';

withDefaults(defineProps<{ primary?: boolean }>(), { primary: false });
</script>

<template>
  <section id="pricing" class="sl-section pricing" :class="{ 'pricing--primary': primary }">
    <div class="pricing-glow" />
    <div class="sl-container">
      <SectionHeading
        :as="primary ? 'h1' : 'h2'"
        eyebrow="Pricing"
        title="Simple, one-time pricing"
        lead="Pay once and keep access to your kit's repository for life — including every weekly update."
      />
      <div class="plans">
        <article
          v-for="key in planOrder"
          :key="key"
          class="sl-card plan"
          :class="{ 'plan--featured': plans[key].featured }"
        >
          <span v-if="plans[key].featured" class="plan-ribbon">Best value</span>
          <div class="plan-logos">
            <span v-for="framework in plans[key].frameworks" :key="framework" class="plan-logo">
              <FrameworkLogo :name="framework" :size="20" />
            </span>
          </div>
          <h3 class="plan-name">{{ plans[key].name }}</h3>
          <p class="plan-tagline">{{ plans[key].tagline }}</p>
          <p class="plan-price">
            <span class="plan-amount">{{ formatPrice(plans[key].price) }}</span>
            <span class="plan-term">one-time</span>
          </p>
          <ul class="sl-checklist plan-list">
            <li><SlIcon name="infinity" :size="16" class="plan-check" /><b>Lifetime Access</b></li>
            <li><SlIcon name="refresh" :size="16" class="plan-check" /><b>Weekly Updates</b></li>
            <li v-for="benefit in plans[key].benefits" :key="benefit">
              <SlIcon name="check" :size="16" class="plan-check" />{{ benefit }}
            </li>
          </ul>
          <a
            class="sl-btn sl-btn--block"
            :class="plans[key].featured ? 'sl-btn--primary' : 'sl-btn--secondary'"
            :href="plans[key].href"
          >
            View details<span class="sl-sr-only"> for the {{ plans[key].name }}</span> <span class="vpi-arrow-right" />
          </a>
        </article>
      </div>
      <p class="pricing-note">
        <SlIcon name="shield" :size="16" />
        {{ site.paymentNote }}
      </p>
      <p class="pricing-sub">
        Payment is made through GitHub Sponsors. <a class="sl-link" href="/how-to-pay.html">See how to pay →</a>
      </p>
    </div>
  </section>
</template>

<style scoped>
.pricing {
  overflow: hidden;
}

.pricing-glow {
  position: absolute;
  inset: 0 0 auto;
  height: 520px;
  background: var(--sl-glow);
  pointer-events: none;
}

.pricing--primary {
  padding-top: 64px;
}

.pricing .sl-container {
  position: relative;
}

.plans {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: stretch;
  gap: 20px;
}

.plan {
  display: flex;
  flex-direction: column;
  padding: 28px 24px 24px;
  transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s;
}

.plan:hover {
  transform: translateY(-4px);
  box-shadow: var(--sl-shadow-lg);
}

.plan--featured {
  border: 1.5px solid transparent;
  background: linear-gradient(var(--sl-surface), var(--sl-surface)) padding-box, var(--sl-gradient) border-box;
  box-shadow: 0 24px 48px -20px rgba(99, 102, 241, 0.5);
}

.plan-ribbon {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--sl-gradient);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.plan-logos {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}

.plan-logo {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  background: var(--sl-surface-muted);
}

.plan-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.plan-tagline {
  margin-top: 4px;
  min-height: 42px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.plan-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 18px 0 20px;
}

.plan-amount {
  font-size: 44px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--vp-c-text-1);
}

.plan--featured .plan-amount {
  background: var(--sl-gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.plan-term {
  font-size: 14px;
  color: var(--vp-c-text-3);
}

.plan-list {
  flex-grow: 1;
  margin-bottom: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--sl-border);
}

.plan-list li {
  font-size: 14px;
}

.plan-list b {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.plan-check {
  margin-top: 2px;
  color: var(--vp-c-brand-1);
}

.pricing-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 40px;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  color: var(--vp-c-text-1);
}

.pricing-note :deep(.sl-icon) {
  color: var(--sl-success);
}

.pricing-sub {
  margin-top: 8px;
  font-size: 14px;
  text-align: center;
  color: var(--vp-c-text-2);
}

@media (max-width: 1100px) {
  .plans {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 28px 20px;
  }
}

@media (max-width: 600px) {
  .plans {
    grid-template-columns: 1fr;
  }

  .plan--featured {
    order: -1;
  }
}
</style>
