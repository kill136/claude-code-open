/**
 * Security Configuration Validation
 * Validates security configurations, assesses risks, and provides remediation suggestions
 */

import type { UserConfig } from '../config/index.js';
import type { AuthConfig } from '../auth/index.js';

// ============ Type Definitions ============

export interface SecurityConfig {
  // Authentication configuration
  auth?: {
    type: 'api_key' | 'oauth' | 'none';
    apiKey?: string;
    oauthToken?: string;
    tokenExpiry?: number;
    requireAuth: boolean;
  };

  // Permission configuration
  permissions?: {
    tools?: {
      allow?: string[];
      deny?: string[];
    };
    paths?: {
      allow?: string[];
      deny?: string[];
    };
    commands?: {
      allow?: string[];
      deny?: string[];
    };
    network?: {
      allow?: string[];
      deny?: string[];
    };
    audit?: {
      enabled?: boolean;
      logFile?: string;
      maxSize?: number;
    };
  };

  // Code signing configuration
  codeSigning?: {
    enabled: boolean;
    verifyBeforeExecution: boolean;
    requireSignedScripts: boolean;
    trustedKeys?: string[];
  };

  // Network security
  network?: {
    enableSSL: boolean;
    allowExternalRequests: boolean;
    trustedDomains?: string[];
    blockedDomains?: string[];
    proxyUrl?: string;
  };

  // File system security
  filesystem?: {
    restrictToWorkdir: boolean;
    preventSymlinkTraversal: boolean;
    maxFileSize?: number;
    blockedExtensions?: string[];
    allowedExtensions?: string[];
  };

  // Execution security
  execution?: {
    sandboxEnabled: boolean;
    timeoutMs?: number;
    maxMemoryMb?: number;
    maxCpuPercent?: number;
    allowShellCommands: boolean;
    dangerousCommandsBlocked: boolean;
  };

  // Data security
  data?: {
    encryptAtRest: boolean;
    encryptInTransit: boolean;
    sensitiveDataMasking: boolean;
    dataRetentionDays?: number;
  };
}

export type Severity = 'info' | 'warning' | 'error' | 'critical';

export interface CheckResult {
  passed: boolean;
  message: string;
  details?: string;
  value?: any;
}

export interface SecurityCheck {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: 'auth' | 'permissions' | 'network' | 'filesystem' | 'execution' | 'data' | 'general';
  check: (config: SecurityConfig) => CheckResult;
  fix?: (config: SecurityConfig) => SecurityConfig;
}

export interface ValidationIssue {
  checkId: string;
  name: string;
  severity: Severity;
  category: string;
  message: string;
  details?: string;
  hasFix: boolean;
}

