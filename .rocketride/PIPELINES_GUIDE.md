# VARify RocketRide Pipeline Configuration

# Available Pipelines

## 1. Basic Pipelines (Quick Start)

### `referee-decision.pipe`
Simple pipeline for basic referee decisions.
- **Input:** Evidence description
- **Process:** Single LLM call for decision
- **Output:** Decision (RED_CARD, YELLOW_CARD, NO_CARD) with confidence

**Use Case:** Fast decision for clear-cut infractions

### `video-analysis.pipe`
Basic video evidence analysis.
- **Input:** Video metadata
- **Process:** Extract evidence → Analyze
- **Output:** Analysis report

**Use Case:** Initial evidence gathering

---

## 2. Advanced Pipelines (Production)

### `referee-decision-advanced.pipe`
Multi-step decision pipeline with evidence extraction.
- **Input:** Video/evidence data
- **Process:** 
  1. Extract key evidence moments
  2. Analyze with referee rules
  3. Make final decision
- **Output:** Detailed decision with reasoning

**Use Case:** Complex plays requiring detailed analysis

### `video-analysis-multi-step.pipe`
Comprehensive video analysis with rule checking.
- **Input:** Video context
- **Process:**
  1. Extract context (players, location, play type)
  2. Check applicable FIFA Laws
  3. Generate final decision
- **Output:** JSON with decision, confidence, rule, explanation

**Use Case:** Full incident analysis with rule citations

### `incident-classifier-fast.pipe`
Quick incident classification using Gemini.
- **Input:** Incident description
- **Process:** Classify incident type
- **Output:** Classification (CONTACT, HANDLING, FOUL, etc.)

**Use Case:** Fast classification, low cost

### `request-router.pipe`
Route incoming requests to appropriate handlers.
- **Input:** Generic request
- **Process:** Route to: REFEREE_DECISION, RULE_CHECK, VIDEO_ANALYSIS, or CONFIDENCE_VERIFICATION
- **Output:** Routing decision

**Use Case:** Multi-tenant or complex request handling

---

## 3. Model Selection Guide

### GMI Cloud (gmi-h100)
- **Model:** Llama 3.1 70B Instruct
- **Base URL:** https://api.gmi-serving.com (default)
- **Provider:** openai-compatible

**Best for:**
- Complex multi-step reasoning
- Long context analysis (8000+ tokens)
- Detailed explanations
- When accuracy is critical

**Configuration:**
```json
{
  "serverbase": "${GMI_BASE_URL:https://api.gmi-serving.com}",
  "model": "${GMI_MODEL:meta-llama/Llama-3.1-70B-Instruct}",
  "modelTotalTokens": 8000,
  "apikey": "${GMI_API_KEY}"
}
```

### Google Gemini
- **Model:** Gemini 2.0 Flash
- **Provider:** google

**Best for:**
- Fast classifications
- Cost optimization
- Simple decision trees
- When speed > accuracy

**Configuration:**
```json
{
  "apikey": "${GOOGLE_AI_KEY}",
  "model": "gemini-2.0-flash",
  "temperature": 0.3
}
```

---

## 4. Environment Variables

All pipelines support environment variable substitution with defaults:

```json
{
  "model": "${GMI_MODEL:meta-llama/Llama-3.1-70B-Instruct}",
  "apikey": "${GMI_API_KEY}",
  "serverbase": "${GMI_BASE_URL:https://api.gmi-serving.com}"
}
```

**Format:** `${VAR_NAME:default-value}`

**Variables Used:**
- `GMI_BASE_URL` - GMI Cloud endpoint
- `GMI_API_KEY` - GMI Cloud API key
- `GMI_MODEL` - Model identifier
- `GOOGLE_AI_KEY` - Google AI API key

---

## 5. Temperature Settings

Used in all pipelines:

| Setting | Value | Use Case |
|---------|-------|----------|
| Very Precise | 0.1-0.3 | Classification, extraction, rule checking |
| Balanced | 0.4-0.6 | Decision making, analysis |
| Creative | 0.7-1.0 | Explanation, reasoning (not recommended for decisions) |

---

## 6. Data Flow Examples

### Simple Decision Flow
```
Input (text) 
  ↓
LLM (referee decision)
  ↓
Output (text response)
```

### Complex Analysis Flow
```
Input (video metadata)
  ↓
LLM-1 (context extraction)
  ↓
LLM-2 (rule checking)
  ↓
LLM-3 (final decision)
  ↓
Output (JSON response)
```

---

## 7. Pipeline Naming Convention

- `[action]-[scope].pipe` - Simple pipelines
- `[action]-[scope]-[variant].pipe` - Variant pipelines

**Examples:**
- `referee-decision.pipe` - Basic decision
- `referee-decision-advanced.pipe` - Advanced decision
- `video-analysis.pipe` - Basic analysis
- `video-analysis-multi-step.pipe` - Advanced analysis

---

## 8. Component Configuration Best Practices

### Temperature Settings
- Classification: 0.1-0.3 (deterministic)
- Decision-making: 0.4-0.6 (balanced)
- Analysis: 0.5-0.7 (detailed)

### Token Limits
- Classification: 500-1000
- Short analysis: 1000-2000
- Decision with reasoning: 2000-4000
- Full multi-step: 4000-8000

### System Prompts
1. Be specific about expected output format
2. Include decision categories (RED_CARD, YELLOW_CARD, NO_CARD)
3. Ask for confidence scores
4. Request structured reasoning
5. Cite relevant rules when applicable

---

## 9. Testing Pipelines

### In RocketRide VSCode Extension
1. Open `.pipe` file
2. Click "Run Pipeline"
3. Send test data:
   ```json
   {
     "text": "Player X committed a hard tackle on Player Y"
   }
   ```
4. Review output

### Via Backend API
See `RocketRidePipelineService.java` for integration examples.

---

## 10. Deployment Checklist

- [ ] All environment variables documented in `.env.example`
- [ ] Unique GUIDs for each pipeline
- [ ] System prompts reviewed for clarity
- [ ] Token limits appropriate for model
- [ ] Temperature settings match use case
- [ ] Input/output format documented
- [ ] Error handling implemented in backend
- [ ] Tests written for each pipeline
- [ ] Performance benchmarked
- [ ] Cost estimates calculated

---

## 11. Troubleshooting

**Pipeline won't start:**
- Check `project_id` is unique GUID
- Verify component IDs are unique
- Ensure all `input.from` references valid components

**No output:**
- Check API keys in `.env`
- Verify model names are correct
- Check temperature is 0-1

**Wrong output format:**
- Update system prompt to specify format
- Add format instructions to system prompt
- Example: "Output as JSON: {decision: RED_CARD|YELLOW_CARD|NO_CARD, confidence: 0-100}"

---

## 12. Performance Notes

| Pipeline | Latency | Cost | Best For |
|----------|---------|------|----------|
| `incident-classifier-fast` | ~2s | Low | Quick classification |
| `referee-decision` | ~4-6s | Medium | Fast decisions |
| `referee-decision-advanced` | ~8-12s | Medium | Complex analysis |
| `video-analysis-multi-step` | ~15-20s | High | Detailed analysis |

---

For detailed pipeline rules and component reference, see:
- `.rocketride/WORKFLOW_GUIDE.md`
- `.rocketride/docs/ROCKETRIDE_PIPELINE_RULES.md`
- `.rocketride/docs/ROCKETRIDE_COMPONENT_REFERENCE.md`
