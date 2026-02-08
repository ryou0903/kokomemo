import { useState, useEffect, useCallback } from 'react';

interface UseGoogleMapsOptions {
  apiKey: string;
  libraries?: string[];
}

interface UseGoogleMapsResult {
  isLoaded: boolean;
  loadError: Error | null;
  authError: string | null;
}

let isScriptLoading = false;
let isScriptLoaded = false;
const loadCallbacks: (() => void)[] = [];
let globalAuthError: string | null = null;
const authErrorCallbacks: ((error: string) => void)[] = [];

const DEFAULT_LIBRARIES = ['places'];

// Google Maps認証エラーのグローバルハンドラー
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    const errorMsg = 'Google Maps API認証エラー: APIキーまたは課金設定を確認してください';
    console.error(errorMsg);
    globalAuthError = errorMsg;
    authErrorCallbacks.forEach(cb => cb(errorMsg));
  };
}

export function useGoogleMaps({ apiKey, libraries = DEFAULT_LIBRARIES }: UseGoogleMapsOptions): UseGoogleMapsResult {
  const [isLoaded, setIsLoaded] = useState(isScriptLoaded);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [authError, setAuthError] = useState<string | null>(globalAuthError);

  useEffect(() => {
    // 認証エラーコールバックを登録
    const handleAuthError = (error: string) => setAuthError(error);
    authErrorCallbacks.push(handleAuthError);

    return () => {
      const index = authErrorCallbacks.indexOf(handleAuthError);
      if (index > -1) authErrorCallbacks.splice(index, 1);
    };
  }, []);

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    // Check if already loaded
    if (isScriptLoaded || window.google?.maps) {
      isScriptLoaded = true;
      setIsLoaded(true);
      return;
    }

    if (isScriptLoading) {
      loadCallbacks.push(() => setIsLoaded(true));
      return;
    }

    isScriptLoading = true;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries.join(',')}&language=ja&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;

    // コールバック関数を設定
    (window as any).__googleMapsCallback = () => {
      isScriptLoaded = true;
      isScriptLoading = false;
      setIsLoaded(true);
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };

    script.onerror = () => {
      isScriptLoading = false;
      const error = new Error('Google Maps APIの読み込みに失敗しました');
      setLoadError(error);
    };

    document.head.appendChild(script);
  }, [apiKey]);

  return { isLoaded, loadError, authError };
}

export function usePlacesAutocomplete(isGoogleLoaded: boolean) {
  const [sessionToken, setSessionToken] = useState<google.maps.places.AutocompleteSessionToken | null>(null);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (isGoogleLoaded && window.google?.maps?.places) {
      try {
        setAutocompleteService(new google.maps.places.AutocompleteService());
        // PlacesService needs a DOM element or map, we create a dummy div
        const dummyDiv = document.createElement('div');
        setPlacesService(new google.maps.places.PlacesService(dummyDiv));
        setSessionToken(new google.maps.places.AutocompleteSessionToken());
        console.log('Places services initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Places services:', error);
      }
    }
  }, [isGoogleLoaded]);

  const refreshSessionToken = useCallback(() => {
    if (window.google) {
      setSessionToken(new google.maps.places.AutocompleteSessionToken());
    }
  }, []);

  const getPlacePredictions = useCallback(
    async (input: string, origin?: { lat: number; lng: number }): Promise<google.maps.places.AutocompletePrediction[]> => {
      if (!autocompleteService || !sessionToken || !input.trim()) {
        return [];
      }

      return new Promise((resolve) => {
        try {
          // origin の作成を try-catch で囲む（古いブラウザ対策）
          let originLatLng: google.maps.LatLng | undefined;
          if (origin && window.google?.maps?.LatLng) {
            try {
              originLatLng = new google.maps.LatLng(origin.lat, origin.lng);
            } catch (e) {
              console.warn('Failed to create LatLng for origin:', e);
            }
          }

          autocompleteService.getPlacePredictions(
            {
              input,
              sessionToken,
              componentRestrictions: { country: 'jp' },
              origin: originLatLng,
            },
            (predictions, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                resolve(predictions);
              } else {
                resolve([]);
              }
            }
          );
        } catch (error) {
          console.warn('getPlacePredictions error:', error);
          resolve([]);
        }
      });
    },
    [autocompleteService, sessionToken]
  );

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<google.maps.places.PlaceResult | null> => {
      if (!placesService || !sessionToken) {
        return null;
      }

      return new Promise((resolve) => {
        try {
          placesService.getDetails(
            {
              placeId,
              fields: ['name', 'formatted_address', 'geometry', 'place_id'],
              sessionToken,
            },
            (place, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                resolve(place);
                refreshSessionToken();
              } else {
                console.warn('getPlaceDetails failed with status:', status);
                resolve(null);
              }
            }
          );
        } catch (error) {
          console.warn('getPlaceDetails error:', error);
          resolve(null);
        }
      });
    },
    [placesService, sessionToken, refreshSessionToken]
  );

  return {
    getPlacePredictions,
    getPlaceDetails,
    isReady: !!autocompleteService && !!sessionToken,
  };
}
