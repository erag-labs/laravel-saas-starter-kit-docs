import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DefaultTheme, HeadConfig, PageData } from 'vitepress';
import { frameworkKeys, kitPriceList, kits, paymentFaqs, plans, site, type FrameworkKey, type PlanKey } from './site';

type JsonLd = Record<string, unknown>;

type SitemapItem = { url: string; lastmod?: string | number; changefreq?: string; priority?: number };

const sectionNames: Record<string, string> = {
  'getting-started': 'Getting Started',
  core: 'Core',
  vue: 'Vue Starter Kit',
  react: 'React Starter Kit',
  svelte: 'Svelte Starter Kit',
  purchase: 'Purchase',
  reference: 'Reference',
};

const organizationId = `${site.url}/#organization`;
const websiteId = `${site.url}/#website`;

export const pageUrl = (relativePath: string): string =>
  relativePath === 'index.md' ? `${site.url}/` : `${site.url}/${relativePath.replace(/\.md$/, '.html')}`;

const frameworkFor = (relativePath: string): FrameworkKey | undefined =>
  frameworkKeys.find(
    (key) =>
      relativePath === `kits/${key}.md` ||
      relativePath === `pricing/${key}.md` ||
      relativePath === `docs/${key}.md` ||
      relativePath.startsWith(`docs/${key}/`),
  );

const imageNameFor = (relativePath: string): string => {
  const framework = frameworkFor(relativePath);

  if (framework) {
    return `og-${framework}`;
  }

  if (relativePath === 'pricing.md' || relativePath.startsWith('pricing/') || relativePath === 'how-to-pay.md') {
    return 'og-pricing';
  }

  if (relativePath === 'docs.md' || relativePath.startsWith('docs/')) {
    return 'og-docs';
  }

  return 'og-image';
};

export const ogImageFor = (relativePath: string): string => `${site.url}/${imageNameFor(relativePath)}.png`;

const stripTags = (value: string): string =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&ZeroWidthSpace;|​/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const organization = (): JsonLd => ({
  '@type': 'Organization',
  '@id': organizationId,
  name: site.name,
  url: `${site.url}/`,
  logo: { '@type': 'ImageObject', url: `${site.url}/icon-512.png`, width: 512, height: 512 },
  sameAs: [site.social.github, site.social.linkedin, site.social.x],
  email: site.company.email,
  parentOrganization: { '@type': 'Organization', name: site.company.name, url: site.company.url },
});

const website = (): JsonLd => ({
  '@type': 'WebSite',
  '@id': websiteId,
  name: site.name,
  url: `${site.url}/`,
  description: site.description,
  inLanguage: 'en-US',
  publisher: { '@id': organizationId },
});

const breadcrumbs = (items: { name: string; url: string }[]): JsonLd => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })),
});

const offer = (planKey: PlanKey): JsonLd => ({
  '@type': 'Offer',
  price: plans[planKey].price.toFixed(2),
  priceCurrency: 'USD',
  availability: 'https://schema.org/InStock',
  url: `${site.url}${plans[planKey].href}`,
  seller: { '@id': organizationId },
});

const software = (planKey: PlanKey, url: string, description: string): JsonLd => ({
  '@type': 'SoftwareApplication',
  name: plans[planKey].name,
  description,
  url,
  image: ogImageFor(planKey === 'all-kits' ? 'pricing.md' : `kits/${planKey}.md`),
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Windows, macOS, Linux',
  softwareRequirements: 'PHP 8.3+, Composer 2, Node.js LTS, MySQL',
  brand: { '@id': organizationId },
  offers: offer(planKey),
});

const faqPage = (items: { question: string; answer: string }[]): JsonLd => ({
  '@type': 'FAQPage',
  mainEntity: items.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
});

const faqFromContent = (content: string): { question: string; answer: string }[] =>
  content
    .split(/<h3[^>]*>/)
    .slice(1)
    .map((chunk) => {
      const [heading, rest = ''] = chunk.split('</h3>');
      const answer = rest.split(/<h[1-3][^>]*>/)[0];

      return { question: stripTags(heading), answer: stripTags(answer) };
    })
    .filter((item) => item.question.endsWith('?') && item.answer.length > 0);

