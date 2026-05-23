# 🚀 RocketRide Complete Setup - Final Guide

All RocketRide files have been set up in the `.rocketride/` folder. This guide shows you everything that's available and how to use it.

## 📁 Directory Structure

```
.rocketride/
├── docs/                          # Official RocketRide documentation
│   ├── ROCKETRIDE_README.md
│   ├── ROCKETRIDE_QUICKSTART.md
│   ├── ROCKETRIDE_PIPELINE_RULES.md
│   ├── ROCKETRIDE_COMPONENT_REFERENCE.md
│   ├── ROCKETRIDE_COMMON_MISTAKES.md
│   ├── ROCKETRIDE_python_API.md
│   ├── ROCKETRIDE_typescript_API.md
│   └── ROCKETRIDE_OBSERVABILITY.md
│
├── config/
│   ├── models.yml                 # Model provider definitions
│   ├── rocketride.env.example     # Environment template
│   └── services-catalog.json      # Service catalog
│
├── pipelines/
│   ├── referee-decision.pipe           # Basic decision
│   ├── referee-decision-advanced.pipe  # Multi-step decision
│   ├── video-analysis.pipe             # Basic video analysis
│   ├── video-analysis-multi-step.pipe  # Complex analysis
│   ├── incident-classifier-fast.pipe   # Quick classification
│   ├── request-router.pipe             # Request routing
│   └── TEMPLATE.pipe                   # Create new pipelines from this
│
├── schema/
│   └── *.json                     # Component schema definitions (100+ files)
│
├── sdk/
│   ├── typescript-integration.ts  # TypeScript SDK example
│   └── python-integration.py      # Python SDK example
│
├── START_HERE.md                  # Quick orientation guide
├── SETUP_SUMMARY.md               # Setup overview
├── WORKFLOW_GUIDE.md              # How to build workflows
├── QUICK_REFERENCE.md             # Quick lookup card
├── PIPELINES_GUIDE.md             # Pipeline configuration guide
├── SDK_INTEGRATION_GUIDE.md       # SDK integration patterns
└── IMPLEMENTATION_CHECKLIST.md    # Implementation tasks
```

## 📚 Documentation Quick Links

### Getting Started (Start Here First)
1. **`START_HERE.md`** - Orientation and overview
2. **`QUICK_REFERENCE.md`** - Quick lookup commands
3. **`WORKFLOW_GUIDE.md`** - How to build workflows

### Understanding Pipelines
4. **`PIPELINES_GUIDE.md`** - All available pipelines explained
5. **`docs/ROCKETRIDE_PIPELINE_RULES.md`** - Pipeline structure rules
6. **`docs/ROCKETRIDE_COMPONENT_REFERENCE.md`** - All components

### Integration & Implementation
7. **`SDK_INTEGRATION_GUIDE.md`** - SDK integration patterns
8. **`docs/ROCKETRIDE_python_API.md`** - Python SDK reference
9. **`docs/ROCKETRIDE_typescript_API.md`** - TypeScript SDK reference

### Advanced Topics
10. **`docs/ROCKETRIDE_COMMON_MISTAKES.md`** - What to avoid
11. **`docs/ROCKETRIDE_OBSERVABILITY.md`** - Monitoring & logging
12. **`IMPLEMENTATION_CHECKLIST.md`** - Step-by-step tasks

## 🎯 Available Pipelines

### Basic Pipelines (Fast & Simple)

#### 1. **referee-decision.pipe**
- **Purpose:** Quick referee decision
- **Input:** Evidence description (text)
- **Output:** Decision (RED_CARD, YELLOW_CARD, NO_CARD)
- **Latency:** ~4-6 seconds
- **Model:** GMI H100 (Llama 3.1 70B)
- **Use Case:** Clear-cut infractions, fast decisions

#### 2. **incident-classifier-fast.pipe**
- **Purpose:** Quick incident classification
- **Input:** Incident description (text)
- **Output:** Incident type (CONTACT, HANDLING, FOUL, etc.)
- **Latency:** ~2 seconds
- **Model:** Gemini 2.0 Flash
- **Use Case:** Fast classification, cost optimization

