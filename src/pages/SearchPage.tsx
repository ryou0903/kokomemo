import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { InteractiveMap } from '../components/InteractiveMap';
import { useGoogleMaps, usePlacesAutocomplete } from '../hooks/useGoogleMaps';
import { openNavigation, getCurrentLocation } from '../lib/maps';
import { savePlace, getSettings, addSearchHistory } from '../lib/storage';
import { useToast } from '../contexts/ToastContext';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Default position (Tokyo Station)
const DEFAULT_POSITION = { lat: 35.6812, lng: 139.7671 };

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Suggestion {
  text: string;
  description?: string;
  placeId: string;
}

export function SearchPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFixingTypos, setIsFixingTypos] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [mapPosition, setMapPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingInitialLocation, setIsLoadingInitialLocation] = useState(true);

  const { isLoaded, loadError } = useGoogleMaps({ apiKey: GOOGLE_MAPS_API_KEY });
  const { getPlacePredictions, getPlaceDetails, isReady } = usePlacesAutocomplete(isLoaded);

  const debounceRef = useRef<number | null>(null);
  const queryRef = useRef(query);
  const isReadyRef = useRef(isReady);
  const getPlacePredictionsRef = useRef(getPlacePredictions);

  // Get current location on mount
  useEffect(() => {
    getCurrentLocation()
      .then((loc) => {
        setMapPosition({ lat: loc.latitude, lng: loc.longitude });
      })
      .catch(() => {
        // Use default position if location access denied
        setMapPosition(DEFAULT_POSITION);
      })
      .finally(() => {
        setIsLoadingInitialLocation(false);
      });
  }, []);

  // Keep refs in sync
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    getPlacePredictionsRef.current = getPlacePredictions;
  }, [getPlacePredictions]);

  useEffect(() => {
    if (loadError) {
      console.error('Google Maps load error:', loadError);
      showToast('Google Maps APIの読み込みに失敗しました', 'error');
    }
  }, [loadError, showToast]);

  // Voice input using Web Speech API
  const startVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast('お使いのブラウザは音声入力に対応していません', 'error');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleInputChange(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        showToast('マイクの使用が許可されていません', 'error');
      } else {
        showToast('音声認識に失敗しました', 'error');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [showToast]);

  // Fix typos using Gemini API
  const fixTypos = useCallback(async () => {
    if (!query.trim() || !GEMINI_API_KEY) {
      if (!GEMINI_API_KEY) {
        showToast('Gemini APIキーが設定されていません', 'error');
      }
      return;
    }

    setIsFixingTypos(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `以下の日本語テキストの誤字脱字を修正してください。場所や住所の検索クエリとして使用されます。修正後のテキストのみを返してください。余計な説明は不要です。

入力: ${query}

修正後:`
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 100,
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const correctedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (correctedText && correctedText !== query) {
        setQuery(correctedText);
        handleInputChange(correctedText);
        showToast('誤字を修正しました');
      } else {
        showToast('修正の必要はありませんでした', 'info');
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      showToast('誤字修正に失敗しました', 'error');
    } finally {
      setIsFixingTypos(false);
    }
  }, [query, showToast]);

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedPlace(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      if (!isReadyRef.current) {
        setIsSearching(false);
        return;
      }

      try {
        const predictions = await getPlacePredictionsRef.current(value);
        if (queryRef.current !== value) return;

        const placeSuggestions: Suggestion[] = predictions.map((p) => ({
          text: p.structured_formatting.main_text,
          description: p.structured_formatting.secondary_text,
          placeId: p.place_id,
        }));
        setSuggestions(placeSuggestions);
      } catch (error) {
        console.error('Place search error:', error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    setIsSearching(true);
    setSuggestions([]);
    try {
      const placeDetails = await getPlaceDetails(suggestion.placeId);
      if (placeDetails && placeDetails.geometry?.location) {
        const place: PlaceResult = {
          placeId: suggestion.placeId,
          name: placeDetails.name || suggestion.text,
          address: placeDetails.formatted_address || '',
          latitude: placeDetails.geometry.location.lat(),
          longitude: placeDetails.geometry.location.lng(),
        };
        addSearchHistory(suggestion.text, suggestion.placeId);
        setSelectedPlace(place);
        setMapPosition({ lat: place.latitude, lng: place.longitude });
        setQuery('');
      }
    } catch (error) {
      console.error('Failed to get place details:', error);
      showToast('場所の詳細を取得できませんでした', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle actions on selected place
  const handleRegister = () => {
    if (!selectedPlace) return;
    const params = new URLSearchParams({
      name: selectedPlace.name,
      address: selectedPlace.address,
      lat: selectedPlace.latitude.toString(),
      lng: selectedPlace.longitude.toString(),
    });
    navigate(`/place/new?${params.toString()}`);
  };

  const handleNavigate = () => {
    if (!selectedPlace) return;
    const settings = getSettings();
    openNavigation(selectedPlace.latitude, selectedPlace.longitude, settings.travelMode);
  };

  const handleBoth = () => {
    if (!selectedPlace) return;
    savePlace({
      name: selectedPlace.name,
      memo: '',
      address: selectedPlace.address,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      tabId: 'frequent',
    });
    showToast('場所を登録しました');
    const settings = getSettings();
    openNavigation(selectedPlace.latitude, selectedPlace.longitude, settings.travelMode);
    navigate('/');
  };

  const hasGoogleApi = !!GOOGLE_MAPS_API_KEY;
  const hasGeminiApi = !!GEMINI_API_KEY;

  // Glass style classes
  const glassStyle = 'bg-white/80 backdrop-blur-xl shadow-lg border border-gray-200';
  const glassButtonStyle = `${glassStyle} rounded-full px-2.5 py-1 text-sm font-medium text-text active:bg-white/90 transition-colors`;
  const glassInputStyle = `${glassStyle} rounded-full px-3 py-1 text-base outline-none focus:ring-2 focus:ring-primary/30`;

  return (
    <div className="fixed inset-0 bg-gray-200">
      {/* Full-screen Map */}
      {hasGoogleApi && mapPosition && !isLoadingInitialLocation && (
        <InteractiveMap
          latitude={selectedPlace?.latitude ?? mapPosition.lat}
          longitude={selectedPlace?.longitude ?? mapPosition.lng}
          isLoaded={isLoaded}
          onLocationChange={(lat, lng, address, name) => {
            if (selectedPlace) {
              setSelectedPlace({
                ...selectedPlace,
                latitude: lat,
                longitude: lng,
                address: address,
                name: name || address.split(',')[0] || selectedPlace.name,
              });
            }
          }}
        />
      )}

      {/* Loading indicator for initial location */}
      {isLoadingInitialLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className={`${glassStyle} rounded-2xl p-6 flex flex-col items-center gap-3`}>
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            <p className="text-text-secondary text-sm">現在地を取得中...</p>
          </div>
        </div>
      )}

      {/* Floating UI - Top */}
      <div className="absolute top-0 left-0 right-0 pt-safe p-3 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Row 1: Back button + Search input */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => navigate(-1)}
              className={glassButtonStyle}
            >
              戻る
            </button>
            <input
              ref={inputRef}
              type="search"
              placeholder="場所を検索"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={!hasGoogleApi}
              className={`${glassInputStyle} flex-1 min-w-0`}
            />
            {isSearching && (
              <div className={`${glassStyle} rounded-full p-2`}>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>

          {/* Row 2: Voice input + Typo fix buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={startVoiceInput}
              disabled={isListening}
              className={`${glassButtonStyle} flex-1 flex items-center justify-center gap-1`}
            >
              <span>🎤</span>
              <span>{isListening ? '聞いています...' : '音声入力'}</span>
            </button>
            <button
              onClick={fixTypos}
              disabled={!query.trim() || isFixingTypos || !hasGeminiApi}
              className={`${glassButtonStyle} flex-1 flex items-center justify-center gap-1 disabled:opacity-50`}
            >
              <span>✨</span>
              <span>{isFixingTypos ? '修正中...' : '誤字修正'}</span>
            </button>
          </div>
        </div>

        {/* Search Results */}
        {suggestions.length > 0 && (
          <div className={`${glassStyle} rounded-2xl mt-2 max-h-60 overflow-y-auto pointer-events-auto`}>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full px-4 py-3 text-left border-b border-gray-200/50 last:border-b-0 hover:bg-white/50 flex items-start gap-3"
              >
                <span className="text-lg flex-shrink-0 mt-0.5">📍</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text text-sm">{suggestion.text}</p>
                  {suggestion.description && (
                    <p className="text-xs text-text-secondary truncate">{suggestion.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Place - Bottom Panel */}
      {selectedPlace && (
        <div className={`absolute bottom-0 left-0 right-0 ${glassStyle} rounded-t-3xl p-4 pb-safe pointer-events-auto`}>
          <div className="mb-3">
            <h2 className="text-lg font-bold text-text">{selectedPlace.name}</h2>
            <p className="text-sm text-text-secondary">{selectedPlace.address}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRegister}
              className="flex-1 bg-primary text-white rounded-full py-2.5 px-4 font-medium text-sm flex items-center justify-center gap-1 active:bg-primary/90"
            >
              <span>📍</span>
              <span>登録</span>
            </button>
            <button
              onClick={handleNavigate}
              className="flex-1 bg-white border border-border text-text rounded-full py-2.5 px-4 font-medium text-sm flex items-center justify-center gap-1 active:bg-gray-50"
            >
              <span>🚗</span>
              <span>ナビ</span>
            </button>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleBoth}
              className="flex-1 text-text-secondary text-sm py-2 active:bg-gray-100 rounded-full"
            >
              登録してナビ開始
            </button>
            <button
              onClick={() => setSelectedPlace(null)}
              className="flex-1 text-text-secondary text-sm py-2 active:bg-gray-100 rounded-full"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* API Key missing message */}
      {!hasGoogleApi && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`${glassStyle} rounded-2xl p-6 mx-4 text-center`}>
            <p className="text-text-secondary">Google Maps APIキーが設定されていません</p>
          </div>
        </div>
      )}
    </div>
  );
}
