# RocketRide AI Pipeline Framework

VARify's RocketRide integration for building AI-powered referee decision pipelines.

## Quick Start

1. **Configure Environment:**
   ```bash
   cp config/rocketride.env.example .env
   # Edit .env and add your API keys
   ```

2. **Choose Your Path:**
   - **Build Pipelines:** See `WORKFLOW_GUIDE.md`
   - **Integrate Backend:** See `SDK_INTEGRATION_GUIDE.md`
   - **Reference Pipelines:** See `PIPELINES_GUIDE.md`

3. **Learn Quickly:** Read `START_HERE.md` (5 min)

## 📁 Structure

| Folder/File | Purpose |
|-------------|---------|
| `pipelines/` | 7 production-ready AI pipelines |
| `config/` | Model definitions and environment template |
| `docs/` | Official RocketRide documentation |
| `schema/` | 100+ component definitions |
| `sdk/` | Backend integration templates |
| `INDEX.md` | Full navigation guide |
| `START_HERE.md` | Quick orientation |
| `WORKFLOW_GUIDE.md` | How to build pipelines |
| `PIPELINES_GUIDE.md` | All pipelines explained |
| `SDK_INTEGRATION_GUIDE.md` | Backend integration patterns |
| `IMPLEMENTATION_CHECKLIST.md` | Step-by-step tasks |
| `QUICK_REFERENCE.md` | Quick lookup card |

## 🎯 Available Pipelines

| Pipeline | Purpose | Speed | Cost |
|----------|---------|-------|------|
| `referee-decision.pipe` | Quick decisions | ⚡⚡ | 💰💰 |
| `referee-decision-advanced.pipe` | Complex decisions | ⚡ | 💰💰💰 |
| `incident-classifier-fast.pipe` | Fast classification | ⚡⚡⚡ | 💰 |
| `video-analysis.pipe` | Basic analysis | ⚡ | 💰💰 |
| `video-analysis-multi-step.pipe` | Detailed analysis | 🐢 | 💰💰💰 |
| `request-router.pipe` | Smart routing | ⚡⚡ | 💰💰 |
| `TEMPLATE.pipe` | Create custom pipelines | - | - |

## 🚀 Integration Methods

### TypeScript/Node.js
See `sdk/TYPESCRIPT_INTEGRATION_TEMPLATE.md` for patterns and examples.

### Python
See `sdk/PYTHON_INTEGRATION_TEMPLATE.md` for patterns and examples.

### Java/Spring Boot
Reference: `SDK_INTEGRATION_GUIDE.md` → Spring Boot section

## 📖 Documentation

**Start here:** `INDEX.md` (complete navigation)

**For beginners:** `START_HERE.md` + `QUICK_REFERENCE.md`

**For building:** `WORKFLOW_GUIDE.md` → `PIPELINES_GUIDE.md`

**For coding:** `SDK_INTEGRATION_GUIDE.md` → Integration templates

**For reference:** `docs/ROCKETRIDE_*.md` (official docs)

## ✅ Essential Setup

1. Read `INDEX.md` for full navigation
2. Copy `config/rocketride.env.example` to `.env`
3. Configure API keys in `.env`
4. Choose learning path from `START_HERE.md`
5. Implement using templates

## 🔧 Models Available

- **GMI H100** (Llama 3.1 70B) - Complex reasoning, detailed analysis
- **Gemini 2.0 Flash** - Fast classification, cost optimization

Both configured in `config/models.yml`

## 📊 What's Included

✅ 7 production pipelines
✅ 100+ component schemas
✅ Backend integration templates (Python, TypeScript)
✅ Complete documentation (12 guides + official docs)
✅ Configuration templates
✅ Implementation checklist

## 🎯 Next Steps

1. **Understand:** Read `START_HERE.md` (5 min)
2. **Learn:** Read relevant guide from `INDEX.md` 
3. **Configure:** Copy `.env.example` and add API keys
4. **Build:** Create pipelines using `TEMPLATE.pipe`
5. **Integrate:** Use SDK templates for your backend
6. **Deploy:** Push to production

## 📞 Getting Help

- Navigation: `INDEX.md`
- Quick answers: `QUICK_REFERENCE.md`
- How to build: `WORKFLOW_GUIDE.md`
- How to integrate: `SDK_INTEGRATION_GUIDE.md`
- Common mistakes: `docs/ROCKETRIDE_COMMON_MISTAKES.md`

---

**Ready to build AI pipelines?** Start with `INDEX.md` or `START_HERE.md`
