import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../constants/config';
import type {
    ApiErrorResponse,
    ConversationDetailsResponse,
    ConversationResponse,
    CreateConversationResponse,
    MessagesResponse,
    SearchMessagesResponse,
    SendMessageResponse
} from '../types/message';

const BACKEND_URL = API_CONFIG.BASE_URL;

export class MessageAPI {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string = `${BACKEND_URL}/api`, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  /**
   * Update authentication token
   */
  updateToken(token: string): void {
    this.token = token;
  }

  /**
   * Make authenticated HTTP request to API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | ApiErrorResponse> {
    const fullUrl = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...options.headers,
        },
      });

      if (response.status === 401) {
        // Handle token expiration
        return {
          success: false,
          message: 'Session expired',
        } as ApiErrorResponse;
      }

      if (!response.ok) {
        const errorData = await response.json();
        return errorData as ApiErrorResponse;
      }

      return (await response.json()) as T;
    } catch (error: any) {
      console.error('API Request Error:', error);
      return {
        success: false,
        message: error.message || 'Network error occurred',
      } as ApiErrorResponse;
    }
  }

  /**
   * Get all conversations for a user
   */
  async getConversations(
    userType: 'customer' | 'provider',
    page = 1,
    limit = 20,
    includeCompleted = true
  ): Promise<ConversationResponse | ApiErrorResponse> {
    return this.makeRequest<ConversationResponse>(
      `/messages/conversations?userType=${userType}&page=${page}&limit=${limit}&includeCompleted=${includeCompleted}`
    );
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    customerId: number,
    providerId: number,
    userType: 'customer' | 'provider'
  ): Promise<CreateConversationResponse | ApiErrorResponse> {
    return this.makeRequest<CreateConversationResponse>('/messages/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, providerId, userType }),
    });
  }

  /**
   * Get conversation details with messages
   */
  async getConversationDetails(
    conversationId: number,
    userType?: 'customer' | 'provider'
  ): Promise<ConversationDetailsResponse | ApiErrorResponse> {
    const query = userType ? `?userType=${userType}` : '';
    return this.makeRequest<ConversationDetailsResponse>(
      `/messages/conversations/${conversationId}${query}`
    );
  }

  /**
   * Get messages in a conversation (paginated)
   */
  async getMessages(
    conversationId: number,
    page = 1,
    limit = 50
  ): Promise<MessagesResponse | ApiErrorResponse> {
    return this.makeRequest<MessagesResponse>(
      `/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
    );
  }

  /**
   * Send a message (text, image, or document)
   */
  async sendMessage(
    conversationId: number,
    content: string,
    messageType: 'text' | 'image' | 'document' = 'text',
    replyToId?: number,
    attachment?: any,
    userType?: 'customer' | 'provider'
  ): Promise<SendMessageResponse | ApiErrorResponse> {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('messageType', messageType);

    if (replyToId) {
      formData.append('replyToId', replyToId.toString());
    }

    if (attachment) {
      formData.append('attachment', attachment);
    }

    if (userType) {
      formData.append('userType', userType);
    }

    return this.makeRequest<SendMessageResponse>(
      `/messages/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: formData as any,
      }
    );
  }

  /**
   * Mark messages as read
   */
  async markAsRead(
    conversationId: number,
    messageIds: number[]
  ): Promise<{ success: boolean; message: string } | ApiErrorResponse> {
    return this.makeRequest<{ success: boolean; message: string }>(
      `/messages/conversations/${conversationId}/messages/read`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds }),
      }
    );
  }

  /**
   * Search messages across conversations
   */
  async searchMessages(
    query: string,
    conversationId?: number,
    page = 1,
    limit = 20,
    userType?: 'customer' | 'provider'
  ): Promise<SearchMessagesResponse | ApiErrorResponse> {
    let url = `/messages/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;

    if (conversationId) {
      url += `&conversationId=${conversationId}`;
    }

    if (userType) {
      url += `&userType=${userType}`;
    }

    return this.makeRequest<SearchMessagesResponse>(url);
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(
    conversationId: number
  ): Promise<{ success: boolean; message: string } | ApiErrorResponse> {
    return this.makeRequest<{ success: boolean; message: string }>(
      `/messages/conversations/${conversationId}/archive`,
      { method: 'PUT' }
    );
  }

  /**
   * Create Socket.IO connection for real-time messaging
   */
  createSocketIOConnection(): Socket {
    console.log('🔌 Creating Socket.IO connection to:', BACKEND_URL);
    
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      forceNew: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: this.token,
      },
      extraHeaders: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', socket.id);

      // Authenticate immediately after connection
      socket.emit('authenticate', {
        token: this.token,
        userType: 'provider', // Service provider app
      });
    });

    socket.on('authenticated', (data) => {
      console.log('✅ Authenticated:', data);
    });

    socket.on('authentication_failed', (error) => {
      console.error('❌ Authentication failed:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Socket.IO reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Socket.IO reconnection failed');
    });

    return socket;
  }

  /**
   * Join a conversation room for real-time updates
   */
  joinConversation(
    socket: Socket,
    conversationId: number,
    userId: number,
    userType: 'customer' | 'provider'
  ): void {
    console.log('🚪 Joining conversation:', conversationId);

    // Listen for authentication success first
    socket.on('authenticated', () => {
      // Now join the conversation
      socket.emit('join_conversation', {
        conversationId: parseInt(conversationId.toString()),
      });
    });

    // If already authenticated, join immediately
    if (socket.connected) {
      socket.emit('join_conversation', {
        conversationId: parseInt(conversationId.toString()),
      });
    }

    // Listen for join confirmation
    socket.on('joined_conversation', (data) => {
      console.log('✅ Joined conversation:', data);
    });

    socket.on('join_conversation_failed', (error) => {
      // Handle different failure reasons gracefully
      if (error.reason === 'expired' || error.error?.includes('warranty period has expired')) {
        console.log('⏰ Conversation warranty period has expired:', error.conversationId);
        // This is expected for old conversations - not an error
        return;
      }
      
      if (error.reason === 'not_found') {
        console.warn('⚠️ Conversation not found:', error.conversationId);
        return;
      }
      
      if (error.reason === 'unauthorized') {
        console.warn('⚠️ Unauthorized to join conversation:', error.conversationId);
        return;
      }
      
      // Log unexpected errors as warnings, not errors
      console.warn('⚠️ Failed to join conversation:', error);
    });
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(socket: Socket, conversationId: number): void {
    console.log('🚪 Leaving conversation:', conversationId);
    socket.emit('leave_conversation', {
      conversationId: parseInt(conversationId.toString()),
    });
  }
}

/**
 * Singleton service for managing MessageAPI instance
 */
export class MessageService {
  private static instance: MessageAPI | null = null;
  private static socket: Socket | null = null;

  static initialize(token: string, baseUrl?: string): MessageAPI {
    console.log('🚀 Initializing MessageService');
    MessageService.instance = new MessageAPI(baseUrl, token);
    return MessageService.instance;
  }

  static getInstance(): MessageAPI | null {
    return MessageService.instance;
  }

  static getSocket(): Socket | null {
    return MessageService.socket;
  }

  static setSocket(socket: Socket): void {
    MessageService.socket = socket;
  }

  static updateToken(token: string): void {
    if (MessageService.instance) {
      MessageService.instance.updateToken(token);
    }
  }

  static disconnect(): void {
    if (MessageService.socket) {
      console.log('🔌 Disconnecting socket...');
      MessageService.socket.removeAllListeners(); // Remove all event listeners
      MessageService.socket.disconnect();
      MessageService.socket = null;
      console.log('✅ Socket disconnected and cleared');
    }
  }

  static reset(): void {
    console.log('🧹 Resetting MessageService...');
    MessageService.disconnect();
    MessageService.instance = null;
    console.log('✅ MessageService reset complete');
  }
}
