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

  const createdDate = new Date(place.createdAt);
  const formattedDate = format(createdDate, 'M月d日', { locale: ja });
  const formattedTime = format(createdDate, 'H:mm', { locale: ja });

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex-1">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-base font-bold text-text flex-1">{place.name}</h3>
          <span className="text-xs text-text-secondary whitespace-nowrap">
            {formattedDate} {formattedTime}
          </span>
        </div>
        {place.memo && (
          <p className="text-sm text-text-secondary line-clamp-2 mt-1">{place.memo}</p>
        )}
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
