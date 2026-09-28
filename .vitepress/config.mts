import { defineConfig, type DefaultTheme, type HeadConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';
import { seoHead, transformSitemapItems, writeLlmsFiles } from './seo';
import { frameworkKeys, kits, site, type FrameworkKey } from './site';

function kitSidebar(framework: FrameworkKey): DefaultTheme.SidebarItem {
  const base = `/docs/${framework}`;

  return {
    text: kits[framework].title,
    collapsed: true,
    items: [
      { text: 'Overview & Installation', link: base },
      { text: 'Architecture', link: `${base}/architecture` },
      { text: 'Components', link: `${base}/components` },
      { text: 'Pages', link: `${base}/pages` },
      { text: 'Layouts', link: `${base}/layouts` },
      { text: 'Inertia', link: `${base}/inertia` },
      { text: 'Development', link: `${base}/development` },
    ],
  };
}

const docsSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Getting Started',
    items: [
      { text: 'Introduction', link: '/docs' },
      { text: 'Requirements', link: '/docs/getting-started/requirements' },
      { text: 'Installation', link: '/docs/getting-started/installation' },
      { text: 'Local Development', link: '/docs/getting-started/local-development' },
      { text: 'Project Structure', link: '/docs/getting-started/project-structure' },
      { text: 'Configuration', link: '/docs/getting-started/configuration' },
    ],
  },
  {
    text: 'Core',
    items: [
      { text: 'Architecture', link: '/docs/core/architecture' },
      { text: 'Authentication', link: '/docs/core/authentication' },
      { text: 'Users, Roles & Permissions', link: '/docs/core/users-roles-permissions' },
      { text: 'Multi-Tenancy', link: '/docs/core/multi-tenancy' },
      { text: 'Domains', link: '/docs/core/domains' },
      { text: 'Maintenance & Suspension', link: '/docs/core/maintenance-and-suspension' },
      { text: 'Localization', link: '/docs/core/localization' },
      { text: 'Navigation & Layouts', link: '/docs/core/navigation-and-layouts' },
      { text: 'Database', link: '/docs/core/database' },
      { text: 'Testing', link: '/docs/core/testing' },
    ],
  },
  {
    text: 'Starter Kits',
    items: frameworkKeys.map(kitSidebar),
  },
  {
    text: 'Purchase',
    items: [
      { text: 'Pricing', link: '/pricing' },
      { text: 'How to Pay', link: '/how-to-pay' },
      { text: 'Repository Access', link: '/docs/purchase/repository-access' },
      { text: 'Updates', link: '/docs/purchase/updates' },
      { text: 'Release Notes', link: '/releases' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Commands', link: '/docs/reference/commands' },
      { text: 'Environment', link: '/docs/reference/environment' },
      { text: 'Packages', link: '/docs/reference/packages' },
      { text: 'Troubleshooting', link: '/docs/reference/troubleshooting' },
      { text: 'FAQ', link: '/docs/reference/faq' },
    ],
  },
];

export default defineConfig({
  lang: 'en-US',
  srcExclude: ['README.md', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', '.github/**'],
  title: site.name,
  titleTemplate: `:title | ${site.name}`,
  description: site.description,
  cleanUrls: false,
  lastUpdated: true,
  sitemap: {
    hostname: site.url,
    transformItems: (items) => transformSitemapItems(items, fileURLToPath(new URL('../', import.meta.url))),
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],
    ['link', { rel: 'alternate', type: 'text/plain', title: 'LLM summary', href: '/llms.txt' }],
    ['meta', { name: 'theme-color', content: site.themeColor }],
    ['meta', { name: 'application-name', content: site.name }],
    ['meta', { name: 'apple-mobile-web-app-title', content: site.name }],
    ['meta', { name: 'author', content: site.name }],
    ['meta', { name: 'format-detection', content: 'telephone=no' }],
    ['meta', { property: 'og:site_name', content: site.name }],
    ['meta', { name: 'twitter:site', content: site.social.xHandle }],
    ['meta', { name: 'twitter:creator', content: site.social.xHandle }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
  ],
  transformHead({ pageData, title, description, content }): HeadConfig[] {
    return seoHead(pageData, title, description, content);
  },
  async buildEnd(siteConfig) {
    await writeLlmsFiles(siteConfig.srcDir, siteConfig.outDir, docsSidebar);
  },
  themeConfig: {
    logo: { src: '/logo.svg', alt: site.name },
    siteTitle: site.name,
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Documentation', link: '/docs', activeMatch: '^/docs($|/(?!getting-started/local-development))' },
      {
        text: 'Starter Kits',
        activeMatch: '^/kits/',
        items: frameworkKeys.map((framework) => ({ text: kits[framework].title, link: `/kits/${framework}` })),
      },
      { text: 'Pricing', link: '/pricing', activeMatch: '^/pricing($|/)' },
      { text: 'Local Development', link: '/docs/getting-started/local-development' },
      { text: 'How to Pay', link: '/how-to-pay' },
      { text: 'Blog', link: '/blog', activeMatch: '^/blog($|/)' },
    ],
    socialLinks: [
      { icon: 'github', link: site.social.github, ariaLabel: 'SaaS Laravel on GitHub' },
      { icon: 'linkedin', link: site.social.linkedin, ariaLabel: 'ERAG on LinkedIn' },
      { icon: 'x', link: site.social.x, ariaLabel: 'ERAG on X' },
    ],
    sidebar: {
      '/docs': docsSidebar,
    },
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    docFooter: {
      prev: 'Previous page',
      next: 'Next page',
    },
    editLink: {
      pattern: site.docsEditPattern,
      text: 'Edit this page on GitHub',
    },
    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'medium',
      },
    },
    search: {
      provider: 'local',
    },
    externalLinkIcon: true,
  },
});
