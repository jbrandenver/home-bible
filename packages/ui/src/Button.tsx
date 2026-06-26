import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
};

export const Button: React.FC<Props> = ({ children, variant = 'primary', ...rest }) => {
  const base = 'px-4 py-2 rounded-md font-medium';
  const classes = variant === 'primary' ? base + ' bg-amber-600 text-white' : base + ' bg-gray-100 text-gray-900';
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
};
