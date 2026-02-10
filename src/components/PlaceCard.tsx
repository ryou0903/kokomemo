import { useState } from 'react';
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
  const [showDetail, setShowDetail] = useState(false);

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
  const formattedFullDate = format(createdDate, 'yyyy年M月d日 H:mm', { locale: ja });

  // カテゴリ名を取得
  const tabs = getTabs();
  const category = tabs.find(t => t.id === place.tabId);
  const categoryName = category?.name || '';
  const categoryColor = getCategoryColor(place.tabId);

  return (
    <>
      <Card
        className="relative overflow-hidden cursor-pointer active:bg-gray-50 transition-colors"
        onClick={() => setShowDetail(true)}
      >
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
          <div className="flex gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
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

      {/* 詳細モーダル */}
      {showDetail && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
              <h2 className="text-lg font-bold text-text">場所の詳細</h2>
              <button
                onClick={() => setShowDetail(false)}
                className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* コンテンツ */}
            <div className="p-4 flex flex-col gap-4">
              {/* カテゴリと日時 */}
              <div className="flex justify-between items-center">
                {categoryName && (
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-white ${categoryColor}`}>
                    {categoryName}
                  </span>
                )}
                <span className="text-sm text-text-secondary">
                  {formattedFullDate}
                </span>
              </div>

              {/* 場所名 */}
              <div>
                <p className="text-sm text-text-secondary mb-1">場所の名前</p>
                <p className="text-xl font-bold text-text">{place.name}</p>
              </div>

              {/* 住所 */}
              {place.address && (
                <div>
                  <p className="text-sm text-text-secondary mb-1">住所</p>
                  <p className="text-base text-text">📍 {place.address}</p>
                </div>
              )}

              {/* 座標 */}
              <div>
                <p className="text-sm text-text-secondary mb-1">座標</p>
                <p className="text-sm text-text font-mono">
                  {place.latitude.toFixed(6)}, {place.longitude.toFixed(6)}
                </p>
              </div>

              {/* メモ */}
              {place.memo && (
                <div>
                  <p className="text-sm text-text-secondary mb-1">メモ</p>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-base text-text whitespace-pre-wrap">{place.memo}</p>
                  </div>
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex gap-2 mt-2">
                <Button
                  variant="secondary"
                  size="normal"
                  icon="✏️"
                  onClick={() => {
                    setShowDetail(false);
                    onEdit(place);
                  }}
                  className="flex-1"
                >
                  編集
                </Button>
                <Button
                  variant="primary"
                  size="normal"
                  icon="🚗"
                  onClick={() => {
                    setShowDetail(false);
                    handleNavigate();
                  }}
                  className="flex-1"
                >
                  ナビ開始
                </Button>
              </div>

              {/* Google Mapで開く */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-primary text-sm py-2 active:opacity-70"
              >
                Google マップで開く →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

