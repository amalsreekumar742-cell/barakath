import type { Timestamp } from 'firebase/firestore';
export interface NotificationProps {
  id: string; title: string; body: string; image: string;
  type: 'Broadcast' | 'Order' | 'Promotion' | 'Wallet' | 'Affiliate' | 'Replacement' | 'System';
  targetType: 'All' | 'Specific'; targetUserIds: string[];
  linkType: 'Product' | 'Category' | 'Order' | 'None'; linkValue: string;
  isScheduled: boolean; scheduledAt: Timestamp | null; isSent: boolean; sentAt: Timestamp | null;
  sentBy: string; sentByName: string; recipientCount: number;
  keywords: string[]; createdAt: Timestamp; updatedAt: Timestamp;
}
