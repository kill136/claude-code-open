    // 状态
    let ontology = null;
    let archData = null;
    let flowchartData = null;
    let scenarios = [];
    let simulation = null;
    let svg, g, zoom;
    let currentView = 'story'; // 默认使用业务故事视图
    let entryPoints = [];

    // 下钻导航状态
    let drillStack = []; // 导航历史栈 [{type: 'arch'|'block'|'file'|'symbol', data: any}]
    let currentDrillLevel = null; // 当前下钻层级

    // 更新面包屑导航
    function updateBreadcrumb() {
      const breadcrumb = document.getElementById('breadcrumb');
      const backBtn = document.getElementById('back-btn');

      if (drillStack.length === 0) {
        breadcrumb.classList.remove('active');
        backBtn.classList.remove('active');
        return;
      }

      breadcrumb.classList.add('active');
      backBtn.classList.add('active');

      let html = '<span class="breadcrumb-item" onclick="goToLevel(-1)">架构概览</span>';

      drillStack.forEach((item, index) => {
        html += '<span class="breadcrumb-separator">›</span>';
        if (index === drillStack.length - 1) {
          html += '<span class="breadcrumb-current">' + item.name + '</span>';
        } else {
          html += '<span class="breadcrumb-item" onclick="goToLevel(' + index + ')">' + item.name + '</span>';
        }
      });

      breadcrumb.innerHTML = html;
    }

    // 跳转到指定层级
    function goToLevel(index) {
      if (index === -1) {
        // 返回架构概览
        drillStack = [];
        currentDrillLevel = null;
        hideAllIndicators();
        renderArchitecture();
        updateBreadcrumb();
        return;
      }

      // 截断栈到指定位置
      drillStack = drillStack.slice(0, index + 1);
      const target = drillStack[index];

      if (target.type === 'block') {
        renderBlockFiles(target.data);
      } else if (target.type === 'file') {
        renderFileSymbols(target.data);
      }

      updateBreadcrumb();
    }

    // 返回上一级
    function goBack() {
      if (drillStack.length === 0) return;

      drillStack.pop();
      if (drillStack.length === 0) {
        goToLevel(-1);
      } else {
        goToLevel(drillStack.length - 1);
      }
    }

    // 加载数据
    async function loadOntology() {
      try {
        const response = await fetch('/api/ontology');
        ontology = await response.json();
        renderStats();
        renderModuleList();

        // 加载入口点和场景
        if (ontology.isEnhanced) {
          loadEntryPoints();
          loadScenarios();
          // 默认显示业务故事视图
          renderStoryView();
        } else {
          renderGraph();
        }
        document.querySelector('.loading').style.display = 'none';
      } catch (error) {
        document.querySelector('.loading').textContent = '加载失败: ' + error.message;
      }
    }

    // 加载入口点
    async function loadEntryPoints() {
      try {
        const response = await fetch('/api/entry-points');
        const data = await response.json();
        entryPoints = data.entryPoints || [];

        const select = document.getElementById('entry-point');
        select.innerHTML = entryPoints.map(ep =>
          '<option value="' + ep + '">' + ep + '</option>'
        ).join('');
      } catch (error) {
        console.error('Failed to load entry points:', error);
      }
    }

    // 加载场景列表
    async function loadScenarios() {
      try {
        const response = await fetch('/api/scenarios');
        const data = await response.json();
        scenarios = data.scenarios || [];

        const select = document.getElementById('scenario-select');
        select.innerHTML = scenarios.map(s =>
          '<option value="' + s.id + '" data-entry="' + (s.entryPoints[0] || '') + '">' + s.name + '</option>'
        ).join('');

        // 场景切换时重新渲染流程图
        select.addEventListener('change', () => {
          renderFlowchart();
        });
      } catch (error) {
        console.error('Failed to load scenarios:', error);
      }
    }

    // 渲染新手导览
    async function renderBeginnerGuide() {
      hideAllIndicators();
      hideAllViews();
      document.getElementById('beginner-view').classList.add('active');

      try {
        const response = await fetch('/api/beginner-guide');
        const guide = await response.json();

        // 渲染项目介绍
        const introHtml = `
          <h1>${guide.projectName}</h1>
          <div class="tagline">${guide.tagline}</div>
          <div class="summary">${guide.summary}</div>
        `;
        document.getElementById('beginner-intro').innerHTML = introHtml;

        // 渲染卡片
        const cardsHtml = guide.cards.map(card => `
          <div class="module-card" data-id="${card.id}" onclick="toggleCard(this)">
            <span class="card-badge ${card.badge}">${getBadgeLabel(card.badge)}</span>
            <div class="card-icon">${card.icon}</div>
            <div class="card-title">${card.title}</div>
            <div class="card-subtitle">${card.subtitle}</div>
            <div class="card-explain">${card.explain}</div>
            <div class="card-analogy">💡 ${card.analogy}</div>
            <div class="card-files">
              ${card.files.map(f => '<span>' + f + '</span>').join('')}
            </div>
            <div class="expand-details">
              <h4>📌 关键函数</h4>
              ${card.keyFunctions.length > 0 ? card.keyFunctions.map(fn => `
                <div class="key-function">
                  <div class="func-name">${fn.name}()</div>
                  <div class="func-desc">${truncateText(fn.desc, 80)}</div>
                </div>
              `).join('') : '<div style="color:#888;font-size:0.85rem">点击其他视图查看详细函数</div>'}
            </div>
          </div>
        `).join('');

        document.getElementById('module-cards').innerHTML = cardsHtml;
      } catch (error) {
        console.error('Failed to load beginner guide:', error);
        document.getElementById('beginner-intro').innerHTML = '<h1>加载失败</h1><p>' + error.message + '</p>';
      }
    }

    function getBadgeLabel(badge) {
      const labels = {
        core: '核心',
        tool: '工具',
        util: '辅助',
        ui: '界面'
      };
      return labels[badge] || badge;
    }

    function truncateText(text, maxLen) {
      if (!text) return '';
      return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    }

    function toggleCard(card) {
      card.classList.toggle('expanded');
    }

    function hideAllViews() {
      document.getElementById('beginner-view').classList.remove('active');
      document.getElementById('story-view').classList.remove('active');
      document.getElementById('reading-view').classList.remove('active');
      document.getElementById('sidebar').style.display = 'none';
      document.getElementById('graph-container').style.display = 'none';
    }

    // ========================================
    // 业务故事视图
    // ========================================
    let storyData = null;
    let currentStory = null;

    async function renderStoryView() {
      hideAllIndicators();
      hideAllViews();
      document.getElementById('story-view').classList.add('active');

      try {
        const response = await fetch('/api/story-guide');
        storyData = await response.json();

        // 渲染头部
        const headerHtml = `
          <h1>📖 ${storyData.projectName}</h1>
          <p>${storyData.projectDescription}</p>
        `;
        document.getElementById('story-header').innerHTML = headerHtml;

        // 渲染故事卡片列表
        const listHtml = storyData.stories.map((story, index) => `
          <div class="story-card ${index === 0 ? 'active' : ''}" data-id="${story.id}" onclick="selectStory('${story.id}')">
            <div class="story-icon">${story.icon}</div>
            <h3>${story.title}</h3>
            <p>${story.description}</p>
          </div>
        `).join('');
        document.getElementById('story-list').innerHTML = listHtml;

        // 默认显示第一个故事
        if (storyData.stories.length > 0) {
          showStoryDetail(storyData.stories[0]);
        }
      } catch (error) {
        console.error('Failed to load story guide:', error);
        document.getElementById('story-header').innerHTML = '<h1>加载失败</h1><p>' + error.message + '</p>';
      }
    }

    function selectStory(storyId) {
      // 更新卡片样式
      document.querySelectorAll('.story-card').forEach(card => {
        card.classList.toggle('active', card.dataset.id === storyId);
      });

      // 找到并显示故事
      const story = storyData.stories.find(s => s.id === storyId);
      if (story) {
        showStoryDetail(story);
      }
    }

    function showStoryDetail(story) {
      currentStory = story;

      const stepsHtml = story.steps.map((step, index) => `
        <div class="story-step" data-module="${step.moduleId}" onclick="jumpToCode('${step.moduleId}', ${step.lineRange ? step.lineRange.start : 1}, ${step.lineRange ? step.lineRange.end : 50})">
          <h4>${index + 1}. ${step.title}</h4>
          <div class="step-story">${step.story}</div>
          <div class="step-technical">${step.technical}</div>
          <div class="step-code-link">📄 查看代码: ${step.moduleId}</div>
        </div>
      `).join('');

      const takeawaysHtml = story.keyTakeaways.length > 0 ? `
        <div class="story-takeaways">
          <h4>💡 核心要点</h4>
          <ul>
            ${story.keyTakeaways.map(t => '<li>' + t + '</li>').join('')}
          </ul>
        </div>
      ` : '';

      const relatedHtml = story.relatedStories.length > 0 ? `
        <div style="margin-top:1.5rem; color:#888;">
          相关故事: ${story.relatedStories.map(id => {
            const related = storyData.stories.find(s => s.id === id);
            return related ? '<a href="javascript:selectStory(\'' + id + '\')" style="color:#4ecdc4">' + related.title + '</a>' : '';
          }).filter(Boolean).join(' | ')}
        </div>
      ` : '';

      const detailHtml = `
        <h2>${story.icon} ${story.title}</h2>
        <div class="story-steps">
          ${stepsHtml}
        </div>
        ${takeawaysHtml}
        ${relatedHtml}
      `;

      document.getElementById('story-detail').innerHTML = detailHtml;
      document.getElementById('story-detail').classList.remove('hidden');
    }

    // ========================================
    // Monaco Editor 代码预览功能
    // ========================================
    let monacoEditor = null;
    let monacoLoaded = false;
    let monacoLoading = false;
    let currentDecorations = [];
    let currentModuleId = null;
    let editorOptions = {
      minimap: true,
      wordWrap: false
    };

    // 初始化 Monaco Editor
    async function initMonaco() {
      if (monacoLoaded) return Promise.resolve();
      if (monacoLoading) {
        return new Promise((resolve) => {
          const check = setInterval(() => {
            if (monacoLoaded) {
              clearInterval(check);
              resolve();
            }
          }, 100);
        });
      }

      monacoLoading = true;
      return new Promise((resolve, reject) => {
        require.config({
          paths: {
            'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'
          }
        });

        require(['vs/editor/editor.main'], function() {
          // 定义自定义主题 - VS Code Dark+
          monaco.editor.defineTheme('vs-dark-custom', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
              { token: 'keyword', foreground: '569CD6' },
              { token: 'string', foreground: 'CE9178' },
              { token: 'number', foreground: 'B5CEA8' },
              { token: 'type', foreground: '4EC9B0' },
              { token: 'function', foreground: 'DCDCAA' },
              { token: 'variable', foreground: '9CDCFE' },
            ],
            colors: {
              'editor.background': '#1e1e1e',
              'editor.foreground': '#d4d4d4',
              'editor.lineHighlightBackground': '#2d2d30',
              'editor.selectionBackground': '#264f78',
              'editorLineNumber.foreground': '#858585',
              'editorLineNumber.activeForeground': '#c6c6c6',
              'editorCursor.foreground': '#aeafad',
              'editor.findMatchBackground': '#515c6a',
              'editor.findMatchHighlightBackground': '#ea5c0055',
            }
          });

          monacoLoaded = true;
          monacoLoading = false;
          resolve();
        });
      });
    }

    // 获取语言 ID
    function getLanguageId(language) {
      const langMap = {
        'typescript': 'typescript',
        'javascript': 'javascript',
        'python': 'python',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'csharp': 'csharp',
        'go': 'go',
        'rust': 'rust',
        'ruby': 'ruby',
        'php': 'php',
        'swift': 'swift',
        'kotlin': 'kotlin',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'json': 'json',
        'yaml': 'yaml',
        'xml': 'xml',
        'markdown': 'markdown',
        'sql': 'sql',
        'shell': 'shell',
        'bash': 'shell',
        'powershell': 'powershell',
      };
      return langMap[language?.toLowerCase()] || 'plaintext';
    }

    // 跳转到代码
    async function jumpToCode(moduleId, startLine, endLine) {
      if (!moduleId) return;

      // 保存当前模块 ID 用于 AI 功能
      currentModuleId = moduleId;

      const modal = document.getElementById('code-modal');
      const container = document.getElementById('monaco-container');
      const loading = document.getElementById('monaco-loading');

      // 显示弹窗和加载状态
      modal.classList.add('active');
      loading.style.display = 'flex';

      // 设置默认行范围
      startLine = startLine || 1;
      endLine = endLine || startLine + 30;

      try {
        // 并行加载 Monaco 和代码数据
        const [_, response] = await Promise.all([
          initMonaco(),
          fetch('/api/code-preview?module=' + encodeURIComponent(moduleId) +
            '&start=1&end=99999')  // 加载完整文件
        ]);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to load code');
        }

        const data = await response.json();

        // 更新标题和文件信息
        document.getElementById('code-modal-title').textContent = data.fileName + ' - Code Preview';
        document.getElementById('code-modal-filename').textContent = data.fileName;
        document.getElementById('code-modal-filepath').textContent = data.filePath;

        // 显示语义信息
        const semanticEl = document.getElementById('code-modal-semantic');
        if (data.semantic) {
          const layerLabels = {
            presentation: '表现层',
            business: '业务层',
            data: '数据层',
            infrastructure: '基础设施',
            crossCutting: '横切关注点'
          };
          const tags = data.semantic.tags?.slice(0, 3).map(t => '<span class="semantic-tag">' + t + '</span>').join('') || '';
          semanticEl.innerHTML = `
            <div class="semantic-content">
              <p>${data.semantic.description || ''}
              <span class="layer-badge">${layerLabels[data.semantic.architectureLayer] || data.semantic.architectureLayer}</span></p>
              <div class="semantic-tags">${tags}</div>
            </div>
          `;
          semanticEl.style.display = 'block';
        } else {
          semanticEl.style.display = 'none';
        }

        // 组装完整代码
        const fullCode = data.lines.map(l => l.content).join('\n');
        const language = getLanguageId(data.language);

        // 隐藏加载动画
        loading.style.display = 'none';

        // 创建或更新编辑器
        if (monacoEditor) {
          monacoEditor.dispose();
        }

        monacoEditor = monaco.editor.create(container, {
          value: fullCode,
          language: language,
          theme: 'vs-dark-custom',
          readOnly: true,
          automaticLayout: true,
          fontSize: 13,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          scrollBeyondLastLine: false,
          minimap: {
            enabled: editorOptions.minimap,
            scale: 1,
            showSlider: 'mouseover'
          },
          wordWrap: editorOptions.wordWrap ? 'on' : 'off',
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalScrollbarSize: 14,
            horizontalScrollbarSize: 14
          },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          renderWhitespace: 'selection',
          guides: {
            indentation: true,
            bracketPairs: true
          },
          bracketPairColorization: {
            enabled: true
          },
          padding: {
            top: 10,
            bottom: 10
          }
        });

        // 高亮目标行范围
        if (startLine && endLine && startLine !== 1) {
          currentDecorations = monacoEditor.deltaDecorations([], [
            {
              range: new monaco.Range(startLine, 1, endLine, 1),
              options: {
                isWholeLine: true,
                className: 'highlighted-line',
                glyphMarginClassName: 'highlighted-glyph',
                overviewRuler: {
                  color: '#ffd500',
                  position: monaco.editor.OverviewRulerLane.Full
                }
              }
            }
          ]);

          // 滚动到高亮行
          monacoEditor.revealLineInCenter(startLine);
        }

        // 更新状态栏
        document.getElementById('code-status-language').textContent = data.language || 'Unknown';
        document.getElementById('code-status-lines').textContent = data.totalLines + ' lines';

        // 渲染符号大纲
        if (data.symbols && data.symbols.length > 0) {
          renderOutline(data.symbols);
          // 默认打开大纲面板
          document.getElementById('outline-panel').classList.add('active');
        } else {
          renderOutline([]);
        }

        // 设置选区处理器
        setupSelectionHandler();

        // 监听光标位置变化
        monacoEditor.onDidChangeCursorPosition((e) => {
          const pos = e.position;
          document.getElementById('code-status-position').textContent =
            'Ln ' + pos.lineNumber + ', Col ' + pos.column;
        });

        // 监听选区变化（状态栏更新）
        monacoEditor.onDidChangeCursorSelection((e) => {
          const sel = e.selection;
          if (sel.isEmpty()) {
            document.getElementById('code-status-selection').textContent = '';
          } else {
            const lines = sel.endLineNumber - sel.startLineNumber + 1;
            const chars = monacoEditor.getModel().getValueInRange(sel).length;
            document.getElementById('code-status-selection').textContent =
              '(' + lines + ' lines, ' + chars + ' chars selected)';
          }
        });

      } catch (error) {
        loading.innerHTML = '<div class="code-error">❌ ' + error.message + '</div>';
      }
    }

    // 切换小地图
    function toggleMinimap() {
      editorOptions.minimap = !editorOptions.minimap;
      if (monacoEditor) {
        monacoEditor.updateOptions({
          minimap: { enabled: editorOptions.minimap }
        });
      }
    }

    // 切换自动换行
    function toggleWordWrap() {
      editorOptions.wordWrap = !editorOptions.wordWrap;
      if (monacoEditor) {
        monacoEditor.updateOptions({
          wordWrap: editorOptions.wordWrap ? 'on' : 'off'
        });
      }
    }

    // ========================================
    // 符号大纲面板功能
    // ========================================
    let currentSymbols = [];

    function toggleOutline() {
      const panel = document.getElementById('outline-panel');
      panel.classList.toggle('active');
    }

    function renderOutline(symbols) {
      currentSymbols = symbols || [];
      const list = document.getElementById('outline-list');

      if (!currentSymbols.length) {
        list.innerHTML = '<div style="padding: 12px; color: #888; font-size: 12px;">暂无符号信息</div>';
        return;
      }

      const kindIcons = {
        'function': '𝑓',
        'class': '𝐂',
        'interface': '𝐈',
        'method': '𝑚',
        'property': '𝑝',
        'variable': '𝑣',
        'constant': '𝑐',
        'type': '𝑇',
        'enum': '𝐄'
      };

      list.innerHTML = currentSymbols.map(s => `
        <div class="outline-item outline-kind-${s.kind}"
             data-line="${s.line}"
             onclick="goToSymbol(${s.line}, ${s.endLine || s.line}, '${s.id}')">
          <span class="outline-icon">${kindIcons[s.kind] || '•'}</span>
          <span class="outline-name" title="${s.signature || s.name}">${s.name}</span>
          <span class="outline-line">:${s.line}</span>
        </div>
      `).join('');
    }

    function filterOutline(query) {
      const items = document.querySelectorAll('.outline-item');
      const q = query.toLowerCase();

      items.forEach(item => {
        const name = item.querySelector('.outline-name').textContent.toLowerCase();
        item.style.display = name.includes(q) ? 'flex' : 'none';
      });
    }

    function goToSymbol(line, endLine, symbolId) {
      if (!monacoEditor) return;

      // 跳转到符号位置
      monacoEditor.revealLineInCenter(line);
      monacoEditor.setPosition({ lineNumber: line, column: 1 });

      // 高亮符号范围
      currentDecorations = monacoEditor.deltaDecorations(currentDecorations, [
        {
          range: new monaco.Range(line, 1, endLine || line, 1),
          options: {
            isWholeLine: true,
            className: 'highlighted-line',
            glyphMarginClassName: 'highlighted-glyph'
          }
        }
      ]);

      // 更新大纲中的激活项
      document.querySelectorAll('.outline-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.line) === line);
      });

      // 显示 AI 面板并解释该符号
      const symbol = currentSymbols.find(s => s.id === symbolId);
      if (symbol && symbol.semantic) {
        showSymbolExplanation(symbol);
      }
    }

    function showSymbolExplanation(symbol) {
      toggleAIPanel(true);
      const messagesEl = document.getElementById('ai-messages');

      const html = `
        <div class="ai-msg">
          <div class="ai-avatar">🤖</div>
          <div class="ai-message">
            <p><strong>${symbol.kind}: ${symbol.name}</strong></p>
            ${symbol.semantic?.description ? `<p>${symbol.semantic.description}</p>` : ''}
            ${symbol.signature ? `<pre><code>${symbol.signature}</code></pre>` : ''}
            ${symbol.semantic?.keyPoints ? `
              <div class="key-points">
                ${symbol.semantic.keyPoints.map(p => `<div class="key-point">${p}</div>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
      messagesEl.innerHTML = html;
      scrollAIToBottom();
    }

    // ========================================
    // AI 助手面板功能
    // ========================================
    function toggleAIPanel(forceOpen) {
      const panel = document.getElementById('ai-panel');
      if (forceOpen === true) {
        panel.classList.add('active');
      } else {
        panel.classList.toggle('active');
      }
    }

    function handleAIInput(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAIQuestion();
      }
    }

    async function sendAIQuestion() {
      const input = document.getElementById('ai-input');
      const question = input.value.trim();
      if (!question) return;

      input.value = '';
      addUserMessage(question);
      await askAI(question);
    }

    function quickAsk(question) {
      addUserMessage(question);
      askAI(question);
    }

    function addUserMessage(text) {
      const messagesEl = document.getElementById('ai-messages');
      messagesEl.innerHTML += `
        <div class="ai-msg user">
          <div class="ai-avatar">👤</div>
          <div class="ai-message">${text}</div>
        </div>
      `;
      scrollAIToBottom();
    }

    function addAIMessage(content) {
      const messagesEl = document.getElementById('ai-messages');
      messagesEl.innerHTML += `
        <div class="ai-msg">
          <div class="ai-avatar">🤖</div>
          <div class="ai-message">${content}</div>
        </div>
      `;
      scrollAIToBottom();
    }

    function showAILoading() {
      const messagesEl = document.getElementById('ai-messages');
      messagesEl.innerHTML += `
        <div class="ai-loading" id="ai-loading">
          <div class="loading-spinner"></div>
          <span>思考中...</span>
        </div>
      `;
      scrollAIToBottom();
    }

    function hideAILoading() {
      const loading = document.getElementById('ai-loading');
      if (loading) loading.remove();
    }

    function scrollAIToBottom() {
      const chat = document.getElementById('ai-chat');
      chat.scrollTop = chat.scrollHeight;
    }

    async function askAI(question) {
      if (!currentModuleId) return;

      showAILoading();
      toggleAIPanel(true);

      try {
        // 获取当前选区或使用整个文件
        let startLine = 1, endLine = 100;
        if (monacoEditor) {
          const selection = monacoEditor.getSelection();
          if (selection && !selection.isEmpty()) {
            startLine = selection.startLineNumber;
            endLine = selection.endLineNumber;
          }
        }

        const response = await fetch(
          '/api/ai-explain?module=' + encodeURIComponent(currentModuleId) +
          '&start=' + startLine + '&end=' + endLine +
          '&question=' + encodeURIComponent(question)
        );

        const data = await response.json();
        hideAILoading();

        if (data.error) {
          addAIMessage('❌ ' + data.error);
          return;
        }

        // 构建 AI 响应
        let html = '';

        if (data.explanation) {
          html += '<p>' + data.explanation.summary + '</p>';

          if (data.explanation.detailed) {
            html += '<p>' + data.explanation.detailed.replace(/\n/g, '<br>') + '</p>';
          }

          if (data.explanation.keyPoints?.length) {
            html += '<div class="key-points">';
            data.explanation.keyPoints.forEach(p => {
              html += '<div class="key-point">' + p + '</div>';
            });
            html += '</div>';
          }

          if (data.explanation.relatedConcepts?.length) {
            html += '<div class="concept-tags">';
            data.explanation.relatedConcepts.forEach(c => {
              html += '<span class="concept-tag">' + c + '</span>';
            });
            html += '</div>';
          }

          if (data.explanation.codeFlow?.length) {
            html += '<p><strong>代码流程:</strong></p><ul>';
            data.explanation.codeFlow.forEach(f => {
              html += '<li>' + f + '</li>';
            });
            html += '</ul>';
          }
        }

        if (data.suggestions?.length) {
          html += '<p><strong>建议:</strong></p>';
          data.suggestions.forEach(s => {
            const icon = s.type === 'warning' ? '⚠️' : s.type === 'tip' ? '💡' : 'ℹ️';
            html += '<p>' + icon + ' <strong>' + s.title + '</strong>: ' + s.description + '</p>';
          });
        }

        addAIMessage(html || '暂无更多信息');

      } catch (error) {
        hideAILoading();
        addAIMessage('❌ 请求失败: ' + error.message);
      }
    }

    // ========================================
    // 代码选区功能 + 智能悬浮框
    // ========================================
    let selectionTimeout = null;
    let smartHoverTimeout = null;
    let smartHoverAbortController = null;
    let lastSmartHoverSelection = null;

    function setupSelectionHandler() {
      if (!monacoEditor) return;

      monacoEditor.onDidChangeCursorSelection((e) => {
        clearTimeout(selectionTimeout);
        clearTimeout(smartHoverTimeout);

        const selection = e.selection;
        if (selection.isEmpty()) {
          document.getElementById('selection-toolbar').style.display = 'none';
          // 不自动关闭悬浮框，让用户可以继续阅读
          return;
        }

        // 检查是否选中了足够的内容（至少3个字符）
        const selectedText = monacoEditor.getModel().getValueInRange(selection);
        if (selectedText.trim().length < 3) {
          return;
        }

        // 延迟触发智能悬浮框，避免频繁请求
        smartHoverTimeout = setTimeout(() => {
          showSmartHover(selection);
        }, 500);
      });

      // 点击其他地方时关闭悬浮框
      document.addEventListener('click', (e) => {
        const tooltip = document.getElementById('smart-hover-tooltip');
        if (tooltip && !tooltip.contains(e.target) && !e.target.closest('.monaco-editor')) {
          closeSmartHover();
        }
      });
    }

    function showSelectionToolbar(selection) {
      const toolbar = document.getElementById('selection-toolbar');
      const container = document.getElementById('monaco-container');

      // 获取选区位置
      const pos = monacoEditor.getScrolledVisiblePosition({
        lineNumber: selection.startLineNumber,
        column: selection.startColumn
      });

      if (!pos) return;

      toolbar.style.display = 'flex';
      toolbar.style.left = (pos.left + 50) + 'px';
      toolbar.style.top = (pos.top - 40) + 'px';
    }

    // ========================================
    // 智能悬浮解释框
    // ========================================
    async function showSmartHover(selection) {
      if (!monacoEditor || !currentModuleId) return;

      const selKey = selection.startLineNumber + '-' + selection.endLineNumber;
      if (lastSmartHoverSelection === selKey) return;
      lastSmartHoverSelection = selKey;

      // 取消之前的请求
      if (smartHoverAbortController) {
        smartHoverAbortController.abort();
      }
      smartHoverAbortController = new AbortController();

      const tooltip = document.getElementById('smart-hover-tooltip');
      const content = document.getElementById('smart-hover-content');

      // 显示加载状态
      tooltip.classList.add('loading', 'visible');
      content.innerHTML = `
        <div class="smart-hover-loading">
          <div class="spinner"></div>
          <div class="text">🧠 正在分析代码语义...</div>
        </div>
      `;

      // 定位悬浮框
      positionSmartHover(selection);

      try {
        const response = await fetch(
          '/api/smart-hover?module=' + encodeURIComponent(currentModuleId) +
          '&start=' + selection.startLineNumber +
          '&end=' + selection.endLineNumber,
          { signal: smartHoverAbortController.signal }
        );

        if (!response.ok) throw new Error('API 请求失败');

        const data = await response.json();
        tooltip.classList.remove('loading');
        renderSmartHoverContent(data);
      } catch (error) {
        if (error.name === 'AbortError') return;

        tooltip.classList.remove('loading');
        content.innerHTML = `
          <div class="smart-hover-section">
            <div class="smart-hover-section-title">
              <span class="icon">❌</span>
              <span>分析失败</span>
            </div>
            <div class="smart-hover-section-content">
              ${error.message}
            </div>
          </div>
        `;
      }
    }

    function positionSmartHover(selection) {
      const tooltip = document.getElementById('smart-hover-tooltip');
      const container = document.getElementById('monaco-container');
      const containerRect = container.getBoundingClientRect();

      // 获取选区结束位置
      const pos = monacoEditor.getScrolledVisiblePosition({
        lineNumber: selection.endLineNumber,
        column: selection.endColumn
      });

      if (!pos) return;

      // 计算绝对位置
      const left = containerRect.left + pos.left + 20;
      const top = containerRect.top + pos.top + 30;

      // 确保不超出视口
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const tooltipWidth = 520;
      const tooltipHeight = 400;

      let finalLeft = left;
      let finalTop = top;

      if (left + tooltipWidth > viewportWidth - 20) {
        finalLeft = viewportWidth - tooltipWidth - 20;
      }
      if (top + tooltipHeight > viewportHeight - 20) {
        finalTop = containerRect.top + pos.top - tooltipHeight - 10;
      }

      tooltip.style.left = Math.max(20, finalLeft) + 'px';
      tooltip.style.top = Math.max(20, finalTop) + 'px';
    }

    function renderSmartHoverContent(data) {
      const content = document.getElementById('smart-hover-content');

      let html = '';

      // 代码预览区
      if (data.codeSnippet) {
        const lines = data.codeSnippet.split('\n').slice(0, 8);
        const preview = lines.join('\n') + (lines.length < data.codeSnippet.split('\n').length ? '\n...' : '');
        html += `
          <div class="smart-hover-code">
            <div class="line-info">
              <span>📍 行 ${data.startLine} - ${data.endLine}</span>
              <span>${data.moduleId}</span>
            </div>
            <pre>${escapeHtml(preview)}</pre>
          </div>
        `;
      }

      // 符号列表
      if (data.symbols && data.symbols.length > 0) {
        html += '<div class="smart-hover-symbols">';
        data.symbols.forEach(s => {
          const iconMap = {
            function: '𝑓',
            class: '◇',
            interface: '◈',
            variable: '𝑥',
            type: '𝑇'
          };
          html += `<span class="symbol-badge ${s.kind}">${iconMap[s.kind] || '•'} ${s.name}</span>`;
        });
        html += '</div>';
      }

      // 语义标签
      if (data.tags && data.tags.length > 0) {
        html += '<div class="smart-hover-tags">';
        data.tags.forEach(tag => {
          const tagClass = tag.toLowerCase().replace(/[^a-z]/g, '');
          html += `<span class="smart-hover-tag ${tagClass || 'default'}">${tag}</span>`;
        });
        html += '</div>';
      }

      // 局部作用
      if (data.analysis?.localRole) {
        const local = data.analysis.localRole;
        const summary = typeof local === 'string' ? local : (local.summary || '');
        const details = typeof local === 'object' && local.details ? local.details : '';
        html += `
          <div class="smart-hover-section local-role">
            <div class="smart-hover-section-title">
              <span class="icon">🎯</span>
              <span>局部作用</span>
            </div>
            <div class="smart-hover-section-content">
              <div class="summary">${summary}</div>
              ${details ? '<div class="details">' + details + '</div>' : ''}
            </div>
          </div>
        `;
      }

      // 整体作用
      if (data.analysis?.globalRole) {
        const global = data.analysis.globalRole;
        const summary = typeof global === 'string' ? global : (global.summary || '');
        const layer = typeof global === 'object' && global.architectureLayer ? global.architectureLayer : '';
        const domain = typeof global === 'object' && global.businessDomain ? global.businessDomain : '';
        html += `
          <div class="smart-hover-section global-role">
            <div class="smart-hover-section-title">
              <span class="icon">🌐</span>
              <span>项目中的角色</span>
            </div>
            <div class="smart-hover-section-content">
              <div class="summary">${summary}</div>
              ${layer ? '<div class="layer-badge">' + layer + '</div>' : ''}
              ${domain ? '<div class="domain-badge">' + domain + '</div>' : ''}
            </div>
          </div>
        `;
      }

      // 工作原理
      if (data.analysis?.workingPrinciple) {
        const principle = data.analysis.workingPrinciple;
        const summary = typeof principle === 'string' ? principle : (principle.summary || '');
        const steps = typeof principle === 'object' && principle.steps ? principle.steps : [];
        html += `
          <div class="smart-hover-section principle">
            <div class="smart-hover-section-title">
              <span class="icon">⚙️</span>
              <span>工作原理</span>
            </div>
            <div class="smart-hover-section-content">
              <div class="summary">${summary}</div>
              ${steps.length > 0 ? '<ol class="steps-list">' + steps.map(s => '<li>' + s + '</li>').join('') + '</ol>' : ''}
            </div>
          </div>
        `;
      }

      // 依赖库
      const deps = data.analysis?.dependencies;
      const depsList = deps ? (deps.externalLibs || deps.imports || (Array.isArray(deps) ? deps : [])) : [];
      if (depsList.length > 0) {
        html += `
          <div class="smart-hover-section dependencies">
            <div class="smart-hover-section-title">
              <span class="icon">📦</span>
              <span>依赖库</span>
            </div>
            <div class="dependency-list">
        `;
        depsList.forEach(dep => {
          const name = typeof dep === 'string' ? dep : (dep.name || dep);
          const desc = typeof dep === 'object' ? (dep.description || dep.desc || '') : '';
          html += `
            <div class="dependency-item">
              <div class="name">${name}</div>
              ${desc ? '<div class="desc">' + desc + '</div>' : ''}
            </div>
          `;
        });
        html += '</div></div>';
      }

      // 调用关系
      if (data.analysis?.callGraph) {
        const cg = data.analysis.callGraph;
        if (cg.callers?.length > 0 || cg.callees?.length > 0) {
          html += `
            <div class="smart-hover-section call-graph">
              <div class="smart-hover-section-title">
                <span class="icon">🔗</span>
                <span>调用关系</span>
              </div>
              <div class="call-graph-visual">
          `;

          // 调用者
          if (cg.callers?.length > 0) {
            cg.callers.slice(0, 3).forEach(c => {
              html += `<span class="call-item">⬅ ${c}</span>`;
            });
            if (cg.callers.length > 3) {
              html += `<span class="call-item">+${cg.callers.length - 3}</span>`;
            }
            html += '<span class="call-arrow">→</span>';
          }

          html += '<span class="current-code">当前代码</span>';

          // 被调用者
          if (cg.callees?.length > 0) {
            html += '<span class="call-arrow">→</span>';
            cg.callees.slice(0, 3).forEach(c => {
              html += `<span class="call-item">${c} ➡</span>`;
            });
            if (cg.callees.length > 3) {
              html += `<span class="call-item">+${cg.callees.length - 3}</span>`;
            }
          }

          html += '</div></div>';
        }
      }

      // 文件关系
      if (data.analysis?.fileRelations && data.analysis.fileRelations.length > 0) {
        html += `
          <div class="smart-hover-section file-relations">
            <div class="smart-hover-section-title">
              <span class="icon">📁</span>
              <span>相关文件</span>
            </div>
            <div class="file-list">
        `;
        data.analysis.fileRelations.slice(0, 6).forEach(f => {
          const fileName = f.split('/').pop();
          html += `<span class="file-item">📄 ${fileName}</span>`;
        });
        if (data.analysis.fileRelations.length > 6) {
          html += `<span class="file-item">+${data.analysis.fileRelations.length - 6} 更多</span>`;
        }
        html += '</div></div>';
      }

      // 关键理解点
      if (data.keyInsights && data.keyInsights.length > 0) {
        html += `
          <div class="smart-hover-section insights">
            <div class="smart-hover-section-title">
              <span class="icon">💡</span>
              <span>快速理解</span>
            </div>
            <ul class="insights-list">
        `;
        data.keyInsights.forEach(insight => {
          html += `<li>${insight}</li>`;
        });
        html += '</ul></div>';
      }

      content.innerHTML = html;
    }

    function closeSmartHover() {
      const tooltip = document.getElementById('smart-hover-tooltip');
      tooltip.classList.remove('visible', 'loading');
      lastSmartHoverSelection = null;

      if (smartHoverAbortController) {
        smartHoverAbortController.abort();
        smartHoverAbortController = null;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function explainSelection() {
      if (!monacoEditor) return;

      const selection = monacoEditor.getSelection();
      if (!selection || selection.isEmpty()) return;

      const code = monacoEditor.getModel().getValueInRange(selection);
      document.getElementById('selection-toolbar').style.display = 'none';

      // 显示 AI 面板
      toggleAIPanel(true);
      addUserMessage('解释这段代码:\n```\n' + code.substring(0, 200) + (code.length > 200 ? '...' : '') + '\n```');

      await askAI('请解释这段代码的作用');
    }

    async function findReferences() {
      if (!monacoEditor) return;

      const position = monacoEditor.getPosition();
      const word = monacoEditor.getModel().getWordAtPosition(position);

      if (!word) {
        addAIMessage('请将光标放在一个符号上');
        return;
      }

      document.getElementById('selection-toolbar').style.display = 'none';
      toggleAIPanel(true);

      // 查找匹配的符号
      const symbol = currentSymbols.find(s => s.name === word.word);
      if (symbol) {
        try {
          const response = await fetch('/api/symbol-refs?id=' + encodeURIComponent(symbol.id));
          const data = await response.json();

          let html = '<p><strong>符号引用: ' + word.word + '</strong></p>';

          if (data.callers?.length) {
            html += '<p>被以下位置调用 (' + data.totalCallers + '):</p><ul>';
            data.callers.slice(0, 5).forEach(c => {
              html += '<li>' + c.callerName + ' @ ' + c.callerModule + '</li>';
            });
            if (data.totalCallers > 5) {
              html += '<li>...还有 ' + (data.totalCallers - 5) + ' 处</li>';
            }
            html += '</ul>';
          }

          if (data.callees?.length) {
            html += '<p>调用了以下符号 (' + data.totalCallees + '):</p><ul>';
            data.callees.slice(0, 5).forEach(c => {
              html += '<li>' + c.calleeName + ' @ ' + c.calleeModule + '</li>';
            });
            if (data.totalCallees > 5) {
              html += '<li>...还有 ' + (data.totalCallees - 5) + ' 处</li>';
            }
            html += '</ul>';
          }

          if (!data.callers?.length && !data.callees?.length) {
            html += '<p>未找到引用关系</p>';
          }

          addAIMessage(html);
        } catch (error) {
          addAIMessage('❌ 查询失败: ' + error.message);
        }
      } else {
        addAIMessage('未找到符号 "' + word.word + '" 的定义信息');
      }
    }

    function askAboutSelection() {
      document.getElementById('selection-toolbar').style.display = 'none';
      toggleAIPanel(true);
      document.getElementById('ai-input').focus();
    }

    function closeCodeModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('code-modal').classList.remove('active');
      document.getElementById('outline-panel').classList.remove('active');
      document.getElementById('ai-panel').classList.remove('active');
      document.getElementById('ai-messages').innerHTML = '';

      // 关闭智能悬浮框
      closeSmartHover();

      // 清理编辑器以释放资源
      if (monacoEditor) {
        monacoEditor.dispose();
        monacoEditor = null;
      }
    }

    // ESC 键关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSmartHover();
        closeCodeModal();
      }
    });

    // ========================================
    // 代码阅读引擎视图
    // ========================================
    let readingData = null;
    let currentPath = null;
    let currentStepIndex = 0;

    async function renderReadingView() {
      hideAllIndicators();
      hideAllViews();
      document.getElementById('reading-view').classList.add('active');

      try {
        const response = await fetch('/api/reading-guide');
        readingData = await response.json();

        // 渲染头部
        const headerHtml = `
          <h1>📚 代码阅读引擎</h1>
          <p>选择一条学习路径，跟随引导理解代码</p>
        `;
        document.getElementById('reading-header').innerHTML = headerHtml;

        // 渲染学习路径
        const pathsHtml = readingData.paths.map((path, index) => `
          <div class="reading-path ${index === 0 ? 'active' : ''}" data-id="${path.id}" onclick="selectReadingPath('${path.id}')">
            <h3>${path.title}</h3>
            <p>${path.description}</p>
            <div class="path-meta">
              <span class="difficulty ${path.difficulty}">${getDifficultyLabel(path.difficulty)}</span>
              <span class="time">⏱ ${path.estimatedTime}</span>
            </div>
          </div>
        `).join('');
        document.getElementById('reading-paths').innerHTML = pathsHtml;

        // 默认显示第一个路径
        if (readingData.paths.length > 0) {
          showReadingPath(readingData.paths[0]);
        }
      } catch (error) {
        console.error('Failed to load reading guide:', error);
        document.getElementById('reading-header').innerHTML = '<h1>加载失败</h1><p>' + error.message + '</p>';
      }
    }

    function getDifficultyLabel(difficulty) {
      const labels = {
        beginner: '入门',
        intermediate: '进阶',
        advanced: '高级'
      };
      return labels[difficulty] || difficulty;
    }

    function selectReadingPath(pathId) {
      // 更新路径样式
      document.querySelectorAll('.reading-path').forEach(p => {
        p.classList.toggle('active', p.dataset.id === pathId);
      });

      // 找到并显示路径
      const path = readingData.paths.find(p => p.id === pathId);
      if (path) {
        showReadingPath(path);
      }
    }

    function showReadingPath(path) {
      currentPath = path;
      currentStepIndex = 0;
      showReadingStep();
    }

    function showReadingStep() {
      if (!currentPath || !currentPath.steps.length) {
        document.getElementById('reading-content').innerHTML = '<p style="color:#888">这个路径暂无内容</p>';
        return;
      }

      const step = currentPath.steps[currentStepIndex];
      const totalSteps = currentPath.steps.length;
      const progress = ((currentStepIndex + 1) / totalSteps) * 100;

      const contentHtml = `
        <div class="reading-question">
          <h3>❓ ${step.question}</h3>
          <div class="hint">💡 提示: ${step.hint}</div>
          <div class="code-preview">
            📄 ${step.codeLocation.moduleId} (行 ${step.codeLocation.lineStart}-${step.codeLocation.lineEnd})
            <br><br>
            <a href="javascript:jumpToCode('${step.codeLocation.moduleId}', ${step.codeLocation.lineStart}, ${step.codeLocation.lineEnd})" style="color:#e94560">点击查看代码 →</a>
          </div>
          <div class="explanation">${step.explanation}</div>
          <div class="key-points">
            ${step.keyPoints.map(p => '<span class="key-point">' + p + '</span>').join('')}
          </div>
          ${step.nextQuestion ? '<p style="margin-top:1rem;color:#4ecdc4">下一步: ' + step.nextQuestion + '</p>' : ''}
        </div>
        <div class="reading-progress">
          <div class="reading-progress-bar" style="width: ${progress}%"></div>
        </div>
        <div style="text-align:center;color:#888;margin-top:0.5rem">
          步骤 ${currentStepIndex + 1} / ${totalSteps}
        </div>
        <div class="reading-nav">
          <button class="prev-btn" onclick="prevReadingStep()" ${currentStepIndex === 0 ? 'disabled' : ''}>← 上一步</button>
          <button class="next-btn" onclick="nextReadingStep()" ${currentStepIndex >= totalSteps - 1 ? 'disabled' : ''}>下一步 →</button>
        </div>
      `;

      document.getElementById('reading-content').innerHTML = contentHtml;
      document.getElementById('reading-content').classList.remove('hidden');
    }

    function prevReadingStep() {
      if (currentStepIndex > 0) {
        currentStepIndex--;
        showReadingStep();
      }
    }

    function nextReadingStep() {
      if (currentPath && currentStepIndex < currentPath.steps.length - 1) {
        currentStepIndex++;
        showReadingStep();
      }
    }

    // 渲染流程图
    async function renderFlowchart() {
      hideAllIndicators();
      hideAllViews();
      document.getElementById('sidebar').style.display = '';
      document.getElementById('graph-container').style.display = '';
      document.getElementById('flowchart-legend').classList.add('active');
      document.getElementById('flowchart-title').classList.add('active');
      document.getElementById('scenario-selector').classList.add('active');

      const scenarioSelect = document.getElementById('scenario-select');
      const scenario = scenarioSelect.value || 'default';
      const selectedOption = scenarioSelect.selectedOptions[0];
      const entryId = selectedOption ? selectedOption.dataset.entry : '';
      const depth = parseInt(document.getElementById('max-depth').value) || 5;

      try {
        const response = await fetch('/api/flowchart?scenario=' + scenario + '&entry=' + encodeURIComponent(entryId) + '&depth=' + depth);
        flowchartData = await response.json();

        // 更新标题
        const titleEl = document.getElementById('flowchart-title');
        titleEl.innerHTML = '<h2>' + flowchartData.title + '</h2><p>' + flowchartData.description + '</p>';

        // 渲染流程图
        renderFlowchartSvg(flowchartData);
      } catch (error) {
        console.error('Failed to load flowchart:', error);
        document.getElementById('flowchart-title').innerHTML = '<h2>加载失败</h2><p>' + error.message + '</p>';
      }
    }

    // 渲染流程图 SVG
    function renderFlowchartSvg(data) {
      // 初始化 SVG
      svg = d3.select('#graph')
        .attr('width', '100%')
        .attr('height', '100%');

      svg.selectAll('*').remove();

      // 设置缩放
      zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      if (!data.nodes || data.nodes.length === 0) {
        g.append('text')
          .attr('x', 0)
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('fill', '#888')
          .text('暂无流程数据');
        return;
      }

      // 定义箭头标记
      const defs = g.append('defs');

      const arrowColors = {
        normal: '#4ecdc4',
        conditional: '#f39c12',
        loop: '#ff6b6b',
        async: '#9b59b6'
      };

      Object.entries(arrowColors).forEach(([type, color]) => {
        defs.append('marker')
          .attr('id', 'arrow-' + type)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 10)
          .attr('refY', 0)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .attr('fill', color);
      });

      // 节点尺寸
      const nodeWidth = 160;
      const nodeHeight = 50;

      // 绘制边
      const edges = g.selectAll('.flow-edge')
        .data(data.edges)
        .enter()
        .append('g')
        .attr('class', d => 'flow-edge-group');

      edges.append('path')
        .attr('class', d => 'flow-edge type-' + d.type)
        .attr('d', d => {
          const source = data.nodes.find(n => n.id === d.source);
          const target = data.nodes.find(n => n.id === d.target);
          if (!source || !target) return '';

          const sx = source.x || 0;
          const sy = (source.y || 0) + nodeHeight / 2;
          const tx = target.x || 0;
          const ty = (target.y || 0) - nodeHeight / 2;

          // 使用贝塞尔曲线
          const midY = (sy + ty) / 2;
          return 'M' + sx + ',' + sy + ' C' + sx + ',' + midY + ' ' + tx + ',' + midY + ' ' + tx + ',' + ty;
        })
        .attr('marker-end', d => 'url(#arrow-' + d.type + ')');

      // 边标签
      edges.filter(d => d.label)
        .append('text')
        .attr('class', 'flow-edge-label')
        .attr('x', d => {
          const source = data.nodes.find(n => n.id === d.source);
          const target = data.nodes.find(n => n.id === d.target);
          return ((source?.x || 0) + (target?.x || 0)) / 2;
        })
        .attr('y', d => {
          const source = data.nodes.find(n => n.id === d.source);
          const target = data.nodes.find(n => n.id === d.target);
          return ((source?.y || 0) + (target?.y || 0)) / 2;
        })
        .attr('text-anchor', 'middle')
        .text(d => d.label);

      // 绘制节点
      const nodes = g.selectAll('.flow-node')
        .data(data.nodes)
        .enter()
        .append('g')
        .attr('class', d => 'flow-node type-' + d.type)
        .attr('transform', d => 'translate(' + (d.x || 0) + ',' + (d.y || 0) + ')')
        .on('click', (event, d) => {
          showFlowNodeDetails(d);
        });

      // 根据类型绘制不同形状
      nodes.each(function(d) {
        const node = d3.select(this);

        if (d.type === 'entry') {
          // 入口：圆角矩形
          node.append('rect')
            .attr('x', -nodeWidth / 2)
            .attr('y', -nodeHeight / 2)
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 25);
        } else if (d.type === 'end') {
          // 结束：椭圆
          node.append('ellipse')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('rx', 40)
            .attr('ry', 20);
        } else if (d.type === 'decision') {
          // 判断：菱形
          node.append('polygon')
            .attr('points', '0,-30 50,0 0,30 -50,0');
        } else if (d.type === 'data') {
          // 数据：平行四边形
          node.append('polygon')
            .attr('points', (-nodeWidth/2 + 10) + ',-25 ' + (nodeWidth/2) + ',-25 ' + (nodeWidth/2 - 10) + ',25 ' + (-nodeWidth/2) + ',25');
        } else {
          // 默认处理：矩形
          node.append('rect')
            .attr('x', -nodeWidth / 2)
            .attr('y', -nodeHeight / 2)
            .attr('width', nodeWidth)
            .attr('height', nodeHeight)
            .attr('rx', 4);
        }

        // 节点标签
        node.append('text')
          .attr('y', d.type === 'end' ? 4 : -5)
          .text(d.label.length > 18 ? d.label.substring(0, 16) + '...' : d.label);

        // 节点描述（如果不是结束节点）
        if (d.type !== 'end' && d.description) {
          const desc = d.description.length > 25 ? d.description.substring(0, 23) + '...' : d.description;
          node.append('text')
            .attr('class', 'node-desc')
            .attr('y', 12)
            .text(desc);
        }
      });

      // 调整视图
      const bounds = g.node().getBBox();
      const padding = 50;
      svg.call(zoom.transform, d3.zoomIdentity
        .translate(svg.node().clientWidth / 2 - bounds.x - bounds.width / 2, padding)
        .scale(Math.min(1, (svg.node().clientHeight - padding * 2) / bounds.height, (svg.node().clientWidth - padding * 2) / bounds.width))
      );
    }

    // 显示流程节点详情
    function showFlowNodeDetails(node) {
      const panel = document.getElementById('details-panel');
      const details = document.getElementById('node-details');

      let html = '<div class="info-item"><span class="info-label">名称:</span> <span class="info-value">' + node.label + '</span></div>';
      html += '<div class="info-item"><span class="info-label">类型:</span> <span class="info-value">' + getNodeTypeName(node.type) + '</span></div>';

      if (node.description) {
        html += '<div class="info-item"><span class="info-label">描述:</span> <span class="info-value">' + node.description + '</span></div>';
      }

      if (node.moduleId) {
        html += '<div class="info-item"><span class="info-label">模块:</span> <span class="info-value">' + node.moduleId + '</span></div>';
      }

      if (node.layer) {
        html += '<div class="info-item"><span class="info-label">架构层:</span> <span class="info-value">' + getLayerName(node.layer) + '</span></div>';
      }

      details.innerHTML = html;
      panel.classList.add('active');
    }

    function getNodeTypeName(type) {
      const names = {
        entry: '入口点',
        process: '处理过程',
        subprocess: '子流程',
        data: '数据/配置',
        decision: '判断节点',
        end: '结束'
      };
      return names[type] || type;
    }

    function getLayerName(layer) {
      const names = {
        presentation: '表现层',
        business: '业务层',
        data: '数据层',
        infrastructure: '基础设施',
        crossCutting: '横切关注点'
      };
      return names[layer] || layer;
    }

    // 渲染统计信息
    function renderStats() {
      const stats = ontology.statistics;
      const isEnhanced = ontology.isEnhanced;

      const items = [
        { label: '模块数', value: stats.totalModules },
        { label: '类', value: stats.totalClasses || 0 },
        { label: '接口', value: stats.totalInterfaces || 0 },
        { label: '函数', value: stats.totalFunctions || 0 },
        { label: '代码行', value: (stats.totalLines || 0).toLocaleString() },
        { label: '依赖', value: stats.totalDependencyEdges || (stats.referenceStats ? stats.referenceStats.totalModuleDeps : 0) },
      ];

      if (isEnhanced && stats.semanticCoverage) {
        items.push({ label: '语义覆盖', value: stats.semanticCoverage.coveragePercent + '%' });
      }

      const html = items.map(item =>
        '<div class="stat-item"><span>' + item.label + '</span><span class="stat-value">' + (item.value !== undefined ? item.value : 0) + '</span></div>'
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

      document.querySelectorAll('.module-item').forEach(item => {
        item.addEventListener('click', () => {
          showModuleDetails(item.dataset.id);
        });
      });
    }

    // 渲染依赖图（力导向）
    function renderGraph() {
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      const nodes = [];
      const links = [];
      const nodeMap = new Map();

      const displayModules = ontology.modules.slice(0, 100);

      displayModules.forEach(m => {
        const node = { id: m.id, name: m.name, type: 'module', data: m };
        nodes.push(node);
        nodeMap.set(m.id, node);
      });

      ontology.dependencyGraph.edges.forEach(edge => {
        if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
          links.push({
            source: edge.source,
            target: edge.target,
            type: 'dependency',
          });
        }
      });

      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));

      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('class', d => 'link ' + d.type)
        .attr('stroke-width', 1);

      const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('class', d => 'node ' + d.type)
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      node.append('circle').attr('r', 8);
      node.append('text')
        .attr('dx', 12)
        .attr('dy', 4)
        .text(d => d.name.length > 20 ? d.name.slice(0, 20) + '...' : d.name);

      node.on('click', (event, d) => {
        showModuleDetails(d.id);
      });

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
      d.fx = d.x; d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x; d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }

    // 渲染架构概览图
    async function renderArchitecture() {
      document.querySelector('.loading').style.display = 'block';
      document.querySelector('.loading').textContent = '加载架构图...';

      try {
        const response = await fetch('/api/architecture');
        archData = await response.json();

        if (archData.error) {
          throw new Error(archData.error);
        }

        document.querySelector('.loading').style.display = 'none';
        drawArchitecture(archData);
      } catch (error) {
        document.querySelector('.loading').textContent = '加载失败: ' + error.message;
      }
    }

    // 绘制架构图（从上到下）
    function drawArchitecture(data) {
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      // 添加箭头标记
      svg.append('defs').append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#4ecdc4');

      // 显示项目信息
      document.getElementById('project-name').textContent = data.projectName;
      document.getElementById('project-desc').textContent = data.projectDescription;
      document.getElementById('project-header').classList.add('active');
      document.getElementById('arch-legend').classList.add('active');

      // 布局参数
      const blockWidth = 200;
      const blockHeight = 70;
      const gapX = 50;
      const gapY = 40;
      const startY = 80;

      // 按类型分层
      const layers = {
        entry: [],
        core: [],
        feature: [],
        ui: [],
        data: [],
        config: [],
        util: []
      };

      data.blocks.forEach(block => {
        if (layers[block.type]) {
          layers[block.type].push(block);
        } else {
          layers.util.push(block);
        }
      });

      // 计算每层位置
      const blockPositions = new Map();
      let currentY = startY;

      const layerOrder = ['entry', 'core', 'feature', 'ui', 'data', 'config', 'util'];

      layerOrder.forEach(layerType => {
        const blocks = layers[layerType];
        if (blocks.length === 0) return;

        const totalWidth = blocks.length * blockWidth + (blocks.length - 1) * gapX;
        let startX = (width - totalWidth) / 2;

        blocks.forEach((block, i) => {
          const x = startX + i * (blockWidth + gapX);
          const y = currentY;
          blockPositions.set(block.id, { x, y, block });
        });

        currentY += blockHeight + gapY;
      });

      // 绘制依赖连线
      const links = g.append('g');

      data.blocks.forEach(block => {
        const sourcePos = blockPositions.get(block.id);
        if (!sourcePos) return;

        block.dependencies.forEach(depId => {
          const targetPos = blockPositions.get(depId);
          if (!targetPos) return;

          // 计算连线点
          const sx = sourcePos.x + blockWidth / 2;
          const sy = sourcePos.y + blockHeight;
          const tx = targetPos.x + blockWidth / 2;
          const ty = targetPos.y;

          // 绘制曲线
          const path = d3.path();
          path.moveTo(sx, sy);
          const midY = (sy + ty) / 2;
          path.bezierCurveTo(sx, midY, tx, midY, tx, ty);

          links.append('path')
            .attr('class', 'arch-link')
            .attr('d', path.toString());
        });
      });

      // 绘制逻辑块
      const nodes = g.append('g')
        .selectAll('g')
        .data(Array.from(blockPositions.values()))
        .join('g')
        .attr('class', d => 'arch-block type-' + d.block.type)
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

      // 块背景
      nodes.append('rect')
        .attr('width', blockWidth)
        .attr('height', blockHeight);

      // 块标题
      nodes.append('text')
        .attr('class', 'block-title')
        .attr('x', blockWidth / 2)
        .attr('y', 22)
        .attr('text-anchor', 'middle')
        .text(d => d.block.name);

      // 块描述
      nodes.append('text')
        .attr('class', 'block-desc')
        .attr('x', blockWidth / 2)
        .attr('y', 40)
        .attr('text-anchor', 'middle')
        .text(d => {
          const desc = d.block.description;
          return desc.length > 25 ? desc.slice(0, 25) + '...' : desc;
        });

      // 文件数信息
      nodes.append('text')
        .attr('class', 'block-info')
        .attr('x', blockWidth / 2)
        .attr('y', 58)
        .attr('text-anchor', 'middle')
        .text(d => d.block.fileCount + ' 文件 · ' + d.block.totalLines.toLocaleString() + ' 行');

      // 单击显示详情
      nodes.on('click', (event, d) => {
        showBlockDetails(d.block);
      });

      // 双击下钻到文件列表
      nodes.on('dblclick', (event, d) => {
        event.stopPropagation();
        drillIntoBlock(d.block);
      });

      // 初始缩放适应视口
      const bounds = g.node().getBBox();
      if (bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(
          0.9 * width / bounds.width,
          0.85 * height / bounds.height,
          1.2
        );
        const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
        const ty = 30;

        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }

    // 显示逻辑块详情
    function showBlockDetails(block) {
      const panel = document.getElementById('details-panel');
      panel.classList.add('active');

      let html = '';
      html += '<div class="info-item"><span class="info-label">模块:</span> <span class="info-value">' + block.name + '</span></div>';
      html += '<div class="info-item"><span class="info-label">类型:</span> <span class="info-value">' + block.type + '</span></div>';
      html += '<div class="info-item"><span class="info-label">文件数:</span> <span class="info-value">' + block.fileCount + '</span></div>';
      html += '<div class="info-item"><span class="info-label">代码行:</span> <span class="info-value">' + block.totalLines.toLocaleString() + '</span></div>';
      html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
      html += '<div class="info-item"><span class="info-label">描述:</span></div>';
      html += '<div class="info-item" style="color: #aaa; font-size: 0.8rem;">' + block.description + '</div>';

      if (block.files.length > 0) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">包含文件:</span></div>';
        block.files.slice(0, 15).forEach(f => {
          html += '<div class="info-item" style="color: #4ecdc4; font-size: 0.75rem; cursor:pointer;" onclick="showModuleDetails(\'' + f + '\')">' + f + '</div>';
        });
        if (block.files.length > 15) {
          html += '<div class="info-item" style="color: #888; font-size: 0.75rem;">... 还有 ' + (block.files.length - 15) + ' 个文件</div>';
        }
      }

      document.getElementById('node-details').innerHTML = html;
    }

    // 下钻到逻辑块 - 显示文件列表
    function drillIntoBlock(block) {
      drillStack.push({ type: 'block', name: block.name, data: block });
      currentDrillLevel = 'block';
      updateBreadcrumb();
      renderBlockFiles(block);
    }

    // 渲染逻辑块内的文件列表
    async function renderBlockFiles(block) {
      hideAllIndicators();
      document.getElementById('symbol-legend').classList.add('active');

      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      // 获取文件详情
      const fileDetails = [];
      for (const fileId of block.files) {
        try {
          const response = await fetch('/api/module-detail?id=' + encodeURIComponent(fileId));
          if (response.ok) {
            const detail = await response.json();
            fileDetails.push(detail);
          }
        } catch (e) {
          console.error('Failed to load file:', fileId, e);
        }
      }

      // 布局参数
      const nodeWidth = 220;
      const nodeHeight = 50;
      const gapX = 30;
      const gapY = 20;
      const cols = Math.ceil(Math.sqrt(fileDetails.length));

      // 计算位置
      const filePositions = fileDetails.map((file, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        return {
          x: col * (nodeWidth + gapX) + 50,
          y: row * (nodeHeight + gapY) + 50,
          file
        };
      });

      // 绘制文件节点
      const nodes = g.append('g')
        .selectAll('g')
        .data(filePositions)
        .join('g')
        .attr('class', 'file-node')
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

      nodes.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight);

      // 文件名
      nodes.append('text')
        .attr('x', 10)
        .attr('y', 20)
        .text(d => d.file.name.length > 25 ? d.file.name.slice(0, 25) + '...' : d.file.name);

      // 符号统计
      nodes.append('text')
        .attr('class', 'file-desc')
        .attr('x', 10)
        .attr('y', 38)
        .text(d => {
          const s = d.file.symbols;
          const counts = [];
          if (s.classes.length) counts.push(s.classes.length + ' 类');
          if (s.functions.length) counts.push(s.functions.length + ' 函数');
          if (s.interfaces.length) counts.push(s.interfaces.length + ' 接口');
          return counts.join(' · ') || d.file.lines + ' 行';
        });

      // 单击显示详情
      nodes.on('click', (event, d) => {
        showFileDetails(d.file);
      });

      // 双击下钻到符号
      nodes.on('dblclick', (event, d) => {
        event.stopPropagation();
        drillIntoFile(d.file);
      });

      // 适应视口
      const bounds = g.node().getBBox();
      if (bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(
          0.9 * (width - 100) / bounds.width,
          0.85 * height / bounds.height,
          1.5
        );
        const tx = (width - bounds.width * scale) / 2;
        const ty = 30;
        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }

    // 显示文件详情
    function showFileDetails(file) {
      const panel = document.getElementById('details-panel');
      panel.classList.add('active');

      let html = '';
      html += '<div class="info-item"><span class="info-label">文件:</span> <span class="info-value">' + file.name + '</span></div>';
      html += '<div class="info-item"><span class="info-label">路径:</span> <span class="info-value" style="font-size:0.75rem">' + file.id + '</span></div>';
      html += '<div class="info-item"><span class="info-label">语言:</span> <span class="info-value">' + file.language + '</span></div>';
      html += '<div class="info-item"><span class="info-label">行数:</span> <span class="info-value">' + file.lines + '</span></div>';

      if (file.semantic) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">描述:</span></div>';
        html += '<div class="info-item" style="color: #aaa; font-size: 0.8rem;">' + (file.semantic.description || 'N/A') + '</div>';
      }

      // 符号摘要
      const s = file.symbols;
      html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
      html += '<div class="info-item"><span class="info-label">符号统计:</span></div>';
      if (s.classes.length) html += '<div class="info-item" style="font-size:0.8rem">类: ' + s.classes.length + '</div>';
      if (s.interfaces.length) html += '<div class="info-item" style="font-size:0.8rem">接口: ' + s.interfaces.length + '</div>';
      if (s.functions.length) html += '<div class="info-item" style="font-size:0.8rem">函数: ' + s.functions.length + '</div>';
      if (s.types.length) html += '<div class="info-item" style="font-size:0.8rem">类型: ' + s.types.length + '</div>';
      if (s.constants.length) html += '<div class="info-item" style="font-size:0.8rem">常量: ' + s.constants.length + '</div>';

      // 依赖
      if (file.internalImports.length > 0) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">内部依赖:</span></div>';
        file.internalImports.slice(0, 10).forEach(imp => {
          html += '<div class="info-item" style="color: #4ecdc4; font-size: 0.75rem;">' + imp + '</div>';
        });
      }

      html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
      html += '<div class="info-item" style="color:#e94560;cursor:pointer" onclick="drillIntoFile(window._currentFile)">双击查看符号 →</div>';

      window._currentFile = file;
      document.getElementById('node-details').innerHTML = html;
    }

    // 下钻到文件 - 显示符号列表
    function drillIntoFile(file) {
      drillStack.push({ type: 'file', name: file.name, data: file });
      currentDrillLevel = 'file';
      updateBreadcrumb();
      renderFileSymbols(file);
    }

    // 渲染文件内的符号
    function renderFileSymbols(file) {
      hideAllIndicators();
      document.getElementById('symbol-legend').classList.add('active');

      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.3, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      // 收集所有符号
      const allSymbols = [];
      const s = file.symbols;

      // 按类型顺序添加
      s.classes.forEach(sym => allSymbols.push({ ...sym, groupKind: 'class' }));
      s.interfaces.forEach(sym => allSymbols.push({ ...sym, groupKind: 'interface' }));
      s.functions.forEach(sym => allSymbols.push({ ...sym, groupKind: 'function' }));
      s.types.forEach(sym => allSymbols.push({ ...sym, groupKind: 'type' }));
      s.constants.forEach(sym => allSymbols.push({ ...sym, groupKind: 'constant' }));
      s.variables.forEach(sym => allSymbols.push({ ...sym, groupKind: 'variable' }));
      // re-export 的符号
      if (s.exports) {
        s.exports.forEach(sym => allSymbols.push({ ...sym, groupKind: 'export' }));
      }

      // 按行号排序
      allSymbols.sort((a, b) => a.location.startLine - b.location.startLine);

      // 布局参数
      const nodeWidth = 250;
      const nodeHeight = 45;
      const gapY = 15;
      const childIndent = 30;

      // 计算位置（树形布局）
      let currentY = 50;
      const symbolPositions = [];

      function addSymbol(sym, depth = 0) {
        const x = 50 + depth * childIndent;
        symbolPositions.push({
          x,
          y: currentY,
          symbol: sym,
          depth
        });
        currentY += nodeHeight + gapY;

        // 添加子符号（如类的方法）
        if (sym.children && sym.children.length > 0) {
          sym.children.forEach(child => addSymbol(child, depth + 1));
        }
      }

      allSymbols.forEach(sym => addSymbol(sym, 0));

      // 绘制符号节点
      const nodes = g.append('g')
        .selectAll('g')
        .data(symbolPositions)
        .join('g')
        .attr('class', d => 'symbol-node kind-' + d.symbol.kind)
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

      nodes.append('rect')
        .attr('width', d => nodeWidth - d.depth * childIndent)
        .attr('height', nodeHeight);

      // 符号名
      nodes.append('text')
        .attr('x', 10)
        .attr('y', 18)
        .text(d => {
          const name = d.symbol.name;
          return name.length > 30 ? name.slice(0, 30) + '...' : name;
        });

      // 签名或类型
      nodes.append('text')
        .attr('class', 'symbol-sig')
        .attr('x', 10)
        .attr('y', 34)
        .text(d => {
          if (d.symbol.signature) {
            const sig = d.symbol.signature;
            return sig.length > 35 ? sig.slice(0, 35) + '...' : sig;
          }
          return 'L' + d.symbol.location.startLine + '-' + d.symbol.location.endLine;
        });

      // 单击显示详情
      nodes.on('click', (event, d) => {
        showSymbolDetails(d.symbol, file.id);
      });

      // 双击查看引用
      nodes.on('dblclick', (event, d) => {
        event.stopPropagation();
        showSymbolRefs(d.symbol);
      });

      // 适应视口
      const bounds = g.node().getBBox();
      if (bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(
          0.9 * (width - 100) / bounds.width,
          0.85 * (height - 50) / bounds.height,
          1.2
        );
        const tx = 30;
        const ty = 20;
        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }

    // 显示符号详情
    async function showSymbolDetails(symbol, moduleId) {
      const panel = document.getElementById('details-panel');
      panel.classList.add('active');

      let html = '';
      html += '<div class="info-item"><span class="info-label">名称:</span> <span class="info-value">' + symbol.name + '</span></div>';
      html += '<div class="info-item"><span class="info-label">类型:</span> <span class="info-value">' + symbol.kind + '</span></div>';
      html += '<div class="info-item"><span class="info-label">位置:</span> <span class="info-value">L' + symbol.location.startLine + '-' + symbol.location.endLine + '</span></div>';

      if (symbol.signature) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">签名:</span></div>';
        html += '<div class="info-item" style="color: #4ecdc4; font-size: 0.75rem; word-break: break-all;">' + symbol.signature + '</div>';
      }

      if (symbol.semantic) {
        html += '<hr style="border-color: #0f3460; margin: 0.5rem 0;">';
        html += '<div class="info-item"><span class="info-label">描述:</span></div>';
        html += '<div class="info-item" style="color: #aaa; font-size: 0.8rem;">' + (symbol.semantic.description || 'N/A') + '</div>';
      }

      // 加载引用关系
      try {
        const response = await fetch('/api/symbol-refs?id=' + encodeURIComponent(symbol.id));
        if (response.ok) {
          const refs = await response.json();

          if (refs.calledBy.length > 0) {
            html += '<div class="refs-section"><h3>被调用 (' + refs.calledBy.length + ')</h3>';
            refs.calledBy.slice(0, 8).forEach(ref => {
              html += '<div class="ref-item" onclick="navigateToSymbol(\'' + ref.symbolId + '\')">' +
                ref.symbolName + ' <span class="ref-type">' + ref.callType + '</span></div>';
            });
            html += '</div>';
          }

          if (refs.calls.length > 0) {
            html += '<div class="refs-section"><h3>调用了 (' + refs.calls.length + ')</h3>';
            refs.calls.slice(0, 8).forEach(ref => {
              html += '<div class="ref-item" onclick="navigateToSymbol(\'' + ref.symbolId + '\')">' +
                ref.symbolName + ' <span class="ref-type">' + ref.callType + '</span></div>';
            });
            html += '</div>';
          }

          if (refs.typeRefs.length > 0) {
            html += '<div class="refs-section"><h3>类型关系</h3>';
            refs.typeRefs.forEach(ref => {
              const dir = ref.direction === 'parent' ? '继承自' : '被继承';
              html += '<div class="ref-item">' + dir + ': ' + ref.relatedSymbolName + '</div>';
            });
            html += '</div>';
          }
        }
      } catch (e) {
        console.error('Failed to load symbol refs:', e);
      }

      document.getElementById('node-details').innerHTML = html;
    }

    // 显示符号引用图
    async function showSymbolRefs(symbol) {
      try {
        const response = await fetch('/api/symbol-refs?id=' + encodeURIComponent(symbol.id));
        if (!response.ok) return;

        const refs = await response.json();

        // 如果有引用关系，绘制引用图
        if (refs.calledBy.length > 0 || refs.calls.length > 0) {
          drawSymbolRefGraph(symbol, refs);
        } else {
          alert('该符号没有引用关系');
        }
      } catch (e) {
        console.error('Failed to show symbol refs:', e);
      }
    }

    // 绘制符号引用关系图
    function drawSymbolRefGraph(centerSymbol, refs) {
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg.selectAll('*').remove();
      g = svg.append('g');

      const centerX = width / 2;
      const centerY = height / 2;

      // 中心节点
      const centerNode = g.append('g')
        .attr('class', 'symbol-node kind-' + centerSymbol.kind)
        .attr('transform', 'translate(' + (centerX - 75) + ',' + (centerY - 20) + ')');

      centerNode.append('rect')
        .attr('width', 150)
        .attr('height', 40);

      centerNode.append('text')
        .attr('x', 75)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .text(centerSymbol.name);

      // 被调用者（上方）
      const calledByNodes = refs.calledBy.slice(0, 8);
      const calledBySpacing = Math.min(180, (width - 100) / Math.max(calledByNodes.length, 1));

      calledByNodes.forEach((ref, i) => {
        const x = centerX - (calledByNodes.length - 1) * calledBySpacing / 2 + i * calledBySpacing - 60;
        const y = centerY - 150;

        // 连线
        g.append('path')
          .attr('class', 'ref-link called-by')
          .attr('d', 'M' + (x + 60) + ',' + (y + 40) + ' Q' + (x + 60) + ',' + (centerY - 50) + ' ' + centerX + ',' + (centerY - 20))
          .attr('marker-end', 'url(#arrow-down)');

        // 节点
        const node = g.append('g')
          .attr('class', 'symbol-node kind-function')
          .attr('transform', 'translate(' + x + ',' + y + ')');

        node.append('rect')
          .attr('width', 120)
          .attr('height', 40);

        node.append('text')
          .attr('x', 60)
          .attr('y', 25)
          .attr('text-anchor', 'middle')
          .text(ref.symbolName.length > 15 ? ref.symbolName.slice(0, 15) + '...' : ref.symbolName);
      });

      // 调用者（下方）
      const callsNodes = refs.calls.slice(0, 8);
      const callsSpacing = Math.min(180, (width - 100) / Math.max(callsNodes.length, 1));

      callsNodes.forEach((ref, i) => {
        const x = centerX - (callsNodes.length - 1) * callsSpacing / 2 + i * callsSpacing - 60;
        const y = centerY + 120;

        // 连线
        g.append('path')
          .attr('class', 'ref-link calls')
          .attr('d', 'M' + centerX + ',' + (centerY + 20) + ' Q' + centerX + ',' + (centerY + 60) + ' ' + (x + 60) + ',' + y)
          .attr('marker-end', 'url(#arrow-down)');

        // 节点
        const node = g.append('g')
          .attr('class', 'symbol-node kind-function')
          .attr('transform', 'translate(' + x + ',' + y + ')');

        node.append('rect')
          .attr('width', 120)
          .attr('height', 40);

        node.append('text')
          .attr('x', 60)
          .attr('y', 25)
          .attr('text-anchor', 'middle')
          .text(ref.symbolName.length > 15 ? ref.symbolName.slice(0, 15) + '...' : ref.symbolName);
      });

      // 添加箭头
      svg.append('defs').append('marker')
        .attr('id', 'arrow-down')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#e94560');

      // 添加说明
      g.append('text')
        .attr('x', 20)
        .attr('y', 30)
        .attr('fill', '#888')
        .attr('font-size', '12px')
        .text('↑ 被以下函数调用');

      g.append('text')
        .attr('x', 20)
        .attr('y', height - 30)
        .attr('fill', '#888')
        .attr('font-size', '12px')
        .text('↓ 调用了以下函数');
    }

    // 导航到符号
    function navigateToSymbol(symbolId) {
      // TODO: 实现跨文件符号导航
      console.log('Navigate to symbol:', symbolId);
    }

    // 渲染入口树（从上到下）
    async function renderEntryTree() {
      const entryId = document.getElementById('entry-point').value;
      const maxDepth = parseInt(document.getElementById('max-depth').value, 10);

      if (!entryId) {
        alert('请先选择入口点');
        return;
      }

      document.querySelector('.loading').style.display = 'block';
      document.querySelector('.loading').textContent = '加载依赖树...';

      try {
        const response = await fetch('/api/dependency-tree?entry=' + encodeURIComponent(entryId) + '&depth=' + maxDepth);
        const tree = await response.json();

        if (tree.error) {
          throw new Error(tree.error);
        }

        document.querySelector('.loading').style.display = 'none';
        drawTree(tree);
      } catch (error) {
        document.querySelector('.loading').textContent = '加载失败: ' + error.message;
      }
    }

    // 绘制树形图
    function drawTree(treeData) {
      const container = document.getElementById('graph-container');
      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      svg.selectAll('*').remove();

      zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);
      g = svg.append('g');

      // 创建层次结构
      const root = d3.hierarchy(treeData);

      // 计算节点数量来调整布局
      const nodeCount = root.descendants().length;
      const dynamicHeight = Math.max(height - 100, nodeCount * 25);

      // 使用树形布局
      const treeLayout = d3.tree()
        .size([dynamicHeight, width - 300])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

      treeLayout(root);

      // 绘制连线
      const links = g.append('g')
        .selectAll('path')
        .data(root.links())
        .join('path')
        .attr('class', 'tree-link')
        .attr('d', d3.linkHorizontal()
          .x(d => d.y + 100)
          .y(d => d.x + 50));

      // 绘制节点
      const nodes = g.append('g')
        .selectAll('g')
        .data(root.descendants())
        .join('g')
        .attr('class', d => {
          let cls = 'tree-node depth-' + Math.min(d.depth, 3);
          if (d.data.isCircular) cls += ' circular';
          return cls;
        })
        .attr('transform', d => 'translate(' + (d.y + 100) + ',' + (d.x + 50) + ')');

      // 节点背景
      nodes.append('rect')
        .attr('x', -60)
        .attr('y', -10)
        .attr('width', 120)
        .attr('height', 20);

      // 节点文字
      nodes.append('text')
        .attr('dy', 4)
        .attr('text-anchor', 'middle')
        .text(d => {
          let name = d.data.name;
          if (d.data.isCircular) name = '↻ ' + name;
          return name.length > 15 ? name.slice(0, 15) + '...' : name;
        });

      // 点击事件
      nodes.on('click', (event, d) => {
        showModuleDetails(d.data.id);
      });

      // 初始缩放以适应视口
      const bounds = g.node().getBBox();
      const fullWidth = bounds.width;
      const fullHeight = bounds.height;
      const midX = bounds.x + fullWidth / 2;
      const midY = bounds.y + fullHeight / 2;

      const scale = 0.8 / Math.max(fullWidth / width, fullHeight / height);
      const translate = [width / 2 - scale * midX, height / 2 - scale * midY];

      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );

      // 显示深度指示器
      document.getElementById('depth-indicator').classList.add('active');
    }

    // 显示模块详情
    function showModuleDetails(moduleId) {
      const module = ontology.modules.find(m => m.id === moduleId);
      if (!module) return;

      const panel = document.getElementById('details-panel');
      panel.classList.add('active');

      const items = [
        '<div class="info-item"><span class="info-label">名称:</span> <span class="info-value">' + module.name + '</span></div>',
        '<div class="info-item"><span class="info-label">路径:</span> <span class="info-value">' + module.id + '</span></div>',
        '<div class="info-item"><span class="info-label">语言:</span> <span class="info-value">' + module.language + '</span></div>',
        '<div class="info-item"><span class="info-label">行数:</span> <span class="info-value">' + module.lines + '</span></div>',
      ];

      if (module.classes) {
        items.push('<div class="info-item"><span class="info-label">类:</span> <span class="info-value">' + module.classes.length + '</span></div>');
      }
      if (module.functions) {
        items.push('<div class="info-item"><span class="info-label">函数:</span> <span class="info-value">' + module.functions.length + '</span></div>');
      }
      if (module.imports) {
        items.push('<div class="info-item"><span class="info-label">导入:</span> <span class="info-value">' + module.imports.length + '</span></div>');
      }

      if (module.semantic) {
        items.push('<hr style="border-color: #0f3460; margin: 0.5rem 0;">');
        items.push('<div class="info-item"><span class="info-label">描述:</span></div>');
        items.push('<div class="info-item" style="color: #aaa; font-size: 0.8rem;">' + (module.semantic.description || 'N/A') + '</div>');
        if (module.semantic.architectureLayer) {
          items.push('<div class="info-item"><span class="info-label">架构层:</span> <span class="info-value">' + module.semantic.architectureLayer + '</span></div>');
        }
        if (module.semantic.tags && module.semantic.tags.length > 0) {
          items.push('<div class="info-item"><span class="info-label">标签:</span> <span class="info-value">' + module.semantic.tags.join(', ') + '</span></div>');
        }
      }

      document.getElementById('node-details').innerHTML = items.join('');
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
          resultsEl.innerHTML = html || '<div class="search-result-item">无结果</div>';
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

    // 隐藏所有视图指示器
    function hideAllIndicators() {
      document.getElementById('entry-selector').classList.remove('active');
      document.getElementById('depth-indicator').classList.remove('active');
      document.getElementById('arch-legend').classList.remove('active');
      document.getElementById('project-header').classList.remove('active');
      document.getElementById('symbol-legend').classList.remove('active');
      document.getElementById('flowchart-legend').classList.remove('active');
      document.getElementById('flowchart-title').classList.remove('active');
      document.getElementById('scenario-selector').classList.remove('active');
    }

    // 返回按钮事件
    document.getElementById('back-btn').addEventListener('click', goBack);

    // 视图切换
    document.getElementById('view-mode').addEventListener('change', (e) => {
      currentView = e.target.value;
      hideAllIndicators();
      hideAllViews();

      // 清除下钻状态
      drillStack = [];
      currentDrillLevel = null;
      updateBreadcrumb();

      if (simulation) simulation.stop();

      if (currentView === 'story') {
        if (ontology.isEnhanced) {
          renderStoryView();
        } else {
          alert('业务故事需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'reading') {
        if (ontology.isEnhanced) {
          renderReadingView();
        } else {
          alert('代码阅读引擎需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'beginner') {
        if (ontology.isEnhanced) {
          renderBeginnerGuide();
        } else {
          alert('新手导览需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'flowchart') {
        if (ontology.isEnhanced) {
          renderFlowchart();
        } else {
          alert('流程图需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'architecture') {
        if (ontology.isEnhanced) {
          renderArchitecture();
        } else {
          alert('架构图需要增强版格式的 CODE_MAP.json');
          renderGraph();
        }
      } else if (currentView === 'entry-tree') {
        document.getElementById('entry-selector').classList.add('active');
        if (entryPoints.length > 0) {
          renderEntryTree();
        }
      } else {
        renderGraph();
      }
    });

    // 入口点或深度变化时重新渲染
    document.getElementById('entry-point').addEventListener('change', () => {
      if (currentView === 'entry-tree') {
        renderEntryTree();
      }
    });
    document.getElementById('max-depth').addEventListener('change', () => {
      if (currentView === 'entry-tree') {
        renderEntryTree();
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