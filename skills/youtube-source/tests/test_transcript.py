"""Offline contract tests; fixtures below are synthetic, not source evidence."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "transcript.py"


class TranscriptTests(unittest.TestCase):
    def test_json3_writes_readable_and_timestamped_text_with_provenance(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR")) as tmp:
            root = Path(tmp)
            source = root / "captions.json3"
            source.write_text(json.dumps({"events": [
                {"tStartMs": 0, "id": 1},
                {"tStartMs": 1120, "segs": [{"utf8": "First"}, {"utf8": " sentence."}]},
                {"tStartMs": 2500, "segs": [{"utf8": "\n"}]},
                {"tStartMs": 3600001, "segs": [{"utf8": "Next sentence."}]},
            ]}))
            output = root / "rendered"
            result = subprocess.run([
                sys.executable, str(SCRIPT), str(source), "--source", "https://youtu.be/fixture0001",
                "--kind", "youtube-auto", "--out", str(output),
            ], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(output.with_suffix(".txt").read_text(), "First sentence.\nNext sentence.\n")
            timed = output.with_suffix(".timestamped.md").read_text()
            self.assertIn("[00:01.120] First sentence.", timed)
            self.assertIn("[01:00:00.001] Next sentence.", timed)
            receipt = json.loads(output.with_suffix(".provenance.json").read_text())
            self.assertEqual(receipt["kind"], "youtube-auto")
            self.assertEqual(receipt["segments"], 2)
            self.assertEqual(len(receipt["source_sha256"]), 64)
            self.assertTrue(source.is_file())

    def test_empty_or_invalid_captions_fail_without_creating_outputs(self):
        for payload in ({"events": []}, {"events": [{"tStartMs": -1, "segs": [{"utf8": "bad"}]}]}, {}):
            with self.subTest(payload=payload), tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR")) as tmp:
                root = Path(tmp)
                source = root / "input.json"
                source.write_text(json.dumps(payload))
                result = subprocess.run([sys.executable, str(SCRIPT), str(source), "--source", "fixture",
                                         "--kind", "youtube-auto", "--out", str(root / "out")],
                                        capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((root / "out.txt").exists())

    def test_local_asr_is_rendered_and_labelled_without_claiming_youtube_captions(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("TMPDIR")) as tmp:
            root = Path(tmp)
            source = root / "asr.json"
            source.write_text(json.dumps({"segments": [{"start": 2.125, "end": 4.0, "text": " Generated speech."}]}))
            result = subprocess.run([sys.executable, str(SCRIPT), str(source), "--source", "fixture",
                                     "--kind", "local-asr", "--out", str(root / "out")], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            timed = (root / "out.timestamped.md").read_text()
            self.assertIn("local-asr", timed)
            self.assertIn("[00:02.125] Generated speech.", timed)
            self.assertEqual(json.loads((root / "out.provenance.json").read_text())["kind"], "local-asr")


if __name__ == "__main__":
    unittest.main()
