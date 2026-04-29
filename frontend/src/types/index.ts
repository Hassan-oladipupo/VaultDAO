/**
 * Centralized type exports for the VaultDAO frontend
 */

// Token types - import first for use in interfaces
import type { TokenInfo } from '../constants/tokens';
export type { TokenInfo };
export { DEFAULT_TOKENS, XLM_TOKEN } from '../constants/tokens';

// Token balance type
export interface TokenBalance {
  token: TokenInfo;
  balance: string;
  usdValue?: number;
  change24h?: number;
  isLoading?: boolean;
}

// Comment types
export interface Comment {
  id: string;
  proposalId: string;
  author: string;
  text: string;
  parentId: string;
  createdAt: string;
  editedAt: string;
  replies?: Comment[];
}

// List mode types
export type ListMode = 'Disabled' | 'Whitelist' | 'Blacklist';

// Proposal priority level — mirrors the contract's Priority enum (u32)
export enum Priority {
  Low = 0,
  Normal = 1,
  High = 2,
  Critical = 3,
}

// Logic for combining multiple conditions — mirrors the contract's ConditionLogic enum (u32)
export enum ConditionLogic {
  And = 0,
  Or = 1,
}

// Re-export activity types
export type { VaultActivity, VaultEventType, VaultEventsFilters, GetVaultEventsResult } from './activity';
export type { DashboardLayout, DashboardTemplate, WidgetConfig, WidgetType } from './dashboard';
