<script setup lang="ts">
import SlIcon from './SlIcon.vue';
</script>

<template>
  <div class="maint" aria-hidden="true">
    <div class="sl-mock maint-settings">
      <div class="maint-toggle">
        <div>
          <strong>Global Maintenance Mode</strong>
          <p>Every tenant workspace goes offline. The central app stays available.</p>
        </div>
        <span class="sl-switch sl-switch--on" />
      </div>
      <span class="sl-mock-label">Secret bypass link</span>
      <div class="maint-secret">
        <div class="sl-mock-input">8f2k1x-admin-access</div>
        <span class="maint-copy">Copy bypass link</span>
      </div>
      <span class="sl-mock-label maint-ips-label">Allowed IP addresses</span>
      <div class="sl-mock-input maint-ips">
        <span>203.0.113.10</span>
        <span>198.51.100.0/24</span>
      </div>
    </div>
    <div class="sl-mock maint-page">
      <div class="sl-mock-bar"><i /><i /><i /><span>acme.vue.test</span></div>
      <div class="maint-page-body">
        <span class="maint-gear"><SlIcon name="wrench" :size="26" /></span>
        <div class="maint-page-copy">
          <span class="sl-badge sl-badge--warning">503 · Under maintenance</span>
          <strong>We’ll Be Back Soon</strong>
          <p>Acme Technologies is currently undergoing scheduled maintenance. We’ll be back online shortly.</p>
          <div class="maint-progress"><i /></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.maint {
  display: grid;
  gap: 14px;
}

.maint-settings {
  padding: 18px 20px;
}

.maint-toggle {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--sl-border);
}

.maint-toggle strong {
  font-size: 14px;
}

.maint-toggle p {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.maint-secret {
  display: flex;
  gap: 8px;
}

.maint-secret .sl-mock-input {
  display: block;
  flex-grow: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
}

.maint-copy {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  padding: 0 12px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.maint-ips-label {
  margin-top: 12px;
}

.maint-ips {
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 6px;
  padding: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
}

.maint-ips span {
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--vp-c-default-soft);
}

.maint-page-body {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px;
  background: radial-gradient(60% 90% at 0% 50%, var(--vp-c-brand-soft), transparent 70%);
}

.maint-page-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.maint-gear {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--sl-gradient);
  color: #fff;
  box-shadow: 0 10px 24px -8px rgba(99, 102, 241, 0.6);
  animation: maint-float 3s ease-in-out infinite;
}

.maint-page-body strong {
  font-size: 16px;
  letter-spacing: -0.01em;
}

.maint-page-body p {
  font-size: 12px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.maint-progress {
  width: 140px;
  height: 4px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
}

.maint-progress i {
  display: block;
  width: 40%;
  height: 100%;
  border-radius: inherit;
  background: var(--sl-gradient);
  animation: maint-bar 2.4s ease-in-out infinite;
}

@keyframes maint-float {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }

  50% {
    transform: translateY(-4px) rotate(-8deg);
  }
}

@keyframes maint-bar {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(250%);
  }
}

@media (max-width: 560px) {
  .maint-page-body {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
