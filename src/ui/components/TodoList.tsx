/**
 * TodoList 组件
 * 显示任务列表
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { TodoItem } from '../../types/index.js';

interface TodoListProps {
  todos: TodoItem[];
  showCompleted?: boolean;
}

export const TodoList: React.FC<TodoListProps> = ({ todos, showCompleted = false }) => {
  const filteredTodos = showCompleted
    ? todos
    : todos.filter((t) => t.status !== 'completed');

  if (filteredTodos.length === 0) {
    return null;
  }

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'pending':
        return <Text color="gray">○</Text>;
      case 'in_progress':
        return <Text color="yellow">◐</Text>;
      case 'completed':
        return <Text color="green">●</Text>;
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

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginY={1}>
      <Text bold color="white">
        Tasks:
      </Text>
      {filteredTodos.map((todo, index) => (
        <Box key={index}>
          {getStatusIcon(todo.status)}
          <Text> </Text>
          <Text color={getStatusColor(todo.status)}>
            {todo.status === 'in_progress' ? todo.activeForm : todo.content}
          </Text>
        </Box>
      ))}
    </Box>
  );
};

export default TodoList;
