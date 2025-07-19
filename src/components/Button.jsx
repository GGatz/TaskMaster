// src/client/src/components/Button.jsx
import React from 'react';

const VARIANTS = {
  primary: {
    background: '#007bff',
    hover: '#0056b3',
    active: '#004080',
    color: '#fff',
  },
  secondary: {
    background: '#6c757d',
    hover: '#5a6268',
    active: '#4e555b',
    color: '#fff',
  },
  danger: {
    background: '#dc3545',
    hover: '#b02a37',
    active: '#842029',
    color: '#fff',
  },
};

const SIZES = {
  small: {
    fontSize: '0.8rem',
    padding: '0.3rem 0.6rem',
  },
  medium: {
    fontSize: '1rem',
    padding: '0.5rem 1rem',
  },
  large: {
    fontSize: '1.2rem',
    padding: '0.75rem 1.25rem',
  },
};

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style = {},
  className = '',
  type = 'button',
  ...props
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.medium;

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`btn ${className}`}
      style={{
        backgroundColor: disabled ? '#ccc' : v.background,
        color: disabled ? '#666' : v.color,
        padding: s.padding,
        fontSize: s.fontSize,
        border: 'none',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.3s ease, transform 0.2s ease',
        userSelect: 'none',
        outline: 'none',
        ...style,
      }}
      {...props}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.95)';
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = v.hover;
      }}
      onMouseOut={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = v.background;
      }}
    >
      {children}
    </button>
  );
}
