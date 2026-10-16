from pathlib import Path
p=Path(__file__).with_name('render.py');s=p.read_text(encoding='utf-8')
# Moving sentence groups, rather than a short entrance followed by a long still.
s=s.replace("dict(start=0,end=3.7", "dict(start=0,end=3.6")
s=s.replace("dict(start=3.7,end=7.2", "dict(start=3.38,end=7.0")
s=s.replace("dict(start=7.2,end=11", "dict(start=6.78,end=10.8")
s=s.replace("dict(start=11,end=15.3", "dict(start=10.58,end=15.0")
s=s.replace("dict(start=15.3,end=20", "dict(start=14.78,end=20")
s=s.replace("line('가장 좋습니다',1070,133,at=.30", "line('가장 좋습니다',1070,133,at=.30")
s=s.replace("        lt=t-s['start'];out=0", """        lt=t-s['start'];out=0
        group=Image.new('RGBA',(WIDTH,HEIGHT))""")
s=s.replace("            else:canvas.alpha_composite(layer)","            else:group.alpha_composite(layer)")
s=s.replace("                canvas.alpha_composite(layer,(0,top))","                group.alpha_composite(layer,(0,top))")
needle='    # Oversized text remains'
i=s.index(needle)
s=s[:i]+'''        # A fast arrival, two linked reframings, then a directional handoff.
        span=s['end']-s['start']
        q=min(1,lt/span)
        enter=ease(lt/.24)
        if index==4 and lt>3.5:
            factor=1.0;shift=0
        else:
            # Every ~0.9s the group changes framing; no multi-second idle block.
            a=ease((lt-.65)/.75)
            b=ease((lt-1.65)/.55)
            c=ease((lt-2.45)/.65)
            factor=.92+.055*a-.035*b+.06*c
            shift=14*a-20*b+6*c
        factor*=.84+.16*enter
        direction=1 if index%2==0 else -1
        slide=direction*185*(1-enter)
        leave=0 if index==len(SCENES)-1 else smooth((lt-(span-.24))/.24)
        slide-=direction*1040*leave
        crop=group.crop(REGION)
        crop=crop.resize((round(crop.width*factor),round(crop.height*factor)),Image.Resampling.BICUBIC)
        canvas.alpha_composite(crop,(round(540-crop.width/2+slide),round(915-crop.height/2+shift)))
''' + s[i:]
p.write_text(s,encoding='utf-8')
