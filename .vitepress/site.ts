export type FrameworkKey = 'vue' | 'react' | 'svelte';

export type PlanKey = FrameworkKey | 'all-kits';

export interface StackItem {
  label: string;
  value: string;
}

export interface Kit {
  key: FrameworkKey;
  name: string;
  title: string;
  price: number;
  repo: string;
  repoName: string;
  tagline: string;
  summary: string;
  stack: StackItem[];
  conventions: StackItem[];
  langImport: string;
  typeCheck: string;
}

export interface Plan {
  key: PlanKey;
  name: string;
  price: number;
  href: string;
  frameworks: FrameworkKey[];
  tagline: string;
  benefits: string[];
  featured: boolean;
}

const githubOwner = 'https://github.com/erag-technologies';

export const site = {
  name: 'SaaS Laravel',
  url: 'https://saas-laravel.com',
  title: 'Laravel SaaS Starter Kits for Vue, React & Svelte',
  description:
    'Production-ready Laravel SaaS starter kits for Vue, React and Svelte with lifetime access and weekly updates.',
  themeColor: '#4f46e5',
  sponsorUrl: 'https://github.com/sponsors/eramitgupta',
  githubProfile: githubOwner,
  docsEditPattern: `${githubOwner}/laravel-saas-starter-kit-docs/edit/main/:path`,
  bundlePrice: 79,
  kitPrice: 29,
  paymentNote: 'One-time payment · Lifetime access · Weekly updates included · No recurring subscription',
  accessNote: 'Lifetime access with weekly updates.',
};

export const backendStack: StackItem[] = [
  { label: 'Framework', value: 'Laravel 13 on PHP 8.3+' },
  { label: 'Bridge', value: 'Inertia v3 (inertia-laravel)' },
  { label: 'Authentication', value: 'Laravel Fortify + passkeys' },
  { label: 'Multi-tenancy', value: 'stancl/tenancy — database per tenant' },
  { label: 'Authorization', value: 'spatie/laravel-permission' },
  { label: 'Validation & types', value: 'spatie/laravel-data + TypeScript transformer' },
  { label: 'Typed routes', value: 'Laravel Wayfinder' },
  { label: 'Translations', value: 'erag/laravel-lang-sync-inertia' },
  { label: 'Quality', value: 'Pest 5, Larastan, Pint, Laravel Boost' },
];

export const frontendCommon: string[] = ['TypeScript 5', 'Tailwind CSS v4', 'Vite 8', 'Wayfinder', 'Lang Sync Inertia', 'ESLint 9 + Prettier 3'];

