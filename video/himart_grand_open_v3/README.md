# 고정 레이아웃 + 중앙 문구 모션

사용자가 제공한 fixed_layout.png를 고정 배경으로 사용합니다.
상단 GRAND OPEN / Pre Open, 하단 행사 일정과 건물이 계속 유지됩니다.
화면 캡처의 최상단 회색 3px만 제외하고 원래 비율을 유지하여 1080×1920에 맞춥니다.

- 0–3초: 고정 안내 화면
- 3–6초: 입주 · 혼수 · 이사 / 준비 중이시라면
- 6–9초: 올해 마지막 / 특별행사
- 9–12초: 삼성 LG / 인기 가전 / 총 집합
- 12–15.5초: 가격만큼은 / 기대하셔도 좋습니다
- 15.5–20초: 가전 구입혜택은 / 오픈 행사점이 가장 좋습니다

전체 배경 확대 없이 중앙 문구만 애니메이션됩니다.
폰트는 Noto Sans KR 가변 폰트의 700·850 굵기입니다.
20초, 30fps, 600프레임, H.264, 무음.

render.py 상단 SCENES에서 문구·시간·크기를 수정할 수 있습니다.
POSITIONS는 중앙 빈 영역에 맞춘 각 문구의 y 좌표입니다.

```powershell
python render.py --preview
python render.py --render
python verify.py
```

필요 패키지: Pillow, numpy, imageio-ffmpeg.
폰트: C:/Windows/Fonts/NotoSansKR-VF.ttf.
