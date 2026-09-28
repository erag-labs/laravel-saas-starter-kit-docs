import { createContentLoader } from 'vitepress';

export interface Post {
  title: string;
  description: string;
  url: string;
  date: string;
  readingTime: number;
  tags: string[];
}

declare const data: Post[];
export { data };

export default createContentLoader('blog/*.md', {
  includeSrc: true,
  transform: (raw): Post[] =>
    raw
      .map(({ url, frontmatter, src }) => ({
        title: frontmatter.title,
        description: frontmatter.description,
        url,
        date: new Date(frontmatter.date).toISOString(),
        readingTime: Math.max(1, Math.round((src ?? '').replace(/^---[\s\S]*?---/, '').split(/\s+/).length / 220)),
        tags: frontmatter.tags ?? [],
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
});
