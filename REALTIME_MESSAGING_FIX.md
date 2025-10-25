# Real-Time Messaging Issue - Troubleshooting Guide

## Issue
When a customer sends a message from the customer app, the provider app doesn't receive the message in real-time. The provider needs to leave the chat and return to refresh the conversation.

---

## Frontend Changes Made

### 1. Enhanced Socket Event Logging

**File:** `app/messaging/chat.tsx`

Added comprehensive logging to track socket events:

```typescript
// Listen for new messages
socket.on('new_message', (data: any) => {
    console.log('📨 New message received in chat screen:', {
        hasMessage: !!data.message,
        messageConvId: data.message?.conversation_id,
        currentConvId: conversationId,
        messageId: data.message?.message_id,
        content: data.message?.content,
        senderType: data.message?.sender_type
    });
    
    if (data.message && data.message.conversation_id === conversationId) {
        console.log('✅ Message is for this conversation, adding to state');
        // ... add message to state
    } else {
        console.log('⚠️ Message is NOT for this conversation, ignoring');
    }
});
```

### 2. Added Reconnection Logic

```typescript
// Handle reconnection - rejoin conversation
socket.on('reconnect', () => {
    console.log('🔄 Socket reconnected, rejoining conversation...');
    messageAPI.joinConversation(socket, conversationId, userId, 'provider');
});
```

### 3. Added Connection Error Handlers

```typescript
socket.on('connect_error', (error: any) => {
    console.error('❌ Socket connection error:', error.message);
});

socket.on('error', (error: any) => {
    console.error('❌ Socket error:', error);
});

socket.on('reconnect_attempt', (attemptNumber: number) => {
    console.log('🔄 Socket reconnection attempt:', attemptNumber);
});

socket.on('reconnect_error', (error: any) => {
    console.error('❌ Socket reconnection error:', error);
});

socket.on('reconnect_failed', () => {
    console.error('❌ Socket reconnection failed after max attempts');
});
```

---

## Testing Steps

### Step 1: Check Socket Connection
1. Open provider app and navigate to a chat
2. Check console for these logs:
   ```
   🔌 Setting up Socket.IO...
   ✅ Socket connected
   ✅ Socket authenticated: {...}
   ✅ Joined conversation: {...}
   ```
3. If you don't see these, there's a connection issue

### Step 2: Test Message Reception
1. Keep provider app open in a chat
2. Send message from customer app
3. Check provider app console for:
   ```
   📨 New message received in chat screen: {
       hasMessage: true,
       messageConvId: 4,
       currentConvId: 4,
       messageId: 121,
       content: "test message",
       senderType: "customer"
   }
   ✅ Message is for this conversation, adding to state
   ✅ Adding new message to chat
   ```

### Step 3: Diagnose Issues

#### Issue A: No socket connection logs
**Possible causes:**
- Backend Socket.IO server not running
- Wrong backend URL
- Network/firewall blocking WebSocket connections

**Solution:** Check backend server logs and verify Socket.IO is running

#### Issue B: Socket connects but doesn't authenticate
**Logs will show:**
```
✅ Socket connected
❌ Socket authentication failed: {...}
```

**Possible causes:**
- Invalid or expired auth token
- Backend not recognizing authentication

**Solution:** Verify auth token is valid and backend authentication logic

#### Issue C: Authenticated but doesn't join conversation
**Logs will show:**
```
✅ Socket connected
✅ Socket authenticated
❌ Failed to join conversation: {...}
```

**Possible causes:**
- Invalid conversation ID
- Backend not handling join_conversation event
- Conversation doesn't exist

**Solution:** Verify conversation exists and backend handles `join_conversation` event

#### Issue D: Joined but no messages received
**Logs will show:**
```
✅ Socket connected
✅ Socket authenticated
✅ Joined conversation
(No message logs when customer sends message)
```

**Possible causes:**
- Backend not emitting `new_message` event
- Customer app not properly sending messages via socket
- Message being sent to wrong room

**Solution:** Check backend code

---

## Backend Requirements

The backend Socket.IO server MUST implement the following:

### 1. Authentication
```javascript
socket.on('authenticate', async ({ token, userType }) => {
    // Verify token
    const user = await verifyToken(token);
    if (!user) {
        socket.emit('authentication_failed', { message: 'Invalid token' });
        return;
    }
    
    // Store user info in socket
    socket.userId = user.id;
    socket.userType = userType; // 'provider' or 'customer'
    
    socket.emit('authenticated', { userId: socket.userId, userType: socket.userType });
});
```

### 2. Join Conversation
```javascript
socket.on('join_conversation', async ({ conversationId }) => {
    try {
        // Verify user has access to this conversation
        const conversation = await getConversation(conversationId);
        
        if (!conversation) {
            socket.emit('join_conversation_failed', { 
                reason: 'not_found',
                conversationId 
            });
            return;
        }
        
        // Join the room
        const roomName = `conversation_${conversationId}`;
        socket.join(roomName);
        
        console.log(`User ${socket.userId} joined conversation ${conversationId}`);
        
        socket.emit('joined_conversation', { 
            conversationId,
            success: true 
        });
    } catch (error) {
        socket.emit('join_conversation_failed', { 
            reason: 'error',
            conversationId,
            error: error.message 
        });
    }
});
```

