export enum Screen {
  // Onboarding
  SPLASH = 'SPLASH',
  ONBOARDING_1 = 'ONBOARDING_1',
  ONBOARDING_2 = 'ONBOARDING_2',
  ONBOARDING_3 = 'ONBOARDING_3',
  PERMISSIONS = 'PERMISSIONS',

  // Main
  HOME = 'HOME',
  COLLECTION = 'COLLECTION',
  SETTINGS = 'SETTINGS',
  PAYWALL = 'PAYWALL',

  // Creation
  SOURCE_SELECT = 'SOURCE_SELECT',
  CAMERA = 'CAMERA',
  CROP = 'CROP',
  STYLE_SELECT = 'STYLE_SELECT',
  PROCESSING = 'PROCESSING',
  TEXT_EDITOR = 'TEXT_EDITOR',
  PREVIEW = 'PREVIEW',

  // Detail
  STICKER_DETAIL = 'STICKER_DETAIL',
  EDIT_PACK = 'EDIT_PACK',
  ERROR = 'ERROR',
  PRIVACY = 'PRIVACY',
}

export interface Sticker {
  id: string;
  name?: string;
  url?: string;
  imageUrl?: string;
  createdAt: string | number;
  text?: string;
  style?: string;
}

export interface StickerDraft {
  originalImage?: string;
  croppedImage?: string;
  processedImage?: string;
  style?: string | null;
  text?: string | null;
}

export interface NavigationProps {
  navigate: (screen: Screen) => void;
  goBack: () => void;
}

export interface AppContextType {
  stickers: Sticker[];
  addSticker: (sticker: Sticker) => void;
  removeSticker: (id: string) => void;
  deleteSticker: (id: string) => void;
  draft: StickerDraft;
  updateDraft: (updates: Partial<StickerDraft>) => void;
  resetDraft: () => void;
  selectedStickerId: string | null;
  setSelectedStickerId: (id: string | null) => void;
  isPackSelectionMode: boolean;
  packSelectedStickerIds: string[];
  startPackSelection: (preselectedIds?: string[]) => void;
  cancelPackSelection: () => void;
  togglePackSticker: (stickerId: string) => void;
  packAfterCreate: boolean;
  setPackAfterCreate: (value: boolean) => void;
  credits: number;
  remainingCredits: number;
  decrementCredits: () => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (value: boolean) => void;
  isPremium: boolean;
  setIsPremium: (value: boolean) => void;
  isHydrated: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}
