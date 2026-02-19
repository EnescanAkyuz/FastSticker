import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Screen, NavigationProps, Sticker } from '../types';
import { Colors, Shadows } from '../theme/colors';
import { useApp } from '../context/AppContext';

const { width, height } = Dimensions.get('window');

interface Props extends NavigationProps {
  screen: Screen;
  stickers: Sticker[];
  onStickerSelect: (sticker: Sticker) => void;
}

export const MainFlow: React.FC<Props> = ({
  screen,
  navigate,
  goBack,
  stickers,
  onStickerSelect,
}) => {
  const { isDarkMode, toggleDarkMode, isPremium, remainingCredits, setIsPremium } = useApp();
  const colors = isDarkMode ? Colors.dark : Colors.light;

  const [selectedFilter, setSelectedFilter] = useState('Tümü');
  const [notifications, setNotifications] = useState(true);

  if (screen === Screen.HOME) {
    const filters = ['Tümü', 'Animasyon', 'Çizgi Film', 'Karikatür', 'Emoji'];
    const hasStickers = stickers.length > 0;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <MaterialIcons name="auto-awesome" size={24} color={Colors.white} />
            </View>
            <Text style={[styles.logoText, { color: colors.text }]}>FastSticker</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.creditBadge, Shadows.small]}
              onPress={() => navigate(Screen.PAYWALL)}
            >
              <MaterialIcons
                name={isPremium ? 'workspace-premium' : 'stars'}
                size={18}
                color={isPremium ? Colors.premium : Colors.primary}
              />
              <Text style={[styles.creditText, { color: colors.text }]}>
                {isPremium ? 'Premium' : `${remainingCredits} Kredi`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigate(Screen.SETTINGS)}
            >
              <MaterialIcons name="settings" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={[styles.heroCard, Shadows.large]}>
            <View style={styles.heroBg} />
            <View style={styles.heroContent}>
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>AI ile Sticker Oluştur</Text>
                <Text style={styles.heroSubtitle}>
                  Fotoğrafını yükle, saniyeler içinde WhatsApp stickerı oluştur
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.heroButton, Shadows.white]}
                onPress={() => navigate(Screen.SOURCE_SELECT)}
                activeOpacity={0.9}
              >
                <MaterialIcons name="add-a-photo" size={24} color={Colors.primary} />
                <Text style={styles.heroButtonText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stickers Section */}
          <View style={styles.stickerSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Stickerlarım
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {stickers.length} sticker
                </Text>
              </View>

              {hasStickers && (
                <TouchableOpacity
                  style={[styles.viewAllButton, { backgroundColor: colors.surface }]}
                  onPress={() => navigate(Screen.COLLECTION)}
                >
                  <Text style={styles.viewAllText}>Tümünü Gör</Text>
                  <MaterialIcons name="chevron-right" size={18} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {hasStickers && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterContainer}
              >
                {filters.map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.filterChip,
                      selectedFilter === filter
                        ? { backgroundColor: Colors.primary }
                        : { backgroundColor: colors.surface },
                    ]}
                    onPress={() => setSelectedFilter(filter)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        { color: selectedFilter === filter ? Colors.white : colors.text },
                      ]}
                    >
                      {filter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {!hasStickers ? (
              <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                <View style={styles.emptyIcon}>
                  <MaterialIcons name="photo-library" size={48} color={Colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  Henüz sticker yok
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Harika stickerlar oluşturmaya hazır mısın? Hadi başlayalım!
                </Text>
                <TouchableOpacity
                  style={[styles.emptyButton, Shadows.primary]}
                  onPress={() => navigate(Screen.SOURCE_SELECT)}
                >
                  <MaterialIcons name="add-a-photo" size={20} color={Colors.white} />
                  <Text style={styles.emptyButtonText}>İlk Stickerını Oluştur</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.stickerGrid}>
                {stickers.slice(0, 6).map((sticker) => (
                  <TouchableOpacity
                    key={sticker.id}
                    style={[styles.stickerItem, Shadows.small]}
                    onPress={() => {
                      onStickerSelect(sticker);
                      navigate(Screen.STICKER_DETAIL);
                    }}
                  >
                    {sticker.imageUrl || sticker.url ? (
                      <Image source={{ uri: sticker.imageUrl || sticker.url }} style={styles.stickerImage} />
                    ) : (
                      <View style={styles.stickerPlaceholder}>
                        <MaterialIcons name="image" size={28} color={colors.textSecondary} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Features Section */}
          <View style={styles.featuresSection}>
            <Text style={[styles.featuresTitle, { color: colors.text }]}>
              Neler Yapabilirsin?
            </Text>
            <View style={styles.featuresList}>
              <View style={[styles.featureItem, { backgroundColor: colors.surface }]}>
                <View style={[styles.featureIcon, { backgroundColor: 'rgba(233, 30, 99, 0.1)' }]}>
                  <MaterialIcons name="face-retouching-natural" size={24} color={Colors.primary} />
                </View>
                <Text style={[styles.featureTitle, { color: colors.text }]}>Çizgi Film</Text>
                <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                  AI ile dönüştür
                </Text>
              </View>
              <View style={[styles.featureItem, { backgroundColor: colors.surface }]}>
                <View style={[styles.featureIcon, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
                  <MaterialIcons name="animation" size={24} color="#9C27B0" />
                </View>
                <Text style={[styles.featureTitle, { color: colors.text }]}>Animasyon</Text>
                <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                  Hareketli GIF
                </Text>
              </View>
              <View style={[styles.featureItem, { backgroundColor: colors.surface }]}>
                <View style={[styles.featureIcon, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                  <MaterialIcons name="auto-awesome-motion" size={24} color="#2196F3" />
                </View>
                <Text style={[styles.featureTitle, { color: colors.text }]}>Paketler</Text>
                <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                  WhatsApp'a aktar
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={[styles.fab, Shadows.primary]}
          onPress={() => navigate(Screen.SOURCE_SELECT)}
          activeOpacity={0.9}
        >
          <MaterialIcons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === Screen.COLLECTION) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.collectionHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.collectionTitle, { color: colors.text }]}>Koleksiyonum</Text>
          <TouchableOpacity>
            <MaterialIcons name="more-vert" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.collectionStats}>
          <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="photo-library" size={24} color={Colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stickers.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sticker</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="folder" size={24} color="#9C27B0" />
            <Text style={[styles.statValue, { color: colors.text }]}>2</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Paket</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="send" size={24} color={Colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>24</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Gönderildi</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.collectionGrid}>
            {stickers.map((sticker) => (
              <TouchableOpacity
                key={sticker.id}
                style={[styles.collectionItem, Shadows.small]}
                onPress={() => {
                  onStickerSelect(sticker);
                  navigate(Screen.STICKER_DETAIL);
                }}
              >
                {sticker.imageUrl || sticker.url ? (
                  <Image source={{ uri: sticker.imageUrl || sticker.url }} style={styles.collectionImage} />
                ) : (
                  <View style={styles.stickerPlaceholder}>
                    <MaterialIcons name="image" size={28} color={colors.textSecondary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === Screen.SETTINGS) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.collectionHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.collectionTitle, { color: colors.text }]}>Ayarlar</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.settingsContent}>
          <TouchableOpacity
            style={[styles.premiumBanner, Shadows.large]}
            onPress={() => navigate(Screen.PAYWALL)}
          >
            <View style={styles.premiumIcon}>
              <MaterialIcons name="workspace-premium" size={32} color={Colors.premium} />
            </View>
            <View style={styles.premiumText}>
              <Text style={styles.premiumTitle}>
                {isPremium ? 'Premium Üye' : 'Premium\'a Geç'}
              </Text>
              <Text style={styles.premiumSubtitle}>
                {isPremium ? 'Tüm özelliklerin kilidi açıldı' : 'Sınırsız sticker oluştur'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={Colors.white} />
          </TouchableOpacity>

          <View style={styles.settingsSection}>
            <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary }]}>
              Tercihler
            </Text>
            <View style={[styles.settingsGroup, { backgroundColor: colors.surface }]}>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIcon, { backgroundColor: 'rgba(33, 33, 33, 0.1)' }]}>
                    <MaterialIcons name="dark-mode" size={20} color={colors.text} />
                  </View>
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Karanlık Mod</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleDarkMode}
                  trackColor={{ false: '#767577', true: Colors.primaryLight }}
                  thumbColor={isDarkMode ? Colors.primary : '#f4f3f4'}
                />
              </View>
              <View style={styles.settingsDivider} />
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                    <MaterialIcons name="notifications" size={20} color={Colors.success} />
                  </View>
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Bildirimler</Text>
                </View>
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: '#767577', true: Colors.primaryLight }}
                  thumbColor={notifications ? Colors.primary : '#f4f3f4'}
                />
              </View>
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary }]}>
              Destek
            </Text>
            <View style={[styles.settingsGroup, { backgroundColor: colors.surface }]}>
              <TouchableOpacity style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIcon, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                    <MaterialIcons name="help" size={20} color="#2196F3" />
                  </View>
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Yardım</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.settingsDivider} />
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => navigate(Screen.PRIVACY)}
              >
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIcon, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
                    <MaterialIcons name="security" size={20} color="#9C27B0" />
                  </View>
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Gizlilik</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.versionText, { color: colors.textSecondary }]}>Versiyon 1.0.0</Text>
        </ScrollView>
      </View>
    );
  }

  // Paywall Screen
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.closeButton} onPress={goBack}>
        <MaterialIcons name="close" size={24} color={colors.text} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.paywallContent}>
        <View style={styles.paywallHeader}>
          <View style={[styles.paywallBadge, Shadows.large]}>
            <MaterialIcons name="workspace-premium" size={48} color={Colors.premium} />
          </View>
          <Text style={[styles.paywallTitle, { color: colors.text }]}>Premium'a Geç</Text>
          <Text style={[styles.paywallSubtitle, { color: colors.textSecondary }]}>
            Sınırsız sticker oluştur, reklamsız deneyim
          </Text>
        </View>

        <View style={styles.featuresList}>
          {[
            { icon: 'all-inclusive', text: 'Sınırsız sticker oluşturma' },
            { icon: 'block', text: 'Reklamsız deneyim' },
            { icon: 'high-quality', text: 'Yüksek çözünürlük' },
            { icon: 'support-agent', text: 'Öncelikli destek' },
          ].map((feature, index) => (
            <View key={index} style={[styles.paywallFeature, { backgroundColor: colors.surface }]}>
              <View style={[styles.paywallFeatureIcon, { backgroundColor: 'rgba(255, 215, 0, 0.1)' }]}>
                <MaterialIcons name={feature.icon as any} size={24} color={Colors.premium} />
              </View>
              <Text style={[styles.paywallFeatureText, { color: colors.text }]}>{feature.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.planCards}>
          <TouchableOpacity style={[styles.planCard, styles.planCardSelected, Shadows.medium]}>
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>EN POPÜLER</Text>
            </View>
            <Text style={styles.planDuration}>Yıllık</Text>
            <Text style={styles.planPrice}>₺149.99</Text>
            <Text style={styles.planPer}>/yıl</Text>
            <Text style={styles.planSave}>%60 tasarruf</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.planCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.planDuration, { color: colors.text }]}>Aylık</Text>
            <Text style={[styles.planPrice, { color: colors.text }]}>₺29.99</Text>
            <Text style={[styles.planPer, { color: colors.textSecondary }]}>/ay</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.subscribeButton, Shadows.large]}
          onPress={() => {
            setIsPremium(true);
            goBack();
          }}
        >
          <Text style={styles.subscribeText}>Şimdi Başla</Text>
        </TouchableOpacity>

        <Text style={[styles.termsText, { color: colors.textSecondary }]}>
          İstediğin zaman iptal edebilirsin • Gizlilik Politikası
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 48, paddingBottom: 16,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 20, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creditBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6,
  },
  creditText: { fontSize: 14, fontWeight: '700' },
  settingsButton: { padding: 8 },
  content: { flex: 1, paddingHorizontal: 20 },
  heroCard: {
    borderRadius: 24, overflow: 'hidden', marginBottom: 24,
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject, backgroundColor: Colors.primary,
  },
  heroContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 24,
  },
  heroText: { flex: 1, marginRight: 16 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: Colors.white, marginBottom: 8 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
  heroButton: {
    backgroundColor: Colors.white, paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  heroButtonText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  stickerSection: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  sectionSubtitle: { fontSize: 14, marginTop: 2 },
  viewAllButton: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  viewAllText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  filterScroll: { marginBottom: 16 },
  filterContainer: { gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterText: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 32, borderRadius: 24 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  emptyButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, gap: 8,
  },
  emptyButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stickerItem: {
    width: (width - 64) / 3, aspectRatio: 1, borderRadius: 16, backgroundColor: Colors.white, overflow: 'hidden',
  },
  stickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stickerImage: { width: '100%', height: '100%' },
  featuresSection: { marginBottom: 100 },
  featuresTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  featuresList: { flexDirection: 'row', gap: 12 },
  featureItem: {
    flex: 1, padding: 16, borderRadius: 16, alignItems: 'center',
  },
  featureIcon: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  featureTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  featureDesc: { fontSize: 12, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  collectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 48, paddingBottom: 16,
  },
  backButton: { padding: 8 },
  collectionTitle: { fontSize: 20, fontWeight: '800' },
  collectionStats: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  statItem: {
    flex: 1, alignItems: 'center', padding: 16, borderRadius: 16,
  },
  statValue: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  statLabel: { fontSize: 12, marginTop: 4 },
  collectionGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, paddingBottom: 24,
  },
  collectionItem: {
    width: (width - 64) / 3, aspectRatio: 1, borderRadius: 16, backgroundColor: Colors.white, overflow: 'hidden',
  },
  collectionImage: { width: '100%', height: '100%' },
  settingsContent: { flex: 1, paddingHorizontal: 20 },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    padding: 20, borderRadius: 20, marginBottom: 24,
  },
  premiumIcon: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  premiumText: { flex: 1 },
  premiumTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  premiumSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  settingsSection: { marginBottom: 24 },
  settingsSectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12, marginLeft: 4 },
  settingsGroup: { borderRadius: 16, overflow: 'hidden' },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16,
  },
  settingsItemLeft: { flexDirection: 'row', alignItems: 'center' },
  settingsItemIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  settingsItemText: { fontSize: 16, fontWeight: '500' },
  settingsDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 64 },
  versionText: { textAlign: 'center', fontSize: 14, marginTop: 24, marginBottom: 32 },
  closeButton: { position: 'absolute', top: 48, right: 20, zIndex: 10, padding: 8 },
  paywallContent: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  paywallHeader: { alignItems: 'center', marginBottom: 32 },
  paywallBadge: {
    width: 100, height: 100, borderRadius: 32, backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  paywallTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  paywallSubtitle: { fontSize: 16, textAlign: 'center' },
  paywallFeature: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12,
  },
  paywallFeatureIcon: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  paywallFeatureText: { fontSize: 16, fontWeight: '600' },
  planCards: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 24 },
  planCard: {
    flex: 1, padding: 20, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  planCardSelected: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  popularBadge: {
    position: 'absolute', top: -12, backgroundColor: Colors.premium, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  popularText: { color: Colors.black, fontSize: 10, fontWeight: '800' },
  planDuration: { fontSize: 14, fontWeight: '600', color: Colors.white, marginBottom: 4 },
  planPrice: { fontSize: 28, fontWeight: '800', color: Colors.white },
  planPer: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  planSave: { fontSize: 12, fontWeight: '700', color: Colors.premium, marginTop: 8 },
  subscribeButton: {
    backgroundColor: Colors.premium, paddingVertical: 18, borderRadius: 16, alignItems: 'center',
  },
  subscribeText: { fontSize: 18, fontWeight: '800', color: Colors.black },
  termsText: { fontSize: 12, textAlign: 'center', marginTop: 16 },
});
