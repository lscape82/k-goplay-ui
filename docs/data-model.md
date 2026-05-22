# 데이터 모델

## media.json

매체 단위 데이터입니다. HTML은 이 파일을 fetch해서 목록과 상세를 렌더링합니다.

핵심 필드:

- `slug`: URL 식별자
- `name`: 매체명
- `areaSlug`, `areaName`: 지역 연결
- `category`: 허용 카테고리
- `address`: 주소
- `tags`: 검색 태그
- `widthM`, `heightM`, `resolutionPx`: 규격과 해상도
- `operationHours`: 운영시간
- `pricing`: 가격 행 배열
- `imageUrl`: PDF 렌더링 이미지
- `sourcePages`: 원본 PDF 페이지
- `needsReview`, `dataQualityNote`: 검수 상태

## areas.json

지역 단위 상권 데이터입니다.

핵심 필드:

- `slug`: URL 식별자
- `name`: 지역명
- `summary`, `description`: 웹용 설명
- `dailyFootTraffic`: 일평균 유동인구
- `trafficVolumeDaily`: 일평균 교통량
- `subwayMonthlyUsers`: 역별 월 이용객
- `primaryTargets`: 주요 타깃
- `recommendedIndustries`: 추천 업종
- `sourcePages`: 원본 PDF 페이지

## guides.json

PDF 내용을 그대로 복사하지 않고 웹용으로 요약·재작성한 콘텐츠입니다.

## category 허용값

- `large_billboard`
- `shopping_mall_did`
- `subway`
- `bus`
- `transport_hub`
- `daily_touchpoint`
- `package`
- `other`
