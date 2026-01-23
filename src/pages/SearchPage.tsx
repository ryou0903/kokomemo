import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Button, Input } from '../components/ui';
import { useGoogleMaps, usePlacesAutocomplete } from '../hooks/useGoogleMaps';
import { openNavigation } from '../lib/maps';
import { savePlace, getSettings, addSearchHistory } from '../lib/storage';
import { useToast } from '../contexts/ToastContext';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

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

  const { isLoaded, loadError } = useGoogleMaps({ apiKey: GOOGLE_MAPS_API_KEY });
  const { getPlacePredictions, getPlaceDetails, isReady } = usePlacesAutocomplete(isLoaded);

  const debounceRef = useRef<number | null>(null);

  // Debug: log when services are ready
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
      setQuery(transcript);
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

  // Search for places
  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (!isReady) {
      // Still loading Google Maps API
      setIsSearching(true);
      return;
    }

    setIsSearching(true);
    try {
      const predictions = await getPlacePredictions(searchQuery);
      const placeSuggestions: Suggestion[] = predictions.map((p) => ({
        text: p.structured_formatting.main_text,
        description: p.structured_formatting.secondary_text,
        placeId: p.place_id,
      }));
      setSuggestions(placeSuggestions);
    } catch (error) {
      console.error('Place search error:', error);
      showToast('検索に失敗しました', 'error');
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, [isReady, getPlacePredictions, showToast]);

  // Re-search when isReady becomes true
  useEffect(() => {
    if (isReady && query.trim() && suggestions.length === 0) {
      searchPlaces(query);
    }
  }, [isReady]);

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedPlace(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim()) {
      debounceRef.current = window.setTimeout(() => {
        searchPlaces(value);
      }, 300);
    } else {
      setSuggestions([]);
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    setIsSearching(true);
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
        setSuggestions([]);
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

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hasGoogleApi = !!GOOGLE_MAPS_API_KEY;
  const hasGeminiApi = !!GEMINI_API_KEY;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header title="場所を検索" showBack showHome />

      <main className="flex-1 flex flex-col">
        {/* Search Input Section */}
        <div className="p-4 bg-surface border-b border-border">
          <div className="flex flex-col gap-3">
            <Input
              ref={inputRef}
              type="search"
              placeholder={hasGoogleApi ? "住所や建物の名前を入力" : "APIキー未設定"}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={!hasGoogleApi}
            />

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="small"
                icon="🎤"
                onClick={startVoiceInput}
                disabled={isListening}
                className="flex-1"
              >
                {isListening ? '聞いています...' : '音声で入力'}
              </Button>
              <Button
                variant="secondary"
                size="small"
                icon="✨"
                onClick={fixTypos}
                disabled={!query.trim() || isFixingTypos || !hasGeminiApi}
                className="flex-1"
              >
                {isFixingTypos ? '修正中...' : '誤字を修正'}
              </Button>
            </div>

            {!hasGeminiApi && (
              <p className="text-xs text-text-secondary text-center">
                ※ 誤字修正にはGemini APIキーの設定が必要です
              </p>
            )}
          </div>
        </div>

        {/* Loading Indicator */}
        {isSearching && (
          <div className="p-4 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* Search Results */}
        {!selectedPlace && suggestions.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full px-4 py-3 text-left border-b border-border hover:bg-gray-50 flex items-start gap-3"
              >
                <span className="text-xl flex-shrink-0 mt-0.5">📍</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text">{suggestion.text}</p>
                  {suggestion.description && (
                    <p className="text-sm text-text-secondary truncate">{suggestion.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected Place */}
        {selectedPlace && (
          <div className="flex-1 flex flex-col">
            {/* Map Preview */}
            <div className="h-48 bg-gray-200 relative">
              {hasGoogleApi ? (
                <iframe
                  title="Map Preview"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${selectedPlace.latitude},${selectedPlace.longitude}&zoom=16`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-secondary">
                  地図を表示するにはAPIキーが必要です
                </div>
              )}
            </div>

            {/* Place Details */}
            <div className="p-4 bg-surface border-b border-border">
              <h2 className="text-lg font-bold text-text mb-1">{selectedPlace.name}</h2>
              <p className="text-sm text-text-secondary">{selectedPlace.address}</p>
            </div>

            {/* Actions */}
            <div className="p-4 flex flex-col gap-3">
              <Button
                variant="primary"
                size="normal"
                icon="📍"
                onClick={handleRegister}
                className="w-full"
              >
                この場所を登録
              </Button>
              <Button
                variant="secondary"
                size="normal"
                icon="🚗"
                onClick={handleNavigate}
                className="w-full"
              >
                ナビを開始
              </Button>
              <Button
                variant="ghost"
                size="small"
                onClick={handleBoth}
                className="w-full"
              >
                登録してナビを開始
              </Button>
              <Button
                variant="ghost"
                size="small"
                onClick={() => setSelectedPlace(null)}
                className="w-full"
              >
                検索に戻る
              </Button>
            </div>
          </div>
        )}

        {/* Empty State - positioned at top for keyboard visibility */}
        {!isSearching && !selectedPlace && suggestions.length === 0 && query.length === 0 && (
          <div className="pt-12 pb-8 px-8 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-base text-text-secondary">
              住所や建物の名前を入力して
              <br />
              場所を検索してください
            </p>
          </div>
        )}

        {/* No Results - positioned at top for keyboard visibility */}
        {!isSearching && !selectedPlace && suggestions.length === 0 && query.length > 0 && (
          <div className="pt-12 pb-8 px-8 text-center">
            <p className="text-4xl mb-3">🤔</p>
            <p className="text-base text-text-secondary">
              「{query}」に一致する場所が見つかりませんでした
            </p>
            {hasGeminiApi && (
              <Button
                variant="secondary"
                size="small"
                icon="✨"
                onClick={fixTypos}
                className="mt-4"
              >
                誤字を修正して再検索
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
