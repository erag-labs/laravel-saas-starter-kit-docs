<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string;
    title: string;
    lead?: string;
    center?: boolean;
    as?: 'h1' | 'h2';
  }>(),
  { center: true, as: 'h2' },
);
</script>

<template>
  <div class="sl-heading" :class="{ 'sl-center': center }">
    <p v-if="eyebrow" class="sl-eyebrow">{{ eyebrow }}</p>
    <component :is="as" :class="as === 'h1' ? 'sl-h1' : 'sl-h2'">
      <slot>{{ title }}</slot>
    </component>
    <p v-if="lead" class="sl-lead">{{ lead }}</p>
  </div>
</template>
