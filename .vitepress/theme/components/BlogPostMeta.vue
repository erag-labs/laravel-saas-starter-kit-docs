<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import { data as posts } from '../../../blog/posts.data';
import { site } from '../../site';

const { frontmatter, page } = useData();

const post = computed(() => posts.find((item) => item.url === `/${page.value.relativePath.replace(/\.md$/, '.html')}`));

const date = computed(() =>
  new Date(frontmatter.value.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
);
</script>

<template>
  <div class="post-meta">
    <a class="post-back" href="/blog.html">← All articles</a>
    <p class="post-info">
      <span>By <a class="post-author no-icon" :href="site.company.url" target="_blank" rel="noopener">{{ site.company.name }}</a></span>
      <span aria-hidden="true">·</span>
      <time :datetime="new Date(frontmatter.date).toISOString()">{{ date }}</time>
      <template v-if="post">
        <span aria-hidden="true">·</span>
        <span>{{ post.readingTime }} min read</span>
      </template>
    </p>
  </div>
</template>

<style scoped>
.post-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 24px;
  margin: 12px 0 28px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--sl-border);
}

.post-back {
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.post-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 !important;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.post-author {
  font-weight: 600;
  text-decoration: none;
}

.post-author::after {
  display: none !important;
}
</style>
