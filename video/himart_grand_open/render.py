"""Editable, independent text-layer motion graphics. Run --preview, then --render.
Requires Pillow, numpy, imageio-ffmpeg. Output: silent 1080x1920 H.264, 600 frames.
All positions are center coordinates, in output pixels. Times are seconds.
"""
from pathlib import Path
import argparse, json, math, subprocess, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
WIDTH, HEIGHT, FPS, DURATION = 1080, 1920, 30, 20
OUTPUT = ROOT / 'lotte_himart_seongseo_grand_open_20s.mp4'
FONTS = {'serif': 'C:/Windows/Fonts/KoPubBatangBold.ttf',
         'sans': 'C:/Windows/Fonts/malgunbd.ttf',
         'latin': 'C:/Windows/Fonts/timesbd.ttf'}

# EDIT HERE: scene boundaries and each layer's text, center position, size,
# entrance time/duration, scale, slide, blur and gold-sweep time.
SCENES = [
 {'start': 0, 'end': 3.0, 'out': 2.6, 'exit': 'up', 'layers': [
  dict(text='롯데하이마트 성서점', x=540,y=414,size=48,font='sans',color='ivory',at=.3,dur=.5),
  dict(text='2026년 마지막',x=540,y=496,size=63,at=.5,dur=.7,slide=-16),
  dict(text='GRAND',x=540,y=650,size=208,font='latin',at=.7,dur=.8,scale=1.15,sweep=1.5),
  dict(text='OPEN',x=540,y=834,size=208,font='latin',at=.7,dur=.8,scale=1.15,sweep=1.5),
  dict(text='Pre Open',x=540,y=976,size=53,font='latin',at=1.4,dur=.4),
  dict(text='9월 21일(월) ~ 10월 8일(목)',x=540,y=1036,size=38,font='sans',color='ivory',at=1.5,dur=.4),
  dict(text='행사 일정',x=540,y=1120,size=49,at=1.6,dur=.4),
  dict(text='10월 9일(금) ~ 10월 11일(일)',x=540,y=1194,size=49,font='sans',color='ivory',at=1.6,dur=.4),
 ]},
 {'start':3,'end':6.35,'out':6,'exit':'spread','layers':[
  dict(text='입주',x=239,y=742,size=114,at=3.2,dur=.5,scale=1.08,blur=2.5),
  dict(text='·',x=390,y=742,size=68,at=3.35,dur=.3),
  dict(text='혼수',x=540,y=742,size=114,at=3.38,dur=.5,scale=1.08,blur=2.5),
  dict(text='·',x=690,y=742,size=68,at=3.53,dur=.3),
  dict(text='이사',x=841,y=742,size=114,at=3.56,dur=.5,scale=1.08,blur=2.5),
  dict(text='준비 중이시라면',x=540,y=914,size=66,font='sans',color='ivory',at=4.1,dur=.5,slide=26),
 ]},
 {'start':6,'end':9.3,'out':9,'exit':'shrink','layers':[
  dict(text='올해 마지막',x=540,y=637,size=64,font='sans',color='ivory',at=6.2,dur=.5,slide=-25),
  *[dict(text=c,x=240+200*i,y=846,size=166,at=6.5+i*.17,dur=.3,scale=1.25,sweep=7.32) for i,c in enumerate('특별행사')],
 ]},
 {'start':9,'end':12,'out':11.6,'exit':'up','layers':[
  dict(text='삼성   LG',x=540,y=610,size=67,font='sans',color='ivory',at=9.2,dur=.4),
  dict(text='인기 가전',x=540,y=786,size=136,at=9.5,dur=.5,scale=.93),
  dict(text='총 집합',x=540,y=983,size=150,at=10,dur=.5,slide=34),
 ]},
 {'start':12,'end':15.85,'out':15.5,'exit':'up','layers':[
  dict(text='가격만큼은',x=540,y=605,size=58,font='sans',color='ivory',at=12,dur=.5),
  dict(text='기대하셔도',x=540,y=797,size=139,at=12.5,dur=.55,scale=1.12,sweep=13.1),
  dict(text='좋습니다',x=540,y=996,size=150,at=12.5,dur=.55,scale=1.12,sweep=13.1),
 ]},
 {'start':15.5,'end':20,'out':21,'exit':'none','layers':[
  dict(text='가전 구입혜택은',x=540,y=561,size=58,font='sans',color='ivory',at=15.7,dur=.4),
  dict(text='오픈 행사점이',x=540,y=733,size=109,at=16.1,dur=.4,slide=22),
  dict(text='가장 좋습니다',x=540,y=904,size=128,at=16.4,dur=.4,scale=1.06),
  dict(text='롯데하이마트 성서점',x=540,y=1106,size=50,font='sans',color='ivory',at=17.2,dur=.3),
  dict(text='10월 9일(금) ~ 10월 11일(일)',x=540,y=1192,size=49,font='sans',color='ivory',at=17.2,dur=.3),
 ]},
]

