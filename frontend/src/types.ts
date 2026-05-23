export type DecisionType = 'RED_CARD' | 'YELLOW_CARD' | 'NO_CARD';
export type RuleCategoryType = 'careless' | 'reckless' | 'excessive force' | 'no offense';

export interface EvidenceMoment {
  timestamp: string;
  description: string;
}

export interface ModelTrace {
  videoAnalyzer: string;
  orchestrator: string;
  decisionModel: string;
}

export interface VARifyResult {
  decision: DecisionType;
  confidence: number;
  keyTimestamp: string;
  ruleCategory: RuleCategoryType;
  explanation: string;
  evidence: EvidenceMoment[];
  geminiSummary: string;
  modelTrace: ModelTrace;
}
