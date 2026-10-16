from pathlib import Path
p=Path(__file__).with_name('render.py');s=p.read_text(encoding='utf-8')
needle="    im=Image.new('RGBA',m.size,(*c.get('color',(255,255,255)),0));im.putalpha(m)"
replacement='''    if c['size']>=80:
        yy=np.linspace(0,1,m.height)
        stops=[0,.18,.40,.54,.67,.84,1]
        colors=np.array([[185,116,35],[255,246,197],[255,229,151],[203,146,56],[241,190,92],[255,237,177],[170,106,32]])
        strip=np.stack([np.interp(yy,stops,colors[:,i]) for i in range(3)],axis=1)
        rgb=np.broadcast_to(strip[:,None,:],(m.height,m.width,3)).astype(np.uint8).copy()
        im=Image.fromarray(rgb).convert('RGBA');im.putalpha(m)
        shadow=Image.new('RGBA',im.size,(46,7,0,0))
        shadow.putalpha(m.filter(ImageFilter.GaussianBlur(3)).point(lambda a:round(a*.65)))
        shadow.alpha_composite(im,(0,-2));im=shadow
    else:
        im=Image.new('RGBA',m.size,(255,248,227,0));im.putalpha(m)'''
assert needle in s;s=s.replace(needle,replacement)
needle="            source=TILES[id(c)].copy()"
s=s.replace(needle,needle+'''
            # Brief light pass confined to the gold glyphs.
            if c['size']>=80:
                sweep_age=age-.45
                if 0<=sweep_age<.6:
                    arr=np.asarray(source).copy();xx=np.arange(source.width)[None,:];yy=np.arange(source.height)[:,None]
                    center=-100+sweep_age/.6*(source.width+200)
                    shine=np.exp(-((xx+.24*yy-center)/42)**2)*.6
                    arr[:,:,:3]=np.uint8(arr[:,:,:3]+(255-arr[:,:,:3])*shine[:,:,None])
                    source=Image.fromarray(arr)
''')
s=s.replace("factor=.92+.055*a-.035*b+.06*c","factor=.87+.105*a-.075*b+.105*c")
s=s.replace("shift=14*a-20*b+6*c","shift=24*a-48*b+24*c")
s=s.replace("factor*=.84+.16*enter","factor*=1.24-.24*enter")
s=s.replace("slide=direction*185*(1-enter)","slide=direction*430*(1-enter)+direction*(32*a-64*b+32*c) if not(index==4 and lt>3.5) else 0")
s=s.replace("span-.24))/.24)","span-.32))/.32)")
# Larger group motion stays within the reserved center region.
p.write_text(s,encoding='utf-8')
