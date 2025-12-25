/**
 * TodoList Component Usage Examples
 *
 * This file demonstrates various ways to use the enhanced TodoList component
 * with all its new features based on the official Claude Code CLI v2.0.76
 */

import React from 'react';
import { render } from 'ink';
import { TodoList } from '../src/ui/components/TodoList.js';
import type { TodoItem } from '../src/types/index.js';

// ============================================================================
// Example 1: Basic Usage (Minimal Configuration)
// ============================================================================

const basicExample = () => {
  const todos: TodoItem[] = [
    {
      content: 'Install dependencies',
      activeForm: 'Installing dependencies',
      status: 'completed',
    },
    {
      content: 'Run tests',
      activeForm: 'Running tests',
      status: 'in_progress',
    },
    {
      content: 'Build project',
      activeForm: 'Building project',
      status: 'pending',
    },
  ];

  return <TodoList todos={todos} />;
};

// ============================================================================
// Example 2: Show All Tasks Including Completed
// ============================================================================

const showCompletedExample = () => {
  const todos: TodoItem[] = [
    {
      content: 'Create project structure',
      activeForm: 'Creating project structure',
      status: 'completed',
    },
    {
      content: 'Install dependencies',
      activeForm: 'Installing dependencies',
      status: 'completed',
    },
    {
      content: 'Implement core features',
      activeForm: 'Implementing core features',
      status: 'in_progress',
    },
    {
      content: 'Write tests',
      activeForm: 'Writing tests',
      status: 'pending',
    },
    {
      content: 'Deploy to production',
      activeForm: 'Deploying to production',
      status: 'pending',
    },
  ];

  return <TodoList todos={todos} showCompleted={true} />;
};

// ============================================================================
// Example 3: Simple List Without Grouping
// ============================================================================

const simpleListExample = () => {
  const todos: TodoItem[] = [
    {
      content: 'Fix authentication bug',
      activeForm: 'Fixing authentication bug',
      status: 'in_progress',
    },
    {
      content: 'Update documentation',
      activeForm: 'Updating documentation',
      status: 'pending',
    },
    {
      content: 'Review pull requests',
      activeForm: 'Reviewing pull requests',
      status: 'pending',
    },
  ];

  return <TodoList todos={todos} groupByStatus={false} />;
};

// ============================================================================
// Example 4: Fast Animation for Quick Display
// ============================================================================

const fastAnimationExample = () => {
  const todos: TodoItem[] = [
    {
      content: 'Compile TypeScript',
      activeForm: 'Compiling TypeScript',
      status: 'in_progress',
    },
    {
      content: 'Bundle assets',
      activeForm: 'Bundling assets',
      status: 'pending',
    },
    {
      content: 'Minify output',
      activeForm: 'Minifying output',
      status: 'pending',
    },
    {
      content: 'Generate source maps',
      activeForm: 'Generating source maps',
      status: 'pending',
    },
  ];

  // Fast animation (20ms delay) for quick task display
  return <TodoList todos={todos} animationDelay={20} />;
};

// ============================================================================
// Example 5: No Animation (Instant Display)
// ============================================================================

const instantDisplayExample = () => {
  const todos: TodoItem[] = [
    {
      content: 'Read configuration',
      activeForm: 'Reading configuration',
      status: 'completed',
    },
    {
      content: 'Validate settings',
      activeForm: 'Validating settings',
      status: 'in_progress',
    },
  ];

  // No animation - instant display
  return <TodoList todos={todos} animationDelay={0} />;
};

// ============================================================================
// Example 6: Minimal Display (No Progress Bar, No Keyboard Nav)
// ============================================================================

const minimalDisplayExample = () => {
  const todos: TodoItem[] = [
    {
      content: 'Process data',
      activeForm: 'Processing data',
      status: 'in_progress',
    },
    {
      content: 'Generate report',
      activeForm: 'Generating report',
      status: 'pending',
    },
  ];

  return (
    <TodoList
      todos={todos}
      showProgressBar={false}
      enableKeyboardNav={false}
    />
  );
};

// ============================================================================
// Example 7: Complete Feature Set
// ============================================================================

const fullFeaturedExample = () => {
  const todos: TodoItem[] = [
    // Completed tasks
    {
      content: 'Initialize git repository',
      activeForm: 'Initializing git repository',
      status: 'completed',
    },
    {
      content: 'Set up TypeScript configuration',
      activeForm: 'Setting up TypeScript configuration',
      status: 'completed',
    },
    {
      content: 'Install ESLint and Prettier',
      activeForm: 'Installing ESLint and Prettier',
      status: 'completed',
    },

    // In progress
    {
      content: 'Implement core business logic',
      activeForm: 'Implementing core business logic',
      status: 'in_progress',
    },

    // Pending tasks
    {
      content: 'Write unit tests',
      activeForm: 'Writing unit tests',
      status: 'pending',
    },
    {
      content: 'Create integration tests',
      activeForm: 'Creating integration tests',
      status: 'pending',
    },
    {
      content: 'Set up CI/CD pipeline',
      activeForm: 'Setting up CI/CD pipeline',
      status: 'pending',
    },
    {
      content: 'Write API documentation',
      activeForm: 'Writing API documentation',
      status: 'pending',
    },
  ];

  return (
    <TodoList
      todos={todos}
      showCompleted={true}
      enableKeyboardNav={true}
      showProgressBar={true}
      groupByStatus={true}
      animationDelay={50}
    />
  );
};

