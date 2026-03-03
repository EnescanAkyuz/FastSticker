import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sticker, StickerDraft, AppContextType } from '../types';

const STORAGE_KEY = 'sticker_app_data';
const ONBOARDING_KEY = 'has_completed_onboarding';

const defaultContext: AppContextType = {
  stickers: [],
  addSticker: () => {},
  removeSticker: () => {},
  deleteSticker: () => {},
  draft: {},
  updateDraft: () => {},
  resetDraft: () => {},
  selectedStickerId: null,
  setSelectedStickerId: () => {},
  isPackSelectionMode: false,
  packSelectedStickerIds: [],
  startPackSelection: () => {},
  cancelPackSelection: () => {},
  togglePackSticker: () => {},
  packAfterCreate: false,
  setPackAfterCreate: () => {},
  credits: 5,
  remainingCredits: 5,
  decrementCredits: () => {},
  hasCompletedOnboarding: false,
  setHasCompletedOnboarding: () => {},
  isPremium: false,
  setIsPremium: () => {},
  isHydrated: false,
  isDarkMode: false,
  toggleDarkMode: () => {},
};

export const AppContext = createContext<AppContextType>(defaultContext);

export const useApp = () => useContext(AppContext);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [draft, setDraft] = useState<StickerDraft>({});
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [isPackSelectionMode, setIsPackSelectionMode] = useState(false);
  const [packSelectedStickerIds, setPackSelectedStickerIds] = useState<string[]>([]);
  const [packAfterCreate, setPackAfterCreate] = useState(false);
  const [credits, setCredits] = useState<number>(5);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(systemColorScheme === 'dark');

  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<{
            stickers: Sticker[];
            credits: number;
            isPremium: boolean;
            isDarkMode: boolean;
          }>;

          if (Array.isArray(parsed.stickers)) {
            setStickers(parsed.stickers.filter((item) => typeof item?.id === 'string'));
          }
          if (typeof parsed.credits === 'number' && Number.isFinite(parsed.credits)) {
            setCredits(Math.max(0, parsed.credits));
          }
          if (typeof parsed.isPremium === 'boolean') {
            setIsPremium(parsed.isPremium);
          }
          if (typeof parsed.isDarkMode === 'boolean') {
            setIsDarkMode(parsed.isDarkMode);
          } else {
            setIsDarkMode(systemColorScheme === 'dark');
          }
        } else {
          setIsDarkMode(systemColorScheme === 'dark');
        }
        const onboardingCompleted = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasCompletedOnboarding(onboardingCompleted === 'true');
      } catch (e) {
        console.error('Failed to load data', e);
      } finally {
        setIsHydrated(true);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isHydrated) {
      const saveData = async () => {
        try {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ stickers, credits, isPremium, isDarkMode }));
        } catch (e) {
          console.error('Failed to save data', e);
        }
      };
      saveData();
    }
  }, [stickers, credits, isPremium, isDarkMode, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      const saveOnboarding = async () => {
        try {
          await AsyncStorage.setItem(ONBOARDING_KEY, hasCompletedOnboarding ? 'true' : 'false');
        } catch (e) {
          console.error('Failed to save onboarding state', e);
        }
      };
      saveOnboarding();
    }
  }, [hasCompletedOnboarding, isHydrated]);

  const addSticker = (sticker: Sticker) => {
    setStickers((prev) => [sticker, ...prev]);
  };

  const removeSticker = (id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
  };

  const deleteSticker = removeSticker;

  const updateDraft = (updates: Partial<StickerDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const resetDraft = () => {
    setDraft({});
  };

  const decrementCredits = () => {
    setCredits((prev) => Math.max(0, prev - 1));
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const startPackSelection = (preselectedIds: string[] = []) => {
    setIsPackSelectionMode(true);
    setPackSelectedStickerIds(preselectedIds);
  };

  const cancelPackSelection = () => {
    setIsPackSelectionMode(false);
    setPackSelectedStickerIds([]);
  };

  const togglePackSticker = (stickerId: string) => {
    setPackSelectedStickerIds((prev) =>
      prev.includes(stickerId) ? prev.filter((id) => id !== stickerId) : [...prev, stickerId]
    );
  };

  return (
    <AppContext.Provider
      value={{
        stickers,
        addSticker,
        removeSticker,
        deleteSticker,
        draft,
        updateDraft,
        resetDraft,
        selectedStickerId,
        setSelectedStickerId,
        isPackSelectionMode,
        packSelectedStickerIds,
        startPackSelection,
        cancelPackSelection,
        togglePackSticker,
        packAfterCreate,
        setPackAfterCreate,
        credits,
        remainingCredits: credits,
        decrementCredits,
        hasCompletedOnboarding,
        setHasCompletedOnboarding,
        isPremium,
        setIsPremium,
        isHydrated,
        isDarkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
