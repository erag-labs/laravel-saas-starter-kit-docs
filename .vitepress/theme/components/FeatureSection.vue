<script setup lang="ts">
import type { Component } from 'vue';
import MockAuth from './MockAuth.vue';
import MockDomainSettings from './MockDomainSettings.vue';
import MockLanguages from './MockLanguages.vue';
import MockLayouts from './MockLayouts.vue';
import MockMaintenance from './MockMaintenance.vue';
import MockMenus from './MockMenus.vue';
import MockRoleSelect from './MockRoleSelect.vue';
import MockTenantProvision from './MockTenantProvision.vue';
import SectionHeading from './SectionHeading.vue';
import SlIcon, { type IconName } from './SlIcon.vue';

const rows: { eyebrow: string; title: string; text: string; points: string[]; docs: string; visual: Component }[] = [
  {
    eyebrow: 'Multi-tenancy',
    title: 'A separate database for every tenant',
    text: 'Create a tenant and the kit provisions its database, runs tenant migrations, seeds roles, permissions and menus, then creates the primary administrator.',
    points: [
      'Subdomain identification on <sub>.APP_DOMAIN',
      'Workspace status: Active, Trial, Pending Invitation, Suspended',
      'Signed invitation link for the tenant admin, with resend',
      'Admin password reset by email link or set manually',
      'Tenant list with search, status filter and stats',
      'Tenant profile: industry, team size, work week, registration and tax numbers',
    ],
    docs: '/docs/core/multi-tenancy.html',
    visual: MockTenantProvision,
  },
  {
    eyebrow: 'Domains',
    title: 'Brand and configure every domain',
    text: 'Each tenant can have primary and secondary domains. Every domain gets its own app name, default language and sign-in features.',
    points: [
      'Add domains, set the primary, protect it from deletion',
      'App name shown in the sidebar, auth pages and emails',
      'Default language per domain, users can still choose their own',
      'Per-domain registration, password reset, 2FA and passkeys',
      'Domains page with search and primary / secondary filters',
      'Language shown for every domain in the domains table',
      'All domains of a tenant share the same tenant database',
    ],
    docs: '/docs/core/domains.html',
    visual: MockDomainSettings,
  },
  {
    eyebrow: 'Users, roles & permissions',
    title: 'Access control that is ready on day one',
    text: 'Spatie roles and permissions for both the central app and every tenant. System roles receive their default permissions automatically.',
    points: [
      'Users list with search, stats and pagination',
      'Role select on create and edit — system roles get their default permissions, custom roles none',
      'Assign individual permissions per user, grouped by module',
      'Queued invitation emails with a signed 7-day link and an “Invitation pending” badge',
      'Protected system roles plus your own custom roles',
      'Central and tenant permissions in config/permissions/*.php and config/permissions/tenant/*.php',
      'Super admin passes every permission check',
      'Permission-aware menus and buttons in the frontend',
    ],
    docs: '/docs/core/users-roles-permissions.html',
    visual: MockRoleSelect,
  },
  {
    eyebrow: 'Maintenance & suspension',
    title: 'Take workspaces offline — safely',
    text: 'Switch every tenant workspace into maintenance from Setup → Tenant Settings while the central app stays online.',
    points: [
      'Custom message on an animated 503 page',
      'Secret bypass link that unlocks a workspace for 12 hours',
      'Allowed IP addresses and CIDR ranges skip the maintenance page',
      'Tenant login stays reachable so admins can sign in and bypass',
      'Suspend a single workspace with its own message',
      'Suspended workspaces show a full-page notice with a default message',
      'The central app stays online the whole time',
    ],
    docs: '/docs/core/maintenance-and-suspension.html',
    visual: MockMaintenance,
  },
  {
    eyebrow: 'Authentication',
    title: 'Secure sign-in out of the box',
    text: 'Laravel Fortify powers every auth flow for the central app and each tenant, with modern options like passkeys built in.',
    points: [
      'Login, registration and password reset',
      'Email verification and password confirmation',
      'Two-factor authentication with recovery codes',
      'Passwordless sign-in with passkeys',
      'Turn each auth feature on or off per domain',
      'Profile, password and account deletion settings',
      'Separate central and tenant guards and databases',
    ],
    docs: '/docs/core/authentication.html',
    visual: MockAuth,
  },
  {
    eyebrow: 'Localization',
    title: '17 languages, translated end to end',
    text: 'Every screen, menu, email and validation message is translated. Translations are shared with the frontend automatically.',
    points: [
      'English, Hindi, Spanish, French, German, Japanese and 11 more',
      'One translation file per feature in lang/<locale>/modules',
      'Every user picks their own language from the profile or user menu',
      'Default language per domain, with English as the app default',
      'Translated validation messages in every Data class',
      'Same __() helper in Vue, React and Svelte',
    ],
    docs: '/docs/core/localization.html',
    visual: MockLanguages,
  },
  {
    eyebrow: 'Layout settings',
    title: 'System defaults, personal overrides',
    text: 'Set the default look for everyone from Setup → Layout Settings. Every user can then pick their own workspace layout under Settings → Layout.',
    points: [
      'Default authentication layout: card, simple or split screen',
      'Default application layout: sidebar or top nav (header)',
      'Default sidebar variant: inset, sidebar or floating',
      'Default collapsible mode: icon rail, offcanvas or none',
      'Personal workspace layout for every user, saved in the database',
      'Light, dark and system appearance',
    ],
    docs: '/docs/core/navigation-and-layouts.html',
    visual: MockLayouts,
  },
  {
    eyebrow: 'Menus & navigation',
    title: 'Database-driven menus',
    text: 'Menus live in the database, so you can reorder and reshape the navigation without touching the code.',
    points: [
      'Drag & drop menu builder with Reset Defaults',
      'Menus hide automatically when the user lacks the permission',
      'Setup opens as a dropdown on hover in the top nav layout',
      'Menu titles are translated into the user’s language',
      'Separate menus for the central app and every tenant',
    ],
    docs: '/docs/core/navigation-and-layouts.html',
    visual: MockMenus,
  },
];

