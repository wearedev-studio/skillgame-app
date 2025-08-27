import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INotification extends Document {
    user: Types.ObjectId;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
}

const notificationSchema = new Schema<INotification>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    isRead: { type: Boolean, default: false },
}, {
    timestamps: true,
});

const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export default Notification;