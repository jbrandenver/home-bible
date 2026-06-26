import React from 'react';

export const EmptyState: React.FC<{ title: string; description?: string }> = ({ title, description }) => {
  return (
    <div className="text-center py-8">
      <div className="text-3xl mb-2">📦</div>
      <h3 className="text-lg font-medium">{title}</h3>
      {description && <p className="text-sm text-gray-600">{description}</p>}
    </div>
  );
};
