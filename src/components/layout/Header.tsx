import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/Button';

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
        <div className="flex items-center gap-2">
          {showBack && !isHome && (
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="!p-2 !min-h-0"
              aria-label="戻る"
            >
              <span className="text-xl">←</span>
              <span className="ml-1">戻る</span>
            </Button>
          )}
          {showHome && !isHome && (
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="!p-2 !min-h-0"
              aria-label="最初の画面に戻る"
            >
              <span className="text-xl">🏠</span>
              <span className="ml-1 hidden sm:inline">最初の画面</span>
            </Button>
          )}
        </div>

        <h1 className="text-xl font-bold text-text absolute left-1/2 -translate-x-1/2">
          {title}
        </h1>

        <div className="flex items-center">
          {rightAction && (
            <Button variant="ghost" onClick={rightAction.onClick} className="!p-2 !min-h-0">
              {rightAction.icon && <span className="mr-1">{rightAction.icon}</span>}
              {rightAction.label}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
