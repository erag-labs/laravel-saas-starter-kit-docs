<script setup lang="ts">
const groups = [
  {
    title: 'Backend',
    items: [
      'Laravel 13',
      'PHP 8.3+',
      'Inertia v3',
      'Fortify',
      'Wayfinder',
      'Spatie Data',
      'Spatie Permission',
      'stancl/tenancy',
      'Laravel Lang Sync Inertia',
      'TypeScript Transformer',
    ],
  },
  {
    title: 'Frontend',
    items: [
      'Vue 3.5',
      'React 19',
      'Svelte 5',
      'TypeScript',
      'Tailwind CSS v4',
      'Vite 8',
      'shadcn UI',
      'Lang Sync Inertia',
      'Lucide Icons',
      'Iconify',
      'Laravel Passkeys',
    ],
  },
  {
    title: 'Quality & tooling',
    items: [
      'Pest 5',
      'Larastan',
      'Pint',
      'ESLint',
      'Prettier',
      'vue-tsc · tsc · svelte-check',
      'Laravel Boost',
      'Laravel Pail',
      'Laravel Sail',
    ],
  },
];
</script>

<template>
  <section class="stack" aria-labelledby="tech-stack-title">
    <div class="sl-container">
      <p id="tech-stack-title" class="stack-title">Built on the modern Laravel stack</p>
      <div class="stack-groups">
        <div v-for="group in groups" :key="group.title" class="stack-group">
          <span class="stack-label">{{ group.title }}</span>
          <ul>
            <li v-for="item in group.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stack {
  padding: 40px 0 56px;
  border-top: 1px solid var(--sl-border);
  border-bottom: 1px solid var(--sl-border);
  background: var(--sl-surface-muted);
}

.stack-title {
  margin-bottom: 24px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.stack-groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.stack-group {
  padding: 18px 20px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-surface);
}

.stack-label {
  display: block;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.stack-group ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stack-group li {
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--vp-c-default-soft);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

@media (max-width: 860px) {
  .stack-groups {
    grid-template-columns: 1fr;
  }
}
</style>
