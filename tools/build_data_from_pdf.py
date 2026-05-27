#!/usr/bin/env python3
"""Build reviewed JSON and CSV sheets from the extracted 광고플레이 DOOH PDF."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


def krw(text: str | None) -> int | None:
    if not text:
        return None
    clean = text.replace(",", "").replace(" ", "")
    if "억원" in clean:
        number = float(clean.split("억원", 1)[0])
        return int(number * 100_000_000)
    if "만원" in clean:
        number = float(clean.split("만원", 1)[0])
        return int(number * 10_000)
    if re.fullmatch(r"\d+", clean):
        return int(clean)
    return None


def pricing(
    label: str,
    raw_text: str,
    *,
    duration: int | None = None,
    plays: int | None = None,
    monthly: str | None = None,
    p15: str | None = None,
    p10: str | None = None,
    p7: str | None = None,
    p5: str | None = None,
    p3: str | None = None,
    p1: str | None = None,
    needs_review: bool = False,
) -> dict:
    return {
        "label": label,
        "durationSec": duration,
        "dailyPlays": plays,
        "monthlyPriceKRW": krw(monthly),
        "price15DaysKRW": krw(p15),
        "price10DaysKRW": krw(p10),
        "price7DaysKRW": krw(p7),
        "price5DaysKRW": krw(p5),
        "price3DaysKRW": krw(p3),
        "price1DayKRW": krw(p1),
        "rawText": raw_text,
        "needsReview": needs_review,
    }


def media_item(
    slug: str,
    name: str,
    area_slug: str,
    area_name: str,
    category: str,
    media_type: str,
    source_pages: list[int],
    *,
    address: str,
    tags: list[str],
    width: float | None = None,
    height: float | None = None,
    resolution: str = "",
    operation_hours: str = "",
    price_rows: list[dict] | None = None,
    location_description: str = "",
    recommended_industries: list[str] | None = None,
    short_term: bool = True,
    needs_review: bool = False,
    note: str = "",
) -> dict:
    return {
        "slug": slug,
        "name": name,
        "areaSlug": area_slug,
        "areaName": area_name,
        "category": category,
        "mediaType": media_type,
        "address": address,
        "locationDescription": location_description,
        "tags": tags,
        "widthM": width,
        "heightM": height,
        "resolutionPx": resolution,
        "operationHours": operation_hours,
        "pricing": price_rows or [],
        "taxNote": "VAT 별도",
        "availabilityNote": "모든 매체는 선착순 예약이며 확정 시점에 구좌 가능 여부 확인 필요",
        "shortTermAvailable": short_term,
        "imageUrl": f"assets/images/pdf-pages/page-{source_pages[0]:03d}.jpg",
        "recommendedIndustries": recommended_industries or ["뷰티", "패션", "프리미엄 리테일", "F&B", "전시/문화"],
        "sourcePages": source_pages,
        "needsReview": needs_review or any(row.get("needsReview") for row in (price_rows or [])),
        "dataQualityNote": note,
    }


def build_areas() -> list[dict]:
    return [
        {
            "slug": "dosan-daero",
            "name": "도산대로 프리미엄",
            "summary": "압구정·청담 프리미엄 상권, 럭셔리 브랜드와 트렌디 소비층이 밀집된 핵심 소비 축",
            "description": "차량 정체구간과 대형 교차로가 이어지는 하이엔드 소비 상권입니다. 뷰티, 패션, 수입차, 프리미엄 라이프스타일 브랜드의 인지도 캠페인에 적합합니다.",
            "dailyFootTraffic": 198092,
            "trafficVolumeDaily": 36644,
            "subwayMonthlyUsers": [
                {"station": "신사역 3호선", "users": 1771915},
                {"station": "신사역 신분당선", "users": 510832},
                {"station": "압구정역 3호선", "users": 2063914},
                {"station": "압구정로데오역 수인분당선", "users": 1278508},
                {"station": "청담역", "users": 1160642},
                {"station": "학동역", "users": 1385498},
                {"station": "강남구청역", "users": 1034458},
            ],
            "primaryTargets": ["2030~40대 고소득 소비층", "패션·뷰티 트렌드 리더", "프리미엄 상권 방문객"],
            "recommendedIndustries": ["럭셔리", "뷰티", "패션", "수입차", "라이프스타일"],
            "sourcePages": [7, 18],
            "needsReview": False,
            "dataQualityNote": "",
        },
        {
            "slug": "samseong-coex",
            "name": "삼성 코엑스",
            "summary": "코엑스·전시장·몰 이용객이 상시 유입되는 MICE·비즈니스 복합 상권",
            "description": "전시, 쇼핑, 문화 소비가 결합된 체류형 거점입니다. 영동대로 정체 구간과 보행 동선이 겹쳐 대형 전광판 주목도가 높습니다.",
            "dailyFootTraffic": 291095,
            "trafficVolumeDaily": 67576,
            "subwayMonthlyUsers": [
                {"station": "삼성역 2호선", "users": 3595169},
                {"station": "봉은사역 9호선", "users": 1582113},
            ],
            "primaryTargets": ["전시·컨벤션 방문객", "오피스 직장인", "MZ 문화 소비층", "글로벌 방문객"],
            "recommendedIndustries": ["테크", "전시/문화", "뷰티", "패션", "B2B 서비스"],
            "sourcePages": [7, 39],
            "needsReview": True,
            "dataQualityNote": "교통량이 테헤란로/영동대교 두 값으로 병기되어 대표값은 보수적으로 67,576대를 사용했습니다.",
        },
        {
            "slug": "gangnam-daero",
            "name": "강남역/강남대로",
            "summary": "서울 유동인구 1위권의 업무·쇼핑·외식 핵심 상권",
            "description": "초대형 전광판과 버스쉘터, 지하철 디지털 매체를 조합하기 좋은 대표 업무·소비 상권입니다.",
            "dailyFootTraffic": 357552,
            "trafficVolumeDaily": None,
            "subwayMonthlyUsers": [{"station": "강남역 2호선", "users": 5046293}],
            "primaryTargets": ["3040 직장인", "MZ 쇼핑객", "야간 상권 이용객"],
            "recommendedIndustries": ["F&B", "패션", "테크", "교육", "금융"],
            "sourcePages": [7, 8],
            "needsReview": False,
            "dataQualityNote": "",
        },
        {
            "slug": "myeongdong-euljiro",
            "name": "명동/을지로입구",
            "summary": "국내외 관광객과 쇼핑 수요가 집중되는 글로벌 리테일 상권",
            "description": "K-뷰티, 패션, 리테일 브랜드의 관광객 대상 노출에 적합합니다.",
            "dailyFootTraffic": 254317,
            "trafficVolumeDaily": None,
            "subwayMonthlyUsers": [
                {"station": "을지로입구역 2호선", "users": 3460259},
                {"station": "명동역 4호선", "users": 2674996},
            ],
            "primaryTargets": ["국내외 관광객", "쇼핑 방문객", "도심 직장인"],
            "recommendedIndustries": ["뷰티", "패션", "관광", "리테일"],
            "sourcePages": [7, 8],
            "needsReview": False,
            "dataQualityNote": "",
        },
        {
            "slug": "gwanghwamun",
            "name": "광화문",
            "summary": "관공서·대사관·글로벌 기업과 관광 동선이 겹치는 도심 관문",
            "description": "평일 직장인 유동과 주말 관광 수요가 동시에 발생하는 상징적 도심 노출지입니다.",
            "dailyFootTraffic": 250960,
            "trafficVolumeDaily": None,
            "subwayMonthlyUsers": [
                {"station": "광화문역 5호선", "users": 2467800},
                {"station": "경복궁역 3호선", "users": 1639224},
            ],
            "primaryTargets": ["도심 직장인", "관광객", "공공기관 방문객"],
            "recommendedIndustries": ["금융", "공공캠페인", "관광", "기업 브랜딩"],
            "sourcePages": [7, 8],
            "needsReview": False,
            "dataQualityNote": "",
        },
        {
            "slug": "yeouido",
            "name": "여의도",
            "summary": "금융·방송·공공기관이 집중된 서울 대표 업무지구",
            "description": "직장인 중심의 고소득 유동과 더현대서울 방문 수요를 함께 커버할 수 있습니다.",
            "dailyFootTraffic": 246276,
            "trafficVolumeDaily": None,
            "subwayMonthlyUsers": [
                {"station": "여의도역 5호선", "users": 1826075},
                {"station": "여의나루역 5호선", "users": 751772},
            ],
            "primaryTargets": ["3040 직장인", "금융권 종사자", "쇼핑 방문객"],
            "recommendedIndustries": ["금융", "프리미엄 리테일", "F&B", "문화"],
            "sourcePages": [7],
            "needsReview": False,
            "dataQualityNote": "",
        },
        {
            "slug": "hongdae",
            "name": "홍대",
            "summary": "젊은 소비층과 외국인 관광객이 교차하는 문화·콘텐츠 상권",
            "description": "공연, 패션, F&B, 콘텐츠 소비가 활발해 SNS 확산형 캠페인에 적합합니다.",
            "dailyFootTraffic": 265796,
            "trafficVolumeDaily": None,
            "subwayMonthlyUsers": [{"station": "홍대입구역 2호선", "users": 5078231}],
            "primaryTargets": ["20대", "외국인 관광객", "콘텐츠 소비층"],
            "recommendedIndustries": ["패션", "F&B", "콘텐츠", "공연", "뷰티"],
            "sourcePages": [7, 8],
            "needsReview": True,
            "dataQualityNote": "PDF 추출값이 '50,78,231'로 보여 5,078,231로 정리했으며 원본 대조가 필요합니다.",
        },
        {
            "slug": "seongsu",
            "name": "성수",
            "summary": "카페거리·편집숍·팝업스토어가 밀집한 트렌드 선도 상권",
            "description": "체류형 방문과 SNS 공유가 활발해 브랜드 경험형 캠페인과 궁합이 좋습니다.",
            "dailyFootTraffic": 167319,
            "trafficVolumeDaily": None,
            "subwayMonthlyUsers": [{"station": "성수역 2호선", "users": 3786067}],
            "primaryTargets": ["2030 여성", "트렌드 소비층", "팝업 방문객"],
            "recommendedIndustries": ["뷰티", "패션", "라이프스타일", "F&B"],
            "sourcePages": [7, 8],
            "needsReview": False,
            "dataQualityNote": "",
        },
        {
            "slug": "jamsil",
            "name": "잠실",
            "summary": "업무·관광·쇼핑·레저가 결합된 대형 복합 상권",
            "description": "롯데월드타워·몰과 이벤트 수요를 기반으로 가족·관광 유동을 폭넓게 커버합니다.",
            "dailyFootTraffic": 346781,
            "trafficVolumeDaily": None,
            "subwayMonthlyUsers": [{"station": "잠실역 2호선", "users": 5621542}],
            "primaryTargets": ["가족 방문객", "관광객", "쇼핑객", "직장인"],
            "recommendedIndustries": ["리테일", "엔터테인먼트", "F&B", "레저"],
            "sourcePages": [7],
            "needsReview": False,
            "dataQualityNote": "",
        },
        {
            "slug": "seoul-station",
            "name": "서울역",
            "summary": "KTX·공항철도·지하철이 집결된 전국 단위 교통 허브",
            "description": "국내외 방문객과 전국 이동 수요가 집중되는 관문형 노출지입니다.",
            "dailyFootTraffic": 179975,
            "trafficVolumeDaily": None,
            "subwayMonthlyUsers": [
                {"station": "서울역 1호선", "users": 4739906},
                {"station": "서울역 4호선", "users": 1144578},
            ],
            "primaryTargets": ["출장객", "관광객", "전국 이동객"],
            "recommendedIndustries": ["여행", "금융", "리테일", "공공캠페인"],
            "sourcePages": [7, 13],
            "needsReview": False,
            "dataQualityNote": "",
        },
        {
            "slug": "mapo",
            "name": "마포/공덕",
            "summary": "대기업 사옥과 업무시설이 밀집한 안정적 오피스 상권",
            "description": "직장인 중심의 반복 노출과 점심·퇴근 소비 동선 공략에 적합합니다.",
            "dailyFootTraffic": 247807,
            "trafficVolumeDaily": None,
            "subwayMonthlyUsers": [{"station": "마포역 5호선", "users": 934703}],
            "primaryTargets": ["4050 직장인", "오피스 방문객"],
            "recommendedIndustries": ["B2B", "금융", "F&B", "생활서비스"],
            "sourcePages": [7],
            "needsReview": False,
            "dataQualityNote": "",
        },
    ]


def build_media() -> list[dict]:
    media: list[dict] = [
        media_item("sinsa-h-station", "신사동 휴먼타워 H-스테이션 전광판", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [19], address="서울시 서초구 강남대로 605, 휴먼타워", tags=["신사", "가로수길", "강남대로", "도산대로", "한남대교"], width=10.8, height=19.6, resolution="1320 x 2400", operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("20초 100회", "1일 20초 100회 1,200만원/월 (1개월 미만 협의 필요)", duration=20, plays=100, monthly="1,200만원"), pricing("30초 100회", "1일 30초 100회 1,500만원/월 (1개월 미만 협의 필요)", duration=30, plays=100, monthly="1,500만원")]),
        media_item("sinsa-syh-tower", "신사역 사거리 SYH타워", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [20], address="서울시 강남구 신사동 501-2", tags=["신사역사거리", "가로수길", "강남대로", "한남대교", "쇼핑"], width=11.8, height=19.0, resolution="1248 x 1872", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "1,200만원/월, 600만원/15일, 336만원/7일, 50만원/1일", duration=20, plays=100, monthly="1,200만원", p15="600만원", p7="336만원", p1="50만원"), pricing("30초 100회", "1,500만원/월, 750만원/15일, 420만원/7일, 60만원/1일", duration=30, plays=100, monthly="1,500만원", p15="750만원", p7="420만원", p1="60만원")]),
        media_item("sinsa-yk-tower", "신사역 YK타워 유경빌딩", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [21], address="서울시 강남구 도산대로 121", tags=["신사역", "도산대로", "가로수길", "명품", "프리미엄", "미용병원"], width=12.5, height=17.3, resolution="1248 x 1728", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "1,200만원/월, 750만원/15일, 350만원/7일", duration=20, plays=100, monthly="1,200만원", p15="750만원", p7="350만원"), pricing("30초 100회", "1,500만원/월 (1개월 미만 협의 필요)", duration=30, plays=100, monthly="1,500만원")]),
        media_item("sinsa-peyto", "신사동 PEYTO 페이토", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [22], address="서울시 강남구 도산대로 134", tags=["신사", "강남", "도산대로", "가로수길", "쇼핑", "관광"], width=13.1, height=14.0, resolution="1296 x 1376", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "1,200만원/월, 720만원/15일", duration=20, plays=100, monthly="1,200만원", p15="720만원"), pricing("30초 100회", "1,500만원/월, 900만원/15일", duration=30, plays=100, monthly="1,500만원", p15="900만원")]),
        media_item("hakdong-ss-tower", "학동사거리 S&S타워", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [23], address="서울시 강남구 도산대로 409", tags=["강남", "도산대로", "학동사거리", "청담", "압구정", "프리미엄"], width=13.0, height=17.2, resolution="1280 x 1696", operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("15초 100회", "1일 15초 100회 1,000만원/월 (1개월 미만 협의 필요)", duration=15, plays=100, monthly="1,000만원"), pricing("20초 100회", "1일 20초 100회 1,200만원/월 (1개월 미만 협의 필요)", duration=20, plays=100, monthly="1,200만원"), pricing("30초 100회", "1일 30초 100회 1,500만원/월 (1개월 미만 협의 필요)", duration=30, plays=100, monthly="1,500만원")]),
        media_item("dosan-sgf-cheongdam", "도산대로 SGF청담타워", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [24], address="서울시 강남구 도산대로 327", tags=["청담", "압구정", "영동대교", "프리미엄", "명품"], width=11.4, height=19.6, resolution="1104 x 1920", operation_hours="06:00~24:00", price_rows=[pricing("15초 100회", "1,000만원/월", duration=15, plays=100, monthly="1,000만원"), pricing("20초 100회", "1,200만원/월, 600만원/15일", duration=20, plays=100, monthly="1,200만원", p15="600만원"), pricing("30초 100회", "1,500만원/월, 750만원/15일", duration=30, plays=100, monthly="1,500만원", p15="750만원")]),
        media_item("dosan-sb-tower", "도산공원사거리 SB타워", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [25], address="서울시 강남구 도산대로 318", tags=["강남", "신사동", "도산공원사거리", "도산대로", "명품"], width=10.0, height=22.1, resolution="960 x 2170", operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("20초 150회 또는 30초 100회", "1일 20초 150회 / 1일 30초 100회 1,500만원/월 (1개월 미만 협의 필요)", duration=20, plays=150, monthly="1,500만원")], note="20초 150회와 30초 100회가 같은 가격 영역에 병기되어 대표 조건으로 정리했습니다."),
        media_item("dosan-sun-and-vill", "도산공원사거리 썬앤빌", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [26], address="서울시 강남구 도산대로 225", tags=["강남", "신사동", "도산공원사거리", "도산대로", "명품"], width=12.3, height=17.9, resolution="1216 x 1760", operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("20초 150회 또는 30초 100회", "1일 20초 150회 / 1일 30초 100회 1,500만원/월 (1개월 미만 협의 필요)", duration=20, plays=150, monthly="1,500만원")]),
        media_item("dosan-sun-vill-hak-pkg", "도산 현대썬앤빌 & 학빌딩 PKG", "dosan-daero", "도산대로 프리미엄", "package", "패키지", [27], address="서울시 강남구 도산대로 225, 239", tags=["도산대로", "언주로", "도산공원사거리", "프리미엄", "수입차"], width=None, height=None, resolution="1216 x 1760 / 1280 x 768", operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("패키지", "1일 20초 150회 / 1일 30초 100회 2,000만원/월, (1개월 미만 협의 필요)", duration=20, plays=150, monthly="2,000만원")]),
        media_item("dosan-emporia", "도산공원사거리 엠포리아빌딩", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [28], address="서울시 강남구 도산대로 220", tags=["강남", "논현동", "도산공원사거리", "수입차", "프리미엄"], width=12.4, height=18.2, resolution="1216 x 1792", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "1,200만원/월. 600만원/15일, 450만원/10일, 300만원/7일, 130만원/3일", duration=20, plays=100, monthly="1,200만원", p15="600만원", p10="450만원", p7="300만원", p3="130만원"), pricing("30초 100회", "1,500만원/월 (1개월 미만 협의 필요)", duration=30, plays=100, monthly="1,500만원")]),
        media_item("dosan-gangnam-building", "도산대로 강남빌딩 전광판", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [29], address="서울시 강남구 도산대로 217", tags=["도산대로", "신사동", "을지병원사거리", "프리미엄", "수입차전시장"], width=13.0, height=17.2, resolution="1280 x 1680", operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("20초 100회", "1,200만원/월 (1개월 미만 협의 필요)", duration=20, plays=100, monthly="1,200만원"), pricing("30초 100회", "1,500만원/월 (1개월 미만 협의 필요)", duration=30, plays=100, monthly="1,500만원")]),
        media_item("dosan-baekyoung-building", "도산대로 백영빌딩 전광판", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [30], address="서울시 강남구 도산대로 307", tags=["강남", "압구정역", "압구정로데오역", "도산대로"], width=40.0, height=9.0, resolution="3968 x 864 ((1536+512+1920) x 864)", operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("30초 100회", "1일 30초 100회 1,500만원/월 (1개월 미만 협의 필요)", duration=30, plays=100, monthly="1,500만원")]),
        media_item("dosan-hak-building", "도산공원사거리 학빌딩", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [31], address="서울시 강남구 도산대로 239", tags=["강남", "도산대로", "언주로", "도산공원사거리", "프리미엄", "수입차"], width=16.5, height=9.0, resolution="1280 x 768", operation_hours="06:00~24:00", price_rows=[pricing("20초 150회 또는 30초 100회", "1,200만원/월, 720만원/15일, 336만원/7일, 432만원/3일(3구좌)", duration=20, plays=150, monthly="1,200만원", p15="720만원", p7="336만원", p3="432만원", needs_review=True)], note="3일 가격에 '(3구좌)' 조건이 붙어 단순 단기 단가로 보기 어려워 검수 필요합니다."),
        media_item("dosan-bmw-building", "도산공원 사거리 BMW 빌딩", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [32], address="서울시 강남구 도산대로 301", tags=["강남", "도산대로", "언주로", "도산공원사거리", "프리미엄", "수입차"], width=13.0, height=8.0, resolution="1920 x 1080", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "800만원/월, 400만원/15일, 250만원/7일, 120만원/3일, 45만원/1일", duration=20, plays=100, monthly="800만원", p15="400만원", p7="250만원", p3="120만원", p1="45만원")]),
        media_item("dosan-hakil-building", "도산대로 학동사거리 학일빌딩", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [33], address="서울시 강남구 논현동 94-2", tags=["도산대로", "학동사거리", "교차로", "수입차전시장", "명품"], width=17.2, height=8.6, resolution="1680 x 812", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "600만원/월, 300만원/15일, 150만원/7일, 90만원/3일, 45만원/1일", duration=20, plays=100, monthly="600만원", p15="300만원", p7="150만원", p3="90만원", p1="45만원"), pricing("30초 100회", "800만원/월, 400만원/15일, 200만원/7일, 120만원/3일, 60만원/1일", duration=30, plays=100, monthly="800만원", p15="400만원", p7="200만원", p3="120만원", p1="60만원")]),
        media_item("dosan-hansum-building", "도산대로 한섬빌딩 전광판", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [34], address="서울시 강남구 도산대로 523", tags=["청담동", "도산대로", "명품", "청담사거리"], width=11.5, height=19.5, resolution="1056 x 1824", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "1,200만원/월. 700만원/15일, 350만원/7일", duration=20, plays=100, monthly="1,200만원", p15="700만원", p7="350만원"), pricing("30초 100회", "1,500만원/월. 800만원/15일, 400만원/7일", duration=30, plays=100, monthly="1,500만원", p15="800만원", p7="400만원")]),
        media_item("cheongdam-bluepearl-hotel", "청담 블루펄호텔 전광판", "dosan-daero", "도산대로 프리미엄", "large_billboard", "대형 전광판", [35], address="서울시 강남구 청담동 129-3", tags=["영동대로", "교차로", "고급주거지역", "프리미엄", "교통정체구간"], width=11.0, height=19.5, resolution="1056 x 1920", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "1,200만원/월, 650만원/15일, 400만원/7일, 240만원/3일, 80만원/1일", duration=20, plays=100, monthly="1,200만원", p15="650만원", p7="400만원", p3="240만원", p1="80만원"), pricing("30초 100회", "1,500만원/월, 800만원/15일, 450만원/7일, 300만원/3일, 100만원/1일", duration=30, plays=100, monthly="1,500만원", p15="800만원", p7="450만원", p3="300만원", p1="100만원")]),
        media_item("dosan-timesync-1", "도산대로 사거리 타임싱크 1", "dosan-daero", "도산대로 프리미엄", "package", "타임싱크 패키지", [36], address="도산대로 썬앤빌·학빌딩·엠포리아 일대", tags=["엠포리아빌딩", "현대썬앤빌", "학빌딩", "타임싱크"], operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("썬타워+학빌딩", "00분 30분 Time Sync(36회)+1일 30초 140회, 7,500만원/월", duration=30, plays=140, monthly="7,500만원"), pricing("엠포리아", "00분 30분 Time Sync(36회)+1일 30초 200회, 4,500만원/월", duration=30, plays=200, monthly="4,500만원"), pricing("3개 매체 패키지", "도산대로 썬타워 + 학빌딩 + 엠포리아 1.2억원 / 1.1억원", duration=30, plays=None, monthly="1.2억원", needs_review=True)], needs_review=True, note="패키지 가격이 1.2억원과 1.1억원으로 병기되어 적용 조건 확인이 필요합니다."),
        media_item("dosan-timesync-2", "도산대로 사거리 타임싱크 2", "dosan-daero", "도산대로 프리미엄", "package", "타임싱크 패키지", [37], address="도산대로 SB타워·백영빌딩 일대", tags=["SB타워", "백영빌딩", "도산공원", "도산대로"], operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("SB타워", "Time Sync(36회)+1일 30초 140회 4,500만원/월", duration=30, plays=140, monthly="4,500만원"), pricing("백영빌딩", "Time Sync(36회)+1일 30초 100회 3,600만원/월", duration=30, plays=100, monthly="3,600만원"), pricing("2개 매체 패키지", "도산대로 SB타워 + 도산대로 백영빌딩 8,100만원 / 7,000만원", duration=30, plays=None, monthly="8,100만원", needs_review=True)], needs_review=True, note="패키지 가격이 8,100만원과 7,000만원으로 병기되어 적용 조건 확인이 필요합니다."),
        media_item("samseong-kpop-square-package", "삼성동 K-POP 스퀘어 패키지", "samseong-coex", "삼성 코엑스", "package", "패키지", [40], address="서울시 강남구 영동대로 511, 트레이드타워", tags=["영동대로", "교차로", "프리미엄", "교통정체구간"], width=81.0, height=20.0, resolution="", operation_hours="06:00~24:00", price_rows=[pricing("패키지", "패키지 판매 상세 정보 확인. K-POP스퀘어 단독 진행시 단기 가능", duration=None, plays=None)], needs_review=True, note="원본에 해상도와 상세 패키지 가격이 별도 페이지로 분리되어 있어 상담 확인 필요합니다."),
        media_item("samseong-coex-kpop-detail", "삼성동 COEX K-pop 스퀘어 패키지 상세", "samseong-coex", "삼성 코엑스", "package", "패키지", [41], address="서울시 강남구 영동대로 511 일대", tags=["K-pop 스퀘어", "코엑스", "패키지", "싱크"], operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("1안 패키지", "8,000만원 (1/2구좌_30초 35회)", duration=30, plays=35, monthly="8,000만원"), pricing("2안 패키지", "8,000만원 (1/2구좌_30초 35회)", duration=30, plays=35, monthly="8,000만원"), pricing("3안 단독", "6,000만원 (1/2구좌_30초 35회) / 1억원(1구좌_30초 70회)", duration=30, plays=35, monthly="6,000만원", needs_review=True)], needs_review=True, note="3안 단독 가격이 1/2구좌와 1구좌로 병기되어 대표 월가만 분리했습니다."),
        media_item("samseong-hyundai-department", "삼성역 현대백화점 전광판", "samseong-coex", "삼성 코엑스", "large_billboard", "대형 전광판", [42], address="서울시 강남구 테헤란로 517", tags=["현대백화점", "면세점", "무역센터", "삼성역", "코엑스"], width=37.4, height=36.1, resolution="3616 x 3488, (1360x3488) + (2256x3488)", operation_hours="06:00~24:00", short_term=False, price_rows=[pricing("30초 70회", "1일 30초 70회 5,000만원/월", duration=30, plays=70, monthly="5,000만원")]),
        media_item("samseong-coex-media-tower-cmt", "삼성역 코엑스 미디어타워 CMT", "samseong-coex", "삼성 코엑스", "large_billboard", "대형 전광판", [43], address="서울시 강남구 영동대로 513", tags=["코엑스", "파르나스몰", "도심공항터미널", "특급호텔", "전시"], width=10.7, height=29.6, resolution="960 x 2112", operation_hours="06:00~24:00", price_rows=[pricing("20초 70회 양면", "3,000만원/월, 1,500만원/15일, 850만원/7일, 400만원/3일", duration=20, plays=70, monthly="3,000만원", p15="1,500만원", p7="850만원", p3="400만원"), pricing("30초 70회 양면", "4,000만원/월, 2,000만원/15일, 1,100만원/7일, 500만원/3일", duration=30, plays=70, monthly="4,000만원", p15="2,000만원", p7="1,100만원", p3="500만원")]),
        media_item("samseong-parnas-media-tower-pmt", "삼성역 파르나스 미디어타워 PMT", "samseong-coex", "삼성 코엑스", "large_billboard", "대형 전광판", [44], address="서울시 강남구 테헤란로 521", tags=["코엑스", "파르나스몰", "도심공항터미널", "특급호텔", "전시"], width=12.3, height=26.0, resolution="1440 x 2560", operation_hours="06:00~24:00", price_rows=[pricing("20초 70회 양면", "4,000만원/월, 2,000만원/15일, 1,100만원/7일, 500만원/3일", duration=20, plays=70, monthly="4,000만원", p15="2,000만원", p7="1,100만원", p3="500만원"), pricing("30초 70회 양면", "5,000만원/월, 2,500만원/15일, 1,350만원/7일, 600만원/3일", duration=30, plays=70, monthly="5,000만원", p15="2,500만원", p7="1,350만원", p3="600만원")]),
        media_item("samseong-media-tower-package-cpmt", "삼성역 미디어타워 패키지 CPMT", "samseong-coex", "삼성 코엑스", "package", "패키지", [45], address="서울시 강남구 영동대로 513 / 테헤란로 521", tags=["코엑스", "파르나스몰", "도심공항터미널", "동시송출"], resolution="CMT: 960 x 2112 / PMT: 1440 x 2560", operation_hours="06:00~24:00", price_rows=[pricing("20초 70회 양면", "4,500만원/월, 2,250만원/15일, 1,700만원/7일, 800만원/3일", duration=20, plays=70, monthly="4,500만원", p15="2,250만원", p7="1,700만원", p3="800만원"), pricing("30초 70회 양면 + 싱크", "6,000만원/월, 3,000만원/15일, 2,000만원/7일, 1,000만원/3일", duration=30, plays=70, monthly="6,000만원", p15="3,000만원", p7="2,000만원", p3="1,000만원")]),
        media_item("samseong-shilla-stay", "삼성동 신라스테이 전광판", "samseong-coex", "삼성 코엑스", "large_billboard", "대형 전광판", [46], address="서울시 강남구 영동대로 506", tags=["삼성역", "코엑스", "파르나스몰", "도심공항터미널", "무역센터"], width=13.3, height=16.9, resolution="1312 x 1664", operation_hours="07:00~23:00", price_rows=[pricing("20초 100회", "1,200만원/월, 700만원/15일, 400만원/7일, 320만원/5일, 210만원/3일, 70만원/1일", duration=20, plays=100, monthly="1,200만원", p15="700만원", p7="400만원", p5="320만원", p3="210만원", p1="70만원"), pricing("30초 100회", "1,500만원/월, 850원/15일, 500만원/7일, 420만원/5일, 270만원/3일, 90만원/1일", duration=30, plays=100, monthly="1,500만원", p15=None, p7="500만원", p5="420만원", p3="270만원", p1="90만원", needs_review=True)], needs_review=True, note="30초 100회 15일 가격이 '850원/15일'로 추출되어 숫자 보정 없이 검수 필요 처리했습니다."),
        media_item("samseong-superior-tower", "삼성역 사거리 슈페리어타워", "samseong-coex", "삼성 코엑스", "large_billboard", "대형 전광판", [47], address="서울시 강남구 테헤란로 528", tags=["코엑스", "파르나스몰", "도심공항터미널", "호텔", "전시"], width=12.7, height=17.3, resolution="1248 x 1696", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "1,200만원/월, 600만원/15일, 280만원/7일, 120만원/3일, 40만원/1일", duration=20, plays=100, monthly="1,200만원", p15="600만원", p7="280만원", p3="120만원", p1="40만원"), pricing("30초 100회", "1,500만원/월, 750만원/15일, 350만원/7일, 150만원/3일, 50만원/1일", duration=30, plays=100, monthly="1,500만원", p15="750만원", p7="350만원", p3="150만원", p1="50만원")]),
        media_item("samseong-landmark-building", "삼성동 랜드마크빌딩 전광판", "samseong-coex", "삼성 코엑스", "large_billboard", "대형 전광판", [48], address="서울시 강남구 영동대로 607", tags=["도심공항터미널", "무역센터", "ASEM타워", "백화점", "호텔", "전시"], width=12.4, height=18.2, resolution="1216 x 1792", operation_hours="06:00~24:00", price_rows=[pricing("15초 100회", "1,000만원/월, 500만원/15일, 250만원/7일, 135만원/3일, 50만원/1일", duration=15, plays=100, monthly="1,000만원", p15="500만원", p7="250만원", p3="135만원", p1="50만원"), pricing("20초 100회", "1,200만원/월, 600만원/15일, 300만원/7일, 162만원/3일, 60만원/1일", duration=20, plays=100, monthly="1,200만원", p15="600만원", p7="300만원", p3="162만원", p1="60만원"), pricing("30초 100회", "1,500만원/월, 750만원/15일, 375만원/7일, 210만원/3일, 75만원/1일", duration=30, plays=100, monthly="1,500만원", p15="750만원", p7="375만원", p3="210만원", p1="75만원")]),
        media_item("samseong-luchen-tower", "삼성 도심공항터미널 사거리 루첸타워", "samseong-coex", "삼성 코엑스", "large_billboard", "대형 전광판", [49], address="서울시 강남구 테헤란로 510", tags=["코엑스", "도심공항터미널", "현대백화점", "무역센터", "영동대로"], width=10.5, height=20.0, resolution="1024 x 1888", operation_hours="06:00~24:00", price_rows=[pricing("20초 100회", "1,200만원/월, 720만원/15일, 420만원/7일, 200만원/3일, 70만원/1일", duration=20, plays=100, monthly="1,200만원", p15="720만원", p7="420만원", p3="200만원", p1="70만원"), pricing("30초 100회", "1,500만원/월, 900만원/15일, 550만원/7일, 250만원/3일, 90만원/1일", duration=30, plays=100, monthly="1,500만원", p15="900만원", p7="550만원", p3="250만원", p1="90만원")]),
        media_item("samseong-vplex", "삼성역 포스코사거리 VPLEX 전광판", "samseong-coex", "삼성 코엑스", "large_billboard", "대형 전광판", [50], address="서울시 강남구 테헤란로 501 브이플렉스", tags=["삼성역", "선릉역", "코엑스", "오피스밀집지역", "무역센터"], width=14.0, height=16.0, resolution="1376 x 1568", operation_hours="06:00~24:00", price_rows=[pricing("30초 70회", "1,500만원/월, 750만원/15일, 600만원/7일, 400만원/3일", duration=30, plays=70, monthly="1,500만원", p15="750만원", p7="600만원", p3="400만원"), pricing("30초 35회", "900만원/월", duration=30, plays=35, monthly="900만원")]),
        media_item("shopping-coex-9to9-cube", "삼성 COEX 9to9 Cube", "samseong-coex", "삼성 코엑스", "shopping_mall_did", "쇼핑몰 DID", [10], address="봉은사로 524 코엑스 메인 입구+라이브 플라자", tags=["쇼핑몰", "코엑스", "DID", "체류형"], operation_hours="상세 정보 확인", price_rows=[pricing("20초 100회", "20초 100회 2,500만원/월", duration=20, plays=100, monthly="2,500만원")], needs_review=True, note="요약 표 매체로 운영시간과 상세 규격은 별도 확인 필요합니다."),
        media_item("subway-gangnam-pmp", "강남역 2호선 PMP", "gangnam-daero", "강남역/강남대로", "subway", "지하철 광고", [11], address="강남역", tags=["지하철", "강남역", "PMP", "이동동선"], operation_hours="상세 정보 확인", price_rows=[pricing("15초 200회", "15초 200회 1,500만원/월", duration=15, plays=200, monthly="1,500만원")], needs_review=True, note="요약 표 매체로 운영시간과 상세 규격은 별도 확인 필요합니다."),
        media_item("bus-gangnam-shelter", "강남대로 디지털 버스쉘터", "gangnam-daero", "강남역/강남대로", "bus", "버스 광고", [12], address="강남대로 16면+서초2면+삼성2면", tags=["버스쉘터", "강남대로", "디지털", "반복노출"], operation_hours="상세 정보 확인", price_rows=[pricing("30초 138회", "30초 138회 2,500만원/월", duration=30, plays=138, monthly="2,500만원")], needs_review=True, note="요약 표 매체로 운영시간과 상세 규격은 별도 확인 필요합니다."),
        media_item("transport-seoul-station-ktx-panorama", "서울역 KTX 파노라마 전광판", "seoul-station", "서울역", "transport_hub", "도시 철도·버스·터미널", [13], address="서울역", tags=["KTX", "서울역", "교통허브", "전국커버리지"], operation_hours="상세 정보 확인", price_rows=[pricing("20초 100회", "20초 100회 8,000만원/월", duration=20, plays=100, monthly="8,000만원")], needs_review=True, note="요약 표 매체로 운영시간과 상세 규격은 별도 확인 필요합니다."),
        media_item("daily-apartment-elevator-tv", "아파트 엘리베이터 TV", "other-national", "전국 생활권", "daily_touchpoint", "생활밀착형 광고", [14], address="전국/수도권/지방 전체 또는 특정 구역 단지", tags=["아파트", "엘리베이터", "생활권", "반복노출"], operation_hours="상세 정보 확인", price_rows=[pricing("15초 100회 패키지", "패키지: 지역별 600만원~ 전국 1,500만원 / 개별: 서울수도권 1만원~1만5천원, 지방 8천원", duration=15, plays=100, monthly="600만원", needs_review=True)], needs_review=True, note="가격 범위와 개별 단가가 혼재되어 대표 최소 패키지 금액만 입력했습니다."),
    ]
    return media


def build_guides() -> list[dict]:
    return [
        {
            "slug": "dosan-daero-billboard-guide",
            "title": "도산대로 전광판 광고 가이드",
            "category": "지역 가이드",
            "summary": "압구정·청담 프리미엄 소비 축에서 전광판을 고를 때 확인할 입지, 타깃, 예산 기준입니다.",
            "areaSlug": "dosan-daero",
            "sourcePages": [18, 19, 36, 37],
            "body": [
                "도산대로는 차량 정체와 대형 교차로 노출이 겹치는 프리미엄 상권입니다. 신호 대기 중 주목도가 높아 럭셔리, 뷰티, 패션, 수입차 캠페인에 적합합니다.",
                "단일 매체는 600만원대부터 1,500만원대 월 단가가 많고, 타임싱크나 패키지는 여러 건물 동시 노출을 전제로 예산이 크게 올라갑니다.",
                "짧은 기간 집행이 필요한 경우 1일·3일·7일 단가가 있는 매체를 우선 검토하고, 패키지형 상품은 구좌와 기간 조건을 별도로 확인해야 합니다.",
            ],
        },
        {
            "slug": "samseong-coex-dooh-guide",
            "title": "삼성역 코엑스 DOOH 광고 가이드",
            "category": "지역 가이드",
            "summary": "전시·쇼핑·비즈니스 방문객이 겹치는 삼성 코엑스 권역의 DOOH 활용법입니다.",
            "areaSlug": "samseong-coex",
            "sourcePages": [39, 40, 46, 50],
            "body": [
                "삼성 코엑스 권역은 전시, 쇼핑, 비즈니스 방문객이 동시에 유입되는 MICE 거점입니다. 영동대로와 테헤란로의 차량·보행 동선을 함께 고려해야 합니다.",
                "K-POP 스퀘어, 현대백화점, 미디어타워, 신라스테이 등 대형 매체가 밀집해 있어 글로벌 캠페인이나 전시 연계 캠페인에 적합합니다.",
                "일부 상품은 패키지나 구좌 조건이 복잡하므로 월 단가뿐 아니라 송출 횟수, 양면 여부, 싱크 송출 조건을 함께 비교해야 합니다.",
            ],
        },
        {
            "slug": "how-to-read-billboard-pricing",
            "title": "전광판 광고비 보는 법",
            "category": "예산 가이드",
            "summary": "월 광고비, 단기 단가, 송출 횟수, 초수 조건을 같은 기준으로 비교하는 방법입니다.",
            "areaSlug": "",
            "sourcePages": [9, 18, 39],
            "body": [
                "전광판 가격은 보통 영상 길이, 1일 송출 횟수, 운영시간, 화면 면적, 위치 프리미엄이 함께 반영됩니다.",
                "월 단가가 같아도 20초 100회와 30초 70회는 노출 총량이 다릅니다. 예산표를 볼 때는 초수와 횟수를 먼저 맞춰 비교해야 합니다.",
                "자료의 모든 광고비는 VAT 별도 참고가입니다. 최종 집행 전에는 구좌 가능 여부, 시즌 할증, 단기 집행 가능 여부를 상담 시점에 확인해야 합니다.",
            ],
        },
        {
            "slug": "premium-beauty-dooh-selection",
            "title": "프리미엄 뷰티 브랜드를 위한 DOOH 매체 선택법",
            "category": "업종 가이드",
            "summary": "뷰티·패션 브랜드가 프리미엄 상권에서 매체를 고를 때의 체크포인트입니다.",
            "areaSlug": "dosan-daero",
            "sourcePages": [7, 8, 18],
            "body": [
                "프리미엄 뷰티 캠페인은 단순 유동량보다 상권 이미지, 체류 동선, 타깃 소비력을 함께 봐야 합니다.",
                "도산대로와 명동은 각각 하이엔드 소비층과 관광 쇼핑 수요가 강합니다. 런칭 캠페인은 대형 전광판, 팝업 연계 캠페인은 버스쉘터나 지하철 동선을 함께 조합하는 방식이 효율적입니다.",
                "소재는 멀리서도 메시지가 읽히도록 제품 컷, 브랜드명, 핵심 혜택을 간결하게 구성하는 편이 좋습니다.",
            ],
        },
        {
            "slug": "short-term-dooh-checklist",
            "title": "1일·3일·7일 단기 집행 가능한 DOOH 광고 체크리스트",
            "category": "운영 가이드",
            "summary": "팝업, 행사, 런칭 일정에 맞춰 단기 DOOH를 집행할 때 확인해야 할 항목입니다.",
            "areaSlug": "",
            "sourcePages": [20, 32, 35, 46, 49],
            "body": [
                "단기 집행은 1일, 3일, 7일 단가가 명시된 매체를 우선 검토해야 합니다. 모든 매체가 단기 집행을 허용하는 것은 아닙니다.",
                "영상 소재 심의와 송출 세팅에는 시간이 필요합니다. 교통매체는 더 긴 리드타임이 필요할 수 있으므로 캠페인 시작일 기준으로 역산해야 합니다.",
                "짧은 캠페인은 위치와 타깃 적합도가 성과를 좌우합니다. 행사장, 팝업, 매장 반경과 실제 이동 동선을 기준으로 매체를 좁히는 방식이 좋습니다.",
            ],
        },
    ]


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def min_monthly(media: dict) -> int | None:
    values = [row.get("monthlyPriceKRW") for row in media.get("pricing", []) if row.get("monthlyPriceKRW")]
    return min(values) if values else None


def write_csvs(media: list[dict], areas: list[dict]) -> None:
    with (DATA_DIR / "media.csv").open("w", newline="", encoding="utf-8-sig") as fp:
        fieldnames = [
            "slug",
            "name",
            "areaSlug",
            "areaName",
            "category",
            "mediaType",
            "address",
            "tags",
            "widthM",
            "heightM",
            "resolutionPx",
            "operationHours",
            "minMonthlyPriceKRW",
            "sourcePages",
            "needsReview",
            "dataQualityNote",
        ]
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        for item in media:
            writer.writerow(
                {
                    **{key: item.get(key, "") for key in fieldnames if key not in {"tags", "sourcePages", "minMonthlyPriceKRW"}},
                    "tags": "|".join(item.get("tags", [])),
                    "sourcePages": "|".join(str(page) for page in item.get("sourcePages", [])),
                    "minMonthlyPriceKRW": min_monthly(item),
                }
            )

    with (DATA_DIR / "media_pricing.csv").open("w", newline="", encoding="utf-8-sig") as fp:
        fieldnames = [
            "mediaSlug",
            "mediaName",
            "label",
            "durationSec",
            "dailyPlays",
            "monthlyPriceKRW",
            "price15DaysKRW",
            "price10DaysKRW",
            "price7DaysKRW",
            "price5DaysKRW",
            "price3DaysKRW",
            "price1DayKRW",
            "rawText",
            "needsReview",
        ]
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        for item in media:
            for row in item.get("pricing", []):
                writer.writerow({"mediaSlug": item["slug"], "mediaName": item["name"], **{key: row.get(key) for key in fieldnames[2:]}})

    with (DATA_DIR / "areas.csv").open("w", newline="", encoding="utf-8-sig") as fp:
        fieldnames = [
            "slug",
            "name",
            "summary",
            "dailyFootTraffic",
            "trafficVolumeDaily",
            "subwayMonthlyUsersSummary",
            "recommendedIndustries",
            "sourcePages",
            "needsReview",
        ]
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        for area in areas:
            subway = "; ".join(f"{row['station']} {row['users']}" for row in area.get("subwayMonthlyUsers", []))
            writer.writerow(
                {
                    "slug": area["slug"],
                    "name": area["name"],
                    "summary": area["summary"],
                    "dailyFootTraffic": area.get("dailyFootTraffic"),
                    "trafficVolumeDaily": area.get("trafficVolumeDaily"),
                    "subwayMonthlyUsersSummary": subway,
                    "recommendedIndustries": "|".join(area.get("recommendedIndustries", [])),
                    "sourcePages": "|".join(str(page) for page in area.get("sourcePages", [])),
                    "needsReview": area.get("needsReview", False),
                }
            )


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    areas = build_areas()
    media = build_media()

    if not any(area["slug"] == "other-national" for area in areas):
        areas.append(
            {
                "slug": "other-national",
                "name": "전국 생활권",
                "summary": "아파트, 오피스, 편의점, 대학교 등 생활 접점 중심의 전국 커버리지",
                "description": "지역 단위 또는 전국 단위로 일상 반복 노출을 설계할 수 있는 생활밀착형 매체군입니다.",
                "dailyFootTraffic": None,
                "trafficVolumeDaily": None,
                "subwayMonthlyUsers": [],
                "primaryTargets": ["거주민", "직장인", "학생", "생활권 소비자"],
                "recommendedIndustries": ["생활서비스", "F&B", "교육", "앱", "리테일"],
                "sourcePages": [14],
                "needsReview": True,
                "dataQualityNote": "요약형 생활권 매체의 전국 단위 데이터로 지역별 유동 수치가 분리되어 있지 않습니다.",
            }
        )

    write_json(DATA_DIR / "areas.json", areas)
    write_json(DATA_DIR / "media.json", media)
    write_json(DATA_DIR / "guides.json", build_guides())
    write_csvs(media, areas)
    print(f"Built {len(media)} media rows, {len(areas)} area rows, 5 guides.")


if __name__ == "__main__":
    main()
