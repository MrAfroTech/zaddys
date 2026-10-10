import { ordering, orderLinkProps, restaurant } from '../data/restaurant';

const OPTIONS = [
  { id: 'hungry', emoji: '🥪', title: "I'm hungry", text: 'See the menu.', link: { href: '/menu' } },
  { id: 'deal', emoji: '🌭', title: 'I want a deal', text: 'Glizzy Deal and the Cuban Special.', link: { href: '#deals' } },
  { id: 'order', emoji: '📞', title: 'Order ahead', text: `${ordering.label}: ${restaurant.phone}.`, link: orderLinkProps },
  { id: 'visit', emoji: '📍', title: 'Find the shop', text: 'E. Hillsborough Ave, Tampa.', link: { href: '#visit' } },
];

export default function WhatBringsYou() {
  return (
    <section className="section bring" aria-labelledby="bring-title">
      <div className="container">
        <h2 id="bring-title" className="section-title">What brings you to Zaddys?</h2>
        <div className="bring-grid">
          {OPTIONS.map((o) => (
            <a key={o.id} {...o.link} className="bring-card">
              <span className="bring-emoji" aria-hidden="true">{o.emoji}</span>
              <span className="bring-title">{o.title}</span>
              <span className="bring-text">{o.text}</span>
              <span className="bring-arrow" aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
