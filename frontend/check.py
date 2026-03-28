import re

found = False
with open("src/pages/OfferEditor.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if "<Grid item" in line or "<Grid " in line:
            print(f"{i+1}: {line.strip()}")
            found = True
if not found:
    print("No Grid tags found!")