def ease(v):
    v = max(0., min(1., v))
    return 1-(1-v)**3

def smooth(v):
    v = max(0., min(1., v))
    return v*v*(3-2*v)

def setup():
    (ROOT/'assets').mkdir(exist_ok=True)
    for src,name in [('C:/Users/lscap/Desktop/디포.png','background.png'),
                     ('C:/Users/lscap/Desktop/20260917_141421.png','reference.png')]:
        dest=ROOT/'assets'/name
        if not dest.exists(): shutil.copy2(src,dest)

def text_layer(cfg):
    size=cfg['size']
    font=ImageFont.truetype(FONTS[cfg.get('font','serif')],size)
    box=font.getbbox(cfg['text']); w=box[2]-box[0]; h=box[3]-box[1]
    # Fit unusually long replacements automatically inside 920px safe width.
    if w>920:
        size=int(size*920/w); font=ImageFont.truetype(FONTS[cfg.get('font','serif')],size)
        box=font.getbbox(cfg['text']); w=box[2]-box[0]; h=box[3]-box[1]
    pad=24
    mask=Image.new('L',(w+pad*2,h+pad*2))
    ImageDraw.Draw(mask).text((pad-box[0],pad-box[1]),cfg['text'],font=font,fill=255)
    yy=np.arange(mask.height,dtype=np.float32)[:,None]/mask.height
    if cfg.get('color')=='ivory':
        rgb=np.full((mask.height,mask.width,3),[255,249,227],dtype=np.uint8)
    else:
        stops=[0,.22,.46,.62,.80,1]
        colors=np.array([[186,117,39],[255,239,171],[247,214,132],[192,133,53],[249,215,133],[255,243,192]])
        strip=np.stack([np.interp(yy[:,0],stops,colors[:,i]) for i in range(3)],axis=1)
        rgb=np.broadcast_to(strip[:,None,:],(mask.height,mask.width,3)).astype(np.uint8).copy()
    return mask,rgb

setup()
BG=Image.open(ROOT/'assets/background.png').convert('RGB')
assert BG.size==(WIDTH,HEIGHT), BG.size
LAYERS={id(c):text_layer(c) for s in SCENES for c in s['layers']}
gy,gx=np.mgrid[0:480,0:270].astype(np.float32); gx*=4; gy*=4

