<script setup lang="ts">
import SlIcon from './SlIcon.vue';

const roles = [
  { name: 'Super Admin', system: true },
  { name: 'Admin', system: true },
  { name: 'Manager', system: true },
  { name: 'Employee', system: true },
  { name: 'support-agent', system: false },
];

const permissions = [
  { name: 'View Users', checked: true },
  { name: 'Create User', checked: true },
  { name: 'Edit User', checked: true },
  { name: 'Delete User', checked: false },
];
</script>

<template>
  <div class="role" aria-hidden="true">
    <div class="sl-mock role-form">
      <strong class="role-title">Add User</strong>
      <div class="role-row">
        <div>
          <span class="sl-mock-label">Name</span>
          <div class="sl-mock-input">Priya Sharma</div>
        </div>
        <div>
          <span class="sl-mock-label">Email</span>
          <div class="sl-mock-input">priya@acme.test</div>
        </div>
      </div>
      <span class="sl-mock-label role-label">Role</span>
      <div class="sl-mock-input role-select">Manager <SlIcon name="chevron-down" :size="14" /></div>
      <div class="role-menu">
        <div v-for="role in roles" :key="role.name" class="role-option" :class="{ active: role.name === 'Manager' }">
          <span>{{ role.name }}</span>
          <span v-if="role.name === 'Manager'" class="role-check"><SlIcon name="check" :size="14" /></span>
          <span v-else-if="!role.system" class="sl-badge sl-badge--muted">Custom</span>
        </div>
      </div>
      <div class="role-invite">
        <span class="role-box checked"><SlIcon name="check" :size="11" /></span>
        <span>Send invitation email</span>
      </div>
    </div>
    <div class="sl-mock role-perms">
      <strong>Users</strong>
      <p class="role-auto">Auto-checked 3 permissions configured for “Manager”.</p>
      <div v-for="permission in permissions" :key="permission.name" class="role-perm">
        <span class="role-box" :class="{ checked: permission.checked }">
          <SlIcon v-if="permission.checked" name="check" :size="11" />
        </span>
        {{ permission.name }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.role {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  align-items: start;
  gap: 16px;
}

.role-form,
.role-perms {
  padding: 20px;
}

.role-title {
  display: block;
  margin-bottom: 14px;
  font-size: 14px;
}

.role-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.role-label {
  margin-top: 14px;
}

.role-select {
  border-color: var(--sl-border-strong);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}

.role-menu {
  margin-top: 6px;
  padding: 4px;
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
}

.role-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 12.5px;
}

.role-option.active {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.role-check {
  display: flex;
}

.role-invite {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--sl-border);
  font-size: 12.5px;
  font-weight: 600;
}

.role-perms {
  margin-top: 56px;
}

.role-perms strong {
  font-size: 14px;
}

.role-auto {
  margin: 8px 0 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--sl-success-soft);
  color: var(--sl-success);
  font-size: 11.5px;
  line-height: 1.45;
}

.role-perm {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  font-size: 12.5px;
}

.role-box {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--vp-c-default-3);
  border-radius: 4px;
}

.role-box.checked {
  border-color: var(--vp-c-brand-3);
  background: var(--vp-c-brand-3);
  color: #fff;
}

@media (max-width: 560px) {
  .role {
    grid-template-columns: 1fr;
  }

  .role-perms {
    margin-top: 0;
  }
}
</style>
