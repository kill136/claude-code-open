# Security Validation Module

Comprehensive security configuration validation and risk assessment for Claude Code.

## Features

- **Configuration Validation** - Verify security configurations against best practices
- **Risk Assessment** - Calculate risk scores and identify critical vulnerabilities
- **Best Practice Compliance** - Check adherence to security principles
- **Auto-Fix** - Automatically remediate common security issues
- **Custom Checks** - Extend with custom security validations
- **Detailed Reporting** - Generate actionable security reports

## Quick Start

```typescript
import { SecurityValidator, createDefaultSecureConfig } from './security/validate.js';

// Create a validator
const validator = new SecurityValidator();

// Create a secure configuration
const config = createDefaultSecureConfig();

// Validate the configuration
const report = validator.validate(config);

console.log(`Risk Score: ${report.riskScore}/100`);
console.log(`Risk Level: ${report.riskLevel}`);
console.log(`Passed: ${report.passedChecks}/${report.totalChecks}`);
```

## Core Concepts

### SecurityConfig

The main configuration object that defines security settings:

```typescript
interface SecurityConfig {
  auth?: {
    type: 'api_key' | 'oauth' | 'none';
    requireAuth: boolean;
  };
  permissions?: {
    audit?: { enabled: boolean };
    tools?: { allow?: string[]; deny?: string[] };
    paths?: { allow?: string[]; deny?: string[] };
  };
  execution?: {
    sandboxEnabled: boolean;
    allowShellCommands: boolean;
    dangerousCommandsBlocked: boolean;
  };
  network?: {
    enableSSL: boolean;
    allowExternalRequests: boolean;
    trustedDomains?: string[];
  };
  data?: {
    encryptAtRest: boolean;
    encryptInTransit: boolean;
    sensitiveDataMasking: boolean;
  };
}
```

### Security Checks

Each security check validates a specific security control:

- **ID**: Unique identifier (e.g., "auth-01")
- **Severity**: critical | error | warning | info
- **Category**: auth | permissions | network | filesystem | execution | data
- **Check Function**: Validates the configuration
- **Fix Function**: Optional auto-remediation

## Default Security Checks

The module includes 26 built-in security checks:

### Authentication (3 checks)
- `auth-01`: Authentication required
- `auth-02`: OAuth token expiry
- `auth-03`: API key security

### Permissions (4 checks)
- `perm-01`: Audit logging enabled
- `perm-02`: Path restrictions
- `perm-03`: Tool allowlist
- `perm-04`: Command restrictions

### Network (3 checks)
- `net-01`: SSL/TLS enabled
- `net-02`: External request policy
- `net-03`: Blocked domains

### Filesystem (4 checks)
- `fs-01`: Working directory restriction
- `fs-02`: Symlink traversal protection
- `fs-03`: File size limits
- `fs-04`: Dangerous file extensions

### Execution (4 checks)
- `exec-01`: Sandbox enabled
- `exec-02`: Execution timeout
- `exec-03`: Resource limits
- `exec-04`: Shell command restrictions

### Data Security (4 checks)
- `data-01`: Encryption at rest
- `data-02`: Encryption in transit
- `data-03`: Sensitive data masking
- `data-04`: Data retention policy

### Code Signing (2 checks)
- `sign-01`: Code signing enabled
- `sign-02`: Verify before execution

## API Reference

### SecurityValidator

Main validation class:

```typescript
class SecurityValidator {
  constructor(checks?: SecurityCheck[]);

  // Validate configuration
  validate(config: SecurityConfig): ValidationReport;

  // Assess risk levels
  assessRisk(config: SecurityConfig): RiskAssessment;

  // Check best practices
  checkBestPractices(config: SecurityConfig): BestPracticeReport;

  // Get suggestions
  getSuggestions(report: ValidationReport): Suggestion[];

  // Auto-fix issues
  autoFix(config: SecurityConfig): SecurityConfig;

  // Manage checks
  addCheck(check: SecurityCheck): void;
  removeCheck(id: string): boolean;
  getCheck(id: string): SecurityCheck | undefined;
  getChecks(): SecurityCheck[];
}
```

### ValidationReport

Result of security validation:

```typescript
interface ValidationReport {
  timestamp: number;
  passed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  issues: ValidationIssue[];
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
```

### RiskAssessment

Detailed risk analysis:

```typescript
interface RiskAssessment {
  overallScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  categories: {
    [category: string]: {
      score: number;
      weight: number;
      issues: number;
    };
  };
  criticalIssues: ValidationIssue[];
  recommendations: string[];
}
```

## Usage Examples

### Example 1: Basic Validation

```typescript
const validator = new SecurityValidator();

const config: SecurityConfig = {
  auth: {
    type: 'api_key',
    requireAuth: true,
  },
  execution: {
    sandboxEnabled: false, // Will fail check
    allowShellCommands: true,
    dangerousCommandsBlocked: false,
  },
};

const report = validator.validate(config);

console.log(`Risk Score: ${report.riskScore}/100`);
console.log(`Issues: ${report.failedChecks}`);

// Show critical issues
report.issues
  .filter(i => i.severity === 'critical')
  .forEach(issue => {
    console.log(`[CRITICAL] ${issue.name}: ${issue.message}`);
  });
```

