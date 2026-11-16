from typing import Any, Protocol

from etl.records import OfferingRecord, ResourceRecord


class Collector(Protocol):
    dataset: str

    def fetch(self) -> list[dict[str, Any]]: ...

    def normalize(self, rows: list[dict[str, Any]]) -> list[ResourceRecord | OfferingRecord]: ...


def unwrap_items(payload):
    """data.go.kr 공통 envelope(response.body.items.item)를 리스트로 푼다."""
    node = payload
    if isinstance(node, list):
        return node
    for key in ("response", "body", "items", "item"):
        if isinstance(node, dict) and key in node:
            node = node[key]
    if isinstance(node, list):
        return node
    if isinstance(node, dict) and all(not isinstance(v, (dict, list)) for v in node.values()):
        return [node]
    return []
