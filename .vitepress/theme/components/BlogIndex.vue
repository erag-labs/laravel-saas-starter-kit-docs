<script setup lang="ts">
import { data as posts } from '../../../blog/posts.data';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
</script>

<template>
  <div class="blog-list">
    <article v-for="post in posts" :key="post.url" class="blog-card">
      <p class="blog-meta">
        <time :datetime="post.date">{{ formatDate(post.date) }}</time>
        <span aria-hidden="true">·</span>
        <span>{{ post.readingTime }} min read</span>
      </p>
      <h2 class="blog-title">
        <a :href="post.url">{{ post.title }}</a>
      </h2>
      <p class="blog-description">{{ post.description }}</p>
      <div class="blog-footer">
        <span v-for="tag in post.tags" :key="tag" class="blog-tag">{{ tag }}</span>
        <a class="blog-read" :href="post.url">Read the article<span class="sl-sr-only">: {{ post.title }}</span> →</a>
      </div>
    </article>
  </div>
</template>

<style scoped>
.blog-list {
  display: grid;
  gap: 20px;
  margin-top: 32px;
}

.blog-card {
  padding: 24px 26px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-surface);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.blog-card:hover {
  border-color: var(--sl-border-strong);
  box-shadow: var(--sl-shadow);
}

.blog-meta {
  display: flex;
  gap: 8px;
  margin: 0 !important;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.blog-title {
  margin: 8px 0 0 !important;
  padding: 0 !important;
  border: 0 !important;
  font-size: 22px;
  line-height: 1.35;
}

.blog-title a {
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.blog-title a:hover {
  color: var(--vp-c-brand-1);
}

.blog-description {
  margin: 10px 0 0 !important;
  font-size: 15px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

.blog-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.blog-tag {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.blog-read {
  margin-left: auto;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
</style>
