import os
import sys
import json
import time

MODEL = os.getenv("GMI_VIDEO_MODEL", "Wan-AI_Wan2.1-T2V-14B")


def build_prompt(data):
    decision = data.get("decision", "Yellow Card")
    summary = data.get("incident_summary", "A soccer foul is being reviewed by VAR.")
    moments = data.get("key_moments", [])
    moments_text = "; ".join(moments) if moments else "No specific moments provided"

    return f"""Create a short broadcast-style VAR replay explanation for a soccer referee decision.

Style: realistic sports broadcast replay, dramatic but clean, referee analysis graphics, slow motion feel, professional VAR review room aesthetic.

Incident summary: {summary}
Key evidence moments: {moments_text}
Final decision: {decision}

Include visual emphasis on the foul moment, a referee-analysis feel, and a final decision graphic reading: {decision}.
Do not show gore, injury closeups, or unrealistic violence.""".strip()


def submit_video(data):
    try:
        from gmicloud import Client
        from gmicloud._internal._models import SubmitRequestRequest

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
        return {"request_id": response.request_id, "model": MODEL, "status": "processing"}
    except ImportError:
        return {"request_id": "demo-" + str(int(time.time())), "model": MODEL, "status": "unavailable", "error": "gmicloud package not installed"}
    except Exception as e:
        return {"request_id": "error-" + str(int(time.time())), "model": MODEL, "status": "error", "error": str(e)}


if __name__ == "__main__":
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {}
    result = submit_video(data)
    print(json.dumps(result))