### 3. Broadcast New Messages
```javascript
// When a message is created (via HTTP POST /api/messages)
async function handleNewMessage(req, res) {
    try {
        // Save message to database
        const message = await saveMessage({
            conversation_id: req.body.conversationId,
            sender_id: req.user.id,
            sender_type: req.user.type, // 'provider' or 'customer'
            content: req.body.content,
            message_type: req.body.messageType
        });
        
        // Emit to all users in the conversation room
        const roomName = `conversation_${message.conversation_id}`;
        io.to(roomName).emit('new_message', {
            message: {
                message_id: message.message_id,
                conversation_id: message.conversation_id,
                sender_id: message.sender_id,
                sender_type: message.sender_type,
                content: message.content,
                message_type: message.message_type,
                is_read: false,
                created_at: message.created_at,
                updated_at: message.updated_at
            }
        });
        
        res.json({ success: true, data: message });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
```

### 4. Broadcast Message Read Events
```javascript
// When messages are marked as read (via HTTP PUT /api/messages/mark-read)
async function handleMarkAsRead(req, res) {
    try {
        const { conversationId, messageIds } = req.body;
        
        // Update messages in database
        await markMessagesAsRead(messageIds);
        
        // Emit to all users in the conversation room
        const roomName = `conversation_${conversationId}`;
        messageIds.forEach(messageId => {
            io.to(roomName).emit('message_read', {
                conversationId,
                messageId,
                readBy: req.user.id,
                readByType: req.user.type
            });
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
```

---

## Common Backend Issues

### Issue 1: Messages saved but not broadcasted
**Symptom:** Messages appear when refreshing but not in real-time

**Cause:** Backend saves message to database but doesn't emit Socket.IO event

**Fix:** Add `io.to(roomName).emit('new_message', ...)` after saving message

### Issue 2: Wrong room name
**Symptom:** Socket connected and joined, but messages not received

**Cause:** Room name mismatch between join and emit
- Join uses: `conversation_${conversationId}`
- Emit uses: `conv_${conversationId}` ← Different!

**Fix:** Use consistent room naming (e.g., `conversation_${conversationId}`)

### Issue 3: Not emitting to room
**Symptom:** Message saved, event emitted, but not received by other users

**Cause:** Using `socket.emit()` instead of `io.to(roomName).emit()`

```javascript
// ❌ Wrong - only sends to the sender
socket.emit('new_message', { message });

// ✅ Correct - sends to everyone in the room
io.to(roomName).emit('new_message', { message });
```

### Issue 4: Sending message to wrong user type
**Symptom:** Messages work between customers but not between customer and provider

**Cause:** Not properly joining rooms or filtering by user type

**Fix:** Ensure both customers and providers join the same conversation room

---

## Debugging Commands

### Check if Socket.IO is connected
Run in browser console or check logs:
```javascript
// In provider app console, should see:
✅ Socket connected
```

### Check if room is joined
Backend should log:
```
User 4 (provider) joined conversation 123
```

### Check message emission
Backend should log when message is created:
```
Emitting new_message to room: conversation_123
Message: {...}
```

### Test socket manually (backend)
```javascript
// In backend, test emitting manually
io.to('conversation_123').emit('new_message', {
    message: {
        message_id: 999,
        content: 'Test message',
        conversation_id: 123,
        sender_type: 'customer',
        created_at: new Date().toISOString()
    }
});
```

---

## Quick Reference

### Frontend Status: ✅ Complete
- Socket connection setup: ✅
- Event listeners: ✅
- Reconnection logic: ✅
- Duplicate prevention: ✅
- State management: ✅
- Comprehensive logging: ✅

### Backend Status: ⚠️ Needs Verification
- [ ] Socket.IO server running
- [ ] Authentication handler implemented
- [ ] Join conversation handler implemented
- [ ] Emit `new_message` when messages are created
- [ ] Emit `message_read` when messages are marked as read
- [ ] Correct room naming convention
- [ ] Using `io.to(roomName).emit()` not `socket.emit()`

---

## Testing Checklist

- [ ] Provider app connects to Socket.IO
- [ ] Provider app authenticates successfully
- [ ] Provider app joins conversation room
- [ ] Customer sends message via customer app
- [ ] Backend saves message to database
- [ ] Backend emits `new_message` event to room
- [ ] Provider app receives `new_message` event
- [ ] Provider app displays message in real-time
- [ ] Message appears without needing to refresh

---

**Last Updated:** October 26, 2025  
**Status:** Frontend ✅ Complete | Backend ⚠️ Needs Verification
