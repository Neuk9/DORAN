from app.services.crisis import detect_crisis
from app.services.pii import mask_pii


def test_address_masked():
    m = mask_pii("대구 수성구 범어로 100 3동 201호로 오세요")
    assert "201호" not in m.text


def test_prevention_program_is_not_crisis():
    assert detect_crisis("아동학대 예방 교육 프로그램 알려줘") is None


def test_self_harm_variants_detected():
    assert detect_crisis("자해를 하고 싶어요") is not None
    assert detect_crisis("더 이상 못 살겠어요") is not None
