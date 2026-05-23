import {
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AnalyzeResult, Decision } from './types';

/* ─────────────────────────────────────────────────────────────────────────
   Mock data — used only when the backend is genuinely unreachable, so the
   UI flow can still be reviewed in isolation.
   ───────────────────────────────────────────────────────────────────────── */

const MOCK_RESULT: AnalyzeResult = {
  decision: 'Yellow Card',
  decisionSubtitle: 'Rash Unsporting Challenge',
  reasoning:
    "Player #14 arrives late and makes contact on the opponent's lower leg with excessive force. This is a reckless challenge and warrants a yellow card.",
  timestamps: { start: '00:06.8', end: '00:09.2', label: 'Incident start to contact' },
  confidence: 0.82,
};

const MAX_ANGLES = 3;
const ACCEPTED_VIDEO = 'video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm';

// Pull the foul marker back from the actual contact moment so playback
// lands with a brief lead-in instead of starting right on top of the action.
const FOUL_LEAD_IN_SECONDS = 0.5;

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

interface AngleEntry {
  id: string;
  file: File;
  url: string;
}

function camLabel(index: number) {
  return `CAM ${String(index + 1).padStart(2, '0')}`;
}

function fileKey(f: File) {
  return `${f.name}::${f.size}::${f.lastModified}`;
}

let _angleSeqId = 0;
function nextAngleId() {
  _angleSeqId += 1;
  return `angle-${_angleSeqId}`;
}

interface MarkerAngle {
  key: string;
  label: string;
}

interface FoulMarker {
  startTime: number;
  endTime: number;
  label?: string;
  displayStart?: string;
  variant?: DecisionVariant;
  angles?: MarkerAngle[];
  activeAngleIndex?: number;
  onSelectAngle?: (index: number) => void;
}

/* ─────────────────────────────────────────────────────────────────────────
   Backend response normalizer

   The backend (Spring `AnalysisController`) returns `RefereeDecisionResponse`
   whose field names and value shapes don't match this UI's `AnalyzeResult`.
   Adapt here rather than reshape the API.
   ───────────────────────────────────────────────────────────────────────── */

function mapDecision(value: unknown): Decision {
  if (typeof value !== 'string') return 'No Card';
  const u = value.replace(/[\s_]+/g, '').toUpperCase();
  if (u.startsWith('RED')) return 'Red Card';
  if (u.startsWith('YELLOW')) return 'Yellow Card';
  if (u.startsWith('NO') || u === 'NONE') return 'No Card';
  return 'No Card';
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function parseKeyTimestamp(raw: unknown, fallback: unknown): AnalyzeResult['timestamps'] {
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim();
    if (trimmed.includes('-')) {
      const [startRaw, endRaw] = trimmed.split('-').map((s) => s.trim());
      const start = startRaw || '00:00';
      const end = endRaw || start;
      return { start, end, label: 'Incident start to contact' };
    }
    return { start: trimmed, end: trimmed, label: 'Key moment' };
  }
  if (Array.isArray(fallback) && fallback.length > 0) {
    const start = String(fallback[0]);
    const end = String(fallback[fallback.length - 1] ?? start);
    return {
      start,
      end,
      label: fallback.length > 1 ? 'Incident start to contact' : 'Key moment',
    };
  }
  return { start: '00:00', end: '00:00', label: '' };
}

