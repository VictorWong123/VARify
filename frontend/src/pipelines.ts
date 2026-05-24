import type { PipelineDefinition } from './pipeline-types';

export const REFEREE_DECISION_PIPELINE: PipelineDefinition = {
  components: [
    { id: 'input', provider: 'webhook', config: {} },
    {
      id: 'referee_analyzer',
      provider: 'llm',
      config: {
        model: 'meta-llama/Llama-3.1-70B-Instruct',
        provider: 'gmi-h100',
        temperature: 0.7,
        max_tokens: 2000,
        system_prompt: 'Analyze the provided evidence and make a fair decision on the contested play.',
      },
      input: [{ lane: 'text', from: 'input' }],
    },
    {
      id: 'output',
      provider: 'response_text',
      config: {},
      input: [{ lane: 'text', from: 'referee_analyzer' }],
    },
  ],
  project_id: 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
  version: 1,
};

export const REFEREE_DECISION_ADVANCED_PIPELINE: PipelineDefinition = {
  components: [
    { id: 'input', provider: 'webhook', config: {} },
    {
      id: 'evidence_extractor',
      provider: 'llm_gmi_cloud',
      config: {
        model: 'meta-llama/Llama-3.1-70B-Instruct',
        temperature: 0.3,
        system_prompt: 'Extract and summarize key evidence moments from the provided video analysis.',
      },
      input: [{ lane: 'text', from: 'input' }],
    },
    {
      id: 'referee_decision',
      provider: 'llm_gmi_cloud',
      config: {
        model: 'meta-llama/Llama-3.1-70B-Instruct',
        temperature: 0.5,
        system_prompt: 'Make a decision: RED_CARD, YELLOW_CARD, or NO_CARD. Provide reasoning and confidence.',
      },
      input: [{ lane: 'text', from: 'evidence_extractor' }],
    },
    {
      id: 'output',
      provider: 'response_text',
      config: {},
      input: [{ lane: 'text', from: 'referee_decision' }],
    },
  ],
  project_id: 'c3d4e5f6-a7b8-49ca-d1e2-f3a4b5c6d7e8',
  version: 1,
};

export const VIDEO_ANALYSIS_PIPELINE: PipelineDefinition = {
  components: [
    { id: 'input', provider: 'webhook', config: {} },
    {
      id: 'evidence_extractor',
      provider: 'transform',
      config: { description: 'Extract key evidence moments from video metadata' },
      input: [{ lane: 'text', from: 'input' }],
    },
    {
      id: 'video_analyzer',
      provider: 'llm',
      config: {
        model: 'meta-llama/Llama-3.1-70B-Instruct',
        temperature: 0.5,
        system_prompt: 'Analyze the video evidence moments and generate a comprehensive analysis report.',
      },
      input: [{ lane: 'text', from: 'evidence_extractor' }],
    },
    {
      id: 'output',
      provider: 'response_text',
      config: {},
      input: [{ lane: 'text', from: 'video_analyzer' }],
    },
  ],
  project_id: 'b2c3d4e5-f6a7-48b9-c0d1-e2f3a4b5c6d7',
  version: 1,
};

export const VIDEO_ANALYSIS_MULTI_STEP_PIPELINE: PipelineDefinition = {
  components: [
    { id: 'input', provider: 'webhook', config: {} },
    {
      id: 'video_context_extractor',
      provider: 'llm_gmi_cloud',
      config: {
        temperature: 0.3,
        system_prompt: 'Extract players involved, type of play, location on field, and game context.',
      },
      input: [{ lane: 'text', from: 'input' }],
    },
    {
      id: 'rule_checker',
      provider: 'llm_gmi_cloud',
      config: {
        temperature: 0.4,
        system_prompt: 'Identify which FIFA Laws of the Game apply: Fouls, Violent Conduct, Excessive Force, etc.',
      },
      input: [{ lane: 'text', from: 'video_context_extractor' }],
    },
    {
      id: 'final_decision',
      provider: 'llm_gmi_cloud',
      config: {
        temperature: 0.6,
        system_prompt: 'Make final decision. Output JSON: {decision, confidence, rule_applied, explanation}',
      },
      input: [{ lane: 'text', from: 'rule_checker' }],
    },
    {
      id: 'output',
      provider: 'response_text',
      config: {},
      input: [{ lane: 'text', from: 'final_decision' }],
    },
  ],
  project_id: 'd4e5f6a7-b8c9-4ada-e2f3-a4b5c6d7e8f9',
  version: 1,
};

export const PIPELINES = {
  'referee-decision': { name: 'Referee Decision', pipeline: REFEREE_DECISION_PIPELINE },
  'referee-decision-advanced': { name: 'Referee Decision (Advanced)', pipeline: REFEREE_DECISION_ADVANCED_PIPELINE },
  'video-analysis': { name: 'Video Analysis', pipeline: VIDEO_ANALYSIS_PIPELINE },
  'video-analysis-multi-step': { name: 'Video Analysis (Multi-Step)', pipeline: VIDEO_ANALYSIS_MULTI_STEP_PIPELINE },
} as const;

export type PipelineKey = keyof typeof PIPELINES;
