<script setup lang="ts">
import FrameworkLogo from './FrameworkLogo.vue';
import SectionHeading from './SectionHeading.vue';
import SlIcon, { type IconName } from './SlIcon.vue';

const authScreens = [
  { title: 'Log in to your account', fields: ['Email address', 'Password'], action: 'Log in' },
  { title: 'Create an account', fields: ['Name', 'Email address', 'Password'], action: 'Create account' },
  { title: 'Forgot password', fields: ['Email address'], action: 'Email password reset link' },
];

const sidebarItems: { label: string; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'layout-grid' },
  { label: 'Tenants', icon: 'building' },
  { label: 'Users', icon: 'users' },
  { label: 'Roles', icon: 'shield' },
];

const settingsTabs = ['Profile', 'Security', 'Appearance', 'Layout'];

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: 'layout', title: 'Configurable layouts', text: 'Sidebar or header app layouts and card, simple or split sign-in pages.' },
  { icon: 'wrench', title: 'Fully customizable', text: 'All the code lives in your application, so you control everything.' },
  { icon: 'layers', title: 'Vue, React or Svelte', text: 'The same Laravel backend with the frontend you already know.' },
  { icon: 'zap', title: 'Tailwind CSS v4', text: 'Built with the latest Tailwind CSS utilities and design tokens.' },
  { icon: 'code', title: 'TypeScript supported', text: 'Typed routes with Wayfinder and types generated from Data classes.' },
  { icon: 'package', title: 'shadcn UI', text: 'shadcn-vue, shadcn/ui and shadcn-svelte components in every kit.' },
  { icon: 'git', title: 'Built-in CI workflow', text: 'A GitHub Actions workflow runs the test suite on pushes to main and on pull requests.' },
  { icon: 'sun', title: 'Light and dark', text: 'Light, dark and system appearance, remembered in the browser.' },
];
</script>

