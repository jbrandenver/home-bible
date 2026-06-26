import React from 'react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return <div className={`rounded-lg shadow-sm bg-white p-4 ${className}`}>{children}</div>;
};
