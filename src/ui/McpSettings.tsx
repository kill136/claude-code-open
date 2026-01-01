/**
 * MCP 设置 UI 组件
 * 完全对齐官方 Claude Code 的交互式界面
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 图标常量
const ICONS = {
  tick: '✓',
  cross: '✗',
  radioOff: '○',
  pointer: '❯',
  arrowDown: '↓',
};

interface McpRuntimeState {
  connected: boolean;
  connecting: boolean;
  tools: Array<{ name: string; description?: string }>;
  resources: Array<{ uri: string; name: string }>;
  config: Record<string, unknown>;
}

interface McpSettingsProps {
  onDone: () => void;
  cwd?: string;
  runtimeState?: Record<string, McpRuntimeState>;
}

interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: 'stdio' | 'http' | 'sse';
  url?: string;
  headers?: Record<string, string>;
}

interface McpTool {
  name: string;
  serverName: string;
  description?: string;
  isReadOnly?: boolean;
  isDestructive?: boolean;
  isOpenWorld?: boolean;
}

interface McpServerEntry {
  name: string;
  config: McpServerConfig;
  scope: 'user' | 'project' | 'local' | 'dynamic';
  status: 'connected' | 'disconnected' | 'pending' | 'failed' | 'disabled';
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
  tools: McpTool[];
}

type ViewMode = 'list' | 'detail' | 'tools' | 'toolDetail';

/**
 * 获取配置文件的路径说明
 */
function getScopeDescription(scope: string): string {
  switch (scope) {
    case 'user':
      return 'User config (available in all your projects)';
    case 'project':
      return 'Project config (shared via .mcp.json)';
    case 'local':
      return 'Local config (private to you in this project)';
    case 'dynamic':
      return 'Dynamically configured';
    default:
      return scope;
  }
}

/**
 * 获取配置文件路径显示
 */
function getConfigPathDisplay(scope: string, cwd: string): string {
  const homeDir = os.homedir();
  switch (scope) {
    case 'user':
      return path.join(homeDir, '.claude.json');
    case 'project':
      return path.join(cwd, '.mcp.json');
    case 'local':
      return `${path.join(homeDir, '.claude.json')} [project: ${cwd}]`;
    case 'dynamic':
      return 'Dynamically configured';
    default:
      return '';
  }
}

/**
 * 加载 MCP 配置
 */
function loadMcpConfig(filePath: string): Record<string, McpServerConfig> {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content);
      return config.mcpServers || {};
    }
  } catch {
    // 忽略解析错误
  }
  return {};
}

/**
 * 格式化工具名称显示 - 对齐官方实现
 * 例如: "Claude in Chrome[javascript_tool]"
 */
function formatToolName(toolName: string, serverName: string): string {
  // 移除服务器前缀，获取纯工具名
  const prefix = `mcp__${serverName}__`;
  const shortName = toolName.startsWith(prefix)
    ? toolName.substring(prefix.length)
    : toolName;

  // 格式化服务器名为标题格式
  const displayServerName = serverName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `${displayServerName}[${shortName}]`;
}

/**
 * Capabilities 显示组件
 */
function Capabilities({
  toolsCount,
  promptsCount,
  resourcesCount,
}: {
  toolsCount: number;
  promptsCount: number;
  resourcesCount: number;
}): React.ReactElement {
  const caps: string[] = [];
  if (toolsCount > 0) caps.push('tools');
  if (resourcesCount > 0) caps.push('resources');
  if (promptsCount > 0) caps.push('prompts');

  return (
    <Box>
      <Text bold>Capabilities: </Text>
      <Text>{caps.length > 0 ? caps.join(', ') : 'none'}</Text>
    </Box>
  );
}

/**
 * MCP 工具详情页
 */
