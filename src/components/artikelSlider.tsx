// components/artikelSlider.tsx
import React from 'react';
import { Carousel } from 'react-bootstrap';
import banner1 from '../assets/Banner1.jpg';
import banner2 from '../assets/Banner2.jpg';
import banner3 from '../assets/Banner3.jpg';

const ArtikelSlider: React.FC = () => {
  return (
    <Carousel className="mb-4">
      {[banner1, banner2, banner3].map((banner, i) => (
        <Carousel.Item key={i}>
          <img
            className="d-block w-100"
            src={banner}
            alt={`Banner ${i + 1}`}
            style={{ maxHeight: '450px', objectFit: 'cover', borderRadius: '8px' }}
          />
        </Carousel.Item>
      ))}
    </Carousel>
  );
};

export default ArtikelSlider;