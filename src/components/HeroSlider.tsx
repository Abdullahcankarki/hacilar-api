import { useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Carousel from "bootstrap/js/dist/carousel";

// Assets (du hast die Dateien im assets-Ordner)
import banner1 from "../assets/Banner1.png";
import banner2 from "../assets/Banner2.png";
import banner3 from "../assets/Banner3.png";

/**
 * HeroSlider – Premium, mobil-optimierter Cartzilla-/Bootstrap-Slider
 * - Fade-Transition
 * - Vollflächige Bilder via object-fit
 * - Lesbarer Text dank Gradient-Overlay
 * - Mobile-first Typografie & Layout
 */
export default function HeroSlider() {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const carouselInstanceRef = useRef<Carousel | null>(null);

  useEffect(() => {
    if (!carouselRef.current) return;
    const instance = new Carousel(carouselRef.current, {
      interval: 5500,
      ride: "carousel",
      touch: true,
      wrap: true,
      pause: false,
      keyboard: true,
    });
    carouselInstanceRef.current = instance;
    return () => instance.dispose();
  }, []);

  return (
    <section className="container-fluid px-0">
      <style>{`
  :root{--brand:#3edbb7}
  .hero-wrap{position:relative}
  /* Responsive, oben fokussiert, ohne schwarze Ränder */
  .hero-slide{width:100%;height:60vh;min-height:320px;max-height:78vh;overflow:hidden}
  @media (max-width:1200px){.hero-slide{height:52vh}}
  @media (max-width:992px){.hero-slide{height:46vh}}
  @media (max-width:768px){.hero-slide{height:42vh;min-height:300px}}
  @media (max-width:576px){.hero-slide{height:38vh;min-height:280px}}

  .hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .hero-img.img1{object-position:center 65%}
  .hero-img.img3{object-position:center 35%}
  .hero-img.img2{object-position:center 25%}
  .hero-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,.18) 35%,rgba(0,0,0,.55) 100%)}
  .hero-caption{position:absolute;inset:0;display:flex;align-items:flex-end;padding:clamp(16px,4vw,48px)}
  @media (min-width:768px){.hero-caption{align-items:center}}

  /* Dezente CTA */
  .btn-cta{border:2px solid rgba(255,255,255,.92);color:#fff;background:transparent}
  .btn-cta:hover{background:#fff;color:#111}

  /* Individuelle Pfeile */
  .hero-nav{position:absolute;inset:0;pointer-events:none}
  .hero-nav .nav-btn{pointer-events:auto;position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}
  .hero-nav .nav-btn svg{width:20px;height:20px;fill:#fff}
  .hero-nav .prev{left:12px}
  .hero-nav .next{right:12px}
  .hero-nav .nav-btn:hover{background:rgba(0,0,0,.5)}
  @media (max-width:575.98px){.hero-nav{display:none}}

  /* Indikatoren dezent */
  .carousel-indicators [data-bs-target]{width:8px;height:8px;border-radius:50%}
`}</style>

      <div className="hero-wrap">
        <div
          id="heroCarousel"
          className="carousel slide carousel-fade position-relative"
          data-bs-ride="carousel"
          ref={carouselRef}
        >
          {/* Indicators */}
          <div className="carousel-indicators mb-1 mb-md-3">
            <button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="0" className="active" aria-current="true" aria-label="Slide 1" />
            <button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="1" aria-label="Slide 2" />
            <button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="2" aria-label="Slide 3" />
          </div>

          <div className="carousel-inner">
            {/* Slide 1 */}
            <div className="carousel-item active">
              <div className="hero-slide position-relative w-100">
                <img src={banner1} alt="Schafe auf grüner Weide" className="hero-img img1" loading="eager" />
                <div className="hero-overlay" />
                <div className="hero-caption text-center text-md-start">
                  <div className="container">
                    <span className="badge rounded-pill badge-brand">Hacilar – Qualität</span>
                    <h2 className="display-6 display-md-5 fw-bold mt-3 text-white">Natürliche Weiden. Reine Qualität.</h2>
                    <p className="lead mb-4 text-white-50">Aus verantwortungsvoller Haltung – der echte Geschmack der Natur.</p>
                    <a href="#produkte" className="btn btn-lg btn-cta rounded-pill">Jetzt entdecken</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 2 */}
            <div className="carousel-item">
              <div className="hero-slide position-relative w-100">
                <img src={banner2} alt="Kind spielt mit Hühnern" className="hero-img img2" loading="lazy" />
                <div className="hero-overlay" />
                <div className="hero-caption text-center text-md-start">
                  <div className="container">
                    <span className="badge rounded-pill badge-brand">Frisch vom Hof</span>
                    <h2 className="display-6 display-md-5 fw-bold mt-3 text-white">Glückliche Tiere. Gutes Gewissen.</h2>
                    <p className="lead mb-4 text-white-50">Natürlich aufgezogen – für Vertrauen bei jeder Zutat.</p>
                    <a href="#werte" className="btn btn-lg btn-cta rounded-pill">Unsere Werte</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 3 */}
            <div className="carousel-item">
              <div className="hero-slide position-relative w-100">
                <img src={banner3} alt="Bauer mit frischem Steak" className="hero-img img3" loading="lazy" />
                <div className="hero-overlay" />
                <div className="hero-caption text-center text-md-start">
                  <div className="container">
                    <span className="badge rounded-pill badge-brand">Regional & Ehrlich</span>
                    <h2 className="display-6 display-md-5 fw-bold mt-3 text-white">Frisch geschnitten. Meisterhaft veredelt.</h2>
                    <p className="lead mb-4 text-white-50">Handwerkstradition trifft höchste Ansprüche – direkt zu dir.</p>
                    <a href="#shop" className="btn btn-lg btn-cta rounded-pill">Zum Shop</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}