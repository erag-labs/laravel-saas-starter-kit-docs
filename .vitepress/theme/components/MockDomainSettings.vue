<script setup lang="ts">
import SlIcon from './SlIcon.vue';

const features = [
  { label: 'User Registration', on: true },
  { label: 'Password Reset', on: true },
  { label: 'Email Verification', on: false },
  { label: 'Two-Factor Authentication', on: true },
  { label: 'Passkeys', on: true },
];
</script>

<template>
  <div class="domain" aria-hidden="true">
    <div class="sl-mock domain-dialog">
      <div class="domain-head">
        <strong>Domain Settings</strong>
        <p>Customize how <b>acme.vue.test</b> is branded and which language it uses by default.</p>
      </div>
      <div class="domain-fields">
        <div class="domain-field">
          <span class="sl-mock-label">App name</span>
          <div class="sl-mock-input">Acme Workspace</div>
        </div>
        <div class="domain-field">
          <span class="sl-mock-label">Default language</span>
          <div class="sl-mock-input">Spanish <SlIcon name="chevron-down" :size="14" /></div>
        </div>
      </div>
      <div class="domain-footer">
        <p class="sl-mock-hint">Shown in the sidebar, sign-in pages and emails for this domain.</p>
        <div class="domain-actions">
          <span class="domain-cancel">Cancel</span>
          <span class="domain-save">Save Settings</span>
        </div>
      </div>
    </div>
    <div class="sl-mock domain-features">
      <div class="domain-features-head">
        <strong>Authentication Features</strong>
        <span class="sl-badge sl-badge--brand">acme.vue.test</span>
      </div>
      <div class="domain-feature-grid">
        <div v-for="feature in features" :key="feature.label" class="domain-feature">
          <span class="domain-check" :class="{ 'domain-check--on': feature.on }">
            <SlIcon v-if="feature.on" name="check" :size="11" />
          </span>
          <span>{{ feature.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.domain {
  display: grid;
  gap: 14px;
}

.domain-dialog,
.domain-features {
  padding: 18px 20px;
}

.domain-head strong,
.domain-features-head strong {
  font-size: 14px;
}

.domain-head p {
  margin: 2px 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.domain-head b {
  font-family: var(--vp-font-family-mono);
  font-weight: 500;
  font-size: 11.5px;
}

.domain-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.domain-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-top: 12px;
}

.domain-footer .sl-mock-hint {
  flex: 1 1 180px;
  margin: 0;
}

.domain-actions {
  display: flex;
  gap: 8px;
}

.domain-actions span {
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.domain-cancel {
  border: 1px solid var(--sl-border);
}

.domain-save {
  background: var(--vp-button-brand-bg);
  color: #fff;
}

.domain-features-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.domain-feature-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 20px;
}

.domain-feature {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  white-space: nowrap;
  border-top: 1px solid var(--sl-border);
  font-size: 12.5px;
}

.domain-check {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--sl-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
}

.domain-check--on {
  border-color: var(--vp-button-brand-bg);
  background: var(--vp-button-brand-bg);
  color: #fff;
}

@media (max-width: 560px) {
  .domain-fields,
  .domain-feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
