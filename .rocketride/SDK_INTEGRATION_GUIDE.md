# RocketRide SDK Integration Guide for VARify

This guide explains how to integrate RocketRide pipelines into the VARify backend using Python or TypeScript SDKs.

## Installation

### Python SDK

```bash
pip install rocketride
```

### TypeScript/Node.js SDK

```bash
npm install rocketride
# or
pnpm add rocketride
```

## Quick Start

### Python Example

```python
from rocketride import RocketRideClient
import asyncio

async def main():
    client = RocketRideClient()
    await client.connect()
    
    # Load pipeline
    result = await client.use(filepath='.rocketride/pipelines/referee-decision.pipe')
    token = result['token']
    
    # Send data
    await client.send(token, "Player X committed a hard tackle")
    
    # Wait for result
    status = await client.get_task_status(token)
    while status['state'] != 'completed':
        status = await client.get_task_status(token)
    
    result = await client.get_task_result(token)
    print(f"Decision: {result}")
    
    await client.disconnect()

asyncio.run(main())
```

### TypeScript Example

```typescript
import { RocketRideClient } from 'rocketride';

async function main() {
  const client = new RocketRideClient({
    apiKey: process.env.ROCKETRIDE_APIKEY,
    uri: process.env.ROCKETRIDE_URI || 'https://cloud.rocketride.ai',
  });

  await client.connect();

  // Load pipeline
  const result = await client.use({
    filepath: '.rocketride/pipelines/referee-decision.pipe',
  });

  const token = result.token;

  // Send data
  await client.send(token, 'Player X committed a hard tackle');

  // Wait for result
  let status = await client.get_task_status(token);
  while (status.state !== 'completed') {
    status = await client.get_task_status(token);
  }

  const decision = await client.get_task_result(token);
  console.log(`Decision: ${decision}`);

  await client.disconnect();
}

main().catch(console.error);
```

## Integration Patterns

### Pattern 1: Simple Pipeline Execution

**When to use:** For straightforward operations that need one pipeline call

```python
async def get_referee_decision(evidence: str) -> dict:
    client = RocketRideClient()
    await client.connect()
    
    result = await client.use(filepath='.rocketride/pipelines/referee-decision.pipe')
    await client.send(result['token'], evidence)
    
    # Wait and get result...
    
    await client.disconnect()
    return result
```

### Pattern 2: Pipeline Manager Class

**When to use:** For production systems with multiple pipeline calls

```python
class RocketRidePipelineManager:
    def __init__(self):
        self.client = RocketRideClient()
        self._connected = False
    
    async def connect(self):
        await self.client.connect()
        self._connected = True
    
    async def execute_pipeline(self, pipeline_path: str, input_data: str):
        if not self._connected:
            raise RuntimeError("Not connected")
        
        result = await self.client.use(filepath=pipeline_path)
        await self.client.send(result['token'], input_data)
        # Wait and return...
    
    async def disconnect(self):
        await self.client.disconnect()
        self._connected = False
```

### Pattern 3: Spring Boot Integration (Java)

**When to use:** For the existing VARify backend

See `RocketRidePipelineService.java` for Java integration with Spring Boot.

## Configuration

### Environment Variables

```bash
# Required
ROCKETRIDE_APIKEY=your-api-key

# Optional (with defaults)
ROCKETRIDE_URI=https://cloud.rocketride.ai
GMI_BASE_URL=https://api.gmi-serving.com
GMI_API_KEY=your-gmi-key
GOOGLE_AI_KEY=your-google-key
```

### Configuration File (Python)

```python
import os
from dotenv import load_dotenv

load_dotenv()

ROCKETRIDE_CONFIG = {
    'apiKey': os.getenv('ROCKETRIDE_APIKEY'),
    'uri': os.getenv('ROCKETRIDE_URI', 'https://cloud.rocketride.ai'),
    'models': {
        'gmi': {
            'baseUrl': os.getenv('GMI_BASE_URL'),
            'apiKey': os.getenv('GMI_API_KEY'),
        },
        'google': {
            'apiKey': os.getenv('GOOGLE_AI_KEY'),
        },
    },
}
```

## Error Handling

### Python Error Handling

```python
async def safe_pipeline_execution(pipeline_path: str, input_data: str):
    client = RocketRideClient()
    
    try:
        await client.connect()
        
        result = await client.use(filepath=pipeline_path)
        token = result['token']
        
        await client.send(token, input_data)
        
        status = await client.get_task_status(token)
        if status['state'] == 'failed':
            raise Exception(f"Pipeline failed: {status.get('error')}")
        
        return await client.get_task_result(token)
        
    except Exception as e:
        print(f"Error: {e}")
        # Return fallback response
        return {'decision': 'NO_CARD', 'confidence': 0, 'error': str(e)}
    
    finally:
        await client.disconnect()
```

### TypeScript Error Handling

```typescript
async function safePipelineExecution(
  pipelinePath: string,
  inputData: string
): Promise<any> {
  const client = new RocketRideClient({
    apiKey: process.env.ROCKETRIDE_APIKEY,
  });

  try {
    await client.connect();

    const result = await client.use({ filepath: pipelinePath });
    const token = result.token;

    await client.send(token, inputData);

    let status = await client.get_task_status(token);
    if (status.state === 'failed') {
      throw new Error(`Pipeline failed: ${status.error}`);
    }

    return await client.get_task_result(token);
  } catch (error) {
    console.error('Error:', error);
    // Return fallback response
    return {
      decision: 'NO_CARD',
      confidence: 0,
      error: String(error),
    };
  } finally {
    await client.disconnect();
  }
}
```

