import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  id: string;
  chatId: string;
  content: string;
  sender: {
    id: string;
    name: string;
    type: 'user' | 'admin' | 'guest';
  };
  timestamp: Date;
  isRead: boolean;
}

export interface IChat extends Document {
  id: string;
  userId?: string; // Optional for guest users
  guestId?: string; // For non-authenticated users from landing
  source: 'landing' | 'client'; // Where chat was initiated
  status: 'active' | 'closed' | 'pending';
  subject?: string;
  assignedAdmin?: string; // Admin user ID
  messages: IMessage[];
  lastActivity: Date;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  id: { type: String, required: true },
  chatId: { type: String, required: true },
  content: { type: String, required: true, maxlength: 1000 },
  sender: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['user', 'admin', 'guest'], required: true }
  },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
}, { _id: false });

const chatSchema = new Schema<IChat>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, ref: 'User' }, // Reference to User model
  guestId: { type: String }, // For anonymous users
  source: { type: String, enum: ['landing', 'client'], required: true },
  status: { type: String, enum: ['active', 'closed', 'pending'], default: 'pending' },
  subject: { type: String, maxlength: 200 },
  assignedAdmin: { type: String, ref: 'User' },
  messages: [messageSchema],
  lastActivity: { type: Date, default: Date.now },
  metadata: {
    userAgent: { type: String },
    ipAddress: { type: String },
    referrer: { type: String }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
chatSchema.index({ userId: 1, status: 1 });
chatSchema.index({ assignedAdmin: 1, status: 1 });
chatSchema.index({ source: 1, status: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ 'messages.timestamp': -1 });

// Update lastActivity on message addition
chatSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.lastActivity = new Date();
  }
  next();
});

const Chat = mongoose.model<IChat>('Chat', chatSchema);

export default Chat;