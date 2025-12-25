/**
 * Security Validation Examples
 * Demonstrates usage of the security validation module
 */

import {
  SecurityValidator,
  SecurityConfig,
  createDefaultSecureConfig,
  createSecurityConfigFromUserConfig,
  DEFAULT_SECURITY_CHECKS,
  type ValidationReport,
  type RiskAssessment,
  type BestPracticeReport,
} from './validate.js';

// ============ Example 1: Basic Validation ============

function example1BasicValidation() {
  console.log('=== Example 1: Basic Validation ===\n');

  // Create a validator
  const validator = new SecurityValidator();

  // Create a test configuration (insecure)
  const insecureConfig: SecurityConfig = {
    auth: {
      type: 'none',
      requireAuth: false,
    },
    execution: {
      sandboxEnabled: false,
      allowShellCommands: true,
      dangerousCommandsBlocked: false,
    },
    data: {
      encryptAtRest: false,
      encryptInTransit: false,
      sensitiveDataMasking: false,
    },
  };

  // Validate the configuration
  const report = validator.validate(insecureConfig);

  console.log(`Total Checks: ${report.totalChecks}`);
  console.log(`Passed: ${report.passedChecks}`);
  console.log(`Failed: ${report.failedChecks}`);
  console.log(`Risk Score: ${report.riskScore}/100`);
  console.log(`Risk Level: ${report.riskLevel}`);
  console.log(`\nIssues found: ${report.issues.length}`);

  // Show critical issues
  const criticalIssues = report.issues.filter((i) => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    console.log('\nCritical Issues:');
    criticalIssues.forEach((issue) => {
      console.log(`  - [${issue.checkId}] ${issue.name}: ${issue.message}`);
    });
  }
}

// ============ Example 2: Risk Assessment ============

function example2RiskAssessment() {
  console.log('\n=== Example 2: Risk Assessment ===\n');

  const validator = new SecurityValidator();

  const config: SecurityConfig = {
    auth: {
      type: 'api_key',
      apiKey: 'sk-ant-test-key-12345678901234567890',
      requireAuth: true,
    },
    permissions: {
      audit: {
        enabled: false, // Risk: no audit logging
      },
    },
    execution: {
      sandboxEnabled: false, // Risk: no sandbox
      allowShellCommands: true,
      dangerousCommandsBlocked: false,
    },
    network: {
      enableSSL: true,
      allowExternalRequests: true,
    },
    data: {
      encryptAtRest: false, // Risk: no encryption
      encryptInTransit: true,
      sensitiveDataMasking: false,
    },
  };

  const assessment = validator.assessRisk(config);

  console.log(`Overall Risk Score: ${assessment.overallScore}/100`);
  console.log(`Risk Level: ${assessment.riskLevel}`);
  console.log(`\nCritical Issues: ${assessment.criticalIssues.length}`);

  console.log('\nCategory Risk Breakdown:');
  for (const [category, stats] of Object.entries(assessment.categories)) {
    if (stats.issues > 0) {
      console.log(
        `  ${category}: ${stats.issues} issue(s), score: ${stats.score}, weight: ${stats.weight}`
      );
    }
  }

  console.log('\nRecommendations:');
  assessment.recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
  });
}

// ============ Example 3: Best Practices Check ============

function example3BestPractices() {
  console.log('\n=== Example 3: Best Practices Check ===\n');

  const validator = new SecurityValidator();

  // Test with a moderately secure config
  const config: SecurityConfig = {
    auth: {
      type: 'api_key',
      requireAuth: true,
    },
    permissions: {
      audit: {
        enabled: true,
        logFile: '~/.claude/audit.log',
      },
      tools: {
        allow: ['Read', 'Write', 'Bash'],
      },
    },
    execution: {
      sandboxEnabled: true,
      allowShellCommands: true,
      dangerousCommandsBlocked: true,
    },
    network: {
      enableSSL: true,
      allowExternalRequests: true,
    },
    data: {
      encryptAtRest: true,
      encryptInTransit: true,
      sensitiveDataMasking: false,
    },
  };

  const report = validator.checkBestPractices(config);

  console.log(`Compliance Score: ${report.complianceScore}%`);
  console.log(`Fully Compliant: ${report.compliant ? 'Yes' : 'No'}`);
  console.log('\nBest Practices:');

  report.practices.forEach((practice) => {
    const status = practice.compliant ? '✓' : '✗';
    console.log(`  ${status} ${practice.name}`);
    if (practice.recommendation) {
      console.log(`    → ${practice.recommendation}`);
    }
  });
}

// ============ Example 4: Auto-Fix ============

