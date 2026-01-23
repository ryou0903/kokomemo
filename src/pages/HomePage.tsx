import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Place, Tab, SortOption } from '../types';
import { getPlaces, getTabs } from '../lib/storage';
import { Header } from '../components/layout/Header';
import { Button, TabBar, Loading } from '../components/ui';
import { PlaceCard } from '../components/PlaceCard';
import { SearchBar, type SearchSuggestion } from '../components/SearchBar';
import { SortSelect } from '../components/SortSelect';

export function HomePage() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<Place[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('created-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);

  useEffect(() => {
    const loadData = () => {
      setPlaces(getPlaces());
      setTabs(getTabs());
      setIsLoading(false);
    };
    loadData();
  }, []);

  const filteredPlaces = useMemo(() => {
    let result = places;

    // Filter by tab
    if (activeTabId !== 'all') {
      result = result.filter((p) => p.tabId === activeTabId);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.memo.toLowerCase().includes(query) ||
          p.address.toLowerCase().includes(query)
      );
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
  }, [places, activeTabId, sortOption, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // In a full implementation, this would call Google Places API
    setSuggestions([]);
  }, []);

  const handleSelectSuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      if (suggestion.placeId) {
        // Navigate to place details or registration
        navigate(`/place/new?placeId=${suggestion.placeId}`);
      }
    },
    [navigate]
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
        <SearchBar
          onSearch={handleSearch}
          onSelectSuggestion={handleSelectSuggestion}
          suggestions={suggestions}
        />

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
                {searchQuery
                  ? '検索結果がありません'
                  : activeTabId === 'all'
                    ? 'まだ場所が登録されていません'
                    : 'このカテゴリには場所がありません'}
              </p>
              {!searchQuery && activeTabId === 'all' && (
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
