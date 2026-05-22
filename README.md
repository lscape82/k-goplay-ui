# 광고플레이 DOOH 정적 카탈로그

PDF 매체 소개자료를 기반으로 만든 정적 HTML 웹사이트와 매체 데이터 시트입니다.

## 실행 방법

```bash
python3 -m venv .venv
.venv/bin/python -m pip install pillow pypdf
.venv/bin/python tools/extract_pdf_text.py
.venv/bin/python tools/render_pdf_pages.py --all --dpi 110
.venv/bin/python tools/build_data_from_pdf.py
.venv/bin/python tools/validate_data.py
python3 -m http.server 3000
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## PDF 데이터 추출

- 기준 PDF: `source/adplay-dooh.pdf`
- 페이지별 텍스트: `data/pdf_pages_text.json`
- PDF 페이지 이미지: `assets/images/pdf-pages/page-001.jpg` 형식
- 데이터 생성: `tools/build_data_from_pdf.py`
- 데이터 검증: `tools/validate_data.py`

PDF 추출이 불확실한 가격, 패키지 조건, 요약 표 매체는 `needsReview: true`와 `dataQualityNote`로 표시했습니다.

## 데이터 구조

- `data/media.json`: 매체 기본 정보, 가격, 이미지, 원본 페이지
- `data/media.csv`: 매체 운영용 CSV
- `data/media_pricing.csv`: 가격 행 단위 CSV
- `data/areas.json`: 지역 상권, 유동인구, 타깃, 추천 업종
- `data/areas.csv`: 지역 운영용 CSV
- `data/guides.json`: 웹용 가이드 글
- `data/data-quality-report.json`: 검증 결과

## 매체 정보 수정

가격이나 주소를 수정할 때 HTML을 수정하지 않습니다.

1. `tools/build_data_from_pdf.py`의 해당 매체 데이터를 수정합니다.
2. `.venv/bin/python tools/build_data_from_pdf.py`를 실행합니다.
3. `.venv/bin/python tools/validate_data.py`로 검증합니다.
4. 브라우저를 새로고침합니다.

## 웹페이지 구조

- `index.html`: 홈
- `media.html`: 매체 리스트와 필터
- `media-detail.html?slug=...`: 매체 상세
- `areas.html`: 지역 목록
- `area-detail.html?slug=dosan-daero`: 지역 상세
- `guides.html`: 가이드 목록
- `guide-detail.html?slug=...`: 가이드 상세
- `estimate.html`: 정적 견적 문의

## 문의 폼

`estimate.html`은 서버에 저장하지 않습니다. 입력값을 이메일 본문으로 만들고 `mailto:info@k-goplay.com` 링크와 복사 버튼을 제공합니다.

## DB와 인증 제외 이유

현재 단계의 목표는 빠르게 확인 가능한 정적 정보 카탈로그입니다. 운영 데이터가 안정화되기 전까지 DB, 인증, 관리자 화면을 넣지 않아 배포와 유지보수 부담을 줄입니다.

## 향후 확장

- CMS 또는 DB 도입
- 관리자 로그인
- 실시간 구좌 관리
- 제안서 PDF 자동 생성
- 집행 리포트 공유
