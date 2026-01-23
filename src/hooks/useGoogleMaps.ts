import { useState, useEffect, useCallback } from 'react';

interface UseGoogleMapsOptions {
  apiKey: string;
  libraries?: string[];
}

interface UseGoogleMapsResult {
  isLoaded: boolean;
  loadError: Error | null;
}

let isScriptLoading = false;
let isScriptLoaded = false;
const loadCallbacks: (() => void)[] = [];

export function useGoogleMaps({ apiKey, libraries = ['places'] }: UseGoogleMapsOptions): UseGoogleMapsResult {
  const [isLoaded, setIsLoaded] = useState(isScriptLoaded);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    if (isScriptLoaded) {
      setIsLoaded(true);
      return;
    }

    if (isScriptLoading) {
      loadCallbacks.push(() => setIsLoaded(true));
      return;
    }

    isScriptLoading = true;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries.join(',')}&language=ja`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
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
  }, [apiKey, libraries]);

  return { isLoaded, loadError };
}

export function usePlacesAutocomplete(isGoogleLoaded: boolean) {
  const [sessionToken, setSessionToken] = useState<google.maps.places.AutocompleteSessionToken | null>(null);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (isGoogleLoaded && window.google) {
      setAutocompleteService(new google.maps.places.AutocompleteService());
      // PlacesService needs a DOM element or map, we create a dummy div
      const dummyDiv = document.createElement('div');
      setPlacesService(new google.maps.places.PlacesService(dummyDiv));
      setSessionToken(new google.maps.places.AutocompleteSessionToken());
    }
  }, [isGoogleLoaded]);

  const refreshSessionToken = useCallback(() => {
    if (window.google) {
      setSessionToken(new google.maps.places.AutocompleteSessionToken());
    }
  }, []);

  const getPlacePredictions = useCallback(
    async (input: string): Promise<google.maps.places.AutocompletePrediction[]> => {
      if (!autocompleteService || !sessionToken || !input.trim()) {
        return [];
      }

      return new Promise((resolve) => {
        autocompleteService.getPlacePredictions(
          {
            input,
            sessionToken,
            componentRestrictions: { country: 'jp' },
          },
          (predictions, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              resolve(predictions);
            } else {
              resolve([]);
            }
          }
        );
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
              resolve(null);
            }
          }
        );
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
