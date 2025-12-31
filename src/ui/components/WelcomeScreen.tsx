/**
 * WelcomeScreen 组件
 * 仿官方 Claude Code 的欢迎界面
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTerminalWidth } from '../hooks/useTerminalSize.js';

interface WelcomeScreenProps {
  version: string;
  username?: string;
  model: string;
  apiType?: 'Claude API' | 'Bedrock' | 'Vertex';
  organization?: string;
  cwd: string;
  recentActivity?: Array<{
    id: string;
    description: string;
    timestamp: string;
  }>;
  whatsNew?: string[];
}

// 官方 Claude 可爱机器人 ASCII 艺术 (clawd mascot)
// 使用官方的 clawd_body 颜色: rgb(215,119,87) 橙色/三文鱼色
const ClawdMascot: React.FC<{ animate?: boolean }> = ({ animate = true }) => {
  const [sparkleFrame, setSparkleFrame] = useState(0);

  // 官方配色
  const clawdBody = '#D77757'; // rgb(215,119,87)
  const clawdBackground = '#000000'; // rgb(0,0,0)

  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => {
      setSparkleFrame(f => (f + 1) % 4);
    }, 400);
    return () => clearInterval(timer);
  }, [animate]);

  // 四种闪烁状态的星星位置
  const sparklePatterns = [
    { s1: '*', s2: ' ', s3: '*', s4: ' ' },
    { s1: ' ', s2: '*', s3: ' ', s4: '*' },
    { s1: '*', s2: ' ', s3: ' ', s4: '*' },
    { s1: ' ', s2: '*', s3: '*', s4: ' ' },
  ];
  const sp = sparklePatterns[sparkleFrame];

  // 官方 clawd 设计:
  // Line 1:  ▐ + ▛███▜ (with black bg) + ▌
  // Line 2: ▝▜ + █████ (with black bg) + ▛▘
  // Line 3:   ▘▘ ▝▝
  return (
    <Box flexDirection="column" alignItems="center">
      {/* 星星动画行 */}
      <Text>
        <Text color={clawdBody}>{sp.s1}</Text>
        <Text>    </Text>
        <Text color={clawdBody}>{sp.s2}</Text>
      </Text>
      <Text>
        <Text color={clawdBody}>{sp.s3}</Text>
        <Text> </Text>
        <Text color={clawdBody}> ▐</Text>
        <Text color={clawdBody} backgroundColor={clawdBackground}>▛███▜</Text>
        <Text color={clawdBody}>▌ </Text>
        <Text> </Text>
        <Text color={clawdBody}>{sp.s4}</Text>
      </Text>
      {/* 身体行 */}
      <Text>
        <Text color={clawdBody}>  ▝▜</Text>
        <Text color={clawdBody} backgroundColor={clawdBackground}>█████</Text>
        <Text color={clawdBody}>▛▘</Text>
      </Text>
      {/* 脚行 */}
      <Text color={clawdBody}>    ▘▘ ▝▝</Text>
    </Box>
  );
};

// 垂直分隔线组件
const VerticalDivider: React.FC<{ height: number; color?: string }> = ({
  height,
  color = '#D77757'
}) => {
  return (
    <Box flexDirection="column" marginX={1}>
      {Array.from({ length: height }).map((_, i) => (
        <Text key={i} color={color}>│</Text>
      ))}
    </Box>
  );
};

// 注意：useTerminalWidth 已从 hooks/useTerminalSize.js 导入
// 该钩子会响应终端 resize 事件

