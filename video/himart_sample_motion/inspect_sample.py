from pathlib import Path
import subprocess
from PIL import Image,ImageDraw
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parent
source=Path('E:/★★진행중/에디티지_페이퍼팔_대학생타깃_이기윤_cactusglobal.com/에디티지_1차_대학교카페/에디티지_1차_학교 영상 소재/에디티지_영상_수정본_251127.mp4')
out=ROOT/'sample'; out.mkdir(exist_ok=True)
ff=imageio_ffmpeg.get_ffmpeg_exe()
p=subprocess.run([ff,'-y','-i',str(source),'-vf','fps=2,scale=216:-1','-an',str(out/'%03d.png')],capture_output=True,text=True,encoding='utf-8',errors='replace')
print(p.stderr[-3500:])
files=sorted(out.glob('*.png'))
for offset in range(0,len(files),20):
    subset=files[offset:offset+20]; h=Image.open(subset[0]).height
    sheet=Image.new('RGB',(216*5,(h+26)*4),(40,40,40));d=ImageDraw.Draw(sheet)
    for i,f in enumerate(subset):
        x=i%5*216;y=i//5*(h+26);sheet.paste(Image.open(f),(x,y));d.text((x+5,y+h+5),f'{(offset+i)*.5:.1f}s',fill='white')
    sheet.save(out/f'contact_{offset//20}.jpg')