## Polling vs. Streaming

### Polling Pattern (Simple)

```python
status = await client.get_task_status(token)
while status['state'] not in ['completed', 'failed']:
    await asyncio.sleep(1)
    status = await client.get_task_status(token)
```

### Streaming Pattern (Advanced)

```python
async for event in client.get_events(token):
    if event['type'] == 'completion':
        print(f"Completed: {event['data']}")
    elif event['type'] == 'error':
        print(f"Error: {event['data']}")
```

## Testing Pipelines

### Unit Test Example (Python)

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_referee_decision_pipeline():
    with patch('rocketride.RocketRideClient') as mock_client:
        mock_instance = AsyncMock()
        mock_client.return_value = mock_instance
        
        mock_instance.use.return_value = {'token': 'test-token'}
        mock_instance.get_task_status.return_value = {'state': 'completed'}
        mock_instance.get_task_result.return_value = {
            'decision': 'RED_CARD',
            'confidence': 95
        }
        
        # Test execution...
        result = await execute_referee_decision("test evidence")
        
        assert result['decision'] == 'RED_CARD'
        assert result['confidence'] == 95
```

### Unit Test Example (TypeScript)

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('RocketRide Integration', () => {
  it('should execute referee decision pipeline', async () => {
    const mockClient = {
      connect: vi.fn(),
      use: vi.fn().mockResolvedValue({ token: 'test-token' }),
      send: vi.fn(),
      get_task_status: vi.fn().mockResolvedValue({ state: 'completed' }),
      get_task_result: vi.fn().mockResolvedValue({
        decision: 'RED_CARD',
        confidence: 95,
      }),
      disconnect: vi.fn(),
    };

    // Test execution...
    const result = await executeRefereeDecision('test evidence');

    expect(result.decision).toBe('RED_CARD');
    expect(result.confidence).toBe(95);
  });
});
```

## Performance Considerations

### Timeout Configuration

```python
# Python: Set appropriate timeouts
async def execute_with_timeout(pipeline_path: str, input_data: str, timeout_seconds: int = 30):
    try:
        return await asyncio.wait_for(
            safe_pipeline_execution(pipeline_path, input_data),
            timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        return {'error': 'Pipeline execution timeout'}
```

### Connection Pooling

```python
# Reuse connections for multiple calls
class PipelinePool:
    def __init__(self, size: int = 5):
        self.pool = [RocketRideClient() for _ in range(size)]
        self.available = asyncio.Queue()
        
        for client in self.pool:
            self.available.put_nowait(client)
    
    async def execute(self, pipeline_path: str, input_data: str):
        client = await self.available.get()
        try:
            await client.connect()
            # Execute pipeline...
            return result
        finally:
            self.available.put_nowait(client)
```

## Monitoring & Observability

### Logging Pipeline Execution

```python
import logging

logger = logging.getLogger(__name__)

async def execute_with_logging(pipeline_path: str, input_data: str):
    logger.info(f"Starting pipeline: {pipeline_path}")
    
    client = RocketRideClient()
    try:
        await client.connect()
        logger.debug("Connected to RocketRide")
        
        result = await client.use(filepath=pipeline_path)
        token = result['token']
        logger.info(f"Pipeline started with token: {token}")
        
        await client.send(token, input_data)
        logger.debug(f"Sent input data: {input_data[:100]}...")
        
        status = await client.get_task_status(token)
        while status['state'] not in ['completed', 'failed']:
            await asyncio.sleep(1)
            status = await client.get_task_status(token)
        
        logger.info(f"Pipeline {token} finished with state: {status['state']}")
        return await client.get_task_result(token)
        
    except Exception as e:
        logger.error(f"Pipeline execution failed: {e}")
        raise
    
    finally:
        await client.disconnect()
```

### Metrics Collection

```python
import time
from prometheus_client import Histogram, Counter

pipeline_duration = Histogram('rocketride_pipeline_duration_seconds', 'Pipeline execution time')
pipeline_errors = Counter('rocketride_pipeline_errors_total', 'Total pipeline errors')

async def execute_with_metrics(pipeline_path: str, input_data: str):
    start_time = time.time()
    
    try:
        result = await safe_pipeline_execution(pipeline_path, input_data)
        duration = time.time() - start_time
        pipeline_duration.observe(duration)
        return result
    except Exception as e:
        pipeline_errors.inc()
        raise
```

## Next Steps

1. Install RocketRide SDK (`pip install rocketride` or `npm install rocketride`)
2. Set up environment variables
3. Copy SDK integration code to your backend
4. Test with example pipelines
5. Implement error handling and monitoring
6. Deploy to production

## References

- **SDK Documentation:** `.rocketride/docs/ROCKETRIDE_python_API.md` (Python) or `.rocketride/docs/ROCKETRIDE_typescript_API.md` (TypeScript)
- **Pipeline Rules:** `.rocketride/docs/ROCKETRIDE_PIPELINE_RULES.md`
- **Examples:** `.rocketride/sdk/`
- **Pipelines:** `.rocketride/pipelines/`
