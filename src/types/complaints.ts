/**
 * Complaints & Higher Authority Communication Types.
 * Mandated under AICTE / UGC Grievance Redressal Regulations.
 */

import type { UserRole } from './user';

export type ComplaintCategory =
  'academic' | 'lab_infrastructure' | 'harassment' | 'administrative' | 'fee_accounts';

export type ComplaintStatus = 'submitted' | 'under_review' | 'responded' | 'resolved' | 'escalated';

export type ComplaintRecipientRole = 'hod' | 'director';

export interface ComplaintResponse {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole | 'director';
  message: string;
  timestamp: string;
  actionTaken?: string;
}

export interface ComplaintTicket {
  id: string;
  ticketNumber: string;
  studentId: string;
  studentName: string;
  studentRoll: string;
  studentEmail: string;
  department: string;
  recipientRole: ComplaintRecipientRole;
  recipientName: string;
  category: ComplaintCategory;
  subject: string;
  narrative: string;
  submittedAt: string;
  updatedAt: string;
  status: ComplaintStatus;
  slaRemainingHours: number;
  escalatedToDirector?: boolean;
  attachments?: string[];
  responses: ComplaintResponse[];
}
