import React, { useEffect, useRef, useState } from 'react';

type KeystrokeEventType = 'down' | 'up';

interface KeystrokeSample {
  t: number; 
  dt: number | null; 
  kind: KeystrokeEventType;
  isCharKey: boolean; 
}

interface PasteSample {
  t: number;
  length: number;
}

interface SessionRecord {
  id: string;
  createdAt: string;
  content: string;
  keystrokes: KeystrokeSample[];
  pastes: PasteSample[];
  userId: string | null;
}

const SESSIONS_KEY = 'viNotesSessions';

const loadSessions = (): SessionRecord[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  } catch {
    return [];
  }
};

const persistSessions = (sessions: SessionRecord[]) => {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
};

export const App: React.FC = () => {
  const [content, setContent] = useState('');
  const [keystrokes, setKeystrokes] = useState<KeystrokeSample[]>([]);
  const [pastes, setPastes] = useState<PasteSample[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const lastEventTimeRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const recordKeystroke = (
    kind: KeystrokeEventType,
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const nowPerf = performance.now();
    const last = lastEventTimeRef.current;
    const dt = last == null ? null : nowPerf - last;

    
    const isCharKey =
      event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    const sample: KeystrokeSample = {
      t: Date.now(),
      dt,
      kind,
      isCharKey,
    };

    lastEventTimeRef.current = nowPerf;
    setKeystrokes((prev) => [...prev, sample]);
  };

  const handleCopy = async () => {
    if (!content.trim()) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
        textareaRef.current.setSelectionRange(content.length, content.length);
      }
    } catch {
      
    }
  };

  const handleSave = () => {
    if (!content.trim()) return;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const now = new Date();
    const stamp = now
      .toISOString()
      .replace(/[:]/g, '')
      .replace(/[-]/g, '')
      .slice(0, 15);

    link.href = url;
    link.download = `vi-notes-session-${stamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lastSample = keystrokes[keystrokes.length - 1] ?? null;
  const totalPastedChars = pastes.reduce((sum, sample) => sum + sample.length, 0);

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text/plain') ?? '';

    setPastes((prev) => [
      ...prev,
      {
        t: Date.now(),
        length: text.length,
      },
    ]);

    
  };

  const handleSaveSession = () => {
    if (!content.trim() && keystrokes.length === 0 && pastes.length === 0) return;

    const now = new Date();
    const id = `session-${now.getTime()}`;

    const record: SessionRecord = {
      id,
      createdAt: now.toISOString(),
      content,
      keystrokes,
      pastes,
      
      userId: 'local-user',
    };

    const updated = [...sessions, record];
    setSessions(updated);
    persistSessions(updated);
    setSelectedSessionId(record.id);
  };

  const handleLoadSession = (id: string) => {
    const found = sessions.find((s) => s.id === id);
    if (!found) return;

    setSelectedSessionId(id);
    setContent(found.content);
    setKeystrokes(found.keystrokes);
    setPastes(found.pastes);
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true" />
          <div className="brand-text">
            <h1 className="app-title">Vi-Notes</h1>
            <p className="app-subtitle">Keystroke-aware writing editor</p>
          </div>
        </div>
        <p className="app-tagline">
          We record timing between key presses and releases, never the characters
          themselves.
        </p>
      </header>

      <main className="editor-shell">
        <section className="editor-panel" aria-label="Writing editor">
          <header className="editor-header">
            <div>
              <h2 className="editor-title">Current draft</h2>
              <p className="editor-description">
                Type as you normally would. Timing samples are captured in the
                background to study writing behaviour later.
              </p>
            </div>
            <div className="editor-stats">
              <span className="editor-pill">
                Events: {keystrokes.length}
              </span>
              {lastSample && lastSample.dt != null && (
                <span className="editor-pill editor-pill-muted">
                  Δt: {lastSample.dt.toFixed(0)} ms
                </span>
              )}
              {pastes.length > 0 && (
                <span className="editor-pill editor-pill-muted">
                  Pastes: {pastes.length} · {totalPastedChars} chars
                </span>
              )}
              {sessions.length > 0 && (
                <span className="editor-pill editor-pill-muted">
                  Sessions saved: {sessions.length}
                </span>
              )}
            </div>
          </header>

          <div className="editor-actions">
            <button
              type="button"
              className="editor-button editor-button-secondary"
              onClick={handleCopy}
            >
              Copy text
            </button>
            <button
              type="button"
              className="editor-button editor-button-primary"
              onClick={handleSave}
            >
              Save as file
            </button>
            <button
              type="button"
              className="editor-button editor-button-secondary"
              onClick={handleSaveSession}
            >
              Save session
            </button>
          </div>

          <textarea
            className="editor-input"
            ref={textareaRef}
            spellCheck
            autoFocus
            placeholder="Start writing your content here..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => recordKeystroke('down', event)}
            onKeyUp={(event) => recordKeystroke('up', event)}
            onPaste={handlePaste}
          />
        </section>
        {sessions.length > 0 && (
          <aside className="sessions-panel" aria-label="Saved sessions">
            <h3 className="sessions-title">Sessions</h3>
            <ul className="sessions-list">
              {sessions
                .slice()
                .reverse()
                .map((session) => {
                  const isActive = session.id === selectedSessionId;
                  const created = new Date(session.createdAt);
                  const label = created.toLocaleString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: 'short',
                  });

                  const preview = session.content.trim().slice(0, 40) || 'Empty session';

                  return (
                    <li key={session.id}>
                      <button
                        type="button"
                        className={
                          'session-item' + (isActive ? ' session-item-active' : '')
                        }
                        onClick={() => handleLoadSession(session.id)}
                      >
                        <span className="session-label">{label}</span>
                        <span className="session-preview">{preview}</span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </aside>
        )}
      </main>
    </div>
  );
};
