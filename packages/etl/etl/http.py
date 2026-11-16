import time
from typing import Any

import requests


class HttpClient:
    def __init__(self, retries: int = 3, backoff_s: float = 0.5, timeout: float = 20.0):
        self.retries = retries
        self.backoff_s = backoff_s
        self.timeout = timeout
        self.session = requests.Session()

    def _raw_get(self, url: str, params: dict[str, Any] | None = None):
        return self.session.get(url, params=params, timeout=self.timeout)

    def _get(self, url: str, params: dict[str, Any] | None = None):
        last: Exception | None = None
        for attempt in range(self.retries):
            try:
                res = self._raw_get(url, params)
                res.raise_for_status()
                return res
            except Exception as exc:  # noqa: BLE001 - retry every transport failure
                last = exc
                if attempt < self.retries - 1 and self.backoff_s:
                    time.sleep(self.backoff_s * (attempt + 1))
        raise last  # type: ignore[misc]

    def get_json(self, url: str, params: dict[str, Any] | None = None) -> Any:
        return self._get(url, params).json()

    def get_text(self, url: str, params: dict[str, Any] | None = None) -> str:
        return self._get(url, params).text
