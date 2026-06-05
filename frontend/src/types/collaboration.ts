export interface ProposalDraft {
  recipient: string;
  token: string;
  amount: string;
  memo: string;
}

export interface CollaboratorPresence {
  userId: string;
  userName: string;
  color: string;
  cursor: { field: string; position: number; timestamp: number; isTyping?: boolean } | null;
  lastSeen: number;
}