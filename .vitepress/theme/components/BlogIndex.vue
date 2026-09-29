<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { data as posts } from '../../../blog/posts.data';
import { blogAuthor, blogCategories, blogStartHere, site } from '../../site';
import SlIcon from './SlIcon.vue';

const topic = ref('all');
const query = ref('');

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const categoryLabel = (key: string): string => blogCategories.find((category) => category.key === key)?.label ?? '';

const topics = computed(() => [
  { key: 'all', label: 'All articles', count: posts.length },
  ...blogCategories.map((category) => ({ ...category, count: posts.filter((post) => post.category === category.key).length })),
]);

const startHere = computed(() => blogStartHere.map((url) => posts.find((post) => post.url === url)).filter((post) => post !== undefined));

const visiblePosts = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean);

  return posts.filter((post) => {
    if (topic.value !== 'all' && post.category !== topic.value) {
      return false;
    }

    const haystack = `${post.title} ${post.description} ${post.tags.join(' ')}`.toLowerCase();

    return words.every((word) => haystack.includes(word));
  });
});

const resultLabel = computed(() => {
  const count = visiblePosts.value.length;
  const noun = count === 1 ? 'article' : 'articles';

  return topic.value === 'all' ? `${count} ${noun}` : `${count} ${noun} in ${categoryLabel(topic.value)}`;
});

const selectTopic = (key: string): void => {
  topic.value = key;
};

// Keep the selected topic in the URL, so a filtered list can be shared and survives a reload.
onMounted(() => {
  const fromUrl = new URLSearchParams(window.location.search).get('topic');

  if (fromUrl && blogCategories.some((category) => category.key === fromUrl)) {
    topic.value = fromUrl;
  }
});

watch(topic, (key) => {
  const url = new URL(window.location.href);

  if (key === 'all') {
    url.searchParams.delete('topic');
  } else {
    url.searchParams.set('topic', key);
  }

  window.history.replaceState(window.history.state, '', url);
});
</script>

<template>
  <div class="blog-layout">
    <aside class="blog-aside" aria-label="Browse articles">
      <label class="blog-search">
        <SlIcon name="search" :size="16" />
        <span class="sl-sr-only">Search articles</span>
        <input v-model="query" type="search" placeholder="Search articles" autocomplete="off" />
      </label>

      <nav class="blog-panel">
        <p class="blog-panel-title">Topics</p>
        <ul class="blog-topics">
          <li v-for="item in topics" :key="item.key">
            <button type="button" class="blog-topic" :class="{ 'is-active': topic === item.key }" :aria-pressed="topic === item.key" @click="selectTopic(item.key)">
              <span>{{ item.label }}</span>
              <span class="blog-topic-count">{{ item.count }}</span>
            </button>
          </li>
        </ul>
      </nav>

      <div class="blog-panel blog-aside-extra">
        <p class="blog-panel-title">Start here</p>
        <ol class="blog-start">
          <li v-for="post in startHere" :key="post.url">
            <a :href="post.url">{{ post.title }}</a>
          </li>
        </ol>
      </div>

      <div class="blog-panel blog-kit blog-aside-extra">
        <p class="blog-kit-title">Skip the groundwork</p>
        <p class="blog-kit-text">Multi-tenancy, authentication, roles and 17 languages, ready in Vue, React or Svelte. From ${{ site.kitPriceFrom }}, one-time.</p>
        <a class="sl-btn sl-btn--primary sl-btn--block" href="/#features">Explore the starter kits</a>
      </div>
    </aside>

    <div class="blog-main">
      <p class="blog-count" aria-live="polite">{{ resultLabel }}</p>

      <div class="blog-list">
        <article v-for="post in visiblePosts" :key="post.url" class="blog-card">
          <p class="blog-meta">
            <span v-if="post.category" class="blog-category">{{ categoryLabel(post.category) }}</span>
            <span>By {{ blogAuthor(post.author).name }}</span>
            <span aria-hidden="true">·</span>
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

      <div v-if="visiblePosts.length === 0" class="blog-empty">
        <p>No articles match your search.</p>
        <button type="button" class="sl-btn sl-btn--secondary" @click="(query = ''), selectTopic('all')">Show all articles</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blog-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  margin-top: 32px;
}

