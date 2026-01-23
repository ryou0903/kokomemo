import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'normal' | 'large';
  icon?: string;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'normal',
      icon,
      loading,
      disabled,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

    const variantStyles = {
      primary: 'bg-primary text-white hover:bg-primary-hover shadow-md',
      secondary: 'bg-white text-text border-2 border-border hover:bg-gray-50 shadow-sm',
      danger: 'bg-danger text-white hover:bg-danger-hover shadow-md',
      ghost: 'bg-transparent text-primary hover:bg-primary/10',
    };

    const sizeStyles = {
      normal: 'min-h-[48px] px-5 py-3 text-lg',
      large: 'min-h-[56px] px-6 py-4 text-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <span className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            読み込み中...
          </>
        ) : (
          <>
            {icon && <span className="mr-2">{icon}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
