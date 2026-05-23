# VARify

VARify is a hackathon MVP for an AI referee assistant focused on soccer card
decisions. A user uploads a short match clip, the backend runs the clip through
an AI decision pipeline, and the frontend displays a referee-style result:
`RED_CARD`, `YELLOW_CARD`, or `NO_CARD`, with confidence, timestamps,
explanation, rule category, and evidence moments.

## Monorepo Layout

```text
VARify/
  frontend/   React + TypeScript upload and results UI
  backend/    Java Spring Boot API and AI service layer
  README.md
```

## Requirements

- Node.js and npm for the React + TypeScript frontend.
- Java 17 or newer for the Spring Boot backend.
- Maven for the Spring Boot backend.
- Optional AI provider keys for live analysis. Without keys, the backend should
  run in mock mode so the demo still works.

## Environment Variables

The backend reads these variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Optional for mock mode | Google AI Studio Gemini video analysis key. |
| `GMI_API_KEY` | Optional for mock mode | GMI Cloud API key for the Gemma decision model. |
| `GMI_BASE_URL` | Optional for mock mode | GMI Cloud base URL. |
| `GMI_MODEL` | Optional for mock mode | GMI model name to use for referee decisions. |
| `ROCKETRIDE_API_KEY` | Optional | Placeholder/orchestration service key, if used. |

Example local shell setup:

```sh
export GEMINI_API_KEY="your-gemini-key"
export GMI_API_KEY="your-gmi-key"
export GMI_BASE_URL="https://your-gmi-base-url"
export GMI_MODEL="your-gemma-model"
export ROCKETRIDE_API_KEY="optional-rocketride-key"
```

For a keyless demo, leave these unset and use the backend mock response path.

## Local Development

Run the frontend and backend in separate terminals.

### Frontend

```sh
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173` by default and proxies `/api`
requests to `http://localhost:8080`. If that port is occupied, Vite will print
the next available local URL.

### Backend

```sh
cd backend
mvn spring-boot:run
```

The backend exposes the API at `http://localhost:8080`.

## Mock Mode

The MVP remains demoable without external AI keys. If API keys are missing, the
backend service layer falls back to a safe mock response instead of failing
startup or blocking the upload flow.

Expected mock behavior:

- Accept the uploaded video file through `POST /api/analyze`.
- Skip live Gemini and GMI Cloud calls when required keys are unavailable.
- Return a realistic structured referee decision response.
- Include `modelTrace` values that make it clear whether the response used mock
  services or live providers.

## API

### Health Check

```sh
curl http://localhost:8080/api/health
```

Expected successful response shape:

```json
{
  "status": "ok",
  "service": "varify-backend"
}
```

### Analyze Video

`POST /api/analyze` accepts a multipart upload field named `video`.

```sh
curl -X POST http://localhost:8080/api/analyze \
  -F "video=@/path/to/soccer-clip.mp4"
```

Expected response shape:

```json
{
  "decision": "YELLOW_CARD",
  "confidence": 82,
  "keyTimestamp": "00:07-00:09",
  "ruleCategory": "reckless",
  "explanation": "The tackle appears reckless because the player arrives late, makes contact with the opponent's leg, and does not clearly play the ball.",
  "evidence": [
    {
      "timestamp": "00:07",
      "description": "Defender arrives late as attacker touches the ball forward."
    },
    {
      "timestamp": "00:08",
      "description": "Contact appears to be made with the opponent's lower leg."
    }
  ],
  "geminiSummary": "Short summary of the visual incident.",
  "modelTrace": {
    "videoAnalyzer": "Gemini or mock",
    "orchestrator": "RocketRide placeholder",
    "decisionModel": "Gemma on GMI Cloud or mock"
  }
}
```

## AI Pipeline

The intended backend flow is:

1. `VideoAnalysisService` sends the uploaded clip to Gemini, or returns a mock
   analysis when Gemini is not configured.
2. `RocketRideOrchestrationService` coordinates the workflow and builds a
   structured referee decision prompt from the video analysis.
3. `RefereeDecisionService` sends the structured incident summary to a GMI Cloud
   Gemma model, or returns a mock referee decision when GMI is not configured.

The MVP does not require authentication or a database.

## Checks

```sh
cd frontend
npm test
npm run build
```

```sh
cd backend
mvn test
```
