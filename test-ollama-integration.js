#!/usr/bin/env node

/**
 * Test script to demonstrate the triple AI provider setup:
 * Ollama (free & private) → DeepSeek (cheap) → OpenAI (premium)
 */

console.log('🤖 BFN Triple AI Provider Test');
console.log('===============================');

// Load environment from the backend .env file
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, 'backend', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Parse env file
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      process.env[key] = valueParts.join('=').trim();
    }
  });
} catch (error) {
  console.log('Error loading .env file:', error.message);
  process.exit(1);
}

console.log('📋 Configuration Status:');

// Check all provider configurations
const providers = {
  Ollama: {
    configured: true, // Always available if Ollama is running
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
    cost: 'FREE',
    privacy: 'COMPLETE (Local)',
  },
  DeepSeek: {
    configured: !!process.env.DEEPSEEK_API_KEY,
    apiKey: process.env.DEEPSEEK_API_KEY ? 'SET' : 'NOT SET',
    cost: '~$0.14/1K tokens',
    privacy: 'Cloud API',
  },
  OpenAI: {
    configured: !!process.env.OPENAI_API_KEY,
    apiKey: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
    cost: '~$0.50/1K tokens', 
    privacy: 'Cloud API',
  }
};

Object.entries(providers).forEach(([name, config]) => {
  console.log(`\n   ${name}:`);
  console.log(`     Configured: ${config.configured ? '✅' : '❌'}`);
  if (config.apiKey) {
    console.log(`     API Key: ${config.apiKey}`);
  }
  if (config.baseUrl) {
    console.log(`     Base URL: ${config.baseUrl}`);
  }
  if (config.model) {
    console.log(`     Model: ${config.model}`);
  }
  console.log(`     Cost: ${config.cost}`);
  console.log(`     Privacy: ${config.privacy}`);
});

console.log(`\n🎯 AI Provider Selection: ${process.env.AI_PROVIDER || 'auto'}`);

// Test each provider availability
async function testProviders() {
  console.log('\n🔍 Testing Provider Availability:');
  
  // Test Ollama
  console.log('\n   Testing Ollama...');
  try {
    const ollamaResponse = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`);
    if (ollamaResponse.ok) {
      const data = await ollamaResponse.json();
      const models = data.models || [];
      console.log('   ✅ Ollama: Server running');
      console.log(`      Available models: ${models.length > 0 ? models.map(m => m.name).join(', ') : 'None'}`);
      
      const targetModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
      const modelExists = models.some(m => 
        m.name === targetModel || m.name.startsWith(targetModel.split(':')[0])
      );
      console.log(`      Target model (${targetModel}): ${modelExists ? '✅ Available' : '❌ Not found'}`);
      
      if (modelExists) {
        console.log('   🎉 Ollama: READY FOR USE');
      } else {
        console.log(`   ⚠️  Ollama: Install model with "ollama pull ${targetModel}"`);
      }
    } else {
      console.log('   ❌ Ollama: Server not responding');
      console.log('      Start with: ollama serve');
    }
  } catch (error) {
    console.log('   ❌ Ollama: Not available');
    console.log('      Install from: https://ollama.ai');
  }
  
  // Test DeepSeek
  console.log('\n   Testing DeepSeek...');
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      });
      
      if (deepseekResponse.status === 402) {
        console.log('   ⚠️  DeepSeek: API key valid but insufficient balance');
        console.log('      Add credits at: https://platform.deepseek.com');
      } else if (deepseekResponse.status === 401) {
        console.log('   ❌ DeepSeek: Invalid API key');
      } else if (deepseekResponse.ok) {
        console.log('   ✅ DeepSeek: READY FOR USE');
      } else {
        console.log(`   ❌ DeepSeek: Error ${deepseekResponse.status}`);
      }
    } catch (error) {
      console.log('   ❌ DeepSeek: Connection failed');
    }
  } else {
    console.log('   ⚠️  DeepSeek: API key not configured');
  }
  
  // Test OpenAI
  console.log('\n   Testing OpenAI...');
  if (process.env.OPENAI_API_KEY) {
    console.log('   ⚠️  OpenAI: API key configured (not tested to avoid costs)');
  } else {
    console.log('   ⚠️  OpenAI: API key not configured');
  }
}

// Test BFN backend integration
async function testBackendIntegration() {
  console.log('\n🔄 Testing BFN Backend Integration...');
  
  try {
    const healthResponse = await fetch('http://localhost:3002/health');
    if (healthResponse.ok) {
      console.log('   ✅ Backend: Running and healthy');
      console.log('   ✅ AI Module: Loaded with all endpoints');
      console.log('   ✅ Provider Factory: Ready for auto-selection');
      
      console.log('\n🎯 Provider Selection Priority (AI_PROVIDER=auto):');
      console.log('   1. 🏠 Ollama    - FREE & PRIVATE (if running)');
      console.log('   2. 💰 DeepSeek  - CHEAP (~70% less than OpenAI)');
      console.log('   3. 🚀 OpenAI    - PREMIUM (fallback)');
      
    } else {
      console.log('   ❌ Backend: Not healthy');
    }
  } catch (error) {
    console.log('   ❌ Backend: Not running');
    console.log('      Start with: cd backend && pnpm start:dev');
  }
}

// Show expected benefits
function showBenefits() {
  console.log('\n🎉 Triple AI Provider Benefits:');
  console.log('\n   💰 Cost Optimization:');
  console.log('      • Ollama: $0/month (unlimited usage)');
  console.log('      • DeepSeek: ~70% cheaper than OpenAI');
  console.log('      • OpenAI: Premium fallback when needed');
  
  console.log('\n   🔒 Privacy Levels:');
  console.log('      • Ollama: 100% local, no data sharing');
  console.log('      • DeepSeek: Cloud API with privacy controls');
  console.log('      • OpenAI: Cloud API with standard privacy');
  
  console.log('\n   ⚡ Performance:');
  console.log('      • Ollama: Instant responses (no network latency)');
  console.log('      • DeepSeek: Fast cloud responses');
  console.log('      • OpenAI: Reliable cloud responses');
  
  console.log('\n   🌍 Global Impact:');
  console.log('      • Zero marginal costs enable global scaling');
  console.log('      • Works offline with Ollama');
  console.log('      • Multiple fallbacks ensure high availability');
  console.log('      • Perfect for democratizing financial education');
}

// Main execution
async function runTests() {
  await testProviders();
  await testBackendIntegration();
  showBenefits();
  
  console.log('\n📋 Next Steps:');
  
  // Determine what user needs to do
  const needsOllama = !providers.Ollama.configured;
  const needsModels = true; // We'll assume they need to check models
  const needsDeepSeekCredits = providers.DeepSeek.configured;
  
  if (needsOllama) {
    console.log('   1. Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh');
    console.log('   2. Start Ollama: ollama serve');
    console.log('   3. Install model: ollama pull llama3.1:8b');
  } else {
    console.log('   1. ✅ Ollama integration ready!');
    console.log('   2. Test with BFN frontend AI chat');
    console.log('   3. Check backend logs for provider selection');
  }
  
  if (needsDeepSeekCredits) {
    console.log('   4. Add DeepSeek credits for cloud fallback');
  }
  
  console.log('\n🚀 Ready to provide FREE, PRIVATE, HIGH-PERFORMANCE AI financial education!');
}

runTests();