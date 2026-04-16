#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.db import SessionLocal
from app.services.operations_service import build_integrity_report


def main() -> int:
    parser = argparse.ArgumentParser(description="Check uploaded log/file integrity.")
    parser.add_argument("--json", action="store_true", help="Print the report as JSON.")
    parser.add_argument("--fail-on-issues", action="store_true", help="Exit with code 1 when issues are found.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        report = build_integrity_report(db)
    finally:
        db.close()

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"status: {report['status']}")
        print(f"generated_at: {report['generated_at']}")
        for key, value in report["counts"].items():
            print(f"{key}: {value}")

    if args.fail_on_issues and report["status"] != "ok":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
