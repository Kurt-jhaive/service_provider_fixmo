# Unread Count Backend Requirement

## Issue
When fetching conversations list via the Messages tab, the unread count badges are not showing up properly. The frontend is correctly displaying the `unread_count` field if it's present in the API response.

---

## Backend API Endpoint

**Endpoint:** `GET /api/messages/conversations?userType=provider`

**Current Response Structure:**
```json
{
  "success": true,
  "conversations": [
    {
      "conversation_id": 4,
      "customer_id": 1,
      "provider_id": 4,
      "status": "active",
      "unread_count": 0,  // ⚠️ This needs to be calculated correctly
      "last_message": { ... },
      "customer": { ... },
      ...
    }
  ],
  "pagination": { ... }
}
```

---

## Required Backend Calculation

For **each conversation**, the backend needs to calculate `unread_count` as:

```sql
SELECT COUNT(*) 
FROM messages 
WHERE conversation_id = {conversation_id}
  AND sender_type = 'customer'  -- Messages FROM customer TO provider
  AND is_read = false           -- Unread messages only
```

---

## Expected Behavior

### Scenario 1: New Message from Customer
1. Customer sends message to provider
2. Message is created with `is_read = false`
3. GET /api/messages/conversations returns `unread_count = 1` for that conversation
4. Provider sees red badge with "1" on Messages tab ✅

### Scenario 2: Provider Opens Chat
1. Provider opens the conversation
2. Frontend calls `markMessagesAsRead()` to mark messages as read
3. Backend updates messages to `is_read = true`
4. When provider returns to Messages tab, GET /api/messages/conversations returns `unread_count = 0`
5. Badge disappears ✅

### Scenario 3: Multiple Unread Messages
1. Customer sends 3 messages
2. GET /api/messages/conversations returns `unread_count = 3`
3. Provider sees badge with "3" ✅
4. Provider opens chat, messages marked as read
5. Provider returns to Messages tab, badge disappears ✅

---

## Backend Implementation Example (Node.js/Prisma)

```javascript
// In your conversation query
const conversations = await prisma.conversation.findMany({
  where: {
    provider_id: providerId,
    status: 'active'
  },
  include: {
    customer: {
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        profile_photo: true,
        phone_number: true
      }
    },
    messages: {
      take: 1,
      orderBy: { created_at: 'desc' },
      select: {
        message_id: true,
        content: true,
        message_type: true,
        sender_type: true,
        is_read: true,
        created_at: true
      }
    },
    _count: {
      select: {
        messages: {
          where: {
            sender_type: 'customer',
            is_read: false
          }
        }
      }
    }
  }
});

// Transform to include unread_count
const formattedConversations = conversations.map(conv => ({
  ...conv,
  last_message: conv.messages[0] || null,
  unread_count: conv._count.messages, // This is the count of unread messages
  messages: undefined, // Remove messages array from response
  _count: undefined    // Remove _count from response
}));

res.json({
  success: true,
  conversations: formattedConversations,
  pagination: { ... }
});
```

---

## Testing Checklist

### Test 1: API Response Includes unread_count
- [ ] Call `GET /api/messages/conversations?userType=provider`
- [ ] Verify each conversation object has `unread_count` field
- [ ] Verify `unread_count` is a number (not null/undefined)

### Test 2: Unread Count Calculation
- [ ] Have customer send a message to provider
- [ ] Call API and verify `unread_count` increases
- [ ] Provider opens chat (messages marked as read)
- [ ] Call API and verify `unread_count` decreases to 0

### Test 3: Multiple Conversations
- [ ] Create multiple conversations with different unread counts
- [ ] Verify each conversation has correct individual `unread_count`

---

## Frontend Verification

Once backend is fixed, verify in frontend logs:

```javascript
// You should see:
📥 Fetching conversations...
📊 Received conversations: 2
🔍 First conversation sample: {
  conversation_id: 4,
  customer_id: 1,
  unread_count: 3,  // ✅ Should be a number > 0 if there are unread messages
  ...
}
📬 Conversation with unread messages: {
  conversation_id: 4,
  customer_name: "Ricardo Martinez",
  unread_count: 3,
  ...
}
```

---

## Current Frontend Code (Already Correct)

The frontend is already handling `unread_count` correctly:

```typescript
// app/messaging/index.tsx
const unreadCount = item.unread_count || 0;
const isUnread = unreadCount > 0;

{isUnread && (
    <View style={styles.unreadBadge}>
        <Text style={styles.unreadCount}>
            {unreadCount > 99 ? "99+" : unreadCount}
        </Text>
    </View>
)}
```

The issue is that `item.unread_count` is either:
- Missing from API response (undefined)
- Always 0 (not being calculated correctly)

---

## Summary

**Backend Action Required:**
1. ✅ Include `unread_count` in conversation response
2. ✅ Calculate it as: COUNT of messages where `sender_type='customer'` AND `is_read=false`
3. ✅ Update count when messages are marked as read

**Frontend Status:**
- ✅ Already correctly displays unread count if present
- ✅ Already marks messages as read when opening chat
- ✅ Already refreshes conversation list on focus

---

**Last Updated:** October 26, 2025
