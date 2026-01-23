import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Place, Tab, SortOption } from '../types';
import { getPlaces, getTabs, savePlace } from '../lib/storage';
import { openNavigation } from '../lib/maps';
import { getSettings } from '../lib/storage';
import { Header } from '../components/layout/Header';
import { Button, TabBar, Loading } from '../components/ui';
import { PlaceCard } from '../components/PlaceCard';
import { SearchBar, type PlaceResult } from '../components/SearchBar';
import { SortSelect } from '../components/SortSelect';
import { useToast } from '../contexts/ToastContext';

export function HomePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [places, setPlaces] = useState<Place[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('created-desc');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(() => {
    setPlaces(getPlaces());
    setTabs(getTabs());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPlaces = useMemo(() => {
    let result = places;

    // Filter by tab
    if (activeTabId !== 'all') {
      result = result.filter((p) => p.tabId === activeTabId);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.name.localeCompare(b.name, 'ja');
        case 'created-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'created-desc':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [places, activeTabId, sortOption]);

  const handlePlaceSelected = useCallback(
    (place: PlaceResult, action: 'register' | 'navigate' | 'both') => {
      const settings = getSettings();

      if (action === 'navigate') {
        openNavigation(place.latitude, place.longitude, settings.travelMode);
      } else if (action === 'register') {
        // Navigate to place registration with pre-filled data
        const params = new URLSearchParams({
          name: place.name,
          address: place.address,
          lat: place.latitude.toString(),
          lng: place.longitude.toString(),
        });
        navigate(`/place/new?${params.toString()}`);
      } else if (action === 'both') {
        // Save place and navigate
        savePlace({
          name: place.name,
          memo: '',
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          tabId: 'frequent',
        });
        showToast('場所を登録しました');
        loadData();
        openNavigation(place.latitude, place.longitude, settings.travelMode);
      }
    },
    [navigate, showToast, loadData]
  );

  const handleEditPlace = useCallback(
    (place: Place) => {
      navigate(`/place/${place.id}`);
    },
    [navigate]
  );

  const handleRegisterCurrentLocation = useCallback(() => {
    navigate('/place/new?useCurrentLocation=true');
  }, [navigate]);

  if (isLoading) {
    return <Loading fullScreen message="読み込み中..." />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="ここメモ"
        rightAction={{
          label: 'カレンダー',
          icon: '📅',
          onClick: () => navigate('/calendar'),
        }}
      />

      <main className="flex-1 flex flex-col">
        <SearchBar onPlaceSelected={handlePlaceSelected} />

        <div className="px-4 py-3">
          <Button
            variant="primary"
            size="large"
            icon="📍"
            onClick={handleRegisterCurrentLocation}
            className="w-full"
          >
            今いる場所を登録
          </Button>
        </div>

        <TabBar tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />

        {activeTabId === 'all' && <SortSelect value={sortOption} onChange={setSortOption} />}

        <div className="flex-1 px-4 pb-8">
          {filteredPlaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-6xl mb-4">📍</p>
              <p className="text-xl text-text-secondary">
                {activeTabId === 'all'
                  ? 'まだ場所が登録されていません'
                  : 'このカテゴリには場所がありません'}
              </p>
              {activeTabId === 'all' && (
                <p className="text-lg text-text-secondary mt-2">
                  上のボタンから場所を登録してみましょう
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredPlaces.map((place) => (
                <PlaceCard key={place.id} place={place} onEdit={handleEditPlace} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
