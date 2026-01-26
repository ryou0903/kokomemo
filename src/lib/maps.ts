/// <reference types="@types/google.maps" />
import type { AppSettings } from '../types';

export function openNavigation(
  latitude: number,
  longitude: number,
  travelMode: AppSettings['travelMode'] = 'driving'
): void {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=${travelMode}`;
  window.open(url, '_blank');
}

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function getCurrentLocation(): Promise<LocationResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('お使いのブラウザは位置情報に対応していません'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('位置情報の使用が許可されていません。設定から許可してください'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('現在地を取得できませんでした。電波の良い場所で再度お試しください'));
            break;
          case error.TIMEOUT:
            reject(new Error('位置情報の取得に時間がかかっています。再度お試しください'));
            break;
          default:
            reject(new Error('位置情報の取得に失敗しました'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  });
}

export interface ReverseGeocodeResult {
  address: string;
  placeName?: string;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  apiKey: string
): Promise<ReverseGeocodeResult> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}&language=ja`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.length) {
    return { address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` };
  }

  const result = data.results[0];
  const address = result.formatted_address || '';

  // Try to find a more specific place name
  let placeName: string | undefined;
  for (const r of data.results) {
    const types = r.types || [];
    if (
      types.includes('point_of_interest') ||
      types.includes('establishment') ||
      types.includes('premise')
    ) {
      placeName = r.name || r.formatted_address?.split(',')[0];
      break;
    }
  }

  return {
    address: address.replace(/^日本、?〒?\d{3}-?\d{4}\s*/, ''),
    placeName,
  };
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;

// 遅延初期化: AutocompleteServiceを取得
function getAutocompleteService(): google.maps.places.AutocompleteService | null {
  if (!autocompleteService && window.google?.maps?.places) {
    autocompleteService = new google.maps.places.AutocompleteService();
  }
  return autocompleteService;
}

// 遅延初期化: PlacesServiceを取得（ダミーdivを使用）
function getPlacesService(): google.maps.places.PlacesService | null {
  if (!placesService && window.google?.maps?.places) {
    placesService = new google.maps.places.PlacesService(document.createElement('div'));
  }
  return placesService;
}

export function getAutocomplete(
  input: string,
  sessionToken: google.maps.places.AutocompleteSessionToken
): Promise<google.maps.places.AutocompletePrediction[]> {
  return new Promise((resolve, reject) => {
    const service = getAutocompleteService();
    if (!service) {
      reject(new Error('Places service not initialized'));
      return;
    }

    service.getPlacePredictions(
      {
        input,
        sessionToken,
        componentRestrictions: { country: 'jp' },
        language: 'ja',
      },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          resolve(predictions);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          reject(new Error('Failed to get autocomplete predictions'));
        }
      }
    );
  });
}

export function getPlaceDetails(
  placeId: string,
  sessionToken: google.maps.places.AutocompleteSessionToken
): Promise<PlaceSearchResult> {
  return new Promise((resolve, reject) => {
    const service = getPlacesService();
    if (!service) {
      reject(new Error('Places service not initialized'));
      return;
    }

    service.getDetails(
      {
        placeId,
        fields: ['name', 'formatted_address', 'geometry'],
        sessionToken,
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          resolve({
            placeId,
            name: place.name || '',
            address: place.formatted_address || '',
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          });
        } else {
          reject(new Error('Failed to get place details'));
        }
      }
    );
  });
}

// 周辺検索結果の型
export interface NearbyPlaceResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

// 距離計算関数（Haversine formula）
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // 地球の半径（メートル）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Text Search API を使用した周辺検索
// 注意: 新しいPlaces API (v1) を使用。古いブラウザでは動作しない場合がある
export async function searchNearbyPlaces(
  query: string,
  location: { lat: number; lng: number },
  apiKey: string,
  radius: number = 5000
): Promise<NearbyPlaceResult[]> {
  // fetch が利用可能かチェック
  if (typeof fetch === 'undefined') {
    console.warn('fetch not available, skipping nearby search');
    return [];
  }

  const url = 'https://places.googleapis.com/v1/places:searchText';

  // タイムアウト付きのfetch（古いデバイス対応）
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;

  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: { latitude: location.lat, longitude: location.lng },
            radius: radius
          }
        },
        languageCode: 'ja',
        maxResultCount: 5
      })
    };

    // AbortControllerが利用可能な場合のみsignalを追加
    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    const response = await fetch(url, fetchOptions);

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Nearby search API error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();

    if (!data.places) return [];

    return data.places.map((place: any) => ({
      placeId: place.id,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      latitude: place.location?.latitude || 0,
      longitude: place.location?.longitude || 0,
      distanceMeters: calculateDistance(
        location.lat, location.lng,
        place.location?.latitude || 0, place.location?.longitude || 0
      )
    })).sort((a: NearbyPlaceResult, b: NearbyPlaceResult) =>
      a.distanceMeters - b.distanceMeters
    );
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    // AbortErrorは警告のみ
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Nearby search timed out');
    } else {
      console.warn('Nearby search error:', error);
    }
    return [];
  }
}
