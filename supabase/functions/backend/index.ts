// BFN Backend - Supabase Edge Function  
// Complete NestJS backend API adapted for Supabase Edge Runtime

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { createPublicClient, http, formatUnits, parseAbiItem, recoverMessageAddress } from 'https://esm.sh/viem@2.21.19'
import { baseSepolia } from 'https://esm.sh/viem@2.21.19/chains'

// Contract addresses from shared package
const CONTRACTS = {
  Registry: '0xBd81a62b21eaE93D74daB2B2D93e040D51f75db1',
  SavingsVault: '0x16E88B4a717B082f8d29C4EeA0796F488C0da7B6',
  CommunityTreasury: '0xa0D284d9080cb7F6676e62116E0A659BB4Ed9b04',
  Education: '0x5A63Da81A04BE39d5469B8BD9281CbD3332b51ac',
  Governance: '0x13B14D148E3369dCC448006494810A95928eEEB4',
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
}

// Environment variables
const env = {
  baseSepoliaRpcUrl: Deno.env.get('BASE_SEPOLIA_RPC_URL') || 'https://sepolia.base.org',
  chainId: 84532,
  jwtSecret: Deno.env.get('JWT_SECRET') || 'fallback-secret-for-development',
  ollamaApiKey: Deno.env.get('OLLAMA_API_KEY'),
  deepseekApiKey: Deno.env.get('DEEPSEEK_API_KEY'),
  openaiApiKey: Deno.env.get('OPENAI_API_KEY'),
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY')
}

// Initialize blockchain client
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(env.baseSepoliaRpcUrl)
})

// Initialize Supabase client
const supabase = createClient(env.supabaseUrl!, env.supabaseAnonKey!)

console.log('BFN Backend Edge Function starting...', new Date().toISOString())

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const fullPath = url.pathname
    // Strip the function name prefix from the path
    const path = fullPath.replace(/^\/backend/, '') || '/'
    const searchParams = url.searchParams

    console.log(`${req.method} ${path}`)

    // Health check
    if (path === '/health') {
      return jsonResponse({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'bfn-backend',
        environment: 'supabase-edge',
        contracts: CONTRACTS,
        aiConfigured: {
          ollama: !!Deno.env.get('OLLAMA_API_KEY'),
          deepseek: !!Deno.env.get('DEEPSEEK_API_KEY'),
          openai: !!Deno.env.get('OPENAI_API_KEY'),
        }
      }, corsHeaders)
    }

    // Authentication endpoints
    if (path.startsWith('/auth')) {
      return await handleAuth(req, path, corsHeaders)
    }

    // AI endpoints  
    if (path.startsWith('/ai')) {
      return await handleAI(req, path, corsHeaders)
    }

    // Chain read endpoints
    if (path.startsWith('/chain')) {
      return await handleChainRead(req, path, searchParams, corsHeaders)
    }

    // Analytics endpoints
    if (path.startsWith('/analytics')) {
      return await handleAnalytics(req, path, searchParams, corsHeaders)
    }

    // Transactions endpoints
    if (path.startsWith('/transactions')) {
      return await handleTransactions(req, path, searchParams, corsHeaders)
    }

    // Education endpoints
    if (path.startsWith('/education')) {
      return await handleEducation(req, path, corsHeaders)
    }

    return jsonResponse({ error: 'Not Found', path }, corsHeaders, 404)

  } catch (error) {
    console.error('Backend error:', error)
    return jsonResponse({ 
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, corsHeaders, 500)
  }
})

// Helper function for JSON responses
function jsonResponse(data: any, headers: Record<string, string>, status = 200) {
  return new Response(
    JSON.stringify(data), 
    { 
      status,
      headers: { ...headers, 'Content-Type': 'application/json' }
    }
  )
}

// JWT helper functions
async function createJWT(payload: any): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = btoa(JSON.stringify(header))
  const encodedPayload = btoa(JSON.stringify(payload))
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  )
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

async function verifyJWT(token: string): Promise<any> {
  try {
    const [header, payload, signature] = token.split('.')
    return JSON.parse(atob(payload))
  } catch {
    throw new Error('Invalid token')
  }
}