export const kits: Record<FrameworkKey, Kit> = {
  vue: {
    key: 'vue',
    name: 'Vue',
    title: 'Vue Starter Kit',
    price: 29,
    repo: `${githubOwner}/saas-laravel-starter-kit-vue`,
    repoName: 'saas-laravel-starter-kit-vue',
    tagline: 'Vue 3.5 with <script setup>, TypeScript and shadcn-vue.',
    summary:
      'The Laravel SaaS backend paired with a Vue 3 frontend written in <script setup> + TypeScript, shadcn-vue components on Reka UI and composables for permissions, layout and translations.',
    stack: [
      { label: 'Framework', value: 'Vue 3.5 — <script setup> + TypeScript' },
      { label: 'Inertia adapter', value: '@inertiajs/vue3 v3' },
      { label: 'UI components', value: 'shadcn-vue on Reka UI' },
      { label: 'Icons', value: '@lucide/vue' },
      { label: 'Toasts', value: 'vue-sonner' },
      { label: 'Menu drag & drop', value: 'vue-draggable-plus' },
      { label: 'Type check', value: 'vue-tsc' },
    ],
    conventions: [
      { label: 'Pages', value: 'resources/js/pages/tenants/Index.vue' },
      { label: 'Components', value: 'PascalCase .vue files' },
      { label: 'Composables', value: 'resources/js/composables/useX.ts' },
    ],
    langImport: "import { vueLang } from '@erag/lang-sync-inertia/vue'\n\nconst { __ } = vueLang()\n\n__('modules.tenant.index.title')",
    typeCheck: 'vue-tsc',
  },
  react: {
    key: 'react',
    name: 'React',
    title: 'React Starter Kit',
    price: 29,
    repo: `${githubOwner}/saas-laravel-starter-kit-react`,
    repoName: 'saas-laravel-starter-kit-react',
    tagline: 'React 19 with TypeScript and shadcn/ui on Radix UI.',
    summary:
      'The Laravel SaaS backend paired with a React 19 frontend in TypeScript, shadcn/ui components on Radix UI and hooks for permissions, layout and translations.',
    stack: [
      { label: 'Framework', value: 'React 19.2 + TypeScript' },
      { label: 'Inertia adapter', value: '@inertiajs/react v3' },
      { label: 'UI components', value: 'shadcn/ui on Radix UI' },
      { label: 'Icons', value: 'lucide-react' },
      { label: 'Toasts', value: 'sonner' },
      { label: 'Menu drag & drop', value: 'sortablejs' },
      { label: 'Type check', value: 'tsc' },
    ],
    conventions: [
      { label: 'Pages', value: 'resources/js/pages/tenants/index.tsx' },
      { label: 'Components', value: 'kebab-case .tsx files' },
      { label: 'Hooks', value: 'resources/js/hooks/use-x.ts' },
    ],
    langImport: "import { reactLang } from '@erag/lang-sync-inertia/react'\n\nconst { __ } = reactLang()\n\n__('modules.tenant.index.title')",
    typeCheck: 'tsc',
  },
  svelte: {
    key: 'svelte',
    name: 'Svelte',
    title: 'Svelte Starter Kit',
    price: 29,
    repo: `${githubOwner}/saas-laravel-starter-kit-svelte`,
    repoName: 'saas-laravel-starter-kit-svelte',
    tagline: 'Svelte 5 runes with TypeScript and shadcn-svelte.',
    summary:
      'The Laravel SaaS backend paired with a Svelte 5 frontend built on runes and TypeScript, shadcn-svelte components on Bits UI and shared .svelte.ts modules for permissions, layout and translations.',
    stack: [
      { label: 'Framework', value: 'Svelte 5 (runes) + TypeScript' },
      { label: 'Inertia adapter', value: '@inertiajs/svelte v3' },
      { label: 'UI components', value: 'shadcn-svelte on Bits UI' },
      { label: 'Icons', value: 'lucide-svelte' },
      { label: 'Toasts', value: 'svelte-sonner' },
      { label: 'Menu drag & drop', value: 'sortablejs' },
      { label: 'Type check', value: 'svelte-check' },
    ],
    conventions: [
      { label: 'Pages', value: 'resources/js/pages/tenants/Index.svelte' },
      { label: 'Components', value: 'PascalCase .svelte files' },
      { label: 'Shared logic', value: 'resources/js/lib/*.ts and *.svelte.ts' },
    ],
    langImport: "import { svelteLang } from '@erag/lang-sync-inertia/svelte'\n\nconst { __ } = svelteLang()\n\n__('modules.tenant.index.title')",
    typeCheck: 'svelte-check',
  },
};

export const frameworkKeys: FrameworkKey[] = ['vue', 'react', 'svelte'];

