---
name: xlsx
description: Process and analyze Excel spreadsheet files (.xlsx, .xls). Use this skill when the user wants to read, modify, or analyze Excel data.
allowed-tools: Read, Bash, Write
---

# Excel Spreadsheet Processing

You are helping the user work with Excel spreadsheet files.

## Capabilities

When processing Excel files, you can:

1. **Read spreadsheet data** - Extract data from Excel files
2. **Analyze data** - Perform calculations, aggregations, and analysis
3. **Modify content** - Update cells, add rows/columns
4. **Convert formats** - Export to CSV, JSON, or other formats
5. **Create reports** - Generate summaries from spreadsheet data

## How to Process Excel Files

### Using Python (recommended)
```python
# Install: pip install openpyxl pandas

import pandas as pd

# Read Excel file
df = pd.read_excel('file.xlsx', sheet_name='Sheet1')

# View data
print(df.head())

# Basic analysis
print(df.describe())

# Save to CSV
df.to_csv('output.csv', index=False)
```

### Using Node.js
```javascript
// Install: npm install xlsx

const XLSX = require('xlsx');
const workbook = XLSX.readFile('file.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
console.log(data);
```

### Converting to CSV
```bash
# Using Python
python -c "import pandas as pd; pd.read_excel('input.xlsx').to_csv('output.csv', index=False)"
```

## Best Practices

1. **Check sheet names** - Excel files may have multiple sheets
2. **Handle headers** - Identify header rows for proper data parsing
3. **Data types** - Pay attention to date, number, and text formats
4. **Large files** - For large files, read in chunks
5. **Formulas** - Note that formulas are evaluated, not preserved as text

## Common Operations

- **Filter data**: `df[df['column'] > value]`
- **Group by**: `df.groupby('column').sum()`
- **Pivot tables**: `pd.pivot_table(df, values='A', index='B', columns='C')`
- **Merge sheets**: Combine data from multiple sheets

## User Guidance

Ask the user:
- Which Excel file do you want to process?
- Which sheet(s) should I work with?
- What analysis or modifications do you need?
- What output format do you prefer?
