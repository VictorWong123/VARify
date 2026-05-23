import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from run_rocketride_pipeline import extract_json_object, extract_text, parse_args, run_health_check


class RunRocketRidePipelineTest(unittest.TestCase):
    def test_extract_text_from_string(self) -> None:
        self.assertEqual(extract_text("hello"), "hello")

    def test_extract_text_from_dict(self) -> None:
        self.assertEqual(extract_text({"text": "decision payload"}), "decision payload")

    def test_extract_json_object_from_plain_json(self) -> None:
        payload = extract_json_object('{"decision":"NO_CARD","confidence":10}')
        self.assertEqual(payload["decision"], "NO_CARD")

    def test_extract_json_object_from_fenced_json(self) -> None:
        payload = extract_json_object(
            'Here is the result:\n```json\n{"decision":"YELLOW_CARD","confidence":55}\n```'
        )
        self.assertEqual(payload["decision"], "YELLOW_CARD")

    def test_extract_json_object_includes_preview_on_failure(self) -> None:
        with self.assertRaisesRegex(ValueError, "Preview:"):
            extract_json_object("not-json-at-all")

    def test_parse_args_supports_health_mode(self) -> None:
        with mock.patch("sys.argv", ["run_rocketride_pipeline.py", "--health", "--pipeline", "demo.pipe"]):
            args = parse_args()
        self.assertTrue(args.health)
        self.assertEqual(args.pipeline, "demo.pipe")

    def test_parse_args_supports_ping_mode(self) -> None:
        with mock.patch("sys.argv", ["run_rocketride_pipeline.py", "--ping"]):
            args = parse_args()
        self.assertTrue(args.ping)

    def test_run_health_check_validates_pipeline_path(self) -> None:
        async def run() -> None:
            fake_rocketride = mock.MagicMock()
            with tempfile.TemporaryDirectory() as temp_dir:
                pipeline = Path(temp_dir) / "demo.pipe"
                pipeline.write_text("{}", encoding="utf-8")
                with mock.patch.dict(sys.modules, {"rocketride": fake_rocketride}):
                    payload = await run_health_check(str(pipeline))
                self.assertEqual(payload["status"], "ok")

        import asyncio

        asyncio.run(run())

    def test_run_health_check_fails_for_missing_pipeline(self) -> None:
        async def run() -> None:
            with self.assertRaises(FileNotFoundError):
                await run_health_check("/tmp/does-not-exist.pipe")

        import asyncio

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
