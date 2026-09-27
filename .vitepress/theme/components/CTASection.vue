<script setup lang="ts">
import { site } from '../../site';

withDefaults(
  defineProps<{
    title?: string;
    text?: string;
    primaryText?: string;
    primaryLink?: string;
    secondaryText?: string;
    secondaryLink?: string;
  }>(),
  {
    title: 'Start Building Your SaaS Today',
    text: 'Pick a starter kit, pay once and get lifetime access with weekly updates. Your next product starts with tenants, auth and permissions already done.',
    primaryText: 'View Pricing',
    primaryLink: '/pricing.html',
    secondaryText: 'Read Documentation',
    secondaryLink: '/docs.html',
  },
);
</script>

<template>
  <section class="sl-section cta-wrap">
    <div class="sl-container">
      <div class="cta">
        <div class="cta-shine" />
        <h2 class="cta-title">{{ title }}</h2>
        <p class="cta-text">{{ text }}</p>
        <div class="sl-actions cta-actions">
          <a class="sl-btn sl-btn--lg cta-primary" :href="primaryLink">
            {{ primaryText }} <span class="vpi-arrow-right" />
          </a>
          <a class="sl-btn sl-btn--lg cta-secondary" :href="secondaryLink">{{ secondaryText }}</a>
        </div>
        <p class="cta-note">{{ site.paymentNote }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cta-wrap {
  padding-top: 40px;
}

.cta {
  position: relative;
  overflow: hidden;
  padding: 72px 32px;
  border-radius: 28px;
  background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
  text-align: center;
  color: #fff;
  box-shadow: 0 32px 64px -32px rgba(67, 56, 202, 0.7);
}

.cta-shine {
  position: absolute;
  inset: 0;
  background: radial-gradient(50% 80% at 50% 0%, rgba(255, 255, 255, 0.22), transparent 70%),
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: auto, 40px 40px, 40px 40px;
  mask-image: radial-gradient(ellipse 80% 90% at 50% 0%, #000 40%, transparent 90%);
  -webkit-mask-image: radial-gradient(ellipse 80% 90% at 50% 0%, #000 40%, transparent 90%);
  pointer-events: none;
}

.cta-title {
  position: relative;
  font-size: clamp(28px, 4.5vw, 44px);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.cta-text {
  position: relative;
  max-width: 620px;
  margin: 16px auto 0;
  font-size: 17px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.85);
}

.cta-actions {
  position: relative;
  justify-content: center;
  margin-top: 32px;
}

.cta-primary {
  background: #fff;
  color: #3730a3;
}

.cta-primary:hover {
  color: #3730a3;
  transform: translateY(-1px);
  box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.4);
}

.cta-secondary {
  border-color: rgba(255, 255, 255, 0.35);
  color: #fff;
}

.cta-secondary:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.cta-note {
  position: relative;
  margin-top: 24px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
}

@media (max-width: 480px) {
  .cta {
    padding: 56px 20px;
    border-radius: 20px;
  }

  .cta-actions .sl-btn {
    width: 100%;
  }
}
</style>
