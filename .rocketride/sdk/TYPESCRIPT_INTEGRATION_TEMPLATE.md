/**
 * TEMPLATE: RocketRide TypeScript/Node.js Integration
 * 
 * This is a code template showing the pattern for integrating RocketRide
 * with a Node.js/TypeScript backend.
 * 
 * TO USE THIS TEMPLATE:
 * 1. Install RocketRide SDK in your project: npm install rocketride
 * 2. Install Node types: npm install --save-dev @types/node
 * 3. Copy this code into your backend service
 * 4. Fill in the environment variable names
 * 5. Test with your pipelines
 * 
 * PATTERN:
 * - Initialize client with API key and URI
 * - Load pipeline from file
 * - Send input data
 * - Poll for completion
 * - Parse and return results
 */

// ============================================================================
// STEP 1: Install dependencies
// ============================================================================
// npm install rocketride
// npm install --save-dev @types/node

// ============================================================================
// STEP 2: Import and configure
// ============================================================================

// import { RocketRideClient } from 'rocketride';

// interface RefereeDecision {
//   decision: 'RED_CARD' | 'YELLOW_CARD' | 'NO_CARD';
//   confidence: number;
//   rule_applied: string;
//   explanation: string;
//   timestamp?: string;
// }

// interface VideoAnalysisInput {
//   videoPath: string;
//   videoMetadata?: Record<string, any>;
//   evidenceMoments?: Array<{ timestamp: string; description: string }>;
// }

// ============================================================================
// STEP 3: Create client initialization
// ============================================================================

// function initializeClient(): RocketRideClient {
//   const apiKey = process.env.ROCKETRIDE_APIKEY;
//   const uri = process.env.ROCKETRIDE_URI || 'https://cloud.rocketride.ai';
//
//   if (!apiKey) {
//     throw new Error('ROCKETRIDE_APIKEY environment variable not set');
//   }
//
//   return new RocketRideClient({
//     apiKey,
//     uri,
//   });
// }

// ============================================================================
// STEP 4: Create pipeline execution function
// ============================================================================

// export async function executeRefereeDecision(
//   description: string
// ): Promise<RefereeDecision> {
//   const client = initializeClient();
//
//   try {
//     await client.connect();
//
//     // Load pipeline
//     const result = await client.use({
//       filepath: '.rocketride/pipelines/referee-decision.pipe',
//     });
//     const token = result.token;
//
//     // Send input
//     await client.send(token, description);
//
//     // Poll for completion
//     let status = await client.get_task_status(token);
//     while (status.state !== 'completed' && status.state !== 'failed') {
//       await new Promise(resolve => setTimeout(resolve, 1000));
//       status = await client.get_task_status(token);
//     }
//
//     if (status.state === 'failed') {
//       throw new Error(`Pipeline failed: ${status.error}`);
//     }
//
//     // Get and parse result
//     const response = await client.get_task_result(token);
//     return parseRefereeDecision(response);
//   } finally {
//     await client.disconnect();
//   }
// }

// ============================================================================
// STEP 5: Create response parsing functions
// ============================================================================

// function parseRefereeDecision(response: any): RefereeDecision {
//   if (typeof response === 'string') {
//     try {
//       const parsed = JSON.parse(response);
//       return validateRefereeDecision(parsed);
//     } catch (e) {
//       return extractRefereeDecisionFromText(response);
//     }
//   }
//   return validateRefereeDecision(response);
// }

// function validateRefereeDecision(obj: any): RefereeDecision {
//   const decision = (obj.decision || 'NO_CARD').toUpperCase();
//
//   if (!['RED_CARD', 'YELLOW_CARD', 'NO_CARD'].includes(decision)) {
//     return {
//       decision: 'NO_CARD',
//       confidence: 0,
//       rule_applied: 'UNKNOWN',
//       explanation: obj.explanation || 'Unable to classify',
//       timestamp: obj.timestamp,
//     };
//   }
//
//   return {
//     decision: decision as 'RED_CARD' | 'YELLOW_CARD' | 'NO_CARD',
//     confidence: parseFloat(obj.confidence) || 50,
//     rule_applied: obj.rule_applied || 'UNKNOWN',
//     explanation: obj.explanation || '',
//     timestamp: obj.timestamp,
//   };
// }

// ============================================================================
// STEP 6: Integrate with your backend
// ============================================================================

// Example: Spring Boot / Express.js controller
// 
// @PostMapping('/api/analyze')
// async analyze(@RequestBody request: AnalysisRequest) {
//   try {
//     const decision = await executeRefereeDecision(request.evidence);
//     return { success: true, data: decision };
//   } catch (error) {
//     return { success: false, error: error.message };
//   }
// }

// ============================================================================
// REFERENCE
// ============================================================================
// 
// Pipeline paths available:
// - .rocketride/pipelines/referee-decision.pipe (Basic decision, 4-6s)
// - .rocketride/pipelines/referee-decision-advanced.pipe (Complex, 8-12s)
// - .rocketride/pipelines/video-analysis.pipe (Basic analysis)
// - .rocketride/pipelines/video-analysis-multi-step.pipe (Complex, 15-20s)
// - .rocketride/pipelines/incident-classifier-fast.pipe (Quick, 2s)
// - .rocketride/pipelines/request-router.pipe (Router, 2-4s)
//
// Environment variables (from .env):
// - ROCKETRIDE_APIKEY (required)
// - ROCKETRIDE_URI (optional, default: https://cloud.rocketride.ai)
// - GMI_API_KEY (optional, for GMI models)
// - GOOGLE_AI_KEY (optional, for Gemini models)
//
// For more details, see:
// - .rocketride/SDK_INTEGRATION_GUIDE.md
// - .rocketride/docs/ROCKETRIDE_typescript_API.md
// - .rocketride/PIPELINES_GUIDE.md
