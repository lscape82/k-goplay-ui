from pathlib import Path
p=Path(__file__).with_name('render.py');s=p.read_text(encoding='utf-8')
a=s.index('SCENES=[');b=s.index('def ease',a)
s=s[:a]+'''# Font contour comparison with sample: weight 650, tracking -0.075em.
FONT_WEIGHT=650
TRACKING=-0.075
SCENES=[
 dict(start=0,end=4,layers=[
  dict(text='입주',x=243,y=812,size=123,at=.08,dur=.26,dy=80),
  dict(text='·',x=391,y=812,size=70,at=.24,dur=.2),
  dict(text='혼수',x=540,y=812,size=123,at=.26,dur=.26,dy=80),
  dict(text='·',x=689,y=812,size=70,at=.42,dur=.2),
  dict(text='이사',x=837,y=812,size=123,at=.44,dur=.26,dy=80),
  dict(text='준비 중이시라면',x=540,y=996,size=83,at=.85,dur=.32,dy=68,roll=True),
 ]),
 dict(start=4,end=8,layers=[
  dict(text='올해 마지막',x=540,y=757,size=72,at=.05,dur=.28,scale=1.4),
  *[dict(text=c,x=247+i*195,y=960,size=164,at=.35+i*.14,dur=.3,outline=True) for i,c in enumerate('특별행사')],
 ]),
 dict(start=8,end=12,layers=[
  dict(text='삼성  엘지',x=540,y=801,size=88,at=.05,dur=.28,scale=1.7,settle=-60),
  dict(text='인기 가전',x=540,y=903,size=129,at=.57,dur=.3,dy=80,roll=True),
  dict(text='총 집합',x=540,y=1061,size=135,at=.93,dur=.27,scale=.55,ghost=True),
 ]),
 dict(start=12,end=16,layers=[
  dict(text='가격만큼은',x=540,y=758,size=73,at=.06,dur=.27,dy=-75,roll=True),
  dict(text='기대하셔도',x=540,y=925,size=135,at=.28,dur=.28,scale=.65),
  dict(text='좋습니다',x=540,y=1080,size=119,at=.58,dur=.26,dy=85,roll=True),
 ]),
 dict(start=16,end=20,layers=[
  dict(text='가전 구입혜택은',x=540,y=749,size=70,at=.04,dur=.28,dy=65,roll=True),
  dict(text='오픈 행사점이',x=540,y=916,size=116,at=.36,dur=.32,outline=True),
  dict(text='가장 좋습니다',x=540,y=1080,size=125,at=.82,dur=.28,scale=1.55,ghost=True),
 ]),
]
'''+s[b:]
a=s.index('def tile(c):');b=s.index('TILES=',a)
s=s[:a]+'''def tile(c):
    f=ImageFont.truetype(FONT,c['size']);f.set_variation_by_axes([FONT_WEIGHT])
    tracking=c['size']*TRACKING
    width=round(sum(f.getlength(ch)+tracking for ch in c['text'])-tracking)+50
    m=Image.new('L',(width,c['size']*2));d=ImageDraw.Draw(m);x=24
    for ch in c['text']:
        d.text((x,0),ch,font=f,fill=255);x+=f.getlength(ch)+tracking
    box=m.getbbox();m=m.crop((0,max(0,box[1]-18),width,box[3]+18))
    im=Image.new('RGBA',m.size,(255,255,255,0));im.putalpha(m)
    return im
'''+s[b:]
s=s.replace("out=0 if index==4 else smooth((t-(s['end']-.32))/.32)","out=0 if index==4 else smooth((t-(s['end']-.22))/.22)")
needle="            source=TILES[id(c)].copy()"
s=s.replace(needle,needle+'''
            if c.get('outline'):
                m=source.getchannel('A')
                interior=m.filter(ImageFilter.MinFilter(5))
                edge=np.asarray(m).astype(float)-np.asarray(interior).astype(float)
                fill=smooth((age-.09)/.26)
                source.putalpha(Image.fromarray(np.uint8(np.clip(edge*.7+np.asarray(interior)*fill,0,255))))
            if c.get('ghost') and age<.65:
                g=TILES[id(c)].copy();m=g.getchannel('A')
                inner=m.filter(ImageFilter.MinFilter(3))
                edge=np.asarray(m).astype(float)-np.asarray(inner).astype(float)
                g.putalpha(Image.fromarray(np.uint8(edge*.24*(1-smooth(age/.65)))))
                factor=1.5+.35*ease(age/.65)
                g=g.resize((round(g.width*factor),round(g.height*factor)),Image.Resampling.BICUBIC)
                canvas.alpha_composite(g,(round(c['x']-g.width/2),round(c['y']-g.height/2)))
''')
s=s.replace('alpha=smooth(age/.18)*(1-out)','alpha=smooth(age/.07)*(1-out)')
s=s.replace("c.get('settle',0)*ease((lt-1.0)/.5)-26*out","c.get('settle',0)*ease((lt-.35)/.25)-55*out")
needle="            canvas.alpha_composite(source,(round(x-source.width/2),round(y-source.height/2)))"
s=s.replace(needle,"""            layer=Image.new('RGBA',(WIDTH,HEIGHT))
            layer.alpha_composite(source,(round(x-source.width/2),round(y-source.height/2)))
            if c.get('roll'):
                top=round(c['y']-TILES[id(c)].height/2-2)
                bottom=round(c['y']+TILES[id(c)].height/2+2)
                layer=layer.crop((0,top,WIDTH,bottom))
                canvas.alpha_composite(layer,(0,top))
            else:canvas.alpha_composite(layer)
""")
p.write_text(s,encoding='utf-8')
