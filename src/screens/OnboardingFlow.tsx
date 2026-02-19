import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  ImageBackground,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Screen, NavigationProps } from '../types';
import { Colors, Shadows } from '../theme/colors';
import { useApp } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

interface Props extends NavigationProps {
  screen: Screen;
}

export const OnboardingFlow: React.FC<Props> = ({ screen, navigate, goBack }) => {
  const { isDarkMode } = useApp();
  const colors = isDarkMode ? Colors.dark : Colors.light;
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const requestRequiredPermissions = async () => {
    try {
      const [cameraPermission, mediaPermission] = await Promise.all([
        ImagePicker.requestCameraPermissionsAsync(),
        ImagePicker.requestMediaLibraryPermissionsAsync(),
      ]);

      if (cameraPermission.granted && mediaPermission.granted) {
        navigate(Screen.HOME);
        return;
      }

      Alert.alert(
        'İzin Gerekli',
        'Sticker oluşturmak için kamera ve galeri izinleri gereklidir. İzinleri daha sonra ayarlardan verebilirsin.'
      );
    } catch (error) {
      console.error('Permission request failed', error);
      Alert.alert('Hata', 'İzinler alınırken bir hata oluştu. Lütfen tekrar dene.');
    }
  };

  useEffect(() => {
    if (screen === Screen.SPLASH) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }).start();

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      const timer = setTimeout(() => {
        navigate(Screen.ONBOARDING_1);
      }, 2000);
      return () => {
        clearTimeout(timer);
        pulseLoop.stop();
        progressAnim.stopAnimation();
        pulseAnim.stopAnimation();
      };
    }
  }, [screen, navigate, progressAnim, pulseAnim]);

  if (screen === Screen.SPLASH) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.bgBlur1, { backgroundColor: Colors.primaryLight }]} />
        <View style={[styles.bgBlur2, { backgroundColor: Colors.primaryLight }]} />

        <View style={styles.splashContent}>
          <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.logoGradient}>
              <MaterialIcons name="auto-awesome" size={48} color={Colors.white} />
            </View>
          </Animated.View>

          <View style={styles.titleContainer}>
            <Text style={[styles.appTitle, { color: colors.text }]}>FastSticker</Text>
            <Text style={[styles.appSubtitle, { color: colors.textSecondary }]}>
              AI ile Sticker Oluştur
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.loaderDots}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={[styles.dot, { backgroundColor: Colors.primary, opacity: 0.6 + i * 0.2 }]}
              />
            ))}
          </View>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.splashFooter}>
          <MaterialIcons name="verified" size={16} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Powered by Gemini AI
          </Text>
        </View>
      </View>
    );
  }

  const renderOnboardingStep = (
    imageUrl: string,
    title: React.ReactNode,
    desc: string,
    step: number,
    nextScreen: Screen,
    extraVisual?: React.ReactNode
  ) => (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.skipContainer}>
        <TouchableOpacity onPress={() => navigate(Screen.PERMISSIONS)} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>GEÇ</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.onboardingMain}>
        <View style={styles.glowBg} />
        {extraVisual ? (
          extraVisual
        ) : (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.onboardingImage} resizeMode="cover" />
            <View style={styles.imageOverlay} />
          </View>
        )}
      </View>

      <View style={[styles.bottomSection, { backgroundColor: colors.background }]}>
        <Text style={[styles.onboardingTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.onboardingDesc, { color: colors.textSecondary }]}>{desc}</Text>

        <View style={styles.stepIndicators}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i === step
                  ? { backgroundColor: Colors.primary, width: 24 }
                  : { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, Shadows.primary]}
          onPress={() => navigate(nextScreen)}
          activeOpacity={0.9}
        >
          <Text style={styles.continueText}>Devam Et</Text>
          <MaterialIcons name="arrow-forward" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (screen === Screen.ONBOARDING_1) {
    return renderOnboardingStep(
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBWm01R-Lk9s5f_Ihvn8SKnA2DoeHIjY1ZzvipOPVaPt7RKboL1k2qcDbMnFZWBoep58fuYkqQbmHnVV3SfQ--gl6KUZz1DTl45snXhal_fmRERBr0SpPpuxd20PcP9s1c2kvzqb7ZIzQSCRoUMvhd3vZxe-tB5GCpR-ulk7da2tE5LNEiXPiV6n29DZmwFioax04MjhmLr8muKu3_wJRRz2ODahqUb1FWMAfAd5DgDWMdvOp1KFU9ZUMjE9WuWLiK-pHVl7nLcHPA',
      <Text style={styles.titleText}>
        Fotoğrafını Çek,{'\n'}
        <Text style={{ color: Colors.primary }}>Sticker Yap</Text>
      </Text>,
      'Anılarını saniyeler içinde eğlenceli WhatsApp stickerlarına dönüştür.',
      1,
      Screen.ONBOARDING_2
    );
  }

  if (screen === Screen.ONBOARDING_2) {
    const visual = (
      <View style={styles.compareContainer}>
        <ImageBackground
          source={{
            uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWdmN-_kfjNZ8mSDIENcZxzl8EYOtRGkabtLCWozv8_eyIQHK182LArxzFw4xQpxEBSlKtBkN2YfMPI45XNgNtDb20CHe05KIOfkYI54TZC_8ABCW58gQDOEXHikP0eE1oCeFchsst_0aVyWgBUMoZEwIv61As87k-4U-t_x0tIaegDlQW0dFhSmGUM9NEOOVZME0lFofiXGXQuxi89mB1OD948S-t6WrJLvohqBGvHZsCvJwsxqTwuOebyTIMBdoH47pHmxJ2yNw',
          }}
          style={styles.compareImage}
          imageStyle={{ borderRadius: 24 }}
        >
          <View style={styles.compareLeft}>
            <ImageBackground
              source={{
                uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIld7lA3GYfg23UVL1jnM2g-cO4bgSc_PWbxNa1LPDPa5njqoEOUQV22pAGnXcfaCTmcV_OX_pYjAHuCV_zkNXEX9WnqZ0UZ25tiyiaP8xtj9y9i1QUCK1ohqqfpdvEVau6kytnfZkRQ1Q3nl1490rJmIbotelz1QrTAoz8KkL5Z6DF5jP0vRSg7oUNWLcI3KedKOkAtTixRMT-88Uv96sQCucg33uFA4ULQXXzqnMwhWt56LgJwDfGvl7nubXrC-T4_pMqpnDQXI',
              }}
              style={styles.compareLeftImage}
            >
              <View style={styles.labelBadge}>
                <Text style={styles.labelText}>Orijinal</Text>
              </View>
            </ImageBackground>
          </View>

          <View style={[styles.labelBadge, styles.labelRight]}>
            <Text style={styles.labelText}>Çizgi Film</Text>
          </View>

          <View style={styles.compareDivider}>
            <View style={styles.dividerHandle}>
              <MaterialIcons name="swap-horiz" size={20} color={Colors.primary} />
            </View>
          </View>
        </ImageBackground>
      </View>
    );

    return renderOnboardingStep(
      '',
      <Text style={styles.titleText}>
        Fotoğraflarını{' '}
        <Text style={{ color: Colors.primary }}>Çizgi Filme</Text> Çevir
      </Text>,
      'Google Gemini AI teknolojisi ile fotoğraflarını saniyeler içinde eğlenceli çizgi film karakterlerine dönüştür.',
      2,
      Screen.ONBOARDING_3,
      visual
    );
  }

  if (screen === Screen.ONBOARDING_3) {
    const visual = (
      <View style={styles.whatsappVisual}>
        <View style={[styles.floatingEmoji, styles.emojiLeft]}>
          <Text style={styles.emojiText}>😎</Text>
        </View>
        <View style={[styles.floatingEmoji, styles.emojiRight]}>
          <Text style={styles.emojiText}>🔥</Text>
        </View>

        <View style={styles.phoneFrame}>
          <ImageBackground
            source={{
              uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIICtCrnQpUP4hLSJJiWKms85TJlUd0CB_aDfKDqz_1650x4J1v4Ms7ztIvY_pRJbXXGBJchDNCr3w_6P2UtDE0VlrdwgwdpfH01p2oChOH3bb0o882z3OphW1u0wnqnuzqfmVrIrBEMpHqxXwYbHCXuNsDlNMZoibUsulyi-5QpiDnu5cr2n-JX1sze9G2kUPbs6zHAcfcb7Mb9EMFcFzExG8XPJbA0-hkmRvGAiIm7egrvNXK7pOvnnOPVYPYq_xx-pMpnVVsiE',
            }}
            style={styles.phoneScreen}
            imageStyle={{ borderRadius: 32 }}
          >
            <View style={styles.phoneOverlay} />
            <View style={styles.whatsappBanner}>
              <MaterialIcons name="check-circle" size={20} color={Colors.success} />
              <View style={styles.bannerTextContainer}>
                <Text style={styles.bannerTitle}>WhatsApp'a Eklendi!</Text>
                <Text style={styles.bannerSubtitle}>3 sticker pakete eklendi</Text>
              </View>
            </View>
          </ImageBackground>
        </View>
      </View>
    );

    return renderOnboardingStep(
      '',
      <Text style={styles.titleText}>WhatsApp'a{'\n'}Kolayca Ekle</Text>,
      "Stickerlarını saniyeler içinde oluştur ve WhatsApp'a aktar. Denemen için ilk 2 sticker bizden hediye!",
      3,
      Screen.PERMISSIONS,
      visual
    );
  }

  // Permissions Screen
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.permissionHero}>
        <ImageBackground
          source={{
            uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbsipDNItzjuAOIAcGEag3lKYnveMwcySExWVPernxrPnralpOFVInWN29a5IsOIFG77524T4qtFkrNVj4fbh5bn2QFxY9vUXe9AUv68JkKq_NVpXUSN6aLhqogDX5NozW1oAA24FCYO3xDwe_ZwaTOIULs8ptwjSCQUfPtTcwNO8x5asVMAV_XjFCZm3o07KaNm1e2XEmw4P_Xw6a9YhxAoXLEgHQlMtlCkwHhSSShAkqoI_ZgOWxuuSHhRNbolSWHCFJ6l1bgyM',
          }}
          style={styles.heroImage}
        >
          <View style={styles.heroGradient} />
          <View style={styles.heroGlow} />
        </ImageBackground>
      </View>

      <View style={[styles.permissionContent, { backgroundColor: colors.background }]}>
        <View style={styles.permissionTitleContainer}>
          <Text style={[styles.permissionTitle, { color: colors.text }]}>Let's Get Creative</Text>
          <Text style={[styles.permissionSubtitle, { color: colors.textSecondary }]}>
            Harika stickerlar oluşturmak için bazı izinlere ihtiyacımız var
          </Text>
        </View>

        <View style={styles.permissionList}>
          <View style={[styles.permissionItem, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <View style={[styles.permissionIcon, { backgroundColor: Colors.primaryLight }]}>
              <MaterialIcons name="photo-camera" size={24} color={Colors.primary} />
            </View>
            <View style={styles.permissionTextContainer}>
              <Text style={[styles.permissionItemTitle, { color: colors.text }]}>Kamera</Text>
              <Text style={[styles.permissionItemDesc, { color: colors.textSecondary }]}>
                Selfie çekerek sticker oluştur
              </Text>
            </View>
          </View>

          <View style={[styles.permissionItem, { backgroundColor: isDarkMode ? Colors.dark.surface : Colors.light.surface }]}>
            <View style={[styles.permissionIcon, { backgroundColor: Colors.primaryLight }]}>
              <MaterialIcons name="photo-library" size={24} color={Colors.primary} />
            </View>
            <View style={styles.permissionTextContainer}>
              <Text style={[styles.permissionItemTitle, { color: colors.text }]}>Galeri</Text>
              <Text style={[styles.permissionItemDesc, { color: colors.textSecondary }]}>
                Galerinden fotoğraf seç
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.permissionButtons}>
          <TouchableOpacity
            style={[styles.continueButton, Shadows.primary]}
            onPress={requestRequiredPermissions}
            activeOpacity={0.9}
          >
            <MaterialIcons name="check" size={24} color={Colors.white} />
            <Text style={styles.continueText}>İzin Ver ve Başla</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.laterButton} onPress={() => navigate(Screen.HOME)}>
            <Text style={[styles.laterText, { color: colors.textSecondary }]}>Daha Sonra</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgBlur1: {
    position: 'absolute', top: -height * 0.1, left: -width * 0.1,
    width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, opacity: 0.5,
  },
  bgBlur2: {
    position: 'absolute', bottom: -height * 0.1, right: -width * 0.1,
    width: width * 0.6, height: width * 0.6, borderRadius: width * 0.3, opacity: 0.3,
  },
  splashContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logoContainer: { marginBottom: 24 },
  logoGradient: {
    width: 100, height: 100, borderRadius: 28, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', ...Shadows.large,
  },
  titleContainer: { alignItems: 'center', gap: 8 },
  appTitle: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  appSubtitle: { fontSize: 16, fontWeight: '500' },
  progressContainer: { width: '100%', maxWidth: 200, alignItems: 'center', marginBottom: 60, gap: 12 },
  loaderDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  progressBar: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  splashFooter: { position: 'absolute', bottom: 32, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.4 },
  footerText: { fontSize: 12, fontWeight: '500' },
  skipContainer: { position: 'absolute', top: 48, right: 24, zIndex: 20 },
  skipButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  skipText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  onboardingMain: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  glowBg: { position: 'absolute', width: 256, height: 256, borderRadius: 128, backgroundColor: Colors.primaryDark, opacity: 0.5 },
  imageContainer: {
    width: width * 0.75, aspectRatio: 3 / 4, borderRadius: 16, overflow: 'hidden',
    ...Shadows.large, borderWidth: 6, borderColor: 'rgba(255,255,255,0.1)', transform: [{ rotate: '-2deg' }],
  },
  onboardingImage: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.1)' },
  bottomSection: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 24, alignItems: 'center' },
  onboardingTitle: { fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 12, lineHeight: 38 },
  titleText: { fontSize: 32, fontWeight: '800', textAlign: 'center', lineHeight: 38 },
  onboardingDesc: { fontSize: 16, fontWeight: '500', textAlign: 'center', lineHeight: 24, maxWidth: 300, marginBottom: 24 },
  stepIndicators: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  stepDot: { height: 8, width: 8, borderRadius: 4 },
  continueButton: {
    width: '100%', maxWidth: 350, height: 56, backgroundColor: Colors.primary,
    borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  continueText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  compareContainer: { width: width * 0.85, aspectRatio: 4 / 5, borderRadius: 24, overflow: 'hidden', ...Shadows.large },
  compareImage: { width: '100%', height: '100%' },
  compareLeft: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', overflow: 'hidden',
    borderRightWidth: 3, borderRightColor: Colors.primary,
  },
  compareLeftImage: { width: width * 0.85, height: '100%' },
  labelBadge: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  labelRight: { left: undefined, right: 20, backgroundColor: 'rgba(233, 30, 99, 0.8)' },
  labelText: { color: Colors.white, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  compareDivider: { position: 'absolute', left: '50%', top: 0, bottom: 0, marginLeft: -22, alignItems: 'center', justifyContent: 'center' },
  dividerHandle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadows.medium },
  whatsappVisual: { width: width * 0.85, aspectRatio: 4 / 5, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  floatingEmoji: { position: 'absolute', width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadows.medium, zIndex: 20 },
  emojiLeft: { left: -16, top: 40, transform: [{ rotate: '-12deg' }] },
  emojiRight: { right: -8, bottom: 80, transform: [{ rotate: '12deg' }], width: 56, height: 56 },
  emojiText: { fontSize: 28 },
  phoneFrame: { width: '100%', height: '100%', borderRadius: 32, overflow: 'hidden', borderWidth: 6, borderColor: Colors.white, ...Shadows.large },
  phoneScreen: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  phoneOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  whatsappBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', margin: 16, padding: 12, borderRadius: 16, gap: 12, ...Shadows.small },
  bannerTextContainer: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: Colors.black },
  bannerSubtitle: { fontSize: 12, color: 'rgba(0,0,0,0.5)' },
  permissionHero: { height: height * 0.4, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  heroGlow: { position: 'absolute', top: '50%', left: '50%', marginTop: -64, marginLeft: -64, width: 128, height: 128, borderRadius: 64, backgroundColor: Colors.primaryDark, opacity: 0.8 },
  permissionContent: { flex: 1, marginTop: -40, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 },
  permissionTitleContainer: { alignItems: 'center', marginBottom: 24 },
  permissionTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  permissionSubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  permissionList: { gap: 16, marginBottom: 32 },
  permissionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 16 },
  permissionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  permissionTextContainer: { flex: 1 },
  permissionItemTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  permissionItemDesc: { fontSize: 14 },
  permissionButtons: { gap: 16, marginTop: 'auto' },
  laterButton: { alignItems: 'center', paddingVertical: 12 },
  laterText: { fontSize: 16, fontWeight: '600' },
});
