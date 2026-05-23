# RocketRide Quick Reference Card

## Setup (5 minutes)

```bash
# 1. Copy environment template
cp .rocketride/config/rocketride.env.example .env

# 2. Edit .env with your API keys
# ROCKETRIDE_APIKEY=<your-key>
# GMI_API_KEY=<your-key>
# GOOGLE_AI_KEY=<your-key>

# 3. Add to .gitignore (if not already there)
echo ".env" >> .gitignore
```

## Pipeline File Template

```json
{
	"components": [
		{
			"id": "input",
			"provider": "webhook",
			"config": {}
		},
		{
			"id": "processor",
			"provider": "llm",
			"config": {
				"model": "${GMI_MODEL:meta-llama/Llama-3.1-70B-Instruct}",
				"provider": "gmi-h100",
				"temperature": 0.7,
				"max_tokens": 2000,
				"system_prompt": "Your instruction here"
			},
			"input": [{ "lane": "text", "from": "input" }]
		},
		{
			"id": "output",
			"provider": "response_text",
			"config": {},
			"input": [{ "lane": "text", "from": "processor" }]
		}
	],
	"project_id": "GENERATE-NEW-GUID-HERE",
	"viewport": { "x": 0, "y": 0, "zoom": 1 },
	"version": 1
}
```

## Generate GUID

**PowerShell:**
```powershell
[guid]::NewGuid().ToString()
```

**Output example:** `a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6`

## Component Types

| Type | Purpose | Input | Output |
|------|---------|-------|--------|
| `webhook` | Receive data | - | `text` |
| `llm` | LLM processing | `text` | `text` |
| `transform` | Data transform | `text` | `text` |
| `response_text` | Send text response | `text` | - |
| `response_json` | Send JSON response | `json` | - |

## Available Models

**GMI (gmi-h100):**
- Model: `meta-llama/Llama-3.1-70B-Instruct`
- Provider: `openai-compatible`
- Use: Complex reasoning, long analysis

**Gemini:**
- Model: `gemini-2.0-flash`
- Provider: `google`
- Use: Quick tasks, classification

## LLM Component Config

```json
{
	"model": "meta-llama/Llama-3.1-70B-Instruct",
	"provider": "gmi-h100",
	"temperature": 0.7,        // 0-1, higher = more creative
	"max_tokens": 2000,         // Max response length
	"system_prompt": "You are..." // Role/instruction
}
```

## Common Patterns

### Decision Making
```
Input → LLM (decision prompt) → Output
```

### Analysis
```
Input → Transform (extract) → LLM (analyze) → Output
```

### Classification
```
Input → LLM (classify) → Output
```

### Multi-Step Processing
```
Input → Transform-1 → LLM-1 → Transform-2 → LLM-2 → Output
```

## Environment Variables in Pipelines

```json
{
	"model": "${GMI_MODEL:default-model}",
	"api_key": "${GMI_API_KEY}"
}
```

Format: `${VAR_NAME:default-value}`
- If `VAR_NAME` exists in `.env`, use that value
- Otherwise use `default-value`
- If no default, variable must exist in `.env`

## Component Connection

Connect components via `input` field:

```json
{
	"id": "next_step",
	"provider": "llm",
	"config": { ... },
	"input": [
		{
			"lane": "text",
			"from": "previous_component_id"
		}
	]
}
```

## Data Lanes

| Lane | Type | Example |
|------|------|---------|
| `text` | String | Descriptions, analysis |
| `json` | Object | Structured data |
| `documents` | Array | PDFs, extracted text |
| `answers` | Object | Q&A pairs |

## Testing Pipeline

1. Open `.rocketride/pipelines/your-pipeline.pipe` in VSCode
2. Install RocketRide extension (if needed)
3. Click "Run Pipeline" in extension UI
4. Send test data via webhook input
5. Review output

## Java Integration Template

```java
@Service
public class RocketRidePipelineService {
    
    private final RocketRideProperties properties;
    
    public RocketRidePipelineService(RocketRideProperties properties) {
        this.properties = properties;
    }
    
    public String executePipeline(String input) {
        // 1. Create client
        // RocketRideClient client = new RocketRideClient(properties.getUri(), 
        //                                                 properties.getApiKey());
        
        // 2. Load pipeline
        // String pipeline = loadPipelineFile("pipelines/my-pipeline.pipe");
        
        // 3. Send data
        // String token = client.sendPipeline(pipeline);
        
        // 4. Wait for result
        // String result = client.getResult(token);
        
        // 5. Return response
        // return result;
        
        throw new UnsupportedOperationException("Implement pipeline execution");
    }
}
```

## Validation Checklist

Before submitting a pipeline:

- [ ] `project_id` is a valid GUID (different from other pipelines)
- [ ] All component `id`s are unique
- [ ] All `input.from` references valid component IDs
- [ ] First component is `webhook` (or other input source)
- [ ] Last component is response component (`response_text`, etc.)
- [ ] Data lanes are consistent (text→text, json→json, etc.)
- [ ] System prompts are clear and specific
- [ ] Environment variables have defaults or exist in `.env`
- [ ] Model names match available models in `config/models.yml`
- [ ] `temperature` is 0-1 for LLM components
- [ ] `max_tokens` is reasonable (< 10000)

## Troubleshooting

**Pipeline won't load:**
- Check JSON syntax (valid brackets, quotes)
- Verify `project_id` is proper GUID format
- Check file extension is `.pipe` not `.json`

**Data not flowing:**
- Check component IDs in `input.from` are correct
- Verify lane names match (text→text, etc.)
- Ensure no typos in component references

**LLM not responding:**
- Check API keys in `.env`
- Verify model name is in `config/models.yml`
- Check temperature is 0-1
- Review API provider status

**Output wrong format:**
- Use `response_text` for string output
- Use `response_json` for JSON output
- Verify LLM `system_prompt` instructs correct format

## Documentation

- Full guide: `.rocketride/WORKFLOW_GUIDE.md`
- Implementation steps: `.rocketride/IMPLEMENTATION_CHECKLIST.md`
- Pipeline rules: `.rocketride/docs/ROCKETRIDE_PIPELINE_RULES.md`
- Components: `.rocketride/docs/ROCKETRIDE_COMPONENT_REFERENCE.md`

## Common Tasks

**Create new pipeline:**
```bash
cp .rocketride/pipelines/TEMPLATE.pipe .rocketride/pipelines/new-name.pipe
# Edit new-name.pipe with your components
# Generate new GUID and update project_id
```

**Update models:**
Edit `.rocketride/config/models.yml` and commit to git

**Test in extension:**
1. Open `.pipe` file
2. Right-click → Open with RocketRide
3. Click "Run"
4. Send data

**Deploy to backend:**
1. Implement method in `RocketRidePipelineService`
2. Load pipeline file from `.rocketride/pipelines/`
3. Execute via RocketRideClient
4. Parse and return response

---

**Quick Links:**
- 📁 Pipelines: `.rocketride/pipelines/`
- 🔧 Config: `.rocketride/config/`
- 📚 Docs: `.rocketride/docs/`
- ☕ Backend: `backend/src/main/java/com/varify/backend/rocketride/`
