/**
 * LogOverlay
 *
 * A floating "LOG" button that opens a full-screen log viewer.
 * Visible in __DEV__ mode only — production builds render nothing.
 *
 * Tap the pill button  →  open panel
 * "Copy"               →  copy all logs to clipboard
 * "Clear"              →  wipe the buffer
 * "×"                  →  close panel
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Clipboard,
  Alert,
  Platform,
} from 'react-native';
import { log, LogEntry, LogLevel } from './logger';

const LEVEL_COLOR: Record<LogLevel, string> = {
  TRACE: '#888',
  DEBUG: '#aaa',
  INFO:  '#4fc3f7',
  WARN:  '#ffb74d',
  ERROR: '#ef5350',
  FATAL: '#b71c1c',
};

const EntryRow = React.memo(({ item }: { item: LogEntry }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLevel, { color: LEVEL_COLOR[item.level] }]}>
      {item.ts} {item.level.padEnd(5)}
    </Text>
    <Text style={styles.rowTag}>[{item.tag}]</Text>
    <Text style={styles.rowMsg}>{item.message}</Text>
    {item.extra ? (
      <Text style={styles.rowExtra}>{item.extra}</Text>
    ) : null}
  </View>
));

export const LogOverlay: React.FC = () => {
  if (!__DEV__) return null;

  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const unsub = log.subscribe((all) => setEntries(all));
    return unsub;
  }, []);

  // Auto-scroll to bottom when new entries arrive while panel is open
  useEffect(() => {
    if (visible && entries.length > 0) {
      // Small timeout so FlatList has rendered the new item
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [entries, visible]);

  const handleCopy = useCallback(() => {
    const text = log.dump();
    Clipboard.setString(text);
    Alert.alert('Kopyalandı', `${entries.length} log satırı panoya kopyalandı.`);
  }, [entries.length]);

  const handleClear = useCallback(() => {
    log.clear();
  }, []);

  return (
    <>
      {/* Floating pill button */}
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.pillText}>LOG {entries.length}</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.panel}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Log ({entries.length} entries)</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerBtn} onPress={handleCopy}>
                <Text style={styles.headerBtnText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerBtn, styles.clearBtn]} onPress={handleClear}>
                <Text style={styles.headerBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerBtn, styles.closeBtn]} onPress={() => setVisible(false)}>
                <Text style={styles.headerBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            ref={listRef}
            data={entries}
            keyExtractor={(e) => String(e.id)}
            renderItem={({ item }) => <EntryRow item={item} />}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            initialNumToRender={40}
            maxToRenderPerBatch={40}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 16 : 32,
    right: 12,
    backgroundColor: '#1a237e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 9999,
    elevation: 10,
    opacity: 0.85,
  },
  pillText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    fontWeight: 'bold',
  },
  panel: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    paddingTop: Platform.OS === 'android' ? 28 : 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  headerBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  clearBtn: { backgroundColor: '#6d1f00' },
  closeBtn: { backgroundColor: '#444' },
  headerBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingBottom: 24 },
  row: {
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  rowLevel: {
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  rowTag: {
    color: '#b39ddb',
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  rowMsg: {
    color: '#e0e0e0',
    fontSize: 11,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  rowExtra: {
    color: '#ef9a9a',
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginLeft: 8,
    marginBottom: 2,
  },
});
