import React from 'react';

export const FloorSection: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => {
  return (
    <section className="mb-4">
      <h4 className="font-semibold mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </section>
  );
};