function McpToolDetail({
  tool,
  server,
  onBack,
}: {
  tool: McpTool;
  server: McpServerEntry;
  onBack: () => void;
}): React.ReactElement {
  // 键盘处理
  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  const displayName = formatToolName(tool.name, server.name);

  // 获取纯工具名
  const prefix = `mcp__${server.name}__`;
  const shortName = tool.name.startsWith(prefix)
    ? tool.name.substring(prefix.length)
    : tool.name;

  return (
    <Box flexDirection="column">
      {/* 工具详情卡片 */}
      <Box
        flexDirection="column"
        paddingX={1}
        borderStyle="round"
        borderColor="gray"
      >
        {/* 标题 */}
        <Box marginBottom={1}>
          <Text bold>{displayName}</Text>
          <Text dimColor> ({server.name})</Text>
          {tool.isReadOnly && <Text color="green"> [read-only]</Text>}
          {tool.isDestructive && <Text color="red"> [destructive]</Text>}
          {tool.isOpenWorld && <Text dimColor> [open-world]</Text>}
        </Box>

        {/* 详情信息 */}
        <Box flexDirection="column">
          <Box>
            <Text bold>Tool name: </Text>
            <Text dimColor>{shortName}</Text>
          </Box>
          <Box>
            <Text bold>Full name: </Text>
            <Text dimColor>{tool.name}</Text>
          </Box>
          {tool.description && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>Description:</Text>
              <Text wrap="wrap">{tool.description}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* 底部提示 */}
      <Box marginLeft={3} marginTop={1}>
        <Text dimColor>Esc to go back</Text>
      </Box>
    </Box>
  );
}

/**
 * MCP 工具列表页
 */
