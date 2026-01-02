---
name: html
description: Process and analyze HTML documents. Use this skill when the user wants to parse, extract data from, or modify HTML content.
allowed-tools: Read, Bash, Write, WebFetch
---

# HTML Document Processing

You are helping the user work with HTML documents.

## Capabilities

When processing HTML, you can:

1. **Parse HTML** - Extract structured content from HTML
2. **Query elements** - Find elements using CSS selectors or XPath
3. **Extract data** - Scrape text, links, images, tables
4. **Modify content** - Update HTML structure and content
5. **Validate** - Check HTML syntax and structure

## How to Process HTML

### Using Python (BeautifulSoup)
```python
from bs4 import BeautifulSoup

# Parse HTML
with open('page.html', 'r') as f:
    soup = BeautifulSoup(f, 'html.parser')

# Find elements
title = soup.find('title').text
links = [a['href'] for a in soup.find_all('a', href=True)]
paragraphs = [p.text for p in soup.find_all('p')]

# CSS selectors
items = soup.select('div.item > span.name')

# Extract table data
table = soup.find('table')
rows = [[td.text for td in tr.find_all('td')] for tr in table.find_all('tr')]
```

### Using command line
```bash
# Extract all links
grep -oP 'href="\K[^"]+' file.html

# Extract text content (basic)
sed 's/<[^>]*>//g' file.html

# Using xmllint for well-formed HTML/XML
xmllint --html --xpath "//title/text()" file.html 2>/dev/null
```

### Using Node.js (cheerio)
```javascript
const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('page.html', 'utf8');
const $ = cheerio.load(html);

// Query elements
const title = $('title').text();
const links = $('a').map((i, el) => $(el).attr('href')).get();
```

## Best Practices

1. **Handle encoding** - Check document charset
2. **Robust selectors** - Use specific selectors that won't break with minor changes
3. **Error handling** - Handle missing elements gracefully
4. **Respect robots.txt** - When scraping websites
5. **Clean output** - Strip whitespace from extracted text

## Common Operations

- **Extract all links**: `soup.find_all('a', href=True)`
- **Extract images**: `soup.find_all('img', src=True)`
- **Get meta tags**: `soup.find('meta', {'name': 'description'})`
- **Parse tables**: Convert HTML tables to structured data
- **Clean HTML**: Remove scripts, styles, and unwanted elements

## CSS Selectors Quick Reference

- `tag` - Element by tag name
- `.class` - Element by class
- `#id` - Element by ID
- `parent > child` - Direct child
- `ancestor descendant` - Any descendant
- `[attr=value]` - Attribute selector

## User Guidance

Ask the user:
- Which HTML file or URL do you want to process?
- What content do you need to extract?
- Should I modify the HTML or just extract data?
- What output format do you prefer?
