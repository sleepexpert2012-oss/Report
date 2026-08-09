#!/usr/bin/env python3
"""Run every production Shopee sync in a deterministic order.

The dashboard snapshot must only be published after the API sources have been
refreshed.  A JSON report is written for build_snapshot.py and for audit/debug.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests


BASE = "https://jkrczsrhonmqxwzzdgen.supabase.co/functions/v1"


def invoke(session: requests.Session, name: str, body: dict, timeout: int = 300) -> dict:
    started = datetime.now(timezone.utc).isoformat()
    t0 = time.monotonic()
    result = {"name": name, "started_at": started, "ok": False}
    try:
        response = session.post(f"{BASE}/{name}", json=body, timeout=timeout)
        result["http_status"] = response.status_code
        text = response.text.strip()
        response.raise_for_status()
        if name in {"smooth-responder", "bright-responder"}:
            # Legacy functions return HTTP 200 HTML even when their job failed.
            if "Loi:" in text or "Lỗi:" in text:
                raise RuntimeError(text[:1000])
            result["ok"] = "Dong bo" in text or "Ads toi" in text
            result["response"] = text[:500]
        elif text:
            payload = response.json()
            result["ok"] = bool(payload.get("ok"))
            result["response"] = payload
        else:
            # The Video function can close its large response after all endpoint
            # checkpoints were committed. Freshness is verified below through
            # ops-responder, so an empty body is provisional rather than success.
            result["provisional"] = True
            result["response"] = None
    except Exception as exc:  # freshness verification decides whether this is fatal
        result["error"] = str(exc)[:1200]
    result["elapsed_seconds"] = round(time.monotonic() - t0, 2)
    return result


def unwrap(payload: dict) -> dict:
    return payload.get("payload", payload) if isinstance(payload, dict) else {}


def verify(session: requests.Session, run_started: str) -> tuple[dict, list[str]]:
    response = session.post(f"{BASE}/ops-responder", json={}, timeout=180)
    response.raise_for_status()
    payload = unwrap(response.json())
    quality = payload.get("data_quality") or {}
    sources = {x.get("key"): x for x in payload.get("sources") or []}
    modules = {x.get("module"): x for x in (payload.get("api_coverage") or {}).get("modules") or []}
    errors: list[str] = []

    for key in ("sale", "ads", "stock"):
        source = sources.get(key) or {}
        if source.get("status") != "connected" or int(source.get("rows") or 0) <= 0:
            errors.append(f"{key}: nguồn bắt buộc chưa kết nối hoặc không có dữ liệu")
    if int(quality.get("sales_rows") or 0) <= 0:
        errors.append("sales_fact trống")
    if int(quality.get("ads_rows") or 0) <= 0:
        errors.append("ads_fact trống")
    if int(quality.get("inventory_rows") or 0) <= 0:
        errors.append("tonkho trống")

    # These modules write checkpoints during this exact orchestrated run.
    # Live/Brand are intentionally excluded until Shopee authorization exists.
    for key in ("product", "payment", "logistics", "order", "affiliate", "video"):
        module = modules.get(key) or {}
        stamp = str(module.get("last_success_at") or "")
        if not stamp or stamp < run_started:
            errors.append(f"{key}: checkpoint chưa được làm mới trong lần chạy này")

    summary = {
        "generated_at": payload.get("generated_at"),
        "sync_status": payload.get("sync_status"),
        "data_quality": quality,
        "sources": payload.get("sources"),
        "api_coverage": payload.get("api_coverage"),
    }
    return summary, errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("sync-report.json"))
    args = parser.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    session = requests.Session()
    jobs = [
        ("smooth-responder", {}, 180),
        ("bright-responder", {}, 180),
        ("smart-endpoint", {}, 180),
        ("inventory-responder", {}, 240),
        ("ops-sync", {"mode": "sync", "days": 30, "budget_ms": 90000}, 180),
        ("shopee-channel-sync", {"app": "affiliate", "days": 30}, 240),
        ("shopee-channel-sync", {"app": "video", "days": 30}, 300),
        ("shopee-channel-sync", {"app": "live", "days": 30}, 120),
    ]
    steps = []
    for name, body, timeout in jobs:
        print(f"→ {name} {body}", flush=True)
        step = invoke(session, name, body, timeout)
        steps.append(step)
        print(f"  ok={step['ok']} · {step['elapsed_seconds']}s", flush=True)

    verification, errors = verify(session, started)
    report = {
        "version": "shopee-hourly-pipeline-v1",
        "started_at": started,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "steps": steps,
        "verification": verification,
        "blocking_errors": errors,
        "ok": not errors,
    }
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": report["ok"], "blocking_errors": errors}, ensure_ascii=False), flush=True)
    if errors:
        raise SystemExit("Không phát hành snapshot vì dữ liệu nguồn chưa đạt freshness gate")


if __name__ == "__main__":
    main()
