import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Place } from '../types';
import { Card, Button } from './ui';
import { openNavigation } from '../lib/maps';
import { getSettings, getTabs } from '../lib/storage';

interface PlaceCardProps {
  place: Place;
  onEdit: (place: Place) => void;
  onNavigate?: (place: Place) => void;
}

// カテゴリの色を取得
const getCategoryColor = (tabId: string): string => {
  const colors: Record<string, string> = {
    frequent: 'bg-blue-500',
    planned: 'bg-green-500',
    revisit: 'bg-purple-500',
    rest: 'bg-orange-500',
    convenience: 'bg-red-500',
    toilet: 'bg-cyan-500',
    other: 'bg-gray-500',
  };
  return colors[tabId] || 'bg-primary';
};

export function PlaceCard({ place, onEdit, onNavigate }: PlaceCardProps) {
  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate(place);
    }
    const settings = getSettings();
    openNavigation(place.latitude, place.longitude, settings.travelMode);
  };

  const createdDate = new Date(place.createdAt);
  const formattedDate = format(createdDate, 'M月d日', { locale: ja });
  const formattedTime = format(createdDate, 'H:mm', { locale: ja });

  // カテゴリ名を取得
  const tabs = getTabs();
  const category = tabs.find(t => t.id === place.tabId);
  const categoryName = category?.name || '';
  const categoryColor = getCategoryColor(place.tabId);

  return (
    <Card className="relative overflow-hidden">
      {/* 左側のカテゴリ色アクセントライン */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${categoryColor}`} />

      <div className="pl-3 flex flex-col gap-2">
        {/* ヘッダー: カテゴリ（左上） + 日時（右上） */}
        <div className="flex justify-between items-center gap-2">
          {categoryName && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium text-white ${categoryColor}`}>
              {categoryName}
            </span>
          )}
          <span className="text-sm text-text-secondary whitespace-nowrap ml-auto">
            {formattedDate} {formattedTime}
          </span>
        </div>

        {/* 場所名 */}
        <h3 className="text-lg font-bold text-text line-clamp-2">{place.name}</h3>

        {/* 住所 */}
        {place.address && (
          <p className="text-base text-text-secondary line-clamp-1">📍 {place.address}</p>
        )}

        {/* メモ */}
        {place.memo && (
          <p className="text-sm text-text-secondary line-clamp-1">💬 {place.memo}</p>
        )}

        {/* アクションボタン - 編集（左）、ナビ開始（右） */}
        <div className="flex gap-2 mt-1">
          <Button
            variant="secondary"
            size="small"
            icon="✏️"
            onClick={() => onEdit(place)}
            className="flex-1 whitespace-nowrap"
          >
            編集
          </Button>
          <Button
            variant="primary"
            size="small"
            icon="🚗"
            onClick={handleNavigate}
            className="flex-1 whitespace-nowrap"
          >
            ナビ開始
          </Button>
        </div>
      </div>
    </Card>
  );
}

