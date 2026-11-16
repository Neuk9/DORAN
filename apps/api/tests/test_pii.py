from app.services.pii import mask_pii
from app.services.crisis import detect_crisis


def test_rrn_and_phone_masked():
    m = mask_pii("주민번호 900101-1234567, 연락처 010-1234-5678")
    assert "900101-1234567" not in m.text
    assert "010-1234-5678" not in m.text
    assert set(m.found) == {"rrn", "phone"}


def test_real_crisis_detected():
    assert detect_crisis("죽고 싶어요") is not None


def test_exaggeration_not_crisis():
    assert detect_crisis("죽을 만큼 바빠요") is None
