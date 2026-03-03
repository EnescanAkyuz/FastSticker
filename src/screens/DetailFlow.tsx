import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Screen, NavigationProps, Sticker } from '../types';
import { Colors, Shadows } from '../theme/colors';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');

interface Props extends NavigationProps {
  screen: Screen;
  selectedSticker: Sticker | null;
  onDelete?: () => void;
}

export const DetailFlow: React.FC<Props> = ({
  screen,
  navigate,
  goBack,
  selectedSticker,
  onDelete,
}) => {
  const { isDarkMode, startPackSelection } = useApp();
  const colors = isDarkMode ? Colors.dark : Colors.light;

  const shareToWhatsApp = () => {
    if (!selectedSticker?.id) {
      Alert.alert('Hata', 'Sticker bulunamadı.');
      return;
    }

    startPackSelection([selectedSticker.id]);
    Alert.alert(
      'Sticker Paketi',
      'WhatsApp için en az 3 sticker seçmelisin. Koleksiyonda 2 tane daha seçip “Aktar”a bas.'
    );
    navigate(Screen.COLLECTION);
  };

  if (screen === Screen.STICKER_DETAIL) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Sticker Detayı</Text>
          <TouchableOpacity>
            <MaterialIcons name="more-vert" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
          <View style={[styles.detailCard, Shadows.large]}>
            {selectedSticker?.imageUrl || selectedSticker?.url ? (
              <Image source={{ uri: selectedSticker.imageUrl || selectedSticker.url }} style={styles.detailImage} />
            ) : (
              <View style={[styles.detailPlaceholder, { backgroundColor: colors.surface }]}>
                <MaterialIcons name="image" size={64} color={colors.textSecondary} />
              </View>
            )}
          </View>

          <View style={styles.detailInfo}>
            <Text style={[styles.detailName, { color: colors.text }]}>
              {selectedSticker?.name || 'Sticker'}
            </Text>
            <View style={styles.detailMeta}>
              <View style={[styles.metaBadge, { backgroundColor: colors.surface }]}>
                <MaterialIcons name="auto-awesome" size={16} color={Colors.primary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {selectedSticker?.style || 'Çizgi Film'}
                </Text>
              </View>
              <View style={[styles.metaBadge, { backgroundColor: colors.surface }]}>
                <MaterialIcons name="access-time" size={16} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {selectedSticker?.createdAt
                    ? new Date(selectedSticker.createdAt).toLocaleDateString('tr-TR')
                    : 'Bugün'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: Colors.success }]} onPress={shareToWhatsApp}>
              <MaterialIcons name="send" size={24} color={Colors.white} />
              <Text style={styles.actionButtonText}>WhatsApp Paketi (3+)</Text>
            </TouchableOpacity>

            <View style={styles.secondaryActions}>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.surface }]}>
                <MaterialIcons name="share" size={24} color={colors.text} />
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Paylaş</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.surface }]}>
                <MaterialIcons name="download" size={24} color={colors.text} />
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>İndir</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]}
              onPress={() => {
                onDelete?.();
                goBack();
              }}
            >
              <MaterialIcons name="delete" size={24} color={Colors.error} />
              <Text style={[styles.deleteButtonText, { color: Colors.error }]}>Sil</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === Screen.EDIT_PACK) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Paketi Düzenle</Text>
          <TouchableOpacity>
            <Text style={styles.saveText}>Kaydet</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.editContent}>
          <View style={[styles.packHeader, { backgroundColor: colors.surface }]}>
            <View style={styles.packIcon}>
              <MaterialIcons name="folder" size={32} color={Colors.primary} />
            </View>
            <View style={styles.packInfo}>
              <Text style={[styles.packName, { color: colors.text }]}>Favori Stickerlarım</Text>
              <Text style={[styles.packCount, { color: colors.textSecondary }]}>12 sticker</Text>
            </View>
            <TouchableOpacity>
              <MaterialIcons name="edit" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Stickerlar</Text>
          <View style={styles.editGrid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={[styles.editItem, { backgroundColor: colors.surface }]}>
                <View style={styles.editItemPlaceholder}>
                  <MaterialIcons name="image" size={32} color={colors.textSecondary} />
                </View>
                <TouchableOpacity style={styles.removeButton}>
                  <MaterialIcons name="close" size={16} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[styles.addItemButton, { backgroundColor: colors.surface }]}>
              <MaterialIcons name="add" size={32} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === Screen.PRIVACY) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Gizlilik Politikası</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.privacyContent}>
          <View style={[styles.privacySection, { backgroundColor: colors.surface }]}>
            <View style={styles.privacyIcon}>
              <MaterialIcons name="security" size={32} color={Colors.primary} />
            </View>
            <Text style={[styles.privacyTitle, { color: colors.text }]}>Verileriniz Güvende</Text>
            <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
              Fotoğraflarınız yalnızca sticker oluşturmak için işlenir ve sunucularımızda
              saklanmaz. İşlem tamamlandıktan sonra tüm veriler silinir.
            </Text>
          </View>

          <View style={styles.privacyItems}>
            {[
              {
                icon: 'photo-camera',
                title: 'Kamera Erişimi',
                desc: 'Yalnızca sticker oluşturmak için fotoğraf çekmek amacıyla kullanılır.',
              },
              {
                icon: 'photo-library',
                title: 'Galeri Erişimi',
                desc: 'Mevcut fotoğraflarınızdan sticker oluşturmak için kullanılır.',
              },
              {
                icon: 'cloud-upload',
                title: 'Veri İşleme',
                desc: 'Fotoğraflarınız AI ile işlenir ve hemen silinir.',
              },
              {
                icon: 'analytics',
                title: 'Analitik',
                desc: 'Anonim kullanım verileri uygulamamızı geliştirmek için toplanır.',
              },
            ].map((item, index) => (
              <View key={index} style={[styles.privacyItem, { backgroundColor: colors.surface }]}>
                <View style={[styles.privacyItemIcon, { backgroundColor: Colors.primaryLight }]}>
                  <MaterialIcons name={item.icon as any} size={24} color={Colors.primary} />
                </View>
                <View style={styles.privacyItemContent}>
                  <Text style={[styles.privacyItemTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.privacyItemDesc, { color: colors.textSecondary }]}>
                    {item.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.privacyLink, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="description" size={24} color={Colors.primary} />
            <Text style={[styles.privacyLinkText, { color: colors.text }]}>
              Tam Gizlilik Politikası
            </Text>
            <MaterialIcons name="open-in-new" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Error Screen
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.errorContent}>
        <View style={[styles.errorIcon, { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]}>
          <MaterialIcons name="error-outline" size={64} color={Colors.error} />
        </View>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Bir Hata Oluştu</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          İşlem sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.
        </Text>
        <View style={styles.errorActions}>
          <TouchableOpacity
            style={[styles.retryButton, Shadows.primary]}
            onPress={() => navigate(Screen.HOME)}
          >
            <MaterialIcons name="refresh" size={24} color={Colors.white} />
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeButton} onPress={() => navigate(Screen.HOME)}>
            <Text style={[styles.homeButtonText, { color: Colors.primary }]}>Ana Sayfaya Dön</Text>
          </TouchableOpacity>
        </View>
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
  saveText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  detailContent: { paddingHorizontal: 24, paddingBottom: 40 },
  detailCard: {
    width: width - 48, aspectRatio: 1, borderRadius: 24, overflow: 'hidden',
    marginBottom: 24, alignSelf: 'center',
  },
  detailImage: { width: '100%', height: '100%' },
  detailPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  detailInfo: { alignItems: 'center', marginBottom: 32 },
  detailName: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  detailMeta: { flexDirection: 'row', gap: 12 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  metaText: { fontSize: 14, fontWeight: '500' },
  actionButtons: { gap: 12 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16, gap: 8,
  },
  actionButtonText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  secondaryActions: { flexDirection: 'row', gap: 12 },
  secondaryButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 16, gap: 8,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 16, gap: 8,
  },
  deleteButtonText: { fontSize: 16, fontWeight: '600' },
  editContent: { flex: 1, paddingHorizontal: 24 },
  packHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 24,
  },
  packIcon: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  packInfo: { flex: 1 },
  packName: { fontSize: 18, fontWeight: '700' },
  packCount: { fontSize: 14, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  editGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  editItem: {
    width: (width - 72) / 3, aspectRatio: 1, borderRadius: 16, overflow: 'hidden', position: 'relative',
  },
  editItemPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  removeButton: {
    position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
  },
  addItemButton: {
    width: (width - 72) / 3, aspectRatio: 1, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed',
  },
  privacyContent: { flex: 1, paddingHorizontal: 24 },
  privacySection: { alignItems: 'center', padding: 32, borderRadius: 24, marginBottom: 24 },
  privacyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  privacyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  privacyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  privacyItems: { gap: 12, marginBottom: 24 },
  privacyItem: { flexDirection: 'row', padding: 16, borderRadius: 16 },
  privacyItemIcon: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  privacyItemContent: { flex: 1 },
  privacyItemTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  privacyItemDesc: { fontSize: 14, lineHeight: 20 },
  privacyLink: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 32,
  },
  privacyLinkText: { flex: 1, fontSize: 16, fontWeight: '600', marginLeft: 12 },
  errorContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  errorIcon: {
    width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  errorTitle: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  errorText: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  errorActions: { width: '100%', gap: 16 },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 16, gap: 8,
  },
  retryButtonText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  homeButton: { alignItems: 'center', paddingVertical: 12 },
  homeButtonText: { fontSize: 16, fontWeight: '600' },
});
