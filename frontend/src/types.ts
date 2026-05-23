export type DecisionType = 'RED_CARD' | 'YELLOW_CARD' | 'NO_CARD';
export type RuleCategoryType = 'careless' | 'reckless' | 'excessive force' | 'no offense';

export interface Highlight {
  type: 'circle' | 'box';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidenceMoment {
  timestamp: string;
  description: string;
  videoIndex?: number | null;
  videoLabel?: string | null;
  timestampSeconds?: number | null;
  endSeconds?: number | null;
  title?: string | null;
  caption?: string | null;
  highlight?: Highlight | null;
}

export interface ModelTrace {
  videoAnalyzer?: string;
  orchestrator?: string;
  decisionModel?: string;
  [key: string]: unknown;
}

export interface VARifyResult {
  decision: DecisionType;
  confidence: number;
  keyTimestamp?: string;
  keyTimestamps?: string[];
  keyMoments?: EvidenceMoment[];
  ruleCategory: RuleCategoryType;
  explanation: string;
  evidence: EvidenceMoment[];
  geminiSummary?: string;
  modelTrace?: ModelTrace;
  voiceoverScript?: string | null;
  finalReason?: string | null;
}

export interface AngleEntry {
  id: string;
  file: File;
  label: string;
  url: string;
}
