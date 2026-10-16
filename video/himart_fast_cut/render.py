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
FONT='C:/Windows/Fonts/Cafe24Dangdanghae-v2.0.ttf'
REGION=(40,670,1040,1160)
# Art direction: strong hierarchy, short masked entrances, no ghost outlines.
FONT_WEIGHT=850
TRACKING=-0.055
# Frequent short phrase cuts: 23 compositions across 20 seconds.
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
    tracking=c['size']*TRACKING
    width=round(sum(f.getlength(ch)+tracking for ch in c['text'])-tracking)+50
    m=Image.new('L',(width,c['size']*2));d=ImageDraw.Draw(m);x=24
    for ch in c['text']:
        d.text((x,0),ch,font=f,fill=255);x+=f.getlength(ch)+tracking
    box=m.getbbox();m=m.crop((0,max(0,box[1]-18),width,box[3]+18))
    im=Image.new('RGBA',m.size,(*c.get('color',(255,255,255)),0));im.putalpha(m)
    return im
TILES={id(c):tile(c) for s in SCENES for c in s['layers']}
def frame(t):
    im=BG.copy().convert('RGBA')
    canvas=Image.new('RGBA',(WIDTH,HEIGHT))
    for index,s in enumerate(SCENES):
        if not s['start']<=t<s['end']:continue
        lt=t-s['start'];out=0
        for c in s['layers']:
            age=lt-c['at']
            if age<0 or lt>=c.get('until',100):continue
            dur=c.get('dur',.4);p=ease(age/dur)
            source=TILES[id(c)].copy()
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
            scale=1+(c.get('scale',1)-1)*(1-p)
            source=source.resize((max(1,round(source.width*scale)),max(1,round(source.height*scale))),Image.Resampling.BICUBIC)
            blur=c.get('blur',0)*(1-p)
            if blur>.12:source=source.filter(ImageFilter.GaussianBlur(blur))
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
                canvas.alpha_composite(layer,(0,top))
            else:canvas.alpha_composite(layer)

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
         '-an','-c:v','libx264','-preset','medium','-crf','14','-pix_fmt','yuv420p','-frames:v','600','-movflags','+faststart',str(OUTPUT)]
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
