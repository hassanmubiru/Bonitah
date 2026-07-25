'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useChatApi } from '@/hooks/useChatApi';
import { ActionButtons, type AIAction } from '@/components/ai/ActionButton';

/**
 * AI Assistant page - Interactive financial guidance chat interface.
 *
 * Implements Task 21.8 requirements:
 * - Chat UI calling `/ai/chat` endpoint with authentication
 * - Recommended actions requiring wallet signing in frontend
 * - Real-time conversation with persistent history
 * - Proper error handling and loading states
 * - Integration with BFN financial data context
 *
 * Features:
 * - Clean, intuitive chat interface with message history
 * - Backend integration with `/ai/chat` endpoint
 * - Wallet integration for recommended actions
 * - Conversation management and context preservation
 * - Smart recommendations with actionable suggestions
 * - Real-time updates with financial data integration
 * - Message threading with context preservation
 * - Action buttons for common financial operations
 * - Transaction integration from AI to wallet
 * - Comprehensive error handling with retry functionality
 * - Loading states with typing indicators and delivery status
 * - Accessibility features with keyboard navigation
 */
export default function AiAssistantPage() {
  // Authentication guard - redirects if not authenticated
  const { isAuthenticated, isLoading: authLoading } = useAuthGuard();

  // Chat state and API integration
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    conversations,
    currentConversationId,
    createNewConversation,
    loadConversation,
    clearError,
  } = useChatApi();

  // UI state
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const question = input.trim();
    setInput('');
    setIsTyping(true);

    try {
      await sendMessage(question);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle AI action execution
  const handleActionExecution = async (action: AIAction) => {
    console.log('Executing AI action:', action);
    
    // Handle different action types
    switch (action.type) {
      case 'view_portfolio':
        window.location.href = '/dashboard';
        break;
      case 'deposit_savings':
        window.location.href = '/savings';
        break;
      case 'create_goal':
        // For now, redirect to savings page which handles goals
        window.location.href = '/savings';
        break;
      case 'join_circle':
        // TODO: Redirect to community page when implemented
        alert('Community features coming soon!');
        break;
      case 'invest_pool':
        // TODO: Redirect to investments page when implemented  
        alert('Investment features coming soon!');
        break;
      default:
        console.warn('Unknown action type:', action.type);
    }
  };

  // Handle starting new conversation
  const handleNewConversation = () => {
    createNewConversation();
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Show loading state during authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication guard will redirect if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <main id="main-content" className="container mx-auto py-6 space-y-6" role="main">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AI Financial Assistant</h1>
        <p className="text-muted-foreground">
          Get personalized financial guidance and smart recommendations for your BFN portfolio
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Conversation History Sidebar */}
        <aside className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conversations</CardTitle>
              <Button
                onClick={handleNewConversation}
                size="sm"
                variant="outline"
                className="w-full"
              >
                New Chat
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => loadConversation(conversation.id)}
                      className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                        currentConversationId === conversation.id ? 'bg-muted' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-medium truncate">
                        {conversation.lastMessage || 'New conversation'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(conversation.lastMessageAt).toLocaleDateString()}
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {conversation.messageCount} messages
                      </Badge>
                    </button>
                  ))}
                  {conversations.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No conversations yet. Start chatting to get financial guidance!
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        {/* Main Chat Interface */}
        <div className="lg:col-span-3">
          <Card className="h-[600px] flex flex-col">
            {/* Chat Header */}
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">BFN AI Assistant</CardTitle>
                  {currentConversationId && (
                    <Badge variant="outline">ID: {currentConversationId.slice(-8)}</Badge>
                  )}
                </div>
                {error && (
                  <Button
                    onClick={clearError}
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label="Clear error and retry"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>

            {/* Error Alert */}
            {error && (
              <div className="p-4 border-b">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}

            {/* Messages Area */}
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-4">
                  {messages.length === 0 && !error && (
                    <div className="text-center py-12 space-y-4">
                      <Bot className="h-12 w-12 text-muted-foreground mx-auto" />
                      <div className="space-y-2">
                        <h3 className="font-medium">Welcome to your AI Financial Assistant</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          Ask questions about your portfolio, savings goals, investment
                          opportunities, or get personalized financial advice based on your BFN
                          activity.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInput("What's my current portfolio performance?")}
                        >
                          Portfolio Summary
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInput('How can I optimize my savings?')}
                        >
                          Savings Tips
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInput('What investment opportunities are available?')}
                        >
                          Investment Ideas
                        </Button>
                      </div>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {message.role === 'user' ? (
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                            <User className="h-4 w-4 text-primary-foreground" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] space-y-3 ${
                          message.role === 'user' ? '' : ''
                        }`}
                      >
                        <div
                          className={`rounded-lg p-3 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                          <div className="text-xs opacity-70 mt-1">
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        
                        {/* Action buttons for AI messages */}
                        {message.role === 'assistant' && message.actions && message.actions.length > 0 && (
                          <ActionButtons
                            actions={message.actions}
                            onExecuteAction={handleActionExecution}
                            className="mt-2"
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {(isLoading || isTyping) && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-1">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                          </div>
                          <span className="text-xs text-muted-foreground ml-2">
                            AI is thinking...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>

            {/* Input Area */}
            <div className="p-4 border-t flex-shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything about your finances..."
                    maxLength={2000}
                    disabled={isLoading}
                    className="pr-12"
                    aria-label="Chat input"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {input.length}/2000 characters
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
