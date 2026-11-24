/**
 * Zaddys opening hours — the single source for every place hours appear
 * (Today panel, Visit section, footer, and the JSON-LD in index.html).
 *
 * Entries are 24h, restaurant-local, Monday through Sunday; fractions are
 * minutes (20.5 = 8:30 PM); open: null = closed that day.
 * TODO(zaddys): Google lists later Friday/Saturday hours; confirm with the
 * owner. For now every day is 11 AM – 8:30 PM.
 */
export const TIMEZONE = 'America/New_York';

export const weeklyHours = [
  { day: 'Monday', open: 11, close: 20.5 },
  { day: 'Tuesday', open: 11, close: 20.5 },
  { day: 'Wednesday', open: 11, close: 20.5 },
  { day: 'Thursday', open: 11, close: 20.5 },
  { day: 'Friday', open: 11, close: 20.5 },
  { day: 'Saturday', open: 11, close: 20.5 },
  { day: 'Sunday', open: 11, close: 20.5 },
];
