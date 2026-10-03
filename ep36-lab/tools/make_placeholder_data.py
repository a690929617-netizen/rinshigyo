#!/usr/bin/env python3
"""Placeholder timing data for the EP36《六秒》lab (data/lyrics.json + data/audio.json).

The real data (demucs stems + per-mora MMS alignment) was already built on the local PC on 2026-10-02.
This file only exists so the test plates can be rendered in the cloud without the song:
a constant 136 BPM grid, an 18 s intro (measured on the real song), one lyric line per bar,
one character per eighth note. Replace data/*.json with the real analysis before making the MV.

Usage: python3 tools/make_placeholder_data.py   (writes ../data/lyrics.json and ../data/audio.json)
"""
import json
import math
import os

BPM = 136.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
INTRO = 18.0          # measured on the real song (Suno wrote a 1-bar intro, it sang after 18 s)
DURATION = 200.0      # real song: 3:20
FPS = 50

# (section, lines). Phrases are split with a full-width space, as in the v1 lyric sheet.
SONG = [
    ('verse1', ['布団に　もぐって', '親指　ひとつで', '千人　流れた', 'お次は　わたしだ',
                '二秒で　決めるの？', '顔すら　見ないの？', '指紋が　近づく', 'そこまで　ストップ']),
    ('pre1', ['親指さんよ', 'はじかないでよ']),
    ('chorus1', ['飛ばして　みなよ', '飛ばせ　ないでしょ', 'もう　七秒よ', '壁は　越えたの',
                 'サビの　中だよ', '瞬き　したろ', '指が　止まるの', 'まだ　見てるもの']),
    ('post1', ['まだ　見てるもの', None]),   # Suno's extra line + one instrumental bar
    ('verse2', ['イントロ　捨てたし', '字幕も　つけたし', '音量　上げたし', '前髪　切ったし',
                '隣の　猫には', '勝てない　らしいわ', '倍速　やめてよ', 'キーまで　上がるの']),
    ('pre2', ['おすすめさんへ', '見捨てないでね']),
    ('chorus2', ['飛ばして　みなよ', '飛ばせ　ないでしょ', 'もう　いっぷんよ', '常連　だもの',
                 '保存　してたの', '知ってる　んだよ', 'コメント　欄の', '「誰？」も　あなたよ']),
    ('verse3', ['電池は　さんパー', '通知が　ぱらぱら', '「寝た？」って　来てるよ', '返信　しないの？',
                'うとうと　しかけて', 'スマホが　顔面', '止まらず　再生', '夢でも　歌うし']),
    ('pre3', ['そこの　あなたへ', '離さないでね']),
    ('chorus3', ['飛ばして　みなよ', '百万本の', '動画の　奥の', 'わたし　ひとりを', '次へ　行っても', 'ループ　してるよ']),
    ('bridge', ['一万　十万', '百万　いったら', '親指　つったら', 'わたしの　せいかな',
                'アルゴが　バグって', '全員　ハマって', 'みんなの　画面で', 'わたしが　増えてて']),
    ('final', ['飛ばして　みなよ', '飛ばせ　ないでしょ', 'もう　にふんだぞ', '帰さない　もの',
               '親指さんも', 'いいね　してるよ', 'あと　少しだよ', 'ラストの　サビよ',
               '飛ばして　みなよ', 'まだ　いるじゃない']),
    ('tag', ['まだ　いるじゃない']),          # Suno's extra closing line
]