const extras: { icon: IconName; title: string; text: string }[] = [
  { icon: 'shield', title: 'Friendly error pages', text: 'Designed 403, 404, 500 and 503 pages that match the rest of the app.' },
  { icon: 'code', title: 'Typed end to end', text: 'Wayfinder route helpers and TypeScript types generated from Data classes.' },
  { icon: 'globe', title: 'Landing page', text: 'A marketing home page on the central domain, ready to customise.' },
  { icon: 'bot', title: 'AI-ready', text: 'Laravel Boost guidelines and skills so AI agents follow the kit conventions.' },
]
</script>

<template>
  <section class="sl-section">
    <div class="sl-container">
      <SectionHeading
        eyebrow="Features"
        title="Everything a multi-tenant SaaS needs"
        lead="Real screens from the kits, rebuilt here in HTML. Every feature ships in all three frontends."
      />
      <div class="rows">
        <div v-for="(row, index) in rows" :key="row.title" class="row" :class="{ 'row--reverse': index % 2 === 1 }">
          <div class="row-copy">
            <p class="sl-eyebrow">{{ row.eyebrow }}</p>
            <h3 class="row-title">{{ row.title }}</h3>
            <p class="sl-text row-text">{{ row.text }}</p>
            <ul class="sl-checklist row-points">
              <li v-for="point in row.points" :key="point">
                <span class="row-check"><SlIcon name="check" :size="13" /></span>{{ point }}
              </li>
            </ul>
            <a class="sl-link" :href="row.docs">Read the docs →</a>
          </div>
          <div class="row-visual">
            <component :is="row.visual" />
          </div>
        </div>
      </div>
      <div class="extras">
        <div v-for="extra in extras" :key="extra.title" class="extra">
          <span class="extra-icon"><SlIcon :name="extra.icon" :size="18" /></span>
          <div>
            <h3 class="sl-h3 extra-title">{{ extra.title }}</h3>
            <p class="sl-text extra-text">{{ extra.text }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rows {
  display: grid;
  gap: 112px;
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  align-items: start;
  gap: 64px;
}

.row--reverse .row-copy {
  order: 2;
}

.row-copy .sl-eyebrow {
  display: flex;
  line-height: 1;
}

.row-title {
  font-size: clamp(24px, 3vw, 30px);
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
}

.row-text {
  margin-top: 14px;
  font-size: 16px;
}

.row-points {
  margin: 24px 0;
}

.row-check {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.row-visual {
  position: relative;
  padding: 22px;
  border-radius: 24px;
  background: linear-gradient(160deg, var(--vp-c-brand-soft), transparent 60%), var(--sl-surface-muted);
  border: 1px solid var(--sl-border);
}

.extras {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  margin-top: 112px;
  padding-top: 48px;
  border-top: 1px solid var(--sl-border);
}

.extra {
  display: flex;
  gap: 14px;
}

.extra-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.extra-title {
  font-size: 15px;
}

.extra-text {
  margin-top: 4px;
  font-size: 14px;
}

@media (max-width: 960px) {
  .rows {
    gap: 72px;
  }

  .row {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .row--reverse .row-copy {
    order: 0;
  }

  .extras {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 72px;
  }
}

@media (max-width: 560px) {
  .row-visual {
    padding: 14px;
    border-radius: 18px;
  }

  .extras {
    grid-template-columns: 1fr;
  }
}
</style>
