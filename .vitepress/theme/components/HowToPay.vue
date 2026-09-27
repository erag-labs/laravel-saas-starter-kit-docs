<script setup lang="ts">
import { formatPrice, paymentFaqs, site } from '../../site';
import FaqList from './FaqList.vue';
import SectionHeading from './SectionHeading.vue';

const steps: { title: string; text: string; link?: { text: string; href: string } }[] = [
  {
    title: 'Choose your plan',
    text: `Pick a single kit — Vue, React or Svelte for ${formatPrice(site.kitPrice)} — or All Starter Kits for ${formatPrice(site.bundlePrice)}.`,
    link: { text: 'Compare plans', href: '/pricing.html' },
  },
  {
    title: 'Open the plan details',
    text: 'Each plan has a detail page listing the technologies, features, requirements and the repository you will receive.',
  },
  {
    title: 'Pay on GitHub Sponsors',
    text: 'Click “Sponsor / Purchase on GitHub” at the bottom of the detail page and make a one-time payment for the plan price, signed in with the GitHub account that should get access.',
  },
  {
    title: 'Access is granted automatically',
    text: 'As soon as your payment goes through, your GitHub account is automatically invited to the kit repository.',
  },
  {
    title: 'Accept the invite and start building',
    text: 'Accept the GitHub invitation, clone the repository and follow the installation guide.',
    link: { text: 'Installation guide', href: '/docs/getting-started/installation.html' },
  },
];

const faqs = paymentFaqs;
</script>

<template>
  <div class="pay">
    <section class="sl-section pay-hero">
      <div class="pay-glow" />
      <div class="sl-container">
        <SectionHeading
          as="h1"
          eyebrow="How to pay"
          title="Buy once through GitHub Sponsors"
          :lead="`${site.paymentNote}.`"
        />
        <ol class="steps">
          <li v-for="(step, index) in steps" :key="step.title" class="sl-card step">
            <span class="step-number">{{ index + 1 }}</span>
            <div>
              <h2 class="sl-h3">{{ step.title }}</h2>
              <p class="sl-text">{{ step.text }}</p>
              <a v-if="step.link" class="sl-link step-link" :href="step.link.href">{{ step.link.text }} →</a>
            </div>
          </li>
        </ol>
        <div class="notice" role="note">
          <strong>Access is granted automatically.</strong>
          As soon as your sponsorship goes through, your GitHub account is invited to the repository — you will receive a
          GitHub invitation.
        </div>
      </div>
    </section>

    <section class="sl-section sl-section--muted">
      <div class="sl-container faq-wrap">
        <SectionHeading eyebrow="FAQ" title="Payment questions" />
        <FaqList :items="faqs" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.pay-hero {
  padding-top: 64px;
  overflow: hidden;
}

.pay-glow {
  position: absolute;
  inset: -160px 0 auto;
  height: 560px;
  background: var(--sl-glow);
  pointer-events: none;
}

.pay-hero .sl-container {
  position: relative;
}

.steps {
  display: grid;
  gap: 14px;
  max-width: 760px;
  margin: 0 auto;
  padding: 0;
  list-style: none;
  counter-reset: none;
}

.step {
  display: flex;
  gap: 18px;
  padding: 22px 24px;
}

.step-number {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--sl-gradient);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 8px 16px -8px rgba(99, 102, 241, 0.7);
}

.step-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 14px;
}

.notice {
  max-width: 760px;
  margin: 24px auto 0;
  padding: 16px 20px;
  border: 1px solid var(--sl-warning-soft);
  border-left: 4px solid var(--sl-warning);
  border-radius: var(--sl-radius-sm);
  background: var(--sl-warning-soft);
  font-size: 15px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
}

.faq-wrap {
  max-width: 820px;
}
</style>