def build():
    lines, sections = [], [{'name': 'intro', 'start': 0.0, 'end': INTRO}]
    t = INTRO
    for name, ls in SONG:
        s0 = t
        for text in ls:
            if text is None:
                t += BAR
                continue
            phrases = text.split('　')
            chars = [c for c in text if c != '　']
            n = len(chars)
            step = min(BEAT / 2, (BAR - BEAT / 2) / n)  # one eighth note per character
            words, k = [], 0
            for ph in phrases:
                syl = []
                for _ in ph:
                    a = t + k * step
                    syl.append([round(a, 3), round(a + step * 0.92, 3)])
                    k += 1
                words.append({'w': ph, 'start': syl[0][0], 'end': syl[-1][1], 'conf': 1.0, 'syl': syl})
            words[-1]['end'] = round(t + BAR - BEAT / 4, 3)  # hold the last mora
            lines.append({'i': len(lines), 'text': text.replace('　', ' '), 'start': words[0]['start'],
                          'end': words[-1]['end'], 'words': words})
            t += BAR
        sections.append({'name': name, 'start': round(s0, 3), 'end': round(t, 3)})
    sections.append({'name': 'outro', 'start': round(t, 3), 'end': DURATION})

    # beat grid through the whole song, phase-locked to the first sung downbeat
    first = INTRO - math.floor(INTRO / BEAT) * BEAT
    beats = [round(first + i * BEAT, 4) for i in range(int((DURATION - first) / BEAT) + 1)]
    i0 = beats.index(min(beats, key=lambda b: abs(b - INTRO)))
    downbeats = [b for i, b in enumerate(beats) if (i - i0) % 4 == 0]

    n = int(DURATION * FPS) + 1
    loud = {s['name']: v for s, v in zip(sections, [0.5, 0.55, 0.7, 0.9, 0.7, 0.6, 0.75, 0.95, 0.6, 0.25, 0.35, 1.0, 1.0, 0.9, 0.6])}

    def section_at(x):
        for s in sections:
            if s['start'] <= x < s['end']:
                return s['name']
        return 'outro'

    feats = {k: [] for k in ['rms', 'low', 'mid', 'high', 'vocal', 'drums', 'bass', 'other']}
    for j in range(n):
        x = j / FPS
        lv = loud.get(section_at(x), 0.5)
        ph = ((x - first) / BEAT) % 1.0
        kick = math.exp(-ph * 6.0)
        sung = any(l['start'] <= x < l['end'] for l in lines)
        feats['rms'].append(round(lv * (0.7 + 0.3 * kick), 3))
        feats['low'].append(round(lv * kick, 3))
        feats['mid'].append(round(lv * 0.8, 3))
        feats['high'].append(round(lv * (0.5 + 0.5 * math.exp(-abs(ph - 0.5) * 8.0)), 3))
        feats['vocal'].append(round(0.9 if sung else 0.05, 3))
        feats['drums'].append(round(lv * kick, 3))
        feats['bass'].append(round(lv * 0.7, 3))
        feats['other'].append(round(lv * 0.6, 3))
    quiet = {'intro', 'pre3', 'chorus3'}
    onsets = {
        'kick': [[b, 1.0] for b in beats if section_at(b) not in quiet or section_at(b) == 'chorus3'],
        'snare': [[b, 0.9] for i, b in enumerate(beats) if (i - i0) % 2 == 1 and section_at(b) not in quiet],
        'hat': [[round(b + BEAT / 2, 4), 0.6] for b in beats if section_at(b) not in quiet],
        'vocal': [[s[0], 1.0] for l in lines for w in l['words'] for s in w['syl']],
    }
    audio = {
        'duration': DURATION, 'bpm': BPM, 'beat_period': BEAT, 'time_signature': 4,
        'beats': beats, 'downbeats': downbeats, 'sections': sections, 'fps': FPS,
        **feats, 'onsets': onsets,
        'notes': 'PLACEHOLDER for the cloud lab: constant 136 BPM grid, 18 s intro, one line per bar. '
                 'The real song drifts 134 -> 138 BPM; use the analysis built on the local PC.',
    }
    lyrics = {'lines': lines, 'extras': [], 'notes': 'PLACEHOLDER timings (one character per eighth note).'}
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
    os.makedirs(root, exist_ok=True)
    json.dump(lyrics, open(os.path.join(root, 'lyrics.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(audio, open(os.path.join(root, 'audio.json'), 'w'), separators=(',', ':'))
    for s in sections:
        print(f"{s['name']:8s} {s['start']:7.2f} – {s['end']:7.2f}")
    print(len(lines), 'lines')


if __name__ == '__main__':
    build()
