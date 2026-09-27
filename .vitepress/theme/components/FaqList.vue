<script setup lang="ts">
defineProps<{ items: { question: string; answer: string }[] }>();
</script>

<template>
  <div class="faq">
    <details v-for="item in items" :key="item.question" class="faq-item">
      <summary>
        <span>{{ item.question }}</span>
        <span class="vpi-plus faq-icon" />
      </summary>
      <p>{{ item.answer }}</p>
    </details>
  </div>
</template>

<style scoped>
.faq {
  display: grid;
  gap: 12px;
}

.faq-item {
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius-sm);
  background: var(--sl-surface);
  transition: border-color 0.2s;
}

.faq-item[open] {
  border-color: var(--sl-border-strong);
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  cursor: pointer;
  list-style: none;
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

summary::-webkit-details-marker {
  display: none;
}

summary:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
  border-radius: var(--sl-radius-sm);
}

.faq-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--vp-c-text-3);
  transition: transform 0.2s;
}

.faq-item[open] .faq-icon {
  transform: rotate(45deg);
  color: var(--vp-c-brand-1);
}

.faq-item p {
  padding: 0 20px 18px;
  font-size: 15px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}
</style>
