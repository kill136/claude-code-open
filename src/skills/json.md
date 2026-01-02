---
name: json
description: Process and analyze JSON files and data. Use this skill when the user wants to read, transform, query, or validate JSON content.
allowed-tools: Read, Bash, Write, Grep
---

# JSON Data Processing

You are helping the user work with JSON files and data.

## Capabilities

When processing JSON, you can:

1. **Read and parse** - Load and validate JSON structure
2. **Query data** - Extract specific values using paths
3. **Transform** - Reshape, filter, and modify JSON
4. **Validate** - Check JSON schema compliance
5. **Convert** - Transform to/from other formats

## How to Process JSON

### Quick View
```bash
# Pretty print JSON
cat file.json | python -m json.tool

# Or using jq (if available)
jq '.' file.json
```

### Using jq (command line)
```bash
# Extract a field
jq '.fieldName' file.json

# Filter array
jq '.items[] | select(.active == true)' file.json

# Get array length
jq '.items | length' file.json

# Transform structure
jq '{name: .title, count: .items | length}' file.json
```

### Using Python
```python
import json

# Read JSON
with open('file.json', 'r') as f:
    data = json.load(f)

# Pretty print
print(json.dumps(data, indent=2))

# Query nested data
value = data.get('key', {}).get('nested_key')

# Modify and save
data['new_field'] = 'value'
with open('output.json', 'w') as f:
    json.dump(data, f, indent=2)
```

### Using Node.js
```javascript
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('file.json', 'utf8'));
console.log(JSON.stringify(data, null, 2));
```

## Best Practices

1. **Validate first** - Check if JSON is valid before processing
2. **Handle encoding** - Use UTF-8 encoding
3. **Large files** - Stream large JSON files instead of loading entirely
4. **Nested data** - Use safe access patterns for nested properties
5. **Schema validation** - Consider JSON Schema for complex structures

## Common Operations

- **Merge objects**: `{...obj1, ...obj2}`
- **Filter arrays**: `arr.filter(item => condition)`
- **Map transform**: `arr.map(item => transform(item))`
- **Flatten nested**: Use recursive functions or libraries
- **Diff JSON**: Compare two JSON structures

## JSON Path Queries

Common path expressions:
- `$.store.book[0].title` - First book's title
- `$..author` - All authors at any level
- `$.store.book[?(@.price < 10)]` - Books under $10

## User Guidance

Ask the user:
- Which JSON file or data do you want to process?
- What specific fields or values do you need?
- What transformation should I apply?
- Should I validate against a schema?
