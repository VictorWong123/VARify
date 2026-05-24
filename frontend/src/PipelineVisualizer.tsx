import { useMemo } from 'react';
import type { PipelineExecutionState, NodeStatus } from './pipeline-types';
import { providerColor } from './pipeline-types';

function StatusDot({ status }: { status: NodeStatus }) {
  const cls = `rr-node-dot rr-node-dot--${status}`;
  return <span className={cls} aria-label={status} />;
}

function NodeBox({
  id,
  label,
  provider,
  status,
  description,
  isLast,
}: {
  id: string;
  label: string;
  provider: string;
  status: NodeStatus;
  description?: string;
  isLast: boolean;
}) {
  const color = providerColor(provider);
  const borderStyle =
    status === 'active'
      ? { borderColor: color, boxShadow: `0 0 12px ${color}44` }
      : status === 'complete'
        ? { borderColor: color, opacity: 1 }
        : {};

  return (
    <div className={`rr-node rr-node--${status}`} style={borderStyle} data-provider={provider}>
      <div className="rr-node-header">
        <StatusDot status={status} />
        <span className="rr-node-label">{label}</span>
      </div>
      {description && <p className="rr-node-desc">{description}</p>}
      <span className="rr-node-id">{id}</span>
      {!isLast && <div className={`rr-edge rr-edge--${status === 'complete' ? 'done' : 'idle'}`} />}
    </div>
  );
}

interface PipelineVisualizerProps {
  state: PipelineExecutionState;
  pipelineName?: string;
}

export default function PipelineVisualizer({ state, pipelineName }: PipelineVisualizerProps) {
  const elapsed = useMemo(() => {
    if (!state.startedAt) return null;
    const end = state.completedAt ?? Date.now();
    return ((end - state.startedAt) / 1000).toFixed(1);
  }, [state.startedAt, state.completedAt]);

  const statusLabel = {
    idle: 'Ready',
    connecting: 'Connecting…',
    running: 'Executing Pipeline',
    complete: 'Complete',
    error: 'Failed',
  }[state.status];

  return (
    <div className="rr-visualizer">
      <div className="rr-header">
        <div className="rr-header-left">
          <span className="rr-logo">⚡</span>
          <span className="rr-title">RocketRide Pipeline</span>
          {pipelineName && <span className="rr-pipeline-name">{pipelineName}</span>}
        </div>
        <div className="rr-header-right">
          <span className={`rr-status rr-status--${state.status}`}>{statusLabel}</span>
          {elapsed && <span className="rr-elapsed">{elapsed}s</span>}
        </div>
      </div>

      <div className="rr-flow">
        {state.nodes.map((node, i) => (
          <NodeBox
            key={node.id}
            id={node.id}
            label={node.label}
            provider={node.provider}
            status={node.status}
            description={node.description}
            isLast={i === state.nodes.length - 1}
          />
        ))}
      </div>

      {state.error && <div className="rr-error">{state.error}</div>}

      {state.status === 'running' && (
        <div className="rr-progress-bar">
          <div
            className="rr-progress-fill"
            style={{
              width: `${(state.nodes.filter((n) => n.status === 'complete').length / state.nodes.length) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
