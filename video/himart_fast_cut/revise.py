from pathlib import Path
p=Path(__file__).with_name('render.py');s=p.read_text(encoding='utf-8')
s=s.replace("FONT='C:/Windows/Fonts/NotoSansKR-VF.ttf'","FONT='C:/Windows/Fonts/Cafe24Dangdanghae-v2.0.ttf'")
s=s.replace(";f.set_variation_by_axes([c.get('weight',FONT_WEIGHT)])",'')
a=s.index('SCENES=[');b=s.index('def ease',a)
s=s[:a]+'''# Frequent short phrase cuts: 23 compositions across 20 seconds.
TRACKING=-0.025
def line(text,y=910,size=170,at=0,**kw):
    return dict(text=text,x=540,y=y,size=size,at=at,dur=.13,dy=35,roll=True,**kw)
SCENES=[
 dict(start=0,end=.65,layers=[line('입주',size=235)]),
 dict(start=.65,end=1.3,layers=[line('혼수',size=235)]),
 dict(start=1.3,end=1.95,layers=[line('이사',size=235)]),
 dict(start=1.95,end=2.85,layers=[line('입주 · 혼수 · 이사',815,109),line('준비 중이시라면',1000,81,at=.12)]),
 dict(start=2.85,end=3.6,layers=[line('올해',size=201)]),
 dict(start=3.6,end=4.35,layers=[line('마지막',size=201)]),
 dict(start=4.35,end=5.0,layers=[line('특별',size=219)]),
 dict(start=5.0,end=5.65,layers=[line('행사',size=219)]),
 dict(start=5.65,end=6.5,layers=[line('올해 마지막',750,60),line('특별행사',957,192,at=.1)]),
 dict(start=6.5,end=7.2,layers=[line('삼성',size=213)]),
 dict(start=7.2,end=7.9,layers=[line('엘지',size=213)]),
 dict(start=7.9,end=8.7,layers=[line('인기 가전',size=171)]),
 dict(start=8.7,end=9.4,layers=[line('총집합',size=217)]),
 dict(start=9.4,end=10.3,layers=[line('삼성  엘지',751,64),line('인기 가전',898,117),line('총집합',1057,166,at=.12)]),
 dict(start=10.3,end=11.2,layers=[line('가격만큼은',size=150)]),
 dict(start=11.2,end=12.15,layers=[line('기대하셔도',size=150)]),
 dict(start=12.15,end=13.0,layers=[line('좋습니다',size=184)]),
 dict(start=13.0,end=14.1,layers=[line('가격만큼은',751,60),line('기대하셔도',903,137),line('좋습니다',1063,156,at=.12)]),
 dict(start=14.1,end=15.15,layers=[line('가전',804,117),line('구입혜택은',1001,145,at=.12)]),
 dict(start=15.15,end=16.15,layers=[line('오픈 행사점이',size=132)]),
 dict(start=16.15,end=16.95,layers=[line('가장',size=229)]),
 dict(start=16.95,end=17.8,layers=[line('좋습니다',size=184,color=(255,225,160))]),
 dict(start=17.8,end=20,layers=[line('가전 구입혜택은',750,58),line('오픈 행사점이',910,113,at=.1),line('가장 좋습니다',1070,132,at=.22,color=(255,225,160))]),
]
'''+s[b:]
s=s.replace('out=0 if index==4 else smooth((t-(s[\'end\']-.12))/.12)',"out=0")
# Pure cuts between short phrases; movements happen during the first four frames.
s=s.replace('[2.6,5.6,8.6,13.2,18.5,19.96]','[2.6,6.1,9.9,13.7,18.5,19.96]')
s=s.replace('[.1,.56,1.02,1.65,3.4,3.6,6.6,6.9,10.2,11.5,14.7,16.3]','[.25,.9,1.55,2.3,3.2,3.95,4.7,5.3,6.8,7.5,8.2,9.0]')
p.write_text(s,encoding='utf-8')
