import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ImageManipulator from 'expo-image-manipulator';

const WhatsappStickerDynamic = NativeModules.WhatsappStickerDynamic;

type GenerateStickerInput = {
  sourceImageUri: string;
  style: string;
  text?: string | null;
};

type GenerateStickerResponse = {
  imageBase64: string;
  mimeType?: string;
};

export function isWhatsAppPackExportAvailable() {
  return Platform.OS === 'android' && Boolean(WhatsappStickerDynamic);
}

const DEFAULT_API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://127.0.0.1:8787';

function getApiBaseUrl() {
  const configured = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
  return (configured || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function getMimeTypeFromUri(uri: string) {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  if (normalized.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function getFileExtensionFromMime(mimeType: string) {
  if (mimeType.includes('png')) {
    return 'png';
  }
  if (mimeType.includes('webp')) {
    return 'webp';
  }
  return 'jpg';
}

async function convertToWhatsAppWebp(localUri: string) {
  const targetMaxBytes = 100 * 1024;
  const compressCandidates = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];

  let lastUri: string | null = null;

  for (const compress of compressCandidates) {
    try {
      console.log(`Converting to WEBP with compression ${compress}...`);
      const manipResult = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 512, height: 512 } }],
        { compress, format: ImageManipulator.SaveFormat.WEBP }
      );

      lastUri = manipResult.uri;
      console.log('WEBP conversion successful:', lastUri);
      
      try {
        const info = await FileSystem.getInfoAsync(manipResult.uri);
        const fileSize = (info as any).size;
        if (info.exists && typeof fileSize === 'number' && fileSize <= targetMaxBytes) {
          console.log(`File size acceptable: ${fileSize} bytes`);
          return manipResult.uri;
        } else if (info.exists) {
          console.log(`File size too large: ${fileSize} bytes, trying lower compression...`);
        }
      } catch (sizeError) {
        console.warn('Could not check file size, continuing:', sizeError);
        // If size check fails, continue; we'll still return the last converted file.
      }
    } catch (conversionError) {
      console.error(`WEBP conversion failed with compression ${compress}:`, conversionError);
      // Try next compression level
      continue;
    }
  }

  if (!lastUri) {
    throw new Error('Sticker WEBP dönüşümü tamamıyla başarısız oldu.');
  }

  console.log('Returning last converted URI due to size constraints');
  return lastUri;
}

async function ensureLocalUri(imageUri: string) {
  console.log('ensureLocalUri called with:', imageUri);
  
  if (imageUri.startsWith('file://')) {
    console.log('URI is already a file:// URI');
    return imageUri;
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
    console.log('Downloading image from URL:', imageUri);
    const localPath = `${FileSystem.cacheDirectory}shared-${Date.now()}.png`;
    try {
      const downloaded = await FileSystem.downloadAsync(imageUri, localPath);
      console.log('Image downloaded successfully to:', downloaded.uri);
      return downloaded.uri;
    } catch (downloadError) {
      console.error('Failed to download image:', downloadError);
      throw new Error('Görüntü indirilemedi: ' + (downloadError instanceof Error ? downloadError.message : String(downloadError)));
    }
  }

  // Check if it's already a valid local file path without file:// prefix
  if (imageUri.includes('/') && !imageUri.startsWith('http')) {
    console.log('URI appears to be a local file path');
    return imageUri;
  }

  throw new Error('Desteklenmeyen görüntü URI türü: ' + imageUri);
}

