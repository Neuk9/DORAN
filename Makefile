.PHONY: setup up down test-api test-etl test-web lint format typecheck seed demo hooks

setup: up
	cd apps/api && uv sync
	cd packages/etl && uv sync
	cd apps/web && pnpm install
	cp -n .env.example .env || true

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

lint:
	cd apps/api && uv run ruff check .
	cd packages/etl && uv run ruff check .
	cd apps/web && pnpm exec tsc --noEmit
	cd apps/web && pnpm exec eslint .
	cd apps/web && pnpm exec prettier --check "app/**/*.{ts,tsx,css}" "components/**/*.{ts,tsx}" "lib/**/*.ts" "e2e/**/*.ts"

format:
	cd apps/api && uv run ruff format .
	cd packages/etl && uv run ruff format .
	cd apps/web && pnpm exec prettier --write "app/**/*.{ts,tsx,css}" "components/**/*.{ts,tsx}" "lib/**/*.ts" "e2e/**/*.ts"

typecheck:
	cd apps/web && pnpm exec tsc --noEmit

seed:
	bash scripts/seed_demo.sh

demo:
	bash scripts/seed_demo.sh
	cd apps/api && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

hooks:
	pre-commit install
