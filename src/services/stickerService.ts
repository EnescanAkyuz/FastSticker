import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

type GenerateStickerInput = {
  sourceImageUri: string;
  style: string;
  text?: string | null;
};

type GenerateStickerResponse = {
  imageBase64: string;
  mimeType?: string;
};

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

async function ensureLocalUri(imageUri: string) {
  if (imageUri.startsWith('file://')) {
    return imageUri;
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
    const localPath = `${FileSystem.cacheDirectory}shared-${Date.now()}.png`;
    const downloaded = await FileSystem.downloadAsync(imageUri, localPath);
    return downloaded.uri;
  }

  throw new Error('Unsupported image URI');
}

export async function generateStickerWithGemini({
  sourceImageUri,
  style,
  text,
}: GenerateStickerInput) {
  if (!FileSystem.cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  const imageBase64 = await FileSystem.readAsStringAsync(sourceImageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(`${getApiBaseUrl()}/api/generate-sticker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      mimeType: getMimeTypeFromUri(sourceImageUri),
      style,
      text: text || undefined,
    }),
  });

  const payload = (await response.json()) as Partial<GenerateStickerResponse> & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'Sticker generation request failed');
  }

  if (!payload.imageBase64) {
    throw new Error('Gemini did not return a sticker image');
  }

  const mimeType = payload.mimeType || 'image/png';
  const fileExtension = getFileExtensionFromMime(mimeType);
  const localPath = `${FileSystem.cacheDirectory}sticker-${Date.now()}.${fileExtension}`;

  await FileSystem.writeAsStringAsync(localPath, payload.imageBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return localPath;
}

export async function shareStickerToWhatsApp(imageUri: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  const localUri = await ensureLocalUri(imageUri);
  
  // Android'de WhatsApp'a özel paylaşım
  if (Platform.OS === 'android') {
    try {
      // WhatsApp için özel intent ile paylaşım
      const contentUri = localUri.replace('file://', '');
      
      await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
        data: localUri,
        type: 'image/*',
        flags: 1,
        extra: {
          'android.intent.extra.STREAM': localUri,
        },
        packageName: 'com.whatsapp',
        className: 'com.whatsapp.ContactPicker',
      });
      
      return;
    } catch (error) {
      // WhatsApp yoksa veya intent başarısız olduysa, normal sharing'e düş
      console.log('WhatsApp intent failed, falling back to normal sharing', error);
    }
  }
  
  // iOS ve fallback için normal sharing
  await Sharing.shareAsync(localUri, {
    dialogTitle: "Sticker'ı WhatsApp ile paylaş",
    mimeType: 'image/png',
    UTI: 'public.png',
  });
}