export interface ValidationReport {
  timestamp: number;
  passed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  issues: ValidationIssue[];
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskAssessment {
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  categories: {
    [key: string]: {
      score: number;
      weight: number;
      issues: number;
    };
  };
  criticalIssues: ValidationIssue[];
  recommendations: string[];
}

export interface BestPracticeReport {
  compliant: boolean;
  complianceScore: number;
  practices: {
    id: string;
    name: string;
    compliant: boolean;
    recommendation?: string;
  }[];
}

export interface Suggestion {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  autoFixable: boolean;
  checkIds: string[];
}

// ============ Default Security Checks ============

export const DEFAULT_SECURITY_CHECKS: SecurityCheck[] = [
  // Authentication checks
  {
    id: 'auth-01',
    name: 'Authentication Required',
    description: 'Verify that authentication is required',
    severity: 'critical',
    category: 'auth',
    check: (config) => {
      const required = config.auth?.requireAuth ?? false;
      return {
        passed: required,
        message: required
          ? 'Authentication is required'
          : 'Authentication is not required - this is a security risk',
        value: required,
      };
    },
    fix: (config) => ({
      ...config,
      auth: { ...config.auth, requireAuth: true, type: config.auth?.type || 'api_key' },
    }),
  },
  {
    id: 'auth-02',
    name: 'OAuth Token Expiry',
    description: 'Check if OAuth tokens have expiry set',
    severity: 'warning',
    category: 'auth',
    check: (config) => {
      if (config.auth?.type !== 'oauth') {
        return { passed: true, message: 'Not using OAuth' };
      }
      const hasExpiry = config.auth.tokenExpiry !== undefined && config.auth.tokenExpiry > 0;
      return {
        passed: hasExpiry,
        message: hasExpiry
          ? `OAuth token expires in ${Math.floor((config.auth.tokenExpiry! - Date.now()) / 1000)}s`
          : 'OAuth token has no expiry - tokens should expire',
      };
    },
  },
  {
    id: 'auth-03',
    name: 'API Key Security',
    description: 'Check if API key is properly secured',
    severity: 'error',
    category: 'auth',
    check: (config) => {
      if (config.auth?.type !== 'api_key') {
        return { passed: true, message: 'Not using API key' };
      }
      const hasKey = !!config.auth.apiKey;
      const isSecure = hasKey && config.auth.apiKey!.length >= 32;
      return {
        passed: isSecure,
        message: isSecure
          ? 'API key appears to be properly formatted'
          : 'API key is missing or too short',
      };
    },
  },

  // Permission checks
  {
    id: 'perm-01',
    name: 'Audit Logging Enabled',
    description: 'Verify that audit logging is enabled',
    severity: 'warning',
    category: 'permissions',
    check: (config) => {
      const enabled = config.permissions?.audit?.enabled ?? false;
      return {
        passed: enabled,
        message: enabled
          ? 'Audit logging is enabled'
          : 'Audit logging is disabled - enable for security monitoring',
        value: enabled,
      };
    },
    fix: (config) => ({
      ...config,
      permissions: {
        ...config.permissions,
        audit: { ...config.permissions?.audit, enabled: true },
      },
    }),
  },
  {
    id: 'perm-02',
    name: 'Path Restrictions',
    description: 'Check if filesystem path restrictions are configured',
    severity: 'error',
    category: 'permissions',
    check: (config) => {
      const hasRestrictions =
        (config.permissions?.paths?.allow && config.permissions.paths.allow.length > 0) ||
        (config.permissions?.paths?.deny && config.permissions.paths.deny.length > 0);
      return {
        passed: hasRestrictions,
        message: hasRestrictions
          ? 'Filesystem path restrictions are configured'
          : 'No filesystem path restrictions - this allows access to all files',
      };
    },
    fix: (config) => ({
      ...config,
      permissions: {
        ...config.permissions,
        paths: {
          ...config.permissions?.paths,
          allow: config.permissions?.paths?.allow || [process.cwd()],
        },
      },
    }),
  },
  {
    id: 'perm-03',
    name: 'Tool Allowlist',
    description: 'Check if tool allowlist is configured',
    severity: 'info',
    category: 'permissions',
    check: (config) => {
      const hasAllowlist = config.permissions?.tools?.allow && config.permissions.tools.allow.length > 0;
      return {
        passed: hasAllowlist ?? false,
        message: hasAllowlist
          ? `${config.permissions!.tools!.allow!.length} tools allowed`
          : 'No tool allowlist - all tools are allowed by default',
      };
    },
  },
  {
    id: 'perm-04',
    name: 'Command Restrictions',
    description: 'Check if dangerous commands are blocked',
    severity: 'warning',
    category: 'permissions',
    check: (config) => {
      const dangerousCommands = ['rm -rf', 'sudo', 'chmod 777', 'mkfs', 'dd if='];
      const blocked = config.permissions?.commands?.deny || [];
      const hasBlocked = dangerousCommands.some((cmd) =>
        blocked.some((b) => b.includes(cmd) || cmd.includes(b))
      );
      return {
        passed: hasBlocked,
        message: hasBlocked
          ? 'Some dangerous commands are blocked'
          : 'No dangerous command restrictions - consider blocking risky commands',
      };
    },
    fix: (config) => ({
      ...config,
      permissions: {
        ...config.permissions,
        commands: {
          ...config.permissions?.commands,
          deny: [
            ...(config.permissions?.commands?.deny || []),
            'rm -rf /',
            'sudo rm',
            'chmod 777',
            'mkfs',
            'dd if=/dev/zero',
          ],
        },
      },
    }),
  },

  // Network security checks
  {
    id: 'net-01',
    name: 'SSL/TLS Enabled',
    description: 'Verify that SSL/TLS is enabled for secure connections',
    severity: 'error',
    category: 'network',
    check: (config) => {
      const enabled = config.network?.enableSSL ?? true;
      return {
        passed: enabled,
        message: enabled
          ? 'SSL/TLS is enabled'
          : 'SSL/TLS is disabled - connections are not encrypted',
        value: enabled,
      };
    },
    fix: (config) => ({
      ...config,
      network: { ...config.network, enableSSL: true },
    }),
  },
  {
    id: 'net-02',
    name: 'External Request Policy',
    description: 'Check if external requests are properly restricted',
    severity: 'warning',
    category: 'network',
    check: (config) => {
      const allowExternal = config.network?.allowExternalRequests ?? true;
      const hasDomainRestrictions =
        (config.network?.trustedDomains && config.network.trustedDomains.length > 0) ||
        (config.network?.blockedDomains && config.network.blockedDomains.length > 0);
      const isSecure = !allowExternal || hasDomainRestrictions;
      return {
        passed: isSecure,
        message: isSecure
          ? 'External requests are properly restricted'
          : 'External requests are allowed without restrictions',
      };
    },
    fix: (config) => ({
      ...config,
      network: {
        ...config.network,
        allowExternalRequests: true,
        trustedDomains: config.network?.trustedDomains || [
          'api.anthropic.com',
          'claude.ai',
          'console.anthropic.com',
        ],
      },
    }),
  },
  {
    id: 'net-03',
    name: 'Blocked Domains',
    description: 'Check if known malicious domains are blocked',
    severity: 'info',
    category: 'network',
    check: (config) => {
      const blockedCount = config.network?.blockedDomains?.length || 0;
      return {
        passed: blockedCount > 0,
        message:
          blockedCount > 0
            ? `${blockedCount} domains blocked`
            : 'No domains blocked - consider blocking known malicious domains',
        value: blockedCount,
      };
    },
  },

  // Filesystem security checks
  {
    id: 'fs-01',
    name: 'Working Directory Restriction',
    description: 'Check if filesystem access is restricted to working directory',
    severity: 'warning',
    category: 'filesystem',
    check: (config) => {
      const restricted = config.filesystem?.restrictToWorkdir ?? false;
      return {
        passed: restricted,
        message: restricted
          ? 'Filesystem access restricted to working directory'
          : 'Filesystem access not restricted - can access any directory',
        value: restricted,
      };
    },
    fix: (config) => ({
      ...config,
      filesystem: { ...config.filesystem, restrictToWorkdir: true },
    }),
  },
  {
    id: 'fs-02',
    name: 'Symlink Traversal Protection',
    description: 'Check if symlink traversal attacks are prevented',
    severity: 'error',
    category: 'filesystem',
    check: (config) => {
      const prevented = config.filesystem?.preventSymlinkTraversal ?? false;
      return {
        passed: prevented,
        message: prevented
          ? 'Symlink traversal attacks are prevented'
          : 'Symlink traversal not prevented - vulnerable to path traversal',
        value: prevented,
      };
    },
    fix: (config) => ({
      ...config,
      filesystem: { ...config.filesystem, preventSymlinkTraversal: true },
    }),
  },
  {
    id: 'fs-03',
    name: 'File Size Limits',
    description: 'Check if file size limits are configured',
    severity: 'info',
    category: 'filesystem',
    check: (config) => {
      const hasLimit = config.filesystem?.maxFileSize !== undefined && config.filesystem.maxFileSize > 0;
      return {
        passed: hasLimit,
        message: hasLimit
          ? `Max file size: ${(config.filesystem!.maxFileSize! / 1024 / 1024).toFixed(2)}MB`
          : 'No file size limit - large files could cause resource exhaustion',
      };
    },
    fix: (config) => ({
      ...config,
      filesystem: {
        ...config.filesystem,
        maxFileSize: config.filesystem?.maxFileSize || 100 * 1024 * 1024, // 100MB
      },
    }),
  },
  {
    id: 'fs-04',
    name: 'Dangerous File Extensions',
    description: 'Check if dangerous file extensions are blocked',
    severity: 'warning',
    category: 'filesystem',
    check: (config) => {
      const dangerousExts = ['.exe', '.dll', '.so', '.dylib', '.bin', '.cmd', '.bat', '.sh'];
      const blocked = config.filesystem?.blockedExtensions || [];
      const hasBlocked = dangerousExts.some((ext) => blocked.includes(ext));
      return {
        passed: hasBlocked,
        message: hasBlocked
          ? 'Some dangerous file extensions are blocked'
          : 'No dangerous file extensions blocked - consider blocking executables',
      };
    },
  },

  // Execution security checks
  {
    id: 'exec-01',
    name: 'Sandbox Enabled',
    description: 'Check if code execution sandbox is enabled',
    severity: 'critical',
    category: 'execution',
    check: (config) => {
      const enabled = config.execution?.sandboxEnabled ?? false;
      return {
        passed: enabled,
        message: enabled
          ? 'Code execution sandbox is enabled'
          : 'Sandbox is disabled - code runs without isolation',
        value: enabled,
      };
    },
    fix: (config) => ({
      ...config,
      execution: { ...config.execution, sandboxEnabled: true },
    }),
  },
  {
    id: 'exec-02',
    name: 'Execution Timeout',
    description: 'Check if execution timeout is configured',
    severity: 'warning',
    category: 'execution',
    check: (config) => {
      const hasTimeout = config.execution?.timeoutMs !== undefined && config.execution.timeoutMs > 0;
      return {
        passed: hasTimeout,
        message: hasTimeout
          ? `Execution timeout: ${config.execution!.timeoutMs! / 1000}s`
          : 'No execution timeout - long-running processes could hang',
      };
    },
    fix: (config) => ({
      ...config,
      execution: {
        ...config.execution,
        timeoutMs: config.execution?.timeoutMs || 300000, // 5 minutes
      },
    }),
  },
  {
    id: 'exec-03',
    name: 'Resource Limits',
    description: 'Check if memory and CPU limits are configured',
    severity: 'info',
    category: 'execution',
    check: (config) => {
      const hasMemoryLimit = config.execution?.maxMemoryMb !== undefined && config.execution.maxMemoryMb > 0;
      const hasCpuLimit = config.execution?.maxCpuPercent !== undefined && config.execution.maxCpuPercent > 0;
      const hasLimits = hasMemoryLimit || hasCpuLimit;
      return {
        passed: hasLimits,
        message: hasLimits
          ? 'Resource limits are configured'
          : 'No resource limits - processes could exhaust system resources',
      };
    },
    fix: (config) => ({
      ...config,
      execution: {
        ...config.execution,
        maxMemoryMb: config.execution?.maxMemoryMb || 1024, // 1GB
        maxCpuPercent: config.execution?.maxCpuPercent || 80,
      },
    }),
  },
  {
    id: 'exec-04',
    name: 'Shell Command Restrictions',
    description: 'Check if shell commands are properly restricted',
    severity: 'error',
    category: 'execution',
    check: (config) => {
      const allowShell = config.execution?.allowShellCommands ?? true;
      const dangerousBlocked = config.execution?.dangerousCommandsBlocked ?? false;
      const isSecure = !allowShell || dangerousBlocked;
      return {
        passed: isSecure,
        message: isSecure
          ? 'Shell commands are properly restricted'
          : 'Shell commands are allowed without restrictions',
      };
    },
    fix: (config) => ({
      ...config,
      execution: {
        ...config.execution,
        allowShellCommands: true,
        dangerousCommandsBlocked: true,
      },
    }),
  },

  // Data security checks
  {
    id: 'data-01',
    name: 'Encryption at Rest',
    description: 'Check if data is encrypted at rest',
    severity: 'error',
    category: 'data',
    check: (config) => {
      const encrypted = config.data?.encryptAtRest ?? false;
      return {
        passed: encrypted,
        message: encrypted
          ? 'Data is encrypted at rest'
          : 'Data is not encrypted at rest - sensitive data could be exposed',
        value: encrypted,
      };
    },
    fix: (config) => ({
      ...config,
      data: { ...config.data, encryptAtRest: true },
    }),
  },
  {
    id: 'data-02',
    name: 'Encryption in Transit',
    description: 'Check if data is encrypted in transit',
    severity: 'critical',
    category: 'data',
    check: (config) => {
      const encrypted = config.data?.encryptInTransit ?? true;
      return {
        passed: encrypted,
        message: encrypted
          ? 'Data is encrypted in transit'
          : 'Data is not encrypted in transit - vulnerable to interception',
        value: encrypted,
      };
    },
    fix: (config) => ({
      ...config,
      data: { ...config.data, encryptInTransit: true },
    }),
  },
  {
    id: 'data-03',
    name: 'Sensitive Data Masking',
    description: 'Check if sensitive data is masked in logs',
    severity: 'warning',
    category: 'data',
    check: (config) => {
      const masked = config.data?.sensitiveDataMasking ?? false;
      return {
        passed: masked,
        message: masked
          ? 'Sensitive data is masked in logs'
          : 'Sensitive data not masked - could leak in logs',
        value: masked,
      };
    },
    fix: (config) => ({
      ...config,
      data: { ...config.data, sensitiveDataMasking: true },
    }),
  },
  {
    id: 'data-04',
    name: 'Data Retention Policy',
    description: 'Check if data retention policy is configured',
    severity: 'info',
    category: 'data',
    check: (config) => {
      const hasRetention = config.data?.dataRetentionDays !== undefined && config.data.dataRetentionDays > 0;
      return {
        passed: hasRetention,
        message: hasRetention
          ? `Data retention: ${config.data!.dataRetentionDays} days`
          : 'No data retention policy - old data never expires',
      };
    },
    fix: (config) => ({
      ...config,
      data: {
        ...config.data,
        dataRetentionDays: config.data?.dataRetentionDays || 90,
      },
    }),
  },

  // Code signing checks
  {
    id: 'sign-01',
    name: 'Code Signing Enabled',
    description: 'Check if code signing is enabled',
    severity: 'warning',
    category: 'general',
    check: (config) => {
      const enabled = config.codeSigning?.enabled ?? false;
      return {
        passed: enabled,
        message: enabled
          ? 'Code signing is enabled'
          : 'Code signing is disabled - code integrity cannot be verified',
        value: enabled,
      };
    },
    fix: (config) => ({
      ...config,
      codeSigning: { ...config.codeSigning, enabled: true },
    }),
  },
  {
    id: 'sign-02',
    name: 'Verify Before Execution',
    description: 'Check if code is verified before execution',
    severity: 'error',
    category: 'general',
    check: (config) => {
      if (!config.codeSigning?.enabled) {
        return { passed: true, message: 'Code signing not enabled' };
      }
      const verified = config.codeSigning.verifyBeforeExecution ?? false;
      return {
        passed: verified,
        message: verified
          ? 'Code is verified before execution'
          : 'Code is not verified before execution - tampered code could run',
      };
    },
    fix: (config) => ({
      ...config,
      codeSigning: {
        ...config.codeSigning,
        enabled: true,
        verifyBeforeExecution: true,
      },
    }),
  },
];

// ============ Risk Scoring ============

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 10,
  error: 7,
  warning: 4,
  info: 1,
};

