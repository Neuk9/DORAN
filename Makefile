.PHONY: setup up down seed ingest dev-api dev-web test-api build-web lint format typecheck hooks

setup: up
	cp -n .env.example .env || true
	cd apps/api && uv sync
	cd apps/web && pnpm install

up:
	docker compose up -d mongo

down:
	docker compose down

seed:
	cd apps/api && uv run python -m app.ingest.seed

ingest:
	cd apps/api && uv run python -m app.ingest.sync_public

dev-api:
	cd apps/api && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd apps/web && pnpm dev

test-api:
	cd apps/api && uv run pytest -q

build-web:
	cd apps/web && pnpm build

lint:
	cd apps/api && uv run ruff check .
	cd apps/web && pnpm exec tsc --noEmit
	cd apps/web && pnpm exec eslint .

format:
	cd apps/api && uv run ruff format .
	cd apps/web && pnpm exec prettier --write "app/**/*.{ts,tsx,css}" "components/**/*.{ts,tsx}" "lib/**/*.ts"

typecheck:
	cd apps/web && pnpm exec tsc --noEmit

hooks:
	pre-commit install
