/** Input for an admin decision on a pending deposit or withdrawal. */
export type ReviewInput = {
  recordId: string;
  reviewerId: string;
  note?: string;
  ipAddress: string | null;
};
