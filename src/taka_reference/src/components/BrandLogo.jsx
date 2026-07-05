import React from 'react';

export default function BrandLogo({ size = 28, style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Background glowing circle */}
      <circle cx="100" cy="100" r="90" fill="url(#brandGlow)" opacity="0.15" />
      
      {/* Stylized geometric double T and Flame */}
      {/* Left wing */}
      <path d="M40 70 L90 20 V150 L40 180 Z" fill="url(#brandGrad)" />
      {/* Right wing */}
      <path d="M160 70 L110 20 V150 L160 180 Z" fill="url(#brandGrad2)" />
      {/* Center flame/negative space core */}
      <path d="M100 50 C115 80, 115 110, 100 130 C85 110, 85 80, 100 50 Z" fill="#ffffff" />
      
      <defs>
        <radialGradient id="brandGlow" cx="100" cy="100" r="90" fx="100" fy="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brandGrad" x1="40" y1="20" x2="90" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
        <linearGradient id="brandGrad2" x1="160" y1="20" x2="110" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