def frame(t):
    z=1+.04*t/(DURATION-1/FPS)
    # Constant aspect, bottom anchored: building remains on screen without deformation.
    cw,ch=WIDTH/z,HEIGHT/z
    bg=BG.transform((WIDTH,HEIGHT),Image.Transform.EXTENT,((WIDTH-cw)/2,HEIGHT-ch,(WIDTH+cw)/2,HEIGHT),Image.Resampling.BICUBIC)
    # Very gentle moving light only over the sky, with a smooth fade before the building.
    sky=np.clip((1390-gy)/240,0,1)
    glow=np.zeros(gx.shape,np.float32)
    for side,phase in [(-40,0),(1120,1.7)]:
        center=side+(gy-300)*(.38 if side<0 else -.38)+22*math.sin(t*.22+phase)
        beam=np.exp(-((gx-center)/145)**2-((gy-410)/660)**2)
        glow+=beam*(6+3*math.sin(t*.38+phase))
    glow+=2.6*(1+math.sin(t*.3))*np.exp(-((gx-540)/480)**2-((gy-950)/430)**2)
    if 9.4<t<11.6:
        glow+=8*math.sin(math.pi*(t-9.4)/2.2)**2*np.exp(-((gx-540)/400)**2-((gy-820)/310)**2)
    a=Image.fromarray(np.uint8(np.clip(glow*sky,0,30))).resize((WIDTH,HEIGHT),Image.Resampling.BILINEAR)
    light=Image.new('RGB',bg.size,(255,178,107)); bg=Image.composite(light,bg,a).convert('RGBA')
    for s in SCENES:
        if not s['start']<=t<s['end']: continue
        out=smooth((t-s['out'])/max(.01,s['end']-s['out'])) if t>s['out'] else 0
        # Restrained framing, separate from the text animation.
        deco_alpha=0
        if s is SCENES[0]: deco_alpha=ease((t-1.6)/.4)*(1-out)
        elif s is SCENES[-1]: deco_alpha=ease((t-17.2)/.3)
        if deco_alpha:
            deco=Image.new('RGBA',bg.size); d=ImageDraw.Draw(deco)
            if s is SCENES[0]:
                d.rounded_rectangle((85,1074,995,1251),radius=19,fill=(59,0,0,int(83*deco_alpha)),outline=(248,211,126,int(240*deco_alpha)),width=2)
            else:
                d.line((170,1038,910,1038),fill=(246,211,144,int(190*deco_alpha)),width=2)
            bg=Image.alpha_composite(bg,deco)
        for c in s['layers']:
            if t<c['at']: continue
            p=ease((t-c['at'])/c.get('dur',.4)); alpha=p*(1-out)
            if alpha<=0: continue
            mask,rgb=LAYERS[id(c)]
            arr=rgb
            sw=c.get('sweep',-100)
            if sw<=t<=sw+.7:
                # A single moving highlight clipped to the actual glyphs.
                xx=np.arange(mask.width)[None,:]; yy=np.arange(mask.height)[:,None]
                # Global x aligns the highlight across independently revealed letters.
                global_x=xx+c['x']-mask.width/2
                center=-160+(t-sw)/.7*1450
                shine=np.exp(-((global_x+yy*.18-center)/75)**2)*.67
                arr=np.uint8(rgb+(255-rgb)*shine[:,:,None])
            tile=Image.fromarray(arr).convert('RGBA'); tile.putalpha(mask)
            sh=Image.new('RGBA',tile.size,(24,0,0,0)); sh.putalpha(mask.filter(ImageFilter.GaussianBlur(5)).point(lambda a:int(a*.65)))
            combined=Image.new('RGBA',tile.size); combined.alpha_composite(sh,(0,5)); combined.alpha_composite(tile)
            scale=1+(c.get('scale',1)-1)*(1-p)
            if s['exit']=='shrink': scale*=1-.12*out
            if abs(scale-1)>.0001: combined=combined.resize((round(combined.width*scale),round(combined.height*scale)),Image.Resampling.BICUBIC)
            if c.get('blur',0)*(1-p)>.1: combined=combined.filter(ImageFilter.GaussianBlur(c['blur']*(1-p)))
            combined.putalpha(combined.getchannel('A').point(lambda a:round(a*alpha)))
            x=c['x']; y=c['y']+c.get('slide',0)*(1-p)
            if s['exit']=='up': y-=22*out
            if s['exit']=='spread': x+=(x-540)*.065*out
            bg.alpha_composite(combined,(round(x-combined.width/2),round(y-combined.height/2)))
    bg=bg.convert('RGB')
    if t<.4: bg=Image.blend(Image.new('RGB',bg.size),bg,smooth(t/.4))
    return bg

def preview():
    dest=ROOT/'previews'; dest.mkdir(exist_ok=True)
    times=[2.25,4.8,7.9,10.9,14,18.5]
    sheet=Image.new('RGB',(1080,1280),(25,25,25))
    d=ImageDraw.Draw(sheet)
    for i,t in enumerate(times):
        im=frame(t); im.save(dest/f'scene_{i+1}_{t:.2f}s.png')
        thumb=im.resize((360,640),Image.Resampling.LANCZOS)
        sheet.paste(thumb,((i%3)*360,(i//3)*640))
    sheet.save(dest/'contact_sheet.jpg',quality=95)
    # Inspect transition endpoints too, without contaminating the final footage.
    for t in [.9,3.4,6.8,9.7,12.8,16.6,19.9666667]:
        frame(t).save(dest/f'check_{t:.2f}s.png')
    print('Previews written:',dest,flush=True)

def render():
    ff=imageio_ffmpeg.get_ffmpeg_exe()
    cmd=[ff,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{WIDTH}x{HEIGHT}','-r',str(FPS),'-i','-',
         '-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r',str(FPS),'-frames:v',str(FPS*DURATION),
         '-movflags','+faststart','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',str(OUTPUT)]
    with open(ROOT/'render.log','w') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for n in range(FPS*DURATION):
            proc.stdin.write(frame(n/FPS).tobytes())
            if n%60==0: print(f'Rendered {n}/{FPS*DURATION} frames',flush=True)
        proc.stdin.close()
        if proc.wait()!=0: raise RuntimeError('FFmpeg failed; see render.log')
    print('Complete:',OUTPUT,flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--preview',action='store_true'); parser.add_argument('--render',action='store_true')
    args=parser.parse_args()
    if args.preview: preview()
    if args.render: render()
