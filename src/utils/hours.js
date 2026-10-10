import { weeklyHours, TIMEZONE } from '../data/hours';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** True once Zaddys' hours have been entered in src/data/hours.js. */
export const hoursKnown = Array.isArray(weeklyHours) && weeklyHours.length === 7;

function hoursFor(dayIndex) {
  if (!hoursKnown) return null;
  const entry = weeklyHours.find((h) => h.day === DAY_NAMES[dayIndex]);
  return entry && entry.open != null ? entry : null;
}

export function formatHour(h) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const whole = Math.floor(h);
  const minutes = Math.round((h - whole) * 60);
  const hour12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${hour12}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''} ${suffix}`;
}

function formatRange(entry) {
  return entry.open == null ? 'Closed' : `${formatHour(entry.open)} – ${formatHour(entry.close)}`;
}

/** One row per day, Monday first. Empty until hours are known. */
export function dailyHoursRows() {
  return hoursKnown ? weeklyHours.map((h) => ({ day: h.day, time: formatRange(h) })) : [];
}

/** Consecutive days with the same hours grouped. Empty until hours are known. */
export function groupedHoursRows() {
  if (!hoursKnown) return [];
  const groups = [];
  for (const h of weeklyHours) {
    const time = formatRange(h);
    const last = groups[groups.length - 1];
    if (last && last.time === time) last.days.push(h.day);
    else groups.push({ days: [h.day], time });
  }
  return groups.map((g) => ({
    days: g.days.length > 1 ? `${g.days[0]} – ${g.days[g.days.length - 1]}` : g.days[0],
    time: g.time,
  }));
}

export function restaurantNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { day: DAY_NAMES.indexOf(get('weekday')), hour: Number(get('hour')) + Number(get('minute')) / 60 };
}

function nextOpenDay(fromDay) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const d = (fromDay + offset) % 7;
    const entry = hoursFor(d);
    if (entry) return { day: d, offset, entry };
  }
  return null;
}

/**
 * Open/closed status from the published hours, or null when hours aren't
 * known yet (callers then show "Call for hours").
 */
export function openStatus(date = new Date()) {
  if (!hoursKnown) return null;
  const { day, hour } = restaurantNow(date);
  const today = hoursFor(day);
  const dayName = DAY_NAMES[day];
  const next = nextOpenDay(day);
  const nextLine = next ? `Opens ${next.offset === 1 ? 'tomorrow' : DAY_NAMES[next.day]} at ${formatHour(next.entry.open)}` : null;

  if (!today) return { isOpen: false, dayName, todayHours: 'Closed', message: 'Closed today', detail: nextLine };
  const todayHours = formatRange(today);
  if (hour >= today.open && hour < today.close) {
    return { isOpen: true, dayName, todayHours, message: `Open now until ${formatHour(today.close)}`, detail: null };
  }
  if (hour < today.open) {
    return { isOpen: false, dayName, todayHours, message: `Opens today at ${formatHour(today.open)}`, detail: null };
  }
  return { isOpen: false, dayName, todayHours, message: 'Closed for the day', detail: nextLine };
}
