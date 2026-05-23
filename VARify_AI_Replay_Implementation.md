# VARify AI Replay Mode Implementation Plan

## Goal

Add a high-impact **AI Replay Mode** to VARify before demo time.

Instead of only returning a card decision, VARify should generate a replay-style explanation:

1. Replay the uploaded soccer clip.
2. Pause or slow down around key timestamps.
3. Add visual overlays such as circles, boxes, arrows, and captions.
4. Add a short voiceover explaining the decision.
5. Optionally use **GMI Cloud VideoGen** to create a polished generated “referee analysis replay” clip.

The demo should feel like an automated VAR room: the system watches the clip, identifies the important moments, explains the foul, and produces a visual replay of the reasoning.

---

## Recommended Scope With 2 Hours Left

Build this in two layers:

### Layer 1: Deterministic Replay Overlay — Must Build

This is the reliable version. It uses the original uploaded video and adds replay behavior in the frontend:

- seek to key timestamps
- pause at important moments
- show overlay captions
- highlight the relevant area with a simple circle or box
- read the reasoning using browser text-to-speech

This is fast, demo-safe, and keeps the real match clip intact.

### Layer 2: GMI Cloud Generated Replay — Bonus

Use GMI Cloud VideoGen to generate a short cinematic referee-analysis clip from the incident summary or a key frame.

Do not make this the only demo path because video generation can take time and may not preserve the exact original clip. Treat it as a bonus “Generated VAR Replay” button.

---

## Which GMI Cloud Video Model To Use

### Best choice if available: Google Veo 3 on GMI Cloud

Use **Google Veo 3** if your GMI Cloud console has it available. It is the best choice for a polished, judge-impressive generated replay because it is higher quality and better suited for cinematic video generation.

Use it for:

- short generated replay summaries
- broadcast-style VAR animations
- “AI-generated referee explanation” clips
- polished demo visuals

### Best fallback: WAN 2.1 / WAN 2.2

Use **WAN 2.1 or WAN 2.2** if Veo 3 is unavailable, slow, or fails. WAN is a safer open-source-style fallback and is shown in GMI Cloud’s SDK examples.

Use it for:

- fast text-to-video testing
- cheaper fallback generation
- ensuring the GMI Cloud video generation piece works during the demo

### Best for image-to-video: Kling Image-to-Video V2.1

Use **Kling Image-to-Video V2.1** if you can extract a key frame from the uploaded soccer clip and want to animate it into a short replay-style moment.

Use it for:

- turning a key incident frame into a dramatic replay moment
- slight camera motion over a still frame
- visualizing contact with a generated zoom/pan

### Final recommendation

For the hackathon demo:

1. Use **deterministic replay overlays** as the main feature.
2. Use **Veo 3 on GMI Cloud** for the optional generated replay if available.
3. Fall back to **WAN 2.1 / WAN 2.2** if Veo 3 is not available.
4. Use **Kling Image-to-Video V2.1** only if you already have key-frame extraction working.

---

## Updated Product Flow

Current VARify flow:

```txt
Upload video → Gemini video analysis → Gemma/GMI referee decision → React dashboard
```

New VARify flow:

```txt
Upload video
→ Gemini extracts key foul moments
→ Gemma/GMI makes referee decision
→ Replay Planner creates timestamped replay script
→ React AI Replay Mode plays annotated clip
→ Optional GMI VideoGen creates cinematic replay summary
```

---

## Data Contract

Make the backend return this shape to the frontend.

```json
{
  "decision": "Yellow Card",
  "confidence": 0.82,
  "final_reason": "The challenge is reckless because the defender arrives late, makes contact with the opponent's leg, and does not clearly play the ball.",
  "rule_classification": "reckless",
  "key_moments": [
    {
      "id": 1,
      "timestamp_seconds": 4.2,
      "end_seconds": 5.2,
      "title": "Late challenge begins",
      "caption": "The defender starts the challenge after the attacker has already moved the ball.",
      "highlight": {
        "type": "circle",
        "x": 52,
        "y": 61,
        "width": 18,
        "height": 18
      }
    },
    {
      "id": 2,
      "timestamp_seconds": 6.1,
      "end_seconds": 7.0,
      "title": "Contact with opponent's leg",
      "caption": "Contact appears to occur on the opponent's leg rather than cleanly on the ball.",
      "highlight": {
        "type": "box",
        "x": 45,
        "y": 54,
        "width": 24,
        "height": 20
      }
    },
    {
      "id": 3,
      "timestamp_seconds": 7.3,
      "end_seconds": 8.2,
      "title": "Reckless force",
      "caption": "The tackle is late and creates risk to the opponent, which supports a yellow card.",
      "highlight": {
        "type": "circle",
        "x": 48,
        "y": 58,
        "width": 22,
        "height": 22
      }
    }
  ],
  "voiceover_script": "At four seconds, the defender begins a late challenge. At six seconds, contact is made with the opponent's leg rather than the ball. Because the challenge is reckless but not clearly excessive force, VARify recommends a yellow card."
}
```

