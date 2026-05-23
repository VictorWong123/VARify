# RocketRide Implementation Checklist

Use this checklist to track your RocketRide setup and integration progress.

## ✅ Setup Phase

- [ ] Read `.rocketride/docs/ROCKETRIDE_README.md`
- [ ] Read `.rocketride/docs/ROCKETRIDE_PIPELINE_RULES.md`
- [ ] Read `.rocketride/docs/ROCKETRIDE_COMPONENT_REFERENCE.md`
- [ ] Read `.rocketride/docs/ROCKETRIDE_COMMON_MISTAKES.md`
- [ ] Copy `.rocketride/config/rocketride.env.example` to `.env` in project root
- [ ] Configure API keys in `.env`:
  - [ ] `ROCKETRIDE_APIKEY`
  - [ ] `GMI_API_KEY`
  - [ ] `GOOGLE_AI_KEY`
- [ ] Verify `.env` is in `.gitignore` (never commit API keys)

## ✅ Pipeline Design Phase

- [ ] Review `referee-decision.pipe` example
- [ ] Review `video-analysis.pipe` example
- [ ] Create custom pipelines by copying `TEMPLATE.pipe`
- [ ] For each new pipeline:
  - [ ] Generate unique GUID for `project_id`
  - [ ] Define input component (webhook)
  - [ ] Define processing components (llm, transform, etc.)
  - [ ] Define output component (response_text, response_json, etc.)
  - [ ] Wire components via `input` arrays
  - [ ] Use correct data lanes (text, json, documents, etc.)
  - [ ] Test in RocketRide VSCode extension

## ✅ Backend Integration Phase

### Java Service Implementation

- [ ] `RocketRideProperties.java` - Configuration class ✅ (Created)
- [ ] `RocketRidePipelineService.java` - Pipeline orchestration ✅ (Created)
- [ ] Implement `executeRefereeDecisionPipeline()` method
- [ ] Implement `executeVideoAnalysisPipeline()` method
- [ ] Add error handling and logging
- [ ] Create unit tests for service methods

### Controller Integration

- [ ] Inject `RocketRidePipelineService` in `AnalysisController`
- [ ] Update endpoint to call pipeline service
- [ ] Map request/response DTOs to pipeline inputs/outputs
- [ ] Update API documentation

### Configuration Updates

- [ ] Update `application.yml` with RocketRide settings:
  ```yaml
  varify:
    rocketride:
      api-key: ${ROCKETRIDE_APIKEY:}
      uri: ${ROCKETRIDE_URI:https://cloud.rocketride.ai}
  ```
- [ ] Update `.env.example` with all required variables

## ✅ Testing Phase

### Unit Tests

- [ ] Test `RocketRidePipelineService` with mock client
- [ ] Test referee decision pipeline execution
- [ ] Test video analysis pipeline execution
- [ ] Test error handling and fallback behavior

### Integration Tests

- [ ] Test end-to-end pipeline execution
- [ ] Test request/response mapping
- [ ] Test API endpoint integration
- [ ] Test with real RocketRide server (dev environment)

### Manual Testing

- [ ] Test in RocketRide VSCode extension visual builder
- [ ] Send sample data through webhook
- [ ] Verify output formatting
- [ ] Check error messages and logging

## ✅ Documentation Phase

- [ ] Document pipeline architecture in README
- [ ] Document API contract changes
- [ ] Document environment variable requirements
- [ ] Create examples for common use cases
- [ ] Document limitations and fallback behavior

## ✅ Deployment Phase

- [ ] Verify `.env` is not in git
- [ ] Add `.env.example` with all required keys
- [ ] Document deployment environment variables
- [ ] Test in staging environment
- [ ] Deploy to production
- [ ] Monitor logs and error rates

## Pipeline Development Workflow

For each new workflow/pipeline:

1. **Design Phase**
   - [ ] Define business requirements
   - [ ] Sketch component flow
   - [ ] Identify data transformations
   - [ ] Choose appropriate components and models

2. **Template Phase**
   - [ ] Copy `TEMPLATE.pipe`
   - [ ] Generate new GUID
   - [ ] Save with descriptive name

3. **Build Phase**
   - [ ] Add input component
   - [ ] Add processing components
   - [ ] Add output component
   - [ ] Wire all connections
   - [ ] Add system prompts and configurations

4. **Test Phase**
   - [ ] Open in VSCode RocketRide extension
   - [ ] Validate JSON syntax
   - [ ] Test with sample data
   - [ ] Verify output format

5. **Integration Phase**
   - [ ] Create Java service method
   - [ ] Map pipeline to controller endpoint
   - [ ] Write unit tests
   - [ ] Update API documentation

6. **Deploy Phase**
   - [ ] Code review
   - [ ] Test in staging
   - [ ] Deploy to production
   - [ ] Monitor execution

## Model Selection Guide

**Use `gmi-h100` (Llama 3.1 70B) for:**
- Complex decision-making
- Long-form analysis
- Code generation
- Multi-step reasoning

**Use `gemini` (Gemini 2.0 Flash) for:**
- Quick summarization
- Classification tasks
- Lightweight processing
- Cost optimization

## Common Tasks

### Create a New Pipeline

```bash
cp .rocketride/pipelines/TEMPLATE.pipe .rocketride/pipelines/my-new-pipeline.pipe
# Edit my-new-pipeline.pipe with your components
# Generate GUID: [guid]::NewGuid().ToString() in PowerShell
```

### Test a Pipeline

1. Open VSCode
2. Install RocketRide extension (if not already)
3. Open `.rocketride/pipelines/my-new-pipeline.pipe`
4. Click "Run Pipeline" in the extension UI
5. Send test data via webhook
6. Review output

### Add Pipeline to Backend

1. Create Java method in `RocketRidePipelineService`
2. Load pipeline file via RocketRideClient
3. Send data to pipeline
4. Parse response
5. Return to controller

### Update Models Configuration

Edit `.rocketride/config/models.yml` and commit to git. This file defines available models for all pipelines.

## Troubleshooting

**Pipeline won't start:**
- Check GUID format in `project_id` (should be valid UUID)
- Verify all component IDs are unique
- Check `input` array references valid component IDs

**Data not flowing:**
- Verify lane names match (text, json, documents, etc.)
- Check that "from" field references correct component ID
- Ensure output component has input connected

**API key errors:**
- Verify `.env` file exists in project root
- Check API keys are correctly set
- Confirm keys have necessary permissions

**Model not responding:**
- Check model name exists in provider
- Verify API credentials are valid
- Check rate limits and quota

## Resources

- [RocketRide Documentation](.rocketride/docs/)
- [VSCode RocketRide Extension](https://marketplace.visualstudio.com/items?itemName=rocketride.rocketride)
- [RocketRide Python SDK](https://pypi.org/project/rocketride/)
- [RocketRide TypeScript SDK](https://www.npmjs.com/package/rocketride)
