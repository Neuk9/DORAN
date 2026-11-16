"""골든셋 평가 하네스.

사용:
  python eval/run_eval.py --base-url http://localhost:8000 --out eval/report.json --delay 0
"""
import argparse
import json
import statistics
import time
import urllib.error
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent


def post_text(url: str, payload: dict, retries: int = 3) -> str:
    req = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(retries):
        try:
            with urlopen(req, timeout=60) as res:  # noqa: S310 - local demo endpoint
                return res.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries - 1:
                time.sleep(6)
                continue
            raise
    raise RuntimeError("unreachable")


def parse_cards(sse_text: str) -> list[dict]:
    cards: list[dict] = []
    for line in sse_text.splitlines():
        if line.startswith("data: "):
            try:
                payload = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict) and "items" in payload:
                cards = payload["items"]
    return cards


def load_cases(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--out", default=str(ROOT / "report.json"))
    parser.add_argument("--delay", type=float, default=0.0)
    args = parser.parse_args()

    cases = load_cases(ROOT / "golden_set.jsonl")
    hits = 0
    source_ok = 0
    empty = 0
    latencies: list[float] = []

    for case in cases:
        expected = set(case.get("expect_categories") or [])
        started = time.perf_counter()
        raw = post_text(f"{args.base_url}/api/chat", {
            "message": case["message"],
            "session_id": f"eval-{case['id']}",
        })
        latencies.append((time.perf_counter() - started) * 1000)
        cards = parse_cards(raw)
        if not cards:
            empty += 1
        if not expected:
            hits += 1
            continue
        top3 = {item.get("category") for item in cards[:3]}
        if expected & top3:
            hits += 1
        if cards and all(item.get("source") for item in cards):
            source_ok += 1
        if args.delay:
            time.sleep(args.delay)

    n = len(cases)
    p95 = statistics.quantiles(latencies, n=20)[-1] if len(latencies) > 2 else max(latencies or [0])
    report = {
        "n": n,
        "precision_at_3_proxy": round(hits / n, 4) if n else 0.0,
        "source_rate": round(source_ok / n, 4) if n else 0.0,
        "empty_rate": round(empty / n, 4) if n else 0.0,
        "p95_ms": round(p95, 2),
        "note": "자격 불일치율·환각률은 수동 라벨/검수 후 별도 계산한다.",
    }
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report["precision_at_3_proxy"] >= 0.70 else 1


if __name__ == "__main__":
    raise SystemExit(main())
