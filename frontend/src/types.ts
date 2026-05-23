export type DecisionType = 'RED_CARD' | 'YELLOW_CARD' | 'NO_CARD';
export type RuleCategoryType = 'careless' | 'reckless' | 'excessive force' | 'no offense';

export interface EvidenceMoment {
  timestamp: string;
  description: string;
  videoIndex?: number | null;
  videoLabel?: string | null;
  timestampSeconds?: number | null;
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
}

export interface AngleEntry {
  id: string;
  file: File;
  label: string;
  url: string;
}
