import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Clapperboard,
  Plus,
  RefreshCw,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import {
  AngleEntry,
  DecisionType,
  EvidenceMoment,
  RuleCategoryType,
  VARifyResult,
} from './types';

/* ─────────────────────────────────────────────────────────────────────────
   Reference incidents — used both as preset rows and as graceful fallbacks
   when the backend is offline / unconfigured. They mirror the real API
   contract so the same components render either path.
   ───────────────────────────────────────────────────────────────────────── */

type Preset = {
  id: string;
  title: string;
  subtitle: string;
  source: string;
  cams: string[];
  result: VARifyResult;
};

const PRESETS: Preset[] = [
  {
    id: 'late-tackle',
    title: 'Late sliding tackle',
    subtitle: 'Reckless, no play on ball',
    source: 'Premier League · MD27',
    cams: ['Broadcast', 'Behind goal', 'Reverse low'],
    result: {
      decision: 'YELLOW_CARD',
      confidence: 82,
      keyTimestamp: '00:07-00:09',
      keyTimestamps: ['00:07', '00:08', '00:09'],
      ruleCategory: 'reckless',
      explanation:
        "Three angles reviewed. CAM 01 shows the defender committing to a ground slide as the attacker pushes the ball forward. CAM 02 confirms contact lands on the lower leg, studs down. CAM 03 — the ball is already away. Intent reads reckless, not excessive force. My call is yellow.",
      evidence: [
        { timestamp: '00:07', description: 'Defender commits to a ground slide as the attacker knocks the ball forward.', videoIndex: 1, videoLabel: 'Broadcast', timestampSeconds: 7 },
        { timestamp: '00:08', description: 'Studs-down contact on the lower leg, defender misses the ball entirely.', videoIndex: 2, videoLabel: 'Behind goal', timestampSeconds: 8 },
        { timestamp: '00:09', description: 'Sweep-trip carries the attacker off the line of play.', videoIndex: 3, videoLabel: 'Reverse low', timestampSeconds: 9 },
      ],
      geminiSummary: 'Fast-paced ground challenge — defender slides late and wipes out the attacker at the ankle joint.',
      modelTrace: {
        videoAnalyzer: 'Gemini 2.5 Pro',
        orchestrator: 'RocketRide Orchestration',
        decisionModel: 'Gemma-9B · GMI Cloud',
      },
    },
  },
  {
    id: 'excessive-force',
    title: 'Studs-up lunge',
    subtitle: 'Serious foul play',
    source: 'Champions League · sim',
    cams: ['Broadcast', 'Pitchside', 'Reverse'],
    result: {
      decision: 'RED_CARD',
      confidence: 94,
      keyTimestamp: '00:03-00:05',
      keyTimestamps: ['00:03', '00:04', '00:05'],
      ruleCategory: 'excessive force',
      explanation:
        "Three angles reviewed. CAM 01 captures the defender launching with both feet off the ground. CAM 02 confirms studs fully exposed, leg locked at the knee. CAM 03 — point of contact lands above the boot, high on the shin. Force far exceeds what the play required. My call is red.",
      evidence: [
        { timestamp: '00:03', description: 'Defender lunges forward, feet leaving the ground.', videoIndex: 1, videoLabel: 'Broadcast', timestampSeconds: 3 },
        { timestamp: '00:04', description: 'Studs fully exposed, locked knee, no attempt to withdraw.', videoIndex: 2, videoLabel: 'Pitchside', timestampSeconds: 4 },
        { timestamp: '00:05', description: 'High-impact contact above the boot.', videoIndex: 3, videoLabel: 'Reverse', timestampSeconds: 5 },
      ],
      geminiSummary: 'Aerial lunge with exposed studs connecting at high velocity with the opponent\'s lower shin.',
      modelTrace: {
        videoAnalyzer: 'Gemini 2.5 Pro',
        orchestrator: 'RocketRide Orchestration',
        decisionModel: 'Gemma-9B · GMI Cloud',
      },
    },
  },
  {
    id: 'clean-charge',
    title: 'Shoulder challenge',
    subtitle: 'Fair physical duel',
    source: 'La Liga · MD12',
    cams: ['Broadcast', 'Goal line'],
    result: {
      decision: 'NO_CARD',
      confidence: 91,
      keyTimestamp: '00:11-00:13',
      keyTimestamps: ['00:11', '00:12', '00:13'],
      ruleCategory: 'no offense',
      explanation:
        "Two angles reviewed. CAM 01 shows both players sprinting parallel, jockeying for the loose ball. CAM 02 confirms shoulder-to-shoulder leverage, arms locked close, no backing into the opponent. Ball is poked away cleanly before any further contact. My call is play on.",
      evidence: [
        { timestamp: '00:11', description: 'Players move parallel, fair body contest for space.', videoIndex: 1, videoLabel: 'Broadcast', timestampSeconds: 11 },
        { timestamp: '00:12', description: 'Shoulder-to-shoulder leverage, arms locked close to the body.', videoIndex: 2, videoLabel: 'Goal line', timestampSeconds: 12 },
        { timestamp: '00:13', description: 'Defender pokes the ball away cleanly first.', videoIndex: 2, videoLabel: 'Goal line', timestampSeconds: 13 },
      ],
      geminiSummary: 'Mutual side-by-side body contest where the defender plays the ball first with a clean interception.',
      modelTrace: {
        videoAnalyzer: 'Gemini 2.5 Pro',
        orchestrator: 'RocketRide Orchestration',
        decisionModel: 'Gemma-9B · GMI Cloud',
      },
    },
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────────── */

const ACCEPTED_TYPES = ['.mp4', '.mov', '.webm'];
const MAX_ANGLES = 5;

const STREAM_SPEED_MS = 24;

function apiUrl(path: string) {
  const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL?.trim();
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function formatConfidence(c?: number) {
  if (typeof c !== 'number' || Number.isNaN(c)) return '—';
  const v = c <= 1 ? c * 100 : c;
  return `${Math.round(v)}`;
}

function normalizeConfidence(c?: number) {
  if (typeof c !== 'number' || Number.isNaN(c)) return 0;
  const v = c <= 1 ? c * 100 : c;
  return Math.max(0, Math.min(100, v));
}

function camId(index: number) {
  return `CAM ${String(index + 1).padStart(2, '0')}`;
}

function decisionPalette(d?: DecisionType | string) {
  const n = (d ?? '').toLowerCase();
  if (n.includes('red')) {
    return {
      key: 'red' as const,
      label: 'Red Card',
      panel: 'bg-[oklch(0.18_0.06_25)] border-[oklch(0.45_0.18_25)]',
      pill: 'bg-[oklch(0.30_0.12_25)] text-[oklch(0.92_0.05_25)] border-[oklch(0.45_0.18_25)]',
      strong: 'text-[oklch(0.78_0.16_25)]',
      tint: 'oklch(0.62 0.22 25)',
    };
  }
  if (n.includes('yellow')) {
    return {
      key: 'yellow' as const,
      label: 'Yellow Card',
      panel: 'bg-[oklch(0.18_0.06_85)] border-[oklch(0.55_0.16_85)]',
      pill: 'bg-[oklch(0.32_0.10_85)] text-[oklch(0.92_0.10_95)] border-[oklch(0.55_0.16_85)]',
      strong: 'text-[oklch(0.86_0.18_95)]',
      tint: 'oklch(0.86 0.18 95)',
    };
  }
  return {
    key: 'none' as const,
    label: 'No Card · Play On',
    panel: 'bg-[oklch(0.17_0.04_150)] border-[oklch(0.40_0.10_150)]',
    pill: 'bg-[oklch(0.24_0.06_150)] text-[oklch(0.88_0.08_150)] border-[oklch(0.40_0.10_150)]',
    strong: 'text-[oklch(0.78_0.13_150)]',
    tint: 'oklch(0.62 0.13 145)',
  };
}

function parseTimestampToSeconds(t?: string | null): number | null {
  if (!t) return null;
  const first = t.split('-')[0].trim();
  const parts = first.split(':').map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 1) return parts[0];
  return null;
}

function evidenceSeconds(m: EvidenceMoment): number | null {
  if (typeof m.timestampSeconds === 'number') return m.timestampSeconds;
  return parseTimestampToSeconds(m.timestamp);
}

let _angleSeq = 0;
function nextAngleId() {
  _angleSeq += 1;
  return `angle-${_angleSeq}`;
}

function defaultAngleLabel(index: number, total: number) {
  if (total <= 1) return 'Main angle';
  return `Angle ${index + 1}`;
}

/* ─────────────────────────────────────────────────────────────────────────
   Streaming hook
   ───────────────────────────────────────────────────────────────────────── */

function useStreamedText(target: string, enabled: boolean, speedMs = STREAM_SPEED_MS) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const [seq, setSeq] = useState(0);

  const replay = useCallback(() => setSeq((s) => s + 1), []);

  useEffect(() => {
    if (!enabled || !target) {
      setShown('');
      setDone(false);
      return;
    }
    setShown('');
    setDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(target.slice(0, i));
      if (i >= target.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, speedMs);
    return () => window.clearInterval(id);
  }, [target, enabled, speedMs, seq]);

  return { shown, done, replay };
}

/* ─────────────────────────────────────────────────────────────────────────
   Live clock — Pacific Time
   ───────────────────────────────────────────────────────────────────────── */

function usePacificClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Los_Angeles',
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   Top broadcast HUD
   ───────────────────────────────────────────────────────────────────────── */

function TopHUD() {
  const time = usePacificClock();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-deep/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-pacific pulse-dot" />
          <span className="text-ink">Bay Area</span>
          <span className="text-ink-3">·</span>
          <span className="text-amber-bay">2026</span>
          <span className="hidden text-ink-3 sm:inline">·</span>
          <span className="hidden text-ink-3 sm:inline">Match Operations</span>
        </div>

        <div className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3 md:flex md:items-center md:gap-3">
          <span>Match Review</span>
          <span className="text-line-strong">|</span>
          <span className="tabular-nums text-ink-2">{time} PT</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elev/60 px-2 py-1">
            <Wifi className="h-3 w-3 text-pacific" />
            <span className="hidden sm:inline">Gemini · Rocketride · Gemma</span>
            <span className="sm:hidden">Live</span>
          </span>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Hero — only on idle empty state
   ───────────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="ambient-pacific pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 py-14 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-20">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-3">
            AI Referee Assistant · 2026 Bay Area · Match Operations
          </p>
          <h1
            className="mt-5 font-display text-[clamp(64px,12vw,140px)] font-bold leading-[0.92] tracking-[-0.04em] text-ink"
          >
            VARify
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
            Upload an incident clip — or several angles — and a named AI assistant
            referee briefs the call. Contact frame, intent, ball playability,
            cross-referenced across every camera.
          </p>
        </div>

        <CardStack />
      </div>
    </section>
  );
}

