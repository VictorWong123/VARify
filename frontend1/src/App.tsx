import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Decision = "RED_CARD" | "YELLOW_CARD" | "NO_CARD" | string;

type EvidenceMoment = {
  timestamp?: string;
  timestampSeconds?: number;
  description?: string;
  observation?: string;
  videoIndex?: number;
  videoLabel?: string;
};

type AnalysisResult = {
  decision?: Decision;
  confidence?: number;
  keyTimestamp?: string;
  keyTimestamps?: string[];
  keyMoments?: EvidenceMoment[];
  explanation?: string;
  evidence?: EvidenceMoment[];
  ruleCategory?: string;
  ruleInterpretation?: string;
  geminiSummary?: string;
  modelTrace?: Record<string, unknown> | string;
};

const acceptedTypes = [".mp4", ".mov", ".webm"];
const timestampPattern = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/;
const videoLabelPattern = /\b(?:video|angle)\s+(\d+)\b/i;

function apiUrl(path: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function formatConfidence(confidence?: number) {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return "Pending";
  }

  const normalized = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(normalized)}%`;
}

function decisionClass(decision?: Decision) {
  const normalized = decision?.toLowerCase() ?? "";

  if (normalized.includes("red")) {
    return "red";
  }

  if (normalized.includes("yellow")) {
    return "yellow";
  }

  return "none";
}

function formatDecision(decision?: Decision) {
  if (!decision) {
    return "No decision returned";
  }

  return decision
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTrace(modelTrace?: AnalysisResult["modelTrace"]) {
  if (!modelTrace) {
    return "";
  }

  return typeof modelTrace === "string" ? modelTrace : JSON.stringify(modelTrace, null, 2);
}

function parseTimestampStart(timestamp?: string) {
  const match = timestamp?.match(timestampPattern);
  if (!match) {
    return null;
  }

  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  if ([hours, minutes, seconds].some(Number.isNaN)) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function timestampSecondsFor(moment: EvidenceMoment | undefined) {
  if (typeof moment?.timestampSeconds === "number" && !Number.isNaN(moment.timestampSeconds)) {
    return moment.timestampSeconds;
  }

  return parseTimestampStart(moment?.timestamp);
}

function videoIndexFromTimestamp(timestamp?: string) {
  const match = timestamp?.match(videoLabelPattern);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function displayVideoLabel(videoIndex: number | undefined, files: File[]) {
  if (!videoIndex) {
    return "";
  }

  const file = files[videoIndex - 1];
  return file ? `Video ${videoIndex}: ${file.name}` : `Video ${videoIndex}`;
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  const previewUrls = useMemo(() => files.map((nextFile) => URL.createObjectURL(nextFile)), [files]);

  useEffect(() => {
    return () => {
      if (typeof URL.revokeObjectURL === "function") {
        previewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
      }
    };
  }, [previewUrls]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    setFiles(nextFiles);
    setSelectedVideoIndex(0);
    setResult(null);
    setError(null);
  }

  function seekToTimestamp(moment: EvidenceMoment) {
    const nextVideoIndex = moment.videoIndex ?? videoIndexFromTimestamp(moment.timestamp) ?? 1;
    const nextVideoArrayIndex = Math.max(0, Math.min(files.length - 1, nextVideoIndex - 1));
    const nextTime = timestampSecondsFor(moment);
    const video = videoRefs.current[nextVideoArrayIndex];

    setSelectedVideoIndex(nextVideoArrayIndex);

    if (!video || nextTime === null) {
      return;
    }

    video.currentTime = nextTime;
    video.pause();
    video.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!files.length) {
      setError("Choose at least one soccer clip before requesting analysis.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    files.forEach((nextFile) => {
      formData.append("video", nextFile);
    });

    try {
      const response = await fetch(apiUrl("/api/analyze"), {
        method: "POST",
        credentials: "omit",
        body: formData
      });

      if (!response.ok) {
        const errorMessage = await errorMessageFor(response);
        throw new Error(errorMessage || `Analysis failed with status ${response.status}`);
      }

      const analysis = (await response.json()) as AnalysisResult;
      setResult(analysis);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Analysis failed. Check that the backend is running and model credentials are configured."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">AI match review</p>
          <h1>VARify</h1>
          <p className="subtitle">AI Referee Assistant for Card Decisions</p>
        </div>
        <div className="referee-mark" aria-hidden="true">
          <span className="card red-card" />
          <span className="card yellow-card" />
        </div>
      </section>

      <section className="workspace" aria-label="Clip analysis workspace">
        <form className="upload-panel" onSubmit={handleSubmit}>
          <label className="upload-zone">
            <input
              aria-label="Upload soccer clip"
              type="file"
              multiple
              accept={acceptedTypes.join(",")}
              onChange={handleFileChange}
            />
            <span className="upload-title">Upload match clips</span>
            <span className="upload-meta">MP4, MOV, or WEBM. Select one or more angles.</span>
          </label>

          {files.length ? (
            <div className="file-list" aria-label="Selected clips">
              {files.map((nextFile, index) => (
                <button
                  className={selectedVideoIndex === index ? "file-row active" : "file-row"}
                  key={`${nextFile.name}-${nextFile.lastModified}-${index}`}
                  onClick={() => setSelectedVideoIndex(index)}
                  type="button"
                >
                  <span>Video {index + 1}: {nextFile.name}</span>
                  <strong>{(nextFile.size / 1024 / 1024).toFixed(1)} MB</strong>
                </button>
              ))}
            </div>
          ) : null}

          {previewUrls.length ? (
            <div className="video-grid">
              {previewUrls.map((previewUrl, index) => (
                <figure
                  className={selectedVideoIndex === index ? "video-card active" : "video-card"}
                  key={`${files[index].name}-${files[index].lastModified}-${index}`}
                >
                  <figcaption>Video {index + 1}</figcaption>
                  <video
                    className="video-preview"
                    ref={(element) => {
                      videoRefs.current[index] = element;
                    }}
                    src={previewUrl}
                    controls
                  />
                </figure>
              ))}
            </div>
          ) : (
            <div className="empty-preview">Clip preview appears here</div>
          )}

          <button className="analyze-button" type="submit" disabled={isAnalyzing}>
            {isAnalyzing ? "Analyzing Clips..." : "Analyze Clips"}
          </button>

          {error ? <p className="error-message">{error}</p> : null}
        </form>

        <ResultsDashboard
          files={files}
          result={result}
          isAnalyzing={isAnalyzing}
          onTimestampClick={seekToTimestamp}
        />
      </section>
    </main>
  );
}

async function errorMessageFor(response: Response) {
  const text = await response.text();
  if (!text) {
    return "";
  }

  try {
    const parsed = JSON.parse(text) as { message?: string };
    return parsed.message ?? text;
  } catch {
    return text;
  }
}

function ResultsDashboard({
  files,
  result,
  isAnalyzing,
  onTimestampClick
}: {
  files: File[];
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  onTimestampClick: (moment: EvidenceMoment) => void;
}) {
  if (isAnalyzing) {
    return (
      <section className="results-panel loading" aria-live="polite">
        <div className="loader" />
        <h2>Reviewing foul sequence</h2>
        <p>Checking contact point, speed, player control, and rule category.</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="results-panel waiting">
        <h2>Decision dashboard</h2>
        <p>Upload clips to see card recommendation, timestamps, and evidence.</p>
      </section>
    );
  }

  const keyMoments: EvidenceMoment[] = result.keyMoments?.length
    ? result.keyMoments
    : result.keyTimestamps?.length
      ? result.keyTimestamps.map((timestamp): EvidenceMoment => ({
          timestamp,
          videoIndex: videoIndexFromTimestamp(timestamp)
        }))
      : result.keyTimestamp
        ? [{ timestamp: result.keyTimestamp, videoIndex: videoIndexFromTimestamp(result.keyTimestamp) }]
        : [];
  const evidence = result.evidence?.length ? result.evidence : [];
  const ruleInterpretation = result.ruleInterpretation ?? result.ruleCategory;
  const trace = formatTrace(result.modelTrace);

  return (
    <section className="results-panel">
      <div className="decision-grid">
        <div>
          <span className="metric-label">Decision</span>
          <strong className={`decision ${decisionClass(result.decision)}`}>
            {formatDecision(result.decision)}
          </strong>
        </div>
        <div>
          <span className="metric-label">Confidence</span>
          <strong className="confidence">{formatConfidence(result.confidence)}</strong>
        </div>
      </div>

      <div className="result-block">
        <h2>Key timestamps</h2>
        <div className="timestamp-list">
          {keyMoments.length ? (
            keyMoments.map((moment, index) => (
              <button
                key={`${moment.videoIndex ?? "video"}-${moment.timestamp ?? index}`}
                onClick={() => onTimestampClick(moment)}
                type="button"
              >
                {moment.videoLabel ?? displayVideoLabel(moment.videoIndex, files)}
                {moment.videoLabel || moment.videoIndex ? " - " : ""}
                {moment.timestamp ?? "Timestamp unavailable"}
              </button>
            ))
          ) : (
            <span>No timestamps returned</span>
          )}
        </div>
      </div>

      <div className="result-block">
        <h2>Explanation</h2>
        <p>{result.explanation ?? "No explanation returned."}</p>
      </div>

      <div className="result-block">
        <h2>Evidence</h2>
        <ul>
          {evidence.length ? (
            evidence.map((item, index) => (
              <li key={`${item.timestamp ?? "moment"}-${index}`}>
                {item.timestamp ? (
                  <button
                    className="evidence-timestamp"
                    onClick={() => onTimestampClick(item)}
                    type="button"
                  >
                    {item.videoLabel ?? displayVideoLabel(item.videoIndex, files)}
                    {item.videoLabel || item.videoIndex ? " - " : ""}
                    {item.timestamp}
                  </button>
                ) : null}
                {item.description ?? item.observation ?? "Evidence moment returned without a description."}
              </li>
            ))
          ) : (
            <li>No evidence bullets returned</li>
          )}
        </ul>
      </div>

      <div className="rule-strip">
        <span>Rule interpretation</span>
        <strong>{ruleInterpretation ?? "No rule interpretation returned"}</strong>
      </div>

      {result.geminiSummary ? (
        <div className="result-block">
          <h2>Gemini summary</h2>
          <p>{result.geminiSummary}</p>
        </div>
      ) : null}

      {trace ? (
        <details className="trace-block">
          <summary>Model trace</summary>
          <pre>{trace}</pre>
        </details>
      ) : null}
    </section>
  );
}
