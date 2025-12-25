import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

/**
 * Sensitive data pattern definition
 */
export interface SensitivePattern {
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

/**
 * Sensitive data match result
 */
export interface SensitiveMatch {
  pattern: string;
  value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  position: {
    start: number;
    end: number;
    line?: number;
    column?: number;
  };
  context?: string;
}

/**
 * File scan result
 */
export interface FileScanResult {
  file: string;
  matches: SensitiveMatch[];
  hasMatches: boolean;
}

/**
 * Directory scan result
 */
export interface ScanResult {
  directory: string;
  files: FileScanResult[];
  totalMatches: number;
  totalFiles: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Default sensitive data patterns
 */
export const DEFAULT_PATTERNS: SensitivePattern[] = [
  // API Keys
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
    description: 'AWS Access Key ID detected'
  },
  {
    name: 'AWS Secret Key',
    pattern: /aws_secret_access_key\s*=\s*['""]?([A-Za-z0-9/+=]{40})['""]?/gi,
    severity: 'critical',
    description: 'AWS Secret Access Key detected'
  },
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    severity: 'critical',
    description: 'GitHub Personal Access Token detected'
  },
  {
    name: 'GitHub Classic Token',
    pattern: /ghp_[A-Za-z0-9]{36}/g,
    severity: 'critical',
    description: 'GitHub Classic Personal Access Token detected'
  },
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-api03-[A-Za-z0-9_-]{95}/g,
    severity: 'critical',
    description: 'Anthropic API Key detected'
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-[A-Za-z0-9]{48}/g,
    severity: 'critical',
    description: 'OpenAI API Key detected'
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,12}-[0-9]{10,12}-[A-Za-z0-9]{24,}/g,
    severity: 'critical',
    description: 'Slack Token detected'
  },
  {
    name: 'Stripe API Key',
    pattern: /(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24,}/g,
    severity: 'critical',
    description: 'Stripe API Key detected'
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    severity: 'critical',
    description: 'Google API Key detected'
  },
  {
    name: 'Google OAuth',
    pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g,
    severity: 'critical',
    description: 'Google OAuth Client ID detected'
  },
  {
    name: 'Heroku API Key',
    pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    severity: 'high',
    description: 'Heroku API Key (UUID format) detected'
  },
  {
    name: 'MailChimp API Key',
    pattern: /[0-9a-f]{32}-us[0-9]{1,2}/g,
    severity: 'high',
    description: 'MailChimp API Key detected'
  },
  {
    name: 'Twilio API Key',
    pattern: /SK[0-9a-fA-F]{32}/g,
    severity: 'high',
    description: 'Twilio API Key detected'
  },

  // JWT Tokens
  {
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: 'high',
    description: 'JWT Token detected'
  },

  // SSH Keys
  {
    name: 'SSH Private Key',
    pattern: /-----BEGIN (?:RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'SSH Private Key detected'
  },
  {
    name: 'PGP Private Key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
    severity: 'critical',
    description: 'PGP Private Key Block detected'
  },

  // Database Connection Strings
  {
    name: 'Database URL',
    pattern: /(?:mysql|postgres|mongodb|redis):\/\/[^:]+:[^@]+@[^/]+/gi,
    severity: 'critical',
    description: 'Database connection string with credentials detected'
  },
  {
    name: 'JDBC Connection String',
    pattern: /jdbc:[a-z]+:\/\/[^:]+:[^@]+@[^/]+/gi,
    severity: 'high',
    description: 'JDBC connection string with credentials detected'
  },

  // Generic Passwords
  {
    name: 'Password in Code',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*['""]([^'""]{8,})['"\"]/gi,
    severity: 'high',
    description: 'Password in code detected'
  },
  {
    name: 'API Key Generic',
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['""]([A-Za-z0-9_\-]{16,})['"\"]/gi,
    severity: 'high',
    description: 'Generic API key detected'
  },
  {
    name: 'Secret Key Generic',
    pattern: /(?:secret[_-]?key|secret)\s*[=:]\s*['""]([A-Za-z0-9_\-]{16,})['"\"]/gi,
    severity: 'high',
    description: 'Generic secret key detected'
  },
  {
    name: 'Token Generic',
    pattern: /(?:auth[_-]?token|access[_-]?token|token)\s*[=:]\s*['""]([A-Za-z0-9_\-]{16,})['"\"]/gi,
    severity: 'medium',
    description: 'Generic token detected'
  },

  // Personal Information
  {
    name: 'Email Address',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: 'low',
    description: 'Email address detected'
  },
  {
    name: 'Credit Card',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    severity: 'critical',
    description: 'Credit card number detected'
  },
  {
    name: 'US Social Security Number',
    pattern: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    severity: 'critical',
    description: 'US Social Security Number detected'
  },

  // Network
  {
    name: 'Private IP Address',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    severity: 'low',
    description: 'Private IP address detected'
  },

  // Certificates
  {
    name: 'SSL Certificate',
    pattern: /-----BEGIN CERTIFICATE-----/g,
    severity: 'medium',
    description: 'SSL Certificate detected'
  }
];

/**
 * Create a masked version of a sensitive value
 * @param value - The value to mask
 * @param visibleChars - Number of characters to show at start and end
 * @returns Masked value
 */
export function createMaskedValue(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars * 2) {
    return '*'.repeat(value.length);
  }

  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  const middle = '*'.repeat(Math.max(8, value.length - visibleChars * 2));

  return `${start}${middle}${end}`;
}

/**
 * Sensitive data detector
 */
export class SensitiveDataDetector {
  private patterns: SensitivePattern[];

  /**
   * Create a new sensitive data detector
   * @param patterns - Custom patterns (defaults to DEFAULT_PATTERNS)
   */
  constructor(patterns?: SensitivePattern[]) {
    this.patterns = patterns || [...DEFAULT_PATTERNS];
  }

  /**
   * Detect sensitive data in content
   * @param content - Content to scan
   * @returns Array of matches
   */
  detect(content: string): SensitiveMatch[] {
    const matches: SensitiveMatch[] = [];

    for (const pattern of this.patterns) {
      // Reset regex lastIndex
      pattern.pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.pattern.exec(content)) !== null) {
        const value = match[0];
        const start = match.index;
        const end = start + value.length;

        // Calculate line and column
        const beforeMatch = content.slice(0, start);
        const lines = beforeMatch.split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;

        // Get context (surrounding text)
        const contextStart = Math.max(0, start - 50);
        const contextEnd = Math.min(content.length, end + 50);
        const context = content.slice(contextStart, contextEnd);

        matches.push({
          pattern: pattern.name,
          value,
          severity: pattern.severity,
          description: pattern.description,
          position: { start, end, line, column },
          context
        });
      }
    }

    return matches;
  }

  /**
   * Detect sensitive data in a file
   * @param filePath - Path to file
   * @returns Array of matches
   */
  async detectInFile(filePath: string): Promise<SensitiveMatch[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.detect(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      if ((error as NodeJS.ErrnoException).code === 'EISDIR') {
        throw new Error(`Path is a directory: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Scan directory for sensitive data
   * @param directory - Directory to scan
   * @param options - Scan options
   * @returns Scan results
   */
  async scan(
    directory: string,
    options: {
      pattern?: string;
      exclude?: string[];
      maxFiles?: number;
    } = {}
  ): Promise<ScanResult> {
    const {
      pattern: filePattern = '**/*',
      exclude = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/vendor/**',
        '**/*.min.js',
        '**/*.min.css',
        '**/*.map'
      ],
      maxFiles = 1000
    } = options;

    // Find files
    const files = await glob(filePattern, {
      cwd: directory,
      absolute: true,
      nodir: true,
      ignore: exclude,
      maxDepth: 10
    });

    // Limit number of files
    const filesToScan = files.slice(0, maxFiles);

    // Scan files
    const results: FileScanResult[] = [];
    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    let totalMatches = 0;

    for (const file of filesToScan) {
      try {
        // Skip binary files
        const stats = await fs.stat(file);
        if (stats.size > 10 * 1024 * 1024) {
          // Skip files larger than 10MB
          continue;
        }

        // Try to read as text
        let content: string;
        try {
          content = await fs.readFile(file, 'utf-8');
        } catch {
          // Skip if cannot read as text (likely binary)
          continue;
        }

        // Detect sensitive data
        const matches = this.detect(content);

        if (matches.length > 0) {
          results.push({
            file,
            matches,
            hasMatches: true
          });

          // Update summary
          totalMatches += matches.length;
          for (const match of matches) {
            summary[match.severity]++;
          }
        }
      } catch (error) {
        // Skip files that cannot be processed
        console.error(`Error scanning ${file}:`, error);
      }
    }

    return {
      directory,
      files: results,
      totalMatches,
      totalFiles: filesToScan.length,
      summary
    };
  }

  /**
   * Mask sensitive data in content
   * @param content - Content to mask
   * @returns Masked content
   */
  mask(content: string): string {
    let masked = content;
    const matches = this.detect(content);

    // Sort matches by position (descending) to avoid offset issues
    matches.sort((a, b) => b.position.start - a.position.start);

    for (const match of matches) {
      const maskedValue = createMaskedValue(match.value);
      masked =
        masked.slice(0, match.position.start) +
        maskedValue +
        masked.slice(match.position.end);
    }

    return masked;
  }

  /**
   * Mask a specific match
   * @param match - Match to mask
   * @returns Masked value
   */
  maskMatch(match: SensitiveMatch): string {
    return createMaskedValue(match.value);
  }

  /**
   * Add a custom pattern
   * @param pattern - Pattern to add
   */
  addPattern(pattern: SensitivePattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove a pattern by name
   * @param name - Pattern name
   * @returns True if removed, false if not found
   */
  removePattern(name: string): boolean {
    const index = this.patterns.findIndex(p => p.name === name);
    if (index >= 0) {
      this.patterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all patterns
   * @returns Array of patterns
   */
  getPatterns(): SensitivePattern[] {
    return [...this.patterns];
  }

  /**
   * Clear all patterns
   */
  clearPatterns(): void {
    this.patterns = [];
  }

  /**
   * Reset to default patterns
   */
  resetPatterns(): void {
    this.patterns = [...DEFAULT_PATTERNS];
  }

  /**
   * Check if content has sensitive data
   * @param content - Content to check
   * @returns True if sensitive data found
   */
  hasSensitiveData(content: string): boolean {
    return this.detect(content).length > 0;
  }

  /**
   * Get severity statistics for content
   * @param content - Content to analyze
   * @returns Severity statistics
   */
  getSeverityStats(content: string): { critical: number; high: number; medium: number; low: number } {
    const matches = this.detect(content);
    const stats = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const match of matches) {
      stats[match.severity]++;
    }

    return stats;
  }
}

/**
 * Create a default detector instance
 */
export function createDetector(patterns?: SensitivePattern[]): SensitiveDataDetector {
  return new SensitiveDataDetector(patterns);
}

/**
 * Quick helper to detect sensitive data in content
 * @param content - Content to scan
 * @returns Array of matches
 */
export function detectSensitive(content: string): SensitiveMatch[] {
  const detector = new SensitiveDataDetector();
  return detector.detect(content);
}

/**
 * Quick helper to mask sensitive data in content
 * @param content - Content to mask
 * @returns Masked content
 */
export function maskSensitive(content: string): string {
  const detector = new SensitiveDataDetector();
  return detector.mask(content);
}

/**
 * Check if a file should be excluded from scanning
 * @param filePath - File path to check
 * @returns True if should be excluded
 */
export function shouldExcludeFile(filePath: string): boolean {
  const excludePatterns = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /vendor/,
    /\.min\.(js|css)$/,
    /\.map$/,
    /\.(jpg|jpeg|png|gif|ico|svg|webp)$/i,
    /\.(mp4|avi|mov|wmv|flv)$/i,
    /\.(mp3|wav|ogg|flac)$/i,
    /\.(zip|tar|gz|rar|7z)$/i,
    /\.(exe|dll|so|dylib)$/i,
    /\.(pdf|doc|docx|xls|xlsx)$/i
  ];

  return excludePatterns.some(pattern => pattern.test(filePath));
}