const structuredData = (pageData: PageData, url: string, title: string, description: string, content: string): JsonLd[] => {
  const path = pageData.relativePath;
  const home = { name: 'Home', url: `${site.url}/` };
  const pageTitle = pageData.title || title;
  const graph: JsonLd[] = [];

  if (path === 'index.md') {
    graph.push(organization(), website(), {
      '@type': 'ItemList',
      name: 'Laravel SaaS starter kits',
      itemListElement: (['vue', 'react', 'svelte', 'all-kits'] as PlanKey[]).map((key, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: key === 'all-kits' ? `${site.url}${plans[key].href}` : `${site.url}/kits/${key}.html`,
        name: plans[key].name,
      })),
    });

    return graph;
  }

  const framework = frameworkFor(path);

  if (path.startsWith('kits/') && framework) {
    graph.push(
      software(framework, url, description),
      breadcrumbs([home, { name: 'Starter Kits', url: `${site.url}/pricing.html` }, { name: kits[framework].title, url }]),
    );
  } else if (path.startsWith('pricing/')) {
    const planKey = path.replace(/^pricing\/|\.md$/g, '') as PlanKey;

    graph.push(
      software(planKey, url, description),
      breadcrumbs([home, { name: 'Pricing', url: `${site.url}/pricing.html` }, { name: plans[planKey].name, url }]),
    );
  } else if (path === 'pricing.md') {
    graph.push(
      {
        '@type': 'ItemList',
        name: 'SaaS Laravel pricing',
        itemListElement: (['vue', 'react', 'svelte', 'all-kits'] as PlanKey[]).map((key, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: software(key, `${site.url}${plans[key].href}`, plans[key].tagline),
        })),
      },
      breadcrumbs([home, { name: 'Pricing', url }]),
    );
  } else if (path === 'how-to-pay.md') {
    graph.push(faqPage(paymentFaqs), breadcrumbs([home, { name: 'How to Pay', url }]));
  } else if (path === 'blog.md') {
    graph.push({ '@type': 'Blog', name: pageTitle, description, url, publisher: { '@id': organizationId } }, breadcrumbs([home, { name: 'Blog', url }]));
  } else if (path.startsWith('blog/')) {
    const published = new Date(pageData.frontmatter.date).toISOString();

    graph.push(
      {
        '@type': 'BlogPosting',
        headline: pageTitle,
        description,
        url,
        mainEntityOfPage: url,
        image: ogImageFor(path),
        inLanguage: 'en-US',
        datePublished: published,
        dateModified: pageData.lastUpdated ? new Date(pageData.lastUpdated).toISOString() : published,
        keywords: (pageData.frontmatter.tags ?? []).join(', '),
        author: { '@type': 'Organization', name: site.company.name, url: site.company.url },
        publisher: { '@id': organizationId },
        isPartOf: { '@id': websiteId },
      },
      breadcrumbs([home, { name: 'Blog', url: `${site.url}/blog.html` }, { name: pageTitle, url }]),
    );

    const faqs = faqFromContent(content);

    if (faqs.length) {
      graph.push(faqPage(faqs));
    }
  } else if (path === 'docs.md' || path.startsWith('docs/')) {
    const section = path.split('/')[1]?.replace(/\.md$/, '');
    const trail = [home, { name: 'Documentation', url: `${site.url}/docs.html` }];

    if (section && ['vue', 'react', 'svelte'].includes(section) && path !== `docs/${section}.md`) {
      trail.push({ name: sectionNames[section], url: `${site.url}/docs/${section}.html` });
    }

    if (path !== 'docs.md') {
      trail.push({ name: pageTitle, url });
    }

    graph.push(
      {
        '@type': 'TechArticle',
        headline: pageTitle,
        articleSection: section && sectionNames[section] ? sectionNames[section] : 'Documentation',
        description,
        url,
        image: ogImageFor(path),
        inLanguage: 'en-US',
        isPartOf: { '@id': websiteId },
        publisher: { '@id': organizationId },
        ...(pageData.lastUpdated ? { dateModified: new Date(pageData.lastUpdated).toISOString() } : {}),
      },
      breadcrumbs(trail),
    );

    if (path === 'docs/reference/faq.md') {
      const items = faqFromContent(content);

      if (items.length) {
        graph.push(faqPage(items));
      }
    }
  }

  return graph;
};

const indexable = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

const robots = (content: string): HeadConfig[] => [
  ['meta', { name: 'robots', content }],
  ['meta', { name: 'googlebot', content }],
  ['meta', { name: 'bingbot', content }],
];

export const seoHead = (pageData: PageData, title: string, description: string, content: string): HeadConfig[] => {
  if (pageData.isNotFound || pageData.relativePath === '404.md') {
    return robots('noindex, follow');
  }

  const url = pageUrl(pageData.relativePath);
  const image = ogImageFor(pageData.relativePath);
  const imageAlt = pageData.title || title;
  const isDocs =
    pageData.relativePath.startsWith('docs/') || pageData.relativePath === 'docs.md' || pageData.relativePath.startsWith('blog/');
  const graph = structuredData(pageData, url, title, description, content);

  const head: HeadConfig[] = [
    ...robots(indexable),
    ['meta', { property: 'og:type', content: isDocs ? 'article' : 'website' }],
    ['meta', { property: 'og:image', content: image }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: imageAlt }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: image }],
    ['meta', { name: 'twitter:image:alt', content: imageAlt }],
  ];

  if (isDocs && pageData.lastUpdated) {
    head.push(['meta', { property: 'article:modified_time', content: new Date(pageData.lastUpdated).toISOString() }]);
  }

  if (graph.length) {
    head.push(['script', { type: 'application/ld+json' }, JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })]);
  }

  return head;
};