.blog-layout > * {
  min-width: 0;
}

@media (min-width: 1024px) {
  .blog-layout {
    grid-template-columns: minmax(0, 1fr) 300px;
    align-items: start;
    gap: 40px;
  }

  .blog-aside {
    grid-column: 2;
    grid-row: 1;
    position: sticky;
    top: calc(var(--vp-nav-height) + 24px);
    max-height: calc(100vh - var(--vp-nav-height) - 48px);
    overflow-y: auto;
  }

  .blog-main {
    grid-column: 1;
    grid-row: 1;
  }
}

.blog-aside {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.blog-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius-sm);
  background: var(--sl-surface);
  color: var(--vp-c-text-3);
}

.blog-search:focus-within {
  border-color: var(--vp-c-brand-1);
}

.blog-search input {
  flex: 1;
  min-width: 0;
  padding: 10px 0;
  border: 0;
  background: transparent;
  font-size: 14px;
  color: var(--vp-c-text-1);
  outline: none;
}

.blog-panel {
  padding: 18px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-surface);
}

.blog-panel-title {
  margin: 0 0 10px !important;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.blog-topics,
.blog-start {
  margin: 0 !important;
  padding: 0 !important;
  list-style: none;
}

.blog-topics li + li,
.blog-start li + li {
  margin-top: 2px !important;
}

.blog-topic {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 14px;
  text-align: left;
  color: var(--vp-c-text-2);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.blog-topic:hover {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

.blog-topic.is-active {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.blog-topic-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-3);
}

.blog-start {
  counter-reset: start;
}

.blog-start li {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  counter-increment: start;
  font-size: 14px;
  line-height: 1.45;
}

.blog-start li::before {
  content: counter(start);
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--vp-c-default-soft);
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  color: var(--vp-c-text-2);
}

.blog-start a {
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.blog-start a:hover {
  color: var(--vp-c-brand-1);
}

.blog-kit {
  background: linear-gradient(160deg, var(--vp-c-brand-soft), transparent 70%), var(--sl-surface);
  border-color: var(--sl-border-strong);
}

.blog-kit-title {
  margin: 0 !important;
  font-size: 16px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.blog-kit-text {
  margin: 6px 0 14px !important;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.blog-kit .sl-btn--primary {
  color: #fff !important;
  text-decoration: none;
}

.blog-count {
  margin: 0 0 12px !important;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.blog-list {
  display: grid;
  gap: 20px;
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
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0 !important;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.blog-category {
  margin-right: 4px;
  padding: 1px 9px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

.blog-title {
  margin: 10px 0 0 !important;
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

.blog-empty {
  padding: 40px 24px;
  border: 1px dashed var(--sl-border-strong);
  border-radius: var(--sl-radius);
  text-align: center;
  color: var(--vp-c-text-2);
}

.blog-empty p {
  margin: 0 0 14px !important;
}

/* Small screens: search and topics above the list, topics as a scrollable row. */
@media (max-width: 1023px) {
  .blog-aside-extra {
    display: none;
  }

  .blog-aside .blog-panel {
    padding: 0;
    border: 0;
    background: none;
  }

  .blog-aside .blog-panel-title {
    display: none;
  }

  .blog-topics {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .blog-topics::-webkit-scrollbar {
    display: none;
  }

  .blog-topics li + li {
    margin-top: 0 !important;
  }

  .blog-topic {
    gap: 6px;
    white-space: nowrap;
    border: 1px solid var(--sl-border);
    border-radius: 999px;
    padding: 6px 12px;
  }
}
</style>