<template>
  <section class="sl-section box">
    <div class="sl-container">
      <SectionHeading
        :center="false"
        eyebrow="Out of the box"
        title="An authenticated application out of the box"
        lead="Authentication, an admin dashboard and user settings are ready the moment you install a kit."
      />

      <div class="bento">
        <div class="cell">
          <div class="cell-head">
            <span class="cell-title"><SlIcon name="lock" :size="16" /> Built-in authentication</span>
            <span class="sl-badge sl-badge--brand">Fortify</span>
          </div>
          <p class="cell-text">Login, registration, password reset, email verification and password confirmation.</p>
          <div class="cell-visual auth-screens">
            <div v-for="screen in authScreens" :key="screen.title" class="auth-screen">
              <FrameworkLogo name="laravel" :size="20" />
              <strong>{{ screen.title }}</strong>
              <div v-for="field in screen.fields" :key="field" class="auth-field">
                <span>{{ field }}</span>
                <i />
              </div>
              <span class="auth-button">{{ screen.action }}</span>
            </div>
          </div>
        </div>

        <div class="cell">
          <div class="cell-head">
            <span class="cell-title"><SlIcon name="key" :size="16" /> Passkeys &amp; two-factor</span>
            <span class="sl-badge sl-badge--success">Built in</span>
          </div>
          <p class="cell-text">Passwordless sign-in with passkeys, TOTP two-factor codes and recovery codes.</p>
          <div class="cell-visual secure">
            <div class="secure-card">
              <strong>Log in to your account</strong>
              <span class="secure-passkey"><SlIcon name="key" :size="13" /> Sign in with a passkey</span>
              <span class="secure-or">Or continue with email</span>
              <i class="secure-line" />
              <i class="secure-line" />
              <span class="secure-button">Log in</span>
            </div>
            <div class="secure-card secure-card--otp">
              <strong>Authentication code</strong>
              <div class="secure-digits">
                <span>4</span><span>8</span><span>1</span><span>9</span><span class="secure-digit--active" /><span />
              </div>
              <span class="secure-button">Continue</span>
              <span class="secure-recovery">or you can <u>login using a recovery code</u></span>
            </div>
          </div>
        </div>

        <div class="cell">
          <div class="cell-head">
            <span class="cell-title"><SlIcon name="layout-grid" :size="16" /> Admin dashboard</span>
          </div>
          <p class="cell-text">A clean app shell to start building your SaaS, with permission-aware navigation.</p>
          <div class="cell-visual shell">
            <aside class="shell-side">
              <span class="shell-brand"><FrameworkLogo name="laravel" :size="14" /><span>Acme Workspace</span></span>
              <span class="shell-group">Platform</span>
              <span v-for="(item, index) in sidebarItems" :key="item.label" class="shell-item" :class="{ 'shell-item--active': index === 0 }">
                <SlIcon :name="item.icon" :size="12" />{{ item.label }}
              </span>
            </aside>
            <div class="shell-main">
              <span class="shell-crumb">Dashboard</span>
              <div class="shell-tiles"><i /><i /><i /></div>
              <i class="shell-panel" />
            </div>
          </div>
        </div>

        <div class="cell">
          <div class="cell-head">
            <span class="cell-title"><SlIcon name="settings" :size="16" /> User settings</span>
          </div>
          <p class="cell-text">Built-in profile, password, two-factor, appearance and layout management.</p>
          <div class="cell-visual settings">
            <div class="settings-nav">
              <span v-for="(tab, index) in settingsTabs" :key="tab" :class="{ 'settings-tab--active': index === 0 }">{{ tab }}</span>
            </div>
            <div class="settings-body">
              <strong>Profile</strong>
              <span class="settings-hint">Update your name and email address</span>
              <span class="sl-mock-label">Name</span>
              <div class="sl-mock-input">Taylor Admin</div>
              <span class="sl-mock-label settings-gap">Language</span>
              <div class="sl-mock-input">English <SlIcon name="chevron-down" :size="12" /></div>
            </div>
          </div>
        </div>
      </div>

      <div class="matrix">
        <div v-for="feature in features" :key="feature.title" class="matrix-cell">
          <span class="matrix-title"><SlIcon :name="feature.icon" :size="16" /> {{ feature.title }}</span>
          <p>{{ feature.text }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.box {
  border-top: 1px solid var(--sl-border);
}

.bento {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  overflow: hidden;
  background: var(--sl-surface);
}

.cell {
  display: flex;
  flex-direction: column;
  padding: 24px;
  border-right: 1px solid var(--sl-border);
  border-bottom: 1px solid var(--sl-border);
}

.cell:nth-child(2n) {
  border-right: 0;
}

.cell:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.cell-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cell-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.cell-title :deep(svg) {
  color: var(--vp-c-brand-1);
}

.cell-text {
  margin: 6px 0 20px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.cell-visual {
  flex: 1;
  min-height: 220px;
  padding: 18px;
  border: 1px solid var(--sl-border);
  border-radius: 12px;
  background:
    radial-gradient(circle at 1px 1px, var(--sl-border) 1px, transparent 0) 0 0 / 14px 14px,
    var(--sl-surface-muted);
  font-size: 11px;
  color: var(--vp-c-text-1);
}

.auth-screens {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 10px;
}

.auth-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 10px;
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
}

.auth-screen:nth-child(2) {
  margin-top: 18px;
}

.auth-screen strong {
  font-size: 10.5px;
  text-align: center;
}

.auth-field {
  display: grid;
  gap: 3px;
  width: 100%;
  font-size: 9px;
  color: var(--vp-c-text-2);
}

.auth-field i {
  height: 18px;
  border: 1px solid var(--sl-border);
  border-radius: 4px;
}

.auth-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 20px;
  margin-top: 2px;
  padding: 0 4px;
  border-radius: 5px;
  line-height: 1;
  background: var(--vp-c-text-1);
  font-size: 9px;
  font-weight: 600;
  text-align: center;
  color: var(--vp-c-bg);
}

.secure {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  align-items: start;
  gap: 12px;
}

.secure-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
}

.secure-card--otp {
  margin-top: 26px;
}

.secure-card strong {
  font-size: 11.5px;
}

.secure-passkey {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 24px;
  line-height: 1;
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  font-weight: 600;
}

.secure-or {
  font-size: 9.5px;
  text-align: center;
  color: var(--vp-c-text-3);
}

.secure-line {
  height: 16px;
  border: 1px solid var(--sl-border);
  border-radius: 5px;
}

.secure-digits {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
}

.secure-digits span {
  display: grid;
  place-items: center;
  height: 24px;
  border: 1px solid var(--sl-border);
  border-radius: 5px;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
}