function normalizeBackendResponse(raw: any): AnalyzeResult {
  const explanation =
    typeof raw?.explanation === 'string' && raw.explanation.trim()
      ? raw.explanation
      : typeof raw?.geminiSummary === 'string'
        ? raw.geminiSummary
        : '';
  const subtitle =
    typeof raw?.ruleCategory === 'string' && raw.ruleCategory.trim()
      ? toTitleCase(raw.ruleCategory.trim())
      : '';
  return {
    decision: mapDecision(raw?.decision),
    decisionSubtitle: subtitle,
    reasoning: explanation,
    timestamps: parseKeyTimestamp(raw?.keyTimestamp, raw?.keyTimestamps),
    confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Backdrop — abstract tournament ribbons + stadium glows + grain
   ───────────────────────────────────────────────────────────────────────── */

function Backdrop() {
  return <div className="varify-backdrop" aria-hidden />;
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
   Inline icons
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
   Placeholder pitch (when no video is available)
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
   SimpleVideoPlayer — shared minimal player. Supports an optional marker
   (single circle or cluster of N circles per camera angle).
   When marker is set, every new src auto-seeks to marker.startTime + plays,
   so switching angles via circles lands on the foul moment instantly.
   ───────────────────────────────────────────────────────────────────────── */

const SPEED_CYCLE = [1, 1.25, 1.5, 2];

function SimpleVideoPlayer({
  src,
  fallbackLabel,
  fallbackHint,
  marker,
}: {
  src?: string;
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
  }, [src]);

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

  const markerActive = !!marker && !!src;
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
  const markerAngles = marker?.angles ?? [];
  const isMulti = markerAngles.length > 1;
  const activeAngleIndex = marker?.activeAngleIndex ?? 0;

  // List of circles to render. If no per-angle data was passed, render a
  // single circle (preserves the single-clip UX). Otherwise render one
  // circle per angle, all anchored to the foul moment.
  const circles =
    markerActive
      ? markerAngles.length > 0
        ? markerAngles
        : [{ key: 'solo', label: 'Foul' }]
      : [];

  return (
    <div>
      <div className="varify-player-stage">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            preload="metadata"
            playsInline
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setDuration(v.duration || 0);
              // Auto-seek + play whenever a marker'd source loads (initial
              // appearance or angle switch). Falls back silently if the
              // browser blocks autoplay before any user gesture.
              if (marker) {
                const t = Math.max(0, Math.min(marker.startTime, v.duration || marker.startTime));
                v.currentTime = t;
                setCurrent(t);
                v.play().catch(() => {});
              }
            }}
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
          disabled={!src}
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
            <div
              className="varify-progress-cluster"
              style={{ left: `${markerStartPct}%` }}
            >
              {circles.map((angle, i) => {
                const active = isMulti && i === activeAngleIndex;
                const tooltipBase = marker!.displayStart ?? fmtTime(marker!.startTime);
                const tooltip = isMulti
                  ? `${angle.label} · ${tooltipBase}`
                  : `${tooltipBase}${marker!.label ? ` · ${marker!.label}` : ''}`;
                return (
                  <button
                    key={angle.key}
                    type="button"
                    className={`varify-progress-marker varify-progress-marker--${markerVariant}${active ? ' is-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMulti && i !== activeAngleIndex) {
                        marker!.onSelectAngle?.(i);
                      } else if (src) {
                        seekToTime(marker!.startTime);
                      }
                    }}
                    data-tooltip={tooltip}
                    aria-label={
                      isMulti
                        ? `Show ${angle.label} at ${tooltipBase}`
                        : `Jump to foul at ${tooltipBase}`
                    }
                  >
                    {isMulti ? i + 1 : null}
                  </button>
                );
              })}
            </div>
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
   1) UploadPanel — multi-angle dropzone (up to MAX_ANGLES)
   ───────────────────────────────────────────────────────────────────────── */

type UploadState = 'idle' | 'ready' | 'analyzing' | 'error';

function UploadPanel({
  angles,
  onFilesSelect,
  onRemoveAngle,
  onAnalyze,
  state,
  error,
}: {
  angles: AngleEntry[];
  onFilesSelect: (files: FileList | null) => void;
  onRemoveAngle: (id: string) => void;
  onAnalyze: () => void;
  state: UploadState;
  error: string | null;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const atCapacity = angles.length >= MAX_ANGLES;
  const isAnalyzing = state === 'analyzing';
  const armed = angles.length > 0 && !isAnalyzing;

  return (
    <section className="varify-card varify-card--accent">
      <div className="varify-card-title-row">
        <h2 className="varify-card-title">Upload Angles</h2>
        <span className="varify-count-pill">
          {angles.length}/{MAX_ANGLES}
        </span>
      </div>
      <div className="varify-upload">
        <div className="varify-upload-section">
          <span className="varify-label">
            Add up to {MAX_ANGLES} angles of the same incident
          </span>
          <div
            className={`varify-dropzone${dragging ? ' is-drag' : ''}${atCapacity ? ' is-ready' : ''}`}
            onDragOver={(e) => {
              if (atCapacity || isAnalyzing) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              if (atCapacity || isAnalyzing) return;
              e.preventDefault();
              setDragging(false);
              onFilesSelect(e.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_VIDEO}
              multiple
              disabled={atCapacity || isAnalyzing}
              onChange={(e) => {
                onFilesSelect(e.target.files);
                e.target.value = '';
              }}
              aria-label="Upload video files"
            />
            <p className="varify-dropzone-text">
              {atCapacity ? (
                <>
                  <strong>Maximum {MAX_ANGLES} angles cued</strong>
                  <br />
                  Remove one to add a different angle
                </>
              ) : angles.length === 0 ? (
                <>Drag and drop your videos here</>
              ) : (
                <>
                  <strong>{angles.length} angle{angles.length === 1 ? '' : 's'} cued</strong>
                  <br />
                  Add another or analyze
                </>
              )}
            </p>
            <button
              type="button"
              className="varify-choose-btn"
              disabled={atCapacity || isAnalyzing}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              {angles.length === 0 ? 'Choose Files' : 'Add Angle'}
            </button>
          </div>

          {angles.length > 0 && (
            <ul className="varify-angle-chips" aria-label="Queued angles">
              {angles.map((a, i) => (
                <li key={a.id} className="varify-angle-chip">
                  <span className="varify-angle-chip-num">{camLabel(i)}</span>
                  <span className="varify-angle-chip-name" title={a.file.name}>
                    {a.file.name}
                  </span>
                  <span className="varify-angle-chip-size">
                    {(a.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    className="varify-angle-chip-remove"
                    onClick={() => onRemoveAngle(a.id)}
                    aria-label={`Remove ${camLabel(i)}`}
                    disabled={isAnalyzing}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className={`varify-analyze-btn${isAnalyzing ? ' is-loading' : ''}`}
          onClick={onAnalyze}
          disabled={!armed}
        >
          {isAnalyzing ? 'Analyzing…' : 'Analyze'}
        </button>

        {error && <div className="varify-error">{error}</div>}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Cam tabs — segmented switcher above a video when there are multiple angles
   ───────────────────────────────────────────────────────────────────────── */

function CamTabs({
  count,
  activeIndex,
  onSelect,
}: {
  count: number;
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  if (count <= 1) return null;
  return (
    <div className="varify-cam-tabs" role="tablist" aria-label="Switch camera angle">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === activeIndex}
          className={`varify-cam-tab${i === activeIndex ? ' is-active' : ''}`}
          onClick={() => onSelect(i)}
        >
          {camLabel(i)}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   2) OriginalClipCard
   ───────────────────────────────────────────────────────────────────────── */

function OriginalClipCard({
  angles,
  activeIndex,
  onSelectAngle,
  remoteUrl,
  compact = false,
}: {
  angles: AngleEntry[];
  activeIndex: number;
  onSelectAngle: (i: number) => void;
  remoteUrl?: string;
  compact?: boolean;
}) {
  const active = angles[activeIndex];
  const src = active?.url ?? remoteUrl;
  const fallbackLabel =
    angles.length > 0 ? `Loading ${camLabel(activeIndex)}…` : `Upload up to ${MAX_ANGLES} angles to analyze`;

  return (
    <section className={`varify-card${compact ? ' varify-card--compact varify-reveal' : ''}`}>
      <div className="varify-card-title-row">
        <h2 className="varify-card-title">Original Clip</h2>
        <CamTabs count={angles.length} activeIndex={activeIndex} onSelect={onSelectAngle} />
      </div>
      <SimpleVideoPlayer
        src={src}
        fallbackLabel={fallbackLabel}
        fallbackHint="MP4 · MOV · AVI · WEBM"
      />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   3) AIReviewCard — big screen with multi-angle circle cluster on timeline
   ───────────────────────────────────────────────────────────────────────── */

function AIReviewCard({
  angles,
  activeIndex,
  onSelectAngle,
  decisionLabel,
  marker,
  remoteUrl,
}: {
  angles: AngleEntry[];
  activeIndex: number;
  onSelectAngle: (i: number) => void;
  decisionLabel: string;
  marker: Omit<FoulMarker, 'angles' | 'activeAngleIndex' | 'onSelectAngle'>;
  remoteUrl?: string;
}) {
  const active = angles[activeIndex];
  const src = remoteUrl ?? active?.url;

  return (
    <section className="varify-card varify-reveal">
      <div className="varify-card-title-row">
        <h2 className="varify-card-title">AI Review (Highlight)</h2>
        {angles.length > 1 && (
          <span className="varify-card-eyebrow">
            Viewing {camLabel(activeIndex)} · click a circle to switch angle
          </span>
        )}
      </div>
      <SimpleVideoPlayer
        src={src}
        fallbackLabel="AI highlight ready"
        fallbackHint={decisionLabel}
        marker={{
          ...marker,
          angles: angles.map((a, i) => ({ key: a.id, label: camLabel(i) })),
          activeAngleIndex: activeIndex,
          onSelectAngle,
        }}
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
   4) ReviewSummaryCard (Confidence moved out — see ConfidenceCard)
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
  const [angles, setAngles] = useState<AngleEntry[]>([]);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [originalActiveIndex, setOriginalActiveIndex] = useState(0);
  const [reviewActiveIndex, setReviewActiveIndex] = useState(0);

  // Clamp active indices when the angles list shrinks.
  useEffect(() => {
    const max = Math.max(0, angles.length - 1);
    setOriginalActiveIndex((i) => Math.min(i, max));
    setReviewActiveIndex((i) => Math.min(i, max));
  }, [angles.length]);

  const handleFilesSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAngles((current) => {
      const remaining = MAX_ANGLES - current.length;
      if (remaining <= 0) return current;
      const seen = new Set(current.map((a) => fileKey(a.file)));
      const additions: AngleEntry[] = [];
      for (const file of Array.from(files)) {
        if (additions.length >= remaining) break;
        const key = fileKey(file);
        if (seen.has(key)) continue;
        seen.add(key);
        additions.push({
          id: nextAngleId(),
          file,
          url: URL.createObjectURL(file),
        });
      }
      return additions.length > 0 ? [...current, ...additions] : current;
    });
    setResult(null);
    setError(null);
    setState((s) => (s === 'error' ? 'idle' : s));
  }, []);

  const handleRemoveAngle = useCallback((id: string) => {
    setAngles((current) => {
      const removed = current.find((a) => a.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((a) => a.id !== id);
    });
    setResult(null);
    setError(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (angles.length === 0) {
      setError('Upload at least one video angle first.');
      setState('error');
      return;
    }

    setState('analyzing');
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      angles.forEach((a) => form.append('video', a.file));
      const response = await fetch(apiUrl('/api/analyze'), { method: 'POST', body: form });

      if (!response.ok) {
        let detail = `Backend responded ${response.status}`;
        try {
          const ct = response.headers.get('content-type') ?? '';
          if (ct.includes('application/json')) {
            const j: any = await response.json();
            if (typeof j?.message === 'string' && j.message.trim()) detail = j.message;
            else detail = JSON.stringify(j);
          } else {
            const txt = await response.text();
            if (txt.trim()) detail = txt;
          }
        } catch {
          /* keep status-line fallback */
        }
        throw new Error(detail);
      }

      const raw = await response.json();
      setResult(normalizeBackendResponse(raw));
      setState('ready');
      setOriginalActiveIndex(0);
      setReviewActiveIndex(0);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isNetworkFailure =
        e instanceof TypeError && /failed to fetch|network|load failed/i.test(message);

      if (isNetworkFailure) {
        await new Promise((r) => setTimeout(r, 600));
        setError(
          'Backend not reachable on /api/analyze. Showing a demo response so the UI flow can be reviewed — start the backend on port 8080 for real analysis.',
        );
        setResult(MOCK_RESULT);
        setState('ready');
        setOriginalActiveIndex(0);
        setReviewActiveIndex(0);
      } else {
        setError(message);
        setState('error');
      }
    }
  }, [angles]);

  const uploadPanel = (
    <UploadPanel
      angles={angles}
      onFilesSelect={handleFilesSelect}
      onRemoveAngle={handleRemoveAngle}
      onAnalyze={handleAnalyze}
      state={state}
      error={error}
    />
  );

  return (
    <div className="varify-app">
      <Backdrop />

      <main className="varify-shell">
        <HeroHeader />

        <div className="varify-grid">
          {result ? (
            <div className="varify-left">
              <ConfidenceCard result={result} />
              {uploadPanel}
            </div>
          ) : (
            uploadPanel
          )}

          <div className="varify-right">
            {result ? (
              <>
                <AIReviewCard
                  angles={angles}
                  activeIndex={reviewActiveIndex}
                  onSelectAngle={setReviewActiveIndex}
                  decisionLabel={`${result.decision} · ${result.decisionSubtitle}`}
                  remoteUrl={result.aiReviewVideoUrl}
                  marker={(() => {
                    const rawStart = parseTimestamp(result.timestamps.start);
                    const rawEnd = parseTimestamp(result.timestamps.end);
                    const startTime = Math.max(0, rawStart - FOUL_LEAD_IN_SECONDS);
                    const endTime = Math.max(startTime, rawEnd - FOUL_LEAD_IN_SECONDS);
                    return {
                      startTime,
                      endTime,
                      label: result.timestamps.label,
                      displayStart: result.timestamps.start,
                      variant: decisionVariant(result.decision),
                    };
                  })()}
                />
                <div className="varify-results-grid">
                  <OriginalClipCard
                    angles={angles}
                    activeIndex={originalActiveIndex}
                    onSelectAngle={setOriginalActiveIndex}
                    remoteUrl={result.originalClipUrl}
                    compact
                  />
                  <ReviewSummaryCard result={result} />
                </div>
              </>
            ) : (
              <OriginalClipCard
                angles={angles}
                activeIndex={originalActiveIndex}
                onSelectAngle={setOriginalActiveIndex}
              />
            )}
          </div>
        </div>

        <footer className="varify-footer">
          Upload up to {MAX_ANGLES} angles · Analyze · AI review + referee summary
        </footer>
      </main>
    </div>
  );
}
