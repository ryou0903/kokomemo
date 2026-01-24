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

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google) return;

    const initMap = async () => {
      const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

      const map = new Map(mapRef.current!, {
        center: { lat: latitude, lng: longitude },
        zoom: 16,
        mapId: 'kokomemo-map',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy', // Allow single finger scroll
      });

      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: latitude, lng: longitude },
        gmpDraggable: true,
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Handle marker drag end
      marker.addListener('dragend', async () => {
        const position = marker.position as google.maps.LatLngLiteral;
        if (position && onLocationChange) {
          setIsLoadingLocation(true);
          try {
            const result = await reverseGeocode(position.lat, position.lng, GOOGLE_MAPS_API_KEY);
            onLocationChange(position.lat, position.lng, result.address, result.placeName);
          } catch (error) {
            console.error('Reverse geocode error:', error);
            onLocationChange(position.lat, position.lng, `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
          } finally {
            setIsLoadingLocation(false);
          }
        }
      });

      // Handle long press on map
      let pressStartPos = { x: 0, y: 0 };

      const handlePressStart = (e: MouseEvent | TouchEvent) => {
        if ('touches' in e) {
          pressStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else {
          pressStartPos = { x: e.clientX, y: e.clientY };
        }

        longPressTimerRef.current = window.setTimeout(async () => {
          // Get position from event
          let clientX: number, clientY: number;
          if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
          } else {
            clientX = e.clientX;
            clientY = e.clientY;
          }

          // Convert screen position to lat/lng
          const rect = mapRef.current!.getBoundingClientRect();
          const point = new google.maps.Point(clientX - rect.left, clientY - rect.top);
          const projection = map.getProjection();
          const bounds = map.getBounds();

          if (projection && bounds) {
            const ne = projection.fromLatLngToPoint(bounds.getNorthEast())!;
            const sw = projection.fromLatLngToPoint(bounds.getSouthWest())!;
            const scale = Math.pow(2, map.getZoom()!);

            const worldPoint = new google.maps.Point(
              sw.x + (point.x / scale) * (ne.x - sw.x) / mapRef.current!.clientWidth * scale,
              ne.y + (point.y / scale) * (sw.y - ne.y) / mapRef.current!.clientHeight * scale
            );

            const latLng = projection.fromPointToLatLng(worldPoint);

            if (latLng && onLocationChange) {
              const newLat = latLng.lat();
              const newLng = latLng.lng();

              // Move marker
              marker.position = { lat: newLat, lng: newLng };
              map.panTo({ lat: newLat, lng: newLng });

              // Get address
              setIsLoadingLocation(true);
              try {
                const result = await reverseGeocode(newLat, newLng, GOOGLE_MAPS_API_KEY);
                onLocationChange(newLat, newLng, result.address, result.placeName);
              } catch (error) {
                console.error('Reverse geocode error:', error);
                onLocationChange(newLat, newLng, `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`);
              } finally {
                setIsLoadingLocation(false);
              }
            }
          }
        }, 500); // 500ms for long press
      };

      const handlePressEnd = () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      };

      const handlePressMove = (e: MouseEvent | TouchEvent) => {
        let currentX: number, currentY: number;
        if ('touches' in e) {
          currentX = e.touches[0].clientX;
          currentY = e.touches[0].clientY;
        } else {
          currentX = e.clientX;
          currentY = e.clientY;
        }

        // Cancel long press if moved too much
        const moveThreshold = 10;
        if (
          Math.abs(currentX - pressStartPos.x) > moveThreshold ||
          Math.abs(currentY - pressStartPos.y) > moveThreshold
        ) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      };

      mapRef.current!.addEventListener('mousedown', handlePressStart);
      mapRef.current!.addEventListener('mouseup', handlePressEnd);
      mapRef.current!.addEventListener('mouseleave', handlePressEnd);
      mapRef.current!.addEventListener('mousemove', handlePressMove);
      mapRef.current!.addEventListener('touchstart', handlePressStart);
      mapRef.current!.addEventListener('touchend', handlePressEnd);
      mapRef.current!.addEventListener('touchcancel', handlePressEnd);
      mapRef.current!.addEventListener('touchmove', handlePressMove);

      return () => {
        mapRef.current?.removeEventListener('mousedown', handlePressStart);
        mapRef.current?.removeEventListener('mouseup', handlePressEnd);
        mapRef.current?.removeEventListener('mouseleave', handlePressEnd);
        mapRef.current?.removeEventListener('mousemove', handlePressMove);
        mapRef.current?.removeEventListener('touchstart', handlePressStart);
        mapRef.current?.removeEventListener('touchend', handlePressEnd);
        mapRef.current?.removeEventListener('touchcancel', handlePressEnd);
        mapRef.current?.removeEventListener('touchmove', handlePressMove);
      };
    };

    initMap();

    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [isLoaded, latitude, longitude, onLocationChange]);

  // Update marker position when props change
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.position = { lat: latitude, lng: longitude };
      mapInstanceRef.current.panTo({ lat: latitude, lng: longitude });
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
        長押しでピンを移動
      </div>
    </div>
  );
}
