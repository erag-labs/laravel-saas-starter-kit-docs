<script setup lang="ts">
import SectionHeading from './SectionHeading.vue';
import SlIcon, { type IconName } from './SlIcon.vue';

const reasons: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'zap',
    title: 'Skip months of groundwork',
    text: 'Tenants, domains, authentication, roles, invitations and maintenance mode are already built, wired and tested.',
  },
  {
    icon: 'layers',
    title: 'Modular Laravel backend',
    text: 'Each feature lives in Modules/<Module> with thin controllers, services, Data classes and its own routes.',
  },
  {
    icon: 'code',
    title: 'Typed from PHP to TypeScript',
    text: 'Wayfinder generates typed route functions and Spatie Data classes become TypeScript types for your pages.',
  },
  {
    icon: 'database',
    title: 'Real multi-database tenancy',
    text: 'stancl/tenancy gives every tenant its own database, identified by subdomain, with separate central and tenant guards.',
  },
  {
    icon: 'flask',
    title: 'Tested and linted',
    text: 'Pest feature tests, Larastan, Pint, ESLint and Prettier run with a single composer test command.',
  },
  {
    icon: 'bot',
    title: 'Ready for AI agents',
    text: 'Laravel Boost guidelines and project skills help coding agents follow the conventions already in the codebase.',
  },
];
</script>

<template>
  <section class="sl-section sl-section--muted">
    <div class="sl-container">
      <SectionHeading
        eyebrow="Why SaaS Laravel"
        title="The boring parts of SaaS, done properly"
        lead="Start from a codebase that already handles the hard, repetitive parts of a multi-tenant product — and spend your time on what makes yours different."
      />
      <div class="grid">
        <div v-for="reason in reasons" :key="reason.title" class="item">
          <h3 class="item-title"><SlIcon :name="reason.icon" :size="18" /> {{ reason.title }}</h3>
          <p class="item-text">{{ reason.text }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-border);
}

.item {
  padding: 26px 28px;
  background: var(--sl-surface);
}

.item-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--vp-c-text-1);
}

.item-title :deep(svg) {
  color: var(--vp-c-brand-1);
}

.item-text {
  margin-top: 10px;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

@media (max-width: 960px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .item {
    padding: 22px 20px;
  }
}
</style>
