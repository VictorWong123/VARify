"""
TEMPLATE: RocketRide Python Integration

This is a code template showing the pattern for integrating RocketRide
with a Python backend.

TO USE THIS TEMPLATE:
1. Install RocketRide SDK in your project: pip install rocketride
2. Copy this code into your backend service
3. Fill in the environment variable names
4. Test with your pipelines

PATTERN:
- Initialize client with API key and URI
- Create async function to load and execute pipeline
- Send input data
- Poll for completion
- Parse and return results
"""

# ============================================================================
# STEP 1: Install dependencies
# ============================================================================
# pip install rocketride

# ============================================================================
# STEP 2: Import and configure
# ============================================================================

# import asyncio
# import json
# from rocketride import RocketRideClient
# from typing import Optional, Dict, Any, Literal
#
# Decision = Literal["RED_CARD", "YELLOW_CARD", "NO_CARD"]
#
# class RefereeDecision:
#     def __init__(
#         self,
#         decision: Decision,
#         confidence: float,
#         rule_applied: str,
#         explanation: str,
#         timestamp: Optional[str] = None,
#     ):
#         self.decision = decision
#         self.confidence = confidence
#         self.rule_applied = rule_applied
#         self.explanation = explanation
#         self.timestamp = timestamp

# ============================================================================
# STEP 3: Create client initialization
# ============================================================================

# def get_api_key() -> str:
#     import os
#     apikey = os.getenv("ROCKETRIDE_APIKEY")
#     if not apikey:
#         raise ValueError("ROCKETRIDE_APIKEY environment variable not set")
#     return apikey
#
# def get_rocketride_uri() -> str:
#     import os
#     return os.getenv("ROCKETRIDE_URI", "https://cloud.rocketride.ai")

# ============================================================================
# STEP 4: Create pipeline execution function
# ============================================================================

# async def execute_referee_decision(evidence: str) -> RefereeDecision:
#     """Execute referee decision pipeline"""
#     client = RocketRideClient()
#
#     try:
#         await client.connect(get_rocketride_uri(), get_api_key())
#
#         # Load pipeline
#         result = await client.use(
#             filepath=".rocketride/pipelines/referee-decision.pipe"
#         )
#         token = result["token"]
#
#         # Send input
#         await client.send(token, evidence)
#
#         # Poll for completion
#         status = await client.get_task_status(token)
#         while status["state"] not in ["completed", "failed"]:
#             await asyncio.sleep(1)
#             status = await client.get_task_status(token)
#
#         if status["state"] == "failed":
#             raise Exception(f"Pipeline failed: {status.get('error')}")
#
#         # Get and parse result
#         response = await client.get_task_result(token)
#         return parse_referee_decision(response)
#
#     finally:
#         await client.disconnect()

# ============================================================================
# STEP 5: Create response parsing functions
# ============================================================================

# def parse_referee_decision(response: Any) -> RefereeDecision:
#     if isinstance(response, str):
#         try:
#             parsed = json.loads(response)
#             return validate_referee_decision(parsed)
#         except json.JSONDecodeError:
#             return extract_from_text(response)
#     return validate_referee_decision(response)
#
# def validate_referee_decision(obj: Dict[str, Any]) -> RefereeDecision:
#     decision = (obj.get("decision") or "NO_CARD").upper()
#
#     if decision not in ["RED_CARD", "YELLOW_CARD", "NO_CARD"]:
#         return RefereeDecision(
#             decision="NO_CARD",
#             confidence=0,
#             rule_applied="UNKNOWN",
#             explanation=obj.get("explanation", "Unable to classify"),
#         )
#
#     return RefereeDecision(
#         decision=decision,
#         confidence=float(obj.get("confidence", 50)),
#         rule_applied=obj.get("rule_applied", "UNKNOWN"),
#         explanation=obj.get("explanation", ""),
#         timestamp=obj.get("timestamp"),
#     )

# ============================================================================
# STEP 6: Integrate with your backend
# ============================================================================

# Example: Flask backend
#
# from flask import Flask, request, jsonify
#
# app = Flask(__name__)
#
# @app.route('/api/analyze', methods=['POST'])
# async def analyze():
#     try:
#         data = request.json
#         decision = await execute_referee_decision(data['evidence'])
#         return jsonify({
#             'success': True,
#             'decision': decision.decision,
#             'confidence': decision.confidence,
#             'rule_applied': decision.rule_applied,
#             'explanation': decision.explanation
#         })
#     except Exception as error:
#         return jsonify({'success': False, 'error': str(error)}), 500

# ============================================================================
# REFERENCE
# ============================================================================
#
# Pipeline paths available:
# - .rocketride/pipelines/referee-decision.pipe (Basic decision, 4-6s)
# - .rocketride/pipelines/referee-decision-advanced.pipe (Complex, 8-12s)
# - .rocketride/pipelines/video-analysis.pipe (Basic analysis)
# - .rocketride/pipelines/video-analysis-multi-step.pipe (Complex, 15-20s)
# - .rocketride/pipelines/incident-classifier-fast.pipe (Quick, 2s)
# - .rocketride/pipelines/request-router.pipe (Router, 2-4s)
#
# Environment variables (from .env):
# - ROCKETRIDE_APIKEY (required)
# - ROCKETRIDE_URI (optional, default: https://cloud.rocketride.ai)
# - GMI_API_KEY (optional, for GMI models)
# - GOOGLE_AI_KEY (optional, for Gemini models)
#
# For more details, see:
# - .rocketride/SDK_INTEGRATION_GUIDE.md
# - .rocketride/docs/ROCKETRIDE_python_API.md
# - .rocketride/PIPELINES_GUIDE.md
