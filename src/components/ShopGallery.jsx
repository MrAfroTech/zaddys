import { sectionPhotos } from '../data/photos';

/** "Inside Zaddys" strip — small tiles so the photos stay sharp. */
export default function ShopGallery() {
  return (
    <section className="section gallery" aria-labelledby="gallery-title">
      <div className="container">
        <p className="eyebrow">Now open</p>
        <h2 id="gallery-title" className="section-title">Inside Zaddys</h2>
        <ul className="gallery-grid">
          {sectionPhotos.gallery.map((photo) => (
            <li key={photo.src}>
              <img src={photo.src} alt={photo.alt} loading="lazy" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
