# RocketRide Workflow Setup Guide for VARify

This directory contains RocketRide pipeline configurations for the VARify referee decision system.

## Quick Start

### 1. Configuration

Copy the environment template and configure your API keys:

```bash
cp .rocketride/config/rocketride.env.example .env
```

Edit `.env` and set your API keys:
- `ROCKETRIDE_APIKEY` - Your RocketRide API key
- `GMI_API_KEY` - GMI model provider API key
- `GMI_BASE_URL` - GMI base URL (defaults to https://api.gmi-serving.com)
- `GOOGLE_AI_KEY` - Google AI API key (for Gemini models)

### 2. Model Configuration

The `config/models.yml` defines available models:

```yaml
models:
  - name: gmi-h100
    provider: openai-compatible
    base_url: ${GMI_BASE_URL}
    api_key: ${GMI_API_KEY}
    default_model: meta-llama/Llama-3.1-70B-Instruct

  - name: gemini
    provider: google
    api_key: ${GOOGLE_AI_KEY}
    default_model: gemini-2.0-flash
```

You can use either model in your pipelines via the `provider` field.

## Available Pipelines

### 1. Referee Decision Pipeline (`pipelines/referee-decision.pipe`)

**Purpose:** Analyze evidence and make referee decisions

**Flow:**
1. **Input** - Webhook receives evidence description
2. **Referee Analyzer** - LLM analyzes evidence and makes decision
3. **Output** - Returns decision with reasoning

**Usage in Backend:**
```java
RefereeDecisionResponse response = rocketRidePipelineService
    .executeRefereeDecisionPipeline(request);
```

### 2. Video Analysis Pipeline (`pipelines/video-analysis.pipe`)

**Purpose:** Analyze video evidence moments

**Flow:**
1. **Input** - Webhook receives video metadata
2. **Evidence Extractor** - Extract key moments
3. **Video Analyzer** - LLM generates analysis report
4. **Output** - Returns detailed analysis

**Usage in Backend:**
```java
String analysis = rocketRidePipelineService
    .executeVideoAnalysisPipeline(videoPath);
```

## Building New Workflows

### Step 1: Use the Template

Copy `pipelines/TEMPLATE.pipe` as your starting point:

```bash
cp .rocketride/pipelines/TEMPLATE.pipe .rocketride/pipelines/my-workflow.pipe
```

### Step 2: Update the Project ID

Generate a unique GUID (PowerShell: `[guid]::NewGuid().ToString()`):

```json
{
  "project_id": "your-unique-guid-here",
  ...
}
```

### Step 3: Define Components

Add processing steps between input and output:

```json
{
  "id": "my-processor",
  "provider": "llm",
  "config": {
    "model": "${GMI_MODEL:meta-llama/Llama-3.1-70B-Instruct}",
    "provider": "gmi-h100",
    "temperature": 0.7,
    "max_tokens": 2000,
    "system_prompt": "Your system prompt here"
  },
  "input": [
    {
      "lane": "text",
      "from": "previous-component-id"
    }
  ]
}
```

### Step 4: Wire Components

Use the `input` field to connect components:

```json
"input": [
  {
    "lane": "text",
    "from": "component-id"
  }
]
```

### Step 5: Add Output Component

Always end with a response component:

```json
{
  "id": "output",
  "provider": "response_text",
  "config": {},
  "input": [
    {
      "lane": "text",
      "from": "last-processor-id"
    }
  ]
}
```

## Available Component Providers

| Provider | Purpose | Inputs | Outputs |
|----------|---------|--------|---------|
| `webhook` | Receive data | - | `text` |
| `llm` | Process with language model | `text` | `text` |
| `transform` | Transform data | `text` | `text` |
| `response_text` | Return text response | `text` | - |
| `response_json` | Return JSON response | `json` | - |
| `response_documents` | Return documents | `documents` | - |

## Data Lanes

Components communicate via typed lanes:

| Lane | Type | Example |
|------|------|---------|
| `text` | String data | Analysis results, descriptions |
| `json` | JSON objects | Structured data, metadata |
| `documents` | Document list | PDFs, extracted text |
| `answers` | Q&A results | Question-answer pairs |

## Environment Variables

Use `${VAR_NAME}` syntax in pipeline configs:

```json
{
  "model": "${GMI_MODEL:meta-llama/Llama-3.1-70B-Instruct}",
  "api_key": "${GMI_API_KEY}"
}
```

Provide defaults with `:` syntax - `${VAR_NAME:default-value}`

## Backend Integration

The Java service `RocketRidePipelineService` provides pipeline execution:

```java
@Autowired
private RocketRidePipelineService pipelineService;

// Execute referee decision pipeline
RefereeDecisionResponse decision = pipelineService
    .executeRefereeDecisionPipeline(request);

// Execute video analysis pipeline
String analysis = pipelineService
    .executeVideoAnalysisPipeline(videoPath);
```

## Testing Workflows

### Manual Testing

1. Open the RocketRide VSCode extension
2. Navigate to `.rocketride/pipelines/`
3. Open your `.pipe` file
4. Use the visual builder to test the workflow
5. Send test data via the webhook component

### Programmatic Testing

```java
@Test
public void testRefereeDecisionPipeline() {
    RefereeDecisionRequest request = new RefereeDecisionRequest();
    request.setDescription("Player appeared to foul opponent");
    
    RefereeDecisionResponse response = pipelineService
        .executeRefereeDecisionPipeline(request);
    
    assertNotNull(response.getDecision());
}
```

## Documentation

For detailed information, see:

- `.rocketride/docs/ROCKETRIDE_README.md` - Overview and setup
- `.rocketride/docs/ROCKETRIDE_PIPELINE_RULES.md` - Pipeline structure rules
- `.rocketride/docs/ROCKETRIDE_COMPONENT_REFERENCE.md` - All components
- `.rocketride/docs/ROCKETRIDE_COMMON_MISTAKES.md` - Common pitfalls
- `.rocketride/docs/ROCKETRIDE_python_API.md` - Python SDK reference
- `.rocketride/docs/ROCKETRIDE_typescript_API.md` - TypeScript SDK reference

## Next Steps

1. ✅ Configure `.env` with your API keys
2. ✅ Review the example pipelines (referee-decision.pipe, video-analysis.pipe)
3. 🔲 Create your first custom workflow by copying TEMPLATE.pipe
4. 🔲 Test it in the RocketRide VSCode extension
5. 🔲 Implement pipeline execution in `RocketRidePipelineService.java`
6. 🔲 Integrate with your controller endpoints

Happy building! 🚀
