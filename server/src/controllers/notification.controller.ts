import { Request, Response } from 'express';
import Notification from '../models/Notification.model';

export const getMyNotifications = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Ensure limit doesn't exceed 10
        const actualLimit = Math.min(limit, 10);

        const [notifications, total] = await Promise.all([
            Notification.find({ user: req.user!._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(actualLimit),
            Notification.countDocuments({ user: req.user!._id })
        ]);

        const totalPages = Math.ceil(total / actualLimit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.json({
            notifications,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: actualLimit,
                hasNext,
                hasPrev
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const markNotificationsAsRead = async (req: Request, res: Response) => {
    try {
        await Notification.updateMany({ user: req.user!._id, isRead: false }, { isRead: true });
        res.json({ message: 'Notifications marked as read' });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const markNotificationAsRead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const notification = await Notification.findOneAndUpdate(
            { _id: id, user: req.user!._id },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json({ message: 'Notification marked as read', notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getUnreadCount = async (req: Request, res: Response) => {
    try {
        const unreadCount = await Notification.countDocuments({
            user: req.user!._id,
            isRead: false
        });
        
        res.json({ unreadCount });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Server error' });
    }
};