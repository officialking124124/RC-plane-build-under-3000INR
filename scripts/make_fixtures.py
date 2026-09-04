#!/usr/bin/env python3
"""Generates the JPEG fixtures used by the EXIF test and manual browser QA."""
import os
import sys

try:
    from PIL import Image, ImageDraw
    import piexif
except ImportError:
    print("pillow/piexif unavailable - skipping fixtures", file=sys.stderr)
    sys.exit(0)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fixtures")
os.makedirs(OUT, exist_ok=True)


def scene(path):
    img = Image.new("RGB", (640, 480), (24, 30, 48))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 640, 300], fill=(58, 74, 110))
    d.rectangle([0, 300, 640, 480], fill=(28, 34, 52))
    d.polygon([(280, 300), (320, 90), (360, 300)], fill=(120, 128, 150))
    d.rectangle([40, 240, 130, 300], fill=(70, 80, 104))
    d.rectangle([510, 260, 610, 300], fill=(70, 80, 104))
    d.text((12, 12), "FIXTURE SCENE", fill=(230, 235, 245))
    img.save(path, "JPEG", quality=88)


# 48.8584 N, 2.2945 E (Eiffel Tower) as DMS EXIF GPS, plus capture timestamps.
gps = {
    1: b"N",
    2: ((48, 1), (51, 1), (3024, 100)),
    3: b"E",
    4: ((2, 1), (17, 1), (4020, 100)),
    5: 0,
    6: (33, 1),
}
exif = {"GPS": gps, "Exif": {36867: "2024:06:01 14:22:05", 36868: "2024:06:01 14:22:05"}}
exif_bytes = piexif.dump(exif)

no_exif = os.path.join(OUT, "no-exif.jpg")
scene(no_exif)
print("wrote:", no_exif)

has_exif = os.path.join(OUT, "has-exif.jpg")
scene(has_exif)
# piexif.insert splices the APP1 segment into the file directly; Pillow's save-time
# exif kwarg has proven unreliable across versions.
piexif.insert(exif_bytes, has_exif)

loaded = piexif.load(has_exif)
if not (loaded.get("GPS") and 2 in loaded["GPS"] and 4 in loaded["GPS"]):
    print("FATAL: EXIF GPS not embedded into fixture", file=sys.stderr)
    sys.exit(1)
print("wrote:", has_exif, "(EXIF GPS verified)")
