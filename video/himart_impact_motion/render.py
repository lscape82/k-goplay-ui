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
def ease(t): return 1-(1-max(0,min(1,t)))**3
def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)

(ROOT/'assets').mkdir(exist_ok=True)
bgpath=ROOT/'assets/background.png'
if not bgpath.exists(): shutil.copy2('C:/Users/lscap/Desktop/하이마트_첫화면_중앙문구없음_1080x1920.png',bgpath)
BG=Image.open(bgpath).convert('RGB')
assert BG.size==(WIDTH,HEIGHT)
def tile(c):
    f=ImageFont.truetype(FONT,c['size']);f.set_variation_by_axes([c.get('weight',FONT_WEIGHT)])
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
        lt=t-s['start'];out=0 if index==4 else smooth((t-(s['end']-.12))/.12)
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
    for i,t in enumerate([2.6,5.6,8.6,13.2,18.5,19.96]):
        im=frame(t);im.save(dest/f'scene_{i+1}_{t:.2f}s.png')
        sheet.paste(im.resize((360,640),Image.Resampling.LANCZOS),((i%3)*360,(i//3)*640))
    sheet.save(dest/'contact_sheet.jpg',quality=95)
    motion=Image.new('RGB',(1080,700))
    for i,t in enumerate([.1,.56,1.02,1.65,3.4,3.6,6.6,6.9,10.2,11.5,14.7,16.3]):
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
