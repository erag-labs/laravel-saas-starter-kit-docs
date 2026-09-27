<script setup lang="ts">
import SlIcon, { type IconName } from './SlIcon.vue';

const menu: { label: string; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'layout-grid' },
  { label: 'Tenants', icon: 'building' },
  { label: 'Domains', icon: 'globe' },
  { label: 'Users', icon: 'users' },
  { label: 'Roles', icon: 'shield' },
  { label: 'Setup', icon: 'settings' },
];

const stats = [
  { label: 'Total Tenants', value: '128' },
  { label: 'Active', value: '96' },
  { label: 'Trial', value: '24' },
  { label: 'Suspended', value: '8' },
];

const rows = [
  { company: 'Acme Technologies', initials: 'AT', url: 'acme.vue.test', status: 'Active', tone: 'success' },
  { company: 'Northwind Labs', initials: 'NL', url: 'northwind.vue.test', status: 'Trial', tone: 'info' },
  { company: 'Globex Studio', initials: 'GS', url: 'globex.vue.test', status: 'Pending Invitation', tone: 'warning' },
  { company: 'Initech', initials: 'IN', url: 'initech.vue.test', status: 'Suspended', tone: 'danger' },
];
</script>

<template>
  <div class="sl-mock mock" aria-hidden="true">
    <div class="sl-mock-bar"><i /><i /><i /><span>vue.test/tenants</span></div>
    <div class="mock-body">
      <aside class="mock-side">
        <div class="mock-brand"><img src="/logo.svg" alt="" width="18" height="18" />SaaS Laravel</div>
        <div v-for="item in menu" :key="item.label" class="mock-nav" :class="{ active: item.label === 'Tenants' }">
          <SlIcon :name="item.icon" :size="14" />{{ item.label }}
        </div>
      </aside>
      <div class="mock-main">
        <div class="mock-head">
          <div>
            <strong>Tenants</strong>
            <p>Manage customer workspaces, custom domains, and primary administrators.</p>
          </div>
          <span class="mock-btn">+ Add Tenant</span>
        </div>
        <div class="mock-stats">
          <div v-for="stat in stats" :key="stat.label" class="mock-stat">
            <span>{{ stat.label }}</span>
            <b>{{ stat.value }}</b>
          </div>
        </div>
        <div class="mock-search sl-mock-input">Search company, domain, email...</div>
        <div class="mock-table">
          <div class="mock-row mock-row--head"><span>Organization</span><span class="mock-url">Workspace URL</span><span>Status</span></div>
          <div v-for="row in rows" :key="row.company" class="mock-row">
            <span class="mock-org"><i>{{ row.initials }}</i>{{ row.company }}</span>
            <span class="mock-url">{{ row.url }}</span>
            <span><em class="sl-badge" :class="`sl-badge--${row.tone}`">{{ row.status }}</em></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mock-body {
  display: grid;
  grid-template-columns: 150px 1fr;
  min-height: 360px;
}

.mock-side {
  padding: 14px 10px;
  border-right: 1px solid var(--sl-border);
  background: var(--sl-surface-muted);
}

.mock-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 6px 14px;
  font-size: 12.5px;
  font-weight: 700;
}

.mock-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 7px;
  font-size: 12.5px;
  color: var(--vp-c-text-2);
}

.mock-nav.active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  font-weight: 600;
}

.mock-main {
  min-width: 0;
  padding: 16px 18px;
}

.mock-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.mock-head strong {
  font-size: 16px;
}

.mock-head p {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.mock-btn {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 7px;
  background: var(--vp-button-brand-bg);
  color: #fff;
  font-size: 11.5px;
  font-weight: 600;
}

.mock-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 14px 0 12px;
}

.mock-stat {
  padding: 8px 10px;
  border: 1px solid var(--sl-border);
  border-radius: 9px;
}

.mock-stat span {
  display: block;
  font-size: 10.5px;
  color: var(--vp-c-text-3);
}

.mock-stat b {
  font-size: 17px;
}

.mock-search {
  min-height: 30px;
  margin-bottom: 10px;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.mock-table {
  border: 1px solid var(--sl-border);
  border-radius: 9px;
  overflow: hidden;
}

.mock-row {
  display: grid;
  grid-template-columns: 1.4fr 1.2fr 1fr;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--sl-border);
  font-size: 12px;
}

.mock-row--head {
  border-top: 0;
  background: var(--sl-surface-muted);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--vp-c-text-3);
}

.mock-org {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mock-org i {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 9.5px;
  font-style: normal;
}

.mock-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-text-2);
}

.mock-row em {
  font-style: normal;
}

@media (max-width: 640px) {
  .mock-body {
    grid-template-columns: 1fr;
  }

  .mock-side {
    display: none;
  }

  .mock-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .mock-row {
    grid-template-columns: 1.3fr 1fr;
  }

  .mock-url {
    display: none;
  }
}
</style>
