#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
uv run alembic upgrade head
uv run python scripts/seed_dev.py
echo "demo seed ready"