export const plans: Record<PlanKey, Plan> = {
  vue: {
    key: 'vue',
    name: 'Vue Starter Kit',
    price: 29,
    href: '/pricing/vue.html',
    frameworks: ['vue'],
    tagline: 'Laravel SaaS backend + Vue 3.5 frontend.',
    benefits: ['Vue 3.5, TypeScript & shadcn-vue', 'Multi-tenancy, auth, roles & permissions', 'Access to the Vue kit repository'],
    featured: false,
  },
  react: {
    key: 'react',
    name: 'React Starter Kit',
    price: 29,
    href: '/pricing/react.html',
    frameworks: ['react'],
    tagline: 'Laravel SaaS backend + React 19 frontend.',
    benefits: ['React 19, TypeScript & shadcn/ui', 'Multi-tenancy, auth, roles & permissions', 'Access to the React kit repository'],
    featured: false,
  },
  svelte: {
    key: 'svelte',
    name: 'Svelte Starter Kit',
    price: 29,
    href: '/pricing/svelte.html',
    frameworks: ['svelte'],
    tagline: 'Laravel SaaS backend + Svelte 5 frontend.',
    benefits: ['Svelte 5 runes, TypeScript & shadcn-svelte', 'Multi-tenancy, auth, roles & permissions', 'Access to the Svelte kit repository'],
    featured: false,
  },
  'all-kits': {
    key: 'all-kits',
    name: 'All Starter Kits',
    price: 79,
    href: '/pricing/all-kits.html',
    frameworks: ['vue', 'react', 'svelte'],
    tagline: 'Vue, React and Svelte — the complete collection.',
    benefits: ['All three starter kits', 'Access to all three kit repositories', 'Save $8 compared to buying separately'],
    featured: true,
  },
};

export const planOrder: PlanKey[] = ['vue', 'react', 'svelte', 'all-kits'];

export const requirements: StackItem[] = [
  { label: 'PHP', value: '8.3 or newer' },
  { label: 'Composer', value: 'Composer 2' },
  { label: 'Node.js', value: 'A current Node LTS with npm' },
  { label: 'Database', value: 'MySQL (needed for database-per-tenant)' },
  { label: 'Local server', value: 'Laravel Herd recommended (*.test + wildcard subdomains)' },
];

export const languages: string[] = [
  'English',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Russian',
  'Japanese',
  'Korean',
  'Turkish',
  'Dutch',
  'Indonesian',
  'Bengali',
  'Polish',
  'Vietnamese',
  'Thai',
];

