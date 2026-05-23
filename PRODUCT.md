# VARify

## Register

product

## Users

- **Match referees and assistant referees** reviewing card decisions on contested fouls. They need a verdict and a defensible rationale within seconds, often under crowd pressure.
- **Video assistant referees (VAR officials)** working a booth, cross-referencing multiple broadcast camera angles.
- **Hackathon judges and demo audiences** seeing the tool for the first time. They need to read the product story without explanation.

## Product purpose

VARify is an AI referee assistant that ingests one or more clips of a foul incident and returns a card decision (`RED_CARD`, `YELLOW_CARD`, `NO_CARD`) with confidence, key timestamps, rule interpretation, and per-angle evidence. The signature interaction is the **VAR·AI agent brief**: after the verdict lands, a named assistant streams a first-person clinical explanation that references each camera angle by callsign, while the corresponding angle thumbnails and evidence pins light up in sync.

## Brand and tone

- **Aesthetic anchor**: broadcast VAR booth at a 2026 FIFA World Cup Bay Area match. Dim ambient light, monitors glowing, decisions read instantly under pressure.
- **Voice**: clinical broadcast analyst. First person, present tense, short sentences. Decisive. No filler, no hedging, no exclamation marks, no emoji.
- **Identity**: VAR·AI — a named assistant referee, presented as a callsign with a live indicator, not an avatar.
- **Typography spirit**: editorial broadcast — bold Space Grotesk for display, Inter for UI, JetBrains Mono for timestamps, confidence, CAM IDs, and any numeric.

## Anti-references

- Generic soccer green pitch + emerald gradient buttons. The training-data reflex.
- Neon cyan + dark blue "VAR/AI" tropes. The second-order reflex.
- Chatbot avatars and chat-bubble UI for the agent voice. Reads as ChatGPT wrapper.
- Toy / mascot illustrations of cards and whistles.
- Gradient text. Glassmorphism for decoration. Side-stripe borders.
- Friendly SaaS empty states with cute shield icons.

## Strategic principles

1. **The verdict reads in one second.** Decision, confidence, key moment must be glanceable. The narrative around them can take longer.
2. **Multiple angles are the AI's job.** The interface should make the cross-referencing visible, not hide it. When the agent mentions an angle, the UI shows what the agent is looking at.
3. **The agent is decisive.** The voice never says "I think," "perhaps," or "it might be." The call lands at the end of the brief, on the last sentence.
4. **Broadcast discipline beats SaaS friendliness.** This is a referee tool that happens to be polished, not a friendly app that happens to do refereeing.
5. **Presets are demo plumbing, not features.** They exist because the backend requires real GMI keys to run live. Style them as "reference incidents" — not "demo buttons."

## API contract (frozen)

Backend: `POST /api/analyze` with multipart `video` field (one or more files).

Response (`RefereeDecisionResponse`):

```ts
{
  decision: "RED_CARD" | "YELLOW_CARD" | "NO_CARD";
  confidence: number;            // 0..100 (or 0..1, frontend normalizes)
  keyTimestamp: string;          // legacy single span "00:07-00:09"
  keyTimestamps: string[];       // current, may be empty
  keyMoments: EvidenceMoment[];  // richer evidence with per-angle metadata
  ruleCategory: "careless" | "reckless" | "excessive force" | "no offense";
  explanation: string;
  evidence: EvidenceMoment[];    // legacy, may overlap with keyMoments
  geminiSummary: string;
  modelTrace: Record<string, any>;
}

EvidenceMoment {
  timestamp: string;             // "00:07"
  description: string;
  videoIndex?: number;           // 1-indexed angle
  videoLabel?: string;           // "Video 1", "Broadcast", etc.
  timestampSeconds?: number;     // for precise video seek
}
```

The frontend uses `keyMoments` when present, falls back to `evidence`. Uses `timestampSeconds` for scrubbing, falls back to parsing `timestamp`.

## Out of scope (for now)

- Authentication and user accounts
- Match history, saved reviews, comparison across incidents
- Live broadcast ingest, real-time match clock sync
- Coaching / training mode for amateur refs
- Backend mock mode (presets cover demo without keys)
