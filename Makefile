.PHONY: up down test-api test-etl test-web seed demo

up:
	docker compose up -d db

down:
	docker compose down

test-api:
	cd apps/api && uv run pytest -q

test-etl:
	cd packages/etl && uv run pytest -q

test-web:
	cd apps/web && pnpm exec playwright test

seed:
	bash scripts/seed_demo.sh

demo:
	bash scripts/seed_demo.sh
	cd apps/api && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
