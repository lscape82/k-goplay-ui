from pathlib import Path
p=Path(__file__).with_name('render.py');s=p.read_text(encoding='utf-8')
s=s.replace('[[185,116,35],[255,246,197],[255,229,151],[203,146,56],[241,190,92],[255,237,177],[170,106,32]]','[[233,193,109],[255,247,203],[255,232,164],[228,185,100],[245,206,128],[255,240,186],[225,181,94]]')
a=s.index('        shadow=Image.new');b=s.index('    else:',a);s=s[:a]+s[b:]
a=s.index('            scale=1+');b=s.index('            alpha=',a);s=s[:a]+s[b:]
a=s.index('        # A fast arrival');b=s.index('    # Oversized text',a)
s=s[:a]+'''        # Native-size glyphs: integer translation only, no scale resampling.
        span=s['end']-s['start']
        direction=1 if index%2==0 else -1
        enter=ease(lt/.18)
        leave=0 if index==len(SCENES)-1 else smooth((lt-(span-.22))/.22)
        slide=round(direction*(60*(1-enter)-1040*leave))
        crop=group.crop(REGION)
        canvas.alpha_composite(crop,(REGION[0]+slide,REGION[1]))
'''+s[b:]
s=s.replace("'-crf','14'","'-crf','12'")
p.write_text(s,encoding='utf-8')
