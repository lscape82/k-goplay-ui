# -*- coding: utf-8 -*-
"""
build-all.py — 원본 데이터(data/media.json) 기준으로 정적 페이지를 전부 다시 만든다.

【왜 필요한가】
 지도(map.html)는 media.json을 열 때마다 실시간으로 읽으므로 데이터가 바뀌면 새로고침만으로 반영된다.
 반면 매체 목록·상세는 '미리 만들어 둔 HTML'이라(봇이 읽게 하려고) 다시 만들어야 반영된다.
 → 관리자가 매체를 수정하면 이 스크립트 한 번만 돌리면 지도와 완전히 같아진다.

【실행】  python scripts/build-all.py
【라이브】 서버렌더링(SSR)으로 가면 이 단계 자체가 필요 없어진다(개발 요청서 15번 항목).
"""
import subprocess, sys, os, json, pathlib

ROOT = pathlib.Path(r"C:/goplay/k-goplay-ui")
os.chdir(ROOT)

STEPS = [
    ("매체 목록 + 매체 상세", "scripts/build-media-pages.py"),
    ("광고 인사이트",        "scripts/build-insights.py"),
    ("사이트맵",              "scripts/build-sitemap.py"),
]

def main():
    src = ROOT / "data" / "media.json"
    n = len(json.load(open(src, encoding="utf-8")))
    print(f"원본: data/media.json ({n}개 매체)\n" + "-" * 46)

    failed = []
    for label, script in STEPS:
        r = subprocess.run([sys.executable, script], capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        ok = r.returncode == 0
        out = (r.stdout or "").strip().splitlines()
        print(f"[{'OK' if ok else '실패'}] {label:22s} {out[-1] if ok and out else ''}")
        if not ok:
            failed.append(label)
            print((r.stderr or "").strip()[:400])

    print("-" * 46)
    if failed:
        print("실패:", ", ".join(failed))
        sys.exit(1)
    print("완료 — 지도와 매체 목록·상세가 같은 데이터로 동기화되었습니다.")

if __name__ == "__main__":
    main()
