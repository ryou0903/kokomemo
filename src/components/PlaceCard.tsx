import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Place } from '../types';
import { Card, Button } from './ui';
import { openNavigation } from '../lib/maps';
import { getSettings } from '../lib/storage';

interface PlaceCardProps {
  place: Place;
  onEdit: (place: Place) => void;
  onNavigate?: (place: Place) => void;
}

export function PlaceCard({ place, onEdit, onNavigate }: PlaceCardProps) {
  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate(place);
    }
    const settings = getSettings();
    openNavigation(place.latitude, place.longitude, settings.travelMode);
  };

  const formattedDate = format(new Date(place.createdAt), 'yyyy年M月d日', { locale: ja });

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex-1">
        <h3 className="text-base font-bold text-text mb-0.5">{place.name}</h3>
        {place.memo && (
          <p className="text-sm text-text-secondary line-clamp-2 mb-1">{place.memo}</p>
        )}
        <p className="text-xs text-text-secondary/70">{formattedDate} に登録</p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="normal"
          icon="🚗"
          onClick={handleNavigate}
          className="flex-1"
        >
          ナビ開始
        </Button>
        <Button
          variant="secondary"
          size="small"
          icon="✏️"
          onClick={() => onEdit(place)}
          className="flex-none"
        >
          編集
        </Button>
      </div>
    </Card>
  );
}
