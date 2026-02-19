import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Screen, Sticker, StickerDraft } from './src/types';
import { Colors } from './src/theme/colors';
import { AppProvider, useApp } from './src/context/AppContext';
import { OnboardingFlow } from './src/screens/OnboardingFlow';
import { MainFlow } from './src/screens/MainFlow';
import { CreationFlow } from './src/screens/CreationFlow';
import { DetailFlow } from './src/screens/DetailFlow';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled application error', error, errorInfo);
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
      setScreenHistory([]);
      setCurrentScreen(Screen.HOME);
    }
  }, [stickerDraft, stickers.length, addSticker]);

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
