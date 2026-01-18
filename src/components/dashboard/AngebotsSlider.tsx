import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

// Original Cartzilla-Bilder importieren
import img1 from '@/assets/auto1.png';
import img2 from '@/assets/schnell1.png';
import img3 from '@/assets/shop.png';

const AngebotsSlider: React.FC = () => {
  return (
    <section className="container pt-4 pb-5 mb-2 mb-sm-3 mb-lg-4 mb-xl-5">
      <Swiper
        modules={[Pagination]}
        slidesPerView={1}
        spaceBetween={24}
        pagination={{ clickable: true }}
        breakpoints={{ 680: { slidesPerView: 2 }, 992: { slidesPerView: 3 } }}
        className="swiper"
      >
        {/* Angebot 1 */}
        <SwiperSlide className="swiper-slide h-auto">
          <div className="position-relative d-flex justify-content-between align-items-center h-100 bg-primary-subtle rounded-5 overflow-hidden ps-2 ps-xl-3">
            <div className="d-flex flex-column pt-4 px-3 pb-3">
              <p className="fs-xs pb-2 mb-1">Für jeden Betrieb, ob klein oder groß</p>
              <h2 className="h5 mb-2 mb-xxl-3">Pünktlich geliefert</h2>
              <div className="nav">
                <a className="nav-link animate-underline stretched-link text-body-emphasis text-nowrap px-0" href="#">
                  <span className="animate-target">Jetzt bestellen</span>
                  <i className="ci-chevron-right fs-base ms-1"></i>
                </a>
              </div>
            </div>
            <div className="ratio w-100 align-self-end rtl-flip" style={{ maxWidth: '216px', aspectRatio: '240 / 216' }}>
              <img src={img1} alt="Pünktliche Lieferung" className="img-fluid" />
            </div>
          </div>
        </SwiperSlide>

        {/* Angebot 2 */}
        <SwiperSlide className="swiper-slide h-auto">
          <div className="position-relative d-flex justify-content-between align-items-center h-100 bg-success-subtle rounded-5 overflow-hidden ps-2 ps-xl-3">
            <div className="d-flex flex-column pt-4 px-3 pb-3">
              <p className="fs-xs pb-2 mb-1">Schnell & zuverlässig</p>
              <h2 className="h5 mb-2 mb-xxl-3">Heute bestellt – morgen bei Ihnen</h2>
              <div className="nav">
                <a className="nav-link animate-underline stretched-link text-body-emphasis text-nowrap px-0" href="#">
                  <span className="animate-target">Jetzt bestellen</span>
                  <i className="ci-chevron-right fs-base ms-1"></i>
                </a>
              </div>
            </div>
            <div className="ratio w-100 align-self-end rtl-flip" style={{ maxWidth: '216px', aspectRatio: '240 / 216' }}>
              <img src={img2} alt="Schnelle Lieferung" className="img-fluid" />
            </div>
          </div>
        </SwiperSlide>

        {/* Angebot 3 */}
        <SwiperSlide className="swiper-slide h-auto">
          <div className="position-relative d-flex justify-content-between align-items-center h-100 bg-info-subtle rounded-5 overflow-hidden ps-2 ps-xl-3">
            <div className="d-flex flex-column pt-4 px-3 pb-3">
              <p className="fs-xs pb-2 mb-1">Für Stammkunden</p>
              <h2 className="h5 mb-2 mb-xxl-3">Top Konditionen</h2>
              <div className="nav">
                <a className="nav-link animate-underline stretched-link text-body-emphasis text-nowrap px-0" href="#">
                  <span className="animate-target">Vorteile sichern</span>
                  <i className="ci-chevron-right fs-base ms-1"></i>
                </a>
              </div>
            </div>
            <div className="ratio w-100 align-self-end rtl-flip" style={{ maxWidth: '216px', aspectRatio: '240 / 216' }}>
              <img src={img3} alt="Konditionen" className="img-fluid" />
            </div>
          </div>
        </SwiperSlide>
      </Swiper>
      <div className="swiper-pagination position-static mt-3 mt-sm-4"></div>
    </section>
  );
};

export default AngebotsSlider;