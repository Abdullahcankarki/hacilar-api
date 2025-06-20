// ArtikelDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ArtikelResource, ArtikelPositionResource } from '../Resources';
import { getArtikelById } from '../backend/api';
import fallbackImage from '../Cartzilla/assets/img/shop/grocery/10.png';
import { useAuth } from '../providers/Authcontext';
import { useOutletContext } from 'react-router-dom';


const ArtikelDetails: React.FC = () => {
    const { id } = useParams();
    const [artikel, setArtikel] = useState<ArtikelResource | null>(null);
    const { user } = useAuth();
    const { setCart } = useOutletContext<{ setCart: React.Dispatch<React.SetStateAction<ArtikelPositionResource[]>> }>();

    // Add to cart handler
    const handleAddToCart = (position: ArtikelPositionResource) => {
      setCart((prevCart) => {
        const existing = prevCart.find((item) => item.artikel === position.artikel);
        if (existing) {
          return prevCart.map((item) =>
            item.artikel === position.artikel
              ? { ...item, menge: item.menge! + position.menge! }
              : item
          );
        } else {
          return [...prevCart, position];
        }
      });
    };

    useEffect(() => {
        if (id) {
            getArtikelById(id)
                .then(setArtikel)
                .catch(console.error);
        }
    }, [id]);

    if (!artikel) {
        return <div className="container py-5 text-center">Artikel wird geladen…</div>;
    }

    return (
        <section className="container pt-md-4 pb-5 mt-md-2 mt-lg-3 mb-2 mb-sm-3 mb-lg-4 mb-xl-5">
            <div className="row align-items-start">
                {/* Galerie */}
                <div className="col-md-6 col-lg-7 sticky-md-top z-1 mb-4 mb-md-0" style={{ marginTop: '-120px' }}>
                    <div className="d-flex" style={{ paddingTop: '120px' }}>
                        {/* Thumbnails */}
                        <div className="swiper swiper-thumbs d-none d-lg-block w-100 me-xl-3" style={{ maxWidth: '96px', height: '420px' }}>
                            <div className="swiper-wrapper flex-column">
                                {[(artikel?.bildUrl || fallbackImage)].map((src, i) => (
                                    <div key={i} className="swiper-slide swiper-thumb">
                                        <div className="ratio ratio-1x1" style={{ maxWidth: '94px' }}>
                                            <img src={src} className="swiper-thumb-img" alt={`Thumbnail ${i}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Großansicht */}
                        <div className="swiper w-100">
                            <div className="swiper-wrapper">
                                {[(artikel?.bildUrl || fallbackImage)].map((src, i) => (
                                    <div key={i} className="swiper-slide">
                                        <a className="ratio ratio-1x1 d-block cursor-zoom-in" href={src} data-glightbox data-gallery="product-gallery">
                                            <img src={src} alt={`Preview ${i}`} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                            <div className="swiper-pagination mb-n3 d-lg-none"></div>
                        </div>
                    </div>
                </div>

                {/* Details */}
                <div className="col-md-6 col-lg-5 position-relative">
                    <div className="ps-xxl-3">
                        <p className="fs-sm text-body-secondary">{artikel?.kategorie}</p>
                        <h1 className="h5 mb-2">{artikel?.name}</h1>
                        {/* Removed Favoriten button */}
                        {/* <div className="fs-sm fw-medium">{artikel?.gewicht}</div> */}
                        <div className="border rounded-pill px-4 py-2 my-4">
                            <div className="text-dark-emphasis fs-sm py-1">
                                Wir liefern deine Ware immer frisch!
                                <a className="text-dark-emphasis fw-medium ms-1" href="/home">Weitere Waren einkaufen</a>
                            </div>
                        </div>
                        <div className="h3">{artikel ? artikel.preis.toFixed(2) : '0.00'} €</div>
                        <div className="d-flex gap-3 mb-4">
                            <div className="count-input flex-shrink-0 rounded-pill">
                                <button type="button" className="btn btn-icon btn-lg" disabled><i className="ci-minus"></i></button>
                                <input type="number" className="form-control form-control-lg" value={1} min={1} readOnly />
                                <button type="button" className="btn btn-icon btn-lg"><i className="ci-plus"></i></button>
                            </div>
                            <button
                              type="button"
                              className="btn btn-lg btn-primary rounded-pill w-100"
                              onClick={() => {
                                if (!artikel?.id) return;
                                handleAddToCart({
                                  artikel: artikel.id,
                                  menge: 1,
                                  einzelpreis: artikel.preis,
                                });
                              }}
                            >
                              In den Warenkorb
                            </button>
                        </div>
                        <p className="fs-sm mb-4">{artikel?.beschreibung}</p>
                        <div className="d-flex flex-wrap gap-3 gap-xxl-4 fs-sm text-dark-emphasis mb-2">
                            <div className="d-flex align-items-center me-3"><i className="ci-gluten-free fs-xl text-body-emphasis me-2"></i>Glutenfrei</div>
                            <div className="d-flex align-items-center me-3"><i className="ci-broccoli fs-xl text-body-emphasis me-2"></i>Pflanzenbasiert</div>
                            <div className="d-flex align-items-center me-3"><i className="ci-leaf fs-xl text-body-emphasis me-2"></i>Vegan</div>
                            <div className="d-flex align-items-center"><i className="ci-avocado fs-xl text-body-emphasis me-2"></i>Keto</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ArtikelDetails;