### Example 2: Risk Assessment

```typescript
const validator = new SecurityValidator();
const config = getMyConfig();

const assessment = validator.assessRisk(config);

console.log(`Risk Level: ${assessment.riskLevel}`);
console.log(`\nRecommendations:`);
assessment.recommendations.forEach(rec => {
  console.log(`- ${rec}`);
});

console.log(`\nCategory Breakdown:`);
for (const [category, stats] of Object.entries(assessment.categories)) {
  console.log(`${category}: ${stats.issues} issues (score: ${stats.score})`);
}
```

### Example 3: Auto-Fix

```typescript
const validator = new SecurityValidator();

// Start with insecure config
const insecureConfig: SecurityConfig = {
  auth: { type: 'none', requireAuth: false },
  execution: { sandboxEnabled: false },
  data: { encryptAtRest: false, encryptInTransit: false },
};

// Auto-fix issues
const fixedConfig = validator.autoFix(insecureConfig);

// Verify improvement
const beforeScore = validator.validate(insecureConfig).riskScore;
const afterScore = validator.validate(fixedConfig).riskScore;

console.log(`Risk reduced from ${beforeScore} to ${afterScore}`);
```

### Example 4: Custom Checks

```typescript
const validator = new SecurityValidator();

// Add custom security check
validator.addCheck({
  id: 'custom-mfa',
  name: 'Multi-Factor Authentication',
  description: 'Verify MFA is enabled',
  severity: 'error',
  category: 'auth',
  check: (config) => {
    const mfaEnabled = config.auth?.mfaEnabled ?? false;
    return {
      passed: mfaEnabled,
      message: mfaEnabled
        ? 'MFA is enabled'
        : 'MFA is not enabled - highly recommended',
    };
  },
  fix: (config) => ({
    ...config,
    auth: { ...config.auth, mfaEnabled: true },
  }),
});

const report = validator.validate(myConfig);
```

### Example 5: Best Practices

```typescript
const validator = new SecurityValidator();
const config = getMyConfig();

const report = validator.checkBestPractices(config);

console.log(`Compliance: ${report.complianceScore}%`);

report.practices.forEach(practice => {
  const status = practice.compliant ? '✓' : '✗';
  console.log(`${status} ${practice.name}`);

  if (practice.recommendation) {
    console.log(`  → ${practice.recommendation}`);
  }
});
```

### Example 6: Get Suggestions

```typescript
const validator = new SecurityValidator();
const report = validator.validate(myConfig);
const suggestions = validator.getSuggestions(report);

// Group by priority
const highPriority = suggestions.filter(s => s.priority === 'high');

console.log('High Priority Actions:');
highPriority.forEach(suggestion => {
  console.log(`\n${suggestion.title}`);
  console.log(`Category: ${suggestion.category}`);
  console.log(`Description: ${suggestion.description}`);
  console.log(`Auto-fixable: ${suggestion.autoFixable ? 'Yes' : 'No'}`);
});
```

## Risk Scoring

Risk scores are calculated using:

1. **Severity Weights**:
   - Critical: 10 points
   - Error: 7 points
   - Warning: 4 points
   - Info: 1 point

2. **Category Weights**:
   - Auth: 1.5x
   - Execution: 1.4x
   - Data: 1.3x
   - Network: 1.2x
   - Filesystem: 1.1x
   - Permissions: 1.0x
   - General: 0.8x

3. **Risk Levels**:
   - 0-24: Low
   - 25-49: Medium
   - 50-74: High
   - 75-100: Critical

## Best Practices Checked

The module validates compliance with these security principles:

1. **Defense in Depth** - Multiple layers of security controls
2. **Least Privilege** - Minimal permissions and access rights
3. **Secure by Default** - Safe defaults (SSL, encryption, etc.)
4. **Fail Securely** - System fails safely on errors
5. **Audit and Monitoring** - Comprehensive logging enabled

## Integration

### With UserConfig

```typescript
import { configManager } from '../config/index.js';
import { createSecurityConfigFromUserConfig } from './validate.js';

const userConfig = configManager.getAll();
const securityConfig = createSecurityConfigFromUserConfig(userConfig);

const validator = new SecurityValidator();
const report = validator.validate(securityConfig);
```

### With CLI

```typescript
// In a command handler
import { SecurityValidator } from '../security/validate.js';

export async function securityAuditCommand() {
  const config = loadCurrentSecurityConfig();
  const validator = new SecurityValidator();

  const report = validator.validate(config);
  const assessment = validator.assessRisk(config);

  displaySecurityReport(report, assessment);
}
```

## Testing

Run the examples to test the module:

```bash
npm run dev src/security/example.ts
```

This will run all 7 example scenarios demonstrating the module's features.

## File Structure

```
src/security/
├── index.ts       # Module exports
├── validate.ts    # Main validation logic (1150 lines)
├── example.ts     # Usage examples
└── README.md      # This file
```

## License

Part of the Claude Code project - educational reverse-engineering study.
