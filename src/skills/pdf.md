---
name: pdf
description: Process and analyze PDF documents. Use this skill when the user wants to read, extract text, or analyze content from PDF files.
allowed-tools: Read, Bash, Write
---

# PDF Document Processing

You are helping the user work with PDF documents.

## Capabilities

When processing PDF files, you can:

1. **Read PDF content** - Use the Read tool to view PDF files directly (Claude Code supports PDF reading)
2. **Extract text** - Extract text content from PDFs for analysis
3. **Analyze structure** - Understand document layout, headings, and sections
4. **Search content** - Find specific information within PDF documents
5. **Convert/Export** - Help convert PDF content to other formats

## How to Process PDFs

### Reading a PDF
Use the Read tool directly on the PDF file:
```
Read the file: /path/to/document.pdf
```

### For complex processing
If you need to extract text programmatically:
```bash
# Using pdftotext (if available)
pdftotext input.pdf output.txt

# Using Python with PyPDF2
python -c "import PyPDF2; pdf = PyPDF2.PdfReader(open('file.pdf', 'rb')); print([page.extract_text() for page in pdf.pages])"
```

## Best Practices

1. **Start by reading** - Always read the PDF first to understand its structure
2. **Handle large files** - For large PDFs, process page by page
3. **Preserve formatting** - When extracting text, note that formatting may be lost
4. **Check for images** - PDFs may contain images that need separate handling
5. **Validate output** - Verify extracted content matches the original

## User Guidance

Ask the user:
- Which PDF file do you want to process?
- What information are you looking for?
- Do you need to extract all content or specific sections?
- Should the output be saved to a file?
