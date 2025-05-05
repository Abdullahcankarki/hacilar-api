import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

// Cartzilla-Bilder korrekt importieren
import slide1 from '../Cartzilla/assets/img/home/grocery/hero-slider/01.jpg';
import slide2 from '../Cartzilla/assets/img/home/grocery/hero-slider/02.jpg';
import slide3 from '../Cartzilla/assets/img/home/grocery/hero-slider/03.jpg';

const HeroSlider: React.FC = () => {
  return (
    <section className="position-relative">
      <Swiper
        modules={[Pagination, Autoplay, EffectFade]}
        effect="fade"
        loop
        speed={400}
        pagination={{ clickable: true }}
        autoplay={{ delay: 5500, disableOnInteraction: false }}
        className="position-absolute top-0 start-0 w-100 h-100"
      >
        {/* Slide 1 */}
        <SwiperSlide className="position-relative">
          <img
            src={slide1}
            alt="Fleisch Banner 1"
            className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover rtl-flip"
          />
          <div className="d-flex align-items-center w-100 h-100 position-relative z-2">
            <div className="container mt-lg-n4">
              <div className="row">
                <div className="col-9 col-sm-8 col-md-7 col-lg-6">
                  <h2 className="display-4 pb-2 pb-md-3 pb-lg-4 text-white">
                    Qualität, die auf der Zunge zergeht
                  </h2>
                </div>
              </div>
            </div>
          </div>
        </SwiperSlide>

        {/* Slide 2 */}
        <SwiperSlide className="position-relative">
          <img
            src={slide2}
            alt="Fleisch Banner 2"
            className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover rtl-flip"
          />
          <div className="d-flex align-items-center w-100 h-100 position-relative z-2">
            <div className="container mt-lg-n4">
              <div className="row">
                <div className="col-12 col-sm-10 col-md-7 col-lg-6">
                  <h2 className="display-4 pb-2 pb-md-3 pb-lg-4 text-white">
                    Vom Hof auf den Teller – 100 % frisch
                  </h2>
                </div>
              </div>
            </div>
          </div>
        </SwiperSlide>

        {/* Slide 3 */}
        <SwiperSlide className="position-relative">
          <img
            src={slide3}
            alt="Fleisch Banner 3"
            className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover rtl-flip"
          />
          <div className="d-flex align-items-center w-100 h-100 position-relative z-2">
            <div className="container mt-lg-n4">
              <div className="row">
                <div className="col-9 col-sm-8 col-md-7 col-lg-6">
                  <h2 className="display-4 pb-2 pb-md-3 pb-lg-4 text-white">
                    Fleischgenuss – wie er sein soll
                  </h2>
                </div>
              </div>
            </div>
          </div>
        </SwiperSlide>

        {/* Slider Pagination */}
        <div className="swiper-pagination pb-sm-2" />
      </Swiper>

      {/* Responsive Spacing */}
      <div className="d-md-none" style={{ height: '380px' }} />
      <div className="d-none d-md-block d-lg-none" style={{ height: '420px' }} />
      <div className="d-none d-lg-block d-xl-none" style={{ height: '500px' }} />
      <div className="d-none d-xl-block d-xxl-none" style={{ height: '560px' }} />
      <div className="d-none d-xxl-block" style={{ height: '624px' }} />
    </section>
  );
};

export default HeroSlider;