Notes:

- `x`, `y`, `width`, and `height` are percentages relative to the video container.
- If Gemini cannot return accurate coordinates, hardcode the highlight near the center-bottom of the video for the demo.
- The captions matter more than perfect computer vision.

---

## Gemini Prompt Update

Use this prompt for the Gemini video analysis step.

```txt
You are the video analysis agent for VARify, an AI referee assistant.

Analyze this soccer clip and identify the key moments relevant to a potential referee card decision.

Return strict JSON only. Do not include markdown.

Schema:
{
  "incident_summary": string,
  "key_moments": [
    {
      "timestamp_seconds": number,
      "end_seconds": number,
      "title": string,
      "caption": string,
      "contact_type": string,
      "severity_clue": string,
      "possible_rule_category": "careless" | "reckless" | "excessive_force" | "no_foul",
      "highlight": {
        "type": "circle" | "box",
        "x": number,
        "y": number,
        "width": number,
        "height": number
      }
    }
  ]
}

Important:
- Choose only 3 to 5 key moments.
- Focus on late contact, contact location, ball contact, opponent safety, speed, studs, and force.
- Use timestamps that would make sense for a replay.
- Highlight coordinates should be percentages from 0 to 100 relative to the video frame.
- If exact coordinates are uncertain, estimate the region where the contact occurs.
```

---

## Gemma/GMI Referee Decision Prompt

Use this prompt for the GMI-hosted decision model.

```txt
You are the referee decision agent for VARify.

You will receive structured video evidence from a soccer clip. Make a referee-style card decision.

Decision options:
- No Card
- Yellow Card
- Red Card

Rule logic:
- careless: foul, usually no card
- reckless: yellow card
- excessive force / endangering opponent safety: red card

Return strict JSON only:
{
  "decision": "No Card" | "Yellow Card" | "Red Card",
  "confidence": number,
  "rule_classification": "careless" | "reckless" | "excessive_force" | "no_foul",
  "final_reason": string,
  "voiceover_script": string,
  "replay_title": string
}

Keep the explanation short and referee-like. Mention the key timestamp evidence.
```

---

## Frontend Implementation: AIReplay Component

Create a component like this:

```tsx
import { useEffect, useRef, useState } from "react";

type Highlight = {
  type: "circle" | "box";
  x: number;
  y: number;
  width: number;
  height: number;
};

type KeyMoment = {
  id: number;
  timestamp_seconds: number;
  end_seconds: number;
  title: string;
  caption: string;
  highlight?: Highlight;
};

type AIReplayProps = {
  videoUrl: string;
  decision: string;
  confidence: number;
  finalReason: string;
  keyMoments: KeyMoment[];
  voiceoverScript: string;
};

export default function AIReplay({
  videoUrl,
  decision,
  confidence,
  finalReason,
  keyMoments,
  voiceoverScript,
}: AIReplayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeMoment, setActiveMoment] = useState<KeyMoment | null>(null);
  const [isReplayMode, setIsReplayMode] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const current = video.currentTime;
      const moment = keyMoments.find(
        (m) => current >= m.timestamp_seconds && current <= m.end_seconds
      );
      setActiveMoment(moment || null);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [keyMoments]);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const playAIReplay = async () => {
    const video = videoRef.current;
    if (!video || keyMoments.length === 0) return;

    setIsReplayMode(true);
    speak(voiceoverScript);

    for (const moment of keyMoments) {
      video.currentTime = Math.max(0, moment.timestamp_seconds - 0.3);
      video.playbackRate = 0.55;
      await video.play();
      setActiveMoment(moment);
      await new Promise((resolve) => setTimeout(resolve, 2600));
      video.pause();
      await new Promise((resolve) => setTimeout(resolve, 900));
    }

    video.playbackRate = 1;
    setIsReplayMode(false);
  };

  const jumpToMoment = (moment: KeyMoment) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = moment.timestamp_seconds;
    video.play();
  };

  return (
    <div className="ai-replay-panel">
      <div className="replay-header">
        <div>
          <p className="eyebrow">AI Referee Replay</p>
          <h2>{decision}</h2>
          <p>{Math.round(confidence * 100)}% confidence</p>
        </div>
        <button onClick={playAIReplay}>Play AI Replay</button>
      </div>

      <div className="video-shell">
        <video ref={videoRef} src={videoUrl} controls className="replay-video" />

        {activeMoment && (
          <div className="caption-card">
            <strong>{activeMoment.title}</strong>
            <span>{activeMoment.caption}</span>
          </div>
        )}

        {activeMoment?.highlight && (
          <div
            className={`highlight ${activeMoment.highlight.type}`}
            style={{
              left: `${activeMoment.highlight.x}%`,
              top: `${activeMoment.highlight.y}%`,
              width: `${activeMoment.highlight.width}%`,
              height: `${activeMoment.highlight.height}%`,
            }}
          />
        )}
      </div>

      <div className="timeline-list">
        {keyMoments.map((moment) => (
          <button key={moment.id} onClick={() => jumpToMoment(moment)}>
            <span>{formatTime(moment.timestamp_seconds)}</span>
            <strong>{moment.title}</strong>
            <small>{moment.caption}</small>
          </button>
        ))}
      </div>

      <div className="final-reason">
        <strong>Final reasoning</strong>
        <p>{finalReason}</p>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
```

