from pathlib import Path
p=Path(__file__).with_name('render.py');s=p.read_text(encoding='utf-8')
a=s.index('SCENES=[');b=s.index('def ease',a)
s=s[:a]+'''# Keep complete sentences visible; animate lines with short staggered entrances.
SCENES=[
 dict(start=0,end=3.7,layers=[
  line('입주 · 혼수 · 이사',827,112),
  line('준비 중이시라면',1005,82,at=.18),
 ]),
 dict(start=3.7,end=7.2,layers=[
  line('올해 마지막',761,65),
  line('특별행사',962,195,at=.18),
 ]),
 dict(start=7.2,end=11,layers=[
  line('삼성  엘지',751,65),
  line('인기 가전',895,124,at=.14),
  line('총집합',1054,169,at=.28),
 ]),
 dict(start=11,end=15.3,layers=[
  line('가격만큼은',752,64),
  line('기대하셔도',910,139,at=.16),
  line('좋습니다',1069,156,at=.30),
 ]),
 dict(start=15.3,end=20,layers=[
  line('가전 구입혜택은',752,60),
  line('오픈 행사점이',910,114,at=.16),
  line('가장 좋습니다',1070,133,at=.30,color=(255,225,160)),
 ]),
]
'''+s[b:]
s=s.replace('[2.6,6.1,9.9,13.7,18.5,19.96]','[2.6,6.1,9.9,13.7,18.5,19.96]')
p.write_text(s,encoding='utf-8')
