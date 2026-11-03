"""Verify bundled questions, steps, hotspots and media without launching either app."""
from pathlib import Path
import hashlib
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def read(path): return json.loads(path.read_text(encoding='utf-8'))


def verify(root=ROOT):
    windows = (root/'content/windows').resolve()
    android = (root/'apps/android/app/src/main/assets/content').resolve()
    digests = {}

    def resource(base, relative, expected=None):
        assert relative, 'Missing resource path'
        path = (base/relative).resolve()
        assert path.is_relative_to(base), 'Resource outside content directory'
        assert path.is_file(), f'Missing resource: {relative}'
        if expected:
            if path not in digests:
                with path.open('rb') as stream: digests[path] = hashlib.file_digest(stream, 'sha256').hexdigest()
            assert digests[path] == expected, f'Checksum mismatch: {relative}'
        return path

    library = read(windows/'library.json')
    catalog = read(windows/'index/catalog.json')
    android_catalog = read(android/'index/catalog.json')
    assert catalog == android_catalog, 'Desktop and Android catalogs differ'
    resource(windows, 'library.json', catalog['librarySha256'])
    assert len(catalog['questions']) == 207
    assert len(library['frames']) == 1316
    ids = {q['id'] for q in catalog['questions']}
    assert len(ids) == len(catalog['questions'])
    assert ids == {q['id'] for q in library['questions'] if not q.get('hidden_as_click_detail')}
    hierarchy = [qid for c in catalog['chapters'] for p in c['pages'] for qid in p['questions']]
    assert len(hierarchy) == len(ids) and set(hierarchy) == ids

    native_frames = library['frames']
    for frame in native_frames.values():
        assert frame.get('scene'), 'Native scene missing'
        if frame.get('image'): resource(windows, frame['image'], frame.get('image_sha256'))
        for operation in frame['scene']['operations']:
            if operation.get('path'): resource(windows, operation['path'], operation.get('sha256'))
        if frame.get('back_target_frame_id'): assert frame['back_target_frame_id'] in native_frames
        for h in frame.get('hotspots', []):
            if h['kind'] == 'animation': assert h['target_animation_id'] in library['animations']
            else: assert h['target_frame_id'] in native_frames
    for animation in library['animations'].values():
        resource(windows, animation['path'], animation['sha256'])
    for q in library['questions']:
        if q.get('video_path'): resource(windows, q['video_path'], q.get('video_sha256'))
    mapping = read(windows/'video-compatibility.json')
    resource(windows, mapping['companion'], mapping['companionSha256'])
    resource(windows, mapping['source'])

    svg_paths, platform_frames = set(), {}
    videos, animations = {}, {}
    for base in (windows, android):
        reachable, video_paths, animation_paths = set(), set(), set()
        for q in catalog['questions']:
            doc = read(resource(base, q['dataPath']))
            assert doc['question'] == q
            desktop_doc = read(windows/q['dataPath'])
            for key in ('branches', 'questionFrames', 'supplementFrames', 'answer'):
                assert doc[key] == desktop_doc[key], f'Platform question mismatch: {q["id"]}'
            frames = doc['frames']
            assert set(frames) == set(desktop_doc['frames'])
            for fid in [*doc['questionFrames'], *doc['supplementFrames'],
                        *(fid for b in doc['branches'] for fid in b['frames'])]:
                assert fid in frames
            for fid, frame in frames.items():
                assert fid in native_frames
                assert frame['hotspots'] == desktop_doc['frames'][fid]['hotspots']
                if frame.get('back'): assert frame['back'] in frames
                for h in frame['hotspots']:
                    if h['kind'] == 'animation': assert h['target_animation_id'] in doc['animations']
                    else: assert h['target_frame_id'] in frames
                if base == android: svg_paths.add(resource(base, frame['svg']))
                elif frame.get('preview'): resource(base, frame['preview'])
            reachable.update(frames)
            for key in ('videoPath', 'originalVideoPath'):
                if doc.get(key):
                    resource(base, doc[key])
                    if key == 'videoPath': video_paths.add(doc[key])
            for animation in doc['animations'].values():
                resource(base, animation['path'], animation.get('sha256'))
                animation_paths.add(animation['path'])
        platform_frames[base] = reachable
        videos[base], animations[base] = len(video_paths), len(animation_paths)
    assert platform_frames[windows] == platform_frames[android]
    assert platform_frames[windows].issubset(native_frames)
    assert videos[windows] == videos[android] == 6
    assert animations[windows] == animations[android] == 14
    manifest = read(android/'scenes/manifest.json')
    assert manifest['librarySha256'] == catalog['librarySha256']
    assert {f['id'] for f in manifest['frames']} == set(native_frames)
    for frame in manifest['frames']: svg_paths.add(resource(android, frame['svg']))
    for path in svg_paths:
        document = ET.parse(path)
        for element in document.iter():
            for key, value in element.attrib.items():
                if key.endswith('href') and not value.startswith(('#', 'data:')):
                    resource(android, str((path.parent/ value).relative_to(android)))
    return {'passed': True, 'questions': len(ids), 'chapters': len(catalog['chapters']),
            'stepSeries': sum(bool(q['steps']) for q in catalog['questions']),
            'nativeFrames': len(native_frames), 'androidFrameReferences': len(manifest['frames']),
            'uiReachableFrames': len(platform_frames[android]),
            'androidSvgFiles': len(svg_paths), 'animations': 14, 'videosPerPlatform': 6,
            'resourceChecksumsVerified': len(digests),
            'emptySourceLinkOccurrences': sum(len(f.get('empty_linked_images', [])) for f in native_frames.values()),
            'librarySha256': catalog['librarySha256']}


if __name__ == '__main__': print(json.dumps(verify(), ensure_ascii=False, indent=2))
