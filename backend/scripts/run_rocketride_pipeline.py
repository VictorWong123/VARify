#!/usr/bin/env python3
"""Run a RocketRide pipeline and emit structured JSON on stdout."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Execute a RocketRide pipeline.")
    parser.add_argument("--pipeline", help="Filesystem path to the .pipe file")
    parser.add_argument("--timeout", type=int, default=120, help="Maximum wait time in seconds")
    parser.add_argument("--health", action="store_true", help="Validate bridge dependencies")
    parser.add_argument("--ping", action="store_true", help="Ping RocketRide Cloud connectivity")
    return parser.parse_args()


def read_input() -> str:
    if sys.stdin.isatty():
        return ""
    return sys.stdin.read()


def rocketride_config() -> tuple[str | None, str | None]:
    api_key = os.getenv("ROCKETRIDE_APIKEY")
    uri = os.getenv("ROCKETRIDE_URI", "https://cloud.rocketride.ai")
    return uri, api_key


def extract_text(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        for key in ("text", "content", "output", "result"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                return value
            if value is not None and not isinstance(value, (str, dict, list)):
                return str(value)
        answers = raw.get("answers")
        if isinstance(answers, list) and answers:
            first = answers[0]
            if isinstance(first, str):
                return first
            return json.dumps(first)
        return json.dumps(raw)
    if isinstance(raw, list) and raw:
        return extract_text(raw[0])
    return str(raw)


def extract_json_object(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if not stripped:
        raise ValueError("Pipeline returned empty output.")

    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if fenced:
        parsed = json.loads(fenced.group(1))
        if isinstance(parsed, dict):
            return parsed

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end > start:
        parsed = json.loads(stripped[start : end + 1])
        if isinstance(parsed, dict):
            return parsed

    preview = stripped[:500]
    raise ValueError(f"Pipeline output was not valid JSON. Preview: {preview}")


async def run_health_check(pipeline_path: str | None) -> dict[str, Any]:
    if pipeline_path and not Path(pipeline_path).exists():
        raise FileNotFoundError(f"Pipeline file not found: {pipeline_path}")

    from rocketride import RocketRideClient  # noqa: F401

    return {"status": "ok"}


async def run_ping() -> dict[str, Any]:
    from rocketride import RocketRideClient

    uri, api_key = rocketride_config()
    if not api_key:
        raise RuntimeError("ROCKETRIDE_APIKEY is not set.")

    client = RocketRideClient(uri=uri, auth=api_key)
    await client.connect()
    try:
        await client.ping()
        return {"status": "ok", "connectivity": "ok"}
    finally:
        await client.disconnect()


async def run_pipeline(
    pipeline_path: str,
    input_text: str,
    timeout_seconds: int,
) -> dict[str, Any]:
    from rocketride import RocketRideClient

    uri, api_key = rocketride_config()
    if not api_key:
        raise RuntimeError("ROCKETRIDE_APIKEY is not set.")

    client = RocketRideClient(uri=uri, auth=api_key)
    await client.connect()

    try:
        result = await client.use(filepath=pipeline_path)
        token = result["token"]
        send_result = await client.send(token, input_text)

        deadline = time.time() + timeout_seconds
        status = await client.get_task_status(token)
        while status.get("state") not in ("completed", "failed", "terminated"):
            if time.time() > deadline:
                raise TimeoutError(f"Pipeline timed out after {timeout_seconds}s.")
            await asyncio.sleep(1)
            status = await client.get_task_status(token)

        if status.get("state") == "failed":
            error = status.get("error") or status.get("message") or "unknown error"
            raise RuntimeError(f"Pipeline failed: {error}")

        raw_result = send_result
        if hasattr(client, "get_task_result"):
            raw_result = await client.get_task_result(token)

        text = extract_text(raw_result)
        return extract_json_object(text)
    finally:
        await client.disconnect()


def main() -> int:
    args = parse_args()

    try:
        if args.health:
            payload = asyncio.run(run_health_check(args.pipeline))
            sys.stdout.write(json.dumps(payload))
            return 0

        if args.ping:
            payload = asyncio.run(run_ping())
            sys.stdout.write(json.dumps(payload))
            return 0

        if not args.pipeline:
            print("--pipeline is required unless using --health or --ping.", file=sys.stderr)
            return 2

        input_text = read_input()
        if not input_text.strip():
            print("Missing pipeline input on stdin.", file=sys.stderr)
            return 2

        decision = asyncio.run(
            run_pipeline(
                pipeline_path=args.pipeline,
                input_text=input_text,
                timeout_seconds=args.timeout,
            )
        )
    except Exception as error:  # noqa: BLE001 - bridge must surface any pipeline failure
        print(str(error), file=sys.stderr)
        return 1

    sys.stdout.write(json.dumps(decision))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