### Advanced Pipelines (Detailed Analysis)

#### 3. **referee-decision-advanced.pipe**
- **Purpose:** Complex decision with evidence extraction
- **Input:** Video/evidence data (JSON)
- **Process:**
  1. Extract key evidence moments
  2. Analyze with referee rules
  3. Make final decision
- **Output:** Decision with detailed reasoning
- **Latency:** ~8-12 seconds
- **Model:** GMI H100
- **Use Case:** Complex plays, multiple infractions possible

#### 4. **video-analysis-multi-step.pipe**
- **Purpose:** Comprehensive video analysis
- **Input:** Video context (JSON)
- **Process:**
  1. Extract context (players, location, play type)
  2. Check applicable FIFA Laws
  3. Generate detailed analysis
  4. Make final decision
- **Output:** JSON with decision, confidence, rule, explanation
- **Latency:** ~15-20 seconds
- **Model:** GMI H100
- **Use Case:** Full incident analysis with rule citations

#### 5. **request-router.pipe**
- **Purpose:** Route requests to appropriate handlers
- **Input:** Generic request (text/JSON)
- **Output:** Routing decision
- **Latency:** ~2-4 seconds
- **Model:** GMI H100
- **Use Case:** Multi-tenant systems, smart routing

## 🔧 Configuration Files

### **`config/models.yml`**
Defines available models:
```yaml
models:
  - name: gmi-h100          # Llama 3.1 70B Instruct
  - name: gemini            # Gemini 2.0 Flash
```

### **`config/rocketride.env.example`**
Template for environment variables. Copy to `.env` and fill in your API keys.

## 💻 SDK Examples

### **`sdk/typescript-integration.ts`**
Complete TypeScript/Node.js integration example with:
- Connection management
- Pipeline execution
- Error handling
- Response parsing
- Batch processing

### **`sdk/python-integration.py`**
Complete Python integration example with:
- Async client setup
- Multiple pipeline methods
- Error handling
- Response validation

## 📖 Reading Order

### For Pipeline Builders
1. `QUICK_REFERENCE.md` (5 min)
2. `WORKFLOW_GUIDE.md` (15 min)
3. `PIPELINES_GUIDE.md` (10 min)
4. `docs/ROCKETRIDE_PIPELINE_RULES.md` (20 min)
5. Create your first pipeline

### For Backend Developers
1. `SDK_INTEGRATION_GUIDE.md` (15 min)
2. `sdk/python-integration.py` or `sdk/typescript-integration.ts` (20 min)
3. `docs/ROCKETRIDE_python_API.md` or `docs/ROCKETRIDE_typescript_API.md` (30 min)
4. Copy SDK code to your backend
5. Write integration code

### For DevOps/Monitoring
1. `docs/ROCKETRIDE_OBSERVABILITY.md` (15 min)
2. `SDK_INTEGRATION_GUIDE.md` → Monitoring section (10 min)
3. Set up logging & metrics

## 🚀 Quick Start Checklist

- [ ] Read `START_HERE.md`
- [ ] Copy `config/rocketride.env.example` to `.env`
- [ ] Fill in API keys in `.env`
- [ ] Review `PIPELINES_GUIDE.md`
- [ ] Review example pipelines
- [ ] Install RocketRide SDK:
  - Python: `pip install rocketride`
  - TypeScript: `npm install rocketride`
- [ ] Copy SDK integration code to your backend
- [ ] Test pipeline execution
- [ ] Write unit tests
- [ ] Deploy to production

## 🎓 Learning Paths

### Path 1: Build Custom Pipelines (30 min)
1. Start with: `QUICK_REFERENCE.md`
2. Copy: `TEMPLATE.pipe`
3. Edit: Add your components
4. Test: In RocketRide VSCode extension
5. Deploy: Reference in backend code

### Path 2: Python Integration (1 hour)
1. Start with: `SDK_INTEGRATION_GUIDE.md`
2. Review: `sdk/python-integration.py`
3. Read: `docs/ROCKETRIDE_python_API.md`
4. Copy: Code to your backend
5. Test: With mock client
6. Deploy: To production

