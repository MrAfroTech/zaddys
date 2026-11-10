/**
 * Writes static HTML for public legal pages after `vite build`, so they can be
 * read without running JavaScript (carrier/AWS reviewers and search engines).
 * The page's text is pre-rendered into dist/<name>.html inside the normal app
 * shell; in a browser the React app then renders as usual.
 *
 *   node scripts/prerender.mjs   (runs as part of `npm run build`)
 */
import { build } from 'esbuild';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PAGES = [
  { file: 'privacy-policy.html', component: 'src/pages/PrivacyPolicyPage.jsx', title: 'Privacy Policy | Zaddys Subs & Deli Shop' },
  { file: 'terms-of-service.html', component: 'src/pages/TermsOfServicePage.jsx', title: 'Terms of Service | Zaddys Subs & Deli Shop' },
];

const shell = readFileSync(`${root}dist/index.html`, 'utf8');
const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');

for (const page of PAGES) {
  const out = `${root}dist/.prerender-${page.file}.mjs`;
  await build({
    entryPoints: [`${root}${page.component}`],
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    external: ['react', 'react-dom'],
    outfile: out,
    logLevel: 'error',
  });
  const { default: Page } = await import(out);
  rmSync(out);
  const body = renderToStaticMarkup(React.createElement(Page));
  const html = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`)
    .replace('<div id="root"></div>', `<div id="root"><main id="main">${body}</main></div>`);
  if (html === shell) throw new Error('prerender: app shell markers not found in dist/index.html');
  writeFileSync(`${root}dist/${page.file}`, html);
  console.log(`prerendered dist/${page.file}`);
}
