/**
 * 语法高亮示例
 * 展示各种编程语言的语法高亮效果
 */

import {
  highlightCode,
  highlightJSON,
  highlightBlock,
  smartHighlight,
  detectLanguageFromFilename,
} from './syntaxHighlight.js';

// TypeScript 示例
const typescriptCode = `
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  const user = await response.json();
  return user;
}
`;

// Python 示例
const pythonCode = `
def fibonacci(n):
    """计算斐波那契数列"""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# 测试
for i in range(10):
    print(f"fibonacci({i}) = {fibonacci(i)}")
`;

// Go 示例
const goCode = `
package main

import (
    "fmt"
    "net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello, %s!", r.URL.Path[1:])
}

func main() {
    http.HandleFunc("/", handler)
    http.ListenAndServe(":8080", nil)
}
`;

// Rust 示例
const rustCode = `
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];

    let sum: i32 = numbers.iter().sum();
    let product: i32 = numbers.iter().product();

    println!("Sum: {}", sum);
    println!("Product: {}", product);
}
`;

// JSON 示例
const jsonData = {
  name: 'Claude Code',
  version: '2.0.76',
  features: ['syntax-highlighting', 'code-analysis', 'file-operations'],
  config: {
    theme: 'dark',
    lineNumbers: true,
  },
};

// 展示各种语言的高亮效果
export function showSyntaxHighlightExamples() {
  console.log('\n=== TypeScript 语法高亮 ===');
  console.log(highlightCode(typescriptCode, { language: 'typescript' }));

  console.log('\n=== Python 语法高亮 ===');
  console.log(highlightCode(pythonCode, { language: 'python' }));

  console.log('\n=== Go 语法高亮 ===');
  console.log(highlightCode(goCode, { language: 'go' }));

  console.log('\n=== Rust 语法高亮 ===');
  console.log(highlightCode(rustCode, { language: 'rust' }));

  console.log('\n=== JSON 语法高亮 ===');
  console.log(highlightJSON(jsonData));

  console.log('\n=== 带行号的代码块 ===');
  console.log(highlightBlock(typescriptCode, 'typescript'));

  console.log('\n=== 智能检测语言 ===');
  console.log('检测 main.ts:', detectLanguageFromFilename('main.ts'));
  console.log('检测 app.py:', detectLanguageFromFilename('app.py'));
  console.log('检测 server.go:', detectLanguageFromFilename('server.go'));
  console.log('检测 lib.rs:', detectLanguageFromFilename('lib.rs'));

  console.log('\n=== 智能高亮（自动检测） ===');
  console.log(smartHighlight(pythonCode, 'test.py'));
}

// 如果直接运行此文件，显示示例
if (import.meta.url === `file://${process.argv[1]}`) {
  showSyntaxHighlightExamples();
}
