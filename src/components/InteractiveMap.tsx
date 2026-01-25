import { useRef, useEffect, useState, useCallback } from 'react';
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
  const currentLocationMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const isInitializedRef = useRef(false);
  const hasInitialPanRef = useRef(false);

  // Current location state
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [hasOrientationSensor, setHasOrientationSensor] = useState(false);

  // Store latest callback in ref to avoid re-initializing map
  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  // Store initial position
  const initialPositionRef = useRef({ lat: latitude, lng: longitude });

  // Watch current location
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Geolocation watch error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Device orientation for heading
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // iOS: webkitCompassHeading is more accurate
      const compassHeading = (event as any).webkitCompassHeading;
      if (compassHeading !== undefined && compassHeading !== null) {
        setHeading(compassHeading);
        setHasOrientationSensor(true);
      } else if (event.alpha !== null) {
        // Android: alpha is counterclockwise from north, convert to clockwise
        setHeading(360 - event.alpha);
        setHasOrientationSensor(true);
      }
    };

    // Check if permission API exists (iOS 13+)
    const DeviceOrientationEventWithPermission = DeviceOrientationEvent as any;
    if (typeof DeviceOrientationEventWithPermission.requestPermission === 'function') {
      // Will request permission on user gesture later
      // For now, don't add listener
    } else {
      // Android and older iOS - just add listener
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // Request orientation permission on iOS (needs user gesture)
  const requestOrientationPermission = useCallback(async () => {
    const DeviceOrientationEventWithPermission = DeviceOrientationEvent as any;
    if (typeof DeviceOrientationEventWithPermission.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEventWithPermission.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', (event: DeviceOrientationEvent) => {
            const compassHeading = (event as any).webkitCompassHeading;
            if (compassHeading !== undefined && compassHeading !== null) {
              setHeading(compassHeading);
              setHasOrientationSensor(true);
            }
          }, true);
        }
      } catch (error) {
        console.error('Orientation permission error:', error);
      }
    }
  }, []);

  // Create current location marker element
  const createCurrentLocationMarkerContent = useCallback(() => {
    const container = document.createElement('div');
    container.className = 'relative flex items-center justify-center';
    container.style.width = '80px';
    container.style.height = '80px';

    // Direction indicator (cone shape)
    const directionIndicator = document.createElement('div');
    directionIndicator.id = 'direction-indicator';
    directionIndicator.style.cssText = `
      position: absolute;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: conic-gradient(
        from -30deg,
        transparent 0deg,
        rgba(59, 130, 246, 0.4) 0deg,
        rgba(59, 130, 246, 0.4) 60deg,
        transparent 60deg
      );
      opacity: 0;
      transition: opacity 0.3s, transform 0.1s;
      pointer-events: none;
    `;
    container.appendChild(directionIndicator);

    // Pulse animation
    const pulse = document.createElement('div');
    pulse.style.cssText = `
      position: absolute;
      width: 20px;
      height: 20px;
      background-color: rgb(59, 130, 246);
      border-radius: 50%;
      animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      opacity: 0.4;
    `;
    container.appendChild(pulse);

    // Blue dot (center)
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: relative;
      width: 16px;
      height: 16px;
      background-color: rgb(59, 130, 246);
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      z-index: 10;
    `;
    container.appendChild(dot);

    // Add keyframes for ping animation
    if (!document.getElementById('ping-animation-style')) {
      const style = document.createElement('style');
      style.id = 'ping-animation-style';
      style.textContent = `
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.4; }
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    return container;
  }, []);

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

      // Red pin marker (for place selection)
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
        // Request orientation permission on iOS (user gesture)
        requestOrientationPermission();
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
  }, [isLoaded, requestOrientationPermission]);

  // Create/update current location marker
  useEffect(() => {
    if (!mapInstanceRef.current || !isInitializedRef.current || !currentLocation) return;

    const createMarker = async () => {
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

      if (!currentLocationMarkerRef.current) {
        // Create new marker
        const content = createCurrentLocationMarkerContent();
        currentLocationMarkerRef.current = new AdvancedMarkerElement({
          map: mapInstanceRef.current!,
          position: currentLocation,
          content,
        });
      } else {
        // Update position
        currentLocationMarkerRef.current.position = currentLocation;
      }
    };

    createMarker();
  }, [currentLocation, createCurrentLocationMarkerContent]);

  // Update direction indicator rotation
  useEffect(() => {
    if (!currentLocationMarkerRef.current || heading === null) return;

    const content = currentLocationMarkerRef.current.content as HTMLElement;
    const indicator = content?.querySelector('#direction-indicator') as HTMLElement;

    if (indicator && hasOrientationSensor) {
      indicator.style.transform = `rotate(${heading}deg)`;
      indicator.style.opacity = '1';
    }
  }, [heading, hasOrientationSensor]);

  // Pan map to new position when it changes significantly (initial location load)
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !isInitializedRef.current) return;
    if (hasInitialPanRef.current) return; // Only pan once for initial location

    const currentCenter = mapInstanceRef.current.getCenter();
    if (!currentCenter) return;

    const latDiff = Math.abs(currentCenter.lat() - latitude);
    const lngDiff = Math.abs(currentCenter.lng() - longitude);

    // Large movement (initial location load) - pan map and marker
    if (latDiff > 0.01 || lngDiff > 0.01) {
      hasInitialPanRef.current = true;
      mapInstanceRef.current.panTo({ lat: latitude, lng: longitude });
      markerRef.current.position = { lat: latitude, lng: longitude };
    }
  }, [latitude, longitude]);

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
