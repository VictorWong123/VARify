import { useCallback, useRef, useState } from 'react';
import { RocketRideClient } from 'rocketride';
import type {
  PipelineComponent,
  PipelineDefinition,
  PipelineExecutionState,
  PipelineNodeState,
  NodeStatus,
} from './pipeline-types';
import { providerLabel } from './pipeline-types';

function buildInitialState(pipeline: PipelineDefinition): PipelineExecutionState {
  const nodes: PipelineNodeState[] = pipeline.components.map((c) => ({
    id: c.id,
    provider: c.provider,
    label: providerLabel(c.provider, c.id),
    status: 'idle' as NodeStatus,
    description: c.config?.system_prompt?.slice(0, 80) ?? c.config?.description ?? undefined,
  }));

  const edges: Array<{ from: string; to: string; lane: string }> = [];
  for (const comp of pipeline.components) {
    if (comp.input) {
      for (const inp of comp.input) {
        edges.push({ from: inp.from, to: comp.id, lane: inp.lane });
      }
    }
  }

  return {
    status: 'idle',
    nodes,
    edges,
    activeNodeId: null,
  };
}

function topologicalOrder(components: PipelineComponent[]): string[] {
  const idSet = new Set(components.map((c) => c.id));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const c of components) {
    inDegree.set(c.id, 0);
    adj.set(c.id, []);
  }
  for (const c of components) {
    if (c.input) {
      for (const inp of c.input) {
        if (idSet.has(inp.from)) {
          adj.get(inp.from)!.push(c.id);
          inDegree.set(c.id, (inDegree.get(c.id) ?? 0) + 1);
        }
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }
  return order;
}

interface UseRocketRidePipelineOptions {
  uri?: string;
  apiKey?: string;
  pipeline: PipelineDefinition;
}

export function useRocketRidePipeline({ uri, apiKey, pipeline }: UseRocketRidePipelineOptions) {
  const [state, setState] = useState<PipelineExecutionState>(() => buildInitialState(pipeline));
  const clientRef = useRef<RocketRideClient | null>(null);
  const abortRef = useRef(false);

  const setNodeStatus = useCallback((nodeId: string, status: NodeStatus) => {
    setState((prev) => ({
      ...prev,
      activeNodeId: status === 'active' ? nodeId : prev.activeNodeId,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId ? { ...n, status } : n
      ),
    }));
  }, []);

  const execute = useCallback(async (inputData: string) => {
    abortRef.current = false;
    const initial = buildInitialState(pipeline);
    setState({ ...initial, status: 'connecting', startedAt: Date.now() });

    const rocketrideUri = uri || (import.meta as any).env?.VITE_ROCKETRIDE_URI || 'https://cloud.rocketride.ai';
    const rocketrideKey = apiKey || (import.meta as any).env?.VITE_ROCKETRIDE_APIKEY || '';

    try {
      const client = new RocketRideClient({
        uri: rocketrideUri,
        auth: rocketrideKey,
      });
      clientRef.current = client;

      await client.connect();
      setState((prev) => ({ ...prev, status: 'running' }));

      const order = topologicalOrder(pipeline.components);

      // Activate the source node immediately
      if (order.length > 0) {
        setNodeStatus(order[0], 'active');
      }

      const result = await client.use({
        pipeline: {
          ...pipeline,
          source: order[0],
        },
      });
      const token = result.token;

      // Mark source as complete and advance through nodes
      if (order.length > 0) {
        setNodeStatus(order[0], 'complete');
      }

      // Send data to the pipeline
      for (let i = 1; i < order.length; i++) {
        if (abortRef.current) break;
        const nodeId = order[i];
        setNodeStatus(nodeId, 'active');

        // Simulate per-node progression (actual execution is server-side)
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

        if (abortRef.current) break;
        setNodeStatus(nodeId, 'complete');
      }

      // Send data and get response
      const response = await client.send(token, inputData);

      await client.disconnect();
      clientRef.current = null;

      setState((prev) => ({
        ...prev,
        status: 'complete',
        activeNodeId: null,
        completedAt: Date.now(),
      }));

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      setState((prev) => ({
        ...prev,
        status: 'error',
        error: message,
        activeNodeId: null,
      }));

      if (clientRef.current) {
        try { await clientRef.current.disconnect(); } catch { /* ignore */ }
        clientRef.current = null;
      }

      throw err;
    }
  }, [pipeline, uri, apiKey, setNodeStatus]);

  const simulateExecution = useCallback(async (durationMs = 6000) => {
    abortRef.current = false;
    const initial = buildInitialState(pipeline);
    setState({ ...initial, status: 'connecting', startedAt: Date.now() });

    await new Promise((r) => setTimeout(r, 400));
    if (abortRef.current) return;

    setState((prev) => ({ ...prev, status: 'running' }));

    const order = topologicalOrder(pipeline.components);
    const perNode = durationMs / order.length;

    for (let i = 0; i < order.length; i++) {
      if (abortRef.current) break;
      const nodeId = order[i];
      setNodeStatus(nodeId, 'active');
      await new Promise((r) => setTimeout(r, perNode));
      if (abortRef.current) break;
      setNodeStatus(nodeId, 'complete');
    }

    if (!abortRef.current) {
      setState((prev) => ({
        ...prev,
        status: 'complete',
        activeNodeId: null,
        completedAt: Date.now(),
      }));
    }
  }, [pipeline, setNodeStatus]);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState(buildInitialState(pipeline));
  }, [pipeline]);

  const cancel = useCallback(async () => {
    abortRef.current = true;
    if (clientRef.current) {
      try { await clientRef.current.disconnect(); } catch { /* ignore */ }
      clientRef.current = null;
    }
    setState((prev) => ({ ...prev, status: 'idle', activeNodeId: null }));
  }, []);

  return { state, execute, simulateExecution, reset, cancel };
}