export const transformSitemapItems = async (items: SitemapItem[], srcDir: string): Promise<SitemapItem[]> =>
  Promise.all(
    items.map(async (item) => {
      const path = item.url.replace(/^https?:\/\/[^/]+\//, '');
      const source = path === '' ? 'index.md' : path.replace(/\.html$/, '.md');
      const priority =
        path === '' ? 1 : /^(pricing|kits)/.test(path) ? 0.9 : path === 'docs.html' || path === 'how-to-pay.html' ? 0.8 : 0.7;
      const lastmod = item.lastmod ?? (await stat(join(srcDir, source)).then((file) => file.mtime.toISOString(), () => undefined));

      return { ...item, lastmod, changefreq: 'weekly', priority };
    }),
  );

const readFrontmatter = (source: string): { title?: string; description?: string; body: string } => {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  const field = (name: string): string | undefined =>
    match?.[1].match(new RegExp(`^${name}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1];

  return { title: field('title'), description: field('description'), body: match ? source.slice(match[0].length) : source };
};

const cleanMarkdown = (body: string): string =>
  body
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<Badge[^>]*text="([^"]*)"[^>]*\/>/g, '$1')
    .replace(/<[A-Z][A-Za-z]*[^>]*\/>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const linkToSource = (link: string): string => `${link.replace(/^\//, '')}.md`;

const collectLinks = (items: DefaultTheme.SidebarItem[]): { text: string; link: string }[] =>
  items.flatMap((item) => [
    ...(item.link ? [{ text: item.text ?? item.link, link: item.link }] : []),
    ...(item.items ? collectLinks(item.items) : []),
  ]);

export const writeLlmsFiles = async (srcDir: string, outDir: string, docsSidebar: DefaultTheme.SidebarItem[]): Promise<void> => {
  const describe = async (link: string): Promise<{ title: string; description: string; body: string }> => {
    const raw = await readFile(join(srcDir, linkToSource(link)), 'utf8');
    const { title, description, body } = readFrontmatter(raw);

    return { title: title ?? link, description: description ?? '', body };
  };

  const marketing = [
    ...frameworkKeys.map((key) => `/kits/${key}`),
    '/pricing',
    ...(['vue', 'react', 'svelte', 'all-kits'] as PlanKey[]).map((key) => plans[key].href.replace(/\.html$/, '')),
    '/how-to-pay',
    '/releases',
    '/blog',
    '/license',
    '/privacy-policy',
  ];

  const summary: string[] = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `${site.name} sells three Laravel SaaS starter kits that share one Laravel 13 backend: Vue 3.5, React 19 or Svelte 5 with Inertia v3, TypeScript, Tailwind CSS v4 and shadcn components. The kits cost ${kitPriceList}, and all three cost $${site.bundlePrice}, as a one-time payment through GitHub Sponsors with lifetime access and weekly updates. Repository access is granted automatically after payment.`,
    '',
    'Key features: database-per-tenant multi-tenancy (stancl/tenancy), subdomain identification, per-domain app name, language and auth features, Laravel Fortify authentication with two-factor and passkeys, Spatie roles and permissions, queued user invitations, global maintenance mode and workspace suspension, 17 languages, database-driven menus, sidebar or header layouts, Pest tests, Larastan, Pint and Laravel Boost.',
    '',
    '## Product',
    '',
  ];

  for (const link of marketing) {
    const page = await describe(link);
    summary.push(`- [${page.title}](${site.url}${link}.html): ${page.description}`);
  }

  const blogFiles = (await readdir(join(srcDir, 'blog'))).filter((file) => file.endsWith('.md')).sort();

  if (blogFiles.length) {
    summary.push('', '## Blog', '');

    for (const file of blogFiles) {
      const page = await describe(`/blog/${file.replace(/\.md$/, '')}`);
      summary.push(`- [${page.title}](${site.url}/blog/${file.replace(/\.md$/, '.html')}): ${page.description}`);
    }
  }

  const full: string[] = [`# ${site.name} — full documentation`, '', `> ${site.description}`, '', `Source: ${site.url}/`, ''];

  for (const group of docsSidebar) {
    summary.push('', `## ${group.text}`, '');

    for (const entry of collectLinks(group.items ?? [])) {
      if (!entry.link.startsWith('/docs')) {
        continue;
      }

      const page = await describe(entry.link);
      const url = `${site.url}${entry.link}.html`;
      summary.push(`- [${page.title}](${url}): ${page.description}`);
      full.push('---', '', `# ${page.title}`, '', `URL: ${url}`, '', page.description, '', cleanMarkdown(page.body), '');
    }
  }

  summary.push('', '## Optional', '', `- [Full documentation in one file](${site.url}/llms-full.txt)`, `- [Sitemap](${site.url}/sitemap.xml)`, '');

  await writeFile(join(outDir, 'llms.txt'), summary.join('\n'));
  await writeFile(join(outDir, 'llms-full.txt'), full.join('\n'));
};
