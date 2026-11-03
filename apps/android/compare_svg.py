"""Independent structural comparison with retained native GDI references."""
import json,pathlib,sys
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2];WORK=ROOT/'_rea_temp/release-android'
records=[]
android='--android' in sys.argv
render_directory=WORK/'android-evidence/android-svg-renders' if android else WORK/'svg-renders'
def dilate(mask):
    horizontal=mask.copy()
    for amount in (1,2):
        horizontal[:,amount:] |= mask[:,:-amount]
        horizontal[:,:-amount] |= mask[:,amount:]
    result=horizontal.copy()
    for amount in (1,2):
        result[amount:,:] |= horizontal[:-amount,:]
        result[:-amount,:] |= horizontal[amount:,:]
    return result
for case in json.loads((WORK/'svg-render-manifest.json').read_text(encoding='utf-8')):
    reference=np.array(Image.open(ROOT/'_rea_temp/reader/content'/case['reference']).convert('RGB'))
    actual=np.array(Image.open(render_directory/case['render']).convert('RGB'))
    assert reference.shape==actual.shape,case['id']
    r=np.max(reference,axis=2)>60;a=np.max(actual,axis=2)>60
    dilated_a=dilate(a)
    dilated_r=dilate(r)
    missing=r&~dilated_a
    extra=a&~dilated_r
    record={**case,'nativeForeground':int(r.sum()),'svgForeground':int(a.sum()),'missingBeyond2px':int(missing.sum()),'extraBeyond2px':int(extra.sum()),'rawDifferentPixels':int(np.any(reference!=actual,axis=2).sum())}
    record['missingRatio']=record['missingBeyond2px']/max(1,record['nativeForeground']);record['extraRatio']=record['extraBeyond2px']/max(1,record['svgForeground'])
    records.append(record)
    if len(records)%200==0:print(f'Compared {len(records)} scenes',flush=True)
records.sort(key=lambda x:max(x['missingRatio'],x['extraRatio']),reverse=True)
report={'scenes':len(records),'pixelIdentical':sum(x['rawDifferentPixels']==0 for x in records),'maxMissingRatio':max(x['missingRatio'] for x in records),'maxExtraRatio':max(x['extraRatio'] for x in records),'renderer':'AndroidSVG Canvas' if android else 'Chromium SVG','scope':'Compared with retained GDI preview; 2px Chebyshev geometric tolerance; no assertion of pixel equality for all scenes','frames':records}
report['passed']=len(records)==1316 and report['maxMissingRatio']<.01 and report['maxExtraRatio']<.01
(WORK/('android-svg-comparison.json' if android else 'svg-comparison.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='frames'}));print(json.dumps(records[:8],indent=2))
