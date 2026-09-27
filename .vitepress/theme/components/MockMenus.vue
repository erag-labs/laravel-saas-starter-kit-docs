<script setup lang="ts">
import SlIcon from './SlIcon.vue';

const menus = [
  { title: 'Dashboard', slug: 'dashboard' },
  { title: 'Tenants', slug: 'tenants' },
  { title: 'Users', slug: 'users' },
  { title: 'Roles', slug: 'roles' },
  { title: 'Setup', slug: 'setup' },
];

const navItems = ['Users', 'Setup'];

const setupItems = [
  { icon: 'layers', label: 'Menus' },
  { icon: 'layout', label: 'Layout Settings' },
  { icon: 'wrench', label: 'Tenant Settings' },
] as const;
</script>

<template>
  <div class="menus-frame" aria-hidden="true">
    <div class="menus">
      <div class="sl-mock menus-builder">
        <div class="menus-head">
          <strong>Menus</strong>
          <span class="menus-reset"><SlIcon name="refresh" :size="12" /> Reset Defaults</span>
        </div>
        <div v-for="(menu, index) in menus" :key="menu.slug" class="menus-row" :class="{ 'menus-row--drag': index === 2 }">
          <span class="menus-grip"><i /><i /><i /><i /><i /><i /></span>
          <span class="menus-title">{{ menu.title }}</span>
          <code>{{ menu.slug }}</code>
        </div>
      </div>
      <div class="sl-mock menus-topnav">
        <div class="menus-bar">
          <span class="menus-logo" />
          <span v-for="item in navItems" :key="item" class="menus-link" :class="{ 'menus-link--open': item === 'Setup' }">
            {{ item }}
            <SlIcon v-if="item === 'Setup'" name="chevron-down" :size="11" />
          </span>
        </div>
        <div class="menus-dropdown">
          <div v-for="item in setupItems" :key="item.label" class="menus-drop-item" :class="{ 'menus-drop-item--active': item.label === 'Layout Settings' }">
            <SlIcon :name="item.icon" :size="13" />
            {{ item.label }}
          </div>
        </div>
        <p class="menus-note">Top Nav layout — Setup opens on hover.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menus-frame {
  container-type: inline-size;
}

.menus {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  align-items: start;
  gap: 14px;
}

.menus-builder,
.menus-topnav {
  padding: 16px;
}

.menus-topnav {
  margin-top: 28px;
}

.menus-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
}

.menus-head strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menus-reset {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 600;
  white-space: nowrap;
}

.menus-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-top: 1px solid var(--sl-border);
  font-size: 12.5px;
}

.menus-row--drag {
  border: 1px dashed var(--vp-c-brand-1);
  border-radius: 8px;
  background: var(--vp-c-brand-soft);
  box-shadow: 0 8px 20px -12px rgba(79, 70, 229, 0.45);
  transform: translateX(6px);
}

.menus-row--drag + .menus-row {
  border-top: 0;
}

.menus-grip {
  display: grid;
  grid-template-columns: repeat(2, 3px);
  gap: 2px;
}

.menus-grip i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--vp-c-text-3);
}

.menus-title {
  flex: 1;
  font-weight: 600;
}

.menus-row code {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  font-size: 10.5px;
}

.menus-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--sl-border);
}

.menus-logo {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-right: 4px;
  border-radius: 5px;
  background: var(--vp-c-text-1);
}

.menus-link {
  display: inline-flex;
  flex-shrink: 0;
  white-space: nowrap;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 11.5px;
  color: var(--vp-c-text-2);
}

.menus-link--open {
  background: var(--vp-c-default-soft);
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.menus-dropdown {
  margin: 8px 0 0;
  padding: 4px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  box-shadow: 0 12px 24px -16px rgba(0, 0, 0, 0.35);
}

.menus-drop-item {
  display: flex;
  white-space: nowrap;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
}

.menus-drop-item--active {
  background: var(--vp-c-default-soft);
  font-weight: 600;
}

.menus-note {
  margin: 10px 0 0;
  line-height: 1.45;
  font-size: 11px;
  color: var(--vp-c-text-3);
}

@container (max-width: 400px) {
  .menus {
    grid-template-columns: 1fr;
  }

  .menus-topnav {
    margin-top: 0;
  }
}
</style>