// ============================================================================
// Example 8: Real-world Build Process
// ============================================================================

const buildProcessExample = () => {
  const todos: TodoItem[] = [
    {
      content: 'Clean build directory',
      activeForm: 'Cleaning build directory',
      status: 'completed',
    },
    {
      content: 'Compile TypeScript files',
      activeForm: 'Compiling TypeScript files',
      status: 'completed',
    },
    {
      content: 'Run ESLint checks',
      activeForm: 'Running ESLint checks',
      status: 'in_progress',
    },
    {
      content: 'Run unit tests',
      activeForm: 'Running unit tests',
      status: 'pending',
    },
    {
      content: 'Run integration tests',
      activeForm: 'Running integration tests',
      status: 'pending',
    },
    {
      content: 'Bundle application',
      activeForm: 'Bundling application',
      status: 'pending',
    },
    {
      content: 'Generate production build',
      activeForm: 'Generating production build',
      status: 'pending',
    },
  ];

  return <TodoList todos={todos} showCompleted={true} />;
};

// ============================================================================
// Example 9: Dynamic Task Updates (Simulated)
// ============================================================================

const DynamicTaskExample: React.FC = () => {
  const [todos, setTodos] = React.useState<TodoItem[]>([
    {
      content: 'Start server',
      activeForm: 'Starting server',
      status: 'pending',
    },
    {
      content: 'Load database',
      activeForm: 'Loading database',
      status: 'pending',
    },
    {
      content: 'Initialize cache',
      activeForm: 'Initializing cache',
      status: 'pending',
    },
  ]);

  React.useEffect(() => {
    // Simulate task progression
    const intervals = [
      setTimeout(() => {
        setTodos((prev) =>
          prev.map((t, i) =>
            i === 0 ? { ...t, status: 'in_progress' as const } : t
          )
        );
      }, 1000),

      setTimeout(() => {
        setTodos((prev) =>
          prev.map((t, i) =>
            i === 0 ? { ...t, status: 'completed' as const } : t
          )
        );
      }, 2000),

      setTimeout(() => {
        setTodos((prev) =>
          prev.map((t, i) =>
            i === 1 ? { ...t, status: 'in_progress' as const } : t
          )
        );
      }, 2500),

      setTimeout(() => {
        setTodos((prev) =>
          prev.map((t, i) =>
            i === 1 ? { ...t, status: 'completed' as const } : t
          )
        );
      }, 3500),

      setTimeout(() => {
        setTodos((prev) =>
          prev.map((t, i) =>
            i === 2 ? { ...t, status: 'in_progress' as const } : t
          )
        );
      }, 4000),

      setTimeout(() => {
        setTodos((prev) =>
          prev.map((t, i) =>
            i === 2 ? { ...t, status: 'completed' as const } : t
          )
        );
      }, 5000),
    ];

    return () => intervals.forEach(clearTimeout);
  }, []);

  return <TodoList todos={todos} showCompleted={true} />;
};

// ============================================================================
// Example 10: Empty State
// ============================================================================

const emptyStateExample = () => {
  const todos: TodoItem[] = [];

  // Will render nothing (returns null)
  return <TodoList todos={todos} />;
};

// ============================================================================
// Render Examples (uncomment to test)
// ============================================================================

// Render example 1 (basic usage)
// render(basicExample());

// Render example 2 (show completed)
// render(showCompletedExample());

// Render example 3 (simple list)
// render(simpleListExample());

// Render example 4 (fast animation)
// render(fastAnimationExample());

// Render example 5 (instant display)
// render(instantDisplayExample());

// Render example 6 (minimal display)
// render(minimalDisplayExample());

// Render example 7 (full featured)
// render(fullFeaturedExample());

// Render example 8 (build process)
// render(buildProcessExample());

// Render example 9 (dynamic updates)
// render(<DynamicTaskExample />);

// Render example 10 (empty state)
// render(emptyStateExample());

// ============================================================================
// Export all examples for testing
// ============================================================================

export {
  basicExample,
  showCompletedExample,
  simpleListExample,
  fastAnimationExample,
  instantDisplayExample,
  minimalDisplayExample,
  fullFeaturedExample,
  buildProcessExample,
  DynamicTaskExample,
  emptyStateExample,
};
