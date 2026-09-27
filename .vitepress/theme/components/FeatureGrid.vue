<script setup lang="ts">
import { includedFeatures } from '../../site';
import SectionHeading from './SectionHeading.vue';

withDefaults(defineProps<{ eyebrow?: string; title?: string; lead?: string }>(), {
  eyebrow: 'Included',
  title: 'Everything included in every kit',
  lead: 'Each plan ships the complete Laravel backend and a full frontend for every feature below.',
});
</script>

<template>
  <section class="sl-section sl-section--muted">
    <div class="sl-container">
      <SectionHeading :eyebrow="eyebrow" :title="title" :lead="lead" />
      <div class="features">
        <div v-for="feature in includedFeatures" :key="feature.title" class="sl-card feature">
          <h3 class="sl-h3">{{ feature.title }}</h3>
          <p class="sl-text">{{ feature.text }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.feature {
  padding: 24px;
}

@media (max-width: 960px) {
  .features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .features {
    grid-template-columns: 1fr;
  }
}
</style>
