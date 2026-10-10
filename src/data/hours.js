/**
 * Zaddys opening hours — the single source for every place hours appear
 * (Today panel, Visit section, footer, and the JSON-LD in index.html).
 *
 * TODO(zaddys): hours haven't been supplied yet. Until they are, this stays
 * null and the site says "Call for hours" instead of guessing. When known,
 * replace with entries like:
 *   { day: 'Monday', open: 11, close: 20 }   // 24h, restaurant-local; null = closed
 * listed Monday through Sunday.
 */
export const TIMEZONE = 'America/New_York';

export const weeklyHours = null;
