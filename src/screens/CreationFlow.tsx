import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, NavigationProps, StickerDraft } from '../types';
import { Colors, Shadows } from '../theme/colors';
import { generateStickerWithGemini } from '../services/stickerService';
import { useApp } from '../context/AppContext';
import { log } from '../utils/logger';

const TAG = 'CreationFlow';

const { width, height } = Dimensions.get('window');

interface Props extends NavigationProps {
  screen: Screen;
  draft: StickerDraft | null;
  onDraftUpdate: (draft: StickerDraft) => void;
  onComplete: () => void;
}

export const CreationFlow: React.FC<Props> = ({
  screen,
  navigate,
  goBack,
  draft,
  onDraftUpdate,
  onComplete,
}) => {
  const { isDarkMode, setPackAfterCreate } = useApp();
  const colors = isDarkMode ? Colors.dark : Colors.light;

  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [stickerText, setStickerText] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const generationStartedRef = useRef(false);
  const draftImageUri = draft?.processedImage || draft?.originalImage;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: processingProgress,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [processingProgress, progressAnim]);

  useEffect(() => {
    if (screen !== Screen.PROCESSING) {
      generationStartedRef.current = false;
      return;
    }

    if (generationStartedRef.current) {
      return;
    }

    generationStartedRef.current = true;
    let isCancelled = false;
    setProcessingProgress(0);

    const runGeneration = async () => {
      try {
        const sourceImageUri = draft?.originalImage;
        if (!sourceImageUri) {
          throw new Error('Source image is missing');
        }

        const styleToUse = selectedStyle || draft.style || 'cartoon';
        setProcessingProgress(10);

        const generatedUri = await generateStickerWithGemini({
          sourceImageUri,
          style: styleToUse,
          text: draft?.text || '',
        });

        if (isCancelled) {
          return;
        }

        setProcessingProgress(90);
        onDraftUpdate({
          ...(draft ?? {}),
          processedImage: generatedUri,
          style: styleToUse,
        });
        setProcessingProgress(100);
        navigate(Screen.TEXT_EDITOR);
      } catch (error) {
        console.error('Sticker generation failed', error);
        if (isCancelled) {
          return;
        }

        Alert.alert(
          'Üretim Hatası',
          'Sticker üretimi başarısız oldu. Backend bağlantısı ve Gemini API anahtarını kontrol et.'
        );
        navigate(Screen.STYLE_SELECT);
      }
    };

    runGeneration();

    return () => {
      isCancelled = true;
    };
  }, [
    draft,
    navigate,
    onDraftUpdate,
    screen,
    selectedStyle,
  ]);

  useEffect(() => {
    if (screen === Screen.STYLE_SELECT) {
      setSelectedStyle(draft?.style ?? null);
    }
    if (screen === Screen.TEXT_EDITOR) {
      setStickerText(draft?.text ?? '');
    }
  }, [screen, draft?.style, draft?.text]);

  const pickImage = async (fromCamera: boolean) => {
    log.info(TAG, `pickImage() start — fromCamera=${fromCamera}`);
    try {

      // ── 1. Permissions ────────────────────────────────────────────────────
      if (fromCamera) {
        log.debug(TAG, 'Requesting camera permission…');
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        log.info(TAG, `Camera permission result: granted=${permission.granted} status=${permission.status}`);
        if (!permission.granted) {
          Alert.alert('İzin Gerekli', 'Kamera ile sticker oluşturmak için kamera izni vermelisin.');
          log.warn(TAG, 'Camera permission denied — aborting');
          return;
        }
      } else {
        log.debug(TAG, 'Requesting media library permission…');
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        log.info(TAG, `Media library permission result: granted=${permission.granted} status=${permission.status}`);
        if (!permission.granted) {
          Alert.alert('İzin Gerekli', 'Galeriden fotoğraf seçmek için galeri izni vermelisin.');
          log.warn(TAG, 'Media library permission denied — aborting');
          return;
        }
      }

      // ── 2. Launch picker ─────────────────────────────────────────────────
      let result: ImagePicker.ImagePickerResult;

      // Mark that we are about to enter a picker session.
      // If Android kills this process and restarts it (Samsung memory management),
      // App.tsx reads this flag on startup and calls getPendingResultAsync().
      await AsyncStorage.setItem('pending_picker_result', 'true');
      log.debug(TAG, 'pending_picker_result flag set in AsyncStorage');

      if (fromCamera) {
        log.info(TAG, 'Launching camera (allowsEditing=true, 1:1, quality=0.5)…');
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
        log.info(TAG, 'launchCameraAsync() returned');
      } else {
        log.info(TAG, 'Launching gallery (allowsEditing=false, quality=0.8)…');
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          // allowsEditing disabled: native Samsung/AOSP cropper crashes on many devices.
          // We center-crop manually with ImageManipulator below.
          allowsEditing: false,
          quality: 0.8,
        });
        log.info(TAG, 'launchImageLibraryAsync() returned');
      }

      // ── 3. Validate result ────────────────────────────────────────────────
      log.debug(TAG, `Picker result: canceled=${result.canceled}, assetsCount=${(result as any).assets?.length ?? 'n/a'}`);

      const selectedAsset = result.canceled ? null : result.assets?.[0];
      if (!selectedAsset) {
        log.info(TAG, 'No asset returned (user cancelled or picker returned empty)');
        return;
      }

      log.info(TAG, `Asset selected: uri=${selectedAsset.uri}`);
      log.debug(TAG, `Asset metadata: w=${selectedAsset.width} h=${selectedAsset.height} type=${selectedAsset.type} mimeType=${(selectedAsset as any).mimeType} fileSize=${selectedAsset.fileSize}`);

      if (!selectedAsset.uri) {
        log.error(TAG, 'selectedAsset.uri is empty — aborting');
        return;
      }

      // ── 4. Image manipulation ─────────────────────────────────────────────
      try {
        const srcW = selectedAsset.width ?? 1024;
        const srcH = selectedAsset.height ?? 1024;
        const squareSize = Math.min(srcW, srcH);
        const originX = Math.floor((srcW - squareSize) / 2);
        const originY = Math.floor((srcH - squareSize) / 2);

        log.info(TAG, `Start center-crop → resize: src=${srcW}x${srcH} square=${squareSize} origin=(${originX},${originY})`);

        const compressedImage = await ImageManipulator.manipulateAsync(
          selectedAsset.uri,
          [
            { crop: { originX, originY, width: squareSize, height: squareSize } },
            { resize: { width: 512, height: 512 } },
          ],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false }
        );

        log.info(TAG, `ImageManipulator done: uri=${compressedImage.uri} w=${compressedImage.width} h=${compressedImage.height}`);

        if (!compressedImage.uri) {
          throw new Error('ImageManipulator returned an empty URI');
        }

        // ── 5. Verify file on disk ──────────────────────────────────────────
        log.debug(TAG, 'Checking compressed file existence on disk…');
        try {
          const fileInfo = new File(compressedImage.uri).info();
          log.info(TAG, `File info: exists=${fileInfo.exists} size=${(fileInfo as any).size ?? 'n/a'}`);
          if (!fileInfo.exists) {
            throw new Error('Compressed image file does not exist at: ' + compressedImage.uri);
          }
        } catch (fileCheckError) {
          log.error(TAG, 'File info check failed', fileCheckError);
          throw new Error('Dosya doğrulanamadı: ' + (fileCheckError instanceof Error ? fileCheckError.message : String(fileCheckError)));
        }

        // ── 6. Update draft & navigate ──────────────────────────────────────
        log.info(TAG, 'Updating draft and navigating to CROP screen…');
        onDraftUpdate({
          originalImage: compressedImage.uri,
          processedImage: compressedImage.uri,
          style: null,
          text: null,
        });
        log.info(TAG, 'Draft updated — navigating to Screen.CROP');
        // Successfully processed: clear the pending flag so App.tsx won't attempt recovery
        await AsyncStorage.removeItem('pending_picker_result');
        navigate(Screen.CROP);

      } catch (manipError) {
        log.error(TAG, 'Image manipulation/verification failed', manipError);
        const msg = manipError instanceof Error ? manipError.message : String(manipError);
        Alert.alert(
          'Sıkıştırma Hatası',
          `Fotoğraf işlenirken bir hata oluştu:\n\n${msg}\n\nLütfen daha küçük bir fotoğraf seç ve tekrar dene.`
        );
      }

    } catch (outerError) {
      log.fatal(TAG, 'pickImage() outer catch — unhandled error', outerError);
      const msg = outerError instanceof Error ? outerError.message : String(outerError);
      Alert.alert('Hata', `Fotoğraf seçilirken bir hata oluştu:\n\n${msg}\n\nLütfen tekrar dene.`);
    }
  };

  const handleShareToWhatsApp = async () => {
    if (!draftImageUri || isSharing) {
      return;
    }

    setIsSharing(true);
    try {
      setPackAfterCreate(true);
      Alert.alert(
        'Sticker Paketi',
        'WhatsApp sticker olarak eklemek için en az 3 sticker seçip paket halinde aktarmalısın. Sticker kaydedilecek ve Koleksiyonum ekranında seçim modu açılacak; 2 tane daha seçip “Aktar”a bas.'
      );
    } catch (error) {
      console.error('Share failed', error);
      Alert.alert(
        'Paylaşım Hatası',
        "Sticker paylaşılamadı. WhatsApp'ın yüklü olduğundan ve dosya erişimine izin verdiğinden emin ol."
      );
    } finally {
      setIsSharing(false);
      onComplete();
    }
  };

  if (screen === Screen.SOURCE_SELECT) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Fotoğraf Seç</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.sourceContent}>
          <Text style={[styles.sourceTitle, { color: colors.text }]}>Nasıl başlamak istersin?</Text>
          <Text style={[styles.sourceSubtitle, { color: colors.textSecondary }]}>
            Sticker oluşturmak için bir fotoğraf seç
          </Text>

          <View style={styles.sourceOptions}>
            <TouchableOpacity
              style={[styles.sourceCard, { backgroundColor: colors.surface }, Shadows.medium]}
              onPress={() => pickImage(true)}
            >
              <View style={[styles.sourceIcon, { backgroundColor: 'rgba(233, 30, 99, 0.1)' }]}>
                <MaterialIcons name="photo-camera" size={32} color={Colors.primary} />
              </View>
              <Text style={[styles.sourceCardTitle, { color: colors.text }]}>Kamera</Text>
              <Text style={[styles.sourceCardDesc, { color: colors.textSecondary }]}>
                Anlık fotoğraf çek
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sourceCard, { backgroundColor: colors.surface }, Shadows.medium]}
              onPress={() => pickImage(false)}
            >
              <View style={[styles.sourceIcon, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
                <MaterialIcons name="photo-library" size={32} color="#9C27B0" />
              </View>
              <Text style={[styles.sourceCardTitle, { color: colors.text }]}>Galeri</Text>
              <Text style={[styles.sourceCardDesc, { color: colors.textSecondary }]}>
                Mevcut fotoğraflardan seç
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.recentSection, { backgroundColor: colors.surface }]}>
            <View style={styles.recentHeader}>
              <MaterialIcons name="history" size={20} color={colors.textSecondary} />
              <Text style={[styles.recentTitle, { color: colors.text }]}>Son Kullanılanlar</Text>
            </View>
            <View style={styles.recentImages}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[styles.recentItem, { backgroundColor: colors.border }]}>
                  <MaterialIcons name="image" size={24} color={colors.textSecondary} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (screen === Screen.CAMERA) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.black }]}>
        <View style={styles.cameraPreview}>
          <Text style={{ color: Colors.white }}>Kamera Önizleme</Text>
        </View>
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cameraButton} onPress={goBack}>
            <MaterialIcons name="close" size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={() => pickImage(true)}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraButton} onPress={() => {}}>
            <MaterialIcons name="flip-camera-ios" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === Screen.CROP) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Kırp & Düzenle</Text>
          <TouchableOpacity onPress={() => navigate(Screen.STYLE_SELECT)}>
            <Text style={styles.nextText}>İleri</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cropContent}>
          <View style={[styles.cropFrame, Shadows.large]}>
            {draftImageUri ? (
              <Image 
                source={{ uri: draftImageUri }} 
                style={styles.cropImage}
                onError={(error) => {
                  console.error('Image failed to load:', error);
                  Alert.alert('Hata', 'Görüntü yüklenemedi. Lütfen tekrar dene.');
                }}
              />
            ) : (
              <View style={[styles.cropPlaceholder, { backgroundColor: colors.surface }]}>
                <MaterialIcons name="image" size={48} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.cropOverlay}>
              <View style={[styles.cropCorner, styles.cropTopLeft]} />
              <View style={[styles.cropCorner, styles.cropTopRight]} />
              <View style={[styles.cropCorner, styles.cropBottomLeft]} />
              <View style={[styles.cropCorner, styles.cropBottomRight]} />
            </View>
          </View>

          <View style={[styles.cropTools, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.cropTool}>
              <MaterialIcons name="crop-rotate" size={24} color={colors.text} />
              <Text style={[styles.cropToolText, { color: colors.text }]}>Döndür</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cropTool}>
              <MaterialIcons name="flip" size={24} color={colors.text} />
              <Text style={[styles.cropToolText, { color: colors.text }]}>Çevir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cropTool}>
              <MaterialIcons name="crop" size={24} color={Colors.primary} />
              <Text style={[styles.cropToolText, { color: Colors.primary }]}>Kırp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (screen === Screen.STYLE_SELECT) {
    const styles_list = [
      { id: 'cartoon', name: 'Çizgi Film', icon: 'face-retouching-natural', color: Colors.primary },
      { id: 'anime', name: 'Anime', icon: 'auto-awesome', color: '#9C27B0' },
      { id: 'pixel', name: 'Piksel', icon: 'grid-on', color: '#2196F3' },
      { id: 'sketch', name: 'Karakalem', icon: 'edit', color: '#607D8B' },
      { id: 'pop', name: 'Pop Art', icon: 'palette', color: '#FF5722' },
      { id: 'emoji', name: 'Emoji', icon: 'emoji-emotions', color: '#FFC107' },
    ];

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Stil Seç</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.styleContent}>
          <View style={[styles.previewCard, Shadows.large]}>
            {draftImageUri ? (
              <Image 
                source={{ uri: draftImageUri }} 
                style={styles.previewImage}
                onError={(error) => {
                  console.error('Preview image failed to load:', error);
                }}
              />
            ) : (
              <View style={[styles.previewPlaceholder, { backgroundColor: colors.surface }]}>
                <MaterialIcons name="image" size={64} color={colors.textSecondary} />
              </View>
            )}
          </View>

          <Text style={[styles.styleTitle, { color: colors.text }]}>Bir stil seç</Text>
          <Text style={[styles.styleSubtitle, { color: colors.textSecondary }]}>
            AI fotoğrafını seçtiğin stile dönüştürecek
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.styleGrid}>
              {styles_list.map((style) => (
                <TouchableOpacity
                  key={style.id}
                  style={[
                    styles.styleCard,
                    { backgroundColor: colors.surface },
                    selectedStyle === style.id && {
                      borderColor: Colors.primary,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => setSelectedStyle(style.id)}
                >
                  <View style={[styles.styleIcon, { backgroundColor: `${style.color}20` }]}>
                    <MaterialIcons name={style.icon as any} size={28} color={style.color} />
                  </View>
                  <Text style={[styles.styleName, { color: colors.text }]}>{style.name}</Text>
                  {selectedStyle === style.id && (
                    <View style={styles.styleCheck}>
                      <MaterialIcons name="check-circle" size={20} color={Colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={[styles.bottomBar, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[
              styles.continueBtn,
              Shadows.primary,
              !selectedStyle && { opacity: 0.5 },
            ]}
            onPress={() => {
              if (selectedStyle) {
                onDraftUpdate({ ...(draft ?? {}), style: selectedStyle });
                navigate(Screen.PROCESSING);
              }
            }}
            disabled={!selectedStyle}
          >
            <Text style={styles.continueBtnText}>Devam Et</Text>
            <MaterialIcons name="arrow-forward" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === Screen.PROCESSING) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.processingContent}>
          <View style={styles.processingAnimation}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>

          <Text style={[styles.processingTitle, { color: colors.text }]}>
            Stickerın Hazırlanıyor
          </Text>
          <Text style={[styles.processingSubtitle, { color: colors.textSecondary }]}>
            AI fotoğrafını {selectedStyle || draft?.style || 'çizgi film'} stiline dönüştürüyor...
          </Text>

          <View style={[styles.progressContainer, { backgroundColor: colors.surface }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            %{processingProgress}
          </Text>

          <View style={styles.processingSteps}>
            {[
              { text: 'Fotoğraf analiz ediliyor', done: processingProgress > 20 },
              { text: 'Stil uygulanıyor', done: processingProgress > 50 },
              { text: 'Son rötuşlar yapılıyor', done: processingProgress > 80 },
            ].map((step, index) => (
              <View key={index} style={styles.processingStep}>
                <MaterialIcons
                  name={step.done ? 'check-circle' : 'radio-button-unchecked'}
                  size={20}
                  color={step.done ? Colors.success : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.processingStepText,
                    { color: step.done ? colors.text : colors.textSecondary },
                  ]}
                >
                  {step.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (screen === Screen.TEXT_EDITOR) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Metin Ekle</Text>
          <TouchableOpacity onPress={() => {
            onDraftUpdate({ ...(draft ?? {}), text: stickerText || null });
            navigate(Screen.PREVIEW);
          }}>
            <Text style={styles.nextText}>İleri</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.textEditorContent}
          contentContainerStyle={styles.textEditorScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.textPreviewCard, Shadows.large]}>
            {draftImageUri ? (
              <Image source={{ uri: draftImageUri }} style={styles.textPreviewImage} />
            ) : (
              <View style={[styles.textPreviewPlaceholder, { backgroundColor: colors.surface }]}>
                <MaterialIcons name="image" size={64} color={colors.textSecondary} />
              </View>
            )}
            {stickerText ? (
              <View style={styles.textOverlay}>
                <Text style={styles.overlayText}>{stickerText}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.textEditorSectionTitle, { color: colors.text }]}>
            Yazı Ekle
          </Text>
          <Text style={[styles.textEditorHint, { color: colors.textSecondary }]}>
            Stickerına kısa bir yazı ekleyebilirsin (opsiyonel)
          </Text>

          <View style={[styles.textInputContainer, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="text-fields" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="Metin gir..."
              placeholderTextColor={colors.textSecondary}
              value={stickerText}
              onChangeText={setStickerText}
              maxLength={30}
              returnKeyType="done"
            />
            {stickerText ? (
              <TouchableOpacity onPress={() => setStickerText('')} style={styles.clearInputBtn}>
                <MaterialIcons name="cancel" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={[styles.charCount, { color: stickerText.length > 25 ? Colors.warning : colors.textSecondary }]}>
            {stickerText.length}/30
          </Text>

          <Text style={[styles.quickTextsTitle, { color: colors.textSecondary }]}>
            Hızlı Seçim
          </Text>
          <View style={styles.quickTexts}>
            {['LOL 😂', 'WOW! 🤩', 'OK 👍', 'NO! 🙅', 'YAY! 🎉', 'HI! 👋'].map((text) => (
              <TouchableOpacity
                key={text}
                style={[
                  styles.quickTextChip,
                  { backgroundColor: colors.surface },
                  stickerText === text && styles.quickTextChipActive,
                ]}
                onPress={() => setStickerText(stickerText === text ? '' : text)}
              >
                <Text
                  style={[
                    styles.quickTextLabel,
                    { color: stickerText === text ? Colors.primary : colors.text },
                  ]}
                >
                  {text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.textEditorBottomBar, { backgroundColor: colors.background }]}>
          <View style={styles.textEditorButtonRow}>
            <TouchableOpacity
              style={[styles.skipTextBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                onDraftUpdate({ ...(draft ?? {}), text: null });
                navigate(Screen.PREVIEW);
              }}
            >
              <MaterialIcons name="arrow-forward" size={18} color={colors.textSecondary} />
              <Text style={[styles.skipTextBtnText, { color: colors.text }]}>Atla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.addTextBtn,
                Shadows.primary,
                !stickerText && styles.addTextBtnDisabled,
              ]}
              onPress={() => {
                onDraftUpdate({ ...(draft ?? {}), text: stickerText });
                navigate(Screen.PREVIEW);
              }}
              disabled={!stickerText}
            >
              <MaterialIcons name="check" size={18} color={Colors.white} />
              <Text style={styles.addTextBtnText}>Metin Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Preview Screen
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sticker'ın Hazır!</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.previewContent}
      >
        <View style={[styles.finalPreviewCard, Shadows.large]}>
          {draftImageUri ? (
            <Image source={{ uri: draftImageUri }} style={styles.finalPreviewImage} />
          ) : (
            <View style={[styles.finalPreviewPlaceholder, { backgroundColor: colors.surface }]}>
              <MaterialIcons name="image" size={64} color={colors.textSecondary} />
            </View>
          )}
          {draft?.text && (
            <View style={styles.textOverlay}>
              <Text style={styles.overlayText}>{draft.text}</Text>
            </View>
          )}
        </View>

        <View style={styles.previewActions}>
          <TouchableOpacity style={[styles.previewAction, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="edit" size={24} color={colors.text} />
            <Text style={[styles.previewActionText, { color: colors.text }]}>Düzenle</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.previewAction, { backgroundColor: colors.surface }]}
            onPress={() => {
              setSelectedStyle(null);
              navigate(Screen.STYLE_SELECT);
            }}
          >
            <MaterialIcons name="refresh" size={24} color={colors.text} />
            <Text style={[styles.previewActionText, { color: colors.text }]}>Yeniden Oluştur</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.saveButton, Shadows.primary]}
          onPress={onComplete}
        >
          <MaterialIcons name="check" size={24} color={Colors.white} />
          <Text style={styles.saveButtonText}>Kaydet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.whatsappButton, Shadows.medium]}
          onPress={handleShareToWhatsApp}
          disabled={isSharing}
        >
          <MaterialIcons name="send" size={24} color={Colors.white} />
          <Text style={styles.whatsappButtonText}>{isSharing ? 'Hazırlanıyor...' : 'WhatsApp Paketi (3+)'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 48, paddingBottom: 16,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  nextText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  sourceContent: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  sourceTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  sourceSubtitle: { fontSize: 16, marginBottom: 32 },
  sourceOptions: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  sourceCard: { flex: 1, padding: 24, borderRadius: 20, alignItems: 'center' },
  sourceIcon: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  sourceCardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sourceCardDesc: { fontSize: 14, textAlign: 'center' },
  recentSection: { padding: 20, borderRadius: 20 },
  recentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  recentTitle: { fontSize: 16, fontWeight: '600' },
  recentImages: { flexDirection: 'row', gap: 12 },
  recentItem: {
    width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  cameraPreview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraControls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingVertical: 32, paddingHorizontal: 40,
  },
  cameraButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  captureButton: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary },
  cropContent: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  cropFrame: {
    aspectRatio: 1, borderRadius: 24, overflow: 'hidden', marginBottom: 24,
  },
  cropImage: { width: '100%', height: '100%' },
  cropPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cropOverlay: { ...StyleSheet.absoluteFillObject },
  cropCorner: {
    position: 'absolute', width: 24, height: 24, borderColor: Colors.white, borderWidth: 3,
  },
  cropTopLeft: { top: 16, left: 16, borderRightWidth: 0, borderBottomWidth: 0 },
  cropTopRight: { top: 16, right: 16, borderLeftWidth: 0, borderBottomWidth: 0 },
  cropBottomLeft: { bottom: 16, left: 16, borderRightWidth: 0, borderTopWidth: 0 },
  cropBottomRight: { bottom: 16, right: 16, borderLeftWidth: 0, borderTopWidth: 0 },
  cropTools: { flexDirection: 'row', justifyContent: 'space-around', padding: 16, borderRadius: 16 },
  cropTool: { alignItems: 'center', gap: 4 },
  cropToolText: { fontSize: 12, fontWeight: '500' },
  styleContent: { flex: 1, paddingHorizontal: 24 },
  previewCard: { height: 200, borderRadius: 24, overflow: 'hidden', marginBottom: 24 },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  styleTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  styleSubtitle: { fontSize: 16, marginBottom: 24 },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 100 },
  styleCard: {
    width: (width - 60) / 2, padding: 16, borderRadius: 16, alignItems: 'center', position: 'relative',
  },
  styleIcon: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  styleName: { fontSize: 14, fontWeight: '600' },
  styleCheck: { position: 'absolute', top: 8, right: 8 },
  bottomBar: { padding: 24, paddingBottom: 32 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 16, gap: 8,
  },
  continueBtnText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  processingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  processingAnimation: { marginBottom: 32 },
  processingTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  processingSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32 },
  progressContainer: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  progressText: { fontSize: 14, fontWeight: '600', marginBottom: 32 },
  processingSteps: { width: '100%', gap: 12 },
  processingStep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  processingStepText: { fontSize: 14, fontWeight: '500' },
  textEditorContent: { flex: 1, paddingHorizontal: 24 },
  textEditorScrollContent: { paddingBottom: 20 },
  textEditorSectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  textEditorHint: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  textPreviewCard: { height: 240, borderRadius: 24, overflow: 'hidden', marginBottom: 24 },
  textPreviewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  textPreviewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textOverlay: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 12,
  },
  overlayText: { color: Colors.white, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  textInputContainer: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, marginBottom: 4,
  },
  textInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  clearInputBtn: { padding: 4 },
  charCount: { fontSize: 12, fontWeight: '500', textAlign: 'right', marginBottom: 20 },
  quickTextsTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  quickTexts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickTextChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  quickTextChipActive: { backgroundColor: 'rgba(233, 30, 99, 0.1)', borderColor: Colors.primary, borderWidth: 1 },
  quickTextLabel: { fontSize: 14, fontWeight: '600' },
  textEditorBottomBar: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  textEditorButtonRow: { flexDirection: 'row', gap: 12 },
  skipTextBtn: {
    flex: 1, flexDirection: 'row', paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1,
  },
  skipTextBtnText: { fontSize: 15, fontWeight: '600' },
  addTextBtn: {
    flex: 2, flexDirection: 'row', backgroundColor: Colors.primary,
    paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  addTextBtnDisabled: { opacity: 0.5 },
  addTextBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  previewContent: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  finalPreviewCard: { width: width - 48, aspectRatio: 1, borderRadius: 24, overflow: 'hidden', marginBottom: 24, alignSelf: 'center' },
  finalPreviewImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  finalPreviewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewActions: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginBottom: 16 },
  previewAction: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, gap: 8 },
  previewActionText: { fontSize: 14, fontWeight: '600' },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 16, gap: 8, marginBottom: 12,
  },
  saveButtonText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  whatsappButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.success, paddingVertical: 16, borderRadius: 16, gap: 8,
  },
  whatsappButtonText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
});
