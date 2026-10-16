"""Editable, independent text-layer motion graphics. Run --preview, then --render.
Requires Pillow, numpy, imageio-ffmpeg. Output: silent 1080x1920 H.264, 600 frames.
All positions are center coordinates, in output pixels. Times are seconds.
"""
from pathlib import Path
import argparse, json, math, subprocess, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
WIDTH, HEIGHT, FPS, DURATION = 1080, 1920, 30, 20
OUTPUT = ROOT / 'lotte_himart_seongseo_grand_open_20s.mp4'
FONTS = dict.fromkeys(['serif','sans','latin'], 'C:/Windows/Fonts/NotoSansKR-VF.ttf')
FONTS['display']='C:/Windows/Fonts/timesbd.ttf'
FONTS['classic']='C:/Windows/Fonts/KoPubBatangBold.ttf'
FIXED_TEXT = [
 dict(text='롯데하이마트 성서점',x=571,y=65,size=45,color='ivory'),
 dict(text='2026년 마지막',x=540,y=137,size=56,font='classic'),
 dict(text='GRAND',x=540,y=258,size=238,font='display'),
 dict(text='OPEN',x=540,y=422,size=238,font='display'),
 dict(text='Pre Open',x=540,y=537,size=48,font='display'),
 dict(text='9월 21일(월) ~ 10월 8일(목)',x=540,y=582,size=32,color='ivory'),
]
HEADER = dict(x=0, y=0, width=1080)  # Fixed for the full 20 seconds; original aspect ratio.

