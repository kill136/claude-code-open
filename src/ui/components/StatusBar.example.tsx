/**
 * StatusBar 使用示例
 * 展示如何在应用中集成增强的 StatusBar 组件
 */

import React from 'react';
import { StatusBar } from './StatusBar.js';
import { render } from 'ink';

// 示例 1: 基础使用
const BasicExample = () => {
  return (
    <StatusBar
      messageCount={10}
      tokenCount={5234}
      cost="$0.0234"
      duration={125000}
      isProcessing={false}
    />
  );
};

// 示例 2: 完整功能展示
const FullExample = () => {
  return (
    <StatusBar
      // 基础信息
      messageCount={42}
      inputTokens={125000}
      outputTokens={45000}
      cost="$0.1523"
      duration={3600000} // 1 小时
      isProcessing={true}

      // 模型信息
      model="claude-sonnet-4.5-20241022"
      modelDisplayName="sonnet-4.5"

      // 上下文使用
      contextUsed={120000}
      contextMax={180000}
      contextPercentage={66.67}

      // 网络状态
      networkStatus="online"
      lastApiCall={Date.now() - 2000}

      // 权限模式
      permissionMode="acceptEdits"

      // Git 信息
      gitBranch="feature/status-bar-enhancement"

      // 工作目录
      cwd="/home/user/claude-code-open"
    />
  );
};

// 示例 3: 高负载状态（接近上下文限制）
const HighLoadExample = () => {
  return (
    <StatusBar
      messageCount={150}
      inputTokens={1500000}
      outputTokens={500000}
      cost="$1.7234"
      duration={7200000} // 2 小时
      isProcessing={false}
      model="claude-opus-4.5-20251101"
      modelDisplayName="opus-4.5"
      contextUsed={162000}
      contextMax={180000}
      contextPercentage={90}
      networkStatus="online"
      permissionMode="plan"
      gitBranch="main"
      cwd="/home/user/projects/my-awesome-project"
    />
  );
};

// 示例 4: 错误状态
const ErrorExample = () => {
  return (
    <StatusBar
      messageCount={5}
      tokenCount={1200}
      cost="$0.0045"
      duration={15000}
      isProcessing={false}
      model="claude-sonnet-4.5-20241022"
      networkStatus="error"
      permissionMode="default"
      gitBranch="hotfix/api-connection"
      cwd="/home/user/debugging"
    />
  );
};

// 示例 5: 集成到实际应用中
interface AppState {
  session: {
    messageCount: number;
    inputTokens: number;
    outputTokens: number;
    startTime: number;
    totalCost: number;
  };
  config: {
    model: string;
    permissionMode: string;
    cwd: string;
  };
  context: {
    used: number;
    max: number;
  };
  network: {
    status: 'online' | 'offline' | 'error';
  };
  git: {
    branch?: string;
  };
  isProcessing: boolean;
}

const IntegratedExample: React.FC<{ state: AppState }> = ({ state }) => {
  const contextPercentage = (state.context.used / state.context.max) * 100;
  const duration = Date.now() - state.session.startTime;

  return (
    <StatusBar
      // 会话数据
      messageCount={state.session.messageCount}
      inputTokens={state.session.inputTokens}
      outputTokens={state.session.outputTokens}
      cost={`$${state.session.totalCost.toFixed(4)}`}
      duration={duration}
      isProcessing={state.isProcessing}

      // 配置数据
      model={state.config.model}
      permissionMode={state.config.permissionMode}
      cwd={state.config.cwd}

      // 上下文数据
      contextUsed={state.context.used}
      contextMax={state.context.max}
      contextPercentage={contextPercentage}

      // 网络状态
      networkStatus={state.network.status}

      // Git 信息
      gitBranch={state.git.branch}
    />
  );
};

// 如果直接运行这个文件，渲染完整示例
if (import.meta.url === `file://${process.argv[1]}`) {
  render(<FullExample />);
}

export {
  BasicExample,
  FullExample,
  HighLoadExample,
  ErrorExample,
  IntegratedExample,
};
