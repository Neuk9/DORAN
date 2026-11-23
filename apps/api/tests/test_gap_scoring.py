from app.services.gap import compute_region_scores


def test_compute_region_scores_dynamic_ordering() -> None:
    sample = [
        {
            "admCd": "1153059500",
            "dong": "가리봉동",
            "population": {"total": 9000, "youth": 2100, "senior": 2600, "vulnerableRatio": 0.25},
            "supply": {"welfare": 3, "education": 0, "culture": 1, "total": 4},
        },
        {
            "admCd": "1153051000",
            "dong": "신도림동",
            "population": {"total": 35000, "youth": 9800, "senior": 4900, "vulnerableRatio": 0.09},
            "supply": {"welfare": 18, "education": 12, "culture": 10, "total": 40},
        },
        {
            "admCd": "1153054000",
            "dong": "구로3동",
            "population": {"total": 22500, "youth": 7800, "senior": 3800, "vulnerableRatio": 0.14},
            "supply": {"welfare": 10, "education": 4, "culture": 4, "total": 18},
        },
    ]

    scored = compute_region_scores(sample)
    by_code = {r["admCd"]: r["scores"] for r in scored}

    # 고령·취약 비중이 가장 높고 공급이 가장 적은 가리봉동이 최고 격차
    assert by_code["1153059500"]["gapIndex"] > by_code["1153054000"]["gapIndex"]
    assert by_code["1153054000"]["gapIndex"] > by_code["1153051000"]["gapIndex"]
    # 격차 = 수요 - 공급 정확성 검증
    for s in by_code.values():
        assert round(s["demandIndex"] - s["supplyIndex"], 1) == s["gapIndex"]
    # 공급이 0곳인 분야는 반드시 부족 분야에 포함
    assert "education" in by_code["1153059500"]["shortageCategories"]
