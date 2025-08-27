import { Request, Response } from 'express';
import User from '../models/User.model';
import generateToken from '../utils/generateToken';

export const registerUser = async (req: Request, res: Response) => {
    const { username, email, password, ageConfirmed, termsAccepted, privacyPolicyAccepted } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Please enter all fields' });
    }

    if (!ageConfirmed) {
        return res.status(400).json({ message: 'You must confirm that you are 18 years or older' });
    }

    if (!termsAccepted) {
        return res.status(400).json({ message: 'You must accept the Terms & Conditions' });
    }

    if (!privacyPolicyAccepted) {
        return res.status(400).json({ message: 'You must accept the Privacy Policy' });
    }

    try {
        const userExists = await User.findOne({ $or: [{ email }, { username }] });

        if (userExists) {
            return res.status(400).json({ message: 'User with this email or username already exists' });
        }

        const user = await User.create({
            username,
            email,
            password,
            ageConfirmed,
            termsAccepted,
            privacyPolicyAccepted,
        });

        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            avatar: user.avatar,
            role: user.role,
            // @ts-ignore
            token: generateToken(user._id),
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please enter email and password' });
    }

    try {
        const user = await User.findOne({ email }).select('+password');

        if (user && (await user.comparePassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                avatar: user.avatar,
                role: user.role,
                // @ts-ignore
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Please provide an email' });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' });
        }

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetExpires = new Date(Date.now() + 10 * 60 * 1000);

        user.passwordResetCode = resetCode;
        user.passwordResetExpires = resetExpires;
        await user.save();

        console.log(`Password Reset Code for ${email}: ${resetCode}`);

        res.status(200).json({
            message: `Password reset code sent to console. In production, this would be sent to your email. The code is: ${resetCode}`,
            developer_note: "This response includes the reset code for testing purposes only."
        });

    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    const { email, secretCode, newPassword } = req.body;
    if (!email || !secretCode || !newPassword) {
        return res.status(400).json({ message: 'Please provide email, secret code, and a new password' });
    }

    try {
        const user = await User.findOne({
            email,
            passwordResetCode: secretCode,
            passwordResetExpires: { $gt: Date.now() },
        }).select('+passwordResetCode +passwordResetExpires');

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }

        user.password = newPassword;
        user.passwordResetCode = undefined;
        user.passwordResetExpires = undefined;

        await user.save();

        res.status(200).json({ message: 'Password has been reset successfully. Please log in.' });

    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
