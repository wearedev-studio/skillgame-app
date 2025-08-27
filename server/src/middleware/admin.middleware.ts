import { Request, Response, NextFunction } from 'express';
import { protect } from './auth.middleware';
import { securityLogger } from './security.middleware';

export const admin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        securityLogger.warn('Admin access attempt without user', {
            ip: req.ip,
            path: req.path,
            timestamp: new Date()
        });
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    const userRole = req.user.role;
    
    if (userRole === 'ADMIN') {
        securityLogger.info('Admin access granted', {
            userId: req.user._id,
            role: userRole,
            path: req.path,
            timestamp: new Date()
        });
        next();
    } else {
        securityLogger.warn('Non-admin access attempt', {
            userId: req.user._id,
            userRole,
            ip: req.ip,
            path: req.path,
            timestamp: new Date()
        });
        res.status(403).json({
            success: false,
            message: 'Access denied. Admin role required.'
        });
    }
};

export const adminProtect = [protect, admin];