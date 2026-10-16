"""Decode the delivered MP4, validate stream metadata and save decoded samples."""
from pathlib import Path
import subprocess, re, json
import imageio_ffmpeg
from PIL import Image

ROOT=Path(__file__).resolve().parent
VIDEO=ROOT/'lotte_himart_seongseo_grand_open_20s.mp4'
FF=imageio_ffmpeg.get_ffmpeg_exe()
p=subprocess.run([FF,'-hide_banner','-i',str(VIDEO),'-map','0:v:0','-f','null','-','-progress','pipe:1','-nostats'],capture_output=True,text=True)
assert p.returncode==0,p.stderr
counts=re.findall(r'^frame=(\d+)',p.stdout,re.M)
assert counts and int(counts[-1])==600,counts
assert '1080x1920' in p.stderr and '30 fps' in p.stderr
assert 'Video: h264' in p.stderr and 'yuv420p' in p.stderr
assert 'Audio:' not in p.stderr
assert 'Duration: 00:00:20.00' in p.stderr
times=[2.25,4.8,7.9,10.9,14,19.96]
sheet=Image.new('RGB',(1080,1280))
for i,t in enumerate(times):
    dest=ROOT/'previews'/f'encoded_{i+1}.png'
    q=subprocess.run([FF,'-y','-v','error','-ss',str(t),'-i',str(VIDEO),'-frames:v','1',str(dest)],capture_output=True)
    assert q.returncode==0 and dest.exists(),q.stderr
    im=Image.open(dest); assert im.size==(1080,1920)
    sheet.paste(im.resize((360,640)),((i%3)*360,(i//3)*640))
sheet.save(ROOT/'previews/encoded_contact_sheet.jpg',quality=95)
report={'file':VIDEO.name,'duration_seconds':20,'width':1080,'height':1920,'fps':30,'decoded_frames':600,
        'codec':'H.264','pixel_format':'yuv420p','audio_streams':0,'full_decode':'passed','size_bytes':VIDEO.stat().st_size}
(ROOT/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