.secure-digits .secure-digit--active {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}

.secure-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  border-radius: 5px;
  background: var(--vp-c-text-1);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  color: var(--vp-c-bg);
}

.secure-recovery {
  font-size: 9.5px;
  text-align: center;
  color: var(--vp-c-text-3);
}

.secure-recovery u {
  color: var(--vp-c-text-2);
  text-underline-offset: 2px;
}

.shell {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  padding: 0;
  overflow: hidden;
}

.shell-side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding: 12px 8px;
  border-right: 1px solid var(--sl-border);
  background: var(--sl-surface);
}

.shell-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 0 4px 10px;
  font-weight: 700;
  white-space: nowrap;
}

.shell-brand span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.shell-brand :deep(svg) {
  flex-shrink: 0;
}

.shell-group {
  margin: 0 4px 4px;
  font-size: 9.5px;
  color: var(--vp-c-text-3);
}

.shell-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 5px;
  color: var(--vp-c-text-2);
}

.shell-item--active {
  background: var(--vp-c-default-soft);
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.shell-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.shell-crumb {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--sl-border);
  font-weight: 600;
}

.shell-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.shell-tiles i,
.shell-panel {
  height: 48px;
  border: 1px dashed var(--sl-border-strong);
  border-radius: 8px;
  background: repeating-linear-gradient(135deg, transparent 0 6px, var(--vp-c-brand-soft) 6px 7px);
}

.shell-panel {
  flex: 1;
  min-height: 70px;
}

.settings {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 14px;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-nav span {
  padding: 5px 8px;
  border-radius: 5px;
  color: var(--vp-c-text-2);
}

.settings-nav .settings-tab--active {
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow-sm);
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.settings-body {
  display: flex;
  flex-direction: column;
  padding: 14px;
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  background: var(--sl-surface);
}

.settings-body strong {
  font-size: 12px;
}

.settings-hint {
  margin: 2px 0 10px;
  font-size: 10px;
  color: var(--vp-c-text-2);
}

.settings-body .sl-mock-label {
  font-size: 10.5px;
}

.settings-body .sl-mock-input {
  min-height: 26px;
  font-size: 11px;
}

.settings-gap {
  margin-top: 8px !important;
}

.matrix {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 24px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  overflow: hidden;
  background: var(--sl-surface);
}

.matrix-cell {
  padding: 20px 22px;
  border-right: 1px solid var(--sl-border);
  border-bottom: 1px solid var(--sl-border);
}

.matrix-cell:nth-child(4n) {
  border-right: 0;
}

.matrix-cell:nth-last-child(-n + 4) {
  border-bottom: 0;
}

.matrix-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.matrix-title :deep(svg) {
  color: var(--vp-c-brand-1);
}

.matrix-cell p {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

@media (max-width: 960px) {
  .matrix {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .matrix-cell:nth-child(4n) {
    border-right: 1px solid var(--sl-border);
  }

  .matrix-cell:nth-child(2n) {
    border-right: 0;
  }

  .matrix-cell:nth-last-child(-n + 4) {
    border-bottom: 1px solid var(--sl-border);
  }

  .matrix-cell:nth-last-child(-n + 2) {
    border-bottom: 0;
  }
}

@media (max-width: 760px) {
  .bento {
    grid-template-columns: 1fr;
  }

  .cell,
  .cell:nth-child(2n) {
    border-right: 0;
  }

  .cell:nth-last-child(-n + 2) {
    border-bottom: 1px solid var(--sl-border);
  }

  .cell:last-child {
    border-bottom: 0;
  }
}

@media (max-width: 560px) {
  .cell {
    padding: 18px;
  }

  .auth-screens {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .auth-screen:nth-child(3) {
    display: none;
  }

  .secure,
  .settings {
    grid-template-columns: 1fr;
  }

  .secure-card--otp {
    margin-top: 0;
  }

  .settings-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .matrix {
    grid-template-columns: 1fr;
  }

  .matrix-cell,
  .matrix-cell:nth-child(4n) {
    border-right: 0;
  }

  .matrix-cell:nth-last-child(-n + 4),
  .matrix-cell:nth-last-child(-n + 2) {
    border-bottom: 1px solid var(--sl-border);
  }

  .matrix-cell:last-child {
    border-bottom: 0;
  }
}
</style>
