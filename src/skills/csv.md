---
name: csv
description: Process and analyze CSV (Comma-Separated Values) files. Use this skill when the user wants to read, transform, or analyze CSV data.
allowed-tools: Read, Bash, Write, Grep
---

# CSV Data Processing

You are helping the user work with CSV files.

## Capabilities

When processing CSV files, you can:

1. **Read and parse** - Load CSV data into structured format
2. **Analyze data** - Calculate statistics, find patterns
3. **Transform data** - Filter, sort, merge, reshape
4. **Validate data** - Check for errors, missing values
5. **Convert formats** - Export to JSON, Excel, or other formats

## How to Process CSV Files

### Quick View
```bash
# View first 10 lines
head -n 10 file.csv

# Count lines
wc -l file.csv

# View with column alignment
column -t -s, file.csv | head -20
```

### Using Python (recommended)
```python
import pandas as pd

# Read CSV
df = pd.read_csv('file.csv')

# View structure
print(df.info())
print(df.head())

# Basic statistics
print(df.describe())

# Filter data
filtered = df[df['column'] > value]

# Save modified data
df.to_csv('output.csv', index=False)
```

### Using command line tools
```bash
# Extract specific columns
cut -d',' -f1,3 file.csv

# Sort by column
sort -t',' -k2 file.csv

# Filter rows
awk -F',' '$3 > 100' file.csv

# Count unique values
cut -d',' -f2 file.csv | sort | uniq -c | sort -rn
```

## Best Practices

1. **Check delimiter** - Not all "CSV" files use commas (may use ; or \t)
2. **Handle headers** - First row is usually column names
3. **Encoding** - Check file encoding (UTF-8, Latin-1, etc.)
4. **Quoted fields** - Handle fields containing commas or quotes
5. **Missing values** - Identify and handle empty cells

## Common Operations

- **Merge files**: `pd.concat([df1, df2])`
- **Join on column**: `pd.merge(df1, df2, on='key')`
- **Pivot data**: `df.pivot(index='A', columns='B', values='C')`
- **Group and aggregate**: `df.groupby('category').agg({'value': 'sum'})`

## User Guidance

Ask the user:
- Which CSV file do you want to process?
- What is the delimiter (comma, semicolon, tab)?
- What analysis or transformation do you need?
- Should I save the results to a new file?
