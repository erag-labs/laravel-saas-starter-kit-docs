<script setup lang="ts">
import SlIcon, { type IconName } from './SlIcon.vue';

const languages = [
  { label: 'Default (English)', active: false },
  { label: 'English', active: false },
  { label: 'हिन्दी', active: true },
  { label: 'Español', active: false },
  { label: 'Français', active: false },
  { label: 'Deutsch', active: false },
  { label: '日本語', active: false },
];

const menu: { label: string; icon: IconName }[] = [
  { label: 'डैशबोर्ड', icon: 'layout-grid' },
  { label: 'टेनेंट्स', icon: 'building' },
  { label: 'उपयोगकर्ता', icon: 'users' },
  { label: 'भूमिकाएँ', icon: 'shield' },
  { label: 'सेटअप', icon: 'settings' },
];
</script>

<template>
  <div class="lang" aria-hidden="true">
    <div class="sl-mock lang-menu">
      <div class="lang-menu-head">
        <SlIcon name="languages" :size="14" />
        <strong>Language</strong>
        <span class="sl-badge sl-badge--brand">17</span>
      </div>
      <div v-for="language in languages" :key="language.label" class="lang-option" :class="{ 'lang-option--active': language.active }">
        <span>{{ language.label }}</span>
        <SlIcon v-if="language.active" name="check" :size="13" />
      </div>
      <p class="lang-more">+ 10 more languages</p>
    </div>
    <div class="sl-mock lang-sidebar">
      <div class="lang-sidebar-head">
        <strong>प्लेटफ़ॉर्म</strong>
        <span class="sl-badge sl-badge--muted">hi</span>
      </div>
      <div v-for="(item, index) in menu" :key="item.label" class="lang-item" :class="{ 'lang-item--active': index === 1 }">
        <SlIcon :name="item.icon" :size="14" />
        {{ item.label }}
      </div>
      <div class="lang-toast">
        <SlIcon name="check" :size="12" />
        भाषा अपडेट हो गई।
      </div>
    </div>
  </div>
</template>

<style scoped>
.lang {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
  gap: 14px;
}

.lang-menu,
.lang-sidebar {
  padding: 16px;
}

.lang-sidebar {
  margin-top: 28px;
}

.lang-menu-head,
.lang-sidebar-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
}

.lang-sidebar-head {
  justify-content: space-between;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}

.lang-menu-head .sl-badge {
  margin-left: auto;
}

.lang-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12.5px;
}

.lang-option--active {
  background: var(--vp-c-brand-soft);
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

.lang-more {
  margin: 6px 8px 0;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.lang-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: 13px;
}

.lang-item--active {
  background: var(--vp-c-default-soft);
  font-weight: 600;
}

.lang-toast {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 10px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.lang-toast :deep(svg) {
  color: #16a34a;
}

@media (max-width: 560px) {
  .lang {
    grid-template-columns: 1fr;
  }

  .lang-sidebar {
    margin-top: 0;
  }
}
</style>
