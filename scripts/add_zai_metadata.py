#!/usr/bin/env python3
"""Add Z.ai metadata to a PDF file."""
import sys, os
from pypdf import PdfReader, PdfWriter

def add_metadata(filepath, title=None, quiet=False):
    if not os.path.exists(filepath):
        print(f"Error: {filepath} not found")
        sys.exit(1)
    
    reader = PdfReader(filepath)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    
    if title is None:
        title = os.path.splitext(os.path.basename(filepath))[0]
    
    writer.add_metadata({
        '/Title': title,
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': title,
    })
    
    with open(filepath, 'wb') as f:
        writer.write(f)
    
    if not quiet:
        print(f"Metadata added: {filepath}")
        print(f"  Title:   {title}")
        print(f"  Author:  Z.ai")
        print(f"  Creator: Z.ai")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('files', nargs='+')
    parser.add_argument('-t', '--title', default=None)
    parser.add_argument('-q', '--quiet', action='store_true')
    args = parser.parse_args()
    
    for f in args.files:
        add_metadata(f, title=args.title, quiet=args.quiet)