---

## CSS For Replay UI

Add this CSS quickly. Adjust class names if your project uses Tailwind or another styling system.

```css
.ai-replay-panel {
  margin-top: 24px;
  padding: 20px;
  border-radius: 20px;
  background: #08111f;
  color: white;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.replay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #7dd3fc;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.replay-header h2 {
  margin: 0;
  font-size: 2rem;
}

.replay-header button {
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  background: #38bdf8;
  color: #06101f;
  font-weight: 700;
  cursor: pointer;
}

.video-shell {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  background: black;
}

.replay-video {
  width: 100%;
  display: block;
}

.caption-card {
  position: absolute;
  left: 24px;
  bottom: 24px;
  max-width: 520px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
}

.caption-card strong {
  display: block;
  margin-bottom: 4px;
  color: #facc15;
}

.caption-card span {
  display: block;
  line-height: 1.4;
}

.highlight {
  position: absolute;
  transform: translate(-50%, -50%);
  border: 4px solid #ef4444;
  box-shadow: 0 0 24px rgba(239, 68, 68, 0.85);
  pointer-events: none;
  animation: pulseHighlight 0.9s infinite alternate;
}

.highlight.circle {
  border-radius: 999px;
}

.highlight.box {
  border-radius: 12px;
}

@keyframes pulseHighlight {
  from {
    opacity: 0.65;
    transform: translate(-50%, -50%) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.04);
  }
}

.timeline-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.timeline-list button {
  text-align: left;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: white;
  cursor: pointer;
}

.timeline-list span {
  display: inline-block;
  margin-right: 10px;
  color: #7dd3fc;
  font-weight: 700;
}

.timeline-list strong {
  display: inline-block;
  margin-bottom: 4px;
}

.timeline-list small {
  display: block;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.35;
}

.final-reason {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(250, 204, 21, 0.1);
  border: 1px solid rgba(250, 204, 21, 0.2);
}

.final-reason p {
  margin-bottom: 0;
  line-height: 1.5;
}
```

---

## Backend Endpoint For GMI VideoGen

Add an endpoint like this:

```txt
POST /api/replay/generate
```

Request:

```json
{
  "decision": "Yellow Card",
  "incident_summary": "Late sliding tackle with contact to the opponent's leg.",
  "key_moments": [
    "00:04 defender arrives late",
    "00:06 contact with opponent's leg",
    "00:07 reckless challenge"
  ]
}
```

Response:

```json
{
  "status": "processing",
  "request_id": "gmi-request-id"
}
```

Then poll:

```txt
GET /api/replay/generate/{requestId}
```

Response when done:

```json
{
  "status": "success",
  "video_url": "https://..."
}
```

---

## GMI Cloud VideoGen Python Helper

If the Java Spring Boot backend is hard to connect directly to the GMI SDK quickly, create a tiny Python helper service or script and call it from the backend.

Install:

```bash
pip install gmicloud
```

Environment variables:

```bash
export GMI_CLOUD_EMAIL="your-email"
export GMI_CLOUD_PASSWORD="your-password"
```

Create `gmi_video_replay.py`:

