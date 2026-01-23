export interface Place {
  id: string;
  name: string;
  memo: string;
  address: string;
  latitude: number;
  longitude: number;
  tabId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tab {
  id: string;
  name: string;
  isCustom: boolean;
  order: number;
}

export interface SearchHistory {
  query: string;
  placeId?: string;
  timestamp: string;
}

export type SortOption = 'name-asc' | 'created-desc' | 'created-asc';

export interface AppSettings {
  travelMode: 'driving' | 'transit' | 'walking';
}

export const DEFAULT_TABS: Tab[] = [
  { id: 'all', name: 'すべて', isCustom: false, order: 0 },
  { id: 'frequent', name: 'よく行く', isCustom: false, order: 1 },
  { id: 'planned', name: '今度行く', isCustom: false, order: 2 },
  { id: 'revisit', name: 'また来る', isCustom: false, order: 3 },
  { id: 'rest', name: '休憩場所', isCustom: false, order: 4 },
];

export const DEFAULT_SETTINGS: AppSettings = {
  travelMode: 'driving',
};
