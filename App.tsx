import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar, ActivityIndicator, Text, StyleSheet, LogBox } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Screen, Sticker, StickerDraft } from './src/types';
import { Colors } from './src/theme/colors';
import { AppProvider, useApp } from './src/context/AppContext';
import { OnboardingFlow } from './src/screens/OnboardingFlow';
import { MainFlow } from './src/screens/MainFlow';
import { CreationFlow } from './src/screens/CreationFlow';
import { DetailFlow } from './src/screens/DetailFlow';
import { log } from './src/utils/logger';
import { LogOverlay } from './src/utils/LogOverlay';

const PENDING_PICKER_KEY = 'pending_picker_result';

// Enable all logging in development
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'We detected a screen with an undefined initialRouteName',
]);

// ── Global error handlers ────────────────────────────────────────────────────
// Catches synchronous JS errors that bubble past all error boundaries
if (typeof ErrorUtils !== 'undefined') {
  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    log.fatal('GlobalHandler', `${isFatal ? '[FATAL] ' : ''}${error?.message}`, error);
    if (prevHandler) prevHandler(error, isFatal);
  });
}

// Catches unhandled Promise rejections
const _origUnhandledRejection = (global as any).onunhandledrejection;
(global as any).onunhandledrejection = (event: any) => {
  const reason = event?.reason ?? event;
  log.error('UnhandledRejection', String(reason?.message ?? reason), reason);
  if (_origUnhandledRejection) _origUnhandledRejection(event);
};

