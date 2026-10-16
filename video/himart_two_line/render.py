"""Sample-inspired kinetic typography on the user's exact fixed background.
Edit SCENES below: times in seconds, positions in 1080x1920 pixels.
"""
from pathlib import Path
import subprocess, shutil, argparse
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parent
WIDTH,HEIGHT,FPS,DURATION=1080,1920,30,20
OUTPUT=ROOT/'lotte_himart_seongseo_grand_open_20s.mp4'
FONT='C:/Windows/Fonts/NotoSansKR-VF.ttf'
REGION=(40,670,1040,1160)
# Art direction: strong hierarchy, short masked entrances, no ghost outlines.
FONT_WEIGHT=850
TRACKING=-0.055
# Frequent short phrase cuts: 23 compositions across 20 seconds.
TRACKING=-0.025
def line(text,y=910,size=170,at=0,**kw):
    return dict(text=text,x=540,y=y,size=size,at=at,dur=.13,dy=35,roll=True,**kw)
# Keep complete sentences visible; animate lines with short staggered entrances.
SCENES=[
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
def ease(t): return 1-(1-max(0,min(1,t)))**3
def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)

(ROOT/'assets').mkdir(exist_ok=True)
bgpath=ROOT/'assets/background.png'
if not bgpath.exists(): shutil.copy2('C:/Users/lscap/Desktop/하이마트_첫화면_중앙문구없음_1080x1920.png',bgpath)
BG=Image.open(bgpath).convert('RGB')
assert BG.size==(WIDTH,HEIGHT)
def tile(c):
    f=ImageFont.truetype(FONT,c['size'])
    f.set_variation_by_axes([850 if c['size']>=80 else 650])
    tracking=c['size']*TRACKING
    width=round(sum(f.getlength(ch)+tracking for ch in c['text'])-tracking)+50
    m=Image.new('L',(width,c['size']*2));d=ImageDraw.Draw(m);x=24
    for ch in c['text']:
        d.text((x,0),ch,font=f,fill=255);x+=f.getlength(ch)+tracking
    box=m.getbbox();m=m.crop((0,max(0,box[1]-18),width,box[3]+18))
    if c['size']>=80:
        yy=np.linspace(0,1,m.height)
        stops=[0,.18,.40,.54,.67,.84,1]
        colors=np.array([[233,193,109],[255,247,203],[255,232,164],[228,185,100],[245,206,128],[255,240,186],[225,181,94]])
        strip=np.stack([np.interp(yy,stops,colors[:,i]) for i in range(3)],axis=1)
        rgb=np.broadcast_to(strip[:,None,:],(m.height,m.width,3)).astype(np.uint8).copy()
        im=Image.fromarray(rgb).convert('RGBA');im.putalpha(m)
    else:
        im=Image.new('RGBA',m.size,(255,248,227,0));im.putalpha(m)
    return im
TILES={id(c):tile(c) for s in SCENES for c in s['layers']}
def frame(t):
    im=BG.copy().convert('RGBA')
    canvas=Image.new('RGBA',(WIDTH,HEIGHT))
    for index,s in enumerate(SCENES):
        if not s['start']<=t<s['end']:continue
        lt=t-s['start'];out=0
        group=Image.new('RGBA',(WIDTH,HEIGHT))
        for c in s['layers']:
            age=lt-c['at']
            if age<0 or lt>=c.get('until',100):continue
            dur=c.get('dur',.4);p=ease(age/dur)
            source=TILES[id(c)].copy()
            # Brief light pass confined to the gold glyphs.
            if c['size']>=80:
                sweep_age=age-.45
                if 0<=sweep_age<.6:
                    arr=np.asarray(source).copy();xx=np.arange(source.width)[None,:];yy=np.arange(source.height)[:,None]
                    center=-100+sweep_age/.6*(source.width+200)
                    shine=np.exp(-((xx+.24*yy-center)/42)**2)*.6
                    arr[:,:,:3]=np.uint8(arr[:,:,:3]+(255-arr[:,:,:3])*shine[:,:,None])
                    source=Image.fromarray(arr)

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

            if c.get('wipe'):
                # A moving soft mask reveals type as it arrives, matching sample cadence.
                xx=np.arange(source.width,dtype=float)
                edge=ease(age/dur)*(source.width+35)
                reveal=np.clip((edge-xx)/30,0,1)
                a=np.asarray(source.getchannel('A')).astype(float)*reveal[None,:]
                source.putalpha(Image.fromarray(a.astype(np.uint8)))
            alpha=smooth(age/.035)*(1-out)
            source.putalpha(source.getchannel('A').point(lambda a:round(a*alpha)))
            x=c['x']+c.get('dx',0)*(1-p)
            y=c['y']+c.get('dy',0)*(1-p)+c.get('settle',0)*ease((lt-.35)/.25)-55*out
            layer=Image.new('RGBA',(WIDTH,HEIGHT))
            layer.alpha_composite(source,(round(x-source.width/2),round(y-source.height/2)))
            if c.get('roll'):
                top=round(c['y']-TILES[id(c)].height/2-2)
                bottom=round(c['y']+TILES[id(c)].height/2+2)
                layer=layer.crop((0,top,WIDTH,bottom))
                group.alpha_composite(layer,(0,top))
            else:group.alpha_composite(layer)

        # Native-size glyphs: integer translation only, no scale resampling.
        span=s['end']-s['start']
        direction=1 if index%2==0 else -1
        enter=ease(lt/.18)
        leave=0 if index==len(SCENES)-1 else smooth((lt-(span-.22))/.22)
        slide=round(direction*(60*(1-enter)-1040*leave))
        crop=group.crop(REGION)
        canvas.alpha_composite(crop,(REGION[0]+slide,REGION[1]))
    # Oversized text remains inside the central area; the entire supplied artwork is untouched.
    im.alpha_composite(canvas.crop(REGION),(REGION[0],REGION[1]))
    return im.convert('RGB')

def preview():
    dest=ROOT/'previews';dest.mkdir(exist_ok=True)
    sheet=Image.new('RGB',(1080,1280))
    for i,t in enumerate([2.6,6.1,9.9,13.7,18.5,19.96]):
        im=frame(t);im.save(dest/f'scene_{i+1}_{t:.2f}s.png')
        sheet.paste(im.resize((360,640),Image.Resampling.LANCZOS),((i%3)*360,(i//3)*640))
    sheet.save(dest/'contact_sheet.jpg',quality=95)
    motion=Image.new('RGB',(1080,700))
    for i,t in enumerate([.25,.9,1.55,2.3,3.2,3.95,4.7,5.3,6.8,7.5,8.2,9.0]):
        thumb=frame(t).crop((0,670,1080,1160)).resize((270,123))
        x=i%4*270;y=i//4*230;motion.paste(thumb,(x,y));ImageDraw.Draw(motion).text((x+8,y+130),str(t)+'s',fill='white')
    motion.save(dest/'motion_checks.jpg')

def render():
    cmd=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-',
         '-an','-c:v','libx264','-preset','medium','-crf','12','-pix_fmt','yuv420p','-frames:v','600','-movflags','+faststart',str(OUTPUT)]
    with open(ROOT/'render.log','w') as log:
        p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(600):
            p.stdin.write(frame(i/30).tobytes())
            if i%120==0:print(f'{i}/600 frames',flush=True)
        p.stdin.close();assert p.wait()==0
    print(OUTPUT,flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--preview',action='store_true');p.add_argument('--render',action='store_true');a=p.parse_args()
    if a.preview:preview()
    if a.render:render()