function example4AutoFix() {
  console.log('\n=== Example 4: Auto-Fix ===\n');

  const validator = new SecurityValidator();

  // Start with an insecure config
  const insecureConfig: SecurityConfig = {
    auth: {
      type: 'none',
      requireAuth: false,
    },
    network: {
      enableSSL: false,
      allowExternalRequests: true,
    },
    execution: {
      sandboxEnabled: false,
      allowShellCommands: true,
      dangerousCommandsBlocked: false,
    },
    data: {
      encryptAtRest: false,
      encryptInTransit: false,
      sensitiveDataMasking: false,
    },
  };

  console.log('Before Auto-Fix:');
  const beforeReport = validator.validate(insecureConfig);
  console.log(`  Risk Score: ${beforeReport.riskScore}/100`);
  console.log(`  Failed Checks: ${beforeReport.failedChecks}`);
  console.log(`  Auto-fixable Issues: ${beforeReport.issues.filter((i) => i.hasFix).length}`);

  // Apply auto-fix
  const fixedConfig = validator.autoFix(insecureConfig);

  console.log('\nAfter Auto-Fix:');
  const afterReport = validator.validate(fixedConfig);
  console.log(`  Risk Score: ${afterReport.riskScore}/100`);
  console.log(`  Failed Checks: ${afterReport.failedChecks}`);
  console.log(`  Improvement: ${beforeReport.riskScore - afterReport.riskScore} points`);

  console.log('\nFixed Configuration Sample:');
  console.log(`  Auth Required: ${fixedConfig.auth?.requireAuth}`);
  console.log(`  SSL Enabled: ${fixedConfig.network?.enableSSL}`);
  console.log(`  Sandbox Enabled: ${fixedConfig.execution?.sandboxEnabled}`);
  console.log(`  Encrypt at Rest: ${fixedConfig.data?.encryptAtRest}`);
  console.log(`  Encrypt in Transit: ${fixedConfig.data?.encryptInTransit}`);
}

// ============ Example 5: Custom Security Checks ============

function example5CustomChecks() {
  console.log('\n=== Example 5: Custom Security Checks ===\n');

  const validator = new SecurityValidator();

  // Add a custom security check
  validator.addCheck({
    id: 'custom-01',
    name: 'API Key Rotation',
    description: 'Check if API keys are rotated regularly',
    severity: 'warning',
    category: 'auth',
    check: (config) => {
      // In a real scenario, you would check the key creation date
      return {
        passed: false,
        message: 'API key rotation policy not configured',
        details: 'Consider rotating API keys every 90 days',
      };
    },
    fix: (config) => {
      // In practice, this would set up a rotation reminder
      return config;
    },
  });

  // Add another custom check
  validator.addCheck({
    id: 'custom-02',
    name: 'Multi-Factor Authentication',
    description: 'Check if MFA is enabled for OAuth',
    severity: 'error',
    category: 'auth',
    check: (config) => {
      if (config.auth?.type !== 'oauth') {
        return { passed: true, message: 'Not using OAuth' };
      }
      // In practice, you would check MFA configuration
      return {
        passed: false,
        message: 'MFA is not enabled for OAuth authentication',
      };
    },
  });

  const config: SecurityConfig = {
    auth: {
      type: 'oauth',
      oauthToken: 'test-token',
      requireAuth: true,
    },
  };

  const report = validator.validate(config);
  console.log(`Total Checks: ${report.totalChecks} (includes ${validator.getChecks().length - DEFAULT_SECURITY_CHECKS.length} custom checks)`);
  console.log(`\nCustom Check Results:`);

  const customIssues = report.issues.filter((i) => i.checkId.startsWith('custom-'));
  customIssues.forEach((issue) => {
    console.log(`  - [${issue.checkId}] ${issue.name}`);
    console.log(`    ${issue.message}`);
    if (issue.details) {
      console.log(`    ${issue.details}`);
    }
  });
}

// ============ Example 6: Suggestions ============

function example6Suggestions() {
  console.log('\n=== Example 6: Security Suggestions ===\n');

  const validator = new SecurityValidator();

  const config: SecurityConfig = {
    auth: {
      type: 'none',
      requireAuth: false,
    },
    permissions: {
      audit: {
        enabled: false,
      },
    },
    execution: {
      sandboxEnabled: false,
      allowShellCommands: true,
      dangerousCommandsBlocked: false,
    },
    data: {
      encryptAtRest: false,
      encryptInTransit: false,
      sensitiveDataMasking: false,
    },
  };

  const report = validator.validate(config);
  const suggestions = validator.getSuggestions(report);

  console.log(`Generated ${suggestions.length} suggestions:\n`);

  suggestions.forEach((suggestion, i) => {
    const priorityIcon = suggestion.priority === 'high' ? '🔴' : suggestion.priority === 'medium' ? '🟡' : '🟢';
    console.log(`${i + 1}. ${priorityIcon} [${suggestion.priority.toUpperCase()}] ${suggestion.title}`);
    console.log(`   Category: ${suggestion.category}`);
    console.log(`   ${suggestion.description}`);
    console.log(`   Auto-fixable: ${suggestion.autoFixable ? 'Yes' : 'No'}`);
    console.log(`   Affected checks: ${suggestion.checkIds.join(', ')}`);
    console.log('');
  });
}

// ============ Example 7: Secure Config Creation ============

function example7SecureConfig() {
  console.log('\n=== Example 7: Create Secure Config ===\n');

  const validator = new SecurityValidator();

  // Create a default secure configuration
  const secureConfig = createDefaultSecureConfig();

  console.log('Default Secure Configuration:');
  console.log(JSON.stringify(secureConfig, null, 2));

  // Validate it
  const report = validator.validate(secureConfig);
  console.log(`\nValidation Results:`);
  console.log(`  Passed: ${report.passedChecks}/${report.totalChecks}`);
  console.log(`  Risk Score: ${report.riskScore}/100`);
  console.log(`  Risk Level: ${report.riskLevel}`);

  // Check best practices
  const bestPractices = validator.checkBestPractices(secureConfig);
  console.log(`\nBest Practices Compliance: ${bestPractices.complianceScore}%`);
}

// ============ Run All Examples ============

export function runAllExamples() {
  try {
    example1BasicValidation();
    example2RiskAssessment();
    example3BestPractices();
    example4AutoFix();
    example5CustomChecks();
    example6Suggestions();
    example7SecureConfig();

    console.log('\n=== All Examples Completed Successfully ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}
