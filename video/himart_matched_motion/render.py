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
# Font contour comparison with sample: weight 650, tracking -0.075em.
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
def ease(t): return 1-(1-max(0,min(1,t)))**3
def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)

(ROOT/'assets').mkdir(exist_ok=True)
bgpath=ROOT/'assets/background.png'
if not bgpath.exists(): shutil.copy2('C:/Users/lscap/Desktop/하이마트_첫화면_중앙문구없음_1080x1920.png',bgpath)
BG=Image.open(bgpath).convert('RGB')
assert BG.size==(WIDTH,HEIGHT)
def tile(c):
    f=ImageFont.truetype(FONT,c['size']);f.set_variation_by_axes([FONT_WEIGHT])
    tracking=c['size']*TRACKING
    width=round(sum(f.getlength(ch)+tracking for ch in c['text'])-tracking)+50
    m=Image.new('L',(width,c['size']*2));d=ImageDraw.Draw(m);x=24
    for ch in c['text']:
        d.text((x,0),ch,font=f,fill=255);x+=f.getlength(ch)+tracking
    box=m.getbbox();m=m.crop((0,max(0,box[1]-18),width,box[3]+18))
    im=Image.new('RGBA',m.size,(255,255,255,0));im.putalpha(m)
    return im
TILES={id(c):tile(c) for s in SCENES for c in s['layers']}
def frame(t):
    im=BG.copy().convert('RGBA')
    canvas=Image.new('RGBA',(WIDTH,HEIGHT))
    for index,s in enumerate(SCENES):
        if not s['start']<=t<s['end']:continue
        lt=t-s['start'];out=0 if index==4 else smooth((t-(s['end']-.22))/.22)
        for c in s['layers']:
            age=lt-c['at']
            if age<0:continue
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
            alpha=smooth(age/.07)*(1-out)
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
    for i,t in enumerate([2.8,6.8,10.8,14.8,18.8,19.96]):
        im=frame(t);im.save(dest/f'scene_{i+1}_{t:.2f}s.png')
        sheet.paste(im.resize((360,640),Image.Resampling.LANCZOS),((i%3)*360,(i//3)*640))
    sheet.save(dest/'contact_sheet.jpg',quality=95)
    motion=Image.new('RGB',(1080,700))
    for i,t in enumerate([.16,.32,.55,.8,1.15,1.5,4.65,4.95,5.25,8.35,8.9,9.5]):
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
