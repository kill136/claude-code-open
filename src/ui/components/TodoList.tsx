/**
 * TodoList 组件 - 增强版
 * 基于官方 Claude Code CLI v2.0.76 实现
 *
 * 功能:
 * - 三种状态支持: pending, in_progress, completed
 * - activeForm 动态描述显示
 * - 进度条和完成百分比
 * - 任务分组显示
 * - 键盘导航支持
 * - 动画过渡效果
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { TodoItem } from '../../types/index.js';

interface TodoListProps {
  todos: TodoItem[];
  showCompleted?: boolean;
  enableKeyboardNav?: boolean;
  showProgressBar?: boolean;
  groupByStatus?: boolean;
  animationDelay?: number;
}

/**
 * 进度条组件
 */
const ProgressBar: React.FC<{ current: number; total: number; width?: number }> = ({
  current,
  total,
  width = 40,
}) => {
  const percentage = total === 0 ? 0 : Math.round((current / total) * 100);
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan" bold>
          Progress: {current}/{total} ({percentage}%)
        </Text>
      </Box>
      <Box>
        <Text color="green">{'█'.repeat(filledWidth)}</Text>
        <Text color="gray">{'░'.repeat(emptyWidth)}</Text>
      </Box>
    </Box>
  );
};

/**
 * 任务项组件
 */
const TodoItemComponent: React.FC<{
  todo: TodoItem;
  isSelected: boolean;
  animationDelay: number;
  index: number;
}> = ({ todo, isSelected, animationDelay, index }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, index * animationDelay);

    return () => clearTimeout(timer);
  }, [index, animationDelay]);

  if (!isVisible) {
    return null;
  }

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'pending':
        return '○';
      case 'in_progress':
        return '◐';
      case 'completed':
        return '●';
    }
  };

  const getStatusColor = (status: TodoItem['status']) => {
    switch (status) {
      case 'pending':
        return 'gray';
      case 'in_progress':
        return 'yellow';
      case 'completed':
        return 'green';
    }
  };

  const displayText = todo.status === 'in_progress' ? todo.activeForm : todo.content;
  const statusColor = getStatusColor(todo.status);
  const statusIcon = getStatusIcon(todo.status);

  return (
    <Box>
      {isSelected && <Text color="cyan" bold>▶ </Text>}
      {!isSelected && <Text>  </Text>}
      <Text color={statusColor}>{statusIcon}</Text>
      <Text> </Text>
      <Text color={statusColor} dimColor={todo.status === 'completed'}>
        {displayText}
      </Text>
    </Box>
  );
};

/**
 * 任务分组组件
 */
const TodoGroup: React.FC<{
  title: string;
  todos: TodoItem[];
  selectedIndex: number;
  startIndex: number;
  animationDelay: number;
}> = ({ title, todos, selectedIndex, startIndex, animationDelay }) => {
  if (todos.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="white">
        {title} ({todos.length})
      </Text>
      {todos.map((todo, index) => (
        <TodoItemComponent
          key={startIndex + index}
          todo={todo}
          isSelected={selectedIndex === startIndex + index}
          animationDelay={animationDelay}
          index={startIndex + index}
        />
      ))}
    </Box>
  );
};

export const TodoList: React.FC<TodoListProps> = ({
  todos,
  showCompleted = false,
  enableKeyboardNav = true,
  showProgressBar = true,
  groupByStatus = true,
  animationDelay = 50,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 过滤任务
  const filteredTodos = showCompleted ? todos : todos.filter((t) => t.status !== 'completed');

  // 键盘导航
  useInput(
    (input, key) => {
      if (!enableKeyboardNav) return;

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(filteredTodos.length - 1, prev + 1));
      }
    },
    { isActive: enableKeyboardNav && filteredTodos.length > 0 }
  );

  if (filteredTodos.length === 0) {
    return null;
  }

  // 计算统计数据
  const totalTodos = todos.length;
  const completedTodos = todos.filter((t) => t.status === 'completed').length;
  const inProgressTodos = todos.filter((t) => t.status === 'in_progress');
  const pendingTodos = todos.filter((t) => t.status === 'pending');
  const completedTodosInList = todos.filter((t) => t.status === 'completed');

  // 按状态分组
  if (groupByStatus) {
    let currentIndex = 0;

    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        marginY={1}
      >
        <Text bold color="cyan">
          Tasks
        </Text>

        {showProgressBar && (
          <Box marginTop={1}>
            <ProgressBar current={completedTodos} total={totalTodos} />
          </Box>
        )}

        {/* 进行中的任务 */}
        {inProgressTodos.length > 0 && (
          <>
            <TodoGroup
              title="⚡ In Progress"
              todos={inProgressTodos}
              selectedIndex={selectedIndex}
              startIndex={currentIndex}
              animationDelay={animationDelay}
            />
            {(() => {
              currentIndex += inProgressTodos.length;
              return null;
            })()}
          </>
        )}

        {/* 待处理的任务 */}
        {pendingTodos.length > 0 && (
          <>
            <TodoGroup
              title="📋 Pending"
              todos={pendingTodos}
              selectedIndex={selectedIndex}
              startIndex={currentIndex}
              animationDelay={animationDelay}
            />
            {(() => {
              currentIndex += pendingTodos.length;
              return null;
            })()}
          </>
        )}

        {/* 已完成的任务 */}
        {showCompleted && completedTodosInList.length > 0 && (
          <TodoGroup
            title="✓ Completed"
            todos={completedTodosInList}
            selectedIndex={selectedIndex}
            startIndex={currentIndex}
            animationDelay={animationDelay}
          />
        )}

        {enableKeyboardNav && (
          <Box marginTop={1}>
            <Text dimColor color="gray">
              Use ↑↓ to navigate
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // 不分组显示
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginY={1}>
      <Text bold color="cyan">
        Tasks
      </Text>

      {showProgressBar && (
        <Box marginTop={1}>
          <ProgressBar current={completedTodos} total={totalTodos} />
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {filteredTodos.map((todo, index) => (
          <TodoItemComponent
            key={index}
            todo={todo}
            isSelected={selectedIndex === index}
            animationDelay={animationDelay}
            index={index}
          />
        ))}
      </Box>

      {enableKeyboardNav && (
        <Box marginTop={1}>
          <Text dimColor color="gray">
            Use ↑↓ to navigate
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default TodoList;
