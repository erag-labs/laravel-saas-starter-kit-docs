<script setup lang="ts">
import SlIcon from './SlIcon.vue';

const steps = [
  { label: 'Create tenant database', detail: 'TENANCY_DB_PREFIX + id' },
  { label: 'Run tenant migrations', detail: 'database/migrations/tenant' },
  { label: 'Seed roles, permissions & menus', detail: 'TenantDatabaseSeeder' },
  { label: 'Create primary administrator', detail: 'CreateTenantUserJob' },
  { label: 'Send invitation email', detail: 'Signed URL' },
];
</script>

<template>
  <div class="sl-mock provision" aria-hidden="true">
    <div class="sl-mock-bar"><i /><i /><i /><span>vue.test/tenants/create</span></div>
    <div class="provision-body">
      <div class="provision-org">
        <span class="provision-avatar">AT</span>
        <div>
          <strong>Acme Technologies</strong>
          <p>acme.vue.test</p>
        </div>
        <span class="sl-badge sl-badge--warning">Pending Invitation</span>
      </div>
      <ol class="provision-steps">
        <li v-for="(step, index) in steps" :key="step.label" :style="{ animationDelay: `${index * 0.35}s` }">
          <span class="provision-check"><SlIcon name="check" :size="12" /></span>
          <span class="provision-label">{{ step.label }}</span>
          <code>{{ step.detail }}</code>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.provision-body {
  padding: 20px;
}

.provision-org {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--sl-border);
}

.provision-org > div {
  flex-grow: 1;
  min-width: 0;
}

.provision-org strong {
  font-size: 14px;
}

.provision-org p {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.provision-avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--sl-gradient);
  color: #fff;
  font-weight: 700;
}

.provision-steps {
  display: grid;
  gap: 10px;
  margin: 16px 0;
  padding: 0;
  list-style: none;
}

.provision-steps li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  background: var(--sl-surface-muted);
  animation: step-in 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.provision-check {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sl-success-soft);
  color: var(--sl-success);
}

.provision-label {
  flex-grow: 1;
  font-weight: 600;
  font-size: 12.5px;
}

.provision-steps code {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-text-3);
}


@keyframes step-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 480px) {
  .provision-steps code {
    display: none;
  }
}
</style>
