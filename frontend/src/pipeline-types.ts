export interface PipelineComponent {
  id: string;
  provider: string;
  config: Record<string, any>;
  input?: Array<{ lane: string; from: string }>;
  ui?: {
    position?: { x: number; y: number };
    measured?: { width: number; height: number };
  };
}

export interface PipelineDefinition {
  components: PipelineComponent[];
  project_id: string;
  viewport?: { x: number; y: number; zoom: number };
  version: number;
}

export type NodeStatus = 'idle' | 'active' | 'complete' | 'error';

export interface PipelineNodeState {
  id: string;
  provider: string;
  label: string;
  status: NodeStatus;
  description?: string;
  elapsed?: number;
}

export type PipelineExecutionStatus =
  | 'idle'
  | 'connecting'
  | 'running'
  | 'complete'
  | 'error';

export interface PipelineExecutionState {
  status: PipelineExecutionStatus;
  nodes: PipelineNodeState[];
  edges: Array<{ from: string; to: string; lane: string }>;
  activeNodeId: string | null;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export const PROVIDER_META: Record<string, { label: string; icon: string; color: string }> = {
  webhook: { label: 'Input', icon: '↓', color: '#3b82f6' },
  llm: { label: 'AI Model', icon: '◆', color: '#8b5cf6' },
  llm_gmi_cloud: { label: 'GMI Cloud', icon: '◆', color: '#f59e0b' },
  llm_openai: { label: 'OpenAI', icon: '◆', color: '#10b981' },
  transform: { label: 'Transform', icon: '⟳', color: '#06b6d4' },
  response_text: { label: 'Output', icon: '↑', color: '#22c55e' },
  response_answers: { label: 'Output', icon: '↑', color: '#22c55e' },
};

export function providerLabel(provider: string, id: string): string {
  if (PROVIDER_META[provider]) return PROVIDER_META[provider].label;
  const cleaned = id.replace(/_/g, ' ').replace(/\d+$/, '').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function providerColor(provider: string): string {
  return PROVIDER_META[provider]?.color ?? '#6b7280';
}
