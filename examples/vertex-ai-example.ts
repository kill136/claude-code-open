/**
 * Google Vertex AI Client Example
 *
 * 这个示例展示如何使用新创建的 Vertex AI 客户端
 */

import {
  VertexAIClient,
  createVertexAIClient,
  getVertexModelId,
  VERTEX_MODELS,
  VertexAIError,
} from '../src/providers/vertex.js';

/**
 * 示例 1: 使用工厂函数创建客户端（从环境变量加载）
 */
async function example1() {
  console.log('=== Example 1: Create client from environment ===\n');

  try {
    // 需要设置以下环境变量:
    // - ANTHROPIC_VERTEX_PROJECT_ID 或 GOOGLE_CLOUD_PROJECT
    // - GOOGLE_APPLICATION_CREDENTIALS (指向 service account JSON)
    // - ANTHROPIC_VERTEX_REGION (可选，默认 us-central1)

    const client = createVertexAIClient();

    console.log('Project ID:', client.getProjectId());
    console.log('Region:', client.getRegion());

    // 获取访问令牌
    const token = await client.getAccessToken();
    console.log('Access token obtained:', token.substring(0, 20) + '...');

    // 清理资源
    client.cleanup();
  } catch (error) {
    if (error instanceof VertexAIError) {
      console.error('Vertex AI Error:', error.message);
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * 示例 2: 手动配置客户端
 */
async function example2() {
  console.log('\n=== Example 2: Manual configuration ===\n');

  const client = new VertexAIClient({
    projectId: 'my-gcp-project',
    region: 'us-central1',
    credentialsPath: '/path/to/service-account.json',
  });

  console.log('Client created with manual config');
  console.log('Endpoint:', client.getEndpoint('claude-3-5-sonnet-v2@20241022'));
}

/**
 * 示例 3: 发送 API 请求
 */
async function example3() {
  console.log('\n=== Example 3: API Request ===\n');

  try {
    const client = createVertexAIClient();
    const modelId = getVertexModelId('claude-3-5-sonnet');

    console.log('Using model:', modelId);

    const response = await client.request(modelId, {
      anthropic_version: 'vertex-2023-10-16',
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with a short greeting.',
        },
      ],
      max_tokens: 100,
    });

    console.log('Response:', JSON.stringify(response, null, 2));

    client.cleanup();
  } catch (error) {
    if (error instanceof VertexAIError) {
      console.error('API Error:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * 示例 4: 流式请求
 */
async function example4() {
  console.log('\n=== Example 4: Streaming Request ===\n');

  try {
    const client = createVertexAIClient();
    const modelId = getVertexModelId('claude-3-5-sonnet');

    console.log('Starting stream...');

    for await (const chunk of client.streamRequest(modelId, {
      anthropic_version: 'vertex-2023-10-16',
      messages: [
        {
          role: 'user',
          content: 'Count from 1 to 5.',
        },
      ],
      max_tokens: 100,
      stream: true,
    })) {
      console.log('Chunk:', chunk);
    }

    console.log('Stream completed');

    client.cleanup();
  } catch (error) {
    if (error instanceof VertexAIError) {
      console.error('Stream Error:', error.message);
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * 示例 5: 带重试的请求
 */
async function example5() {
  console.log('\n=== Example 5: Request with Retry ===\n');

  try {
    const client = createVertexAIClient();
    const modelId = getVertexModelId('claude-3-5-sonnet');

    const response = await client.request(
      modelId,
      {
        anthropic_version: 'vertex-2023-10-16',
        messages: [{ role: 'user', content: 'Hi!' }],
        max_tokens: 50,
      },
      {
        maxRetries: 5, // 最多重试 5 次
      }
    );

    console.log('Request successful after retries:', response);

    client.cleanup();
  } catch (error) {
    console.error('Request failed after all retries:', error);
  }
}

/**
 * 示例 6: 可取消的请求
 */
async function example6() {
  console.log('\n=== Example 6: Cancellable Request ===\n');

  const client = createVertexAIClient();
  const modelId = getVertexModelId('claude-3-5-sonnet');
  const controller = new AbortController();

  // 5 秒后取消请求
  setTimeout(() => {
    console.log('Aborting request...');
    controller.abort();
  }, 5000);

  try {
    const response = await client.request(
      modelId,
      {
        anthropic_version: 'vertex-2023-10-16',
        messages: [
          {
            role: 'user',
            content: 'Write a very long story...',
          },
        ],
        max_tokens: 1000,
      },
      {
        signal: controller.signal,
      }
    );

    console.log('Response:', response);
  } catch (error) {
    if (error instanceof VertexAIError && error.message === 'Request aborted') {
      console.log('Request was successfully cancelled');
    } else {
      console.error('Error:', error);
    }
  } finally {
    client.cleanup();
  }
}

/**
 * 示例 7: 查看支持的模型
 */
function example7() {
  console.log('\n=== Example 7: Supported Models ===\n');

  console.log('Available Vertex AI models:');
  for (const [shortName, vertexId] of Object.entries(VERTEX_MODELS)) {
    console.log(`  ${shortName.padEnd(25)} => ${vertexId}`);
  }

  console.log('\nModel ID conversion:');
  const testModels = ['claude-3-5-sonnet', 'claude-3-opus', 'claude-sonnet-4'];
  for (const model of testModels) {
    console.log(`  ${model.padEnd(25)} => ${getVertexModelId(model)}`);
  }
}

/**
 * 示例 8: 错误处理
 */
async function example8() {
  console.log('\n=== Example 8: Error Handling ===\n');

  // 测试无效的项目 ID
  try {
    const client = new VertexAIClient({
      projectId: '',
      region: 'us-central1',
    });
  } catch (error) {
    if (error instanceof VertexAIError) {
      console.log('✓ Caught expected error:', error.message);
    }
  }

  // 测试无效的凭证文件
  try {
    const client = new VertexAIClient({
      projectId: 'test-project',
      region: 'us-central1',
      credentialsPath: '/nonexistent/path.json',
    });
  } catch (error) {
    if (error instanceof VertexAIError) {
      console.log('✓ Caught expected error:', error.message);
    }
  }
}

/**
 * 示例 9: 使用内联凭证
 */
async function example9() {
  console.log('\n=== Example 9: Inline Credentials ===\n');

  const client = new VertexAIClient({
    projectId: 'my-project',
    region: 'us-central1',
    credentials: {
      type: 'service_account',
      project_id: 'my-project',
      private_key_id: 'key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
      client_email: 'sa@my-project.iam.gserviceaccount.com',
      client_id: '123456789',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/sa%40my-project.iam.gserviceaccount.com',
    },
  });

  console.log('Client created with inline credentials');
  console.log('Project:', client.getProjectId());
  console.log('Region:', client.getRegion());
}

/**
 * 示例 10: Token 管理
 */
async function example10() {
  console.log('\n=== Example 10: Token Management ===\n');

  try {
    const client = createVertexAIClient();

    // 第一次获取 token
    console.log('Fetching token...');
    const token1 = await client.getAccessToken();
    console.log('Token obtained:', token1.substring(0, 20) + '...');

    // 第二次获取 token（应该使用缓存）
    console.log('\nFetching token again (should use cache)...');
    const token2 = await client.getAccessToken();
    console.log('Token obtained:', token2.substring(0, 20) + '...');
    console.log('Tokens are same:', token1 === token2);

    // Token 会在过期前 5 分钟自动刷新
    console.log('\nToken will auto-refresh 5 minutes before expiry');

    client.cleanup();
  } catch (error) {
    if (error instanceof VertexAIError) {
      console.error('Token Error:', error.message);
    } else {
      console.error('Error:', error);
    }
  }
}

// 运行示例
async function main() {
  console.log('Google Vertex AI Client Examples\n');
  console.log('='.repeat(50));

  // 运行不需要真实凭证的示例
  example2();
  example7();
  await example8();
  example9();

  // 以下示例需要真实的 GCP 凭证
  // 取消注释以运行：
  //
  // await example1();
  // await example3();
  // await example4();
  // await example5();
  // await example6();
  // await example10();

  console.log('\n' + '='.repeat(50));
  console.log('\nExamples completed!');
  console.log('\nTo run examples that require GCP credentials:');
  console.log('1. Set GOOGLE_APPLICATION_CREDENTIALS');
  console.log('2. Set ANTHROPIC_VERTEX_PROJECT_ID');
  console.log('3. Uncomment the examples in main()');
}

// 运行
main().catch(console.error);