### Path 3: TypeScript Integration (1 hour)
1. Start with: `SDK_INTEGRATION_GUIDE.md`
2. Review: `sdk/typescript-integration.ts`
3. Read: `docs/ROCKETRIDE_typescript_API.md`
4. Copy: Code to your backend
5. Test: With mock client
6. Deploy: To production

### Path 4: Full Implementation (2-3 hours)
1. Follow Path 1: Build custom pipeline
2. Follow Path 2 or 3: Integrate with backend
3. Write unit tests
4. Set up monitoring
5. Deploy and monitor

## 🔑 Key Concepts

### Components
- **Webhook** - Receive input data
- **LLM** - Process with language model (GMI Cloud, Gemini)
- **Transform** - Transform/extract data
- **Response** - Send output (response_text, response_json, etc.)

### Data Lanes
- **text** - String data
- **json** - Structured data
- **documents** - Document list
- **answers** - Q&A pairs

### Models
- **GMI H100** (Llama 3.1 70B) - Complex reasoning, detailed analysis
- **Gemini 2.0 Flash** - Fast classification, cost optimization

## 📊 Pipeline Selection Guide

| Need | Pipeline | Speed | Cost |
|------|----------|-------|------|
| Fast classification | `incident-classifier-fast` | ⚡⚡⚡ | 💰 |
| Quick decision | `referee-decision` | ⚡⚡ | 💰💰 |
| Complex decision | `referee-decision-advanced` | ⚡ | 💰💰💰 |
| Full analysis | `video-analysis-multi-step` | 🐢 | 💰💰💰 |
| Smart routing | `request-router` | ⚡⚡ | 💰💰 |

## 🔗 Important Files

| File | Purpose |
|------|---------|
| `.env` | Your actual API keys (NEVER commit) |
| `config/models.yml` | Model definitions (commit to git) |
| `config/rocketride.env.example` | API key template (commit to git) |
| `pipelines/*.pipe` | Your pipelines (commit to git) |
| `sdk/*.py` or `sdk/*.ts` | Integration examples (customize for your backend) |

## 🆘 Common Issues

### Pipeline won't start
- Check `project_id` is unique GUID
- Verify component IDs are unique
- Check `input.from` references valid components

### No output from pipeline
- Verify API keys in `.env`
- Check model names in `config/models.yml`
- Review system prompts for clarity

### High latency
- Use `incident-classifier-fast` for quick tasks
- Use Gemini for cost/speed tradeoff
- Check network connectivity

### High costs
- Use Gemini instead of GMI for classification
- Use `incident-classifier-fast` pipeline
- Reduce token limits where possible

## 📞 Support Resources

- **Documentation:** `.rocketride/docs/`
- **Examples:** `.rocketride/sdk/`
- **Pipelines:** `.rocketride/pipelines/`
- **Configuration:** `.rocketride/config/`

## ✅ Setup Complete!

All files are ready. Your next step is to:

1. **Choose your path:** Build pipelines, integrate backend, or both
2. **Read documentation:** Start with appropriate guide above
3. **Set up environment:** Copy `.env.example` to `.env`
4. **Test:** Use example pipelines and SDK code
5. **Deploy:** Implement in your application

---

## 🎬 Next Steps

### To Build Custom Pipelines:
```bash
cp .rocketride/pipelines/TEMPLATE.pipe .rocketride/pipelines/your-pipeline.pipe
# Edit your-pipeline.pipe
# Test in RocketRide VSCode extension
```

### To Integrate with Backend:
```python
# Copy sdk/python-integration.py to your backend
from rocketride_integration import VARifyPipelineClient

client = VARifyPipelineClient()
decision = await client.execute_referee_decision("evidence")
```

### To Test Pipelines:
1. Open `.rocketride/pipelines/your-pipeline.pipe` in VSCode
2. Right-click → "Open with RocketRide"
3. Click "Run Pipeline"
4. Send test data via webhook

---

**Everything is set up! Start building with RocketRide 🚀**
