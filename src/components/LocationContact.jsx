import { restaurant } from '../data/restaurant';
import { dailyHoursRows, hoursKnown } from '../utils/hours';
import TodayAtZaddys from './TodayAtZaddys';

export default function LocationContact() {
  const { address } = restaurant;
  return (
    <section id="visit" className="section visit" aria-labelledby="visit-title">
      <div className="container visit-layout">
        <div>
          <p className="eyebrow">Visit us</p>
          <h2 id="visit-title" className="section-title">Find Zaddys</h2>
          <address className="visit-address">
            {address.street}<br />
            {address.city}, {address.state} {address.zip}
          </address>
          <ul className="visit-contact">
            <li><a href={restaurant.phoneHref}>{restaurant.phone}</a></li>
            {restaurant.email && <li><a href={`mailto:${restaurant.email}`}>{restaurant.email}</a></li>}
          </ul>
          {hoursKnown ? (
            <table className="hours-table">
              <caption className="sr-only">Hours</caption>
              <tbody>
                {dailyHoursRows().map((h) => (
                  <tr key={h.day} className={h.time === 'Closed' ? 'is-closed' : undefined}>
                    <th scope="row">{h.day}</th><td>{h.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="hours-pending">Hours: call {restaurant.phone}</p>
          )}
          <div className="btn-row">
            <a href={restaurant.phoneHref} className="btn btn-primary">Call</a>
            <a href={restaurant.directionsUrl} target="_blank" rel="noopener" className="btn btn-outline">Directions</a>
          </div>
        </div>
        <TodayAtZaddys />
      </div>
    </section>
  );
}
