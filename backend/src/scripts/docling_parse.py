#!/usr/bin/env python3
"""
docling_parse.py — Continuum Docling bridge

Called by Node.js as a subprocess:
  python3 docling_parse.py <file_path>

Outputs a single JSON object on stdout:
  { "markdown": "<extracted text>", "page_count": <int> }

Errors are written to stderr and exit with code 1.
"""

import sys
import json

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}), file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        from docling.document_converter import DocumentConverter
    except ImportError:
        print(
            json.dumps({
                "error": (
                    "Docling is not installed. "
                    "Run: pip install docling"
                )
            }),
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        converter = DocumentConverter()
        result = converter.convert(file_path)
        doc = result.document

        markdown_text = doc.export_to_markdown()

        # Count pages if the backend document exposes them
        page_count = 1
        if hasattr(doc, "pages") and doc.pages:
            page_count = len(doc.pages)

        output = {
            "markdown": markdown_text,
            "page_count": page_count,
        }
        print(json.dumps(output))

    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
