import { useRef, useEffect, useState } from 'react';
import { reverseGeocode } from '../lib/maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface InteractiveMapProps {
  latitude: number;
  longitude: number;
  onLocationChange?: (lat: number, lng: number, address: string, name?: string) => void;
  isLoaded: boolean;
}

export function InteractiveMap({ latitude, longitude, onLocationChange, isLoaded }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const isInitializedRef = useRef(false);

  // Store latest callback in ref to avoid re-initializing map
  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  // Store initial position
  const initialPositionRef = useRef({ lat: latitude, lng: longitude });

  // Initialize map only once
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google || isInitializedRef.current) return;

    isInitializedRef.current = true;

    const initMap = async () => {
      const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

      const initialPos = initialPositionRef.current;

      const map = new Map(mapRef.current!, {
        center: { lat: initialPos.lat, lng: initialPos.lng },
        zoom: 16,
        mapId: 'kokomemo-map',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });

      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: initialPos.lat, lng: initialPos.lng },
        gmpDraggable: true,
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Handle marker drag end
      marker.addListener('dragend', async () => {
        const position = marker.position as google.maps.LatLngLiteral;
        if (position && onLocationChangeRef.current) {
          setIsLoadingLocation(true);
          try {
            const result = await reverseGeocode(position.lat, position.lng, GOOGLE_MAPS_API_KEY);
            onLocationChangeRef.current(position.lat, position.lng, result.address, result.placeName);
          } catch (error) {
            console.error('Reverse geocode error:', error);
            onLocationChangeRef.current(position.lat, position.lng, `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
          } finally {
            setIsLoadingLocation(false);
          }
        }
      });

      // Handle long press using map click event
      let pressStartPos = { x: 0, y: 0 };
      let isPressing = false;

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          isPressing = true;
          pressStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

          longPressTimerRef.current = window.setTimeout(() => {
            if (isPressing) {
              // Trigger long press action at current touch position
              const touch = e.touches[0];
              if (touch) {
                handleLongPressAt(touch.clientX, touch.clientY);
              }
            }
          }, 600);
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isPressing) return;

        const touch = e.touches[0];
        if (!touch) return;

        const moveThreshold = 15;
        if (
          Math.abs(touch.clientX - pressStartPos.x) > moveThreshold ||
          Math.abs(touch.clientY - pressStartPos.y) > moveThreshold
        ) {
          // User is scrolling, cancel long press
          isPressing = false;
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      };

      const handleTouchEnd = () => {
        isPressing = false;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      };

      const handleLongPressAt = async (clientX: number, clientY: number) => {
        const rect = mapRef.current!.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Use overlay projection for accurate conversion
        const bounds = map.getBounds();
        const ne = bounds?.getNorthEast();
        const sw = bounds?.getSouthWest();

        if (ne && sw) {
          const mapWidth = rect.width;
          const mapHeight = rect.height;

          const lng = sw.lng() + (x / mapWidth) * (ne.lng() - sw.lng());
          const lat = ne.lat() - (y / mapHeight) * (ne.lat() - sw.lat());

          // Move marker without panning
          marker.position = { lat, lng };

          // Get address
          if (onLocationChangeRef.current) {
            setIsLoadingLocation(true);
            try {
              const result = await reverseGeocode(lat, lng, GOOGLE_MAPS_API_KEY);
              onLocationChangeRef.current(lat, lng, result.address, result.placeName);
            } catch (error) {
              console.error('Reverse geocode error:', error);
              onLocationChangeRef.current(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            } finally {
              setIsLoadingLocation(false);
            }
          }
        }
      };

      // Only add touch events for long press (mouse can use drag)
      const mapElement = mapRef.current!;
      mapElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      mapElement.addEventListener('touchmove', handleTouchMove, { passive: true });
      mapElement.addEventListener('touchend', handleTouchEnd);
      mapElement.addEventListener('touchcancel', handleTouchEnd);
    };

    initMap();

    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [isLoaded]);

  // Update marker position when props change (but don't pan map)
  useEffect(() => {
    if (markerRef.current && isInitializedRef.current) {
      const currentPos = markerRef.current.position as google.maps.LatLngLiteral | null;
      // Only update if position actually changed significantly (avoid floating point issues)
      if (currentPos) {
        const latDiff = Math.abs(currentPos.lat - latitude);
        const lngDiff = Math.abs(currentPos.lng - longitude);
        if (latDiff > 0.00001 || lngDiff > 0.00001) {
          markerRef.current.position = { lat: latitude, lng: longitude };
        }
      }
    }
  }, [latitude, longitude]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200 text-text-secondary">
        地図を読み込み中...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {isLoadingLocation && (
        <div className="absolute top-2 left-2 bg-white/90 px-3 py-1.5 rounded-lg shadow text-sm flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>住所を取得中...</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded text-xs text-text-secondary">
        ピンをドラッグまたは長押しで移動
      </div>
    </div>
  );
}