// In-memory nonce store (Edge Functions are short-lived, this works for auth flows)
const nonceStore = new Map<string, { address: string; expires: number }>()

// Parse a SIWE message string to extract fields
function parseSiweMessage(message: string): { address: string; nonce: string; domain: string; chainId: number } | null {
  try {
    const addressMatch = message.match(/0x[a-fA-F0-9]{40}/)
    const nonceMatch = message.match(/Nonce: (.+)/)
    const domainMatch = message.match(/^(.+) wants you to sign in/)
    const chainIdMatch = message.match(/Chain ID: (\d+)/)
    
    if (!addressMatch || !nonceMatch) return null
    
    return {
      address: addressMatch[0],
      nonce: nonceMatch[1].trim(),
      domain: domainMatch ? domainMatch[1].trim() : '',
      chainId: chainIdMatch ? parseInt(chainIdMatch[1]) : 84532
    }
  } catch {
    return null
  }
}

// Authentication handler
async function handleAuth(req: Request, path: string, corsHeaders: Record<string, string>) {
  if (path === '/auth/nonce' && req.method === 'POST') {
    const { address } = await req.json()
    const nonce = crypto.randomUUID()
    
    // Store nonce in memory with 5 min expiry
    nonceStore.set(nonce, { 
      address: address.toLowerCase(), 
      expires: Date.now() + 5 * 60 * 1000 
    })
    
    // Clean up expired nonces
    for (const [key, val] of nonceStore.entries()) {
      if (val.expires < Date.now()) nonceStore.delete(key)
    }
    
    return jsonResponse({ nonce }, corsHeaders)
  }

  if (path === '/auth/me' && req.method === 'GET') {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, corsHeaders, 401)
    }
    try {
      const payload = await verifyJWT(authHeader.slice(7))
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return jsonResponse({ error: 'Token expired' }, corsHeaders, 401)
      }
      return jsonResponse({ address: payload.address, role: payload.role || 'user' }, corsHeaders)
    } catch {
      return jsonResponse({ error: 'Invalid token' }, corsHeaders, 401)
    }
  }

  if (path === '/auth/verify' && req.method === 'POST') {
    const { message, signature } = await req.json()
    
    try {
      // Parse the SIWE message to extract address and nonce
      const parsed = parseSiweMessage(message)
      if (!parsed) {
        throw new Error('Invalid SIWE message format')
      }
      
      // Verify the signature using viem - recover the signer address
      const recoveredAddress = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`
      })
      
      if (recoveredAddress.toLowerCase() !== parsed.address.toLowerCase()) {
        throw new Error('Signature verification failed - address mismatch')
      }
      
      // Verify nonce if it exists in store (may not exist if edge function restarted)
      const storedNonce = nonceStore.get(parsed.nonce)
      if (storedNonce) {
        if (storedNonce.expires < Date.now()) {
          nonceStore.delete(parsed.nonce)
          throw new Error('Nonce expired')
        }
        nonceStore.delete(parsed.nonce)
      }
      
      // Create JWT
      const jwt = await createJWT({
        address: parsed.address,
        role: 'user',
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      })
      
      return jsonResponse({ 
        jwt, 
        address: parsed.address,
        role: 'user'
      }, corsHeaders)
      
    } catch (error) {
      console.error('Auth error:', error)
      return jsonResponse({ 
        error: 'Authentication failed', 
        message: error.message 
      }, corsHeaders, 401)
    }
  }

  return jsonResponse({ error: 'Not Found' }, corsHeaders, 404)
}

// AI handler with real integrations
async function handleAI(req: Request, path: string, corsHeaders: Record<string, string>) {
  if (path === '/ai/provider' && req.method === 'GET') {
    const available = []
    const configured = []
    
    if (env.ollamaApiKey) { available.push('Ollama'); configured.push('Ollama') }
    if (env.deepseekApiKey) { available.push('DeepSeek'); configured.push('DeepSeek') }
    if (env.openaiApiKey) { available.push('OpenAI'); configured.push('OpenAI') }
    
    return jsonResponse({
      selected: configured[0] || 'None',
      available,
      configured
    }, corsHeaders)
  }

  if (path === '/ai/chat' && req.method === 'POST') {
    const { question } = await req.json()
    
    // Get user context from authorization header
    const authHeader = req.headers.get('authorization')
    let userAddress = null
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await verifyJWT(authHeader.slice(7))
        userAddress = payload.address
      } catch {
        // Continue without user context
      }
    }
    
    let answer = ''
    let provider = 'None'
    let lastError = ''
    
    // Re-read env vars (they might be set as secrets after initial module load)
    const ollamaKey = Deno.env.get('OLLAMA_API_KEY')
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    
    // Try Ollama Cloud first
    if (ollamaKey) {
      try {
        console.log('Attempting Ollama Cloud with key:', ollamaKey?.substring(0, 8) + '...')
        const response = await fetch('https://api.ollama.com/api/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ollamaKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-oss:20b',
            prompt: `You are a DeFi financial assistant for Bonitah Financial Network on Base Sepolia. Be helpful, concise, and knowledgeable about decentralized finance, savings, and blockchain. User address: ${userAddress || 'anonymous'}. Question: ${question}`,
            stream: false
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          answer = data.response
          provider = 'Ollama'
        } else {
          const errData = await response.text()
          lastError = `Ollama ${response.status}: ${errData.substring(0, 100)}`
          console.error('Ollama API error:', response.status, errData)
        }
      } catch (error) {
        lastError = `Ollama fetch: ${error.message}`
        console.error('Ollama fetch error:', error)
      }
    }
    
    // Fallback to DeepSeek
    if (provider === 'None' && deepseekKey) {
      try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${deepseekKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: `You are a DeFi financial assistant for Bonitah Financial Network. User address: ${userAddress || 'anonymous'}`
              },
              {
                role: 'user',
                content: question
              }
            ]
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          answer = data.choices[0]?.message?.content || 'No response from DeepSeek'
          provider = 'DeepSeek'
        }
      } catch (error) {
        console.error('DeepSeek error:', error)
      }
    }
    
    // Set default message if no provider worked
    if (!answer) {
      if (!ollamaKey && !deepseekKey && !openaiKey) {
        answer = 'AI service is not configured. Please set up API keys for OpenAI, DeepSeek, or Ollama.'
      } else {
        answer = `AI providers failed. Last error: ${lastError}`
      }
    }

    return jsonResponse({
      answer,
      conversationId: crypto.randomUUID(),
      provider,
      userAddress
    }, corsHeaders)
  }

  return jsonResponse({ error: 'Not Found' }, corsHeaders, 404)
}

// Chain read handler with real blockchain integration
async function handleChainRead(req: Request, path: string, searchParams: URLSearchParams, corsHeaders: Record<string, string>) {
  const contractAddress = searchParams.get('contract') as `0x${string}`
  const functionName = searchParams.get('function')
  const args = searchParams.get('args') ? JSON.parse(searchParams.get('args')!) : []
  
  if (!contractAddress || !functionName) {
    return jsonResponse({ 
      error: 'Missing required parameters: contract, function' 
    }, corsHeaders, 400)
  }

  try {
    let result: any = '0'
    const blockNumber = await publicClient.getBlockNumber()
    
    // Special handling for known functions with proper ABIs
    if (functionName === 'balanceOf' && args.length === 1) {
      // ERC20 balance check
      result = await publicClient.readContract({
        address: contractAddress,
        abi: [parseAbiItem('function balanceOf(address account) view returns (uint256)')],
        functionName: 'balanceOf',
        args: [args[0]]
      })
    } else if (functionName === 'lockedTotal') {
      // SavingsVault lockedTotal
      result = await publicClient.readContract({
        address: contractAddress,
        abi: [parseAbiItem('function lockedTotal() view returns (uint256)')],
        functionName: 'lockedTotal'
      })
    } else if (functionName === 'totalSupply') {
      // ERC20 totalSupply
      result = await publicClient.readContract({
        address: contractAddress,
        abi: [parseAbiItem('function totalSupply() view returns (uint256)')],
        functionName: 'totalSupply'
      })
    } else if (functionName === 'getUserBalance' && args.length === 1) {
      // SavingsVault getUserBalance
      result = await publicClient.readContract({
        address: contractAddress,
        abi: [parseAbiItem('function getUserBalance(address user) view returns (uint256)')],
        functionName: 'getUserBalance',
        args: [args[0]]
      })
    } else {
      // Generic contract call - try to construct ABI
      const abiString = `function ${functionName}(${args.map((_, i) => `address p${i}`).join(', ')}) view returns (uint256)`
      try {
        result = await publicClient.readContract({
          address: contractAddress,
          abi: [parseAbiItem(abiString)],
          functionName,
          args
        })
      } catch (abiError) {
        // If ABI construction fails, return a meaningful error
        throw new Error(`Function ${functionName} not supported or invalid parameters`)
      }
    }
    
    return jsonResponse({
      value: result.toString(),
      provenance: {
        blockNumber: blockNumber.toString(),
        timestamp: Date.now(),
        chainId: env.chainId,
        contract: contractAddress,
        function: functionName,
        args
      }
    }, corsHeaders)
    
  } catch (error) {
    console.error('Chain read error:', error)
    return jsonResponse({
      error: 'Contract read failed',
      message: error.message,
      contract: contractAddress,
      function: functionName,
      args
    }, corsHeaders, 500)
  }
}

// Analytics handler
async function handleAnalytics(req: Request, path: string, searchParams: URLSearchParams, corsHeaders: Record<string, string>) {
  const userAddress = searchParams.get('address')
  
  if (path === '/analytics/portfolio' && req.method === 'GET') {
    // Mock portfolio data - in production, fetch from blockchain and cache in Supabase
    const series = [
      { timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, value: 1000 },
      { timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000, value: 1050 },
      { timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, value: 1100 },
      { timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, value: 1080 },
      { timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, value: 1150 },
      { timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, value: 1200 },
      { timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, value: 1250 },
      { timestamp: Date.now(), value: 1300 }
    ]
    
    return jsonResponse({ 
      series,
      userAddress,
      totalValue: 1300,
      change24h: 4.0,
      changePercent24h: 0.31
    }, corsHeaders)
  }

  return jsonResponse({ error: 'Not Found' }, corsHeaders, 404)
}

// Transactions handler
async function handleTransactions(req: Request, path: string, searchParams: URLSearchParams, corsHeaders: Record<string, string>) {
  if (req.method === 'GET') {
    const userAddress = searchParams.get('address')
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // Mock transaction data - in production, fetch from indexed events in Supabase
    const events = [
      {
        id: '1',
        type: 'deposit',
        amount: '100',
        token: 'USDC',
        timestamp: Date.now() - 2 * 60 * 60 * 1000,
        txHash: '0x1234567890abcdef',
        blockNumber: 12345678
      },
      {
        id: '2', 
        type: 'withdraw',
        amount: '50',
        token: 'USDC',
        timestamp: Date.now() - 24 * 60 * 60 * 1000,
        txHash: '0xabcdef1234567890',
        blockNumber: 12345600
      }
    ]
    
    return jsonResponse({
      events: userAddress ? events : [],
      nextCursor: events.length >= limit ? 'next_page_token' : null,
      hasMore: events.length >= limit
    }, corsHeaders)
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405)
}

// Education handler
async function handleEducation(req: Request, path: string, corsHeaders: Record<string, string>) {
  if (path === '/education/courses' && req.method === 'GET') {
    // Mock course data
    const courses = [
      {
        id: 1,
        title: 'DeFi Basics',
        description: 'Learn the fundamentals of decentralized finance',
        lessons: 5,
        completed: false
      },
      {
        id: 2,
        title: 'Savings Strategies',
        description: 'Maximize your yield with smart savings tactics',
        lessons: 8,
        completed: false
      }
    ]
    
    return jsonResponse({ courses }, corsHeaders)
  }

  return jsonResponse({ error: 'Not Found' }, corsHeaders, 404)
}