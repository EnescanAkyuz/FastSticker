/**
 * In-memory ring-buffer logger.
 *
 * Stores the last MAX_ENTRIES entries so they can be read on-screen
 * via LogOverlay even after a partial crash wipes the console.
 *
 * Usage:
 *   import { log } from '../utils/logger';
 *   log.info('TAG', 'message', optionalData);
 *   log.error('TAG', 'message', error);
 */

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
  id: number;
  ts: string;       // HH:MM:SS.mmm
  level: LogLevel;
  tag: string;
  message: string;
  extra?: string;   // JSON-stringified extra data / error stack
}

const MAX_ENTRIES = 300;
let _seq = 0;
const _buffer: LogEntry[] = [];
const _listeners: Array<(entries: LogEntry[]) => void> = [];

function _ts() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function _extraString(extra: unknown): string | undefined {
  if (extra === undefined || extra === null) return undefined;
  if (extra instanceof Error) {
    return `${extra.message}\n${extra.stack ?? ''}`;
  }
  try {
    return JSON.stringify(extra, null, 2);
  } catch {
    return String(extra);
  }
}

function _push(level: LogLevel, tag: string, message: string, extra?: unknown) {
  const entry: LogEntry = {
    id: ++_seq,
    ts: _ts(),
    level,
    tag,
    message,
    extra: _extraString(extra),
  };

  if (_buffer.length >= MAX_ENTRIES) {
    _buffer.shift();
  }
  _buffer.push(entry);

  // Mirror to native console
  const formatted = `[${entry.ts}][${level}][${tag}] ${message}${entry.extra ? '\n' + entry.extra : ''}`;
  if (level === 'ERROR' || level === 'FATAL') {
    console.error(formatted);
  } else if (level === 'WARN') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }

  // Notify subscribers (LogOverlay)
  for (const cb of _listeners) {
    try { cb([..._buffer]); } catch { /* ignore */ }
  }
}

export const log = {
  trace: (tag: string, message: string, extra?: unknown) => _push('TRACE', tag, message, extra),
  debug: (tag: string, message: string, extra?: unknown) => _push('DEBUG', tag, message, extra),
  info:  (tag: string, message: string, extra?: unknown) => _push('INFO',  tag, message, extra),
  warn:  (tag: string, message: string, extra?: unknown) => _push('WARN',  tag, message, extra),
  error: (tag: string, message: string, extra?: unknown) => _push('ERROR', tag, message, extra),
  fatal: (tag: string, message: string, extra?: unknown) => _push('FATAL', tag, message, extra),

  /** Subscribe to buffer updates. Returns unsubscribe fn. */
  subscribe(cb: (entries: LogEntry[]) => void): () => void {
    _listeners.push(cb);
    cb([..._buffer]); // immediate snapshot
    return () => {
      const idx = _listeners.indexOf(cb);
      if (idx !== -1) _listeners.splice(idx, 1);
    };
  },

  /** Return current snapshot of all entries. */
  snapshot(): LogEntry[] {
    return [..._buffer];
  },

  /** Return all entries as a plain text string (for clipboard copy). */
  dump(): string {
    return _buffer
      .map(e => `[${e.ts}][${e.level}][${e.tag}] ${e.message}${e.extra ? '\n  ' + e.extra.replace(/\n/g, '\n  ') : ''}`)
      .join('\n');
  },

  clear() {
    _buffer.length = 0;
    for (const cb of _listeners) {
      try { cb([]); } catch { /* ignore */ }
    }
  },
};
