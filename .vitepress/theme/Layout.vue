<script setup lang="ts">
import { useData } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { computed } from 'vue';
import SiteFooter from './components/SiteFooter.vue';

const { frontmatter } = useData();
const isMarketingPage = computed(() => frontmatter.value.layout === 'page');
</script>

<template>
  <DefaultTheme.Layout :class="{ 'is-marketing': isMarketingPage }">
    <template #layout-bottom>
      <SiteFooter v-if="isMarketingPage" />
    </template>
  </DefaultTheme.Layout>
</template>
