/**
 * WelcomeScreen 组件
 * 仿官方 Claude Code 的欢迎界面
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';

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
    timestamp: Date;
  }>;
  tips?: string[];
}

// 官方 Claude 可爱机器人 ASCII 艺术 (clawd mascot)
const ClawdMascot: React.FC<{ animate?: boolean }> = ({ animate = true }) => {
  const [sparkleFrame, setSparkleFrame] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => {
      setSparkleFrame(f => (f + 1) % 4);
    }, 500);
    return () => clearInterval(timer);
  }, [animate]);

  // 四种闪烁状态的星星位置
  const sparklePatterns = [
    { left: '*', right: '*', leftOuter: ' ', rightOuter: ' ' },
    { left: ' ', right: '*', leftOuter: '*', rightOuter: ' ' },
    { left: '*', right: ' ', leftOuter: ' ', rightOuter: '*' },
    { left: ' ', right: ' ', leftOuter: '*', rightOuter: '*' },
  ];
  const sp = sparklePatterns[sparkleFrame];

  return (
    <Box flexDirection="column" alignItems="center">
      {/* 星星行 */}
      <Text>
        <Text color="cyan">{sp.leftOuter}</Text>
        <Text>   </Text>
        <Text color="cyan">{sp.left}</Text>
        <Text>     </Text>
        <Text color="cyan">{sp.right}</Text>
        <Text>   </Text>
        <Text color="cyan">{sp.rightOuter}</Text>
      </Text>
      {/* 机器人头部 */}
      <Text>
        <Text color="cyan"> </Text>
        <Text color="cyan" backgroundColor="cyanBright">▐</Text>
        <Text color="cyan" backgroundColor="blue">▛███▜</Text>
        <Text color="cyan" backgroundColor="cyanBright">▌</Text>
      </Text>
      {/* 机器人身体 */}
      <Text>
        <Text color="cyan">▝▜</Text>
        <Text color="cyan" backgroundColor="blue">█████</Text>
        <Text color="cyan">▛▘</Text>
      </Text>
      {/* 机器人脚 */}
      <Text color="cyan">  ▘▘ ▝▝  </Text>
    </Box>
  );
};

// 分隔线组件
const Divider: React.FC<{ width?: number }> = ({ width = 40 }) => (
  <Box marginY={0}>
    <Text color="red">{'─'.repeat(width)}</Text>
  </Box>
);

// 计算终端宽度
const useTerminalWidth = () => {
  const { stdout } = useStdout();
  return stdout?.columns || 80;
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  version,
  username,
  model,
  apiType = 'Claude API',
  organization,
  cwd,
  recentActivity = [],
  tips = [],
}) => {
  const terminalWidth = useTerminalWidth();

  const defaultTips = [
    'Run /init to create a CLAUDE.md file with instructions for Cla...',
  ];

  const displayTips = tips.length > 0 ? tips : defaultTips;

  // 计算布局宽度
  const totalWidth = Math.min(terminalWidth - 2, 100);
  const leftPanelWidth = Math.floor(totalWidth * 0.45);
  const rightPanelWidth = Math.floor(totalWidth * 0.55);
  const innerRightWidth = rightPanelWidth - 4; // 减去边框和padding

  // 欢迎消息
  const welcomeMessage = username
    ? `Welcome back ${username}!`
    : 'Welcome to Claude Code!';

  // 格式化工作目录 (截断过长路径)
  const formatCwd = (path: string) => {
    if (path.length <= leftPanelWidth - 6) return path;
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 2) return path;
    return `.../${parts.slice(-2).join('/')}`;
  };

  return (
    <Box flexDirection="row" width={totalWidth}>
      {/* 左侧面板 - 欢迎信息和机器人 */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="red"
        paddingX={2}
        paddingY={1}
        width={leftPanelWidth}
      >
        {/* 标题 */}
        <Box marginBottom={1}>
          <Text color="red" bold>
            Claude Code
          </Text>
          <Text color="gray"> v{version}</Text>
        </Box>

        {/* 欢迎语 */}
        <Box justifyContent="center" marginBottom={1}>
          <Text bold>{welcomeMessage}</Text>
        </Box>

        {/* 机器人 ASCII 艺术 */}
        <Box justifyContent="center" marginY={1}>
          <ClawdMascot animate={true} />
        </Box>

        {/* 模型和 API 信息 */}
        <Box justifyContent="center" marginTop={1}>
          <Text color="cyan">{model}</Text>
          <Text color="gray"> · </Text>
          <Text color="gray">{apiType}</Text>
          {organization && (
            <>
              <Text color="gray"> · </Text>
              <Text color="gray">{organization}</Text>
            </>
          )}
        </Box>

        {/* 工作目录 */}
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray">{formatCwd(cwd)}</Text>
        </Box>
      </Box>

      {/* 右侧面板 - Tips 和 Recent Activity */}
      <Box flexDirection="column" width={rightPanelWidth} paddingLeft={1}>
        {/* Tips 面板 */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="red"
          paddingX={2}
          paddingY={1}
          marginBottom={1}
        >
          <Text color="red" bold>
            Tips for getting started
          </Text>
          <Divider width={innerRightWidth} />
          {displayTips.slice(0, 3).map((tip, i) => (
            <Text key={i} color="gray" wrap="truncate">
              {tip.length > innerRightWidth ? tip.slice(0, innerRightWidth - 3) + '...' : tip}
            </Text>
          ))}
        </Box>

        {/* Recent Activity 面板 */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="red"
          paddingX={2}
          paddingY={1}
        >
          <Text color="red" bold>
            Recent activity
          </Text>
          <Divider width={innerRightWidth} />
          {recentActivity.length > 0 ? (
            recentActivity.slice(0, 3).map((activity, i) => (
              <Text key={activity.id} color="gray" wrap="truncate">
                {activity.description.length > innerRightWidth
                  ? activity.description.slice(0, innerRightWidth - 3) + '...'
                  : activity.description}
              </Text>
            ))
          ) : (
            <Text color="gray" dimColor>
              No recent activity
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default WelcomeScreen;
