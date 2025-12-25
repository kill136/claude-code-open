/**
 * Provider CLI Commands
 * Manage API providers (Anthropic, Bedrock, Vertex AI, Foundry)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  detectProvider,
  getProviderInfo,
  validateProviderConfig,
  getBedrockRegions,
  getAvailableBedrockModels,
  formatBedrockConfig,
  testBedrockCredentials,
  getProviderDisplayName,
  type ProviderType,
  type ProviderConfig,
} from './index.js';
import { createVertexAIClient, VERTEX_MODELS } from './vertex.js';

// Configuration file path
const getConfigFile = () => path.join(os.homedir(), '.claude', 'settings.json');

// Read configuration
const readConfig = (): Record<string, any> => {
  const configFile = getConfigFile();
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
};

// Write configuration
const writeConfig = (config: Record<string, any>): void => {
  const configDir = path.dirname(getConfigFile());
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
};

/**
 * Create provider command
 */
export function createProviderCommand(): Command {
  const providerCommand = new Command('provider')
    .description('Manage API providers (Anthropic, Bedrock, Vertex AI, Foundry)')
    .addHelpText(
      'after',
      `
Examples:
  $ claude provider list              List all supported providers
  $ claude provider status            Show current provider status
  $ claude provider use bedrock       Switch to AWS Bedrock
  $ claude provider test              Test current provider connection
  $ claude provider bedrock setup     Setup AWS Bedrock
  $ claude provider vertex setup      Setup Google Vertex AI
`
    );

  // provider list - List all supported providers
  providerCommand
    .command('list')
    .description('List all supported API providers')
    .action(() => {
      console.log(chalk.bold('\n📦 Supported API Providers:\n'));

      const providers: Array<{
        type: ProviderType;
        name: string;
        description: string;
        env: string[];
      }> = [
        {
          type: 'anthropic',
          name: 'Anthropic API',
          description: 'Official Anthropic API (default)',
          env: ['ANTHROPIC_API_KEY'],
        },
        {
          type: 'bedrock',
          name: 'AWS Bedrock',
          description: 'AWS Bedrock Runtime API',
          env: ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
        },
        {
          type: 'vertex',
          name: 'Google Vertex AI',
          description: 'Google Cloud Vertex AI',
          env: ['ANTHROPIC_VERTEX_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'],
        },
        {
          type: 'foundry',
          name: 'Anthropic Foundry',
          description: 'Anthropic Foundry (experimental)',
          env: ['ANTHROPIC_FOUNDRY_API_KEY'],
        },
      ];

      providers.forEach((p) => {
        console.log(chalk.cyan(`  ${p.name}`) + chalk.gray(` (${p.type})`));
        console.log(chalk.gray(`    ${p.description}`));
        console.log(chalk.gray(`    Environment: ${p.env.join(', ')}`));
        console.log();
      });

      console.log(chalk.gray('Use "claude provider use <name>" to switch providers\n'));
    });

  // provider status - Show current provider status
  providerCommand
    .command('status')
    .description('Show current provider status and configuration')
    .action(() => {
      try {
        const config = detectProvider();
        const info = getProviderInfo(config);
        const validation = validateProviderConfig(config);

        console.log(chalk.bold('\n📊 Current Provider Status:\n'));

        // Provider information
        console.log(chalk.cyan('Provider:') + ` ${info.name}`);
        console.log(chalk.cyan('Type:') + ` ${info.type}`);
        console.log(chalk.cyan('Model:') + ` ${info.model}`);
        if (info.region) {
          console.log(chalk.cyan('Region:') + ` ${info.region}`);
        }
        console.log(chalk.cyan('Endpoint:') + ` ${info.baseUrl}`);
        console.log();

        // Validation status
        if (validation.valid) {
          console.log(chalk.green('✓ Configuration is valid'));
        } else {
          console.log(chalk.red('✗ Configuration has errors:'));
          validation.errors.forEach((error) => {
            console.log(chalk.red(`  - ${error}`));
          });
        }

        // Warnings
        if (validation.warnings && validation.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠ Warnings:'));
          validation.warnings.forEach((warning) => {
            console.log(chalk.yellow(`  - ${warning}`));
          });
        }

        console.log();

        // Provider-specific details
        if (config.type === 'bedrock') {
          console.log(chalk.bold('AWS Bedrock Configuration:'));
          console.log(formatBedrockConfig(config));
          console.log();
        }
      } catch (error) {
        console.error(
          chalk.red('Error detecting provider:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  // provider use - Switch default provider
  providerCommand
    .command('use <provider>')
    .description('Switch to a different API provider')
    .option('-r, --region <region>', 'Provider region (for Bedrock/Vertex)')
    .option('-p, --project <project>', 'Project ID (for Vertex AI)')
    .option('-m, --model <model>', 'Default model to use')
    .action((providerName: string, options: any) => {
      const config = readConfig();

      const validProviders: ProviderType[] = ['anthropic', 'bedrock', 'vertex', 'foundry'];
      if (!validProviders.includes(providerName as ProviderType)) {
        console.error(
          chalk.red(`Invalid provider: ${providerName}`),
          chalk.gray(`\nValid options: ${validProviders.join(', ')}`)
        );
        process.exit(1);
      }

      // Update configuration
      config.provider = providerName;

      if (options.region) {
        config.providerRegion = options.region;
      }

      if (options.project) {
        config.vertexProjectId = options.project;
      }

      if (options.model) {
        config.model = options.model;
      }

      // Set environment hints
      switch (providerName) {
        case 'bedrock':
          config.CLAUDE_CODE_USE_BEDROCK = 'true';
          delete config.CLAUDE_CODE_USE_VERTEX;
          delete config.CLAUDE_CODE_USE_FOUNDRY;
          console.log(
            chalk.yellow(
              '\n⚠ Remember to set AWS credentials:\n' +
                '  - AWS_REGION\n' +
                '  - AWS_ACCESS_KEY_ID\n' +
                '  - AWS_SECRET_ACCESS_KEY\n'
            )
          );
          break;
        case 'vertex':
          config.CLAUDE_CODE_USE_VERTEX = 'true';
          delete config.CLAUDE_CODE_USE_BEDROCK;
          delete config.CLAUDE_CODE_USE_FOUNDRY;
          console.log(
            chalk.yellow(
              '\n⚠ Remember to set Vertex AI credentials:\n' +
                '  - ANTHROPIC_VERTEX_PROJECT_ID\n' +
                '  - GOOGLE_APPLICATION_CREDENTIALS\n'
            )
          );
          break;
        case 'foundry':
          config.CLAUDE_CODE_USE_FOUNDRY = 'true';
          delete config.CLAUDE_CODE_USE_BEDROCK;
          delete config.CLAUDE_CODE_USE_VERTEX;
          console.log(
            chalk.yellow(
              '\n⚠ Remember to set Foundry API key:\n' + '  - ANTHROPIC_FOUNDRY_API_KEY\n'
            )
          );
          break;
        default:
          delete config.CLAUDE_CODE_USE_BEDROCK;
          delete config.CLAUDE_CODE_USE_VERTEX;
          delete config.CLAUDE_CODE_USE_FOUNDRY;
          console.log(
            chalk.yellow('\n⚠ Remember to set API key:\n' + '  - ANTHROPIC_API_KEY\n')
          );
      }

      writeConfig(config);
      console.log(chalk.green(`✓ Switched to ${getProviderDisplayName(providerName as ProviderType)}`));
    });

  // provider test - Test provider connection
  providerCommand
    .command('test [provider]')
    .description('Test provider connection and credentials')
    .action(async (providerName?: string) => {
      try {
        const config = providerName
          ? ({ type: providerName } as ProviderConfig)
          : detectProvider();

        console.log(chalk.bold(`\n🔍 Testing ${getProviderDisplayName(config.type)}...\n`));

        // Validate configuration
        const validation = validateProviderConfig(config);

        if (!validation.valid) {
          console.log(chalk.red('✗ Configuration validation failed:'));
          validation.errors.forEach((error) => {
            console.log(chalk.red(`  - ${error}`));
          });
          process.exit(1);
        }

        console.log(chalk.green('✓ Configuration is valid'));

        // Provider-specific tests
        if (config.type === 'bedrock') {
          console.log(chalk.gray('Testing AWS credentials...'));
          const result = await testBedrockCredentials(config);
          if (result.success) {
            console.log(chalk.green('✓ AWS credentials are valid'));
          } else {
            console.log(chalk.red(`✗ AWS credentials test failed: ${result.error}`));
            process.exit(1);
          }
        }

        if (config.type === 'vertex') {
          console.log(chalk.gray('Testing Vertex AI credentials...'));
          try {
            const client = createVertexAIClient({
              projectId: config.projectId,
              region: config.region,
            });
            await client.getAccessToken();
            console.log(chalk.green('✓ Vertex AI credentials are valid'));
          } catch (error) {
            console.log(
              chalk.red(
                `✗ Vertex AI test failed: ${error instanceof Error ? error.message : String(error)}`
              )
            );
            process.exit(1);
          }
        }

        console.log(chalk.green('\n✓ All tests passed\n'));
      } catch (error) {
        console.error(
          chalk.red('Test failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  // provider config - Show/edit provider configuration
  providerCommand
    .command('config [provider]')
    .description('Show or edit provider configuration')
    .action((providerName?: string) => {
      const config = providerName ? ({ type: providerName } as ProviderConfig) : detectProvider();

      console.log(chalk.bold(`\n⚙️  ${getProviderDisplayName(config.type)} Configuration:\n`));

      const info = getProviderInfo(config);
      console.log(chalk.cyan('Provider Type:') + ` ${config.type}`);
      console.log(chalk.cyan('Display Name:') + ` ${info.name}`);
      console.log(chalk.cyan('Base URL:') + ` ${info.baseUrl}`);

      if (config.region) {
        console.log(chalk.cyan('Region:') + ` ${config.region}`);
      }

      if (config.model) {
        console.log(chalk.cyan('Model:') + ` ${config.model}`);
      }

      if (config.type === 'bedrock') {
        console.log('\n' + formatBedrockConfig(config));
      }

      if (config.type === 'vertex' && config.projectId) {
        console.log(chalk.cyan('Project ID:') + ` ${config.projectId}`);
      }

      console.log();
    });

  // Bedrock subcommands
  const bedrockCommand = providerCommand
    .command('bedrock')
    .description('AWS Bedrock management commands');

  bedrockCommand
    .command('setup')
    .description('Interactive setup for AWS Bedrock')
    .action(() => {
      console.log(chalk.bold('\n🔧 AWS Bedrock Setup\n'));
      console.log('Set the following environment variables:\n');
      console.log(chalk.cyan('Required:'));
      console.log('  AWS_REGION              AWS region (e.g., us-east-1)');
      console.log('  AWS_ACCESS_KEY_ID       AWS access key ID');
      console.log('  AWS_SECRET_ACCESS_KEY   AWS secret access key');
      console.log();
      console.log(chalk.cyan('Optional:'));
      console.log('  AWS_SESSION_TOKEN       AWS session token (for temporary credentials)');
      console.log('  AWS_BEDROCK_MODEL       Model ID or ARN');
      console.log('  ANTHROPIC_BEDROCK_BASE_URL  Custom endpoint URL');
      console.log();
      console.log(chalk.gray('After setting these, run:'));
      console.log(chalk.gray('  $ claude provider use bedrock'));
      console.log(chalk.gray('  $ claude provider test bedrock\n'));
    });

  bedrockCommand
    .command('regions')
    .description('List available AWS Bedrock regions')
    .action(() => {
      console.log(chalk.bold('\n🌍 Available AWS Bedrock Regions:\n'));

      const regions = getBedrockRegions();
      regions.forEach((region) => {
        console.log(chalk.cyan(`  ${region.region}`) + chalk.gray(` - ${region.name}`));
        console.log(chalk.gray(`    Endpoint: ${region.endpoint}`));
        console.log();
      });
    });

  bedrockCommand
    .command('models [region]')
    .description('List available Claude models on AWS Bedrock')
    .action((region?: string) => {
      console.log(chalk.bold('\n🤖 Available Claude Models on AWS Bedrock:\n'));

      const models = getAvailableBedrockModels(region);
      models.forEach((model) => {
        console.log(chalk.cyan(`  ${model}`));
      });

      console.log();
      console.log(chalk.gray('Set model using:'));
      console.log(chalk.gray('  $ export AWS_BEDROCK_MODEL=<model-id>'));
      console.log(chalk.gray('  $ claude provider use bedrock --model <model-id>\n'));
    });

  // Vertex AI subcommands
  const vertexCommand = providerCommand
    .command('vertex')
    .description('Google Vertex AI management commands');

  vertexCommand
    .command('setup')
    .description('Interactive setup for Google Vertex AI')
    .action(() => {
      console.log(chalk.bold('\n🔧 Google Vertex AI Setup\n'));
      console.log('Set the following environment variables:\n');
      console.log(chalk.cyan('Required:'));
      console.log('  ANTHROPIC_VERTEX_PROJECT_ID       GCP project ID');
      console.log('  GOOGLE_APPLICATION_CREDENTIALS    Path to service account JSON');
      console.log();
      console.log(chalk.cyan('Optional:'));
      console.log('  ANTHROPIC_VERTEX_REGION           GCP region (default: us-central1)');
      console.log('  ANTHROPIC_MODEL                   Model ID');
      console.log();
      console.log(chalk.gray('After setting these, run:'));
      console.log(chalk.gray('  $ claude provider use vertex'));
      console.log(chalk.gray('  $ claude provider test vertex\n'));
    });

  vertexCommand
    .command('projects')
    .description('Show configured GCP projects')
    .action(() => {
      const projectId =
        process.env.ANTHROPIC_VERTEX_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCP_PROJECT_ID;

      console.log(chalk.bold('\n📁 Configured GCP Projects:\n'));

      if (projectId) {
        console.log(chalk.green(`✓ Current project: ${projectId}`));
      } else {
        console.log(
          chalk.yellow('⚠ No project configured. Set ANTHROPIC_VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT')
        );
      }

      console.log();
    });

  vertexCommand
    .command('regions')
    .description('List available Vertex AI regions')
    .action(() => {
      console.log(chalk.bold('\n🌍 Available Vertex AI Regions:\n'));

      const regions = [
        { code: 'us-central1', name: 'Iowa' },
        { code: 'us-east4', name: 'Northern Virginia' },
        { code: 'us-west1', name: 'Oregon' },
        { code: 'europe-west1', name: 'Belgium' },
        { code: 'europe-west4', name: 'Netherlands' },
        { code: 'asia-southeast1', name: 'Singapore' },
        { code: 'asia-northeast1', name: 'Tokyo' },
      ];

      regions.forEach((region) => {
        console.log(chalk.cyan(`  ${region.code}`) + chalk.gray(` - ${region.name}`));
      });

      console.log();
      console.log(chalk.gray('Set region using:'));
      console.log(chalk.gray('  $ export ANTHROPIC_VERTEX_REGION=<region>\n'));
    });

  vertexCommand
    .command('models')
    .description('List available Claude models on Vertex AI')
    .action(() => {
      console.log(chalk.bold('\n🤖 Available Claude Models on Vertex AI:\n'));

      Object.entries(VERTEX_MODELS).forEach(([alias, modelId]) => {
        console.log(chalk.cyan(`  ${modelId}`) + chalk.gray(` (${alias})`));
      });

      console.log();
    });

  // Provider diagnostics
  providerCommand
    .command('diagnose')
    .description('Run diagnostics on provider configuration')
    .action(() => {
      console.log(chalk.bold('\n🔍 Provider Diagnostics\n'));

      try {
        const config = detectProvider();
        const info = getProviderInfo(config);
        const validation = validateProviderConfig(config);

        console.log(chalk.cyan('Provider Detection:'));
        console.log(`  Type: ${config.type}`);
        console.log(`  Name: ${info.name}`);
        console.log();

        console.log(chalk.cyan('Environment Variables:'));
        const envVars = [
          'ANTHROPIC_API_KEY',
          'CLAUDE_API_KEY',
          'CLAUDE_CODE_USE_BEDROCK',
          'AWS_REGION',
          'AWS_ACCESS_KEY_ID',
          'AWS_BEDROCK_MODEL',
          'CLAUDE_CODE_USE_VERTEX',
          'ANTHROPIC_VERTEX_PROJECT_ID',
          'GOOGLE_APPLICATION_CREDENTIALS',
          'CLAUDE_CODE_USE_FOUNDRY',
          'ANTHROPIC_FOUNDRY_API_KEY',
        ];

        envVars.forEach((varName) => {
          const value = process.env[varName];
          if (value) {
            const masked =
              varName.includes('KEY') || varName.includes('SECRET')
                ? `${value.substring(0, 8)}...`
                : value;
            console.log(chalk.green(`  ✓ ${varName}: ${masked}`));
          } else {
            console.log(chalk.gray(`  ○ ${varName}: not set`));
          }
        });

        console.log();

        console.log(chalk.cyan('Validation:'));
        if (validation.valid) {
          console.log(chalk.green('  ✓ Configuration is valid'));
        } else {
          console.log(chalk.red('  ✗ Configuration has errors:'));
          validation.errors.forEach((error) => {
            console.log(chalk.red(`    - ${error}`));
          });
        }

        if (validation.warnings && validation.warnings.length > 0) {
          console.log(chalk.yellow('  ⚠ Warnings:'));
          validation.warnings.forEach((warning) => {
            console.log(chalk.yellow(`    - ${warning}`));
          });
        }

        console.log();
      } catch (error) {
        console.error(
          chalk.red('Diagnostics failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  return providerCommand;
}

/**
 * Export for use in main CLI
 */
export default createProviderCommand;
