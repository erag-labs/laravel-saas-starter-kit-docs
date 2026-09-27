<script setup lang="ts">
import FrameworkLogo from './FrameworkLogo.vue';
import SectionHeading from './SectionHeading.vue';

const tree: { name: string; depth: number; folder?: boolean; active?: boolean }[] = [
  { name: 'resources/js', depth: 0, folder: true },
  { name: 'components', depth: 1, folder: true },
  { name: 'common', depth: 2, folder: true },
  { name: 'CommonButton.vue', depth: 3 },
  { name: 'CommonInput.vue', depth: 3 },
  { name: 'ui', depth: 2, folder: true },
  { name: 'AppHeader.vue', depth: 2 },
  { name: 'AppLogo.vue', depth: 2, active: true },
  { name: 'AppSidebar.vue', depth: 2 },
  { name: 'layouts', depth: 1, folder: true },
  { name: 'app', depth: 2, folder: true },
  { name: 'auth', depth: 2, folder: true },
  { name: 'pages', depth: 1, folder: true },
  { name: 'auth', depth: 2, folder: true },
  { name: 'tenants', depth: 2, folder: true },
  { name: 'lang', depth: 1, folder: true },
];

const brands = [
  { name: 'Acme Workspace', domain: 'acme.vue.test', accent: '#4f46e5' },
  { name: 'Northwind CRM', domain: 'northwind.vue.test', accent: '#059669' },
  { name: 'Globex Portal', domain: 'globex.vue.test', accent: '#ea580c' },
];
</script>

<template>
  <section class="sl-section">
    <div class="sl-container">
      <SectionHeading
        :center="false"
        eyebrow="Customize"
        title="Customize everything"
        lead="All of the code lives in your application — components, layouts, pages and translations. Change anything, from the logo to the sign-in screen, and give every domain its own app name."
      />

      <div class="custom">
        <div class="tree" aria-hidden="true">
          <div
            v-for="(item, index) in tree"
            :key="`${item.name}-${index}`"
            class="tree-item"
            :class="{ 'tree-item--folder': item.folder, 'tree-item--active': item.active }"
            :style="{ paddingLeft: `${12 + item.depth * 16}px` }"
          >
            <span class="tree-icon">{{ item.folder ? '▾' : '·' }}</span>{{ item.name }}
          </div>
        </div>

        <div class="brands" aria-hidden="true">
          <div v-for="brand in brands" :key="brand.name" class="brand" :style="{ '--brand-accent': brand.accent }">
            <span class="brand-domain">{{ brand.domain }}</span>
            <span class="brand-logo"><FrameworkLogo name="laravel" color="#ffffff" :size="18" /></span>
            <strong>{{ brand.name }}</strong>
            <small>Log in to your account</small>
            <span class="brand-label">Email address</span>
            <span class="brand-field" />
            <span class="brand-label">Password</span>
            <span class="brand-field" />
            <span class="brand-button">Log in</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.custom {
  display: grid;
  grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
  gap: 20px;
}

.tree {
  padding: 16px 8px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-surface);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-2);
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 3px;
  padding-right: 12px;
  padding-bottom: 3px;
  line-height: 1.5;
  border-radius: 6px;
  white-space: nowrap;
}

.tree-item--folder {
  color: var(--vp-c-text-1);
}

.tree-item--active {
  background: var(--vp-c-brand-soft);
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

.tree-icon {
  width: 10px;
  color: var(--vp-c-text-3);
}

.brands {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 14px;
  padding: 24px;
  border: 1px solid var(--sl-border);
  border-radius: 24px;
  background: linear-gradient(160deg, var(--vp-c-brand-soft), transparent 60%), var(--sl-surface-muted);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 16px;
  border: 1px solid var(--sl-border);
  border-top: 3px solid var(--brand-accent);
  border-radius: 14px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
  font-size: 12px;
  color: var(--vp-c-text-1);
}

.brand:nth-child(2) {
  margin-top: 28px;
}

.brand:nth-child(3) {
  margin-top: 56px;
}

.brand-domain {
  align-self: flex-start;
  margin-bottom: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  color: var(--vp-c-text-2);
}

.brand-logo {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: var(--brand-accent);
}

.brand strong {
  font-size: 14px;
}

.brand small {
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--vp-c-text-2);
}

.brand-label {
  font-size: 10.5px;
  font-weight: 600;
}

.brand-field {
  height: 26px;
  margin-bottom: 4px;
  border: 1px solid var(--sl-border);
  border-radius: 6px;
}

.brand-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  margin-top: 4px;
  border-radius: 6px;
  line-height: 1;
  background: var(--brand-accent);
  font-size: 11.5px;
  font-weight: 600;
  text-align: center;
  color: #fff;
}

@media (max-width: 960px) {
  .custom {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .brands {
    grid-template-columns: 1fr;
    padding: 14px;
  }

  .brand:nth-child(n) {
    margin-top: 0;
  }

  .brand:nth-child(n + 2) {
    display: none;
  }
}
</style>
