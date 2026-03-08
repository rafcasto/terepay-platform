import type { Timestamp } from 'firebase-admin/firestore';

export type LoanStatus = 'active' | 'delinquent' | 'paid_off' | 'defaulted';

export interface Loan {
  loanId: string;
  applicationId: string;
  applicantId: string;
  lenderId: string;
  principal: number;
  interestRate: number;
  term: number;
  monthlyPayment: number;
  dailyInterestRate: number;
  dateIssued: Timestamp;
  dueDate: Timestamp;
  nextPaymentDate: Timestamp;
  expectedCompletionDate: Timestamp;
  status: LoanStatus;
  totalPayments: number;
  paymentsCompleted: number;
  paymentsRemaining: number;
  lastPaymentDate?: Timestamp;
  totalPaid: number;
  remainingBalance: number;
  totalInterestPaid: number;
  estimatedTotalInterest: number;
  daysOverdue: number;
  daysDelinquent: number;
  latePaymentCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PaymentStatus = 'scheduled' | 'pending' | 'completed' | 'failed' | 'reversed';
export type PaymentMethod = 'bank_transfer' | 'card' | 'ach' | 'check' | 'manual';

export interface Payment {
  paymentId: string;
  loanId: string;
  applicantId: string;
  lenderId: string;
  amount: number;
  principal: number;
  interest: number;
  dueDate: Timestamp;
  paidDate?: Timestamp;
  processedAt?: Timestamp;
  status: PaymentStatus;
  method: PaymentMethod;
  transactionId?: string;
  idempotencyKey: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  failureReason?: string;
}