export async function generateStickerWithGemini({
  sourceImageUri,
  style,
  text,
}: GenerateStickerInput) {
  if (!FileSystem.cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  try {
    console.log('Starting sticker generation for:', sourceImageUri);
    console.log('Style:', style);
    
    if (!sourceImageUri) {
      throw new Error('Source image URI is empty');
    }

    const imageBase64 = await FileSystem.readAsStringAsync(sourceImageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('Image read successfully, size:', imageBase64.length, 'bytes');

    const apiUrl = `${getApiBaseUrl()}/api/generate-sticker`;
    console.log('API URL:', apiUrl);

    const mimeType = getMimeTypeFromUri(sourceImageUri);
    console.log('MIME type:', mimeType);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        style,
        text: text || undefined,
      }),
    });

    console.log('API Response status:', response.status);
    
    const responseText = await response.text();
    console.log('API Response text length:', responseText.length);
    
    let payload: Partial<GenerateStickerResponse> & { error?: string };
    try {
      payload = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse API response as JSON:', responseText.slice(0, 200));
      throw new Error('Server returned an invalid response (not JSON)');
    }

    if (!response.ok) {
      console.error('API request failed with status', response.status, 'Error:', payload.error);
      throw new Error(payload.error || 'Sticker generation request failed');
    }

    if (!payload.imageBase64) {
      console.error('API response missing imageBase64');
      throw new Error('Gemini did not return a sticker image');
    }

    const mimeTypeResponse = payload.mimeType || 'image/png';
    const fileExtension = getFileExtensionFromMime(mimeTypeResponse);
    const localPath = `${FileSystem.cacheDirectory}sticker-${Date.now()}.${fileExtension}`;

    console.log('Writing sticker to:', localPath);

    await FileSystem.writeAsStringAsync(localPath, payload.imageBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('Sticker written successfully');
    return localPath;
  } catch (error) {
    console.error('generateStickerWithGemini error:', error);
    throw error;
  }
}

export async function shareStickersToWhatsApp(stickers: string[], packName: string = 'FastSticker') {
  if (Platform.OS !== 'android') {
    throw new Error('Şu anlık sadece Android cihazlarda sticker paketi destekleniyor.');
  }

  if (stickers.length < 3) {
    throw new Error('WhatsApp en az 3 adet sticker istiyor. Lütfen ' + (3 - stickers.length) + ' adet daha oluştur.');
  }

  if (!WhatsappStickerDynamic) {
    throw new Error('WhatsApp pack export is unavailable in Expo Go. Build and run a dev/release Android app first (e.g. npx expo run:android).');
  }

  if (typeof (WhatsappStickerDynamic as any).createPack !== 'function') {
    throw new Error(
      'WhatsApp native module loaded but createPack is missing. Rebuild Android after setting newArchEnabled=false (npx expo run:android).'
    );
  }

  try {
    const localStickers = await Promise.all(stickers.map(ensureLocalUri));

    // WhatsApp sticker pack requirement: 512x512 WEBP (and typically <= 100KB).
    const webpUris = await Promise.all(localStickers.map(convertToWhatsAppWebp));
    // Native side expects a filesystem path (no file:// prefix)
    const webpStickers = webpUris.map((uri) => uri.replace('file://', ''));

    const payload = {
      identifier: `faststicker_${Date.now()}`,
      name: packName,
      publisher: 'FastSticker',
      tray_image_file: webpStickers[0],
      avoid_cache: false,
      image_data_version: '1',
      animated_sticker_pack: false,
      android_play_store_link: '',
      ios_app_store_link: '',
      publisher_email: '',
      publisher_website: '',
      privacy_policy_website: '',
      license_agreement_website: '',
      stickers: webpStickers.map((path) => ({
        image_file: path,
        emojis: ['😃', '✨'],
      })),
    };

    const result = await WhatsappStickerDynamic.createPack(payload);
    
    if (result && result.id) {
       await WhatsappStickerDynamic.installPack(result.id, result.identifier, result.name);
    } else {
       throw new Error('Sticker paketi oluşturulamadı.');
    }
  } catch (error: any) {
    console.error('WhatsApp export failed:', error);
    throw new Error(error.message || 'Paket WhatsApp\'a aktarılamadı.');
  }
}

export async function shareStickerToWhatsApp(imageUri: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  const localUri = await ensureLocalUri(imageUri);

  if (Platform.OS === 'android') {
    try {
      // Android'de expo-sharing zaten sistem paylaşım diyalogunu açar
      // ve kullanıcı WhatsApp'ı seçebilir. Intent ile doğrudan WhatsApp'a
      // yönlendirme content URI sorunlarına yol açabiliyor.
      await Sharing.shareAsync(localUri, {
        dialogTitle: "Sticker'ı paylaş",
        mimeType: getMimeTypeFromUri(localUri),
      });
      return;
    } catch (error) {
      console.warn('Android sharing failed', error);
      throw new Error('Sticker paylaşılamadı. Lütfen tekrar dene.');
    }
  }

  // iOS için paylaşım
  await Sharing.shareAsync(localUri, {
    dialogTitle: "Sticker'ı WhatsApp ile paylaş",
    mimeType: 'image/png',
    UTI: 'public.png',
  });
}
