"""Three RGB/structure samples of the Android-compatible video copy."""
import hashlib,json,pathlib,subprocess
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2];WORK=ROOT/'_rea_temp/release-android'
FF=ROOT/'apps/studio/node_modules/ffmpeg-static/ffmpeg.exe'
SOURCE=ROOT/'_rea_temp/reader/content/videos/c56efe60e8e15525e533e434f760a05e4df0b68da2a1e2dbc452aa0a0e6ccc76.avi'
TARGET=WORK/'7-1-android.mp4'
FOLDER=WORK/'video-samples';FOLDER.mkdir(exist_ok=True)
records=[]
for prefix,path in [('source',SOURCE),('android',TARGET)]:
    subprocess.run([str(FF),'-hide_banner','-loglevel','error','-i',str(path),'-vf',r'select=eq(n\,0)+eq(n\,2369)+eq(n\,4737)','-fps_mode','passthrough','-frames:v','3','-y',str(FOLDER/(prefix+'-%02d.png'))],check=True,capture_output=True)
for index in range(1,4):
    a,b=[np.asarray(Image.open(FOLDER/f'{prefix}-{index:02d}.png').convert('RGB')).astype(float) for prefix in ['source','android']]
    assert a.shape==b.shape
    mse=float(np.square(a-b).mean())
    records.append({'frameIndex':[0,2369,4737][index-1],'size':[a.shape[1],a.shape[0]],'meanAbsoluteRgbError':float(np.abs(a-b).mean()),'psnr':float(10*np.log10(255**2/max(mse,1e-12)))})
report={'passed':all(x['meanAbsoluteRgbError']<3 for x in records),'codec':'H.264 yuv420p CRF10 BT.709, AAC; RGB555 expanded via RGB24; VFR timestamps retained','samples':records,'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'androidSha256':hashlib.sha256(TARGET.read_bytes()).hexdigest(),'pixelIdentical':False,'scope':'Three samples only. RGB differences from 4:2:0 chroma subsampling and video encoding; images also visually inspected. Original AVI retained. This is not full-video equality.'}
(WORK/'android-video-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
assert report['passed']
