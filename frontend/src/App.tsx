import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AnalyzeResult, Decision } from './types';

/* ─────────────────────────────────────────────────────────────────────────
   Mock data — used until the backend is wired up (or as a graceful
   fallback if /api/analyze isn't reachable). Mirrors the API contract.
   ───────────────────────────────────────────────────────────────────────── */

const MOCK_RESULT: AnalyzeResult = {
  decision: 'Yellow Card',
  decisionSubtitle: 'Rash Unsporting Challenge',
  reasoning:
    "Player #14 arrives late and makes contact on the opponent's lower leg with excessive force. This is a reckless challenge and warrants a yellow card.",
  timestamps: { start: '00:06.8', end: '00:09.2', label: 'Incident start to contact' },
  confidence: 0.82,
};

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────────── */

function apiUrl(path: string) {
  const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL?.trim();
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function fmtTime(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function confidencePct(c: number) {
  if (typeof c !== 'number' || Number.isNaN(c)) return 0;
  const v = c <= 1 ? c * 100 : c;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function decisionClass(d: Decision) {
  if (d === 'Red Card') return 'varify-decision-red';
  if (d === 'No Card') return 'varify-decision-green';
  return 'varify-decision-yellow';
}

const YT_RX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/;
function youTubeId(url: string): string | null {
  const m = url.match(YT_RX);
  return m ? m[1] : null;
}

function parseTimestamp(ts: string): number {
  if (!ts) return 0;
  const parts = ts.split(':').map((p) => p.trim());
  if (parts.length === 1) return parseFloat(parts[0]) || 0;
  if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0);
  }
  if (parts.length === 3) {
    return (
      (parseInt(parts[0], 10) || 0) * 3600 +
      (parseInt(parts[1], 10) || 0) * 60 +
      (parseFloat(parts[2]) || 0)
    );
  }
  return 0;
}

type DecisionVariant = 'yellow' | 'red' | 'green';

function decisionVariant(d: Decision): DecisionVariant {
  if (d === 'Red Card') return 'red';
  if (d === 'No Card') return 'green';
  return 'yellow';
}

interface FoulMarker {
  startTime: number;
  endTime: number;
  label?: string;
  displayStart?: string;
  variant?: DecisionVariant;
}

/* ─────────────────────────────────────────────────────────────────────────
   Backdrop — abstract tournament ribbons + stadium glows + grain
   ───────────────────────────────────────────────────────────────────────── */

function Backdrop() {
  return (
    <div className="varify-backdrop" aria-hidden>
      <div className="varify-glow varify-glow--top-left" />
      <div className="varify-glow varify-glow--top-right" />

      <svg
        className="varify-ribbons"
        viewBox="0 0 1500 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Red ribbon sweeping across the top */}
        <path
          d="M -120 80 C 280 -40, 620 220, 980 100 S 1640 60, 1700 200"
          stroke="#ef233c"
          strokeOpacity="0.22"
          strokeWidth="170"
          strokeLinecap="round"
          fill="none"
        />

        {/* Blue ribbon from top-right */}
        <path
          d="M 1620 -60 C 1380 220, 1120 60, 880 320 S 360 540, 60 360"
          stroke="#2563eb"
          strokeOpacity="0.20"
          strokeWidth="150"
          strokeLinecap="round"
          fill="none"
        />

        {/* Green ribbon along bottom-left */}
        <path
          d="M -160 980 C 220 760, 540 1080, 820 820 S 1300 920, 1620 760"
          stroke="#22c55e"
          strokeOpacity="0.18"
          strokeWidth="170"
          strokeLinecap="round"
          fill="none"
        />

        {/* Orange ribbon hugging bottom-right */}
        <path
          d="M 1640 1060 C 1320 880, 980 1100, 660 940 S 100 1140, -180 940"
          stroke="#f97316"
          strokeOpacity="0.18"
          strokeWidth="130"
          strokeLinecap="round"
          fill="none"
        />

        {/* Purple thin accent through the middle */}
        <path
          d="M -80 560 C 320 480, 700 660, 1080 500 S 1480 360, 1700 460"
          stroke="#8b5cf6"
          strokeOpacity="0.14"
          strokeWidth="80"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      <div className="varify-grain" />
      <div className="varify-vignette" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Hero
   ───────────────────────────────────────────────────────────────────────── */

function HeroHeader() {
  return (
    <header className="varify-hero">
      <span className="varify-eyebrow">
        <span className="varify-eyebrow-dot" />
        VARify · AI Referee Assistant
      </span>
      <h1 className="varify-headline">
        Upload a clip. <span className="varify-headline-accent">Get the call.</span>
      </h1>
      <p className="varify-sub">
        VARify analyzes soccer match footage and returns a decision with timestamps and reasoning.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Inline icons (kept minimal — spec says "no extra icons")
   ───────────────────────────────────────────────────────────────────────── */

function PlayIcon() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="currentColor" aria-hidden>
      <path d="M2 1.5L11 6.5L2 11.5V1.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden>
      <rect x="0" y="0" width="3" height="12" rx="0.5" />
      <rect x="7" y="0" width="3" height="12" rx="0.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Placeholder pitch (used when no video is available)
   ───────────────────────────────────────────────────────────────────────── */

function PitchPlaceholder() {
  return (
    <svg className="varify-pitch-svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="pitch-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0c2f23" />
          <stop offset="1" stopColor="#061b15" />
        </linearGradient>
        <pattern id="pitch-stripes" width="40" height="180" patternUnits="userSpaceOnUse">
          <rect width="20" height="180" fill="rgba(255,255,255,0.025)" />
        </pattern>
      </defs>
      <rect width="320" height="180" fill="url(#pitch-grad)" />
      <rect width="320" height="180" fill="url(#pitch-stripes)" />
      <rect x="0.5" y="0.5" width="319" height="179" fill="none" stroke="rgba(255,255,255,0.12)" />
      <line x1="160" y1="0" x2="160" y2="180" stroke="rgba(255,255,255,0.16)" />
      <circle cx="160" cy="90" r="22" fill="none" stroke="rgba(255,255,255,0.16)" />
      <circle cx="160" cy="90" r="1.5" fill="rgba(255,255,255,0.4)" />
      <rect x="0" y="55" width="32" height="70" fill="none" stroke="rgba(255,255,255,0.14)" />
      <rect x="288" y="55" width="32" height="70" fill="none" stroke="rgba(255,255,255,0.14)" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SimpleVideoPlayer — shared minimal player for Original + AI Review
   ───────────────────────────────────────────────────────────────────────── */

const SPEED_CYCLE = [1, 1.25, 1.5, 2];

function SimpleVideoPlayer({
  src,
  youtubeId,
  fallbackLabel,
  fallbackHint,
  marker,
}: {
  src?: string;
  youtubeId?: string | null;
  fallbackLabel: string;
  fallbackHint?: string;
  marker?: FoulMarker;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setCurrent(0);
    setDuration(0);
    setSpeedIdx(0);
  }, [src, youtubeId]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeedIdx((i) => {
      const next = (i + 1) % SPEED_CYCLE.length;
      if (videoRef.current) videoRef.current.playbackRate = SPEED_CYCLE[next];
      return next;
    });
  }, []);

  const seekFromEvent = useCallback(
    (clientX: number, target: HTMLDivElement) => {
      const v = videoRef.current;
      if (!v || !isFinite(duration) || duration <= 0) return;
      const rect = target.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      v.currentTime = pct * duration;
      setCurrent(v.currentTime);
    },
    [duration],
  );

  const seekToTime = useCallback((time: number) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Math.max(0, Math.min(time, isFinite(v.duration) ? v.duration : time));
    v.currentTime = t;
    setCurrent(t);
    if (v.paused) v.play().catch(() => {});
  }, []);

  const displayedDuration = duration > 0 ? duration : 12;
  const progressPct = displayedDuration > 0 ? (current / displayedDuration) * 100 : 0;
  const speed = SPEED_CYCLE[speedIdx];
  const speedLabel = `${speed.toFixed(speed % 1 === 0 ? 1 : 2)}x`;

  const markerActive = !!marker && !youtubeId;
  const markerStartPct =
    markerActive && displayedDuration > 0
      ? Math.max(0, Math.min(100, (marker!.startTime / displayedDuration) * 100))
      : null;
  const markerEndPct =
    markerActive && displayedDuration > 0
      ? Math.max(0, Math.min(100, (marker!.endTime / displayedDuration) * 100))
      : null;
  const markerWidth =
    markerStartPct !== null && markerEndPct !== null
      ? Math.max(0, markerEndPct - markerStartPct)
      : 0;
  const markerVariant = marker?.variant ?? 'yellow';
  const markerTooltip = marker
    ? `${marker.displayStart ?? fmtTime(marker.startTime)}${marker.label ? ` · ${marker.label}` : ''}`
    : '';

  return (
    <div>
      <div className="varify-player-stage">
        {youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
            title="Original clip"
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : src ? (
          <video
            ref={videoRef}
            src={src}
            preload="metadata"
            playsInline
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="varify-player-fallback">
            <PitchPlaceholder />
            <div className="varify-player-fallback-overlay">
              <span>{fallbackLabel}</span>
              {fallbackHint && <small>{fallbackHint}</small>}
            </div>
          </div>
        )}
      </div>

      <div className="varify-player-controls">
        <button
          type="button"
          className="varify-play-btn"
          onClick={togglePlay}
          disabled={!src || !!youtubeId}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <span className="varify-time">
          {fmtTime(current)} / {fmtTime(displayedDuration)}
        </span>
        <div className="varify-progress-wrap">
          <div
            className="varify-progress"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPct)}
            tabIndex={0}
            onClick={(e) => seekFromEvent(e.clientX, e.currentTarget)}
          >
            <div className="varify-progress-fill" style={{ width: `${progressPct}%` }} />
            {markerActive && markerStartPct !== null && markerWidth > 0 && (
              <div
                className={`varify-progress-band varify-progress-band--${markerVariant}`}
                style={{ left: `${markerStartPct}%`, width: `${markerWidth}%` }}
                aria-hidden
              />
            )}
          </div>
          {markerActive && markerStartPct !== null && (
            <button
              type="button"
              className={`varify-progress-marker varify-progress-marker--${markerVariant}`}
              style={{ left: `${markerStartPct}%` }}
              onClick={(e) => {
                e.stopPropagation();
                if (src) seekToTime(marker!.startTime);
              }}
              data-tooltip={markerTooltip}
              aria-label={`Jump to foul at ${marker!.displayStart ?? fmtTime(marker!.startTime)}`}
            />
          )}
        </div>
        <button type="button" className="varify-speed" onClick={cycleSpeed} disabled={!src}>
          {speedLabel}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   1) UploadPanel
   ───────────────────────────────────────────────────────────────────────── */

type UploadState = 'idle' | 'ready' | 'analyzing' | 'error';

function UploadPanel({
  fileName,
  youtubeUrl,
  onFileSelect,
  onUrlChange,
  onAnalyze,
  state,
  error,
}: {
  fileName: string | null;
  youtubeUrl: string;
  onFileSelect: (file: File | null) => void;
  onUrlChange: (url: string) => void;
  onAnalyze: () => void;
  state: UploadState;
  error: string | null;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelect(f);
  };

  const armed = state === 'ready' || (state === 'idle' && (fileName || youtubeUrl.trim()));
  const isAnalyzing = state === 'analyzing';

  return (
    <section className="varify-card varify-card--accent">
      <h2 className="varify-card-title">Upload or Paste a Link</h2>
      <div className="varify-upload">
        <div className="varify-upload-section">
          <span className="varify-label">Upload Video File</span>
          <div
            className={`varify-dropzone${dragging ? ' is-drag' : ''}${fileName ? ' is-ready' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const f = e.target.files?.[0];
                if (f) onFileSelect(f);
              }}
              aria-label="Upload video file"
            />
            <p className="varify-dropzone-text">
              {fileName ? (
                <>
                  <strong>{fileName}</strong>
                  <br />
                  Ready to analyze
                </>
              ) : (
                <>Drag and drop your video here</>
              )}
            </p>
            <button
              type="button"
              className="varify-choose-btn"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Choose File
            </button>
          </div>
        </div>

        <div className="varify-divider">Or</div>

        <div className="varify-upload-section">
          <span className="varify-label">Or paste a YouTube link</span>
          <input
            className="varify-url-input"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            spellCheck={false}
            autoCorrect="off"
          />
        </div>

        <button
          type="button"
          className={`varify-analyze-btn${isAnalyzing ? ' is-loading' : ''}`}
          onClick={onAnalyze}
          disabled={!armed || isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing…' : 'Analyze'}
        </button>

        {error && <div className="varify-error">{error}</div>}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   2) OriginalClipCard
   ───────────────────────────────────────────────────────────────────────── */

function OriginalClipCard({
  fileUrl,
  fileName,
  youtubeId,
  remoteUrl,
  compact = false,
}: {
  fileUrl: string | null;
  fileName: string | null;
  youtubeId: string | null;
  remoteUrl?: string;
  compact?: boolean;
}) {
  return (
    <section className={`varify-card${compact ? ' varify-card--compact varify-reveal' : ''}`}>
      <h2 className="varify-card-title">Original Clip</h2>
      <SimpleVideoPlayer
        src={fileUrl ?? remoteUrl ?? undefined}
        youtubeId={youtubeId}
        fallbackLabel={fileName ? `Loading ${fileName}…` : 'Upload a clip or paste a YouTube link'}
        fallbackHint="MP4 · MOV · AVI · WEBM"
      />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   3) AIReviewCard
   ───────────────────────────────────────────────────────────────────────── */

function AIReviewCard({
  src,
  decisionLabel,
  marker,
}: {
  src?: string;
  decisionLabel: string;
  marker?: FoulMarker;
}) {
  return (
    <section className="varify-card varify-reveal">
      <h2 className="varify-card-title">AI Review (Highlight)</h2>
      <SimpleVideoPlayer
        src={src}
        fallbackLabel="AI highlight ready"
        fallbackHint={decisionLabel}
        marker={marker}
      />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ConfidenceCard — replaces the Upload panel slot post-analysis
   ───────────────────────────────────────────────────────────────────────── */

function ConfidenceCard({ result }: { result: AnalyzeResult }) {
  const pct = confidencePct(result.confidence);
  const variant = decisionVariant(result.decision);
  const label =
    pct >= 75 ? 'High confidence' : pct >= 50 ? 'Moderate confidence' : 'Low confidence';

  return (
    <section
      className={`varify-card varify-card--accent varify-confidence-card varify-confidence-card--${variant} varify-reveal`}
    >
      <h2 className="varify-card-title">Decision Confidence</h2>
      <div className="varify-confidence-display">
        <div className="varify-confidence-number">
          <span className="varify-confidence-num-value">{pct}</span>
          <span className="varify-confidence-num-pct">%</span>
        </div>
        <span className="varify-confidence-label">{label}</span>
        <div className="varify-confidence-bar" aria-hidden>
          <div className="varify-confidence-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="varify-confidence-decision-tag">
          <span className="varify-confidence-eyebrow">For decision</span>
          <span className="varify-confidence-decision">{result.decision}</span>
          {result.decisionSubtitle && (
            <span className="varify-confidence-subtitle">{result.decisionSubtitle}</span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   4) ReviewSummaryCard
   ───────────────────────────────────────────────────────────────────────── */

function ReviewSummaryCard({ result }: { result: AnalyzeResult }) {
  return (
    <section className="varify-card varify-card--accent varify-reveal varify-reveal--delay">
      <h2 className="varify-card-title">Review Summary</h2>
      <div className="varify-summary">
        <div className="varify-summary-row">
          <span className="varify-summary-label">Decision</span>
          <span className={`varify-summary-value ${decisionClass(result.decision)}`}>
            {result.decision}
          </span>
          {result.decisionSubtitle && (
            <span className="varify-summary-subtitle">{result.decisionSubtitle}</span>
          )}
        </div>

        <div className="varify-summary-row">
          <span className="varify-summary-label">Reasoning</span>
          <p className="varify-summary-body">{result.reasoning}</p>
        </div>

        <div className="varify-summary-row">
          <span className="varify-summary-label">Timestamps</span>
          <span className="varify-summary-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {result.timestamps.start} – {result.timestamps.end}
          </span>
          {result.timestamps.label && (
            <span className="varify-summary-subtitle">{result.timestamps.label}</span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   App
   ───────────────────────────────────────────────────────────────────────── */

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  // Manage object URL lifecycle for the uploaded file
  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const ytId = useMemo(() => youTubeId(youtubeUrl.trim()), [youtubeUrl]);

  const handleFileSelect = useCallback((f: File | null) => {
    setFile(f);
    setYoutubeUrl('');
    setResult(null);
    setError(null);
    setState(f ? 'ready' : 'idle');
  }, []);

  const handleUrlChange = useCallback((url: string) => {
    setYoutubeUrl(url);
    if (url.trim()) {
      setFile(null);
      setResult(null);
      setError(null);
      setState('ready');
    } else if (!file) {
      setState('idle');
    }
  }, [file]);

  const handleAnalyze = useCallback(async () => {
    if (!file && !youtubeUrl.trim()) {
      setError('Upload a video or paste a YouTube link first.');
      setState('error');
      return;
    }

    setState('analyzing');
    setError(null);
    setResult(null);

    try {
      let response: Response;
      if (file) {
        const form = new FormData();
        form.append('videoFile', file);
        response = await fetch(apiUrl('/api/analyze'), { method: 'POST', body: form });
      } else {
        response = await fetch(apiUrl('/api/analyze'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeUrl: youtubeUrl.trim() }),
        });
      }

      if (!response.ok) {
        throw new Error(`Backend responded ${response.status}`);
      }
      const data = (await response.json()) as AnalyzeResult;
      // Brief hold so the analyzing state is perceivable on fast networks.
      await new Promise((r) => setTimeout(r, 600));
      setResult(data);
      setState('ready');
    } catch (e) {
      // Backend not wired up yet (or unreachable) — fall back to demo data
      // so the UI flow can still be reviewed.
      await new Promise((r) => setTimeout(r, 900));
      setResult(MOCK_RESULT);
      setState('ready');
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[VARify] /api/analyze unavailable — showing demo result.', message);
    }
  }, [file, youtubeUrl]);

  const fileName = file?.name ?? null;

  return (
    <div className="varify-app">
      <Backdrop />

      <main className="varify-shell">
        <HeroHeader />

        <div className="varify-grid">
          {result ? (
            <div className="varify-left">
              <ConfidenceCard result={result} />
              <UploadPanel
                fileName={fileName}
                youtubeUrl={youtubeUrl}
                onFileSelect={handleFileSelect}
                onUrlChange={handleUrlChange}
                onAnalyze={handleAnalyze}
                state={state}
                error={error}
              />
            </div>
          ) : (
            <UploadPanel
              fileName={fileName}
              youtubeUrl={youtubeUrl}
              onFileSelect={handleFileSelect}
              onUrlChange={handleUrlChange}
              onAnalyze={handleAnalyze}
              state={state}
              error={error}
            />
          )}

          <div className="varify-right">
            {result ? (
              <>
                <AIReviewCard
                  src={result.aiReviewVideoUrl ?? fileUrl ?? undefined}
                  decisionLabel={`${result.decision} · ${result.decisionSubtitle}`}
                  marker={{
                    startTime: parseTimestamp(result.timestamps.start),
                    endTime: parseTimestamp(result.timestamps.end),
                    label: result.timestamps.label,
                    displayStart: result.timestamps.start,
                    variant: decisionVariant(result.decision),
                  }}
                />
                <div className="varify-results-grid">
                  <OriginalClipCard
                    fileUrl={fileUrl}
                    fileName={fileName}
                    youtubeId={ytId}
                    remoteUrl={result.originalClipUrl}
                    compact
                  />
                  <ReviewSummaryCard result={result} />
                </div>
              </>
            ) : (
              <OriginalClipCard
                fileUrl={fileUrl}
                fileName={fileName}
                youtubeId={ytId}
              />
            )}
          </div>
        </div>

        <footer className="varify-footer">
          Upload clip · Analyze · AI review + referee summary
        </footer>
      </main>
    </div>
  );
}
