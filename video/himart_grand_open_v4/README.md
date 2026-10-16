# 원본 배경 위에 재구성한 광고

잘라 붙인 참고 이미지를 배경으로 사용하지 않습니다.
assets/background.png 한 장 위에 상단 안내와 하단 일정의 글자 및 테두리를 투명 레이어로 새로 그립니다.
브랜드 마크는 원본 광고에서 외부 배경을 제거해 사용합니다.
상단·하단은 고정되며 중앙의 2–6번 장면만 움직입니다.

render.py의 FIXED_TEXT에서 고정 문구의 위치·크기를 수정합니다.
SCENES와 POSITIONS에서 중앙 문구, 시간, 크기, 위치를 수정합니다.

20초 / 1080×1920 / 30fps / H.264 / 무음.

실행: python render.py --preview --render
검증: python verify.py

필요 패키지: Pillow, numpy, imageio-ffmpeg.
폰트: NotoSansKR-VF.ttf, timesbd.ttf, KoPubBatangBold.ttf (Windows Fonts).
