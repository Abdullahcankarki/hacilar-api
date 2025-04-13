// SuccessOverlay.tsx
import React from 'react';
import '../App.css';

const SuccessOverlay: React.FC = () => {
  return (
    <div className="success-overlay">
      <svg viewBox="0 0 100 100">
        <circle className="success-circle" cx="50" cy="50" r="45" />
        <path className="success-check" d="M30 50 L45 65 L70 35" />
      </svg>
    </div>
  );
};

export default SuccessOverlay;
