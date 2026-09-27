<script setup lang="ts">
import SlIcon from './SlIcon.vue';

const providers = ['Stripe', 'Razorpay', 'Paddle', 'PayPal', 'Lemon Squeezy'];

const points = [
  'No payment gateway lock-in',
  'Choose your preferred provider',
  'Implement subscriptions or one-time payments as needed',
  'Keep the core starter kit clean and flexible',
];
</script>

<template>
  <section class="sl-section gateway-section" aria-labelledby="payment-gateway-title">
    <div class="sl-container">
      <div class="gateway">
        <div class="gateway-copy">
          <p class="sl-eyebrow">Billing</p>
          <h2 id="payment-gateway-title" class="sl-h2">Payment Gateway — Your Choice</h2>
          <p class="sl-lead gateway-lead">
            Payment integration is intentionally not included in the starter kit because every SaaS product has different
            payment requirements, countries, currencies, pricing models, and preferred providers.
          </p>
          <p class="sl-text">
            Instead of forcing a specific provider, the starter kit keeps the billing layer flexible so developers can integrate
            the gateway that best fits their business.
          </p>
          <ul class="sl-checklist gateway-points">
            <li v-for="point in points" :key="point">
              <span class="gateway-check"><SlIcon name="check" :size="13" /></span>{{ point }}
            </li>
          </ul>
        </div>

        <div class="gateway-panel">
          <div class="gateway-core">
            <span class="gateway-core-icon"><SlIcon name="credit-card" :size="22" /></span>
            <div>
              <strong>Your billing layer</strong>
              <span>Plug in the provider that fits your product</span>
            </div>
          </div>
          <div class="gateway-connector"><span /></div>
          <div class="gateway-providers">
            <span v-for="provider in providers" :key="provider" class="gateway-provider">
              <SlIcon name="plug" :size="14" />{{ provider }}
            </span>
            <span class="gateway-provider gateway-provider--custom">
              <SlIcon name="plug" :size="14" />Any custom provider
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gateway-section {
  border-top: 1px solid var(--sl-border);
}

.gateway {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 64px;
}

.gateway-lead {
  margin-top: 16px;
}

.gateway-copy .sl-text {
  margin-top: 12px;
}

.gateway-points {
  margin-top: 24px;
}

.gateway-check {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.gateway-panel {
  padding: 28px;
  border: 1px solid var(--sl-border);
  border-radius: 24px;
  background: linear-gradient(160deg, var(--vp-c-brand-soft), transparent 60%), var(--sl-surface-muted);
}

.gateway-core {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
}

.gateway-core-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--sl-gradient);
  color: #fff;
}

.gateway-core strong {
  display: block;
  font-size: 15px;
  color: var(--vp-c-text-1);
}

.gateway-core span {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.gateway-connector {
  display: flex;
  justify-content: center;
  height: 28px;
}

.gateway-connector span {
  width: 0;
  border-left: 2px dashed var(--vp-c-brand-1);
  opacity: 0.45;
}

.gateway-providers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.gateway-provider {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--sl-border);
  border-radius: 12px;
  background: var(--sl-surface);
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.gateway-provider :deep(svg) {
  color: var(--vp-c-brand-1);
}

.gateway-provider--custom {
  border-style: dashed;
  border-color: var(--vp-c-brand-1);
  background: transparent;
  color: var(--vp-c-brand-1);
}

@media (max-width: 960px) {
  .gateway {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}

@media (max-width: 560px) {
  .gateway-panel {
    padding: 16px;
    border-radius: 18px;
  }

  .gateway-providers {
    grid-template-columns: 1fr;
  }
}
</style>