# EDIT HERE: scene boundaries and each layer's text, center position, size,
# entrance time/duration, scale, slide, blur and gold-sweep time.
SCENES = [
 {'start': 0, 'end': 3.0, 'out': 2.6, 'exit': 'up', 'layers': [
  dict(text='Pre Open',x=540,y=838,size=65,font='latin',at=.5,dur=.5),
  dict(text='9월 21일(월) ~ 10월 8일(목)',x=540,y=929,size=49,font='sans',color='ivory',at=.8,dur=.5),
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

# V3: user-supplied fixed composition. Only scenes 2-6 animate in the empty middle.
SCENES[0]['layers']=[]
SCENES[5]['layers']=SCENES[5]['layers'][:3]
POSITIONS = [[], [816,816,816,816,816,984], [764,953,953,953,953],
             [727,879,1042], [736,901,1053], [732,892,1050]]
for scene,positions in zip(SCENES,POSITIONS):
    for layer,y in zip(scene['layers'],positions): layer['y']=y
for layer in SCENES[2]['layers'][1:]: layer['size']=150
SCENES[3]['layers'][1]['size']=128
SCENES[3]['layers'][2]['size']=135
SCENES[4]['layers'][1]['size']=128
SCENES[4]['layers'][2]['size']=137
SCENES[5]['layers'][1]['size']=103
SCENES[5]['layers'][2]['size']=113

def load_font(cfg,size):
    font=ImageFont.truetype(FONTS[cfg.get('font','serif')],size)
    if cfg.get('font') not in ('display','classic'):
        font.set_variation_by_axes([700 if cfg.get('color')=='ivory' else 850])
    return font

def ease(v):
    v = max(0., min(1., v))
    return 1-(1-v)**3

def smooth(v):
    v = max(0., min(1., v))
    return v*v*(3-2*v)

def text_layer(cfg):
    size=cfg['size']
    font=load_font(cfg,size)
    box=font.getbbox(cfg['text']); w=box[2]-box[0]; h=box[3]-box[1]
    # Fit unusually long replacements automatically inside 920px safe width.
    if w>920:
        size=int(size*920/w); font=load_font(cfg,size)
        box=font.getbbox(cfg['text']); w=box[2]-box[0]; h=box[3]-box[1]
    pad=24
    mask=Image.new('L',(w+pad*2,h+pad*2))
    ImageDraw.Draw(mask).text((pad-box[0],pad-box[1]),cfg['text'],font=font,fill=255)
    yy=np.arange(mask.height,dtype=np.float32)[:,None]/mask.height
    if cfg.get('color')=='ivory':
        rgb=np.full((mask.height,mask.width,3),[255,249,227],dtype=np.uint8)
    else:
        stops=[0,.22,.46,.62,.80,1]
        colors=np.array([[238,204,137],[255,240,190],[250,224,163],[224,183,111],[249,222,161],[255,241,195]])
        strip=np.stack([np.interp(yy[:,0],stops,colors[:,i]) for i in range(3)],axis=1)
        rgb=np.broadcast_to(strip[:,None,:],(mask.height,mask.width,3)).astype(np.uint8).copy()
    return mask,rgb

BG=Image.open(ROOT/'assets/background.png').convert('RGBA')
# Rebuild the fixed layout with transparent glyphs over ONE uninterrupted source background.
fixed=Image.new('RGBA',BG.size)
d=ImageDraw.Draw(fixed)
# Use supplied event panel unchanged inside its original rounded gold border.
# Discard only the exterior background; retain its actual typography and proportions.
schedule=Image.open(ROOT/'assets/schedule_original.png').convert('RGBA')
panel_mask=Image.new('L',schedule.size,0)
ImageDraw.Draw(panel_mask).rounded_rectangle((3,7,435,107),radius=14,fill=255)
schedule.putalpha(panel_mask)
schedule=schedule.crop((2,6,437,109))
schedule=schedule.resize((914,round(914*schedule.height/schedule.width)),Image.Resampling.LANCZOS)
fixed.alpha_composite(schedule,(83,1184))
d.line((164,137,296,137),fill=(249,219,151,255),width=2)
d.line((784,137,916,137),fill=(249,219,151,255),width=2)
d.line((174,537,402,537),fill=(249,219,151,220),width=2)
d.line((678,537,906,537),fill=(249,219,151,220),width=2)
for c in FIXED_TEXT:
    mask,rgb=text_layer(c)
    tile=Image.fromarray(rgb).convert('RGBA'); tile.putalpha(mask)
    shadow=Image.new('RGBA',tile.size,(40,0,0,0))
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(4)).point(lambda x:round(x*.5)))
    xy=(round(c['x']-tile.width/2),round(c['y']-tile.height/2))
    fixed.alpha_composite(shadow,(xy[0],xy[1]+3)); fixed.alpha_composite(tile,xy)
# Preserve the actual original brand mark, removing its surrounding red background.
logo=Image.open(ROOT/'assets/reference.png').convert('RGB').crop((175,227,217,270))
arr=np.array(logo)
sil=Image.fromarray(np.uint8((arr[:,:,0]>170)&(arr[:,:,1]<95)&(arr[:,:,2]<105))*255)
ImageDraw.floodfill(sil,(0,0),128)
silhouette=np.array(sil)!=128
logo=logo.convert('RGBA'); logo.putalpha(Image.fromarray(np.uint8(silhouette)*255))
logo=logo.resize((66,68),Image.Resampling.LANCZOS)
fixed.alpha_composite(logo,(296,30))
# Header sits 25px below the original position (25px above V6).
HEADER_OFFSET_Y=25
header_group=fixed.crop((0,0,WIDTH,650))
fixed.paste((0,0,0,0),(0,0,WIDTH,650))
fixed.alpha_composite(header_group,(0,HEADER_OFFSET_Y))
BG=Image.alpha_composite(BG,fixed)
LAYERS={id(c):text_layer(c) for s in SCENES for c in s['layers']}
gy,gx=np.mgrid[0:480,0:270].astype(np.float32); gx*=4; gy*=4

def frame(t):
    bg=BG.copy().convert('RGBA')
    for s in SCENES:
        if not s['start']<=t<s['end']: continue
        out=smooth((t-s['out'])/max(.01,s['end']-s['out'])) if t>s['out'] else 0
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
    return bg.convert('RGB')

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
