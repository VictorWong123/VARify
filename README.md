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
- Gemini and GMI Cloud credentials for live analysis. Without required keys, the
  backend returns a configuration error instead of a fake decision.

## Environment Variables

The backend reads these variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Google AI Studio Gemini video analysis key. |
| `GEMINI_MODEL` | No | Gemini model for video analysis. Defaults to `gemini-2.5-flash`. |
| `GMI_API_KEY` | Yes | GMI Cloud API key for the Gemma decision model. |
| `GMI_BASE_URL` | No | GMI Cloud base URL. Defaults to `https://api.gmi-serving.com`. |
| `GMI_MODEL` | Yes | Exact Gemma model id enabled in your GMI Cloud account. |

Example local shell setup:

```sh
export GEMINI_API_KEY="your-gemini-key"
export GEMINI_MODEL="gemini-2.5-flash"
export GMI_API_KEY="your-gmi-key"
export GMI_BASE_URL="https://your-gmi-base-url"
export GMI_MODEL="your-gemma-model"
```

The app does not generate fake referee decisions. If required credentials are
missing or invalid, `POST /api/analyze` returns a clear error message.

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

`POST /api/analyze` accepts one or more multipart upload fields named `video`.

```sh
curl -X POST http://localhost:8080/api/analyze \
  -F "video=@/path/to/wide-angle.mp4" \
  -F "video=@/path/to/reverse-angle.mp4"
```

Expected response shape:

```json
{
  "decision": "RED_CARD",
  "confidence": 94,
  "keyTimestamp": "01:23",
  "keyTimestamps": ["01:23"],
  "keyMoments": [
    {
      "timestamp": "01:23",
      "timestampSeconds": 83.0,
      "videoIndex": 2,
      "videoLabel": "Video 2",
      "description": "Reverse angle shows high contact with excessive force."
    }
  ],
  "ruleCategory": "serious foul play",
  "explanation": "The challenge endangers player safety with excessive force.",
  "evidence": [
    {
      "timestamp": "01:23",
      "timestampSeconds": 83.0,
      "videoIndex": 2,
      "videoLabel": "Video 2",
      "description": "Gemini identified the point of contact from the second angle."
    }
  ],
  "geminiSummary": "Short summary of the visual incident.",
  "modelTrace": {
    "videoAnalyzer": "Gemini live analysis",
    "decisionModel": "Gemma on GMI Cloud live decision"
  }
}
```

## AI Pipeline

The backend flow is:

1. `VideoAnalysisService` uploads each video angle to Gemini and requests
   structured JSON with incident timestamps and visual evidence.
2. `RefereeDecisionService` sends Gemini's structured incident summary to the
   configured GMI Cloud Gemma model.
3. The backend returns Gemma's structured card decision and Gemini/Gemma trace
   metadata for transparency.

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
