import { useEffect, useState } from 'react';
import { ordering, orderLinkProps, restaurant } from '../data/restaurant';
import { featuredItems } from '../data/featured';
import { groupedHoursRows, hoursKnown, openStatus } from '../utils/hours';

/**
 * "Today" panel built only from published facts. Until Zaddys' hours are
 * entered in src/data/hours.js it says to call for hours rather than guess.
 */
export default function TodayAtZaddys() {
  // The live "open now" status is worked out in the browser only, so the
  // pre-rendered page (what search engines read) never shows a stale one.
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const status = now ? openStatus(now) : null;
  const featured = featuredItems.map((d) => d.name).join(', ');

  return (
    <div className="today" aria-labelledby="today-title">
      <h3 id="today-title" className="today-title">Today at Zaddys</h3>
      {status ? (
        <>
          <p className={`today-status${status.isOpen ? ' is-open' : ''}`}>
            <span className="today-dot" aria-hidden="true" />
            {status.message}
          </p>
          {status.detail && <p className="today-detail">{status.detail}</p>}
          <p className="today-hours">{status.dayName}: {status.todayHours}</p>
        </>
      ) : hoursKnown ? (
        groupedHoursRows().map((h) => <p key={h.days} className="today-hours">{h.days}: {h.time}</p>)
      ) : (
        <>
          <p className="today-status">Call for today's hours</p>
          <p className="today-hours"><a href={restaurant.phoneHref}>{restaurant.phone}</a></p>
        </>
      )}
      <p className="today-line"><strong>Featured:</strong> {featured}</p>
      <div className="today-actions">
        <a {...orderLinkProps} className="btn btn-primary">{ordering.label}</a>
        <a href="#deals" className="btn btn-outline">Deals</a>
      </div>
    </div>
  );
}