```python
import os
import sys
import json
import time
from gmicloud import Client
from gmicloud._internal._models import SubmitRequestRequest

MODEL = os.getenv("GMI_VIDEO_MODEL", "Wan-AI_Wan2.1-T2V-14B")


def build_prompt(data):
    decision = data.get("decision", "Yellow Card")
    summary = data.get("incident_summary", "A soccer foul is being reviewed by VAR.")
    moments = data.get("key_moments", [])
    moments_text = "; ".join(moments)

    return f"""
Create a short broadcast-style VAR replay explanation for a soccer referee decision.

Style: realistic sports broadcast replay, dramatic but clean, referee analysis graphics, slow motion feel, professional VAR review room aesthetic.

Incident summary: {summary}
Key evidence moments: {moments_text}
Final decision: {decision}

Include visual emphasis on the foul moment, a referee-analysis feel, and a final decision graphic reading: {decision}.
Do not show gore, injury closeups, or unrealistic violence.
""".strip()


def submit_video(data):
    client = Client()
    prompt = build_prompt(data)

    request = SubmitRequestRequest(
        model=MODEL,
        payload={
            "prompt": prompt,
            "video_length": 5,
            "negative_prompt": "blurry, low quality, distorted players, extra limbs, unreadable text, graphic injury",
            "cfg_scale": 7.5
        }
    )

    response = client.video_manager.create_request(request)
    return {"request_id": response.request_id, "model": MODEL}


if __name__ == "__main__":
    raw = sys.stdin.read()
    data = json.loads(raw)
    result = submit_video(data)
    print(json.dumps(result))
```

To use Veo 3, set:

```bash
export GMI_VIDEO_MODEL="Google-Veo3"
```

Important: confirm the exact model ID from the GMI Cloud console or by running `client.video_manager.get_models()` because model IDs may differ from display names.

---

## Check Available GMI Video Models

Run this once:

```python
from gmicloud import Client

client = Client()
models = client.video_manager.get_models()

for model in models:
    print(model.model, model.model_type, model.brief_description)
```

Pick in this order:

1. A model containing `Veo3` or `Veo-3`
2. A model containing `Wan2.2`
3. A model containing `Wan2.1`
4. A model containing `Kling` if doing image-to-video

---

## Spring Boot Integration Option

In Spring Boot, call the Python helper as a subprocess only for the demo.

```java
@PostMapping("/api/replay/generate")
public ResponseEntity<?> generateReplay(@RequestBody Map<String, Object> payload) throws Exception {
    ObjectMapper mapper = new ObjectMapper();
    String jsonPayload = mapper.writeValueAsString(payload);

    ProcessBuilder pb = new ProcessBuilder("python3", "gmi_video_replay.py");
    pb.redirectErrorStream(true);
    Process process = pb.start();

    try (OutputStream os = process.getOutputStream()) {
        os.write(jsonPayload.getBytes(StandardCharsets.UTF_8));
    }

    String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    int exitCode = process.waitFor();

    if (exitCode != 0) {
        return ResponseEntity.status(500).body(Map.of("error", output));
    }

    return ResponseEntity.ok(mapper.readValue(output, Map.class));
}
```

This is not perfect production architecture, but it is acceptable for a hackathon demo.

---

## Demo Script For This Feature

Say this during the demo:

```txt
The important part is that VARify does not just output a card. It builds an explainable replay.

Gemini finds the key moments in the clip, our referee agent classifies the challenge as careless, reckless, or excessive force, and then VARify generates a replay timeline with captions, highlights, and voiceover.

For the hackathon, we also connected GMI Cloud VideoGen to create an optional generated VAR-style replay summary, while the main replay uses the original uploaded footage so the evidence stays grounded.
```

---

## Final Build Order

### First 45 minutes

Build `AIReplay.tsx` with the original video, captions, highlights, and timeline buttons.

### Next 25 minutes

Add browser voiceover using `speechSynthesis`.

### Next 25 minutes

Update Gemini/Gemma JSON prompts to return `key_moments`, `highlight`, and `voiceover_script`.

### Next 20 minutes

Add the GMI VideoGen endpoint or Python helper.

### Final 5 minutes

Prepare one perfect sample clip and test the demo flow twice.

---

## Definition Of Done

The feature is demo-ready when:

- Clicking **Play AI Replay** starts the uploaded clip.
- The video slows down or pauses at key timestamps.
- Captions appear on top of the video.
- A circle or box highlights the relevant region.
- Voiceover explains the call.
- Final decision card is visible.
- Optional GMI-generated replay button exists, even if it is labeled “Generate cinematic replay.”

Do not overbuild. The judge should understand in 10 seconds that VARify has become an explainable AI referee replay system.
