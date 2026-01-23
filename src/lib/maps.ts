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

export function initPlacesServices(map: google.maps.Map): void {
  autocompleteService = new google.maps.places.AutocompleteService();
  placesService = new google.maps.places.PlacesService(map);
}

export function getAutocomplete(
  input: string,
  sessionToken: google.maps.places.AutocompleteSessionToken
): Promise<google.maps.places.AutocompletePrediction[]> {
  return new Promise((resolve, reject) => {
    if (!autocompleteService) {
      reject(new Error('Places service not initialized'));
      return;
    }

    autocompleteService.getPlacePredictions(
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
    if (!placesService) {
      reject(new Error('Places service not initialized'));
      return;
    }

    placesService.getDetails(
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
