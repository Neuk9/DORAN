from etl.geocode import Geocoder


def test_missing_address_returns_none_precision():
    g = Geocoder(kakao_key=None)
    r = g.resolve("", None)
    assert r.lat is None and r.precision == "none"


def test_api_failure_falls_back_to_district(monkeypatch):
    g = Geocoder(kakao_key="test")
    monkeypatch.setattr(g, "_call_kakao", lambda *a, **k: (_ for _ in ()).throw(RuntimeError()))
    r = g.resolve("대구 수성구 범어로 1", "27110")
    assert r.precision == "district"
    assert r.lat is None
    assert r.adm_cd is None or r.adm_cd.startswith("27110")
