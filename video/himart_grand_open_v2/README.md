# 롯데하이마트 성서점 광고 수정본

- 20초 / 1080×1920 / 30fps / H.264 / 무음
- 첨부 GRAND OPEN 이미지를 원래 종횡비로 확대해 상단에 20초 동안 고정합니다.
- 고정 이미지의 로고와 글자는 원본을 그대로 사용합니다.
- 이미지 아래 장면별 문구: Noto Sans KR, 보조 문구 700 / 핵심 문구 850 굵기.
- 배경 건물은 원본을 유지하고 100→104%로 천천히 확대합니다.
- 기존 버전은 ../himart_grand_open 에 보존했습니다.

## 수정

render.py 상단의 SCENES에서 text, size, at, dur, start, end 등을 수정합니다.
POSITIONS는 상단 고정 이미지를 위한 장면별 문구 중심 y 좌표입니다.
HEADER에서 고정 이미지 위치와 폭을 수정할 수 있습니다.
load_font에서 글자 굵기를 수정할 수 있습니다.

필요 패키지: Pillow, numpy, imageio-ffmpeg.
폰트 경로: C:/Windows/Fonts/NotoSansKR-VF.ttf.

```powershell
python render.py --preview
python render.py --render
python verify.py
```

assets 폴더에 원본 배경과 고정 이미지가 포함되어 있습니다.
previews/encoded_contact_sheet.jpg는 최종 MP4에서 추출한 장면 모음입니다.
