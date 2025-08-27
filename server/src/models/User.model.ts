import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

interface IKycDocument {
    documentType: 'PASSPORT' | 'UTILITY_BILL' | 'INTERNATIONAL_PASSPORT' | 'RESIDENCE_PERMIT';
    filePath: string;
    submittedAt: Date;
}

interface ISumsubData {
    applicantId?: string;
    inspectionId?: string;
    externalUserId: string;
    levelName?: string;
    reviewStatus?: 'init' | 'pending' | 'prechecked' | 'queued' | 'completed' | 'onHold';
    reviewResult?: 'GREEN' | 'RED' | 'YELLOW';
    createdAt?: Date;
    updatedAt?: Date;
    webhookData?: any;
}

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  avatar: string;
  balance: number;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'BANNED' | 'SUSPENDED' | 'PENDING';
  passwordResetCode?: string;
  passwordResetExpires?: Date;
  comparePassword(enteredPassword: string): Promise<boolean>;
  kycStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  kycDocuments: IKycDocument[];
  kycRejectionReason?: string;
  // Sumsub integration fields
  sumsubData?: ISumsubData;
  kycProvider: 'LEGACY' | 'SUMSUB';
  ageConfirmed: boolean;
  termsAccepted: boolean;
  privacyPolicyAccepted: boolean;
}

const kycDocumentSchema = new Schema<IKycDocument>({
    documentType: { type: String, required: true, enum: ['PASSPORT', 'UTILITY_BILL', 'INTERNATIONAL_PASSPORT', 'RESIDENCE_PERMIT'] },
    filePath: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
}, { _id: false });

const sumsubDataSchema = new Schema<ISumsubData>({
    applicantId: { type: String },
    inspectionId: { type: String },
    externalUserId: { type: String, required: true },
    levelName: { type: String },
    reviewStatus: {
        type: String,
        enum: ['init', 'pending', 'prechecked', 'queued', 'completed', 'onHold']
    },
    reviewResult: {
        type: String,
        enum: ['GREEN', 'RED', 'YELLOW']
    },
    createdAt: { type: Date },
    updatedAt: { type: Date },
    webhookData: { type: Schema.Types.Mixed }
}, { _id: false });

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  avatar: { type: String, default: 'default_avatar.png' },
  balance: { type: Number, default: 0 },
  role: {
    type: String,
    enum: ['USER', 'ADMIN'],
    default: 'USER',
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'BANNED', 'SUSPENDED', 'PENDING'],
    default: 'ACTIVE',
  },

  passwordResetCode: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  kycStatus: {
    type: String,
    enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'],
    default: 'NOT_SUBMITTED',
  },
  kycDocuments: [kycDocumentSchema],
  kycRejectionReason: { type: String },
  // Sumsub integration
  sumsubData: sumsubDataSchema,
  kycProvider: {
    type: String,
    enum: ['LEGACY', 'SUMSUB'],
    default: 'SUMSUB'
  },
  ageConfirmed: { type: Boolean, required: true, default: false },
  termsAccepted: { type: Boolean, required: true, default: false },
  privacyPolicyAccepted: { type: Boolean, required: true, default: false },
}, {
  timestamps: true,
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword: string): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};


const User = mongoose.model<IUser>('User', userSchema);

export default User;