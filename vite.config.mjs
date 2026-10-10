import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { weeklyHours } from './src/data/hours.js';

const pad = (h) => `${String(h).padStart(2, '0')}:00`;

/**
 * Builds the Restaurant JSON-LD opening hours from src/data/hours.js so the
 * structured data never drifts from the hours shown on the page.
 */
function openingHoursJsonLd() {
  if (!Array.isArray(weeklyHours)) return null;
  const byTime = new Map();
  for (const h of weeklyHours) {
    if (h.open == null) continue;
    const key = `${h.open}-${h.close}`;
    if (!byTime.has(key)) byTime.set(key, { open: h.open, close: h.close, days: [] });
    byTime.get(key).days.push(h.day);
  }
  return [...byTime.values()].map((g) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: g.days,
    opens: pad(g.open),
    closes: pad(g.close),
  }));
}

function hoursInHtml() {
  return {
    name: 'zaddys-hours-jsonld',
    transformIndexHtml(html) {
      // Hours are only published in the structured data once they're known.
      const spec = openingHoursJsonLd();
      return html.replace('"__OPENING_HOURS__"', spec ? `,\n    "openingHoursSpecification": ${JSON.stringify(spec)}` : '');
    },
  };
}

export default defineConfig({
  plugins: [react(), hoursInHtml()],
  build: {
    outDir: 'dist',
  },
});