function CardStack() {
  return (
    <div className="relative h-44 w-32 sm:h-56 sm:w-40" aria-hidden>
      <div
        className="absolute inset-0 rotate-[-9deg] rounded-lg shadow-rim"
        style={{
          background:
            'linear-gradient(180deg, oklch(0.86 0.18 95) 0%, oklch(0.78 0.16 85) 100%)',
        }}
      />
      <div
        className="absolute inset-0 translate-x-6 translate-y-3 rotate-[10deg] rounded-lg shadow-rim"
        style={{
          background:
            'linear-gradient(180deg, oklch(0.62 0.22 25) 0%, oklch(0.50 0.20 25) 100%)',
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Source picker — presets + multi-angle upload
   ───────────────────────────────────────────────────────────────────────── */

function PresetRow({
  preset,
  active,
  onSelect,
}: {
  preset: Preset;
  active: boolean;
  onSelect: () => void;
}) {
  const palette = decisionPalette(preset.result.decision);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group focus-ring relative w-full overflow-hidden rounded-xl border text-left transition-colors duration-200 ease-out-quart ${
        active
          ? 'border-pacific bg-elev shadow-rim'
          : 'border-line bg-panel/70 hover:border-line-strong hover:bg-panel'
      }`}
    >
      <div className="flex items-start gap-4 px-4 py-4 sm:px-5">
        <div
          className="mt-0.5 h-12 w-9 shrink-0 rounded-sm"
          style={{ background: palette.tint, opacity: active ? 0.95 : 0.7 }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-medium text-ink">{preset.title}</h3>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${palette.pill}`}
            >
              {palette.label.split(' ')[0]}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-2">{preset.subtitle}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            {preset.source} · {preset.cams.length} {preset.cams.length === 1 ? 'angle' : 'angles'}
          </p>
        </div>
        <ChevronRight
          className={`mt-3 h-4 w-4 shrink-0 transition-colors ${active ? 'text-pacific' : 'text-ink-3 group-hover:text-ink-2'}`}
        />
      </div>
      {active && <div className="absolute inset-y-0 left-0 w-px bg-pacific" aria-hidden />}
    </button>
  );
}

function AngleStack({
  angles,
  onRemove,
  onClear,
  activeAngleIndex,
}: {
  angles: AngleEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
  activeAngleIndex: number | null;
}) {
  if (angles.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {angles.map((angle, index) => {
        const active = activeAngleIndex === index;
        return (
          <div
            key={angle.id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-200 ${
              active ? 'border-pacific bg-elev shadow-[0_0_0_3px_oklch(0.66_0.16_240/_0.10)]' : 'border-line bg-sunken'
            }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-pacific">
              {camId(index)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-2" title={angle.file.name}>
              {angle.file.name}
            </span>
            <span className="font-mono text-[11px] text-ink-3 tabular-nums">
              {(angle.file.size / 1024 / 1024).toFixed(1)} MB
            </span>
            <button
              type="button"
              aria-label={`Remove ${camId(index)}`}
              onClick={() => onRemove(angle.id)}
              className="focus-ring rounded p-1 text-ink-3 transition-colors hover:bg-line/40 hover:text-ink-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
      {angles.length > 1 && (
        <button
          type="button"
          onClick={onClear}
          className="focus-ring inline-flex items-center gap-1.5 rounded font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 transition-colors hover:text-ink-2"
        >
          <Trash2 className="h-3 w-3" /> Clear all angles
        </button>
      )}
    </div>
  );
}

function UploadCard({
  angles,
  onFiles,
  onRemove,
  onClear,
  activeAngleIndex,
  disabled,
}: {
  angles: AngleEntry[];
  onFiles: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  activeAngleIndex: number | null;
  disabled: boolean;
}) {
  const atCapacity = angles.length >= MAX_ANGLES;
  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-rim">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-pacific" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2">
            Upload incident · {angles.length}/{MAX_ANGLES}
          </h2>
        </div>
        {angles.length > 0 && !atCapacity && (
          <label className="focus-ring inline-flex cursor-pointer items-center gap-1 rounded font-mono text-[10px] uppercase tracking-[0.18em] text-pacific hover:text-amber-bay">
            <Plus className="h-3 w-3" /> Add angle
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              multiple
              className="sr-only"
              onChange={(e: ChangeEvent<HTMLInputElement>) => onFiles(e.target.files)}
              disabled={disabled}
            />
          </label>
        )}
      </div>

      <label
        className={`focus-ring relative flex min-h-[152px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors ${
          atCapacity ? 'border-line-strong bg-sunken/60' : 'border-line-strong bg-sunken hover:border-pacific hover:bg-elev'
        }`}
      >
        <input
          aria-label="Upload soccer clips"
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFiles(e.target.files)}
          disabled={atCapacity || disabled}
        />
        <p className="font-display text-lg font-medium text-ink">
          {atCapacity ? 'Booth at capacity' : 'Drop clips into the booth'}
        </p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
          {atCapacity
            ? `Maximum ${MAX_ANGLES} angles`
            : 'MP4 · MOV · WEBM · multiple angles welcome'}
        </p>
      </label>

      <AngleStack
        angles={angles}
        onRemove={onRemove}
        onClear={onClear}
        activeAngleIndex={activeAngleIndex}
      />
    </div>
  );
}

function PresetCard({
  active,
  onSelect,
  onClearPreset,
}: {
  active: string | null;
  onSelect: (id: string) => void;
  onClearPreset: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-rim">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-bay" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2">
            Reference incidents
          </h2>
        </div>
        {active && (
          <button
            type="button"
            onClick={onClearPreset}
            className="focus-ring rounded font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 transition-colors hover:text-ink-2"
          >
            Clear
          </button>
        )}
      </div>
      <p className="mb-4 text-sm leading-relaxed text-ink-3">
        Catalogued incidents for review without an upload. Each one carries
        camera labels and timestamps so the brief reads end-to-end.
      </p>
      <div className="space-y-3">
        {PRESETS.map((p) => (
          <PresetRow
            key={p.id}
            preset={p}
            active={active === p.id}
            onSelect={() => onSelect(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Idle briefing pad — passive panel that matches the agent voice
   ───────────────────────────────────────────────────────────────────────── */

function BriefingPad({
  presetSelected,
  uploadsCount,
}: {
  presetSelected: string | null;
  uploadsCount: number;
}) {
  const preset = PRESETS.find((p) => p.id === presetSelected);
  const armed = !!presetSelected || uploadsCount > 0;
  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-xl border border-line bg-panel p-6 shadow-rim">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-pacific pulse-dot" />
          <span className="font-mono text-sm font-semibold text-ink">VAR·AI</span>
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
            {armed ? 'Armed · awaiting trigger' : 'Standing by'}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
          v0.4 · build {new Date().getFullYear()}
        </span>
      </header>

      <div className="mt-6 space-y-4 text-[15px] leading-[1.65] text-ink-2">
        {preset ? (
          <>
            <p>
              Loaded the <span className="font-medium text-ink">{preset.title.toLowerCase()}</span>{' '}
              from <span className="text-ink-2">{preset.source.toLowerCase()}</span>. {preset.cams.length}{' '}
              {preset.cams.length === 1 ? 'angle' : 'angles'} cued.
            </p>
            <p>I'll review three things on trigger:</p>
          </>
        ) : uploadsCount > 0 ? (
          <>
            <p>
              {uploadsCount} {uploadsCount === 1 ? 'angle' : 'angles'} queued in the booth. Trigger the
              brief when ready.
            </p>
            <p>I'll review three things:</p>
          </>
        ) : (
          <>
            <p>Drop a clip into the booth, or pick a reference incident from the left.</p>
            <p>Once you trigger me, I'll review three things in order:</p>
          </>
        )}

        <ul className="space-y-2 pl-1">
          <li className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-amber-bay">01</span>
            <span>Contact frame — where, when, and how the contact lands.</span>
          </li>
          <li className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-amber-bay">02</span>
            <span>Player intent — speed, body position, point of contact.</span>
          </li>
          <li className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-amber-bay">03</span>
            <span>Ball playability — was the defender realistically playing the ball.</span>
          </li>
        </ul>

        <p className="text-ink-3">
          Then I rule on intent: careless, reckless, or excessive force — and call the card.
        </p>
      </div>

      <footer className="mt-auto border-t border-line pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
        Pipeline · gemini → rocketride → gemma
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Scanning state — replaces verdict + agent panels during analysis
   ───────────────────────────────────────────────────────────────────────── */

const SCAN_STEPS = [
  { label: 'Ingest', detail: 'video telemetry', source: 'GEMINI' },
  { label: 'Structure', detail: 'incident report', source: 'ROCKETRIDE' },
  { label: 'Adjudicate', detail: 'contact severity', source: 'GEMMA' },
  { label: 'Brief', detail: 'assembling rationale', source: 'VAR·AI' },
];

function ScanningPanel({
  angles,
  presetCams,
}: {
  angles: AngleEntry[];
  presetCams: string[] | null;
}) {
  const [step, setStep] = useState(0);
  const cams = presetCams ?? angles.map((_, i) => `Angle ${i + 1}`);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setStep(0);
    setElapsed(0);
    const stepId = window.setInterval(() => setStep((s) => Math.min(s + 1, SCAN_STEPS.length)), 850);
    const tickId = window.setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => {
      window.clearInterval(stepId);
      window.clearInterval(tickId);
    };
  }, []);

  return (
    <div className="rounded-xl border border-line bg-panel p-6 shadow-rim">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-pacific pulse-dot" />
          <span className="font-mono text-sm font-semibold text-ink">VAR·AI</span>
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-bay">
            Scanning feeds
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-ink-2">
          T+ {elapsed.toFixed(1)}s
        </span>
      </header>

      <div className="mt-6 space-y-5">
        {SCAN_STEPS.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <div key={s.label} className="space-y-2">
              <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.18em]">
                <div className="flex items-baseline gap-3">
                  <span className={done || active ? 'text-pacific' : 'text-ink-3'}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={done || active ? 'text-ink' : 'text-ink-3'}>{s.label}</span>
                  <span className="text-ink-3">·</span>
                  <span className="text-ink-3">{s.detail}</span>
                </div>
                <span className={done ? 'text-amber-bay' : active ? 'text-ink-2' : 'text-ink-dim'}>
                  {s.source}
                </span>
              </div>
              <div className="relative h-[3px] overflow-hidden rounded-full bg-sunken">
                <div
                  className={`absolute inset-y-0 left-0 right-0 scan-fill bg-pacific transition-transform ease-out-quart ${
                    done ? 'scale-x-100' : active ? 'scale-x-100' : 'scale-x-0'
                  }`}
                  style={{
                    transitionDuration: active ? '780ms' : done ? '0ms' : '0ms',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {cams.length > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
            Feeds in review
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {cams.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-elev px-2.5 py-1 font-mono text-[11px] text-ink-2"
              >
                <span className="text-pacific">{camId(i)}</span>
                <span className="text-ink-3">·</span>
                <span className="truncate text-ink-2">{c}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Verdict banner
   ───────────────────────────────────────────────────────────────────────── */

function VerdictCardGlyph({ palette }: { palette: ReturnType<typeof decisionPalette> }) {
  if (palette.key === 'none') {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-line-strong bg-elev" aria-hidden>
        <div className="h-3 w-3 rounded-full" style={{ background: palette.tint }} />
      </div>
    );
  }
  return (
    <div
      className="relative h-24 w-16 rotate-[-7deg] rounded-sm shadow-rim"
      style={{
        background: `linear-gradient(180deg, ${palette.tint}, color-mix(in oklch, ${palette.tint} 78%, oklch(0 0 0)))`,
      }}
      aria-hidden
    >
      <div className="absolute inset-0 rounded-sm" style={{ boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.18)' }} />
    </div>
  );
}

function ConfidenceDial({ value }: { value: number }) {
  const size = 144;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const offsetTotal = circumference - arcLength;
  const filled = arcLength * (value / 100);
  const dashArray = `${filled} ${circumference}`;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`Confidence ${Math.round(value)} percent`}
        className="-rotate-[135deg]"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.28 0.015 240)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offsetTotal / 2}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.66 0.16 240)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={offsetTotal / 2}
          style={{
            transition: 'stroke-dasharray 720ms cubic-bezier(0.165, 0.84, 0.44, 1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold tabular-nums text-ink">
          {Math.round(value)}
        </span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
          Confidence
        </span>
      </div>
    </div>
  );
}

function VerdictBanner({ result }: { result: VARifyResult }) {
  const palette = decisionPalette(result.decision);
  const confidence = normalizeConfidence(result.confidence);
  const keyMoment = result.keyTimestamp ?? result.keyTimestamps?.[0] ?? '—';
  return (
    <section
      className={`verdict-rise relative overflow-hidden rounded-2xl border p-6 shadow-rim sm:p-8 ${palette.panel}`}
    >
      <div className="absolute inset-0 -z-10 opacity-30" style={{
        background: `radial-gradient(60% 80% at 20% 0%, ${palette.tint} 0%, transparent 60%)`
      }} aria-hidden />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-6">
          <VerdictCardGlyph palette={palette} />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-3">
              Official decision
            </p>
            <h2 className={`mt-2 font-display text-[44px] font-bold leading-[1] tracking-tight sm:text-5xl ${palette.strong}`}>
              {palette.label}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2">
              <span className="rounded-md border border-line bg-elev/80 px-2.5 py-1 tabular-nums">
                {keyMoment}
              </span>
              <span className="rounded-md border border-line bg-elev/80 px-2.5 py-1 capitalize text-amber-bay">
                {result.ruleCategory}
              </span>
            </div>
          </div>
        </div>

        <ConfidenceDial value={confidence} />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Camera rail (results)
   ───────────────────────────────────────────────────────────────────────── */

type CamView = {
  id: string;
  index: number;
  label: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
  pins: EvidenceMoment[];
};

function CameraRailResults({
  cams,
  activeIndex,
  onSeek,
}: {
  cams: CamView[];
  activeIndex: number | null;
  onSeek: (camIndex: number, seconds: number) => void;
}) {
  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2">
          Feeds · {cams.length}
        </h3>
      </div>
      <div className="space-y-3">
        {cams.map((cam, i) => {
          const active = activeIndex === i;
          return (
            <article
              key={cam.id}
              className={`relative overflow-hidden rounded-xl border bg-panel transition-all duration-300 ease-out-quart ${
                active
                  ? 'border-pacific shadow-[0_0_0_3px_oklch(0.66_0.16_240/_0.18)]'
                  : 'border-line'
              }`}
              data-cam-index={i}
            >
              <header className="flex items-center justify-between border-b border-line bg-elev/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-pacific">
                    {camId(i)}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                    {cam.label}
                  </span>
                </div>
                {active && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-bay">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-bay pulse-dot" />
                    Reviewing
                  </span>
                )}
              </header>

              <div className="bg-sunken">
                {cam.url ? (
                  <video
                    id={`cam-video-${i}`}
                    src={cam.url}
                    controls
                    preload="metadata"
                    className="aspect-video w-full bg-black object-contain"
                  />
                ) : (
                  <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black">
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{
                        background:
                          'repeating-linear-gradient(135deg, oklch(0.21 0.020 240) 0 12px, transparent 12px 24px)',
                      }}
                    />
                    <div className="relative z-10 text-center">
                      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-3">
                        Reference feed
                      </p>
                      <p className="mt-1 font-display text-base text-ink">{cam.label}</p>
                    </div>
                  </div>
                )}
              </div>

              {cam.pins.length > 0 && (
                <footer className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
                  {cam.pins.map((pin, pi) => {
                    const seconds = evidenceSeconds(pin);
                    return (
                      <button
                        key={pi}
                        type="button"
                        onClick={() => seconds != null && onSeek(i, seconds)}
                        className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-sunken px-2 py-1 font-mono text-[10px] tabular-nums text-pacific transition-colors hover:border-pacific hover:bg-elev hover:text-amber-bay"
                      >
                        <span className="h-1 w-1 rounded-full bg-pacific" />
                        {pin.timestamp}
                      </button>
                    );
                  })}
                </footer>
              )}

              {cam.fileName && (
                <div className="flex items-center justify-between border-t border-line px-3 py-2 font-mono text-[10px] text-ink-3">
                  <span className="truncate" title={cam.fileName}>
                    {cam.fileName}
                  </span>
                  {cam.fileSize != null && (
                    <span className="tabular-nums">{(cam.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Agent panel — streamed brief with synced angle highlight
   ───────────────────────────────────────────────────────────────────────── */

function detectActiveAngle(text: string, camLabels: string[]): number | null {
  if (!text) return null;
  // Find the LAST occurrence of any angle reference inside the visible text.
  let bestIndex = -1;
  let bestPos = -1;
  const lower = text.toLowerCase();
  for (let i = 0; i < camLabels.length; i++) {
    const n = i + 1;
    const patterns = [
      `cam 0${n}`,
      `cam ${n}`,
      `angle 0${n}`,
      `angle ${n}`,
      camLabels[i]?.toLowerCase(),
    ].filter(Boolean) as string[];
    for (const p of patterns) {
      const pos = lower.lastIndexOf(p);
      if (pos > bestPos) {
        bestPos = pos;
        bestIndex = i;
      }
    }
  }
  return bestIndex >= 0 ? bestIndex : null;
}

function AgentPanel({
  result,
  camLabels,
  onActiveAngleChange,
}: {
  result: VARifyResult;
  camLabels: string[];
  onActiveAngleChange: (i: number | null) => void;
}) {
  const target = result.explanation ?? '';
  const { shown, done, replay } = useStreamedText(target, true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    if (done) return;
    const id = window.setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => window.clearInterval(id);
  }, [done, target]);

  useEffect(() => {
    onActiveAngleChange(detectActiveAngle(shown, camLabels));
  }, [shown, camLabels, onActiveAngleChange]);

  return (
    <section className="flex h-full min-h-[420px] flex-col rounded-xl border border-line bg-panel shadow-rim">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-pacific pulse-dot" />
          <span className="font-mono text-sm font-semibold text-ink">VAR·AI</span>
          <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-amber-bay sm:inline">
            {done ? 'Brief complete' : 'Live analysis'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-ink-2">
            T+ {elapsed.toFixed(1)}s
          </span>
          <button
            type="button"
            onClick={replay}
            className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-line bg-elev px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-2 transition-colors hover:border-pacific hover:text-amber-bay"
            aria-label="Replay brief"
          >
            <RefreshCw className="h-3 w-3" />
            Re-brief
          </button>
        </div>
      </header>

      <div className="flex-1 px-6 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
          Assistant referee brief
        </p>
        <div
          aria-live="polite"
          className="mt-3 max-w-[68ch] whitespace-pre-wrap text-[17px] leading-[1.65] text-ink"
        >
          <AnnotatedBrief text={shown} camLabels={camLabels} />
          <span
            className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-amber-bay align-middle stream-caret"
            aria-hidden
          />
        </div>
        {/* Offscreen mirror for screen readers — full sentence available immediately */}
        <span className="sr-only">{target}</span>
      </div>

      {result.geminiSummary && (
        <footer className="border-t border-line px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
            Gemini visual extraction
          </p>
          <p className="mt-2 max-w-[72ch] text-sm italic leading-relaxed text-ink-2">
            “{result.geminiSummary}”
          </p>
        </footer>
      )}
    </section>
  );
}

function AnnotatedBrief({ text, camLabels }: { text: string; camLabels: string[] }) {
  // Highlight CAM 0X / Angle X tokens in pacific blue, and label hits in amber.
  const tokens = useMemo(() => {
    const re = /(CAM\s*0?\d+|Angle\s*0?\d+)/gi;
    const parts: { kind: 'cam' | 'text'; value: string }[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
      parts.push({ kind: 'cam', value: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
    return parts;
  }, [text, camLabels]);

  return (
    <>
      {tokens.map((t, i) =>
        t.kind === 'cam' ? (
          <span
            key={i}
            className="rounded-sm bg-[oklch(0.66_0.16_240/_0.16)] px-1 py-0.5 font-mono text-[0.9em] uppercase tracking-wider text-pacific"
          >
            {t.value}
          </span>
        ) : (
          <span key={i}>{t.value}</span>
        ),
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Evidence timeline — full-width band, one row per angle, clickable pins
   ───────────────────────────────────────────────────────────────────────── */

function EvidenceTimeline({
  cams,
  onSeek,
}: {
  cams: CamView[];
  onSeek: (camIndex: number, seconds: number) => void;
}) {
  const allSeconds = cams.flatMap((c) => c.pins.map(evidenceSeconds).filter((s): s is number => s != null));
  const minSec = allSeconds.length ? Math.max(0, Math.min(...allSeconds) - 2) : 0;
  const maxSec = allSeconds.length ? Math.max(...allSeconds) + 3 : 15;
  const span = Math.max(6, maxSec - minSec);

  const ticks = useMemo(() => {
    const t: number[] = [];
    const interval = span <= 12 ? 1 : 2;
    for (let s = Math.ceil(minSec); s <= Math.floor(maxSec); s += interval) t.push(s);
    return t;
  }, [minSec, maxSec, span]);

  return (
    <section className="rounded-xl border border-line bg-panel p-6 shadow-rim">
      <header className="mb-5 flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2">
            Evidence timeline
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            click any pin to seek the feed
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-ink-3">
          {fmtClock(minSec)} → {fmtClock(maxSec)}
        </span>
      </header>

      <div className="space-y-4">
        {cams.map((cam, i) => (
          <div key={cam.id} className="grid grid-cols-[80px_1fr] items-center gap-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em]">
              <div className="text-pacific">{camId(i)}</div>
              <div className="truncate text-ink-3">{cam.label}</div>
            </div>
            <div className="relative h-9 rounded-md border border-line bg-sunken">
              {cam.pins.map((pin, pi) => {
                const sec = evidenceSeconds(pin);
                if (sec == null) return null;
                const x = ((sec - minSec) / span) * 100;
                return (
                  <button
                    key={pi}
                    type="button"
                    onClick={() => onSeek(i, sec)}
                    className="focus-ring group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${Math.max(0, Math.min(100, x))}%` }}
                    title={`${pin.timestamp} — ${pin.description}`}
                    aria-label={`Seek ${camId(i)} to ${pin.timestamp}`}
                  >
                    <span className="block h-3 w-3 rounded-full border border-pacific bg-deep transition-all duration-200 group-hover:scale-[1.4] group-hover:border-amber-bay group-hover:bg-amber-bay" />
                    <span className="pointer-events-none absolute left-1/2 top-[140%] -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tabular-nums text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      {pin.timestamp}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[80px_1fr] gap-4">
        <div />
        <div className="relative h-4">
          {ticks.map((t) => {
            const x = ((t - minSec) / span) * 100;
            return (
              <div
                key={t}
                className="absolute -translate-x-1/2 font-mono text-[10px] tabular-nums text-ink-3"
                style={{ left: `${x}%` }}
              >
                {fmtClock(t)}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function fmtClock(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* ─────────────────────────────────────────────────────────────────────────
   Model trace — broadcast pipeline graphic
   ───────────────────────────────────────────────────────────────────────── */

function ModelTrace({ trace }: { trace?: VARifyResult['modelTrace'] }) {
  const stages = [
    { label: 'Gemini', value: (trace?.videoAnalyzer ?? 'Gemini 2.5 Pro') as string, note: 'video telemetry' },
    { label: 'RocketRide', value: (trace?.orchestrator ?? 'RocketRide Orchestration') as string, note: 'incident report' },
    { label: 'Gemma', value: (trace?.decisionModel ?? 'Gemma-9B · GMI Cloud') as string, note: 'card adjudication' },
  ];
  return (
    <section className="rounded-xl border border-line bg-panel p-6 shadow-rim">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
        Pipeline trace
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stages.map((s, i) => (
          <div key={s.label} className="relative rounded-lg border border-line bg-elev/50 p-4">
            <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.18em]">
              <span className="text-ink-3">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-pacific">{s.label}</span>
            </div>
            <p className="mt-3 font-display text-base text-ink">{s.value}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
              {s.note}
            </p>
            {i < stages.length - 1 && (
              <span className="absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-line md:block" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   IFAB Law 12 explainer — editorial reference
   ───────────────────────────────────────────────────────────────────────── */

function LawExplainer() {
  const items = [
    {
      title: 'Careless',
      decision: 'No card',
      tint: 'oklch(0.62 0.13 145)',
      copy:
        'A challenge made with a lack of attention or precaution, but without intent to endanger. A free kick is awarded; no disciplinary sanction follows.',
    },
    {
      title: 'Reckless',
      decision: 'Yellow card',
      tint: 'oklch(0.86 0.18 95)',
      copy:
        'A challenge made with complete disregard for the danger to, or consequences for, an opponent. A caution is mandatory. Late lunges, ankle-high contact without intent to maim.',
    },
    {
      title: 'Excessive force',
      decision: 'Red card',
      tint: 'oklch(0.62 0.22 25)',
      copy:
        'A challenge that far exceeds necessary force and endangers an opponent\'s safety. Serious foul play threshold met. Studs-up, two-footed off-ground, high velocity above the boot.',
    },
  ];
  return (
    <section className="rounded-xl border border-line bg-panel p-6 shadow-rim">
      <header className="mb-5 flex items-center gap-3 border-b border-line pb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-bay">
          IFAB Law 12
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          Card guidelines · referee quick reference
        </span>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((it) => (
          <article key={it.title} className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: it.tint }}
                aria-hidden
              />
              <h4 className="font-display text-lg text-ink">{it.title}</h4>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
                {it.decision}
              </span>
            </div>
            <p className="max-w-[40ch] text-sm leading-relaxed text-ink-2">{it.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Main app
   ───────────────────────────────────────────────────────────────────────── */

export default function App() {
  const [angles, setAngles] = useState<AngleEntry[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<VARifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAngleIndex, setActiveAngleIndex] = useState<number | null>(null);

  // Revoke object URLs on unmount / change
  useEffect(() => {
    return () => {
      angles.forEach((a) => URL.revokeObjectURL(a.url));
    };
  }, [angles]);

  const acceptFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAngles((current) => {
      const seen = new Set(current.map((a) => `${a.file.name}::${a.file.size}::${a.file.lastModified}`));
      const additions: AngleEntry[] = [];
      for (const file of Array.from(files)) {
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (seen.has(key)) continue;
        if (current.length + additions.length >= MAX_ANGLES) break;
        seen.add(key);
        additions.push({
          id: nextAngleId(),
          file,
          label: defaultAngleLabel(current.length + additions.length, current.length + additions.length + 1),
          url: URL.createObjectURL(file),
        });
      }
      const next = [...current, ...additions];
      return next.map((entry, index) => ({
        ...entry,
        label: defaultAngleLabel(index, next.length),
      }));
    });
    setActivePreset(null);
    setResult(null);
    setError(null);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setAngles((current) => {
      const removed = current.find((a) => a.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      const next = current.filter((a) => a.id !== id);
      return next.map((entry, index) => ({
        ...entry,
        label: defaultAngleLabel(index, next.length),
      }));
    });
    setResult(null);
    setError(null);
  }, []);

  const handleClearAngles = useCallback(() => {
    setAngles((current) => {
      current.forEach((a) => URL.revokeObjectURL(a.url));
      return [];
    });
    setResult(null);
    setError(null);
  }, []);

  const handleSelectPreset = useCallback((id: string) => {
    setActivePreset(id);
    setResult(null);
    setError(null);
    setActiveAngleIndex(null);
  }, []);

  const handleClearPreset = useCallback(() => {
    setActivePreset(null);
    setResult(null);
  }, []);

  const triggerAnalysis = useCallback(async () => {
    if (!activePreset && angles.length === 0) {
      setError('Add at least one clip or pick a reference incident.');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    const preset = activePreset ? PRESETS.find((p) => p.id === activePreset) : null;

    try {
      const formData = new FormData();
      if (preset) {
        // Backend ignores demoId but we send it for forward-compat. Mirror video field
        // if angles exist, but typically preset mode uses only the demo signal.
        formData.append('demoId', preset.id);
      }
      angles.forEach((a) => formData.append('video', a.file));

      // Only call backend if there's an actual upload, otherwise short-circuit
      // to preset (the backend has no mock mode and would error out).
      if (angles.length > 0) {
        const response = await fetch(apiUrl('/api/analyze'), { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Backend responded ${response.status}`);
        const data = (await response.json()) as VARifyResult;
        // Briefly hold the scanning state so the choreography reads.
        await new Promise((r) => setTimeout(r, 1200));
        setResult(data);
      } else if (preset) {
        await new Promise((r) => setTimeout(r, 3400)); // let the scanning state read end-to-end
        setResult(preset.result);
      }
    } catch (e) {
      // Graceful fallback to preset if backend is offline.
      if (preset) {
        await new Promise((r) => setTimeout(r, 600));
        setResult(preset.result);
      } else {
        const message = e instanceof Error ? e.message : String(e);
        // Detect the common GMI/Gemini misconfiguration so the copy stays useful.
        const isConfigError = /503|configured|GMI|gemini|gemma|quota|rate.?limit/i.test(message);
        setError(
          isConfigError
            ? 'The live model is not configured on this backend (GMI_API_KEY missing or rate-limited). Continue with a reference incident to review the brief flow.'
            : `${message}. Continue with a reference incident below.`,
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [activePreset, angles]);

  // Pick a reference incident and immediately run the brief. Used by the error
  // recovery CTA when a live upload can't reach the backend.
  const handleUseReference = useCallback(
    (presetId: string = 'late-tackle') => {
      setActivePreset(presetId);
      setError(null);
      // Defer one tick so React commits the preset selection before triggerAnalysis reads it.
      requestAnimationFrame(() => {
        // We call triggerAnalysis via a fresh closure that sees the updated activePreset.
        // The state update is synchronous from the user's perspective, but the closure
        // captured by triggerAnalysis above is stale. Inline minimal version:
        const preset = PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        setIsAnalyzing(true);
        setResult(null);
        setError(null);
        setTimeout(() => {
          setResult(preset.result);
          setIsAnalyzing(false);
        }, 3400);
      });
    },
    [],
  );

  // Build the unified CamView list for both upload + preset paths
  const cams: CamView[] = useMemo(() => {
    if (!result) return [];
    const moments = (result.keyMoments && result.keyMoments.length > 0 ? result.keyMoments : result.evidence) ?? [];
    const labels = activePreset
      ? PRESETS.find((p) => p.id === activePreset)?.cams ?? []
      : angles.map((a) => a.label);
    const totalCams = Math.max(labels.length, ...moments.map((m) => m.videoIndex ?? 0));
    const ensured = Math.max(1, totalCams);
    const views: CamView[] = [];
    for (let i = 0; i < ensured; i++) {
      const angle = angles[i];
      const label = angle?.label ?? labels[i] ?? `Angle ${i + 1}`;
      const pins = moments.filter((m) =>
        m.videoIndex != null ? m.videoIndex - 1 === i : ensured === 1,
      );
      // If a moment has no videoIndex, broadcast it to the first cam so we still pin it
      const fallbackPins = i === 0 && ensured > 1 ? moments.filter((m) => m.videoIndex == null) : [];
      views.push({
        id: angle?.id ?? `ref-${i}`,
        index: i,
        label,
        url: angle?.url,
        fileName: angle?.file.name,
        fileSize: angle?.file.size,
        pins: [...pins, ...fallbackPins].sort((a, b) => {
          const sa = evidenceSeconds(a) ?? 0;
          const sb = evidenceSeconds(b) ?? 0;
          return sa - sb;
        }),
      });
    }
    return views;
  }, [result, angles, activePreset]);

  const handleSeek = useCallback((camIndex: number, seconds: number) => {
    const el = document.getElementById(`cam-video-${camIndex}`) as HTMLVideoElement | null;
    if (!el) return;
    el.currentTime = seconds;
    el.play().catch(() => {});
  }, []);

  const armed = !!activePreset || angles.length > 0;
  const presetCams = activePreset ? PRESETS.find((p) => p.id === activePreset)?.cams ?? null : null;
  const camLabels = useMemo(() => cams.map((c) => c.label), [cams]);

  return (
    <div className="min-h-screen bg-deep text-ink">
      <TopHUD />

      {!result && !isAnalyzing && <Hero />}

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* IDLE STATE */}
        {!result && !isAnalyzing && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-5">
              <PresetCard
                active={activePreset}
                onSelect={handleSelectPreset}
                onClearPreset={handleClearPreset}
              />
              <UploadCard
                angles={angles}
                onFiles={acceptFiles}
                onRemove={handleRemove}
                onClear={handleClearAngles}
                activeAngleIndex={activeAngleIndex}
                disabled={isAnalyzing}
              />

              <button
                type="button"
                onClick={triggerAnalysis}
                disabled={!armed || isAnalyzing}
                className="focus-ring group flex w-full items-center justify-center gap-3 rounded-xl border border-pacific bg-pacific px-6 py-4 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-deep shadow-rim transition-all duration-200 ease-out-quart hover:bg-amber-bay hover:border-amber-bay disabled:cursor-not-allowed disabled:border-line disabled:bg-elev disabled:text-ink-3 disabled:hover:bg-elev disabled:hover:border-line"
              >
                <Activity className="h-4 w-4" />
                <span>
                  {angles.length > 1
                    ? `Brief me on ${angles.length} angles`
                    : 'Trigger VAR·AI brief'}
                </span>
              </button>

              {error && (
                <div className="rounded-xl border border-line bg-panel p-5 shadow-rim">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-bay" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-bay">
                        Live model offline
                      </p>
                      <p className="text-sm leading-relaxed text-ink-2">{error}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUseReference('late-tackle')}
                      className="focus-ring inline-flex items-center gap-2 rounded-lg border border-pacific bg-pacific px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-deep transition-colors hover:border-amber-bay hover:bg-amber-bay"
                    >
                      <Activity className="h-3.5 w-3.5" />
                      Continue with Late Tackle
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        handleClearAngles();
                      }}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2 transition-colors hover:border-pacific hover:text-ink"
                    >
                      Clear uploads
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
              <BriefingPad presetSelected={activePreset} uploadsCount={angles.length} />
            </div>
          </div>
        )}

        {/* SCANNING STATE */}
        {isAnalyzing && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-5">
              <PresetCard
                active={activePreset}
                onSelect={handleSelectPreset}
                onClearPreset={handleClearPreset}
              />
              <UploadCard
                angles={angles}
                onFiles={acceptFiles}
                onRemove={handleRemove}
                onClear={handleClearAngles}
                activeAngleIndex={null}
                disabled={true}
              />
            </div>
            <div className="lg:col-span-7">
              <ScanningPanel angles={angles} presetCams={presetCams} />
            </div>
          </div>
        )}

        {/* RESULTS STATE */}
        {result && !isAnalyzing && (
          <div className="space-y-8">
            <VerdictBanner result={result} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <CameraRailResults
                  cams={cams}
                  activeIndex={activeAngleIndex}
                  onSeek={handleSeek}
                />
              </div>

              <div className="lg:col-span-9">
                <AgentPanel
                  result={result}
                  camLabels={camLabels}
                  onActiveAngleChange={setActiveAngleIndex}
                />
              </div>
            </div>

            {cams.some((c) => c.pins.length > 0) && (
              <EvidenceTimeline cams={cams} onSeek={handleSeek} />
            )}

            <ModelTrace trace={result.modelTrace} />

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-panel/60 px-6 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
                Decision logged · ready for next incident
              </p>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setActiveAngleIndex(null);
                }}
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-elev px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2 transition-colors hover:border-pacific hover:text-amber-bay"
              >
                Next incident
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <LawExplainer />
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
            VARify · AI Referee Assistant · 2026 Bay Area · Match Operations
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            Decisions advisory · IFAB Law 12 reference
          </p>
        </div>
      </footer>
    </div>
  );
}
