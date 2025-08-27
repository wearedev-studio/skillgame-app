import { Request, Response } from 'express';
import GameRecord from '../models/GameRecord.model';
import Transaction from '../models/Transaction.model';
import User from '../models/User.model';
import { getIO } from '../socket';

export const getUserProfile = (req: Request, res: Response) => {
  if (req.user) {
    res.json({
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      balance: req.user.balance,
      avatar: req.user.avatar,
      role: req.user.role,
      kycStatus: req.user.kycStatus,
      kycRejectionReason: req.user.kycRejectionReason
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

export const getGameHistory = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const total = await GameRecord.countDocuments({ user: req.user?._id });
    const gameHistory = await GameRecord.find({ user: req.user?._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      games: gameHistory,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getTransactionHistory = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const total = await Transaction.countDocuments({ user: req.user?._id });
    const transactionHistory = await Transaction.find({ user: req.user?._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      transactions: transactionHistory,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateUserPassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide current and new passwords' });
  }

  try {
    const user = await User.findById(req.user?._id).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateUserBalance = async (req: Request, res: Response) => {
  const { amount } = req.body;
  const numericAmount = Number(amount);

  if (isNaN(numericAmount) || numericAmount === 0) {
    return res.status(400).json({ message: 'Invalid amount provided' });
  }
  
  const user = req.user!;

  if (numericAmount < 0 && user.balance < Math.abs(numericAmount)) {
    return res.status(400).json({ message: 'Insufficient funds for withdrawal' });
  }

  user.balance += numericAmount;
  await user.save();

  const transaction = await Transaction.create({
    user: user._id,
    type: numericAmount > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
    amount: Math.abs(numericAmount),
    status: 'COMPLETED',
  });

  const io = getIO();
  if (io) {
    io.emit('balanceUpdated', {
      userId: (user._id as any).toString(),
      newBalance: user.balance,
      transaction: {
        type: transaction.type,
        amount: transaction.amount,
        status: transaction.status,
        createdAt: new Date()
      }
    });
  }

  res.json({
    _id: user._id,
    username: user.username,
    email: user.email,
    balance: user.balance,
    avatar: user.avatar,
    kycStatus: user.kycStatus,
    role: user.role
  });
};

export const updateUserAvatar = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.user!._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'File not uploaded' });
        }

        const avatarPath = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');
        user.avatar = avatarPath;
        
        await user.save();

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            avatar: user.avatar,
            role: user.role
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const submitKyc = async (req: Request, res: Response) => {
    const { documentType } = req.body;
    const user = await User.findById(req.user!._id);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.kycStatus === 'PENDING' || user.kycStatus === 'APPROVED') {
        return res.status(400).json({ message: 'You have already submitted an application or it has been approved.' });
    }
    if (!req.file) return res.status(400).json({ message: 'Document file not uploaded.' });

    user.kycDocuments.push({
        documentType,
        filePath: req.file.path,
        submittedAt: new Date(),
    });
    user.kycStatus = 'PENDING';
    user.kycRejectionReason = undefined;
    await user.save();

    const io = getIO();
    if (io) {
        io.emit('kycStatusUpdated', {
            userId: (user._id as any).toString(),
            kycStatus: user.kycStatus,
            kycRejectionReason: user.kycRejectionReason
        });
    }

    res.json({ status: user.kycStatus, message: 'The documents have been successfully submitted for verification.' });
};