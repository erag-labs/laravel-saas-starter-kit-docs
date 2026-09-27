<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FrameworkKey } from '../../site';
import FrameworkLogo from './FrameworkLogo.vue';
import SectionHeading from './SectionHeading.vue';

type Group = 'auth' | 'app';
type LayoutKey = 'card' | 'simple' | 'split' | 'sidebar' | 'header';

const layouts: Record<Group, { key: LayoutKey; label: string; files: Record<FrameworkKey, string> }[]> = {
  auth: [
    { key: 'card', label: 'Card', files: { vue: 'AuthCardLayout.vue', react: 'auth-card-layout.tsx', svelte: 'AuthCardLayout.svelte' } },
    { key: 'simple', label: 'Simple', files: { vue: 'AuthSimpleLayout.vue', react: 'auth-simple-layout.tsx', svelte: 'AuthSimpleLayout.svelte' } },
    { key: 'split', label: 'Split', files: { vue: 'AuthSplitLayout.vue', react: 'auth-split-layout.tsx', svelte: 'AuthSplitLayout.svelte' } },
  ],
  app: [
    { key: 'sidebar', label: 'Sidebar', files: { vue: 'AppSidebarLayout.vue', react: 'app-sidebar-layout.tsx', svelte: 'AppSidebarLayout.svelte' } },
    { key: 'header', label: 'Header', files: { vue: 'AppHeaderLayout.vue', react: 'app-header-layout.tsx', svelte: 'AppHeaderLayout.svelte' } },
  ],
};

const frameworks: FrameworkKey[] = ['vue', 'react', 'svelte'];

const group = ref<Group>('auth');
const framework = ref<FrameworkKey>('vue');
const selected = ref<Record<Group, LayoutKey>>({ auth: 'split', app: 'sidebar' });

const active = computed(() => selected.value[group.value]);

const selectGroup = (value: Group) => {
  group.value = value;
};

const selectLayout = (value: LayoutKey) => {
  selected.value = { ...selected.value, [group.value]: value };
};
</script>

<template>
  <section class="sl-section sl-section--muted">
    <div class="sl-container">
      <SectionHeading
        :center="false"
        eyebrow="Layouts"
        title="Configurable responsive layouts"
        lead="Pick a card, simple or split sign-in page and a sidebar or header app layout. Set the defaults in Setup → Layout Settings; every user can override them."
      />

      <div class="playground">
        <div class="editor">
          <div class="editor-tabs" role="tablist">
            <button type="button" role="tab" :aria-selected="group === 'auth'" :class="{ active: group === 'auth' }" @click="selectGroup('auth')">
              layouts/auth
            </button>
            <button type="button" role="tab" :aria-selected="group === 'app'" :class="{ active: group === 'app' }" @click="selectGroup('app')">
              layouts/app
            </button>
          </div>
          <div class="editor-body">
            <p class="editor-path">resources/js/layouts/{{ group }}/</p>
            <button
              v-for="layout in layouts[group]"
              :key="layout.key"
              type="button"
              class="editor-file"
              :class="{ active: active === layout.key }"
              @click="selectLayout(layout.key)"
            >
              <span class="editor-dot" />{{ layout.files[framework] }}
              <span class="editor-label">{{ layout.label }}</span>
            </button>
          </div>
          <div class="editor-frameworks">
            <button
              v-for="key in frameworks"
              :key="key"
              type="button"
              :class="{ active: framework === key }"
              :aria-label="key"
              @click="framework = key"
            >
              <FrameworkLogo :name="key" :size="14" />
            </button>
          </div>
        </div>

        <div class="preview" aria-hidden="true">
          <div class="preview-bar"><i /><i /><i /><span>acme.vue.test</span></div>
          <div class="preview-screen" :class="`preview-screen--${active}`">
            <template v-if="group === 'auth'">
              <div v-if="active === 'split'" class="preview-hero">
                <span class="preview-brand"><FrameworkLogo name="laravel" :size="16" />Acme Workspace</span>
              </div>
              <div class="preview-form">
                <FrameworkLogo name="laravel" :size="28" />
                <strong>Log in to your account</strong>
                <small>Enter your email and password below to log in</small>
                <span class="preview-field" />
                <span class="preview-field" />
                <span class="preview-button">Log in</span>
              </div>
            </template>
            <template v-else>
              <aside v-if="active === 'sidebar'" class="preview-side">
                <span class="preview-brand"><FrameworkLogo name="laravel" :size="16" />Acme</span>
                <span v-for="index in 5" :key="index" class="preview-nav" :class="{ active: index === 1 }" />
              </aside>
              <div v-else class="preview-top">
                <span class="preview-brand"><FrameworkLogo name="laravel" :size="16" />Acme</span>
                <span v-for="index in 4" :key="index" class="preview-link" :class="{ active: index === 1 }" />
              </div>
              <div class="preview-content">
                <div class="preview-tiles"><i /><i /><i /></div>
                <i class="preview-panel" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.playground {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 20px;
  padding: 20px;
  border: 1px solid var(--sl-border);
  border-radius: 24px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
}

