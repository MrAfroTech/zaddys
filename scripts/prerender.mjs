/**
 * Static HTML for the public pages, written after `vite build`, so search
 * engines, link previews and reviewers (e.g. SMS carrier checks) can read
 * them without running JavaScript. Each page gets its text pre-rendered into
 * the app shell plus its own title, description, canonical URL, Open Graph
 * tags and schema.org JSON-LD (src/data/seo.js). In a browser the React app
 * then renders as usual.
 *
 * Output (see vercel.json rewrites):
 *   dist/index.html            home (pre-rendered)
 *   dist/app.html              empty app shell for every other route
 *   dist/menu.html, privacy-policy.html, terms-of-service.html
 *   dist/sitemap.xml, dist/robots.txt
 *
 *   node scripts/prerender.mjs   (runs as part of `npm run build`)
 */
import { build } from 'esbuild';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = `${root}dist`;

const PAGES = [
  { key: 'home', file: 'index.html', component: 'src/pages/Homepage.jsx' },
  { key: 'menu', file: 'menu.html', component: 'src/pages/MenuPage.jsx' },
  { key: 'privacy', file: 'privacy-policy.html', component: 'src/pages/PrivacyPolicyPage.jsx' },
  { key: 'terms', file: 'terms-of-service.html', component: 'src/pages/TermsOfServicePage.jsx' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Bundles a module for Node (JSX, React external) and imports it. */
async function load(entry) {
  const out = `${dist}/.prerender-${entry.replace(/\W+/g, '-')}.mjs`;
  await build({
    entryPoints: [`${root}${entry}`],
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    external: ['react', 'react-dom'],
    outfile: out,
    logLevel: 'error',
  });
  try {
    return await import(out);
  } finally {
    rmSync(out);
  }
}

const shell = readFileSync(`${dist}/index.html`, 'utf8');
if (!shell.includes('<div id="root"></div>')) throw new Error('prerender: app shell markers not found in dist/index.html');
// Every non-pre-rendered route (order, staff, status pages) uses the plain shell.
writeFileSync(`${dist}/app.html`, shell);

const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { seoPages, SITE_URL } = await load('src/data/seo.js');

/** The shell's head with this page's tags, and its JSON-LD in place of the default. */
function head(html, seo) {
  const url = `${SITE_URL}${seo.path}`;
  const tags = [
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(`${SITE_URL}${seo.image}`)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n  ');
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(seo.description)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(seo.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(seo.description)}">`)
    .replace('</head>', `  ${tags}\n</head>`);
  if (seo.jsonLd) {
    const json = JSON.stringify(seo.jsonLd()).replace(/</g, '\\u003c');
    out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${json}</script>`);
  }
  return out;
}

for (const page of PAGES) {
  const { default: Page } = await load(page.component);
  const body = renderToStaticMarkup(React.createElement(Page));
  const html = head(shell, seoPages[page.key]).replace('<div id="root"></div>', `<div id="root"><main id="main">${body}</main></div>`);
  writeFileSync(`${dist}/${page.file}`, html);
  console.log(`prerendered dist/${page.file}`);
}

const today = new Date().toISOString().slice(0, 10);
const urls = [...Object.values(seoPages).map((p) => p.path), '/order'];
writeFileSync(
  `${dist}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
writeFileSync(`${dist}/robots.txt`, `User-agent: *\nAllow: /\nDisallow: /staff\nDisallow: /order/status/\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log('wrote dist/sitemap.xml, dist/robots.txt');
