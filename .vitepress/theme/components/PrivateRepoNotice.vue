<script setup lang="ts">
import SlIcon from './SlIcon.vue';
</script>

<template>
  <aside class="notice" role="note" aria-labelledby="private-repo-title">
    <p id="private-repo-title" class="notice-title">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M12 3 2 20h20L12 3Z" fill="currentColor" />
        <path d="M12 10v4.5M12 17.2v.3" stroke="var(--notice-bg)" stroke-width="2.2" stroke-linecap="round" />
      </svg>
      Important
    </p>
    <p class="notice-text">
      Keep your copy of the kit in a <b>private</b> repository. If you push it to a public repository, anyone can see the
      full source code of the paid starter kit — and publishing it is not allowed under the
      <a href="/license.html">SaaS Laravel Commercial License</a>.
    </p>
    <p class="notice-text notice-small">
      Choose <b>Private</b> when you create the repository. Already created it as public? Open the repository's
      <b>Settings → General → Danger Zone → Change visibility</b> and switch it to private.
    </p>

    <div class="mock" aria-hidden="true">
      <span class="mock-trigger"><SlIcon name="lock" :size="14" /> Private <SlIcon name="chevron-down" :size="14" /></span>
      <div class="mock-menu">
        <div class="mock-option">
          <span class="mock-check" />
          <SlIcon name="globe" :size="16" />
          <span>
            <strong>Public</strong>
            <small>Anyone on the internet can see this repository.</small>
          </span>
        </div>
        <div class="mock-option mock-option--active">
          <span class="mock-check"><SlIcon name="check" :size="14" /></span>
          <SlIcon name="lock" :size="16" />
          <span>
            <strong>Private</strong>
            <small>You choose who can see and commit to this repository.</small>
          </span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.notice {
  --notice-bg: color-mix(in srgb, var(--sl-warning-soft) 100%, var(--vp-c-bg));
  margin: 24px 0;
  padding: 18px 22px 22px;
  border: 1px solid color-mix(in srgb, var(--sl-warning) 30%, transparent);
  border-left: 4px solid var(--sl-warning);
  border-radius: 12px;
  background: var(--sl-warning-soft);
}

.notice-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 !important;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--sl-warning);
}

.notice-text {
  margin: 10px 0 0 !important;
  font-size: 15px;
  line-height: 1.65;
  color: var(--vp-c-text-1);
}

.notice-small {
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.notice-text a {
  font-weight: 600;
}

.mock {
  max-width: 420px;
  margin-top: 18px;
  padding: 16px;
  border: 1px solid var(--sl-border);
  border-radius: 12px;
  background: var(--vp-c-bg);
}

.mock-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--sl-surface-muted);
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.mock-menu {
  margin-top: 8px;
  padding: 6px;
  border: 1px solid var(--sl-border);
  border-radius: 10px;
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow);
}

.mock-option {
  display: grid;
  grid-template-columns: 16px 16px 1fr;
  align-items: start;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  color: var(--vp-c-text-2);
}

.mock-option--active {
  background: var(--sl-surface-muted);
  color: var(--vp-c-text-1);
}

.mock-check {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  color: var(--sl-success);
}

.mock-option strong {
  display: block;
  font-size: 13.5px;
  color: var(--vp-c-text-1);
}

.mock-option small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
</style>
