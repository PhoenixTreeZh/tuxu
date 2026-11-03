"""Original rectangle/diagonal demo; no original book drawings or answers."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent/'demo-assets/content'


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def main():
    qid = 'ch01/P1'
    stages = ['demo-step-1','demo-step-2','demo-step-3']
    detail = 'demo-detail'
    captions = ['示例：先绘制矩形轮廓。','示例：绘制第一条对角线。','示例：补全对角线与圆，点击圆查看局部。']
    background = {'kind':'fill_rectangle','rect':[0,0,700,500],'color':[21,30,32]}
    rectangle = {'kind':'stroke_rectangle','rect':[120,110,580,390],'color':[248,247,244],'pen_width':3}
    lines = [
        {'kind':'line','points':[[120,110],[580,390]],'color':[169,210,172],'pen_width':2},
        {'kind':'line','points':[[580,110],[120,390]],'color':[169,210,172],'pen_width':2},
        {'kind':'stroke_ellipse','rect':[270,170,430,330],'color':[248,247,244],'pen_width':3},
    ]
    native_frames, ui_frames = {}, {}
    for i, fid in enumerate([*stages, detail]):
        is_detail = fid==detail
        viewport = [220,100,480,400] if is_detail else [0,0,700,500]
        width,height = viewport[2]-viewport[0],viewport[3]-viewport[1]
        extras = lines if i>=2 else lines[:i]
        operations = [background,rectangle,*extras]
        hotspots = []
        if fid==stages[-1]:
            hotspots = [{'id':'demo-open-detail','kind':'detail','rect':[270,170,430,330],'label':'圆与对角线','target_frame_id':detail}]
        elif is_detail:
            hotspots = [{'id':'demo-back','kind':'back','rect':viewport,'label':'返回总图','target_frame_id':stages[-1]}]
        caption = '原创演示：圆与对角线的局部。' if is_detail else captions[i]
        scene = {'version':1,'viewport':viewport,'operations':operations,'contains_vector_content':True,
            'vector_asset_count':0,'raster_asset_count':0,'geometry_count':len(operations),'text_count':0}
        native_frames[fid] = {'id':fid,'question_id':qid,'role':'answer','status':'rendered','image':None,
            'width':width,'height':height,'captions':[caption],'scene':scene,'hotspots':hotspots,
            'back_target_frame_id':stages[-1] if is_detail else None}
        ui_frames[fid] = {'id':fid,'question':qid,'width':width,'height':height,'viewport':viewport,
            'captions':[caption],'emptyLinks':0,'preview':'','svg':f'demo/{fid}.svg','vector':True,
            'back':stages[-1] if is_detail else None,'hotspots':hotspots}
        shapes = ['<rect width="700" height="500" fill="#151e20"/>',
            '<rect x="120" y="110" width="460" height="280" fill="none" stroke="#f8f7f4" stroke-width="3"/>']
        if i>=1:shapes.append('<path d="M120 110L580 390" fill="none" stroke="#a9d2ac" stroke-width="2"/>')
        if i>=2:shapes.extend(['<path d="M580 110L120 390" fill="none" stroke="#a9d2ac" stroke-width="2"/>',
            '<ellipse cx="350" cy="250" rx="80" ry="80" fill="none" stroke="#f8f7f4" stroke-width="3"/>'])
        target=OUT/f'demo/{fid}.svg';target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="{viewport[0]} {viewport[1]} {width} {height}">'+''.join(shapes)+'</svg>\n',encoding='utf-8')
    metadata={'id':qid,'chapter':'ch01','page':1,'key':'P1','title':'示例绘图','aliases':[],
        'steps':3,'video':False,'detailCount':1,'dataPath':'index/questions/demo.json'}
    branch={'id':'demo-answer','label':'绘制过程','kind':'steps','frames':stages}
    document={'question':metadata,'branches':[branch],'questionFrames':[],'supplementFrames':[],
        'frames':ui_frames,'animations':{},'answer':''}
    native_q={'id':qid,'chapter_id':'ch01','page':1,'key':'P1','title':'示例绘图',
        'branches':[{'id':branch['id'],'label':branch['label'],'kind':'steps','frame_ids':stages,'complete_frames_available':True}],
        'root_question_frame_ids':[],'root_supplement_frame_ids':[],'query_aliases':[],'available_answer_branches':1}
    write(OUT/'library.json',{'version':2,'chapters':[{'id':'ch01','title':'第1章 原创演示','pages':[1]}],
        'questions':[native_q],'frames':native_frames,'animations':{}})
    write(OUT/'index/catalog.json',{'version':1,'librarySha256':'original-demo',
        'chapters':[{'id':'ch01','title':'第1章 原创演示','count':1,'pages':[{'number':1,'questions':[qid]}]}], 'questions':[metadata]})
    write(OUT/'index/questions/demo.json',document)
    print('Generated original demo: one question, three steps and one clickable detail.')


if __name__=='__main__':main()
