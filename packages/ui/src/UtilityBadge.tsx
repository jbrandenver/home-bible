import React from 'react';

export const UtilityBadge: React.FC<{ label: string }> = ({ label }) => {
  return <span className="inline-block bg-gray-100 px-2 py-1 rounded text-sm">{label}</span>;
};
