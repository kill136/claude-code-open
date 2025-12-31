/**
 * Chrome 设置 UI 组件
 * 对齐官方 Claude Code 的交互式界面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  isChromeIntegrationSupported,
  isChromeIntegrationConfigured,
  isExtensionInstalled,
  setupChromeNativeHost,
  CHROME_INSTALL_URL,
  CHROME_RECONNECT_URL
} from '../chrome-mcp/index.js';

interface ChromeSettingsProps {
  onDone: () => void;
}

interface MenuOption {
  label: string;
  value: string;
}

/**
 * Chrome 设置主界面
 */
export function ChromeSettings({ onDone }: ChromeSettingsProps): React.ReactElement {
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null);
  const [nativeHostConfigured, setNativeHostConfigured] = useState<boolean | null>(null);
  const [enabledByDefault, setEnabledByDefault] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // 加载状态
  useEffect(() => {
    async function checkStatus() {
      try {
        const [extInstalled, hostConfigured] = await Promise.all([
          isExtensionInstalled(),
          isChromeIntegrationConfigured()
        ]);
        setExtensionInstalled(extInstalled);
        setNativeHostConfigured(hostConfigured);

        // 从配置读取默认启用状态
        try {
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');
          const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
          if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            setEnabledByDefault(settings.claudeInChromeDefaultEnabled || false);
          }
        } catch {}
      } catch (err) {
        console.error('Failed to check Chrome status:', err);
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  // 构建菜单选项
  const menuOptions: MenuOption[] = [];
  if (extensionInstalled) {
    menuOptions.push(
      { label: 'Manage permissions', value: 'manage-permissions' },
      { label: 'Reconnect extension', value: 'reconnect' }
    );
  } else {
    menuOptions.push({ label: 'Install Chrome extension', value: 'install-extension' });
  }
  menuOptions.push({
    label: `Enabled by default: ${enabledByDefault ? 'Yes' : 'No'}`,
    value: 'toggle-default'
  });

  // 处理选择
  const handleSelect = useCallback(async (value: string) => {
    switch (value) {
      case 'install-extension':
        console.log(`\nOpening: ${CHROME_INSTALL_URL}\n`);
        // 可以使用 open 命令打开浏览器
        try {
          const { exec } = await import('child_process');
          exec(`xdg-open "${CHROME_INSTALL_URL}" 2>/dev/null || open "${CHROME_INSTALL_URL}" 2>/dev/null || start "${CHROME_INSTALL_URL}"`);
        } catch {}
        break;

      case 'reconnect':
        console.log(`\nOpening: ${CHROME_RECONNECT_URL}\n`);
        try {
          const { exec } = await import('child_process');
          exec(`xdg-open "${CHROME_RECONNECT_URL}" 2>/dev/null || open "${CHROME_RECONNECT_URL}" 2>/dev/null || start "${CHROME_RECONNECT_URL}"`);
        } catch {}
        break;

      case 'manage-permissions':
        console.log('\nOpening Chrome extension settings...\n');
        try {
          const { exec } = await import('child_process');
          exec(`xdg-open "chrome://extensions/?id=fcoeoabgfenejglbffodgkkbkcdhcgfn" 2>/dev/null || open "chrome://extensions/?id=fcoeoabgfenejglbffodgkkbkcdhcgfn" 2>/dev/null`);
        } catch {}
        break;

      case 'toggle-default':
        const newValue = !enabledByDefault;
        setEnabledByDefault(newValue);
        // 保存到配置
        try {
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');
          const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
          let settings: Record<string, unknown> = {};
          if (fs.existsSync(settingsPath)) {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
          }
          settings.claudeInChromeDefaultEnabled = newValue;
          fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        } catch (err) {
          console.error('Failed to save setting:', err);
        }
        break;
    }
  }, [enabledByDefault]);

  // 键盘输入处理
  useInput((input, key) => {
    if (key.escape) {
      onDone();
      return;
    }

    if (key.return) {
      handleSelect(menuOptions[selectedIndex].value);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(menuOptions.length - 1, prev + 1));
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
        <Text bold color="yellow">Claude in Chrome (Beta)</Text>
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  const statusText = extensionInstalled
    ? (nativeHostConfigured ? 'Enabled' : 'Disabled')
    : 'Not installed';

  const statusColor = extensionInstalled && nativeHostConfigured ? 'green' : 'yellow';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0}>
      <Text bold color="yellow"> Claude in Chrome (Beta)</Text>
      <Text> </Text>

      <Text>
        Claude in Chrome works with the Chrome extension to let you control your browser directly from
        Claude Code. Navigate websites, fill forms, capture screenshots, record GIFs, and debug with
        console logs and network requests.
      </Text>
      <Text> </Text>

      <Text>
        <Text bold>Status: </Text>
        <Text color={statusColor}>{statusText}</Text>
      </Text>
      <Text>
        <Text bold>Extension: </Text>
        <Text color={extensionInstalled ? 'green' : 'yellow'}>
          {extensionInstalled ? 'Installed' : 'Not installed'}
        </Text>
      </Text>
      <Text> </Text>

      {/* 菜单选项 */}
      {menuOptions.map((option, index) => (
        <Text key={option.value}>
          {index === selectedIndex ? (
            <Text color="cyan"> ❯ {option.label}</Text>
          ) : (
            <Text dimColor>   {option.label}</Text>
          )}
        </Text>
      ))}

      <Text> </Text>
      <Text>
        <Text bold>Usage: </Text>
        <Text dimColor>claude --chrome</Text>
        <Text> or </Text>
        <Text dimColor>claude --no-chrome</Text>
      </Text>

      {extensionInstalled && (
        <>
          <Text> </Text>
          <Text dimColor>
            Site-level permissions are inherited from the Chrome extension. Manage permissions in the Chrome
            extension settings to control which sites Claude can browse, click, and type on.
          </Text>
        </>
      )}

      <Text> </Text>
      <Text dimColor>Enter to confirm · Esc to cancel</Text>
    </Box>
  );
}

/**
 * 渲染 Chrome 设置 UI
 */
export async function showChromeSettings(): Promise<void> {
  const { render } = await import('ink');

  return new Promise((resolve) => {
    const app = render(
      <ChromeSettings onDone={() => {
        app.unmount();
        resolve();
      }} />
    );
  });
}

export default ChromeSettings;
