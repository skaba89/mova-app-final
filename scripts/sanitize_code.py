#!/usr/bin/env python3
"""Minimal sanitizer for PDF generation code - catches common forbidden Unicode patterns."""
import sys, re

FORBIDDEN_RANGES = [
    (0x2070, 0x209F),  # Superscripts and subscripts
    (0x2200, 0x22FF),  # Mathematical operators (keep basic ones)
    (0x25A0, 0x25FF),  # Geometric shapes
    (0x2600, 0x27BF),  # Miscellaneous Symbols
    (0x1F600, 0x1F64F),  # Emoticons
    (0x1F300, 0x1F5FF),  # Misc Symbols and Pictographs
    (0x1F680, 0x1F6FF),  # Transport and Map
    (0x1F1E0, 0x1F1FF),  # Flags
    (0x2702, 0x27B0),  # Dingbats
]

def is_forbidden(cp):
    for start, end in FORBIDDEN_RANGES:
        if start <= cp <= end:
            return True
    return False

def sanitize(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    for i, ch in enumerate(content):
        if is_forbidden(ord(ch)):
            line = content[:i].count('\n') + 1
            issues.append(f"Line {line}: forbidden char U+{ord(ch):04X} ({ch!r})")
    
    if issues:
        print(f"Found {len(issues)} forbidden character(s):")
        for issue in issues[:20]:
            print(f"  {issue}")
        if len(issues) > 20:
            print(f"  ... and {len(issues)-20} more")
        sys.exit(1)
    else:
        print("No forbidden characters found. Code is clean.")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python sanitize_code.py <file.py>")
        sys.exit(1)
    sanitize(sys.argv[1])