function McpToolsList({
  server,
  onSelectTool,
  onBack,
}: {
  server: McpServerEntry;
  onSelectTool: (tool: McpTool, index: number) => void;
  onBack: () => void;
}): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const tools = server.tools || [];

  // 键盘处理
  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(tools.length - 1, prev + 1));
    } else if (key.return) {
      const tool = tools[selectedIndex];
      if (tool) {
        onSelectTool(tool, selectedIndex);
      }
    }
  });

  // 显示更多指示器
  const hasMore = tools.length > 5;
  const showMoreIndicator = hasMore && selectedIndex < tools.length - 1;

  return (
    <Box flexDirection="column">
      {/* 工具列表卡片 */}
      <Box
        flexDirection="column"
        paddingX={1}
        borderStyle="round"
        borderColor="gray"
      >
        {/* 标题 */}
        <Box marginBottom={1}>
          <Text bold>Tools for {server.name}</Text>
          <Text dimColor> ({tools.length} tools)</Text>
        </Box>

        {/* 工具列表 */}
        {tools.length === 0 ? (
          <Text dimColor>No tools available</Text>
        ) : (
          <Box flexDirection="column">
            {tools.map((tool, index) => {
              const displayName = formatToolName(tool.name, server.name);
              const tags: string[] = [];
              if (tool.isReadOnly) tags.push('read-only');
              if (tool.isDestructive) tags.push('destructive');
              if (tool.isOpenWorld) tags.push('open-world');

              // 显示滚动指示器
              const showScrollIndicator = showMoreIndicator && index === tools.length - 1;

              return (
                <Box key={tool.name}>
                  <Text color={index === selectedIndex ? 'cyan' : undefined}>
                    {showScrollIndicator ? `${ICONS.arrowDown} ` : index === selectedIndex ? `${ICONS.pointer} ` : '  '}
                    {index + 1}. {displayName}
                    {tags.length > 0 && (
                      <Text
                        color={
                          tool.isDestructive
                            ? 'red'
                            : tool.isReadOnly
                            ? 'green'
                            : undefined
                        }
                        dimColor={!tool.isDestructive && !tool.isReadOnly}
                      >
                        {' '}
                        [{tags.join(', ')}]
                      </Text>
                    )}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* 底部提示 */}
      <Box marginLeft={3} marginTop={1}>
        <Text dimColor>Esc to go back</Text>
      </Box>
    </Box>
  );
}

/**
 * MCP 服务器详情页
 */
function McpServerDetail({
  server,
  onBack,
  onViewTools,
  onReconnect,
  onToggleEnabled,
  isReconnecting,
}: {
  server: McpServerEntry;
  onBack: () => void;
  onViewTools: () => void;
  onReconnect: () => void;
  onToggleEnabled: () => void;
  isReconnecting?: boolean;
}): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 构建菜单选项
  const menuOptions: Array<{ label: string; value: string }> = [];

  if (server.status !== 'disabled' && server.toolsCount > 0) {
    menuOptions.push({ label: 'View tools', value: 'tools' });
  }
  if (server.status !== 'disabled') {
    menuOptions.push({ label: 'Reconnect', value: 'reconnect' });
  }
  menuOptions.push({
    label: server.status !== 'disabled' ? 'Disable' : 'Enable',
    value: 'toggle',
  });

  // 键盘处理
  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(menuOptions.length - 1, prev + 1));
    } else if (key.return) {
      const selected = menuOptions[selectedIndex];
      if (selected) {
        if (selected.value === 'tools') {
          onViewTools();
        } else if (selected.value === 'reconnect') {
          onReconnect();
        } else if (selected.value === 'toggle') {
          onToggleEnabled();
        }
      }
    }
  });

  // 首字母大写的服务器名
  const displayName =
    server.name.charAt(0).toUpperCase() + server.name.slice(1);

  // 状态图标和文字
  const getStatusDisplay = () => {
    switch (server.status) {
      case 'connected':
        return (
          <Text>
            <Text color="green">{ICONS.tick}</Text> connected
          </Text>
        );
      case 'disabled':
        return (
          <Text>
            <Text dimColor>{ICONS.radioOff}</Text> disabled
          </Text>
        );
      case 'pending':
        return (
          <Text>
            <Text dimColor>{ICONS.radioOff}</Text> connecting…
          </Text>
        );
      case 'failed':
        return (
          <Text>
            <Text color="red">{ICONS.cross}</Text> failed
          </Text>
        );
      default:
        return (
          <Text>
            <Text dimColor>{ICONS.radioOff}</Text> disconnected
          </Text>
        );
    }
  };

  if (isReconnecting) {
    return (
      <Box flexDirection="column" gap={1} padding={1}>
        <Text>
          Reconnecting to <Text bold>{server.name}</Text>
        </Text>
        <Box>
          <Text color="cyan">◐</Text>
          <Text> Restarting MCP server process</Text>
        </Box>
        <Text dimColor>This may take a few moments.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* 服务器详情卡片 */}
      <Box
        flexDirection="column"
        paddingX={1}
        borderStyle="round"
        borderColor="gray"
      >
        {/* 标题 */}
        <Box marginBottom={1}>
          <Text bold>{displayName} MCP Server</Text>
        </Box>

        {/* 详情信息 */}
        <Box flexDirection="column">
          {/* Status */}
          <Box>
            <Text bold>Status: </Text>
            {getStatusDisplay()}
          </Box>

          {/* Command */}
          {server.config.command && (
            <Box>
              <Text bold>Command: </Text>
              <Text dimColor>{server.config.command}</Text>
            </Box>
          )}

          {/* Args */}
          {server.config.args && server.config.args.length > 0 && (
            <Box>
              <Text bold>Args: </Text>
              <Text dimColor>{server.config.args.join(' ')}</Text>
            </Box>
          )}

          {/* URL (for http/sse) */}
          {server.config.url && (
            <Box>
              <Text bold>URL: </Text>
              <Text dimColor>{server.config.url}</Text>
            </Box>
          )}

          {/* Config location */}
          <Box>
            <Text bold>Config location: </Text>
            <Text dimColor>{getScopeDescription(server.scope)}</Text>
          </Box>

          {/* Capabilities */}
          {server.status === 'connected' && (
            <Capabilities
              toolsCount={server.toolsCount}
              promptsCount={server.promptsCount}
              resourcesCount={server.resourcesCount}
            />
          )}

          {/* Tools count */}
          {server.status === 'connected' && server.toolsCount > 0 && (
            <Box>
              <Text bold>Tools: </Text>
              <Text dimColor>{server.toolsCount} tools</Text>
            </Box>
          )}
        </Box>

        {/* 菜单选项 */}
        {menuOptions.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            {menuOptions.map((option, index) => (
              <Box key={option.value}>
                <Text color={index === selectedIndex ? 'cyan' : undefined}>
                  {index === selectedIndex ? `${ICONS.pointer} ` : '  '}
                  {index + 1}. {option.label}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* 底部提示 */}
      <Box marginLeft={3} marginTop={1}>
        <Text dimColor>Esc to go back</Text>
      </Box>
    </Box>
  );
}

/**
 * MCP 设置主界面 - 服务器列表
 */
export function McpSettings({
  onDone,
  cwd = process.cwd(),
  runtimeState: propRuntimeState,
}: McpSettingsProps): React.ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedServer, setSelectedServer] = useState<McpServerEntry | null>(null);
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const homeDir = os.homedir();
  const userConfigPath = path.join(homeDir, '.claude.json');
  const projectConfigPath = path.join(cwd, '.mcp.json');
  const localConfigPath = path.join(homeDir, '.claude', 'settings.json');

  // 加载服务器配置
  useEffect(() => {
    const loadServers = async () => {
      const allServers: McpServerEntry[] = [];

      // 使用传入的运行时状态（优先）或尝试动态获取
      let runtimeServers: Record<string, McpRuntimeState> | null = propRuntimeState || null;

      // 如果没有传入运行时状态，尝试从模块获取（可能不会有数据）
      if (!runtimeServers) {
        try {
          const mcpModule = await import('../tools/mcp.js');
          const mcpMap = mcpModule.getMcpServers?.();
          if (mcpMap && mcpMap.size > 0) {
            runtimeServers = {};
            for (const [name, state] of mcpMap) {
              runtimeServers[name] = {
                connected: state.connected,
                connecting: state.connecting,
                tools: state.tools || [],
                resources: state.resources || [],
                config: { ...state.config } as Record<string, unknown>,
              };
            }
          }
        } catch {
          // 忽略导入错误
        }
      }

      // 辅助函数：从运行时状态获取服务器信息
      const getRuntimeInfo = (name: string) => {
        const state = runtimeServers?.[name];
        return {
          status: state?.connected
            ? 'connected' as const
            : state?.connecting
            ? 'pending' as const
            : 'disconnected' as const,
          toolsCount: state?.tools?.length || 0,
          resourcesCount: state?.resources?.length || 0,
          tools: (state?.tools || []).map((t: any) => ({
            name: t.name ? `mcp__${name}__${t.name}` : (typeof t === 'string' ? t : t.name),
            serverName: name,
            description: t.description,
            isReadOnly: t.isReadOnly,
            isDestructive: t.isDestructive,
            isOpenWorld: t.isOpenWorld,
          })),
        };
      };

      // 加载用户配置
      const userConfig = loadMcpConfig(userConfigPath);
      for (const [name, config] of Object.entries(userConfig)) {
        const info = getRuntimeInfo(name);
        allServers.push({
          name,
          config,
          scope: 'user',
          status: info.status,
          toolsCount: info.toolsCount,
          resourcesCount: info.resourcesCount,
          promptsCount: 0,
          tools: info.tools,
        });
      }

      // 加载项目配置
      const projectConfig = loadMcpConfig(projectConfigPath);
      for (const [name, config] of Object.entries(projectConfig)) {
        if (!allServers.some((s) => s.name === name)) {
          const info = getRuntimeInfo(name);
          allServers.push({
            name,
            config,
            scope: 'project',
            status: info.status,
            toolsCount: info.toolsCount,
            resourcesCount: info.resourcesCount,
            promptsCount: 0,
            tools: info.tools,
          });
        }
      }

      // 加载本地配置
      const localConfig = loadMcpConfig(localConfigPath);
      for (const [name, config] of Object.entries(localConfig)) {
        if (!allServers.some((s) => s.name === name)) {
          const info = getRuntimeInfo(name);
          allServers.push({
            name,
            config,
            scope: 'local',
            status: info.status,
            toolsCount: info.toolsCount,
            resourcesCount: info.resourcesCount,
            promptsCount: 0,
            tools: info.tools,
          });
        }
      }

      // 检查运行时是否有动态添加的服务器（不在配置文件中）
      if (runtimeServers) {
        for (const [name, state] of Object.entries(runtimeServers)) {
          if (!allServers.some((s) => s.name === name)) {
            const info = getRuntimeInfo(name);
            allServers.push({
              name,
              config: (state.config || {}) as McpServerConfig,
              scope: 'dynamic',
              status: info.status,
              toolsCount: info.toolsCount,
              resourcesCount: info.resourcesCount,
              promptsCount: 0,
              tools: info.tools,
            });
          }
        }
      }

      setServers(allServers);
      setLoading(false);
    };

    loadServers();
  }, [userConfigPath, projectConfigPath, localConfigPath, propRuntimeState]);

  // 构建服务器选项列表
  const serverOptions = useMemo(() => {
    return servers.map((server) => {
      const statusIcon =
        server.status === 'connected'
          ? `${ICONS.tick} connected`
          : server.status === 'disabled'
          ? `${ICONS.radioOff} disabled`
          : server.status === 'failed'
          ? `${ICONS.cross} failed`
          : `${ICONS.radioOff} disconnected`;

      return {
        label: `${server.name}  ${statusIcon} · Enter to view details`,
        value: server.name,
      };
    });
  }, [servers]);

  // 处理选择
  const handleSelect = useCallback(
    (value: string) => {
      const server = servers.find((s) => s.name === value);
      if (server) {
        setSelectedServer(server);
        setViewMode('detail');
      }
    },
    [servers]
  );

  // 键盘处理（列表模式）
  useInput(
    (input, key) => {
      if (viewMode !== 'list') return;

      if (key.escape) {
        onDone();
        return;
      }

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) =>
          Math.min(serverOptions.length - 1, prev + 1)
        );
      } else if (key.return) {
        const selected = serverOptions[selectedIndex];
        if (selected) {
          handleSelect(selected.value);
        }
      }
    },
    { isActive: viewMode === 'list' }
  );

  // 返回列表
  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedServer(null);
    setSelectedTool(null);
    setMessage(null);
  }, []);

  // 返回详情
  const handleBackToDetail = useCallback(() => {
    setViewMode('detail');
    setSelectedTool(null);
  }, []);

  // 返回工具列表
  const handleBackToTools = useCallback(() => {
    setViewMode('tools');
    setSelectedTool(null);
  }, []);

  // 处理重连
  const handleReconnect = useCallback(async () => {
    if (!selectedServer) return;

    setReconnecting(true);
    setMessage('Starting reconnect...');
    console.log('[MCP Reconnect] Starting reconnect for:', selectedServer.name);
    console.log('[MCP Reconnect] Server config:', JSON.stringify(selectedServer.config, null, 2));

    try {
      const mcpModule = await import('../tools/mcp.js');

      // 先断开现有连接（如果有的话）
      if (mcpModule.disconnectMcpServer) {
        try {
          console.log('[MCP Reconnect] Disconnecting existing connection...');
          await mcpModule.disconnectMcpServer(selectedServer.name);
        } catch {
          // 忽略断开失败
        }
      }

      // 确保服务器已注册（解决模块实例问题）
      // 由于模块实例问题，运行时 Map 可能是空的，需要先注册服务器
      if (mcpModule.registerMcpServer && selectedServer.config) {
        const serverConfig = {
          type: selectedServer.config.type || 'stdio',
          command: selectedServer.config.command,
          args: selectedServer.config.args,
          env: selectedServer.config.env,
          url: selectedServer.config.url,
        };
        console.log('[MCP Reconnect] Registering server with config:', JSON.stringify(serverConfig, null, 2));
        setMessage(`Registering server with command: ${serverConfig.command}, args: ${JSON.stringify(serverConfig.args)}`);
        mcpModule.registerMcpServer(selectedServer.name, serverConfig);
      }

      // 重新连接（设置较短超时以便快速响应）
      console.log('[MCP Reconnect] Connecting to MCP server...');
      setMessage('Connecting to MCP server...');
      if (mcpModule.connectMcpServer) {
        // 使用 Promise.race 添加客户端超时
        const timeoutMs = 15000; // 15 秒超时
        const connectPromise = mcpModule.connectMcpServer(selectedServer.name, false); // false = 不重试
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => {
            console.log('[MCP Reconnect] Client-side timeout reached (15s)');
            resolve(false);
          }, timeoutMs);
        });

        const connected = await Promise.race([connectPromise, timeoutPromise]);
        console.log('[MCP Reconnect] Connection result:', connected);
        if (connected) {
          console.log('[MCP Reconnect] SUCCESS - Reconnected to', selectedServer.name);
          setMessage(`Reconnected to ${selectedServer.name}.`);
          // 更新服务器状态
          setServers((prev) =>
            prev.map((s) =>
              s.name === selectedServer.name
                ? { ...s, status: 'connected' as const }
                : s
            )
          );
        } else {
          console.log('[MCP Reconnect] FAILED - Could not reconnect to', selectedServer.name);
          setMessage(`Failed to reconnect to ${selectedServer.name}.`);
          setServers((prev) =>
            prev.map((s) =>
              s.name === selectedServer.name
                ? { ...s, status: 'failed' as const }
                : s
            )
          );
        }
      }
    } catch (err) {
      console.error('[MCP Reconnect] Error:', err);
      setMessage(
        `Failed to reconnect: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      console.log('[MCP Reconnect] Finished, returning to list');
      setReconnecting(false);
      handleBackToList();
    }
  }, [selectedServer, handleBackToList]);

  // 处理启用/禁用
  const handleToggleEnabled = useCallback(async () => {
    if (!selectedServer) return;
    const isEnabled = selectedServer.status !== 'disabled';
    setMessage(
      `${selectedServer.name} has been ${isEnabled ? 'disabled' : 'enabled'}.`
    );
    handleBackToList();
  }, [selectedServer, handleBackToList]);

  // 查看工具列表
  const handleViewTools = useCallback(() => {
    if (!selectedServer) return;
    setViewMode('tools');
  }, [selectedServer]);

  // 选择工具查看详情
  const handleSelectTool = useCallback((tool: McpTool) => {
    setSelectedTool(tool);
    setViewMode('toolDetail');
  }, []);

  if (loading) {
    return (
      <Box flexDirection="column">
        <Text bold>Manage MCP servers</Text>
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  // 工具详情视图
  if (viewMode === 'toolDetail' && selectedServer && selectedTool) {
    return (
      <McpToolDetail
        tool={selectedTool}
        server={selectedServer}
        onBack={handleBackToTools}
      />
    );
  }

  // 工具列表视图
  if (viewMode === 'tools' && selectedServer) {
    return (
      <McpToolsList
        server={selectedServer}
        onSelectTool={handleSelectTool}
        onBack={handleBackToDetail}
      />
    );
  }

  // 详情视图
  if (viewMode === 'detail' && selectedServer) {
    return (
      <McpServerDetail
        server={selectedServer}
        onBack={handleBackToList}
        onViewTools={handleViewTools}
        onReconnect={handleReconnect}
        onToggleEnabled={handleToggleEnabled}
        isReconnecting={reconnecting}
      />
    );
  }

  // 列表视图
  return (
    <Box flexDirection="column">
      {/* 标题栏 */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="blue"
        paddingX={1}
      >
        <Text bold>Manage MCP servers</Text>
        <Text dimColor>
          {servers.length} server{servers.length === 1 ? '' : 's'}
        </Text>
      </Box>

      <Box height={1} />

      {/* 消息提示 */}
      {message && (
        <Box marginBottom={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}

      {/* 服务器列表 */}
      {servers.length === 0 ? (
        <Box flexDirection="column" marginLeft={1}>
          <Text dimColor>No MCP servers configured.</Text>
          <Text dimColor>
            Add servers to your configuration files to get started.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {serverOptions.map((option, index) => (
            <Box key={option.value} marginLeft={1}>
              <Text color={index === selectedIndex ? 'cyan' : undefined}>
                {index === selectedIndex ? `${ICONS.pointer} ` : '  '}
                {index + 1}. {option.label}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box height={1} />

      {/* MCP 配置位置说明 */}
      <Box flexDirection="column" marginLeft={1}>
        <Text dimColor>MCP Config locations (by scope):</Text>

        {['user', 'project', 'local'].map((scope) => (
          <Box key={scope} flexDirection="column" marginLeft={1}>
            <Text dimColor>• {getScopeDescription(scope)}:</Text>
            <Box marginLeft={2}>
              <Text dimColor>
                • {getConfigPathDisplay(scope, cwd)}
                {scope === 'project' &&
                  !fs.existsSync(projectConfigPath) &&
                  ' (file does not exist)'}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box height={1} />

      {/* 提示信息 */}
      <Box flexDirection="column" marginLeft={1}>
        <Text dimColor>
          Tip: Use /mcp enable or /mcp disable to quickly toggle all servers
        </Text>
        <Text dimColor>
          For help configuring MCP servers, see:{' '}
          <Text color="blue">https://code.claude.com/docs/en/mcp</Text>
        </Text>
      </Box>

      <Box height={1} />

      {/* 底部提示 */}
      <Text dimColor italic>
        {' '}
        Enter to confirm · Esc to cancel
      </Text>
    </Box>
  );
}

export default McpSettings;
