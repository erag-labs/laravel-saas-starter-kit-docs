<script setup lang="ts">
const authLayouts = [
  { key: 'card', label: 'Card', active: true },
  { key: 'simple', label: 'Simple', active: false },
  { key: 'split', label: 'Split', active: false },
];

const appLayouts = [
  { key: 'sidebar', label: 'Sidebar', active: false },
  { key: 'header', label: 'Top Nav', active: true },
];

const groups = [
  {
    title: 'Sidebar Variant',
    options: [
      { label: 'Inset', description: 'Floating frame', active: true },
      { label: 'Sidebar', description: 'Edge to edge', active: false },
      { label: 'Floating', description: 'Island style', active: false },
    ],
  },
  {
    title: 'Collapsible Mode',
    options: [
      { label: 'Icon Rail', description: 'Collapse to icon rail', active: true },
      { label: 'Offcanvas', description: 'Slide-out drawer', active: false },
      { label: 'None', description: 'Always expanded', active: false },
    ],
  },
];
</script>

<template>
  <div class="layouts" aria-hidden="true">
    <div class="sl-mock layouts-default">
      <strong>Default Authentication Layout</strong>
      <p>Login, Register, Password Reset and 2FA screens.</p>
      <div class="layouts-tiles layouts-tiles--three">
        <div v-for="layout in authLayouts" :key="layout.key" class="layouts-tile" :class="{ 'layouts-tile--active': layout.active }">
          <div class="layouts-preview" :class="`layouts-preview--${layout.key}`">
            <span class="layouts-dark" />
            <span class="layouts-box">
              <i class="layouts-dot" />
              <i class="layouts-line" />
              <i class="layouts-line layouts-line--wide" />
            </span>
          </div>
          <span class="layouts-label">{{ layout.label }}</span>
        </div>
      </div>
      <strong class="layouts-gap">Default Application Layout</strong>
      <p>For newly registered users and visitors.</p>
      <div class="layouts-tiles">
        <div v-for="layout in appLayouts" :key="layout.key" class="layouts-tile" :class="{ 'layouts-tile--active': layout.active }">
          <div class="layouts-preview" :class="`layouts-preview--${layout.key}`">
            <span class="layouts-nav" />
            <span class="layouts-main" />
          </div>
          <span class="layouts-label">{{ layout.label }}</span>
        </div>
      </div>
    </div>
    <div class="sl-mock layouts-personal">
      <strong>Workspace Layout</strong>
      <p>Each user can override the defaults.</p>
      <div v-for="group in groups" :key="group.title" class="layouts-group">
        <span class="sl-mock-label">{{ group.title }}</span>
        <div class="layouts-options">
          <div v-for="option in group.options" :key="option.label" class="layouts-option" :class="{ 'layouts-option--active': option.active }">
            <b>{{ option.label }}</b>
            <small>{{ option.description }}</small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layouts {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  align-items: start;
  gap: 14px;
}

.layouts-default,
.layouts-personal {
  padding: 16px;
}

.layouts-personal {
  margin-top: 28px;
}

.layouts strong {
  display: block;
  font-size: 13px;
}

.layouts p {
  margin: 2px 0 10px;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--vp-c-text-2);
}

.layouts-gap {
  margin-top: 14px;
}

.layouts-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.layouts-tiles--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.layouts-tile {
  padding: 6px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.layouts-tile--active {
  border-color: var(--vp-c-text-1);
  box-shadow: 0 0 0 1px var(--vp-c-text-1);
}

.layouts-label {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
}

.layouts-preview {
  position: relative;
  display: flex;
  height: 46px;
  overflow: hidden;
  border-radius: 5px;
  background: var(--vp-c-default-soft);
}

.layouts-dark,
.layouts-nav,
.layouts-main {
  display: none;
}

.layouts-box {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.layouts-preview--card .layouts-box {
  flex: none;
  width: 60%;
  margin: 8px auto;
  border-radius: 4px;
  background: var(--vp-c-bg);
}

.layouts-preview--split .layouts-dark {
  display: block;
  width: 45%;
  background: var(--vp-c-text-1);
}

.layouts-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--vp-c-text-2);
}

.layouts-line {
  width: 40%;
  height: 2px;
  border-radius: 2px;
  background: var(--vp-c-text-3);
}

.layouts-line--wide {
  width: 70%;
}

.layouts-preview--sidebar .layouts-box,
.layouts-preview--header .layouts-box {
  display: none;
}

.layouts-preview--sidebar .layouts-nav,
.layouts-preview--header .layouts-nav,
.layouts-preview--sidebar .layouts-main,
.layouts-preview--header .layouts-main {
  display: block;
}

.layouts-preview--sidebar .layouts-nav {
  width: 28%;
  margin: 5px 0 5px 5px;
  border-radius: 3px;
  background: var(--vp-c-text-3);
  opacity: 0.45;
}

.layouts-preview--header {
  flex-direction: column;
}

.layouts-preview--header .layouts-nav {
  height: 8px;
  margin: 5px 5px 0;
  border-radius: 3px;
  background: var(--vp-c-text-3);
  opacity: 0.45;
}

.layouts-main {
  flex: 1;
  margin: 5px;
  border-radius: 3px;
  background: var(--vp-c-bg);
}

.layouts-group {
  margin-top: 12px;
}

.layouts-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.layouts-option {
  padding: 7px 4px;
  border: 1px solid var(--sl-border);
  border-radius: 7px;
  background: var(--vp-c-bg);
  text-align: center;
}

.layouts-option b {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
}

.layouts-option small {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  line-height: 1.3;
  color: var(--vp-c-text-3);
}

.layouts-option--active {
  border-color: var(--vp-c-text-3);
  background: var(--vp-c-default-soft);
}

@media (max-width: 560px) {
  .layouts {
    grid-template-columns: 1fr;
  }

  .layouts-personal {
    margin-top: 0;
  }
}
</style>
