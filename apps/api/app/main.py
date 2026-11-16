import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers.chat import router as chat_router
from app.routers.health import router as health_router
from app.routers.programs import router as programs_router
from app.routers.recommend import router as recommend_router
from app.routers.regions import router as regions_router
from app.routers.saved import router as saved_router


def create_app() -> FastAPI:
    app = FastAPI(title="도란도란 API", version="0.1.0")
    app.state.rate = {}
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        host = request.client.host if request.client else "unknown"
        bucket = "llm" if request.url.path in ("/api/chat", "/api/recommend") else "default"
        key = f"{host}|{bucket}"
        now = time.time()
        for stale in [k for k, v in app.state.rate.items() if not v or now - v[-1] > 120]:
            app.state.rate.pop(stale, None)
        window = [t for t in app.state.rate.get(key, []) if now - t < 60]
        if request.method == "OPTIONS":
            return await call_next(request)
        limit = 10 if bucket == "llm" else 20
        if len(window) >= limit:
            return JSONResponse(status_code=429, content={
                "error": {"code": "RATE_LIMITED", "message": "요청이 너무 많습니다"}})
        window.append(now)
        app.state.rate[key] = window
        return await call_next(request)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        code = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": code, "message": code}},
        )

    app.include_router(health_router, prefix="/api")
    app.include_router(regions_router, prefix="/api")
    app.include_router(programs_router, prefix="/api")
    app.include_router(recommend_router, prefix="/api")
    app.include_router(chat_router, prefix="/api")
    app.include_router(saved_router, prefix="/api")
    return app


app = create_app()
