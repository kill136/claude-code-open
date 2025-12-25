/**
 * Session Flow Integration Tests
 * Tests session lifecycle and state management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestEnvironment, cleanupTestEnvironment, createTestSession } from './setup.js';
import type { TestEnvironment } from './setup.js';
import { createTestSessionObject, createTestMessage } from './helpers.js';
import { SessionManager } from '../../src/session/index.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Session Flow Integration', () => {
  let env: TestEnvironment;
  let sessionManager: SessionManager;

  beforeAll(async () => {
    env = await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment(env);
  });

  beforeEach(() => {
    sessionManager = new SessionManager(env.sessionDir);
  });

  describe('Session Creation and Persistence', () => {
    it('should create a new session and save to disk', async () => {
      const session = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);

      expect(session.id).toBeDefined();
      expect(session.model).toBe('claude-sonnet-4-5-20250929');
      expect(session.messages).toHaveLength(0);
      expect(session.cwd).toBe(env.projectDir);

      // Save session
      await sessionManager.saveSession(session);

      // Verify file exists
      const sessionPath = path.join(env.sessionDir, `${session.id}.json`);
      expect(fs.existsSync(sessionPath)).toBe(true);

      // Verify content
      const savedContent = fs.readFileSync(sessionPath, 'utf-8');
      const savedSession = JSON.parse(savedContent);
      expect(savedSession.id).toBe(session.id);
      expect(savedSession.model).toBe(session.model);
    });

    it('should create session with metadata', async () => {
      const session = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);
      session.metadata = {
        title: 'Test Session',
        tags: ['integration', 'test'],
        description: 'Integration test session',
      };

      await sessionManager.saveSession(session);

      // Load and verify
      const loaded = await sessionManager.loadSession(session.id);
      expect(loaded).toBeDefined();
      expect(loaded?.metadata.title).toBe('Test Session');
      expect(loaded?.metadata.tags).toEqual(['integration', 'test']);
    });
  });

  describe('Session Loading and Resumption', () => {
    it('should load an existing session from disk', async () => {
      const testSession = createTestSessionObject({
        id: 'test-load-session',
        messages: [
          createTestMessage('user', 'Hello'),
          createTestMessage('assistant', 'Hi there!'),
        ],
      });

      createTestSession(env, testSession.id, testSession);

      const loaded = await sessionManager.loadSession(testSession.id);

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe('test-load-session');
      expect(loaded?.messages).toHaveLength(2);
      expect(loaded?.messages[0].role).toBe('user');
      expect(loaded?.messages[0].content).toBe('Hello');
    });

    it('should return null for non-existent session', async () => {
      const loaded = await sessionManager.loadSession('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should resume last session', async () => {
      // Create multiple sessions
      const session1 = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);
      await sessionManager.saveSession(session1);

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const session2 = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);
      session2.messages.push(createTestMessage('user', 'Test message'));
      await sessionManager.saveSession(session2);

      // Resume should get the most recent session
      const resumed = await sessionManager.getLastSession();

      expect(resumed).toBeDefined();
      expect(resumed?.id).toBe(session2.id);
    });
  });

  describe('Message Management', () => {
    it('should add messages to session', async () => {
      const session = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);

      sessionManager.addMessage(session, 'user', 'What is TypeScript?');
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].role).toBe('user');
      expect(session.messages[0].content).toBe('What is TypeScript?');

      sessionManager.addMessage(
        session,
        'assistant',
        'TypeScript is a typed superset of JavaScript.'
      );
      expect(session.messages).toHaveLength(2);
      expect(session.messages[1].role).toBe('assistant');
    });

    it('should handle complex message content', async () => {
      const session = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);

      const complexContent = [
        { type: 'text', text: 'Let me read a file' },
        {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'Read',
          input: { file_path: '/path/to/file.ts' },
        },
      ];

      sessionManager.addMessage(session, 'assistant', complexContent);

      expect(session.messages).toHaveLength(1);
      expect(Array.isArray(session.messages[0].content)).toBe(true);

      const content = session.messages[0].content as any[];
      expect(content).toHaveLength(2);
      expect(content[1].type).toBe('tool_use');
      expect(content[1].name).toBe('Read');
    });
  });

  describe('Cost Tracking', () => {
    it('should track token usage and costs', async () => {
      const session = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);

      expect(session.cost.inputTokens).toBe(0);
      expect(session.cost.outputTokens).toBe(0);
      expect(session.cost.totalCost).toBe(0);

      // Simulate API response with token usage
      sessionManager.updateCost(session, {
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(session.cost.inputTokens).toBe(100);
      expect(session.cost.outputTokens).toBe(50);
      expect(session.cost.totalCost).toBeGreaterThan(0);

      // Add more usage
      sessionManager.updateCost(session, {
        inputTokens: 200,
        outputTokens: 100,
      });

      expect(session.cost.inputTokens).toBe(300);
      expect(session.cost.outputTokens).toBe(150);
    });
  });

  describe('Session Listing and Filtering', () => {
    it('should list all sessions', async () => {
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const session = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);
        session.metadata = { title: `Session ${i + 1}` };
        await sessionManager.saveSession(session);
      }

      const sessions = await sessionManager.listSessions();

      expect(sessions).toHaveLength(3);
      expect(sessions[0].metadata?.title).toBeDefined();
    });

    it('should filter sessions by working directory', async () => {
      const projectA = path.join(env.tempDir, 'project-a');
      const projectB = path.join(env.tempDir, 'project-b');

      fs.mkdirSync(projectA, { recursive: true });
      fs.mkdirSync(projectB, { recursive: true });

      // Create sessions for different projects
      const sessionA = sessionManager.createSession('claude-sonnet-4-5-20250929', projectA);
      await sessionManager.saveSession(sessionA);

      const sessionB = sessionManager.createSession('claude-sonnet-4-5-20250929', projectB);
      await sessionManager.saveSession(sessionB);

      // Filter by project A
      const sessionsA = await sessionManager.listSessions({ cwd: projectA });
      expect(sessionsA).toHaveLength(1);
      expect(sessionsA[0].cwd).toBe(projectA);
    });
  });

  describe('Session Cleanup', () => {
    it('should delete old sessions', async () => {
      const oldSession = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);

      // Set creation time to 60 days ago
      oldSession.createdAt = Date.now() - 60 * 24 * 60 * 60 * 1000;
      await sessionManager.saveSession(oldSession);

      // Delete sessions older than 30 days
      const deleted = await sessionManager.cleanupOldSessions(30);

      expect(deleted).toBeGreaterThan(0);

      // Verify session is gone
      const loaded = await sessionManager.loadSession(oldSession.id);
      expect(loaded).toBeNull();
    });

    it('should keep recent sessions', async () => {
      const recentSession = sessionManager.createSession(
        'claude-sonnet-4-5-20250929',
        env.projectDir
      );
      await sessionManager.saveSession(recentSession);

      // Delete sessions older than 30 days (this one is recent)
      const deleted = await sessionManager.cleanupOldSessions(30);

      // Verify session still exists
      const loaded = await sessionManager.loadSession(recentSession.id);
      expect(loaded).not.toBeNull();
    });
  });

  describe('Session Update Flow', () => {
    it('should handle complete conversation flow', async () => {
      const session = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);

      // User asks a question
      sessionManager.addMessage(session, 'user', 'How do I use TypeScript?');
      expect(session.messages).toHaveLength(1);

      // Update session timestamp
      const oldUpdatedAt = session.updatedAt;
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assistant responds
      sessionManager.addMessage(
        session,
        'assistant',
        'TypeScript is used by adding types to JavaScript code.'
      );

      session.updatedAt = Date.now();
      expect(session.updatedAt).toBeGreaterThan(oldUpdatedAt);

      // Update costs
      sessionManager.updateCost(session, {
        inputTokens: 50,
        outputTokens: 100,
      });

      // Save session
      await sessionManager.saveSession(session);

      // Verify persistence
      const loaded = await sessionManager.loadSession(session.id);
      expect(loaded?.messages).toHaveLength(2);
      expect(loaded?.cost.inputTokens).toBe(50);
      expect(loaded?.cost.outputTokens).toBe(100);
    });
  });

  describe('Session Export and Import', () => {
    it('should export session to JSON', async () => {
      const session = sessionManager.createSession('claude-sonnet-4-5-20250929', env.projectDir);
      sessionManager.addMessage(session, 'user', 'Test message');

      const exported = sessionManager.exportSession(session);
      const parsed = JSON.parse(exported);

      expect(parsed.id).toBe(session.id);
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.messages[0].content).toBe('Test message');
    });

    it('should import session from JSON', async () => {
      const sessionData = {
        id: 'imported-session',
        model: 'claude-sonnet-4-5-20250929',
        messages: [
          { role: 'user', content: 'Imported message' },
        ],
        cwd: env.projectDir,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cost: {
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
        },
        metadata: {},
      };

      const imported = sessionManager.importSession(JSON.stringify(sessionData));

      expect(imported.id).toBe('imported-session');
      expect(imported.messages).toHaveLength(1);
      expect(imported.messages[0].content).toBe('Imported message');
    });
  });
});
