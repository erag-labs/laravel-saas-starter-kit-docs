<script setup lang="ts">
import SlIcon from './SlIcon.vue';

const digits = ['4', '8', '1', '9', '', ''];
</script>

<template>
  <div class="auth" aria-hidden="true">
    <div class="sl-mock auth-login">
      <div class="auth-head">
        <strong>Log in to your account</strong>
        <p>Enter your email and password below to log in</p>
      </div>
      <button class="auth-passkey" type="button" tabindex="-1">
        <SlIcon name="key" :size="14" />
        Sign in with a passkey
      </button>
      <div class="auth-separator"><span>Or continue with email</span></div>
      <span class="sl-mock-label">Email address</span>
      <div class="sl-mock-input">admin@acme.test</div>
      <span class="sl-mock-label auth-gap">Password</span>
      <div class="sl-mock-input">••••••••••</div>
      <span class="auth-submit">Log in</span>
    </div>
    <div class="sl-mock auth-otp">
      <span class="auth-otp-icon"><SlIcon name="shield" :size="16" /></span>
      <strong>Authentication code</strong>
      <p>Enter the authentication code provided by your authenticator application.</p>
      <div class="auth-digits">
        <span v-for="(digit, index) in digits" :key="index" :class="{ 'auth-digit--active': index === 4 }">{{ digit }}</span>
      </div>
      <p class="auth-recovery">or you can <b>login using a recovery code</b></p>
    </div>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  align-items: start;
  gap: 14px;
}

.auth-login,
.auth-otp {
  padding: 18px;
}

.auth-otp {
  margin-top: 28px;
}

.auth-head strong,
.auth-otp strong {
  display: block;
  font-size: 14px;
}

.auth-head p,
.auth-otp p {
  margin: 4px 0 14px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.auth-passkey {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  cursor: default;
}

.auth-separator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0;
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.auth-separator::before,
.auth-separator::after {
  flex: 1;
  height: 1px;
  background: var(--sl-border);
  content: '';
}

.auth-gap {
  margin-top: 10px;
}

.auth-submit {
  display: block;
  margin-top: 14px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--vp-button-brand-bg);
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  color: #fff;
}

.auth-otp-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-bottom: 10px;
  border-radius: 10px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.auth-digits {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}

.auth-digits span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  border: 1px solid var(--sl-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  font-weight: 600;
}

.auth-digits .auth-digit--active {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}

.auth-recovery {
  margin-bottom: 0 !important;
}

.auth-recovery b {
  font-weight: 500;
  color: var(--vp-c-text-1);
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 560px) {
  .auth {
    grid-template-columns: 1fr;
  }

  .auth-otp {
    margin-top: 0;
  }
}
</style>