export const includedFeatures: { title: string; text: string; points: string[] }[] = [
  {
    title: 'Authentication',
    text: 'Login, registration, password reset, email verification, two-factor auth, passkeys, profile & security settings — toggled per domain.',
    points: [
      'Login, registration and password reset',
      'Email verification and password confirmation',
      'Two-factor authentication with recovery codes',
      'Passwordless sign-in with passkeys',
      'Turn each auth feature on or off per domain',
      'Profile, password, appearance and account deletion settings',
      'Separate central and tenant guards and user tables',
    ],
  },
  {
    title: 'Multi-tenancy',
    text: 'A separate database per tenant, subdomain identification, tenant CRUD with stats, workspace status and admin invitations.',
    points: [
      'One database per tenant with stancl/tenancy',
      'Tenant identified by its subdomain on APP_DOMAIN',
      'Tenant creation pipeline: database, migrations, seeders and admin user',
      'Workspace status: Active, Trial, Pending Invitation, Suspended',
      'Signed invitation link for the tenant admin, with resend',
      'Admin password reset by email link or set manually',
      'Tenant list with search, status filter and stats',
    ],
  },
  {
    title: 'Domains',
    text: 'Primary and secondary domains per tenant with a per-domain app name, default language and authentication features.',
    points: [
      'Add domains, set the primary and protect it from deletion',
      'App name per domain, shown in the sidebar, sign-in pages and emails',
      'Default language per domain; users can still choose their own',
      'Registration, password reset, 2FA and passkeys toggled per domain',
      'Domains page with search and primary / secondary filters',
    ],
  },
  {
    title: 'Maintenance & suspension',
    text: 'Global maintenance for all tenant workspaces with a custom message, secret bypass link and allowed IPs; suspended workspaces are blocked.',
    points: [
      'Global maintenance mode from Setup → Tenant Settings',
      'Custom message on an animated 503 page',
      'Secret bypass link that unlocks a workspace for 12 hours',
      'Allowed IP addresses and CIDR ranges skip the maintenance page',
      'Tenant login stays reachable so admins can sign in and bypass',
      'Suspend a single workspace with its own or a default message',
      'The central app stays online the whole time',
    ],
  },
  {
    title: 'Users & invitations',
    text: 'User management with search and stats, role select, individual permissions and queued, signed invitation emails.',
    points: [
      'Users list with search, stats and pagination',
      'Role select on create and edit',
      'System roles get their default permissions, custom roles none',
      'Individual permissions per user, grouped by module',
      'Queued invitation email with a signed 7-day link',
      '“Invitation pending” badge until the user accepts',
      'Accept-invitation page where the user sets a password',
    ],
  },
  {
    title: 'Roles & permissions',
    text: 'Spatie roles with protected system roles, permission config files for central and tenant apps and permission-aware menus.',
    points: [
      'Spatie roles and permissions for the central app and every tenant',
      'Protected system roles plus your own custom roles',
      'Permissions defined in config/permissions and config/permissions/tenant',
      'Super admin passes every permission check',
      'Permission checks on routes, menus and buttons',
    ],
  },
  {
    title: 'Navigation & layouts',
    text: 'Database-driven menus with drag & drop ordering, sidebar or header layouts, sidebar variants, auth layouts and light/dark mode.',
    points: [
      'Database-driven menus with a drag & drop builder and Reset Defaults',
      'Menus hide automatically without the required permission',
      'Sidebar or header (top nav) layout with a Setup dropdown',
      'Inset, sidebar or floating sidebar variants',
      'Icon rail, offcanvas or always-open collapse modes',
      'Card, simple or split sign-in pages',
      'Light, dark and system appearance',
    ],
  },
  {
    title: 'Localization',
    text: '17 languages with per-user and per-domain defaults, and translated validation messages shared with the frontend.',
    points: [
      '17 languages, including English, Hindi, Spanish, French, German and Japanese',
      'One translation file per feature in lang/<locale>/modules',
      'Every user picks their own language',
      'Default language per domain, English as the app default',
      'Translated validation messages in every Data class',
      'Translations shared with Vue, React and Svelte through one __() helper',
    ],
  },
  {
    title: 'Testing & tooling',
    text: 'Pest feature tests, Larastan, Pint, ESLint, Prettier and Laravel Boost guidelines and skills for AI agents.',
    points: [
      'Pest feature tests for the backend',
      'Larastan static analysis and Pint formatting',
      'ESLint and Prettier for the frontend',
      'Type checking with vue-tsc, tsc or svelte-check',
      'GitHub Actions workflow runs the test suite',
      'Laravel Boost guidelines and skills for AI coding agents',
    ],
  },
];

export function formatPrice(price: number): string {
  return `$${price}`;
}

export const paymentFaqs: { question: string; answer: string }[] = [
  {
    question: 'Is this a subscription?',
    answer: 'No. There is no recurring subscription and nothing renews. You pay once.',
  },
  {
    question: 'Is it a one-time payment?',
    answer: `Yes. ${formatPrice(site.kitPrice)} for a single kit or ${formatPrice(site.bundlePrice)} for all three kits, paid once through GitHub Sponsors.`,
  },
  {
    question: 'Do I get lifetime access?',
    answer: 'Yes. Once you have been invited, you keep access to the kit repository for life.',
  },
  {
    question: 'Are updates included?',
    answer: 'Yes. Every update pushed to the kit repository is included at no extra cost.',
  },
  {
    question: 'How often are updates released?',
    answer: 'Weekly. Updates are pushed to the kit repositories and you pull them into your project when you are ready.',
  },
  {
    question: 'How do I get repository access?',
    answer:
      'Automatically. As soon as your GitHub Sponsors payment goes through, your GitHub account is invited to the kit repository. Accept the invitation from GitHub or your email.',
  },
  {
    question: 'Can I buy all three kits?',
    answer: `Yes. The All Starter Kits bundle includes Vue, React and Svelte for ${formatPrice(site.bundlePrice)} — ${formatPrice(site.kitPrice * 3 - site.bundlePrice)} less than buying them separately.`,
  },
  {
    question: 'Where do I get support?',
    answer: 'On GitHub. Open an issue on the kit repository you have access to.',
  },
];
