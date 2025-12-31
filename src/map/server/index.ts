/**
 * 可视化 Web 服务器
 * 提供代码本体图谱的交互式可视化
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { CodeOntology } from '../types.js';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// VisualizationServer 类
// ============================================================================

export class VisualizationServer {
  private server: http.Server | null = null;
  private ontologyPath: string;
  private port: number;
  private staticDir: string;

  constructor(ontologyPath: string, port: number = 3030) {
    this.ontologyPath = ontologyPath;
    this.port = port;
    this.staticDir = path.join(__dirname, 'static');
  }

  /**
   * 启动服务器
   */
  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, () => {
        const url = `http://localhost:${this.port}`;
        resolve(url);
      });
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 处理请求
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const pathname = url.pathname;

    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // API 路由
    if (pathname.startsWith('/api/')) {
      this.handleApiRequest(pathname, url, res);
      return;
    }

    // 静态文件
    this.handleStaticRequest(pathname, res);
  }

  /**
   * 处理 API 请求
   */
  private handleApiRequest(
    pathname: string,
    url: URL,
    res: http.ServerResponse
  ): void {
    try {
      if (pathname === '/api/ontology') {
        // 返回完整的本体数据
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const ontology: CodeOntology = JSON.parse(content);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ontology));
        return;
      }

      if (pathname.startsWith('/api/module/')) {
        // 返回单个模块
        const moduleId = decodeURIComponent(pathname.slice('/api/module/'.length));
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const ontology: CodeOntology = JSON.parse(content);

        const module = ontology.modules.find((m) => m.id === moduleId);

        if (module) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(module));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Module not found' }));
        }
        return;
      }

      if (pathname === '/api/search') {
        // 搜索
        const query = url.searchParams.get('q') || '';
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const ontology: CodeOntology = JSON.parse(content);

        const results = this.search(ontology, query);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
        return;
      }

      if (pathname === '/api/stats') {
        // 统计信息
        const content = fs.readFileSync(this.ontologyPath, 'utf-8');
        const ontology: CodeOntology = JSON.parse(content);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ontology.statistics));
        return;
      }

      // 未知 API
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API not found' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  }

  /**
   * 处理静态文件请求
   */
  private handleStaticRequest(
    pathname: string,
    res: http.ServerResponse
  ): void {
    // 默认请求返回 index.html
    if (pathname === '/' || pathname === '/index.html') {
      this.serveFile('index.html', res);
      return;
    }

    // 其他静态文件
    const fileName = pathname.slice(1);
    this.serveFile(fileName, res);
  }

  /**
   * 提供静态文件
   */
  private serveFile(fileName: string, res: http.ServerResponse): void {
    const filePath = path.join(this.staticDir, fileName);

    // 安全检查：防止路径遍历
    if (!filePath.startsWith(this.staticDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    try {
      if (!fs.existsSync(filePath)) {
        // 文件不存在，返回内嵌的 HTML
        if (fileName === 'index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getEmbeddedHtml());
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const content = fs.readFileSync(filePath);
      const contentType = this.getContentType(fileName);

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  /**
   * 获取文件的 Content-Type
   */
  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();

    const types: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };

    return types[ext] || 'application/octet-stream';
  }

  /**
   * 搜索功能
   */
  private search(ontology: CodeOntology, query: string): any[] {
    const results: any[] = [];
    const lowerQuery = query.toLowerCase();

    if (!lowerQuery) {
      return results;
    }

    for (const module of ontology.modules) {
      // 搜索模块名
      if (module.name.toLowerCase().includes(lowerQuery) ||
          module.id.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'module',
          id: module.id,
          name: module.name,
          path: module.path,
        });
      }

      // 搜索类
      for (const cls of module.classes) {
        if (cls.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'class',
            id: cls.id,
            name: cls.name,
            moduleId: module.id,
          });
        }
      }

      // 搜索函数
      for (const func of module.functions) {
        if (func.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'function',
            id: func.id,
            name: func.name,
            moduleId: module.id,
          });
        }
      }

      // 搜索接口
      for (const iface of module.interfaces) {
        if (iface.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'interface',
            id: iface.id,
            name: iface.name,
            moduleId: module.id,
          });
        }
      }
    }

    // 限制结果数量
    return results.slice(0, 50);
  }

  /**
   * 内嵌的 HTML 页面
   */
  private getEmbeddedHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Ontology Map</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #16213e;
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      border-bottom: 1px solid #0f3460;
    }
    header h1 { font-size: 1.2rem; color: #e94560; }
    .search-box {
      flex: 1;
      max-width: 400px;
    }
    .search-box input {
      width: 100%;
      padding: 0.5rem 1rem;
      border: 1px solid #0f3460;
      border-radius: 4px;
      background: #1a1a2e;
      color: #eee;
      font-size: 0.9rem;
    }
    .search-box input:focus {
      outline: none;
      border-color: #e94560;
    }
    .controls {
      display: flex;
      gap: 0.5rem;
    }
    .controls button {
      padding: 0.5rem 1rem;
      border: 1px solid #0f3460;
      border-radius: 4px;
      background: #16213e;
      color: #eee;
      cursor: pointer;
    }
    .controls button:hover { background: #0f3460; }
    .controls select {
      padding: 0.5rem;
      border: 1px solid #0f3460;
      border-radius: 4px;
      background: #16213e;
      color: #eee;
    }
    main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    #sidebar {
      width: 280px;
      background: #16213e;
      border-right: 1px solid #0f3460;
      overflow-y: auto;
      padding: 1rem;
    }
    #sidebar h2 {
      font-size: 0.9rem;
      color: #e94560;
      margin-bottom: 0.5rem;
    }
    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 0.3rem 0;
      border-bottom: 1px solid #0f3460;
      font-size: 0.85rem;
    }
    .stat-value { color: #e94560; font-weight: bold; }
    .module-list {
      margin-top: 1rem;
    }
    .module-item {
      padding: 0.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .module-item:hover { background: #0f3460; }
    #graph-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    #graph-container svg {
      width: 100%;
      height: 100%;
    }
    .node { cursor: pointer; }
    .node circle {
      stroke: #0f3460;
      stroke-width: 2px;
    }
    .node.module circle { fill: #e94560; }
    .node.class circle { fill: #0f3460; }
    .node.function circle { fill: #16213e; }
    .node.interface circle { fill: #533483; }
    .node text {
      font-size: 10px;
      fill: #eee;
    }
    .link {
      stroke: #0f3460;
      stroke-opacity: 0.6;
      fill: none;
    }
    .link.dependency { stroke: #e94560; }
    .link.call { stroke: #533483; }
    #details-panel {
      width: 300px;
      background: #16213e;
      border-left: 1px solid #0f3460;
      padding: 1rem;
      overflow-y: auto;
      display: none;
    }
    #details-panel.active { display: block; }
    #details-panel h2 {
      font-size: 1rem;
      color: #e94560;
      margin-bottom: 1rem;
    }
    #details-panel .info-item {
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
    }
    #details-panel .info-label { color: #888; }
    #details-panel .info-value { color: #eee; }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 1.2rem;
      color: #e94560;
    }
    #search-results {
      position: absolute;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #16213e;
      border: 1px solid #0f3460;
      border-radius: 4px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 100;
      display: none;
      min-width: 300px;
    }
    #search-results.active { display: block; }
    .search-result-item {
      padding: 0.5rem 1rem;
      cursor: pointer;
      border-bottom: 1px solid #0f3460;
      font-size: 0.85rem;
    }
    .search-result-item:hover { background: #0f3460; }
    .search-result-type {
      display: inline-block;
      padding: 0.1rem 0.3rem;
      border-radius: 2px;
      font-size: 0.7rem;
      margin-right: 0.5rem;
    }
    .search-result-type.module { background: #e94560; }
    .search-result-type.class { background: #0f3460; border: 1px solid #e94560; }
    .search-result-type.function { background: #16213e; border: 1px solid #e94560; }
    .search-result-type.interface { background: #533483; }
  </style>
</head>
<body>
  <header>
    <h1>📊 Code Ontology Map</h1>
    <div class="search-box">
      <input type="text" id="search" placeholder="Search modules, classes, functions...">
    </div>
    <div class="controls">
      <button id="zoom-in">+</button>
      <button id="zoom-out">-</button>
      <button id="reset">Reset</button>
      <select id="view-mode">
        <option value="dependency">Dependency Graph</option>
        <option value="module">Module Tree</option>
      </select>
    </div>
  </header>

  <main>
    <aside id="sidebar">
      <h2>Statistics</h2>
      <div id="stats"></div>
      <div class="module-list">
        <h2>Modules</h2>
        <div id="module-list"></div>
      </div>
    </aside>

    <section id="graph-container">
      <div class="loading">Loading...</div>
      <svg id="graph"></svg>
    </section>

    <aside id="details-panel">
      <h2>Details</h2>
      <div id="node-details"></div>
    </aside>
  </main>

  <div id="search-results"></div>

  <script>
    // 状态
    let ontology = null;
    let simulation = null;
    let svg, g, zoom;

    // 加载数据
    async function loadOntology() {
      try {
        const response = await fetch('/api/ontology');
        ontology = await response.json();
        renderStats();
        renderModuleList();
        renderGraph();
        document.querySelector('.loading').style.display = 'none';
      } catch (error) {
        document.querySelector('.loading').textContent = 'Failed to load data: ' + error.message;
      }
    }

    // 渲染统计信息
    function renderStats() {
      const stats = ontology.statistics;
      const html = [
        { label: 'Modules', value: stats.totalModules },
        { label: 'Classes', value: stats.totalClasses },
        { label: 'Interfaces', value: stats.totalInterfaces },
        { label: 'Functions', value: stats.totalFunctions },
        { label: 'Methods', value: stats.totalMethods },
        { label: 'Lines', value: stats.totalLines.toLocaleString() },
        { label: 'Dependencies', value: stats.totalDependencyEdges },
      ].map(item =>
        '<div class="stat-item"><span>' + item.label + '</span><span class="stat-value">' + item.value + '</span></div>'
      ).join('');

      document.getElementById('stats').innerHTML = html;
    }

    // 渲染模块列表
    function renderModuleList() {
      const html = ontology.modules
        .slice(0, 50)
        .map(m => '<div class="module-item" data-id="' + m.id + '" title="' + m.id + '">' + m.name + '</div>')
        .join('');

      document.getElementById('module-list').innerHTML = html;

      // 添加点击事件
      document.querySelectorAll('.module-item').forEach(item => {
        item.addEventListener('click', () => {
          const moduleId = item.dataset.id;
          showModuleDetails(moduleId);
        });
      });
    }

    // 渲染图形
    function renderGraph() {
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      // 添加缩放
      zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);

      g = svg.append('g');

      // 准备数据
      const nodes = [];
      const links = [];
      const nodeMap = new Map();

      // 只显示前 100 个模块
      const displayModules = ontology.modules.slice(0, 100);

      displayModules.forEach(m => {
        const node = { id: m.id, name: m.name, type: 'module', data: m };
        nodes.push(node);
        nodeMap.set(m.id, node);
      });

      // 添加依赖边
      ontology.dependencyGraph.edges.forEach(edge => {
        if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
          links.push({
            source: edge.source,
            target: edge.target,
            type: 'dependency',
          });
        }
      });

      // 创建力导向图
      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));

      // 绘制边
      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('class', d => 'link ' + d.type)
        .attr('stroke-width', 1);

      // 绘制节点
      const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('class', d => 'node ' + d.type)
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      node.append('circle')
        .attr('r', 8);

      node.append('text')
        .attr('dx', 12)
        .attr('dy', 4)
        .text(d => d.name.length > 20 ? d.name.slice(0, 20) + '...' : d.name);

      // 点击事件
      node.on('click', (event, d) => {
        showModuleDetails(d.id);
      });

      // 更新位置
      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
      });
    }

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // 显示模块详情
    function showModuleDetails(moduleId) {
      const module = ontology.modules.find(m => m.id === moduleId);
      if (!module) return;

      const panel = document.getElementById('details-panel');
      panel.classList.add('active');

      const html = [
        '<div class="info-item"><span class="info-label">Name:</span> <span class="info-value">' + module.name + '</span></div>',
        '<div class="info-item"><span class="info-label">Path:</span> <span class="info-value">' + module.id + '</span></div>',
        '<div class="info-item"><span class="info-label">Language:</span> <span class="info-value">' + module.language + '</span></div>',
        '<div class="info-item"><span class="info-label">Lines:</span> <span class="info-value">' + module.lines + '</span></div>',
        '<div class="info-item"><span class="info-label">Classes:</span> <span class="info-value">' + module.classes.length + '</span></div>',
        '<div class="info-item"><span class="info-label">Functions:</span> <span class="info-value">' + module.functions.length + '</span></div>',
        '<div class="info-item"><span class="info-label">Imports:</span> <span class="info-value">' + module.imports.length + '</span></div>',
      ].join('');

      document.getElementById('node-details').innerHTML = html;
    }

    // 搜索功能
    let searchTimeout;
    document.getElementById('search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();

      if (query.length < 2) {
        document.getElementById('search-results').classList.remove('active');
        return;
      }

      searchTimeout = setTimeout(async () => {
        try {
          const response = await fetch('/api/search?q=' + encodeURIComponent(query));
          const results = await response.json();

          const html = results.map(r =>
            '<div class="search-result-item" data-id="' + r.id + '" data-type="' + r.type + '">' +
            '<span class="search-result-type ' + r.type + '">' + r.type + '</span>' +
            r.name +
            '</div>'
          ).join('');

          const resultsEl = document.getElementById('search-results');
          resultsEl.innerHTML = html || '<div class="search-result-item">No results</div>';
          resultsEl.classList.add('active');

          resultsEl.querySelectorAll('.search-result-item[data-id]').forEach(item => {
            item.addEventListener('click', () => {
              if (item.dataset.type === 'module') {
                showModuleDetails(item.dataset.id);
              }
              resultsEl.classList.remove('active');
              document.getElementById('search').value = '';
            });
          });
        } catch (error) {
          console.error('Search error:', error);
        }
      }, 300);
    });

    // 点击其他地方关闭搜索结果
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#search-results') && !e.target.closest('.search-box')) {
        document.getElementById('search-results').classList.remove('active');
      }
    });

    // 缩放控制
    document.getElementById('zoom-in').addEventListener('click', () => {
      svg.transition().call(zoom.scaleBy, 1.3);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
      svg.transition().call(zoom.scaleBy, 0.7);
    });

    document.getElementById('reset').addEventListener('click', () => {
      svg.transition().call(zoom.transform, d3.zoomIdentity);
    });

    // 初始化
    loadOntology();
  </script>
</body>
</html>`;
  }
}

/**
 * 便捷函数：创建服务器
 */
export function createServer(
  ontologyPath: string,
  port: number = 3030
): VisualizationServer {
  return new VisualizationServer(ontologyPath, port);
}
