import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  showHome?: boolean;
  rightAction?: {
    label: string;
    icon?: string;
    onClick: () => void;
  };
}

export function Header({ title, showBack, showHome, rightAction }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side - Back button only */}
        <div className="flex items-center gap-2">
          {showBack && !isHome && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-white text-primary font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
              aria-label="戻る"
            >
              <span className="text-lg">←</span>
              <span>戻る</span>
            </button>
          )}
        </div>

        <h1 className="text-xl font-bold text-text absolute left-1/2 -translate-x-1/2">
          {title}
        </h1>

        {/* Right side - Home button and rightAction */}
        <div className="flex items-center gap-2">
          {showHome && !isHome && (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-white text-text hover:bg-gray-50 active:bg-gray-100 transition-colors"
              aria-label="最初の画面に戻る"
            >
              <span className="text-lg">🏠</span>
            </button>
          )}
          {rightAction && (
            <button
              onClick={rightAction.onClick}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-white text-text font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              {rightAction.icon && <span className="text-lg">{rightAction.icon}</span>}
              <span>{rightAction.label}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
