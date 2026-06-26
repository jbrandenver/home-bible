import React from 'react';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  return <input className="border rounded px-3 py-2 w-full" {...props} />;
};
