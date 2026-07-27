// NestJS App Adapter for Supabase Edge Functions
import { createClient } from '@supabase/supabase-js'

// Environment variables (set in Supabase dashboard)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const DATABASE_URL = Deno.env.get('DATABASE_URL') || ''
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'dev-secret'
const BASE_SEPOLIA_RPC_URL = Deno.env.get('BASE_SEPOLIA_RPC_URL') || 'https://sepolia.base.org'

// AI Provider configuration
const OLLAMA_API_KEY = Deno.env.get('OLLAMA_API_KEY') || ''
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''

export interface AppContext {
  supabase: any
  config: {
    jwtSecret: string
    baseSepoliaRpcUrl: string
    ollama: {
      apiKey: string
      baseUrl: string
      model: string
    }
    deepseek: {
      apiKey: string
      baseUrl: string
    }
    openai: {
      apiKey: string
    }
  }
}

export async function createApp(): Promise<AppContext> {
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  // Configuration object
  const config = {
    jwtSecret: JWT_SECRET,
    baseSepoliaRpcUrl: BASE_SEPOLIA_RPC_URL,
    ollama: {
      apiKey: OLLAMA_API_KEY,
      baseUrl: 'https://api.ollama.ai',
      model: 'qwen2.5:72b-cloud'
    },
    deepseek: {
      apiKey: DEEPSEEK_API_KEY,
      baseUrl: 'https://api.deepseek.com'
    },
    openai: {
      apiKey: OPENAI_API_KEY
    }
  }

  console.log('BFN App initialized with Supabase backend')
  
  return {
    supabase,
    config
  }
}

// Utility functions for common operations
export class DatabaseService {
  constructor(private supabase: any) {}

  async createConversation(userId: string) {
    const { data, error } = await this.supabase
      .from('conversations')
      .insert({ user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async storeMessage(conversationId: string, role: string, content: string) {
    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getConversations(userId: string, limit = 10) {
    const { data, error } = await this.supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        messages (
          content,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  }
}

// Authentication utilities
export class AuthService {
  constructor(private config: AppContext['config']) {}

  generateNonce(): string {
    return crypto.randomUUID()
  }

  async verifySignature(message: string, signature: string): Promise<boolean> {
    // Import SIWE verification
    const { SiweMessage } = await import('siwe')
    
    try {
      const siweMessage = new SiweMessage(message)
      const result = await siweMessage.verify({ signature })
      return result.success
    } catch (error) {
      console.error('SIWE verification failed:', error)
      return false
    }
  }

  async generateJWT(address: string, role: string = 'user'): Promise<string> {
    // Simple JWT generation (in production, use a proper JWT library)
    const payload = {
      address,
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    }
    
    // In a real implementation, you'd sign this properly
    return btoa(JSON.stringify(payload))
  }

  async verifyJWT(token: string): Promise<{ address: string; role: string } | null> {
    try {
      const payload = JSON.parse(atob(token))
      
      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null
      }
      
      return {
        address: payload.address,
        role: payload.role
      }
    } catch (error) {
      return null
    }
  }
}

// AI Service for provider management
export class AIService {
  constructor(private config: AppContext['config']) {}

  async getProvider(): Promise<string> {
    // Priority: Ollama -> DeepSeek -> OpenAI
    if (this.config.ollama.apiKey) {
      return 'Ollama'
    } else if (this.config.deepseek.apiKey) {
      return 'DeepSeek'
    } else if (this.config.openai.apiKey) {
      return 'OpenAI'
    }
    return 'None'
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const provider = await this.getProvider()
    
    switch (provider) {
      case 'Ollama':
        return await this.chatWithOllama(messages)
      case 'DeepSeek':
        return await this.chatWithDeepSeek(messages)
      case 'OpenAI':
        return await this.chatWithOpenAI(messages)
      default:
        throw new Error('No AI provider available')
    }
  }

  private async chatWithOllama(messages: Array<{ role: string; content: string }>): Promise<string> {
    const response = await fetch('https://api.ollama.ai/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.ollama.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.ollama.model,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 500
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.message?.content || 'No response from Ollama'
  }

  private async chatWithDeepSeek(messages: Array<{ role: string; content: string }>): Promise<string> {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.deepseek.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: 500,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || 'No response from DeepSeek'
  }

  private async chatWithOpenAI(messages: Array<{ role: string; content: string }>): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.openai.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
        max_tokens: 500,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || 'No response from OpenAI'
  }
}

// Blockchain service for contract reads
export class ChainService {
  constructor(private config: AppContext['config']) {}

  async readContract(contract: string, functionName: string, args: any[] = []): Promise<any> {
    // Mock response for now - replace with actual viem integration
    return {
      value: '0',
      provenance: {
        blockNumber: await this.getLatestBlock(),
        timestamp: Date.now(),
        chainId: 84532
      }
    }
  }

  private async getLatestBlock(): Promise<string> {
    try {
      const response = await fetch(this.config.baseSepoliaRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        })
      })

      const data = await response.json()
      return data.result || '0x0'
    } catch (error) {
      console.error('Failed to get latest block:', error)
      return '0x0'
    }
  }
}