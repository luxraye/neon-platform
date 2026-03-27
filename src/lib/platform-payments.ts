export const PLATFORM_PAYMENT_PROVIDER = "dpopay" as const;

export const PLATFORM_INVOICE_STATUSES = [
  "draft",
  "pending",
  "paid",
  "failed",
  "overdue",
  "cancelled",
] as const;

export const PLATFORM_TRANSACTION_STATUSES = [
  "initiated",
  "pending",
  "success",
  "failed",
  "expired",
  "cancelled",
] as const;

export type PlatformInvoiceStatus = (typeof PLATFORM_INVOICE_STATUSES)[number];
export type PlatformTransactionStatus = (typeof PLATFORM_TRANSACTION_STATUSES)[number];

export type PlatformInvoice = {
  id: string;
  institution_id: string;
  report_month: string;
  amount_due: number;
  status: PlatformInvoiceStatus;
  due_date: string | null;
};

export type PlatformPaymentTransaction = {
  id: string;
  invoice_id: string;
  institution_id: string;
  provider: typeof PLATFORM_PAYMENT_PROVIDER;
  provider_reference: string;
  status: PlatformTransactionStatus;
  checkout_url: string | null;
  created_at: string;
};

export type DpoPayConfig = {
  companyToken: string;
  serviceType: string;
  callbackUrl: string;
  webhookSecret: string;
};

export type DpoPayInitPayload = {
  invoiceId: string;
  institutionId: string;
  amount: number;
  currency: "BWP";
  customerEmail: string;
};

export type DpoPayInitResponse = {
  providerReference: string;
  checkoutUrl: string;
};

export interface PaymentProviderAdapter {
  provider: typeof PLATFORM_PAYMENT_PROVIDER;
  initializePayment(payload: DpoPayInitPayload): Promise<DpoPayInitResponse>;
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean;
}

export const PLATFORM_PAYMENT_LIFECYCLE = [
  "Invoice prepared by admin billing run",
  "Headmaster starts checkout",
  "Provider callback received",
  "Transaction reconciled idempotently",
  "Invoice status updated",
] as const;
