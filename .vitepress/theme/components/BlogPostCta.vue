<script setup lang="ts">
withDefaults(defineProps<{ title?: string; text?: string }>(), {
  title: 'Skip the groundwork',
  text: 'SaaS Laravel gives you database-per-tenant multi-tenancy, authentication, roles and permissions and 17 languages out of the box — with a Vue, React or Svelte frontend.',
});
</script>

<template>
  <aside class="post-cta vp-raw">
    <p class="post-cta-title">{{ title }}</p>
    <p class="post-cta-text">{{ text }}</p>
    <div class="post-cta-actions">
      <a class="sl-btn sl-btn--primary" href="/#features">Explore the features</a>
      <a class="sl-btn sl-btn--secondary" href="/docs.html">Read the documentation</a>
    </div>
  </aside>
</template>

<style scoped>
.post-cta {
  margin: 40px 0 8px;
  padding: 24px 26px;
  border: 1px solid var(--sl-border-strong);
  border-radius: var(--sl-radius);
  background: linear-gradient(160deg, var(--vp-c-brand-soft), transparent 70%), var(--sl-surface);
}

.post-cta-title {
  margin: 0 !important;
  font-size: 18px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.post-cta-text {
  margin: 8px 0 0 !important;
  font-size: 15px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

.post-cta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}

.post-cta-actions a {
  text-decoration: none;
}

.post-cta-actions .sl-btn--primary,
.post-cta-actions .sl-btn--primary:hover {
  color: #fff !important;
}

.post-cta-actions .sl-btn--secondary {
  color: var(--vp-c-text-1) !important;
}
</style>
