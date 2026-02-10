import { forwardRef, type HTMLAttributes, type MouseEventHandler } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, className = '', children, onClick, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-surface rounded-2xl shadow-sm border border-border p-4
          ${hoverable ? 'transition-shadow hover:shadow-md' : ''}
          ${onClick ? 'cursor-pointer' : ''}
          ${className}
        `}
        onClick={onClick}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
