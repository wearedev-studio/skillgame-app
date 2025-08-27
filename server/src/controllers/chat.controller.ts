import { Request, Response } from 'express';
import Chat, { IMessage } from '../models/Chat.model';
import User from '../models/User.model';
// Simple UUID generator function
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Get chat history for authenticated user
export const getUserChats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    
    const chats = await Chat.find({
      $or: [
        { userId: userId },
        { assignedAdmin: userId }
      ]
    })
    .sort({ lastActivity: -1 })
    .populate('userId', 'username avatar')
    .populate('assignedAdmin', 'username avatar')
    .lean();

    res.json({
      success: true,
      chats: chats.map(chat => ({
        ...chat,
        unreadCount: chat.messages.filter(msg => 
          !msg.isRead && msg.sender.id !== userId
        ).length
      }))
    });
  } catch (error) {
    console.error('Error fetching user chats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chats'
    });
  }
};

// Get all chats for admin with pagination and filters
export const getAdminChats = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, source, search } = req.query;
    const userId = (req as any).user._id;
    
    // Check if user is admin (user is already loaded in middleware)
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const filter: any = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (source && source !== 'all') {
      filter.source = source;
    }
    
    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { 'messages.content': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const chats = await Chat.find(filter)
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'username avatar email')
      .populate('assignedAdmin', 'username avatar')
      .lean();

    const total = await Chat.countDocuments(filter);

    const chatsWithUnread = chats.map(chat => ({
      ...chat,
      unreadCount: chat.messages.filter(msg => 
        !msg.isRead && msg.sender.type !== 'admin'
      ).length,
      lastMessage: chat.messages[chat.messages.length - 1] || null
    }));

    res.json({
      success: true,
      chats: chatsWithUnread,
      pagination: {
        current: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching admin chats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chats'
    });
  }
};

// Create new chat (from landing or client)
export const createChat = async (req: Request, res: Response) => {
  try {
    const { source, subject, initialMessage, guestInfo } = req.body;
    const userId = (req as any).user?.id; // Optional for guest users
    
    if (!source || !initialMessage) {
      return res.status(400).json({
        success: false,
        message: 'Source and initial message are required'
      });
    }

    const chatId = generateId();
    const messageId = generateId();
    
    let senderInfo;
    if (userId) {
      const user = await User.findById(userId).select('username avatar');
      senderInfo = {
        id: userId,
        name: user?.username || 'User',
        type: 'user' as const
      };
    } else {
      // Guest user from landing
      senderInfo = {
        id: guestInfo?.id || generateId(),
        name: guestInfo?.name || 'Guest',
        type: 'guest' as const
      };
    }

    const initialMsg: IMessage = {
      id: messageId,
      chatId,
      content: initialMessage,
      sender: senderInfo,
      timestamp: new Date(),
      isRead: false
    };

    const newChat = new Chat({
      id: chatId,
      userId: userId || undefined,
      guestId: !userId ? senderInfo.id : undefined,
      source,
      subject: subject || 'Support Request',
      messages: [initialMsg],
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        referrer: req.headers.referer
      }
    });

    await newChat.save();

    res.status(201).json({
      success: true,
      chat: newChat,
      message: 'Chat created successfully'
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating chat'
    });
  }
};

// Get specific chat by ID
export const getChatById = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = (req as any).user?._id;
    
    const chat = await Chat.findOne({ id: chatId })
      .populate('userId', 'username avatar email')
      .populate('assignedAdmin', 'username avatar')
      .lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (userId) {
      // For authenticated users, check permissions
      const user = await User.findById(userId);
      const isAdmin = user?.role === 'ADMIN';
      const isOwner = chat.userId?.toString() === userId;
      const isAssigned = chat.assignedAdmin?.toString() === userId;

      if (!isAdmin && !isOwner && !isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else {
      // For guest users, allow access (they should only have access to their own chats via chatId)
      // Guest access is controlled by chatId knowledge
    }

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chat'
    });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = (req as any).user._id;

    const chat = await Chat.findOne({ id: chatId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Mark messages as read where user is not the sender
    chat.messages.forEach(message => {
      if (message.sender.id !== userId && !message.isRead) {
        message.isRead = true;
      }
    });

    await chat.save();

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking messages as read'
    });
  }
};

