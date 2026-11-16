#!/usr/bin/env bash
set -euo pipefail
curl -fsS http://localhost:8000/api/health | grep -q '"status":"ok"'
curl -fsS "http://localhost:8000/api/programs?size=1" | grep -q '"data"'
curl -fsS "http://localhost:8000/api/regions/2711053000/gap" | grep -q '"gap_score"'
echo "offline demo check passed"
