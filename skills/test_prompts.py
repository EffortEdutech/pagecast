#!/usr/bin/env python3
"""
test_prompts.py — find the right style that avoids speech bubbles.

Usage:
  python skills/test_prompts.py --key pk_YOUR_KEY
  python skills/test_prompts.py --key pk_YOUR_KEY --scene "two teenagers in a city alley, night"

Results saved to: skills/prompt_test/
Open the images and pick which style has NO speech bubbles.
"""
import argparse, urllib.request, urllib.parse, urllib.error, time, os, sys
from pathlib import Path

# Same test subject for all variants so comparison is fair
DEFAULT_SUBJECT = "two teenagers running through a city alley at night, dynamic action"

# Style candidates — ranked from safest (top) to most risky (bottom)
CANDIDATES = [
    ("1_animated_film_still",  "2D animated film still, vibrant colours, dynamic scene"),
    ("2_animation_cel",        "animation cel, cartoon illustration, vibrant colours, energetic"),
    ("3_digital_painting",     "digital painting, YA adventure book cover art, vibrant colours"),
    ("4_concept_art",          "concept art, adventure scene, vibrant colours, cinematic"),
    ("5_storybook_illus",      "storybook illustration, adventure, vibrant colours, detailed"),
    ("6_graphic_novel",        "graphic novel illustration, YA adventure style, vibrant colours"),   # baseline — expect bubbles
]

NEG = urllib.parse.quote(
    "speech bubbles, dialogue balloons, text, captions, words, letters, watermark, "
    "comic panels, panel borders, thought bubbles, onomatopoeia"
)


def fetch(prompt, dest, key):
    enc = urllib.parse.quote(prompt)
    kp  = f"&key={key}" if key else ""
    url = (
        f"https://gen.pollinations.ai/image/{enc}"
        f"?width=512&height=288&nologo=true&negative_prompt={NEG}{kp}"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pageCast-prompt-test/1.0"})
        with urllib.request.urlopen(req, timeout=90) as r:
            data = r.read()
            if len(data) < 5000:
                return False, f"too small ({len(data)} bytes)"
            dest.write_bytes(data)
            return True, f"{len(data)//1024}KB"
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return False, "401 — add --key pk_YOUR_KEY (free at enter.pollinations.ai)"
        return False, f"HTTP {e.code}"
    except Exception as e:
        return False, str(e)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--key", default=os.environ.get("POLLINATIONS_KEY", ""))
    parser.add_argument("--scene", default=DEFAULT_SUBJECT,
                        help="Subject/scene description for test images")
    args = parser.parse_args()

    out = Path(__file__).parent / "prompt_test"
    out.mkdir(exist_ok=True)

    print(f"\n  Prompt style tester — {len(CANDIDATES)} variants")
    print(f"  Subject : {args.scene[:70]}")
    print(f"  Output  : {out}\n")

    for name, style in CANDIDATES:
        dest    = out / f"{name}.jpg"
        prompt  = f"{style}, {args.scene}, detailed composition, high quality, cinematic lighting"
        ok, msg = fetch(prompt, dest, args.key)
        status  = "✅" if ok else "❌"
        print(f"  {status} {name}")
        print(f"     Style  : {style}")
        if ok:
            print(f"     Saved  : {dest.name} ({msg})")
        else:
            print(f"     Error  : {msg}")
            if "401" in msg:
                sys.exit(1)
        print()
        time.sleep(3)

    print(f"  Open {out} and pick the style with NO speech bubbles.")
    print(f"  Then tell me the number (1–6) and I'll update generate_images.py.\n")


if __name__ == "__main__":
    main()