log.info('App', '=== App module loaded ===');

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.fatal('ErrorBoundary', error.message, error);
    log.error('ErrorBoundary', 'Component stack:' + errorInfo.componentStack);
    console.error('========== APP ERROR BOUNDARY CAUGHT ERROR ==========');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('===============================================');
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={[styles.fallbackContainer, { backgroundColor: Colors.light.background }]}>
          <Text style={[styles.fallbackTitle, { color: Colors.light.text }]}>
            Beklenmeyen bir hata oluştu
          </Text>
          <Text style={[styles.fallbackText, { color: Colors.light.textSecondary }]}>
            Uygulamayı yeniden başlatıp tekrar deneyin.
          </Text>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const {
    isDarkMode,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    stickers,
    addSticker,
    deleteSticker,
    packAfterCreate,
    setPackAfterCreate,
    startPackSelection,
    isHydrated,
  } = useApp();
  const colors = isDarkMode ? Colors.dark : Colors.light;

  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SPLASH);
  const [screenHistory, setScreenHistory] = useState<Screen[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [stickerDraft, setStickerDraft] = useState<StickerDraft | null>(null);
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    if (!isHydrated || isNavigationReady) {
      return;
    }

    setCurrentScreen(hasCompletedOnboarding ? Screen.HOME : Screen.SPLASH);
    setIsNavigationReady(true);
  }, [hasCompletedOnboarding, isHydrated, isNavigationReady]);

  // ── Recover picker result after Android process death ────────────────────────
  // When Samsung (or any Android) kills the app process while the camera/gallery
  // Activity is in the foreground, Expo stores the picker result natively.
  // On the next app launch we retrieve it here and restore the creation flow.
  useEffect(() => {
    if (!isNavigationReady) return;

    const recoverPendingPickerResult = async () => {
      try {
        // Only attempt recovery if we had an active picker session
        const flag = await AsyncStorage.getItem(PENDING_PICKER_KEY);
        log.info('App', `Pending picker flag: ${flag}`);
        if (!flag) return;

        log.info('App', 'Process-death recovery: calling getPendingResultAsync…');
        const pendingRaw = await ImagePicker.getPendingResultAsync();
        log.info('App', 'getPendingResultAsync returned', pendingRaw);

        // Clear the flag regardless of outcome
        await AsyncStorage.removeItem(PENDING_PICKER_KEY);

        // getPendingResultAsync can return ImagePickerErrorResult which lacks `canceled`/`assets`
        const pending = (pendingRaw && 'canceled' in pendingRaw)
          ? (pendingRaw as ImagePicker.ImagePickerResult)
          : null;

        if (!pending || pending.canceled || !pending.assets?.[0]?.uri) {
          log.info('App', 'No usable pending picker result — nothing to restore');
          return;
        }

        const asset = pending.assets[0];
        log.info('App', `Recovering image: uri=${asset.uri} ${asset.width}x${asset.height}`);

        // Center-crop → resize to 512x512, identical to pickImage in CreationFlow
        const srcW = asset.width ?? 1024;
        const srcH = asset.height ?? 1024;
        const squareSize = Math.min(srcW, srcH);
        const originX = Math.floor((srcW - squareSize) / 2);
        const originY = Math.floor((srcH - squareSize) / 2);

        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          [
            { crop: { originX, originY, width: squareSize, height: squareSize } },
            { resize: { width: 512, height: 512 } },
          ],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false }
        );

        log.info('App', `Recovered image processed: ${compressed.uri}`);

        setStickerDraft({
          originalImage: compressed.uri,
          processedImage: compressed.uri,
          style: null,
          text: null,
        });

        // Navigate into the creation flow at the CROP step
        setScreenHistory([Screen.HOME, Screen.SOURCE_SELECT]);
        setCurrentScreen(Screen.CROP);
        log.info('App', 'Process-death recovery complete — navigated to CROP');
      } catch (err) {
        log.error('App', 'Process-death recovery failed', err);
      }
    };

    recoverPendingPickerResult();
  }, [isNavigationReady]);

  const navigate = useCallback(
    (screen: Screen) => {
      setCurrentScreen((previousScreen) => {
        setScreenHistory((history) => [...history, previousScreen]);
        return screen;
      });

      if (screen === Screen.HOME) {
        setHasCompletedOnboarding(true);
      }
    },
    [setHasCompletedOnboarding]
  );

  const goBack = useCallback(() => {
    setScreenHistory((history) => {
      if (history.length === 0) {
        return history;
      }

      const updatedHistory = [...history];
      const previousScreen = updatedHistory.pop();
      if (previousScreen) {
        setCurrentScreen(previousScreen);
      }

      return updatedHistory;
    });
  }, []);

  const handleStickerSelect = useCallback((sticker: Sticker) => {
    setSelectedSticker(sticker);
  }, []);

  const handleDraftUpdate = useCallback((draft: StickerDraft) => {
    setStickerDraft(draft);
  }, []);

  const handleCreationComplete = useCallback(() => {
    if (stickerDraft?.originalImage) {
      const newSticker: Sticker = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `Sticker ${stickers.length + 1}`,
        imageUrl: stickerDraft.processedImage || stickerDraft.originalImage,
        style: stickerDraft.style || 'cartoon',
        text: stickerDraft.text || undefined,
        createdAt: new Date().toISOString(),
      };
      addSticker(newSticker);
      setStickerDraft(null);

      if (packAfterCreate) {
        setPackAfterCreate(false);
        startPackSelection([newSticker.id]);
        setScreenHistory([Screen.HOME]);
        setCurrentScreen(Screen.COLLECTION);
        return;
      }

      setScreenHistory([]);
      setCurrentScreen(Screen.HOME);
    }
  }, [stickerDraft, stickers.length, addSticker, packAfterCreate, setPackAfterCreate, startPackSelection]);

  const handleDeleteSticker = useCallback(() => {
    if (selectedSticker) {
      deleteSticker(selectedSticker.id);
      setSelectedSticker(null);
    }
  }, [selectedSticker, deleteSticker]);

  const navigationProps = { navigate, goBack };

  if (!isNavigationReady) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const renderScreen = () => {
    if (
      [
        Screen.SPLASH,
        Screen.ONBOARDING_1,
        Screen.ONBOARDING_2,
        Screen.ONBOARDING_3,
        Screen.PERMISSIONS,
      ].includes(currentScreen)
    ) {
      return <OnboardingFlow screen={currentScreen} {...navigationProps} />;
    }

    if ([Screen.HOME, Screen.COLLECTION, Screen.SETTINGS, Screen.PAYWALL].includes(currentScreen)) {
      return (
        <MainFlow
          screen={currentScreen}
          stickers={stickers}
          onStickerSelect={handleStickerSelect}
          {...navigationProps}
        />
      );
    }

    if (
      [
        Screen.SOURCE_SELECT,
        Screen.CAMERA,
        Screen.CROP,
        Screen.STYLE_SELECT,
        Screen.PROCESSING,
        Screen.TEXT_EDITOR,
        Screen.PREVIEW,
      ].includes(currentScreen)
    ) {
      return (
        <CreationFlow
          screen={currentScreen}
          draft={stickerDraft}
          onDraftUpdate={handleDraftUpdate}
          onComplete={handleCreationComplete}
          {...navigationProps}
        />
      );
    }

    if ([Screen.STICKER_DETAIL, Screen.EDIT_PACK, Screen.PRIVACY, Screen.ERROR].includes(currentScreen)) {
      return (
        <DetailFlow
          screen={currentScreen}
          selectedSticker={selectedSticker}
          onDelete={handleDeleteSticker}
          {...navigationProps}
        />
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      {renderScreen()}
      <LogOverlay />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fallbackTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  fallbackText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});