const CATEGORY_WEIGHTS: Record<string, number> = {
  auth: 1.5,
  execution: 1.4,
  data: 1.3,
  network: 1.2,
  filesystem: 1.1,
  permissions: 1.0,
  general: 0.8,
};

export function calculateRiskScore(report: ValidationReport): number {
  let totalScore = 0;
  let maxScore = 0;

  for (const issue of report.issues) {
    const severityWeight = SEVERITY_WEIGHTS[issue.severity];
    const categoryWeight = CATEGORY_WEIGHTS[issue.category] || 1.0;
    const score = severityWeight * categoryWeight;
    totalScore += score;
  }

  // Calculate max possible score
  for (const check of DEFAULT_SECURITY_CHECKS) {
    const severityWeight = SEVERITY_WEIGHTS[check.severity];
    const categoryWeight = CATEGORY_WEIGHTS[check.category] || 1.0;
    maxScore += severityWeight * categoryWeight;
  }

  // Normalize to 0-100 scale
  return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

// ============ SecurityValidator Class ============

export class SecurityValidator {
  private checks: SecurityCheck[];

  constructor(checks?: SecurityCheck[]) {
    this.checks = checks || [...DEFAULT_SECURITY_CHECKS];
  }

  /**
   * Validate security configuration
   */
  validate(config: SecurityConfig): ValidationReport {
    const issues: ValidationIssue[] = [];
    let passedChecks = 0;

    for (const check of this.checks) {
      const result = check.check(config);
      if (result.passed) {
        passedChecks++;
      } else {
        issues.push({
          checkId: check.id,
          name: check.name,
          severity: check.severity,
          category: check.category,
          message: result.message,
          details: result.details,
          hasFix: !!check.fix,
        });
      }
    }

    const report: ValidationReport = {
      timestamp: Date.now(),
      passed: issues.length === 0,
      totalChecks: this.checks.length,
      passedChecks,
      failedChecks: issues.length,
      issues,
      riskScore: 0,
      riskLevel: 'low',
    };

    // Calculate risk score
    report.riskScore = calculateRiskScore(report);
    report.riskLevel = getRiskLevel(report.riskScore);

    return report;
  }

  /**
   * Assess risk levels across categories
   */
  assessRisk(config: SecurityConfig): RiskAssessment {
    const report = this.validate(config);
    const categories: RiskAssessment['categories'] = {};
    const criticalIssues = report.issues.filter((i) => i.severity === 'critical');

    // Calculate category-specific scores
    for (const category of Object.keys(CATEGORY_WEIGHTS)) {
      const categoryIssues = report.issues.filter((i) => i.category === category);
      let categoryScore = 0;

      for (const issue of categoryIssues) {
        categoryScore += SEVERITY_WEIGHTS[issue.severity];
      }

      categories[category] = {
        score: categoryScore,
        weight: CATEGORY_WEIGHTS[category],
        issues: categoryIssues.length,
      };
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (criticalIssues.length > 0) {
      recommendations.push(`Fix ${criticalIssues.length} critical security issue(s) immediately`);
    }
    if (report.riskScore >= 50) {
      recommendations.push('Overall security posture is weak - implement missing security controls');
    }
    if (!config.auth?.requireAuth) {
      recommendations.push('Enable authentication to prevent unauthorized access');
    }
    if (!config.execution?.sandboxEnabled) {
      recommendations.push('Enable sandbox for code execution to prevent system compromise');
    }
    if (!config.data?.encryptInTransit) {
      recommendations.push('Enable encryption in transit to protect data from interception');
    }

    return {
      overallScore: report.riskScore,
      riskLevel: report.riskLevel,
      categories,
      criticalIssues,
      recommendations,
    };
  }

  /**
   * Check compliance with security best practices
   */
  checkBestPractices(config: SecurityConfig): BestPracticeReport {
    const practices = [
      {
        id: 'bp-01',
        name: 'Defense in Depth',
        check: () => {
          const layers = [
            config.auth?.requireAuth,
            config.permissions?.audit?.enabled,
            config.execution?.sandboxEnabled,
            config.data?.encryptAtRest,
            config.data?.encryptInTransit,
          ].filter(Boolean).length;
          return layers >= 3;
        },
        recommendation: 'Implement multiple layers of security controls (authentication, audit, sandbox, encryption)',
      },
      {
        id: 'bp-02',
        name: 'Least Privilege',
        check: () => {
          return (
            (config.permissions?.tools?.allow && config.permissions.tools.allow.length > 0) ||
            (config.permissions?.commands?.deny && config.permissions.commands.deny.length > 0) ||
            (config.permissions?.paths?.allow && config.permissions.paths.allow.length > 0)
          );
        },
        recommendation: 'Restrict tools, commands, and file access to minimum required',
      },
      {
        id: 'bp-03',
        name: 'Secure by Default',
        check: () => {
          return (
            (config.network?.enableSSL ?? true) &&
            (config.data?.encryptInTransit ?? true) &&
            !(config.execution?.allowShellCommands ?? true) ||
            (config.execution?.dangerousCommandsBlocked ?? false)
          );
        },
        recommendation: 'Use secure defaults: SSL enabled, encryption on, dangerous commands blocked',
      },
      {
        id: 'bp-04',
        name: 'Fail Securely',
        check: () => {
          return (
            config.auth?.requireAuth &&
            config.execution?.sandboxEnabled &&
            config.filesystem?.preventSymlinkTraversal
          );
        },
        recommendation: 'Ensure system fails securely: require auth, use sandbox, prevent path traversal',
      },
      {
        id: 'bp-05',
        name: 'Audit and Monitoring',
        check: () => {
          return (
            config.permissions?.audit?.enabled &&
            config.permissions?.audit?.logFile !== undefined
          );
        },
        recommendation: 'Enable comprehensive audit logging for security monitoring',
      },
    ];

    const results = practices.map((p) => ({
      id: p.id,
      name: p.name,
      compliant: p.check(),
      recommendation: p.check() ? undefined : p.recommendation,
    }));

    const compliantCount = results.filter((r) => r.compliant).length;
    const complianceScore = Math.round((compliantCount / practices.length) * 100);

    return {
      compliant: compliantCount === practices.length,
      complianceScore,
      practices: results,
    };
  }

  /**
   * Get improvement suggestions based on validation report
   */
  getSuggestions(report: ValidationReport): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const issuesByCategory = new Map<string, ValidationIssue[]>();

    // Group issues by category
    for (const issue of report.issues) {
      if (!issuesByCategory.has(issue.category)) {
        issuesByCategory.set(issue.category, []);
      }
      issuesByCategory.get(issue.category)!.push(issue);
    }

    // Generate category-level suggestions
    for (const [category, issues] of Array.from(issuesByCategory.entries())) {
      const criticalCount = issues.filter((i) => i.severity === 'critical').length;
      const autoFixableCount = issues.filter((i) => i.hasFix).length;

      if (criticalCount > 0) {
        suggestions.push({
          priority: 'high',
          category,
          title: `Fix ${criticalCount} critical ${category} issue(s)`,
          description: issues
            .filter((i) => i.severity === 'critical')
            .map((i) => i.message)
            .join('; '),
          autoFixable: autoFixableCount > 0,
          checkIds: issues.filter((i) => i.severity === 'critical').map((i) => i.checkId),
        });
      } else if (issues.length > 0) {
        suggestions.push({
          priority: issues.some((i) => i.severity === 'error') ? 'high' : 'medium',
          category,
          title: `Address ${issues.length} ${category} issue(s)`,
          description: `Improve ${category} security configuration`,
          autoFixable: autoFixableCount > 0,
          checkIds: issues.map((i) => i.checkId),
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions;
  }

  /**
   * Automatically fix issues where possible
   */
  autoFix(config: SecurityConfig): SecurityConfig {
    let fixedConfig = { ...config };

    for (const check of this.checks) {
      if (check.fix) {
        const result = check.check(fixedConfig);
        if (!result.passed) {
          fixedConfig = check.fix(fixedConfig);
        }
      }
    }

    return fixedConfig;
  }

  /**
   * Add a custom security check
   */
  addCheck(check: SecurityCheck): void {
    this.checks.push(check);
  }

  /**
   * Get all registered checks
   */
  getChecks(): SecurityCheck[] {
    return [...this.checks];
  }

  /**
   * Remove a check by ID
   */
  removeCheck(id: string): boolean {
    const initialLength = this.checks.length;
    this.checks = this.checks.filter((c) => c.id !== id);
    return this.checks.length < initialLength;
  }

  /**
   * Get check by ID
   */
  getCheck(id: string): SecurityCheck | undefined {
    return this.checks.find((c) => c.id === id);
  }
}

// ============ Utility Functions ============

/**
 * Create SecurityConfig from UserConfig
 */
export function createSecurityConfigFromUserConfig(userConfig: UserConfig): SecurityConfig {
  return {
    auth: {
      type: userConfig.apiKey ? 'api_key' : userConfig.oauthToken ? 'oauth' : 'none',
      apiKey: userConfig.apiKey,
      oauthToken: userConfig.oauthToken,
      requireAuth: !!(userConfig.apiKey || userConfig.oauthToken),
    },
    permissions: userConfig.permissions,
    network: {
      enableSSL: true,
      allowExternalRequests: true,
      trustedDomains: ['api.anthropic.com', 'claude.ai', 'console.anthropic.com'],
    },
    execution: {
      sandboxEnabled: false,
      allowShellCommands: true,
      dangerousCommandsBlocked: false,
    },
    data: {
      encryptAtRest: false,
      encryptInTransit: true,
      sensitiveDataMasking: false,
    },
  };
}

/**
 * Create a default secure SecurityConfig
 */
export function createDefaultSecureConfig(): SecurityConfig {
  return {
    auth: {
      type: 'api_key',
      requireAuth: true,
    },
    permissions: {
      audit: {
        enabled: true,
        logFile: '~/.claude/audit.log',
        maxSize: 10 * 1024 * 1024, // 10MB
      },
      paths: {
        allow: [process.cwd()],
      },
    },
    network: {
      enableSSL: true,
      allowExternalRequests: true,
      trustedDomains: ['api.anthropic.com', 'claude.ai', 'console.anthropic.com'],
    },
    filesystem: {
      restrictToWorkdir: true,
      preventSymlinkTraversal: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
    },
    execution: {
      sandboxEnabled: true,
      timeoutMs: 300000, // 5 minutes
      maxMemoryMb: 1024, // 1GB
      maxCpuPercent: 80,
      allowShellCommands: true,
      dangerousCommandsBlocked: true,
    },
    data: {
      encryptAtRest: true,
      encryptInTransit: true,
      sensitiveDataMasking: true,
      dataRetentionDays: 90,
    },
    codeSigning: {
      enabled: true,
      verifyBeforeExecution: true,
      requireSignedScripts: false,
    },
  };
}
