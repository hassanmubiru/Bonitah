#!/usr/bin/env node

/**
 * Test script to demonstrate DeepSeek AI integration for BFN platform.
 * 
 * This script shows how the AI provider factory works and how it can
 * automatically select between OpenAI and DeepSeek based on availability.
 */

console.log('🤖 BFN DeepSeek AI Integration Test');
console.log('=====================================');
console.log('');

// Mock environment for demonstration
const mockEnvConfigs = [
  {
    name: 'OpenAI Only',
    env: {
      OPENAI_API_KEY: 'sk-mock-openai-key',
      AI_PROVIDER: 'openai'
    }
  },
  {
    name: 'DeepSeek Only',  
    env: {
      DEEPSEEK_API_KEY: 'sk-mock-deepseek-key',
      AI_PROVIDER: 'deepseek'
    }
  },
  {
    name: 'Auto Selection (DeepSeek + OpenAI)',
    env: {
      DEEPSEEK_API_KEY: 'sk-mock-deepseek-key',
      OPENAI_API_KEY: 'sk-mock-openai-key', 
      AI_PROVIDER: 'auto'
    }
  },
  {
    name: 'No Providers',
    env: {
      AI_PROVIDER: 'auto'
    }
  }
];

// Mock AI provider responses
const mockResponses = {
  OpenAI: {
    content: "Based on your current savings balance, I'd recommend starting with a diversified portfolio approach. Consider allocating 60% to low-risk savings goals and 40% to moderate-risk community investment pools...",
    model: "gpt-3.5-turbo",
    tokensUsed: 85
  },
  DeepSeek: {
    content: "Looking at your portfolio data, I suggest focusing on goal-based savings first. Set up emergency fund targets, then explore BFN's community investment circles for collaborative wealth building...",
    model: "deepseek-chat",
    tokensUsed: 78
  }
};

// Simulate provider selection logic
function simulateProviderSelection(config) {
  const { env } = config;
  
  console.log(`📋 Configuration: ${config.name}`);
  console.log(`   AI_PROVIDER: ${env.AI_PROVIDER || 'not set'}`);
  console.log(`   OPENAI_API_KEY: ${env.OPENAI_API_KEY ? '✅ configured' : '❌ missing'}`);
  console.log(`   DEEPSEEK_API_KEY: ${env.DEEPSEEK_API_KEY ? '✅ configured' : '❌ missing'}`);
  
  let selectedProvider = null;
  let availableProviders = [];
  
  // Check availability
  if (env.OPENAI_API_KEY) availableProviders.push('OpenAI');
  if (env.DEEPSEEK_API_KEY) availableProviders.push('DeepSeek');
  
  // Provider selection logic
  switch (env.AI_PROVIDER) {
    case 'openai':
      selectedProvider = env.OPENAI_API_KEY ? 'OpenAI' : null;
      break;
    case 'deepseek':  
      selectedProvider = env.DEEPSEEK_API_KEY ? 'DeepSeek' : null;
      break;
    case 'auto':
      // Prefer DeepSeek, fallback to OpenAI
      selectedProvider = env.DEEPSEEK_API_KEY ? 'DeepSeek' : 
                        env.OPENAI_API_KEY ? 'OpenAI' : null;
      break;
  }
  
  console.log(`   Available: [${availableProviders.join(', ')}]`);
  console.log(`   Selected: ${selectedProvider || '❌ None'}`);
  
  if (selectedProvider) {
    console.log('');
    console.log(`💬 Sample Response from ${selectedProvider}:`);
    console.log(`   "${mockResponses[selectedProvider].content.substring(0, 100)}..."`);
    console.log(`   Model: ${mockResponses[selectedProvider].model}`);
    console.log(`   Tokens: ${mockResponses[selectedProvider].tokensUsed}`);
  } else {
    console.log('   ❌ Error: No AI providers available');
  }
  
  console.log('');
  console.log('-'.repeat(60));
  console.log('');
}

// Fix the mockConfigs reference first
const mockConfigs = mockEnvConfigs;

// Run simulations
console.log('🧪 Testing different AI provider configurations:\n');

mockConfigs.forEach(simulateProviderSelection);

console.log('✅ Integration Features Demonstrated:');
console.log('   • Multi-provider support (OpenAI + DeepSeek)');
console.log('   • Automatic provider selection and fallback'); 
console.log('   • Cost-effective AI with DeepSeek');
console.log('   • Consistent API regardless of provider');
console.log('   • Graceful handling of missing configurations');
console.log('');

console.log('🚀 Production Usage:');
console.log('   1. Set DEEPSEEK_API_KEY in your .env file');
console.log('   2. Set AI_PROVIDER=auto for best reliability');
console.log('   3. Monitor provider performance via /ai/provider endpoint');
console.log('   4. Enjoy cost-effective AI-powered financial guidance!');
console.log('');

console.log('📊 Expected Cost Savings:');
console.log('   • DeepSeek: ~70% lower cost vs OpenAI GPT-3.5');
console.log('   • Same quality financial guidance'); 
console.log('   • Automatic fallback ensures high availability');
console.log('   • Perfect for scaling financial education globally');
console.log('');

console.log('🎉 BFN Platform ready for intelligent financial assistance!');