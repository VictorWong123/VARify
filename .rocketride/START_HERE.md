# 🚀 RocketRide Setup Complete!

Your VARify project is now ready for building AI workflows with RocketRide.

## 📦 What Was Created

### Configuration
- ✅ **`config/models.yml`** - Defines GMI and Gemini models with your API keys
- ✅ **`config/rocketride.env.example`** - Environment template (copy to `.env`)

### Pipelines (Ready to Use)
- ✅ **`pipelines/referee-decision.pipe`** - Make decisions from evidence
- ✅ **`pipelines/video-analysis.pipe`** - Analyze video evidence
- ✅ **`pipelines/TEMPLATE.pipe`** - Starter template for new workflows

### Backend Integration
- ✅ **`backend/.../RocketRideProperties.java`** - Spring Boot configuration
- ✅ **`backend/.../RocketRidePipelineService.java`** - Pipeline orchestration (TODO implementations)

### Documentation
- ✅ **`WORKFLOW_GUIDE.md`** - Complete guide to building workflows
- ✅ **`IMPLEMENTATION_CHECKLIST.md`** - Step-by-step implementation tasks
- ✅ **`QUICK_REFERENCE.md`** - Quick lookup card for common tasks
- ✅ **`SETUP_SUMMARY.md`** - Overview and next steps

## 🎯 Next Steps (Choose One)

### Option 1: Quick Setup (5 min)
```bash
# 1. Copy environment template
cp .rocketride/config/rocketride.env.example .env

# 2. Edit .env and add your API keys:
# ROCKETRIDE_APIKEY=your-key
# GMI_API_KEY=your-key
# GOOGLE_AI_KEY=your-key
```

### Option 2: Learn by Example (15 min)
1. Open `.rocketride/WORKFLOW_GUIDE.md`
2. Review `pipelines/referee-decision.pipe`
3. Review `pipelines/video-analysis.pipe`
4. Read `.rocketride/QUICK_REFERENCE.md`

### Option 3: Build Your First Workflow (30 min)
1. Copy `TEMPLATE.pipe` to your new pipeline file
2. Edit and add your components
3. Generate unique GUID (PowerShell: `[guid]::NewGuid().ToString()`)
4. Test in RocketRide VSCode extension

## 📂 Directory Structure

```
.rocketride/
├── docs/                           # RocketRide documentation
├── config/
│   ├── models.yml                  # Model definitions
│   └── rocketride.env.example      # Environment template
├── pipelines/
│   ├── referee-decision.pipe       # Example: Decision pipeline
│   ├── video-analysis.pipe         # Example: Analysis pipeline
│   └── TEMPLATE.pipe               # Starter template
├── WORKFLOW_GUIDE.md               # How to build workflows
├── IMPLEMENTATION_CHECKLIST.md     # Implementation tasks
├── QUICK_REFERENCE.md              # Quick lookup
└── SETUP_SUMMARY.md                # This file + overview
```

## 💡 Key Concepts

### Pipeline = Component Workflow
```
Input → [Processing] → Output
```

### Components Connect via Data Lanes
- `text` - String data (descriptions, analysis)
- `json` - Structured data (objects, arrays)
- `documents` - Document list (PDFs, extracted text)

### Models Available
- **GMI H100** (`gmi-h100`) - Llama 3.1 70B - Complex reasoning
- **Gemini** (`gemini`) - Gemini 2.0 Flash - Quick tasks

## 📝 Example: Building a Simple Workflow

```json
{
	"components": [
		{
			"id": "input",
			"provider": "webhook",
			"config": {}
		},
		{
			"id": "analyzer",
			"provider": "llm",
			"config": {
				"model": "meta-llama/Llama-3.1-70B-Instruct",
				"provider": "gmi-h100",
				"temperature": 0.7,
				"max_tokens": 2000,
				"system_prompt": "Analyze the provided information and give a decision."
			},
			"input": [{ "lane": "text", "from": "input" }]
		},
		{
			"id": "output",
			"provider": "response_text",
			"config": {},
			"input": [{ "lane": "text", "from": "analyzer" }]
		}
	],
	"project_id": "YOUR-UNIQUE-GUID-HERE",
	"viewport": { "x": 0, "y": 0, "zoom": 1 },
	"version": 1
}
```

## 🔧 Spring Boot Integration Template

