from pathlib import Path
p=Path(__file__).with_name('render.py');s=p.read_text(encoding='utf-8')
a=s.index('# Font contour');b=s.index('def ease',a)
s=s[:a]+'''# Art direction: strong hierarchy, short masked entrances, no ghost outlines.
FONT_WEIGHT=850
TRACKING=-0.055
SCENES=[
 dict(start=0,end=3.2,layers=[
  dict(text='입주',x=540,y=885,size=228,at=0,dur=.16,scale=1.08,until=.46),
  dict(text='혼수',x=540,y=885,size=228,at=.46,dur=.16,scale=1.08,until=.92),
  dict(text='이사',x=540,y=885,size=228,at=.92,dur=.16,scale=1.08,until=1.38),
  dict(text='입주 · 혼수 · 이사',x=540,y=832,size=116,at=1.38,dur=.18,dy=55,roll=True),
  dict(text='준비 중이시라면',x=540,y=1004,size=66,weight=650,at=1.56,dur=.18,dy=36,roll=True),
 ]),
 dict(start=3.2,end=6.4,layers=[
  dict(text='올해 마지막',x=540,y=754,size=57,weight=650,at=0,dur=.16,dy=28,roll=True),
  *[dict(text=c,x=229+i*207,y=947,size=201,at=.13+i*.065,dur=.16,dy=90,roll=True) for i,c in enumerate('특별행사')],
 ]),
 dict(start=6.4,end=10,layers=[
  dict(text='삼성  엘지',x=540,y=744,size=59,weight=650,at=0,dur=.16,dy=30,roll=True),
  dict(text='인기 가전',x=540,y=883,size=120,at=.13,dur=.18,dx=-105),
  dict(text='총집합',x=540,y=1052,size=186,at=.34,dur=.17,scale=1.15),
 ]),
 dict(start=10,end=14.5,layers=[
  dict(text='가격만큼은',x=540,y=863,size=131,at=0,dur=.17,dy=70,roll=True,until=1.0),
  dict(text='가격만큼은',x=540,y=742,size=57,weight=650,at=1.0,dur=.16,dy=25,roll=True),
  dict(text='기대하셔도',x=540,y=897,size=140,at=1.12,dur=.18,dy=75,roll=True),
  dict(text='좋습니다',x=540,y=1064,size=169,at=1.33,dur=.17,scale=1.12),
 ]),
 dict(start=14.5,end=20,layers=[
  dict(text='가전 구입혜택은',x=540,y=851,size=104,at=0,dur=.18,dy=50,roll=True,until=1.1),
  dict(text='가전 구입혜택은',x=540,y=742,size=57,weight=650,at=1.1,dur=.16,dy=28,roll=True),
  dict(text='오픈 행사점이',x=540,y=898,size=121,at=1.24,dur=.19,dy=75,roll=True),
  dict(text='가장 좋습니다',x=540,y=1065,size=143,color=(255,226,158),at=1.49,dur=.18,scale=1.1),
 ]),
]
'''+s[b:]
s=s.replace('f.set_variation_by_axes([FONT_WEIGHT])',"f.set_variation_by_axes([c.get('weight',FONT_WEIGHT)])")
s=s.replace("(255,255,255,0));im.putalpha(m)","(*c.get('color',(255,255,255)),0));im.putalpha(m)")
s=s.replace("s['end']-.22))/.22)","s['end']-.12))/.12)")
s=s.replace("            if age<0:continue","            if age<0 or lt>=c.get('until',100):continue")
s=s.replace('smooth(age/.07)','smooth(age/.035)')
s=s.replace('[2.8,6.8,10.8,14.8,18.8,19.96]','[2.6,5.6,8.6,13.2,18.5,19.96]')
s=s.replace('[.16,.32,.55,.8,1.15,1.5,4.65,4.95,5.25,8.35,8.9,9.5]','[.1,.56,1.02,1.65,3.4,3.6,6.6,6.9,10.2,11.5,14.7,16.3]')
p.write_text(s,encoding='utf-8')
