import { useEffect, useState } from 'react';
import Placeholder from './Placeholder';

const SLIDE_INTERVAL_MS = 5500;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reusable crossfading slideshow driven by a slides array
 * ({ src, alt, placeholder, label }). Content passed as children is layered
 * above a scrim so it stays readable over any image.
 *
 * `framed` is for small photos that would blur if stretched full-screen: the
 * background becomes a soft-focus copy and the photo itself shows sharp in a
 * frame beside the text.
 */
export default function HeroSlideshow({ slides, children, framed = false }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length < 2 || paused || prefersReducedMotion()) return undefined;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slides.length, paused]);

  return (
    <section className={`hero${framed ? ' hero-framed' : ''}`} aria-roledescription="carousel" aria-label="Zaddys">
      <div className="hero-slides" aria-hidden={framed || undefined}>
        {slides.map((slide, i) => (
          <div key={slide.src || slide.label} className={`hero-slide${i === index ? ' is-active' : ''}`} aria-hidden={i !== index}>
            {slide.placeholder || !slide.src ? (
              <Placeholder label={slide.label || slide.alt} className="placeholder-hero" />
            ) : (
              <img src={slide.src} alt={framed ? '' : slide.alt} loading={i === 0 ? 'eager' : 'lazy'} fetchpriority={i === 0 ? 'high' : undefined} />
            )}
          </div>
        ))}
      </div>
      <div className="hero-scrim" aria-hidden="true" />
      {framed && (
        <div className="hero-frame-wrap">
          <div className="hero-frame">
            {slides.filter((slide) => slide.src).map((slide, i) => (
              <img
                key={slide.src}
                src={slide.src}
                alt={slide.alt}
                className={i === index ? 'is-active' : undefined}
                aria-hidden={i !== index}
              />
            ))}
          </div>
        </div>
      )}
      <div className="hero-content">{children}</div>
      {slides.length > 1 && (
        <div className="hero-controls">
          {slides.map((slide, i) => (
            <button
              key={slide.src || slide.label}
              type="button"
              className={`hero-dot${i === index ? ' is-active' : ''}`}
              aria-label={`Show slide ${i + 1} of ${slides.length}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
          <button type="button" className="hero-pause" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Play' : 'Pause'}
          </button>
        </div>
      )}
    </section>
  );
}
