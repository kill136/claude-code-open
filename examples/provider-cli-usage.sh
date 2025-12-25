#!/bin/bash
# Provider CLI Usage Examples
# Demonstrates how to use the enhanced provider management commands

echo "=== Provider CLI Usage Examples ==="
echo ""

# Example 1: List all providers
echo "1. List all supported providers:"
echo "   $ claude provider list"
echo ""

# Example 2: Check current status
echo "2. Check current provider status:"
echo "   $ claude provider status"
echo ""

# Example 3: Switch to Bedrock
echo "3. Switch to AWS Bedrock:"
echo "   $ export AWS_REGION=us-east-1"
echo "   $ export AWS_ACCESS_KEY_ID=AKIA..."
echo "   $ export AWS_SECRET_ACCESS_KEY=..."
echo "   $ claude provider use bedrock --region us-east-1"
echo ""

# Example 4: Test connection
echo "4. Test provider connection:"
echo "   $ claude provider test"
echo ""

# Example 5: Bedrock setup
echo "5. Setup AWS Bedrock:"
echo "   $ claude provider bedrock setup"
echo "   $ claude provider bedrock regions"
echo "   $ claude provider bedrock models"
echo ""

# Example 6: Vertex AI setup
echo "6. Setup Google Vertex AI:"
echo "   $ export ANTHROPIC_VERTEX_PROJECT_ID=my-project"
echo "   $ export GOOGLE_APPLICATION_CREDENTIALS=~/service-account.json"
echo "   $ claude provider use vertex --project my-project"
echo "   $ claude provider vertex regions"
echo "   $ claude provider vertex models"
echo ""

# Example 7: Run diagnostics
echo "7. Run diagnostics:"
echo "   $ claude provider diagnose"
echo ""

# Example 8: View configuration
echo "8. View provider configuration:"
echo "   $ claude provider config"
echo ""

echo "=== For more information, see docs/provider-cli.md ==="
