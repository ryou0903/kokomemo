import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import type { Tab } from '../types';
import {
  getPlaceById,
  getTabs,
  savePlace,
  updatePlace,
  deletePlace,
} from '../lib/storage';
import { getCurrentLocation, reverseGeocode } from '../lib/maps';
import { Header } from '../components/layout/Header';
import { Button, Input, Textarea, Loading, ConfirmDialog } from '../components/ui';
import { useToast } from '../contexts/ToastContext';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// 住所から国名を削除し、郵便番号を分離
const parseAddress = (fullAddress: string): { address: string; postalCode: string } => {
  let address = fullAddress;
  let postalCode = '';

  // 郵便番号を抽出（日本形式: 〒XXX-XXXX または XXX-XXXX）
  const postalMatch = address.match(/〒?\s*(\d{3}-?\d{4})/);
  if (postalMatch) {
    postalCode = postalMatch[1].includes('-') ? postalMatch[1] : postalMatch[1].slice(0, 3) + '-' + postalMatch[1].slice(3);
    address = address.replace(postalMatch[0], '').trim();
  }

  // 国名を削除（日本、Japan、JPなど）
  address = address.replace(/^(日本、?|Japan,?\s*)/i, '').trim();

  // 先頭のカンマやスペースを削除
  address = address.replace(/^[,、\s]+/, '').trim();

  return { address, postalCode };
};

