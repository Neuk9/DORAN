import time
import uuid
from dataclasses import dataclass, field

TTL_SECONDS = 24 * 60 * 60


@dataclass
class ChatSession:
    session_id: str
    messages: list[dict[str, str]] = field(default_factory=list)
    slots: dict = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)


class SessionStore:
    def __init__(self, ttl_seconds: int = TTL_SECONDS):
        self.ttl = ttl_seconds
        self._data: dict[str, ChatSession] = {}

    def get(self, session_id: str | None) -> ChatSession:
        if session_id and session_id in self._data:
            session = self._data[session_id]
            if time.time() - session.created_at < self.ttl:
                return session
        sid = session_id or uuid.uuid4().hex
        session = ChatSession(session_id=sid)
        self._data[sid] = session
        return session

    def append(self, session_id: str, role: str, content: str) -> None:
        session = self.get(session_id)
        session.messages.append({"role": role, "content": content})


store = SessionStore()
