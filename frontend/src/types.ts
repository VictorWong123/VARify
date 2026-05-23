export type Decision = 'Yellow Card' | 'Red Card' | 'No Card';

export interface AnalyzeTimestamps {
  start: string;
  end: string;
  label: string;
}

export interface AnalyzeResult {
  decision: Decision;
  decisionSubtitle: string;
  reasoning: string;
  timestamps: AnalyzeTimestamps;
  confidence: number;
  originalClipUrl?: string;
  aiReviewVideoUrl?: string;
}
