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
SCENES=[
 dict(start=0,end=4,layers=[
  dict(text='입주',x=233,y=824,size=113,at=.10,scale=2.3,dur=.58,settle=-30),
  dict(text='·',x=387,y=824,size=70,at=.36,settle=-30),
  dict(text='혼수',x=540,y=824,size=113,at=.32,scale=1.8,dur=.58,settle=-30),
  dict(text='·',x=693,y=824,size=70,at=.58,settle=-30),
  dict(text='이사',x=847,y=824,size=113,at=.54,scale=1.8,dur=.58,settle=-30),
  dict(text='준비 중이시라면',x=540,y=989,size=71,at=1.15,dur=.8,wipe=True,dy=22,white=True),
 ]),
 dict(start=4,end=8,layers=[
  dict(text='올해 마지막',x=540,y=756,size=63,at=.10,dur=.6,dy=28,white=True),
  *[dict(text=c,x=240+i*200,y=952,size=156,at=.48+i*.19,dur=.55,scale=1.55,dx=55,blur=3) for i,c in enumerate('특별행사')],
 ]),
 dict(start=8,end=12,layers=[
  dict(text='삼성  엘지',x=540,y=801,size=70,at=.10,dur=.5,scale=1.9,settle=-67,white=True),
  dict(text='인기 가전',x=540,y=900,size=119,at=.7,dur=.72,wipe=True,dy=28),
  dict(text='총 집합',x=540,y=1057,size=126,at=1.3,dur=.6,scale=1.2,dy=40),
 ]),
 dict(start=12,end=16,layers=[
  dict(text='가격만큼은',x=540,y=750,size=61,at=.1,dur=.5,dy=26,white=True),
  dict(text='기대하셔도',x=540,y=903,size=125,at=.55,dur=.62,scale=1.7,blur=2),
  dict(text='좋습니다',x=540,y=1060,size=132,at=1.0,dur=.62,wipe=True,dy=20),
 ]),
 dict(start=16,end=20,layers=[
  dict(text='가전 구입혜택은',x=540,y=750,size=61,at=.05,dur=.55,wipe=True,white=True),
  dict(text='오픈 행사점이',x=540,y=906,size=108,at=.5,dur=.65,dy=40,wipe=True),
  dict(text='가장 좋습니다',x=540,y=1064,size=119,at=1.05,dur=.65,scale=1.35,blur=2),
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
    f=ImageFont.truetype(FONT,c['size']);f.set_variation_by_axes([730 if c.get('white') else 880])
    b=f.getbbox(c['text']);w=b[2]-b[0];h=b[3]-b[1]
    m=Image.new('L',(w+40,h+40));ImageDraw.Draw(m).text((20-b[0],20-b[1]),c['text'],font=f,fill=255)
    if c.get('white'): rgb=np.full((m.height,m.width,3),[255,249,235],np.uint8)
    else:
        y=np.linspace(0,1,m.height)
        colors=np.array([[255,241,187],[254,230,164],[229,187,103],[255,235,175]])
        strip=np.stack([np.interp(y,[0,.4,.7,1],colors[:,i]) for i in range(3)],axis=1)
        rgb=np.broadcast_to(strip[:,None,:],(m.height,m.width,3)).astype(np.uint8).copy()
    im=Image.fromarray(rgb).convert('RGBA');im.putalpha(m)
    sh=Image.new('RGBA',im.size,(45,0,0,0));sh.putalpha(m.filter(ImageFilter.GaussianBlur(3)).point(lambda a:round(a*.65)))
    sh.alpha_composite(im,(0,-3));return sh
TILES={id(c):tile(c) for s in SCENES for c in s['layers']}
def frame(t):
    im=BG.copy().convert('RGBA')
    canvas=Image.new('RGBA',(WIDTH,HEIGHT))
    for index,s in enumerate(SCENES):
        if not s['start']<=t<s['end']:continue
        lt=t-s['start'];out=0 if index==4 else smooth((t-(s['end']-.32))/.32)
        for c in s['layers']:
            age=lt-c['at']
            if age<0:continue
            dur=c.get('dur',.4);p=ease(age/dur)
            source=TILES[id(c)].copy()
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
            alpha=smooth(age/.18)*(1-out)
            source.putalpha(source.getchannel('A').point(lambda a:round(a*alpha)))
            x=c['x']+c.get('dx',0)*(1-p)
            y=c['y']+c.get('dy',0)*(1-p)+c.get('settle',0)*ease((lt-1.0)/.5)-26*out
            canvas.alpha_composite(source,(round(x-source.width/2),round(y-source.height/2)))
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
