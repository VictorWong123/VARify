Build the MVP for VARify, an AI referee assistant for soccer card decisions.

Goal:
Create a working full-stack demo where a user uploads a short soccer video clip, the backend sends it through an AI pipeline, and the frontend displays a referee-style decision: RED_CARD, YELLOW_CARD, or NO_CARD, with timestamps, explanation, confidence score, and key evidence.

Tech stack:
Frontend: React + TypeScript
Backend: Java Spring Boot
No database for MVP
AI services:
- Gemini via Google AI Studio for video analysis
- GMI Cloud Gemma model for final referee decision
- RocketRide orchestration placeholder/service layer for coordinating the pipeline

Build this as a clean monorepo:

/frontend
/backend
/README.md

Frontend requirements:
Create a React + TypeScript app with:
1. A landing/upload page titled “VARify”
2. Subtitle: “AI Referee Assistant for Card Decisions”
3. Video upload input accepting mp4/mov/webm
4. Video preview after upload
5. “Analyze Clip” button
6. Loading state while backend processes
7. Results dashboard showing:
   - Decision: Red Card / Yellow Card / No Card
   - Confidence percentage
   - Key timestamps
   - Explanation
   - Evidence bullets
   - Rule interpretation: careless, reckless, excessive force, or no offense
8. Make the UI demo-ready: clean, modern, sports/referee theme, but not overcomplicated.

Backend requirements:
Create a Java Spring Boot backend with:
1. POST /api/analyze
   - Accept multipart video upload
   - Save temporarily or stream for processing
   - Return structured JSON response
2. GET /api/health
3. Service classes:
   - VideoAnalysisService: calls Gemini or uses a mock fallback
   - RocketRideOrchestrationService: coordinates the AI workflow
   - RefereeDecisionService: calls GMI Cloud Gemma or uses a mock fallback
4. DTOs:
   - VideoAnalysisResult
   - RefereeDecisionRequest
   - RefereeDecisionResponse
   - EvidenceMoment
5. Environment variables:
   - GEMINI_API_KEY
   - GMI_API_KEY
   - GMI_BASE_URL
   - GMI_MODEL
   - ROCKETRIDE_API_KEY optional
6. Include safe mock mode if API keys are missing, so the demo still works.

Expected backend response JSON:
{
  "decision": "YELLOW_CARD",
  "confidence": 82,
  "keyTimestamp": "00:07-00:09",
  "ruleCategory": "reckless",
  "explanation": "The tackle appears reckless because the player arrives late, makes contact with the opponent’s leg, and does not clearly play the ball.",
  "evidence": [
    {
      "timestamp": "00:07",
      "description": "Defender arrives late as attacker touches the ball forward."
    },
    {
      "timestamp": "00:08",
      "description": "Contact appears to be made with the opponent’s lower leg."
    }
  ],
  "geminiSummary": "Short summary of the visual incident.",
  "modelTrace": {
    "videoAnalyzer": "Gemini",
    "orchestrator": "RocketRide",
    "decisionModel": "Gemma on GMI Cloud"
  }
}

AI pipeline behavior:
Step 1: Gemini analyzes the uploaded soccer clip and extracts:
- contact moment timestamps
- contact type
- whether the player plays the ball
- player speed/intensity
- visible danger indicators
- possible rule category

Step 2: RocketRide orchestration service receives the Gemini analysis and builds a structured decision prompt.

Step 3: GMI Cloud Gemma receives the structured incident summary and returns:
- final decision
- rule category
- reasoning
- confidence
- evidence moments

Important:
Do not build authentication.
Do not build a database.
Do not over-engineer.
Make the app easy to demo in 3 minutes.
Make sure the frontend and backend can run locally.
Add clear README instructions for running both apps.
Include example curl request.
Include mock response behavior so we can keep building even before API keys are configured.

Implementation priority:
1. Working upload from frontend to backend
2. Mock backend response displayed nicely
3. Service layer structure for Gemini, RocketRide, and GMI Cloud
4. Real API integration placeholders using environment variables
5. README with setup instructions

Use clean code and keep the architecture understandable for a hackathon team.