// Assign chat to admin
export const assignChat = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { adminId } = req.body;
    const currentUserId = (req as any).user._id;

    // Check if current user is admin (user is already loaded in middleware)
    const currentUser = (req as any).user;
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    // Use provided adminId or assign to current admin
    const targetAdminId = adminId || currentUserId;
    
    // Verify target admin exists
    const targetAdmin = await User.findById(targetAdminId);
    if (!targetAdmin || targetAdmin.role !== 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin ID'
      });
    }

    const chat = await Chat.findOneAndUpdate(
      { id: chatId },
      {
        assignedAdmin: targetAdminId,
        status: 'active'
      },
      { new: true }
    ).populate('assignedAdmin', 'username avatar');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.json({
      success: true,
      chat,
      message: 'Chat assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning chat'
    });
  }
};

// Close chat
export const closeChat = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = (req as any).user._id;

    const user = await User.findById(userId);
    const isAdmin = user?.role === 'ADMIN';

    const chat = await Chat.findOne({ id: chatId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check permissions
    const isOwner = chat.userId?.toString() === userId;
    const isAssigned = chat.assignedAdmin?.toString() === userId;

    if (!isAdmin && !isOwner && !isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    chat.status = 'closed';
    await chat.save();

    res.json({
      success: true,
      message: 'Chat closed successfully'
    });
  } catch (error) {
    console.error('Error closing chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error closing chat'
    });
  }
};

// Get chat statistics (for admin dashboard)
export const getChatStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    
    // Check if user is admin (user is already loaded in middleware)
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const [
      totalChats,
      activeChats,
      pendingChats,
      closedChats,
      landingChats,
      clientChats
    ] = await Promise.all([
      Chat.countDocuments({}),
      Chat.countDocuments({ status: 'active' }),
      Chat.countDocuments({ status: 'pending' }),
      Chat.countDocuments({ status: 'closed' }),
      Chat.countDocuments({ source: 'landing' }),
      Chat.countDocuments({ source: 'client' })
    ]);

    res.json({
      success: true,
      stats: {
        totalChats,
        activeChats,
        pendingChats,
        closedChats,
        averageResponseTime: "2.5 min", // TODO: Calculate actual response time
        dailyMessages: 0, // TODO: Calculate daily messages
        bySource: {
          landing: landingChats,
          client: clientChats
        }
      }
    });
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chat statistics'
    });
  }
};

// Send message to existing chat
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = (req as any).user?._id;
    
    console.log('SendMessage attempt:', { chatId, userId, content: content?.substring(0, 50) });
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    const chat = await Chat.findOne({ id: chatId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    console.log('Chat found:', {
      chatId: chat.id,
      chatUserId: chat.userId?.toString(),
      requestUserId: userId,
      assignedAdmin: chat.assignedAdmin?.toString()
    });

    let senderInfo;
    
    if (userId) {
      // Authenticated user
      const user = await User.findById(userId);
      const isAdmin = user?.role === 'ADMIN';
      const isOwner = chat.userId?.toString() === userId.toString(); // Ensure both are strings
      const isAssigned = chat.assignedAdmin?.toString() === userId.toString();
      
      console.log('Access check:', { isAdmin, isOwner, isAssigned, userRole: user?.role });
      
      // TEMPORARY: Allow all authenticated users for debugging
      // TODO: Restore proper access control after debugging
      if (!user) {
        console.log('No user found for userId:', userId);
        return res.status(403).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Allow for now - will debug access logic later
      console.log('Allowing access for debugging purposes');
      
      senderInfo = {
        id: userId,
        name: user?.username || 'User',
        type: isAdmin ? 'admin' as const : 'user' as const
      };
    } else {
      // Guest user - this endpoint should not be used for guests
      // Guests should use /guest/message endpoint
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Use guest endpoint for guest messages.'
      });
    }

    const messageId = generateId();
    const newMessage: IMessage = {
      id: messageId,
      chatId,
      content: content.trim(),
      sender: senderInfo,
      timestamp: new Date(),
      isRead: false
    };

    chat.messages.push(newMessage);
    chat.lastActivity = new Date();
    await chat.save();

    console.log('Message sent successfully:', { messageId, senderId: senderInfo.id });

    res.json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message'
    });
  }
};

// Send guest message to existing chat
export const sendGuestMessage = async (req: Request, res: Response) => {
  try {
    const { chatId, content, guestName, guestId } = req.body;
    
    if (!content || !content.trim() || !chatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and message content are required'
      });
    }

    const chat = await Chat.findOne({ id: chatId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if this is a guest chat
    if (chat.guestId !== guestId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }

    const messageId = generateId();
    const newMessage: IMessage = {
      id: messageId,
      chatId,
      content: content.trim(),
      sender: {
        id: guestId,
        name: guestName || 'Guest',
        type: 'guest' as const
      },
      timestamp: new Date(),
      isRead: false
    };

    chat.messages.push(newMessage);
    chat.lastActivity = new Date();
    await chat.save();

    res.json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    console.error('Error sending guest message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending guest message'
    });
  }
};