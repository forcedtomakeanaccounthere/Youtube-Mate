"""Derive sentence-level caption timings from narration clips.
Splits each narration text into caption chunks and maps chunk boundaries onto
the longest pauses detected by ffmpeg silencedetect (kept in order)."""
import json, re, subprocess, sys
items = json.load(open('script/narration.json'))
out = {}
for it in items:
    f = f"public/vo/{it['id']}.mp3"
    dur = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]).decode())
    log = subprocess.run(['ffmpeg','-i',f,'-af','silencedetect=n=-35dB:d=0.16','-f','null','-'],capture_output=True,text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    sil = [(s, e) for s, e in zip(st, en) if e < dur - 0.05 and s > 0.05]
    chunks = [c.strip() for c in re.split(r'(?<=[.?!])\s+', it['text']) if c.strip()]
    # merge very short chunks with the next one for readability
    n = len(chunks) - 1
    pick = sorted(sorted(sil, key=lambda p: -(p[1]-p[0]))[:n])
    if len(pick) < n:  # fall back: merge tail chunks
        chunks = chunks[:len(pick)] + [' '.join(chunks[len(pick):])]
    bounds = [0.0] + [ (s+e)/2 for s, e in pick ] + [dur]
    out[it['id']] = {'duration': round(dur,3), 'chunks': [{'text': c, 'start': round(bounds[i],3), 'end': round(bounds[i+1],3)} for i, c in enumerate(chunks)]}
    # split long chunks into caption lines (<= ~58 chars) at commas/dashes,
    # timing by character share, snapped to a nearby pause when one exists
    mids = [(a+b)/2 for a, b in sil]
    lines = []
    for c in out[it['id']]['chunks']:
        parts = re.split(r'(?<=,)\s+', c['text'])
        groups, cur = [], ''
        for p in parts:
            if cur and len(cur) + len(p) + 1 > 58:
                groups.append(cur); cur = p
            else:
                cur = (cur + ' ' + p).strip()
        groups.append(cur)
        total = sum(len(g) for g in groups); t = c['start']; span = c['end'] - c['start']
        for i, g in enumerate(groups):
            end = c['end'] if i == len(groups)-1 else t + span * len(g) / total
            if i < len(groups)-1 and mids:
                near = min(mids, key=lambda m: abs(m-end))
                if abs(near-end) < 0.7: end = near
            lines.append({'text': g, 'start': round(t,3), 'end': round(end,3)}); t = end
    out[it['id']]['chunks'] = lines
json.dump(out, open('src/captions.json','w'), indent=1)
for k,v in out.items(): print(k, v['duration'], [(c['text'][:25], c['start']) for c in v['chunks']])