// 格式化时间戳
const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  version,
  username,
  model,
  apiType = 'Claude API',
  organization,
  cwd,
  recentActivity = [],
  whatsNew = [],
}) => {
  const terminalWidth = useTerminalWidth();

  // 官方颜色
  const claudeColor = '#D77757'; // claude/clawd_body color

  // 默认的 What's new 内容
  const defaultWhatsNew = useMemo(() => [
    'Added LSP (Language Server Protocol) too...',
    'Added `/terminal-setup` support for Kitt...',
    'Added ctrl+t shortcut in `/theme` to tog...',
  ], []);

  const displayWhatsNew = whatsNew.length > 0 ? whatsNew : defaultWhatsNew;

  // 使用 useMemo 缓存布局计算，只在 terminalWidth 变化时重新计算
  const { totalWidth, leftPanelWidth, rightPanelWidth } = useMemo(() => {
    const total = Math.min(terminalWidth - 2, 100);
    return {
      totalWidth: total,
      leftPanelWidth: Math.floor(total * 0.42),
      rightPanelWidth: Math.floor(total * 0.55),
    };
  }, [terminalWidth]);

  // 欢迎消息
  const welcomeMessage = username
    ? `Welcome back ${username}!`
    : 'Welcome to Claude Code!';

  // 格式化工作目录 (截断过长路径)
  const formatCwd = (path: string, maxLen: number) => {
    if (path.length <= maxLen) return path;
    const parts = path.split(/[/\\]/).filter(Boolean);
    if (parts.length <= 2) return path.slice(0, maxLen - 3) + '...';
    return '.../' + parts.slice(-2).join('/');
  };

  // 截断文本
  const truncateText = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
  };

  // 构建标题
  const borderTitle = ` Claude Code v${version} `;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={claudeColor}
      width={totalWidth}
    >
      {/* 顶部标题 */}
      <Box paddingLeft={1}>
        <Text color={claudeColor}> Claude Code</Text>
        <Text dimColor> v{version}</Text>
      </Box>

      {/* 主内容区域 */}
      <Box flexDirection="row" paddingX={1} paddingY={1}>
        {/* 左侧面板 - 欢迎信息和机器人 */}
        <Box
          flexDirection="column"
          width={leftPanelWidth}
          alignItems="center"
          justifyContent="space-between"
        >
          {/* 欢迎语 */}
          <Box marginBottom={1}>
            <Text bold>{welcomeMessage}</Text>
          </Box>

          {/* 机器人 ASCII 艺术 */}
          <Box marginY={1}>
            <ClawdMascot animate={true} />
          </Box>

          {/* 模型和 API 信息 */}
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Text>
              <Text color="cyan">{model}</Text>
              <Text dimColor> · </Text>
              <Text dimColor>{apiType}</Text>
              {organization && (
                <>
                  <Text dimColor> · </Text>
                  <Text dimColor>{organization}</Text>
                </>
              )}
            </Text>
            {/* 工作目录 */}
            <Text dimColor>{formatCwd(cwd, leftPanelWidth - 4)}</Text>
          </Box>
        </Box>

        {/* 垂直分隔线 */}
        <VerticalDivider height={9} color={claudeColor} />

        {/* 右侧面板 - Recent Activity 和 What's new */}
        <Box flexDirection="column" width={rightPanelWidth}>
          {/* Recent Activity */}
          <Box flexDirection="column" marginBottom={1}>
            <Text color={claudeColor} bold>Recent activity</Text>
            {recentActivity.length > 0 ? (
              <>
                {recentActivity.slice(0, 2).map((activity, i) => (
                  <Text key={activity.id} dimColor>
                    <Text>{formatTimeAgo(activity.timestamp)}</Text>
                    <Text>  </Text>
                    <Text>{truncateText(activity.description, rightPanelWidth - 12)}</Text>
                  </Text>
                ))}
                <Text dimColor italic>/resume for more</Text>
              </>
            ) : (
              <Text dimColor>No recent activity</Text>
            )}
          </Box>

          {/* What's new */}
          <Box flexDirection="column">
            <Text color={claudeColor} bold>What's new</Text>
            {displayWhatsNew.slice(0, 3).map((item, i) => (
              <Text key={i} dimColor>
                {truncateText(item, rightPanelWidth - 2)}
              </Text>
            ))}
            <Text dimColor italic>/release-notes for more</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default WelcomeScreen;
