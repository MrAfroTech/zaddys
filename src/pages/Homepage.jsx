import HeroSlideshow from '../components/HeroSlideshow';
import WhatBringsYou from '../components/WhatBringsYou';
import FeaturedFood from '../components/FeaturedFood';
import MenuPreview from '../components/MenuPreview';
import DealsBand from '../components/DealsBand';
import LocationContact from '../components/LocationContact';
import { heroSlides } from '../data/slides';
import { restaurant, ordering, orderLinkProps } from '../data/restaurant';

export default function Homepage() {
  return (
    <>
      <HeroSlideshow slides={heroSlides}>
        <p className="eyebrow eyebrow-light">Now open</p>
        <h1 className="hero-title">{restaurant.name}</h1>
        <p className="hero-tagline">{restaurant.tagline}. {restaurant.intro}</p>
        <div className="hero-ctas">
          <a {...orderLinkProps} className="btn btn-light btn-lg">{ordering.label}</a>
          <a href="/menu" className="btn btn-outline-light btn-lg">View menu</a>
          <a href="#deals" className="btn-text-light">Deals →</a>
        </div>
      </HeroSlideshow>
      <WhatBringsYou />
      <FeaturedFood />
      <MenuPreview />
      <DealsBand />
      <LocationContact />
    </>
  );
}
