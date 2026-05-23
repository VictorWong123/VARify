import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, SkipForward, Volume2, Film, Download } from 'lucide-react';
import type { EvidenceMoment, DecisionType, Highlight } from './types';

type AIReplayProps = {
  videoUrl?: string;
  clipUrl?: string;
  clipStatus?: 'idle' | 'loading' | 'ready' | 'error';
  decision: DecisionType;
  confidence: number;
  finalReason?: string | null;
  keyMoments: EvidenceMoment[];
  voiceoverScript?: string | null;
  explanation: string;
  onGenerateCinematic?: () => void;
  cinematicStatus?: 'idle' | 'loading' | 'done' | 'error';
  cinematicUrl?: string;
};

function decisionLabel(d: DecisionType) {
  if (d === 'RED_CARD') return 'Red Card';
  if (d === 'YELLOW_CARD') return 'Yellow Card';
  return 'No Card';
}

function decisionColor(d: DecisionType) {
  if (d === 'RED_CARD') return '#ef4444';
  if (d === 'YELLOW_CARD') return '#facc15';
  return '#4ade80';
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function HighlightOverlay({ highlight }: { highlight: Highlight }) {
  return (
    <div
      className={`replay-highlight ${highlight.type}`}
      style={{
        left: `${highlight.x}%`,
        top: `${highlight.y}%`,
        width: `${highlight.width}%`,
        height: `${highlight.height}%`,
      }}
    />
  );
}

export default function AIReplay({
  videoUrl,
  clipUrl,
  clipStatus = 'idle',
  decision,
  confidence,
  finalReason,
  keyMoments,
  voiceoverScript,
  explanation,
  onGenerateCinematic,
  cinematicStatus = 'idle',
  cinematicUrl,
}: AIReplayProps) {
  // Always use the original video for playback/replay.
  // clipUrl is download-only: FFmpeg resets PTS to 0, so keyMoment timestamps
  // (expressed in original-video time) would seek to wrong frames on the clip.
  const effectiveVideoUrl = videoUrl;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeMoment, setActiveMoment] = useState<EvidenceMoment | null>(null);
  const [isReplayRunning, setIsReplayRunning] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [replayProgress, setReplayProgress] = useState<{ current: number; total: number } | null>(null);
  const replayRef = useRef(false);

  const decColor = decisionColor(decision);
  const pct = Math.round(typeof confidence === 'number' ? (confidence <= 1 ? confidence * 100 : confidence) : 0);

  const moments = keyMoments.filter((m) => m.timestampSeconds != null);

  // Seek to first key moment on first load so the poster frame is meaningful
  useEffect(() => {
    const video = videoRef.current;
    if (!video || moments.length === 0) return;
    const firstTs = moments[0].timestampSeconds!;
    const onLoadedMetadata = () => {
      video.currentTime = firstTs;
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    // If metadata is already loaded (src swap), seek immediately
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      video.currentTime = firstTs;
    }
    return () => video.removeEventListener('loadedmetadata', onLoadedMetadata);
  }, [effectiveVideoUrl, moments]);

  // Sync active moment while user manually scrubs (outside of replay mode)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (replayRef.current) return; // replay loop manages activeMoment directly
      const t = video.currentTime;
      const match = moments.find(
        (m) =>
          m.timestampSeconds != null &&
          t >= m.timestampSeconds &&
          t <= (m.endSeconds ?? m.timestampSeconds + 1.5),
      );
      setActiveMoment(match ?? null);
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [moments]);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.88;
    utt.pitch = 0.92;
    window.speechSynthesis.speak(utt);
  }, []);

  const playAIReplay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || moments.length === 0 || replayRef.current) return;

    replayRef.current = true;
    setIsReplayRunning(true);
    setReplayProgress({ current: 0, total: moments.length });

    const PLAYBACK_RATE = 0.45;

    for (let i = 0; i < moments.length; i++) {
      if (!replayRef.current) break;
      const moment = moments[i];

      // "Cut" flash between segments
      if (i > 0) {
        setActiveMoment(null);
        setTransitioning(true);
        await new Promise<void>((r) => setTimeout(r, 550));
        if (!replayRef.current) break;
        setTransitioning(false);
      }

      setReplayProgress({ current: i + 1, total: moments.length });

      const startTs = Math.max(0, (moment.timestampSeconds ?? 0) - 5);
      const endTs = (moment.timestampSeconds ?? 0) + 5;
      const segmentSec = endTs - startTs; // always 10s (or less at video start)
      // Play the segment at slow speed; cap at 12s wall-clock (10s / 0.45 ≈ 22s, cap earlier)
      const playMs = Math.min((segmentSec / PLAYBACK_RATE) * 1000, 12000);

      video.currentTime = startTs;
      video.playbackRate = PLAYBACK_RATE;
      setActiveMoment(moment);

      // Speak this moment's caption as its own voiceover
      speak(moment.caption ?? moment.description ?? moment.title ?? '');

      try {
        await video.play();
      } catch {
        // autoplay blocked in some browsers; captions + TTS still work
      }

      // Enforce segment end: pause as soon as we hit endTs or playMs elapses
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, playMs);
        const checkEnd = () => {
          if (video.currentTime >= endTs) {
            clearTimeout(timeout);
            video.removeEventListener('timeupdate', checkEnd);
            resolve();
          }
        };
        video.addEventListener('timeupdate', checkEnd);
      });

      video.pause();
    }

    video.playbackRate = 1;

    // Read the final decision summary after all segments play
    if (replayRef.current && voiceoverScript) {
      setActiveMoment(null);
      setTransitioning(true);
      await new Promise<void>((r) => setTimeout(r, 400));
      setTransitioning(false);
      speak(voiceoverScript);
    }

    replayRef.current = false;
    setIsReplayRunning(false);
    setActiveMoment(null);
    setReplayProgress(null);
  }, [moments, voiceoverScript, speak]);

  const stopReplay = useCallback(() => {
    replayRef.current = false;
    setIsReplayRunning(false);
    setActiveMoment(null);
    setTransitioning(false);
    setReplayProgress(null);
    window.speechSynthesis?.cancel();
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.playbackRate = 1;
    }
  }, []);

  const jumpToMoment = useCallback(
    (moment: EvidenceMoment) => {
      const video = videoRef.current;
      if (!video || moment.timestampSeconds == null) return;
      stopReplay();
      video.currentTime = moment.timestampSeconds;
      video.play().catch(() => {});
    },
    [stopReplay],
  );

  return (
    <div className="ai-replay-root">
      {/* Header */}
      <div className="ai-replay-header">
        <div className="ai-replay-decision-block">
          <span className="ai-replay-eyebrow">AI Referee Replay</span>
          <h2 className="ai-replay-decision" style={{ color: decColor }}>
            {decisionLabel(decision)}
          </h2>
          <p className="ai-replay-confidence">{pct}% confidence</p>
        </div>

        <div className="ai-replay-actions">
          {effectiveVideoUrl && (
            <button
              type="button"
              onClick={isReplayRunning ? stopReplay : playAIReplay}
              className="ai-replay-btn-primary"
              disabled={moments.length === 0}
            >
              {isReplayRunning ? (
                <>
                  <SkipForward className="h-4 w-4" />
                  Stop Replay
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Play AI Replay
                </>
              )}
            </button>
          )}

          {clipStatus === 'ready' && clipUrl && (
            <a
              href={clipUrl}
              download="var-clip.mp4"
              className="ai-replay-btn-secondary"
            >
              <Download className="h-4 w-4" />
              Download Clip
            </a>
          )}

          {onGenerateCinematic && (
            <button
              type="button"
              onClick={onGenerateCinematic}
              disabled={cinematicStatus === 'loading'}
              className="ai-replay-btn-secondary"
            >
              <Film className="h-4 w-4" />
              {cinematicStatus === 'loading'
                ? 'Generating…'
                : cinematicStatus === 'done'
                  ? 'Replay Generated'
                  : 'Generate Cinematic Replay'}
            </button>
          )}
        </div>
      </div>

      {/* Video shell */}
      {effectiveVideoUrl ? (
        <div className="ai-replay-video-shell">
          {/* muted: original audio removed, AI voiceover is the only audio */}
          <video
            ref={videoRef}
            src={effectiveVideoUrl}
            controls
            muted
            preload="metadata"
            className="ai-replay-video"
          />
          {/* Slim amber progress strip — visible only while clip is being cut */}
          {clipStatus === 'loading' && (
            <div
              className="ai-replay-clip-strip"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 4,
                background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)',
                backgroundSize: '200% 100%',
                animation: 'var-strip-slide 1.4s linear infinite',
                borderRadius: '0 0 4px 4px',
                zIndex: 10,
              }}
            />
          )}

          {activeMoment?.highlight && !transitioning && (
            <HighlightOverlay highlight={activeMoment.highlight} />
          )}

          {activeMoment && !transitioning && (
            <div className="ai-replay-caption-card">
              <strong>{activeMoment.title ?? activeMoment.timestamp}</strong>
              <span>{activeMoment.caption ?? activeMoment.description}</span>
            </div>
          )}

          {/* Scene cut flash */}
          {transitioning && <div className="ai-replay-cut-overlay" />}

          {/* Progress indicator */}
          {replayProgress && !transitioning && (
            <div className="ai-replay-scene-badge">
              Scene {replayProgress.current} / {replayProgress.total}
            </div>
          )}

          {/* Voiceover active pill */}
          {isReplayRunning && (
            <div className="ai-replay-vo-indicator">
              <Volume2 className="h-3.5 w-3.5" />
              <span>Voiceover</span>
            </div>
          )}
        </div>
      ) : (
        <div className="ai-replay-no-video">
          <p>No video uploaded — showing reference incident data</p>
        </div>
      )}

      {/* Cinematic replay video */}
      {cinematicStatus === 'done' && cinematicUrl && (
        <div className="ai-replay-cinematic">
          <p className="ai-replay-eyebrow" style={{ marginBottom: 8 }}>
            GMI-Generated VAR Replay
          </p>
          <video src={cinematicUrl} controls autoPlay className="ai-replay-video" />
        </div>
      )}

      {/* Timeline */}
      {moments.length > 0 && (
        <div className="ai-replay-timeline">
          <p className="ai-replay-eyebrow" style={{ marginBottom: 10 }}>
            Key Moments
          </p>
          <div className="ai-replay-timeline-list">
            {moments.map((moment, i) => (
              <button
                key={i}
                type="button"
                onClick={() => jumpToMoment(moment)}
                className={`ai-replay-moment-btn ${activeMoment === moment ? 'active' : ''}`}
              >
                <span className="ai-replay-moment-ts">
                  {formatTime(moment.timestampSeconds!)}
                </span>
                <div className="ai-replay-moment-text">
                  <strong>{moment.title ?? `Moment ${i + 1}`}</strong>
                  <small>{moment.caption ?? moment.description}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Final reasoning */}
      <div className="ai-replay-reason">
        <p className="ai-replay-eyebrow" style={{ marginBottom: 6 }}>
          Final Reasoning
        </p>
        <p>{finalReason ?? explanation}</p>
      </div>
    </div>
  );
}