export function PlacePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isNew = id === 'new';
  const useCurrentLocation = searchParams.get('useCurrentLocation') === 'true';

  // Pre-filled data from search
  const prefillName = searchParams.get('name');
  const prefillAddress = searchParams.get('address');
  const prefillLat = searchParams.get('lat');
  const prefillLng = searchParams.get('lng');
  const prefillPostalCode = searchParams.get('postalCode');
  const prefillPhoneNumber = searchParams.get('phoneNumber');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [tabId, setTabId] = useState('frequent');

  const [errors, setErrors] = useState<{ name?: string }>({});

  // 音声入力の状態
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setTabs(getTabs().filter((t) => t.id !== 'all'));

      if (!isNew && id) {
        const place = getPlaceById(id);
        if (place) {
          setName(place.name);
          setMemo(place.memo);
          setAddress(place.address);
          setPostalCode(place.postalCode || '');
          setLatitude(place.latitude);
          setLongitude(place.longitude);
          setTabId(place.tabId);
        } else {
          showToast('場所が見つかりませんでした', 'error');
          navigate('/');
          return;
        }
      } else if (isNew && useCurrentLocation) {
        try {
          const location = await getCurrentLocation();
          setLatitude(location.latitude);
          setLongitude(location.longitude);

          if (GOOGLE_MAPS_API_KEY) {
            const geocodeResult = await reverseGeocode(
              location.latitude,
              location.longitude,
              GOOGLE_MAPS_API_KEY
            );

            // 住所を設定
            setAddress(geocodeResult.address);

            // 郵便番号を設定（reverseGeocodeから直接取得）
            if (geocodeResult.postalCode) {
              setPostalCode(geocodeResult.postalCode);
            }

            // placeNameも国名・郵便番号を除去
            if (geocodeResult.placeName) {
              const parsedName = parseAddress(geocodeResult.placeName);
              setName(parsedName.address || geocodeResult.address);
            }
          } else {
            setAddress(`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
          }
        } catch (error) {
          showToast(
            error instanceof Error ? error.message : '現在地を取得できませんでした',
            'error'
          );
        }
      } else if (isNew && prefillName && prefillLat && prefillLng) {
        // Pre-filled from search
        setName(prefillName);
        if (prefillAddress) {
          const parsed = parseAddress(prefillAddress);
          setAddress(parsed.address);
          // URLパラメータの郵便番号を優先、なければパースした結果を使用
          setPostalCode(prefillPostalCode || parsed.postalCode);
        } else if (prefillPostalCode) {
          setPostalCode(prefillPostalCode);
        }
        if (prefillPhoneNumber) {
          setPhoneNumber(prefillPhoneNumber);
        }
        setLatitude(parseFloat(prefillLat));
        setLongitude(parseFloat(prefillLng));
      }

      setIsLoading(false);
    };

    loadData();
  }, [id, isNew, useCurrentLocation, prefillName, prefillAddress, prefillLat, prefillLng, prefillPostalCode, prefillPhoneNumber, navigate, showToast]);

  const validate = useCallback(() => {
    const newErrors: { name?: string } = {};
    if (!name.trim()) {
      newErrors.name = '場所の登録名を入力してください';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      if (isNew) {
        savePlace({
          name: name.trim(),
          memo: memo.trim(),
          address,
          postalCode: postalCode.trim() || undefined,
          latitude,
          longitude,
          tabId,
        });
        showToast('場所を登録しました');
      } else if (id) {
        updatePlace(id, {
          name: name.trim(),
          memo: memo.trim(),
          address,
          postalCode: postalCode.trim() || undefined,
          latitude,
          longitude,
          tabId,
        });
        showToast('場所を更新しました');
      }
      navigate('/');
    } catch (error) {
      showToast('保存に失敗しました', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [isNew, id, name, memo, address, latitude, longitude, tabId, navigate, showToast, validate]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    deletePlace(id);
    showToast('場所を削除しました');
    navigate('/');
  }, [id, navigate, showToast]);

  // Geminiでフィラー除去と文章整形
  const processWithGemini = useCallback(async (rawText: string): Promise<string> => {
    if (!GEMINI_API_KEY) {
      return rawText;
    }

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
                text: `以下の音声入力テキストを整形してください。
・フィラー（「えーと」「あの」「まあ」「なんか」「そのー」等）を除去
・句読点を適切に追加
・文章として自然な形に整形
・内容は変えずに、読みやすく整える
・整形後のテキストのみを返してください（説明不要）

音声入力テキスト:
${rawText}`
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500,
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Gemini API request failed');
      }

      const data = await response.json();
      const processedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return processedText || rawText;
    } catch (error) {
      console.error('Gemini processing error:', error);
      return rawText;
    }
  }, []);

  // 音声入力
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
    recognition.continuous = true; // 長い入力に対応

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = async (event: any) => {
      // 全ての認識結果を結合
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }

      setIsListening(false);
      recognition.stop();

      if (fullTranscript.trim()) {
        setIsProcessingVoice(true);
        showToast('音声を整形中...');

        // Geminiでフィラー除去と整形
        const processedText = await processWithGemini(fullTranscript);

        // 既存のメモに追記（空でない場合は改行を追加）
        setMemo((prev) => prev ? `${prev}\n${processedText}` : processedText);
        setIsProcessingVoice(false);
        showToast('音声入力を追加しました');
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        showToast('マイクの使用が許可されていません', 'error');
      } else if (event.error === 'no-speech') {
        showToast('音声が検出されませんでした', 'error');
      } else {
        showToast('音声認識に失敗しました', 'error');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    showToast('話してください...');
  }, [showToast, processWithGemini]);

  // 音声入力を停止
  const stopVoiceInput = useCallback(() => {
    setIsListening(false);
    // recognition.stop() は onresult で処理される
  }, []);

  if (isLoading) {
    return (
      <Loading
        fullScreen
        message={useCurrentLocation ? '現在地を取得中...' : '読み込み中...'}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header
        title={isNew ? '新しい場所を登録' : '場所を編集'}
        showBack
      />

      <main className="flex-1 px-4 py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex flex-col gap-5"
        >
          <Input
            label="場所の登録名（必須）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 〇〇駅前のコンビニ"
            error={errors.name}
          />

          {/* 住所 */}
          <Input
            label="住所"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="例: 千葉県大網白里市永田186-5"
          />

          {/* 郵便番号 */}
          <Input
            label="郵便番号"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="例: 299-3233"
          />

          {/* 電話番号 */}
          {phoneNumber && (
            <div className="flex flex-col gap-2">
              <p className="text-base font-bold text-text">電話番号</p>
              <a
                href={`tel:${phoneNumber}`}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-border rounded-lg text-primary"
              >
                <span>📞</span>
                <span>{phoneNumber}</span>
              </a>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Textarea
              label="メモ（任意）"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="例: 駐車場は裏手にあり"
            />
            <button
              type="button"
              onClick={isListening ? stopVoiceInput : startVoiceInput}
              disabled={isProcessingVoice}
              className={`
                flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all
                ${isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : isProcessingVoice
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-white text-text border border-border hover:bg-gray-50'
                }
              `}
            >
              <span>{isListening ? '🔴' : isProcessingVoice ? '⏳' : '🎤'}</span>
              <span>
                {isListening
                  ? '録音中...タップで停止'
                  : isProcessingVoice
                    ? '整形中...'
                    : '音声でメモを入力'
                }
              </span>
            </button>
            {!GEMINI_API_KEY && (
              <p className="text-xs text-text-secondary">※ Gemini APIキーが未設定のため、整形機能は無効です</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-base font-bold text-text">カテゴリ</p>
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabId(tab.id)}
                  className={`
                    min-w-[5rem] px-3 py-2 rounded-lg text-sm font-medium transition-all text-center
                    ${tabId === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-white text-text border border-border hover:bg-gray-50'
                    }
                  `}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-3">
            {!isNew && (
              <Button
                type="button"
                variant="danger"
                size="normal"
                icon="🗑️"
                onClick={() => setShowDeleteDialog(true)}
                className="flex-none"
              >
                削除
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="normal"
              icon="💾"
              loading={isSaving}
              className="flex-1"
            >
              保存する
            </Button>
          </div>
        </form>
      </main>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="場所を削除"
        message="この場所を削除します。この操作は取り消せません。"
        confirmLabel="🗑️ 削除する"
        cancelLabel="やめる"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