```java
@Service
public class RocketRidePipelineService {
    
    private final RocketRideProperties properties;
    
    public RefereeDecisionResponse executeRefereeDecisionPipeline(
        RefereeDecisionRequest request) {
        
        // 1. Load referee-decision.pipe from .rocketride/pipelines/
        // 2. Create RocketRideClient with properties.getApiKey()
        // 3. Send request data to pipeline webhook
        // 4. Wait for response
        // 5. Parse and return as RefereeDecisionResponse
        
        throw new UnsupportedOperationException("Implement pipeline execution");
    }
}
```

## 📚 Documentation Files

Read in this order:

1. **QUICK_REFERENCE.md** (2 min) - Get oriented fast
2. **WORKFLOW_GUIDE.md** (10 min) - Understand the system
3. **docs/ROCKETRIDE_PIPELINE_RULES.md** (15 min) - Learn rules
4. **docs/ROCKETRIDE_COMPONENT_REFERENCE.md** (10 min) - Know components
5. **IMPLEMENTATION_CHECKLIST.md** (5 min) - Track progress

## ⚡ Common Commands

**Generate GUID (PowerShell):**
```powershell
[guid]::NewGuid().ToString()
# Example: a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6
```

**Copy template for new workflow:**
```bash
cp .rocketride/pipelines/TEMPLATE.pipe .rocketride/pipelines/my-workflow.pipe
```

**Test workflow in VSCode:**
1. Open `.rocketride/pipelines/your-workflow.pipe`
2. Right-click → "Run Pipeline" (requires RocketRide extension)
3. Send test data via webhook
4. Review output

## 🚦 Implementation Phases

### Phase 1: Setup (Today)
- [ ] Copy `.env.example` to `.env`
- [ ] Add API keys to `.env`
- [ ] Review example pipelines
- [ ] Read WORKFLOW_GUIDE.md

### Phase 2: Build Workflows (This Week)
- [ ] Create custom pipelines
- [ ] Test in RocketRide VSCode extension
- [ ] Validate data flow
- [ ] Document pipeline purposes

### Phase 3: Backend Integration (Next)
- [ ] Implement `RocketRidePipelineService` methods
- [ ] Wire into controllers
- [ ] Write unit tests
- [ ] Test end-to-end

### Phase 4: Deploy (Then)
- [ ] Code review
- [ ] Test in staging
- [ ] Deploy to production
- [ ] Monitor and iterate

## ✅ Validation Checklist

Before running a pipeline:

- [ ] `project_id` is unique GUID
- [ ] All component IDs are unique
- [ ] Input component is `webhook` (or valid source)
- [ ] Output component is `response_*` type
- [ ] All connections reference valid component IDs
- [ ] Data lanes are consistent (text→text, json→json)
- [ ] Environment variables exist in `.env` or have defaults
- [ ] Model names are in `config/models.yml`
- [ ] System prompts are clear and specific

## 🤔 Need Help?

1. **Quick answer?** → Check QUICK_REFERENCE.md
2. **How do I build a workflow?** → Read WORKFLOW_GUIDE.md
3. **What components exist?** → See docs/ROCKETRIDE_COMPONENT_REFERENCE.md
4. **Common mistakes?** → Read docs/ROCKETRIDE_COMMON_MISTAKES.md
5. **Detailed rules?** → See docs/ROCKETRIDE_PIPELINE_RULES.md

## 🎓 Your Workflow Journey

```
Start
  ↓
Read QUICK_REFERENCE.md (2 min)
  ↓
Copy & edit TEMPLATE.pipe (10 min)
  ↓
Test in RocketRide extension (5 min)
  ↓
Implement in backend service (varies)
  ↓
Write tests (varies)
  ↓
Deploy and monitor
  ↓
Success! 🎉
```

---

## 📞 Resources

- **Quick Lookup:** QUICK_REFERENCE.md
- **Build Guide:** WORKFLOW_GUIDE.md  
- **Implementation:** IMPLEMENTATION_CHECKLIST.md
- **Full Documentation:** docs/ folder
- **Example Pipelines:** pipelines/ folder
- **Backend Code:** backend/src/main/java/com/varify/backend/rocketride/

---

**You're all set! Start building workflows in `.rocketride/pipelines/` 🚀**

Questions? Check the relevant documentation file or review the example pipelines.
