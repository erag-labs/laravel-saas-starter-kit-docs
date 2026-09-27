<script setup lang="ts">
import SectionHeading from './SectionHeading.vue';
import SlIcon, { type IconName } from './SlIcon.vue';

const steps: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'wrench',
    title: 'Improvements every week',
    text: 'Fixes, new features and dependency upgrades are shipped for Vue, React and Svelte together.',
  },
  {
    icon: 'refresh',
    title: 'Pushed to your kit',
    text: 'Every update is published to the kit repository you have access to, with a clear commit history.',
  },
  {
    icon: 'git',
    title: 'You pull when ready',
    text: 'Updates arrive in the kit repository you have access to. Merge them into your project on your own schedule.',
  },
];
</script>

<template>
  <section class="sl-section sl-section--muted">
    <div class="sl-container">
      <SectionHeading
        eyebrow="Weekly updates"
        title="A starter kit that keeps improving"
        lead="Your purchase includes lifetime access to the repository and the weekly updates pushed to it — no renewal, no subscription."
      />
      <ol class="steps">
        <li v-for="(step, index) in steps" :key="step.title" class="sl-card step">
          <span class="step-number">0{{ index + 1 }}</span>
          <span class="step-icon"><SlIcon :name="step.icon" :size="20" /></span>
          <h3 class="sl-h3">{{ step.title }}</h3>
          <p class="sl-text">{{ step.text }}</p>
        </li>
      </ol>
      <p class="note">
        <SlIcon name="calendar" :size="16" /> Updates are published weekly.
        <a class="sl-link" href="/docs/purchase/updates.html">How updates work →</a>
      </p>
    </div>
  </section>
</template>

<style scoped>
.steps {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  padding: 28px 24px 24px;
}

.step-number {
  position: absolute;
  top: 20px;
  right: 22px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-3);
}

.step-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 18px;
  border-radius: 12px;
  background: var(--sl-gradient);
  color: #fff;
  box-shadow: 0 10px 20px -10px rgba(99, 102, 241, 0.7);
}

.note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 32px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

@media (max-width: 860px) {
  .steps {
    grid-template-columns: 1fr;
  }
}
</style>
