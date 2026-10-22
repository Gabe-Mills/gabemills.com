"""Generate the three Bandroom song.yaml files for the gabemills.com home score (T737).
gmh-intro: build (2 bars) + hit (bar 3) + ring-out, no bed
gmh-loop:  16-bar bed, master loop: true
gmh-full:  build + hit + bed x2 (for critique / preview only)
"""
import sys
from pathlib import Path
import yaml

SONGS = Path("/Users/gabemills/Developer/Projects/Active/bandroom/songs")
BED_CHORDS = ["Dm", "Dm", "Bb", "Bb", "F", "F", "C", "C", "Dm", "Dm", "Bb", "Bb", "Gm", "Gm", "Bb", "C"]

# ---------------- bed (16 bars, clips relative to bed start) ----------------
MELODY = [
    "1:1 D5 1.5 v62", "1:2.5 E5 0.5 v56", "1:3 F5 2 v64",
    "2:1 A5 3 v66", "2:4 G5 1 v56",
    "3:1 F5 1.5 v62", "3:2.5 D5 0.5 v54", "3:3 F5 2 v62",
    "4:1 G5 2 v64", "4:3 F5 1 v56", "4:4 D5 1 v54",
    "5:1 C5 1.5 v60", "5:2.5 D5 0.5 v54", "5:3 F5 2 v62",
    "6:1 A5 3 v66", "6:4 C6 1 v60",
    "7:1 G5 2 v64", "7:3 E5 1 v56", "7:4 C5 1 v54",
    "8:1 E5 3 v60",
    "9:1 D5 1.5 v62", "9:2.5 E5 0.5 v56", "9:3 F5 2 v64",
    "10:1 A5 2 v66", "10:3 D6 2 v66",
    "11:1 D6 1.5 v66", "11:2.5 C6 0.5 v58", "11:3 Bb5 2 v62",
    "12:1 F5 3 v62", "12:4 D5 1 v54",
    "13:1 G5 1.5 v62", "13:2.5 A5 0.5 v56", "13:3 Bb5 2 v64",
    "14:1 D6 3 v66",
    "15:1 C6 1.5 v62", "15:2.5 Bb5 0.5 v56", "15:3 F5 2 v62",
    "16:1 G5 2 v62", "16:3 E5 2 v58",
]

# celesta-like sparkle: glock doubles the first note of each melodic phrase, two octaves of shimmer
GLOCK = ["1:1 D6 2 v54", "2:1 A6 2 v52", "5:1 C6 2 v50", "6:1 A6 2 v52", "9:1 D6 2 v54", "10:3 D7 2 v50",
         "13:1 G6 2 v50", "14:1 D7 2 v52", "16:3 E6 2 v46"]
# soft ride shimmer on every bar (steady, no restart feel)
SIZZLE = [f"{b}:1 ride 1 v38" for b in range(1, 17)] + [f"{b}:3 ride 1 v30" for b in range(1, 17)]
HIGH = {"Dm": "[D6]", "Bb": "[D6]", "F": "[C6]", "C": "[C6]", "Gm": "[D6]"}
# warm sustained voicings per bar (violas/cellos/basses hand-written so the bed is steady)
ROOT = {"Dm": "D", "Bb": "Bb", "F": "F", "C": "C", "Gm": "G"}
CELLO = {"Dm": "[D2 A2]", "Bb": "[Bb1 F2]", "F": "[F2 C3]", "C": "[C2 G2]", "Gm": "[G2 D3]"}
VIOLA = {"Dm": "[F3 A3]", "Bb": "[F3 Bb3]", "F": "[F3 A3]", "C": "[E3 G3]", "Gm": "[G3 Bb3]"}
VIOLIN = {"Dm": "[A4 D5]", "Bb": "[Bb4 D5]", "F": "[A4 C5]", "C": "[G4 C5]", "Gm": "[Bb4 D5]"}
HORN = {"Dm": "A3", "Bb": "F3", "F": "A3", "C": "G3", "Gm": "G3"}
BASS = {"Dm": "D2", "Bb": "Bb1", "F": "F2", "C": "C2", "Gm": "G1"}


def held(table, vel, two_bar=True):
    """One sustained note/chord per bar (re-bowed every bar, slightly overlapping)."""
    out = []
    for i, c in enumerate(BED_CHORDS):
        out.append(f"{i + 1}:1 {table[c]} 4.1 v{vel}")
    return out


