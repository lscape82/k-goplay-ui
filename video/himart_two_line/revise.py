from pathlib import Path
p=Path(__file__).with_name('render.py');s=p.read_text(encoding='utf-8')
a=s.index('SCENES=[');b=s.index('def ease',a)
s=s[:a]+'''SCENES=[
 dict(start=0,end=3.6,layers=[
  line('입주 · 혼수 · 이사',833,132),
  line('준비 중이시라면',1018,65,at=.18),
 ]),
 dict(start=3.38,end=7.0,layers=[
  line('올해 마지막',792,65),
  line('특별행사',978,195,at=.18),
 ]),
 dict(start=6.78,end=10.8,layers=[
  line('삼성  엘지',792,65),
  line('인기 가전 총집합',978,119,at=.18),
 ]),
 dict(start=10.58,end=15.0,layers=[
  line('가격만큼은',833,160),
  line('기대하셔도 좋습니다',1018,65,at=.18),
 ]),
 dict(start=14.78,end=20,layers=[
  line('가전 구입혜택은',792,65),
  line('오픈 행사점이 가장 좋습니다',978,82,at=.18),
 ]),
]
'''+s[b:]
p.write_text(s,encoding='utf-8')
