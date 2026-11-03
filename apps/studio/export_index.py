"""Build a small chapter/page/question index and lazy source-backed documents."""
from pathlib import Path
import hashlib
import json

ROOT=Path(__file__).resolve().parents[2]
CONTENT=ROOT/'content/windows'
if not (CONTENT/'library.json').is_file():CONTENT=ROOT/'_rea_temp/reader/content'


def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')


def main():
    source=CONTENT/'library.json'
    library=json.loads(source.read_text(encoding='utf-8'))
    frames=library['frames'];questions=[];chapters=[];entries={}
    companion=CONTENT/'video-compatibility.json'
    if not companion.exists():companion=ROOT/'_rea_temp/frontend-rewrite/video-compatibility.json'
    compatibility=json.loads(companion.read_text(encoding='utf-8')) if companion.exists() else None
    if compatibility:
        assert compatibility['passed']
        assert hashlib.sha256((CONTENT/compatibility['companion']).read_bytes()).hexdigest()==compatibility['companionSha256']
    for q in library['questions']:
        if q['hidden_as_click_detail']:continue
        branches=[b for b in q['branches'] if not b['hidden_as_click_detail'] and not b.get('hidden_as_clear_frame')]
        branches.sort(key=lambda b:(not b['complete_frames_available'],b['kind']!='steps'))
        roots=q['root_question_frame_ids']+q['root_supplement_frame_ids']+[f for b in branches for f in b['frame_ids']]
        seen=set(roots);todo=list(roots)
        while todo:
            for h in frames[todo.pop()].get('hotspots',[]):
                if h['kind']!='animation' and h['target_frame_id'] not in seen:
                    seen.add(h['target_frame_id']);todo.append(h['target_frame_id'])
        data_path=f"index/questions/{q['chapter_id']}-{q['key'].replace('/','_')}.json"
        metadata={'id':q['id'],'chapter':q['chapter_id'],'page':q['page'],'key':q['key'],
            'title':q['title'] if q['title']!='本页内容' else f"第 {q['page']} 页",
            'aliases':q.get('query_aliases',[]),'steps':next((len(b['frame_ids']) for b in branches if b['kind']=='steps'),0),
            'video':bool(q.get('video_path')),'detailCount':len({fid for fid in seen if frames[fid].get('is_click_detail')}),
            'dataPath':data_path}
        def frame_data(frame):
            return {'id':frame['id'],'question':frame['question_id'],'width':frame['width'],'height':frame['height'],
                'viewport':frame['viewport'],'captions':frame['captions'],
                'emptyLinks':len(frame.get('empty_linked_images',[])),
                'preview':frame['image'],'vector':frame['scene']['vector_asset_count']>0 or frame['scene']['geometry_count']>0,
                'back':frame.get('back_target_frame_id'),
                'hotspots':[{k:v for k,v in h.items() if k in ('id','rect','kind','label','target_frame_id','target_animation_id')} for h in frame.get('hotspots',[])]}
        document={'question':metadata,'branches':[{'id':b['id'],'label':b['label'],'kind':b['kind'],'frames':b['frame_ids']} for b in branches],
            'questionFrames':q['root_question_frame_ids'],'supplementFrames':q['root_supplement_frame_ids'],
            'frames':{fid:frame_data(frames[fid]) for fid in sorted(seen)},'answer':q.get('answer_caption',''),
            'videoPath':compatibility['companion'] if compatibility and q.get('video_path')==compatibility['source'] else q.get('video_path'),
            'originalVideoPath':q.get('video_path'),
            'animations':{h['target_animation_id']:library['animations'][h['target_animation_id']] for fid in seen for h in frames[fid].get('hotspots',[]) if h['kind']=='animation'}}
        write(CONTENT/data_path,document)
        questions.append(metadata);entries[q['id']]=metadata
    questions.sort(key=lambda q:(q['chapter'],q['page'] or 999,tuple(int(p) if p.isdigit() else p for p in q['key'].lstrip('P').split('-')) if not q['video'] else (q['key'],)))
    for c in library['chapters']:
        items=[q for q in questions if q['chapter']==c['id']]
        pages=[{'number':page,'questions':[q['id'] for q in items if q['page']==page]} for page in sorted({q['page'] for q in items if q['page'] is not None})]
        if any(q['page'] is None for q in items):pages.append({'number':None,'questions':[q['id'] for q in items if q['page'] is None]})
        chapters.append({'id':c['id'],'title':c['title'],'pages':pages,'count':len(items)})
    catalog={'version':1,'librarySha256':hashlib.sha256(source.read_bytes()).hexdigest(),'chapters':chapters,'questions':questions}
    write(CONTENT/'index/catalog.json',catalog)
    assert len(questions)==207
    assert sum(1 for q in questions if q['steps'])==46
    for q in questions:
        d=json.loads((CONTENT/q['dataPath']).read_text(encoding='utf-8'))
        assert all(fid in d['frames'] for b in d['branches'] for fid in b['frames'])
        for frame in d['frames'].values():
            assert all(h['target_frame_id'] in d['frames'] for h in frame['hotspots'] if h['kind']!='animation')
    report={'passed':True,'entries':len(questions),'pages':sum(len(c['pages']) for c in chapters if c['id']!='ch07'),
        'stepSeries':46,'indexBytes':(CONTENT/'index/catalog.json').stat().st_size,'sourceLibraryBytes':source.stat().st_size,
        'sourceLibrarySha256':catalog['librarySha256'],'lazyQuestionDocuments':len(questions),'sourceChanged':False}
    write(ROOT/'_rea_temp/frontend-rewrite/index-verification.json',report)
    print(json.dumps(report))


if __name__=='__main__':main()