def bed_tracks(section, start_bar=None):
    def clip(notes, bars=16):
        c = {"bars": bars, "notes": notes}
        if start_bar is None:
            c["sections"] = [section] if isinstance(section, str) else section
        else:
            c["at"] = start_bar
            c["for"] = bars
        return [c]

    hb = []  # heartbeat-ish soft pulse: cellos spiccato 8ths on the root, steady
    for i, c in enumerate(BED_CHORDS):
        r = BASS[c].replace("1", "2") if BASS[c].endswith("1") else BASS[c]
        for k in range(8):
            beat = 1 + k * 0.5
            v = 58 if k % 2 == 0 else 44
            hb.append(f"{i + 1}:{beat:g} {r} 0.45 v{v}")
    harp = []  # gentle harp arpeggio, quarter notes, chord tones in a middle register
    ARP = {"Dm": ["D4", "A4", "F4", "A4"], "Bb": ["Bb3", "F4", "D4", "F4"], "F": ["F4", "C5", "A4", "C5"],
           "C": ["C4", "G4", "E4", "G4"], "Gm": ["G3", "D4", "Bb3", "D4"]}
    for i, c in enumerate(BED_CHORDS):
        for k, n in enumerate(ARP[c]):
            harp.append(f"{i + 1}:{k + 1} {n} 1.5 v{50 if k == 0 else 42}")
    timp = []
    for i in range(0, 16, 2):
        c = BED_CHORDS[i]
        n = {"Dm": "D2", "Bb": "D2", "F": "F2", "C": "C2", "Gm": "G2"}[c]
        timp.append(f"{i + 1}:1 {n} 1 v52")
    return [
        {"name": "Basses", "instrument": "contrabass", "clips": clip(held(BASS, 72)), "mix": {"gain": 0}},
        {"name": "Cellos", "instrument": "cellos", "clips": clip(held(CELLO, 70)), "mix": {"gain": 0, "pan": 0.15}},
        {"name": "Violas", "instrument": "violas", "clips": clip(held(VIOLA, 64)), "mix": {"gain": -2, "pan": 0.25}},
        {"name": "Violins", "instrument": "violins", "clips": clip(held(VIOLIN, 62)), "mix": {"gain": -2, "pan": -0.25}},
        {"name": "Horn", "instrument": "horn", "clips": clip(held(HORN, 56)), "mix": {"gain": -4, "pan": 0.3, "reverb": 0.35}},
        {"name": "Pad", "instrument": "pad", "clips": clip(held(VIOLA, 60)), "mix": {"gain": -3}},
        {"name": "Pulse", "instrument": "cellos_spic", "clips": clip(hb), "mix": {"gain": -5, "pan": -0.1}},
        {"name": "Harp", "instrument": "harp", "clips": clip(harp), "mix": {"gain": -6, "pan": -0.35, "reverb": 0.35}},
        {"name": "Piano", "instrument": "piano", "clips": clip(MELODY), "mix": {"gain": -1, "reverb": 0.4, "space": "hall"}},
        {"name": "Timpani", "instrument": "timpani", "clips": clip(timp), "mix": {"gain": 3}},
        {"name": "Glock", "instrument": "glock", "clips": clip(GLOCK), "mix": {"gain": -3, "pan": 0.35, "reverb": 0.4}},
        {"name": "High Strings", "instrument": "violins", "clips": clip(held(HIGH, 52)), "mix": {"gain": -5, "pan": -0.4, "air": 2}},
        {"name": "Air Cymbal", "instrument": "drums", "clips": clip(SIZZLE), "mix": {"gain": -8, "reverb": 0.4, "space": "hall"}},
    ]


# ---------------- build + hit (absolute bars: 1-2 build, 3 hit) ----------------
def intro_tracks():
    return [{**t, "humanize": {"timing": 0, "velocity": 3}} for t in _intro_tracks()]


