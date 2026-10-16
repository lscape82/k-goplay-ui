# 롯데하이마트 성서점 GRAND OPEN

- 최종 파일: `lotte_himart_seongseo_grand_open_20s.mp4`
- 1080 × 1920 / 세로 9:16 / 30fps / 600프레임 / 20초
- H.264, yuv420p, 오디오 없음, faststart
- 원본 배경의 건물과 로고를 재생성하지 않고 그대로 사용합니다.
- 배경은 20초 동안 100% → 104%로 확대되며 하단에 고정됩니다.
- 하늘 영역에만 미세한 조명 변화가 적용됩니다. 구름 왜곡은 사용하지 않습니다.
- 모든 문구는 개별 레이어입니다. 글자 순차 등장, 페이드, 확대·축소, 수직 이동, 블러, 골드 스윕을 시간에 따라 계산합니다.
- 마지막 광고 화면을 유지하며 종료합니다.

## 수정 및 렌더링

`render.py` 상단의 `SCENES`에서 각 장면과 문구를 수정할 수 있습니다.

- `start`, `end`: 장면 시작·종료 시각(초). 퇴장 전환 때문에 일부 장면은 약간 겹칩니다.
- `out`: 퇴장 시작 시각
- `text`: 문구
- `x`, `y`: 문구 중심 위치(px)
- `size`: 폰트 크기(px). 폭이 920px를 넘는 문구는 자동 축소합니다.
- `at`, `dur`: 등장 시작 시각·소요 시간(초)
- `scale`: 등장 시작 배율
- `slide`: 등장 시작 수직 오프셋(px)
- `blur`: 등장 시작 블러 반경
- `sweep`: 골드 스윕 시작 시각

필요 패키지: Pillow, numpy, imageio-ffmpeg.
폰트: Windows의 KoPubBatangBold.ttf, malgunbd.ttf, timesbd.ttf.
다른 컴퓨터에서는 `FONTS`의 경로를 수정하세요.
원본 이미지는 `assets`에 복사되어 있으므로 재렌더링 때 바탕화면 파일이 필요하지 않습니다.

```powershell
python render.py --preview
python render.py --render
```

`previews/contact_sheet.jpg`는 6개 장면 검수용입니다.
`previews`에는 장면별 원본 크기 PNG와 전환 중간 프레임도 포함됩니다.
`render.log`는 인코딩 로그입니다.