.editor {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  background: #0f0f1a;
  color: #c7c9e0;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

.editor button {
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.editor-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: #0a0a12;
}

.editor-tabs button {
  padding: 12px 16px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  color: #7c7f99;
}

.editor-tabs button.active {
  background: #0f0f1a;
  color: #fff;
  box-shadow: inset 0 -2px 0 #818cf8;
}

.editor-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  padding: 18px 12px;
}

.editor-path {
  margin: 0 8px 10px;
  font-size: 12px;
  color: #7c7f99;
}

.editor-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  text-align: left;
}

.editor-file:hover {
  background: rgba(255, 255, 255, 0.04);
}

.editor-file.active {
  background: rgba(129, 140, 248, 0.16);
  color: #fff;
}

.editor-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4b4d66;
}

.editor-file.active .editor-dot {
  background: #818cf8;
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.25);
}

.editor-label {
  margin-left: auto;
  font-family: var(--vp-font-family-base);
  font-size: 11px;
  color: #7c7f99;
}

.editor-frameworks {
  display: flex;
  gap: 6px;
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.editor-frameworks button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  opacity: 0.55;
}

.editor-frameworks button.active {
  background: rgba(255, 255, 255, 0.08);
  opacity: 1;
}

.preview {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--sl-border);
  border-radius: 14px;
  background: var(--sl-surface-muted);
}

.preview-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--sl-border);
  background: var(--sl-surface);
}

.preview-bar i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--vp-c-default-soft);
}

.preview-bar span {
  margin-left: 10px;
  padding: 2px 10px;
  border-radius: 6px;
  background: var(--vp-c-default-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-text-2);
}

.preview-screen {
  display: flex;
  flex: 1;
  min-height: 330px;
  font-size: 12px;
  color: var(--vp-c-text-1);
}

.preview-screen--card,
.preview-screen--simple {
  align-items: center;
  justify-content: center;
}

.preview-screen--simple {
  background: var(--sl-surface);
}

.preview-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 240px;
  padding: 24px;
}

.preview-screen--card .preview-form {
  border: 1px solid var(--sl-border);
  border-radius: 14px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
}

.preview-screen--split .preview-form {
  flex: 1;
  justify-content: center;
  width: auto;
  background: var(--sl-surface);
}

.preview-form strong {
  font-size: 13.5px;
}

.preview-form small {
  margin-bottom: 4px;
  font-size: 10.5px;
  text-align: center;
  color: var(--vp-c-text-2);
}

.preview-field {
  width: 100%;
  max-width: 200px;
  height: 26px;
  border: 1px solid var(--sl-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
}

.preview-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 200px;
  height: 28px;
  margin-top: 4px;
  border-radius: 6px;
  line-height: 1;
  background: var(--vp-c-text-1);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  color: var(--vp-c-bg);
}

.preview-hero {
  display: flex;
  flex: 1;
  padding: 18px;
  background: #18181b;
  color: #fff;
}

.preview-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  white-space: nowrap;
}

.preview-screen--sidebar,
.preview-screen--header {
  align-items: stretch;
}

.preview-screen--header {
  flex-direction: column;
}

.preview-side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 130px;
  padding: 14px 10px;
  border-right: 1px solid var(--sl-border);
  background: var(--sl-surface);
}

.preview-side .preview-brand {
  margin-bottom: 8px;
}

.preview-nav {
  height: 20px;
  border-radius: 5px;
  background: var(--vp-c-default-soft);
  opacity: 0.6;
}

.preview-nav.active {
  background: var(--vp-c-brand-soft);
  opacity: 1;
}

.preview-top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--sl-border);
  background: var(--sl-surface);
}

.preview-link {
  width: 44px;
  height: 10px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
}

.preview-link.active {
  background: var(--vp-c-brand-soft);
}

.preview-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.preview-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.preview-tiles i,
.preview-panel {
  height: 70px;
  border: 1px dashed var(--sl-border-strong);
  border-radius: 10px;
  background: repeating-linear-gradient(135deg, transparent 0 6px, var(--vp-c-brand-soft) 6px 7px);
}

.preview-panel {
  flex: 1;
}

@media (max-width: 960px) {
  .playground {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .playground {
    padding: 12px;
    border-radius: 18px;
  }

  .preview-screen {
    min-height: 280px;
  }

  .preview-hero {
    display: none;
  }

  .preview-side {
    width: 90px;
  }
}
</style>