def _intro_tracks():
    hb = []  # heartbeat lub-dub, growing
    vels = [(58, 42), (66, 48), (76, 56), (88, 64)]
    for j, (b, beat) in enumerate([(1, 1), (1, 3), (2, 1), (2, 3)]):
        lv, dv = vels[j]
        hb.append(f"{b}:{beat} D2 0.5 v{lv}")
        hb.append(f"{b}:{beat + 0.5:g} D2 0.5 v{dv}")
    hb.append("3:1 [D2 A2] 2 v127")  # the hit
    roll = []  # timpani roll on A2 over bar 2 beats 3-4.75 (32nds), crescendo
    steps = 14
    for k in range(steps):
        beat = 3 + k * 0.125
        v = int(34 + (118 - 34) * (k / (steps - 1)) ** 1.6)
        roll.append(f"2:{beat:g} A2 0.125 v{v}")
    spic = []  # cello spiccato 8ths in bar 2, crescendo (the pulse ramps up)
    for k in range(8):
        v = int(50 + k * 9)
        spic.append(f"2:{1 + k * 0.5:g} D2 0.45 v{v}")
    swoop = []  # violin 16th swoop into the hit
    for k, n in enumerate(["A4", "Bb4", "C5", "D5", "E5", "F5", "G5", "A5"]):
        swoop.append(f"2:{3 + k * 0.25:g} {n} 0.25 v{60 + k * 7}")
    return [
        {"name": "Drone Bass", "instrument": "contrabass", "clips": [{"at": 1, "bars": 3, "notes": ["1:1 D1 8 v80", "3:1 D1 2.5 v127"]}], "mix": {"gain": 1}},
        {"name": "Drone Cello", "instrument": "cellos", "clips": [{"at": 1, "bars": 3, "notes": ["1:1 [D2 A2] 8 v66", "3:1 [D2 A2 D3] 2 v127"]}], "mix": {"gain": 0}},
        {"name": "Drone Pad", "instrument": "pad", "clips": [{"at": 1, "bars": 2, "notes": ["1:1 [D3 A3] 8 v70"]}], "mix": {"gain": -2}},
        {"name": "Heartbeat", "instrument": "timpani", "clips": [{"at": 1, "bars": 3, "notes": hb}], "mix": {"gain": 3, "reverb": 0.3, "space": "hall"}},
        {"name": "Roll", "instrument": "timpani", "clips": [{"at": 1, "bars": 2, "notes": roll}], "mix": {"gain": 0}},
        {"name": "Spic", "instrument": "cellos_spic", "clips": [{"at": 1, "bars": 2, "notes": spic}], "mix": {"gain": -1}},
        {"name": "Swoop", "instrument": "violins_spic", "clips": [{"at": 1, "bars": 2, "notes": swoop}], "mix": {"gain": -2}},
        {"name": "Hit Kit", "instrument": "drums", "clips": [{"at": 3, "bars": 1, "notes": ["1:1 kick 1 v127", "1:1 tom_low 1 v124", "1:1 tom_mid 1 v116", "1:1 crash 1 v100", "1:1 kick2 1 v127"]},
                                                              {"at": 2, "bars": 1, "notes": [f"1:{3 + k * 0.125:g} ride 0.125 v{int(28 + 62 * (k / 15) ** 1.5)}" for k in range(16)]}],
         "mix": {"gain": 2, "reverb": 0.35, "space": "hall"}},
        {"name": "Hit Violas", "instrument": "violas", "clips": [{"at": 3, "bars": 1, "notes": ["1:1 [F3 A3 D4] 2 v127"]}], "mix": {"gain": 1}},
        {"name": "Hit Violins", "instrument": "violins", "clips": [{"at": 3, "bars": 1, "notes": ["1:1 [A4 D5 F5] 2 v127"]}], "mix": {"gain": 1}},
        {"name": "Hit Brass", "instrument": "synth_brass", "clips": [{"at": 3, "bars": 1, "notes": ["1:1 [D3 A3 D4 F4] 1.5 v120"]}], "mix": {"gain": -3}},
        {"name": "Hit Horn 1", "instrument": "horn", "clips": [{"at": 3, "bars": 1, "notes": ["1:1 A3 2 v127"]}], "mix": {"gain": 1}},
        {"name": "Hit Horn 2", "instrument": "horn", "clips": [{"at": 3, "bars": 1, "notes": ["1:1 F4 2 v127"]}], "mix": {"gain": 0}},
        {"name": "Hit Tuba", "instrument": "tuba", "clips": [{"at": 3, "bars": 1, "notes": ["1:1 D2 2 v127"]}], "mix": {"gain": 1}},
        {"name": "Hit Piano", "instrument": "piano", "clips": [{"at": 3, "bars": 1, "notes": ["1:1 [D1 D2 A2] 3 v127"]}], "mix": {"gain": 0, "reverb": 0.5}},
    ]


def song(title, sections, tracks, master):
    return {"title": title, "tempo": 86.0, "key": "D minor", "sections": sections, "master": master, "tracks": tracks}


def write(name, d):
    p = SONGS / f"{name}.yaml"
    p.write_text(yaml.safe_dump(d, sort_keys=False, width=200))
    print(p)


if __name__ == "__main__":
    write("gmh-intro", song("Ignition (intro)", [
        {"name": "build", "bars": 2, "chords": ["Dm"], "chord_beats": 8},
        {"name": "hit", "bars": 4, "chords": ["Dm"], "chord_beats": 16},
    ], intro_tracks(), {"lufs": -14, "space": "hall", "tilt": 0.6, "deharsh": 0.8}))
    write("gmh-loop", song("Ignition (bed loop)", [
        {"name": "bed", "bars": 16, "chords": BED_CHORDS, "energy": 0.5},
    ], bed_tracks("bed"), {"lufs": -14, "space": "hall", "tilt": 0.6, "loop": True}))
    full = intro_tracks() + bed_tracks(None, start_bar=3) + [
        {**t, "name": t["name"] + " 2", "clips": [{**t["clips"][0], "at": 19}]} for t in bed_tracks(None, start_bar=19)]
    write("gmh-full", song("Ignition (full preview)", [
        {"name": "build", "bars": 2, "chords": ["Dm"], "chord_beats": 8},
        {"name": "bed", "bars": 16, "chords": BED_CHORDS},
        {"name": "bed2", "bars": 16, "chords": BED_CHORDS},
    ], full, {"lufs": -14, "space": "hall", "tilt": 0.6, "deharsh": 0.8}))
