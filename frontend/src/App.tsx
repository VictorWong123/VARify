import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Decision = "RED_CARD" | "YELLOW_CARD" | "NO_CARD" | string;

type EvidenceMoment = {
  timestamp?: string;
  description?: string;
  observation?: string;
};

type AnalysisResult = {
  decision?: Decision;
  confidence?: number;
  keyTimestamp?: string;
  keyTimestamps?: string[];
  explanation?: string;
  evidence?: EvidenceMoment[];
  ruleCategory?: string;
  ruleInterpretation?: string;
  geminiSummary?: string;
  modelTrace?: Record<string, unknown> | string;
};

const acceptedTypes = [".mp4", ".mov", ".webm"];

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

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) {
      return null;
    }

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Choose a soccer clip before requesting analysis.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("video", file);

    try {
      const response = await fetch(apiUrl("/api/analyze"), {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Analysis failed with status ${response.status}`);
      }

      const analysis = (await response.json()) as AnalysisResult;
      setResult(analysis);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Analysis failed. Check that the backend is running. API keys are not required for mock mode."
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
              accept={acceptedTypes.join(",")}
              onChange={handleFileChange}
            />
            <span className="upload-title">Upload match clip</span>
            <span className="upload-meta">MP4, MOV, or WEBM</span>
          </label>

          {file ? (
            <div className="file-row">
              <span>{file.name}</span>
              <strong>{(file.size / 1024 / 1024).toFixed(1)} MB</strong>
            </div>
          ) : null}

          {previewUrl ? (
            <video className="video-preview" src={previewUrl} controls />
          ) : (
            <div className="empty-preview">Clip preview appears here</div>
          )}

          <button className="analyze-button" type="submit" disabled={isAnalyzing}>
            {isAnalyzing ? "Analyzing Clip..." : "Analyze Clip"}
          </button>

          {error ? <p className="error-message">{error}</p> : null}
        </form>

        <ResultsDashboard result={result} isAnalyzing={isAnalyzing} />
      </section>
    </main>
  );
}

function ResultsDashboard({
  result,
  isAnalyzing
}: {
  result: AnalysisResult | null;
  isAnalyzing: boolean;
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
        <p>Upload a clip to see card recommendation, timestamps, and evidence.</p>
      </section>
    );
  }

  const timestamps = result.keyTimestamps?.length
    ? result.keyTimestamps
    : result.keyTimestamp
      ? [result.keyTimestamp]
      : ["No timestamps returned"];
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
          {timestamps.map((timestamp) => (
            <span key={timestamp}>{timestamp}</span>
          ))}
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
                {item.timestamp ? <strong>{item.timestamp}: </strong> : null}
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
