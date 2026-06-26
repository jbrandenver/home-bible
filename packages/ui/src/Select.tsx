import React from 'react';

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
  return <select className="border rounded px-3 py-2 w-full" {...props} />;
};
