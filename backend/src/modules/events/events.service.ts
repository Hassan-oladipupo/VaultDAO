import type { BackendEnv } from "../../config/env.js";
import type { ContractEvent, PollingState } from "./events.types.js";
import type { CursorStorage } from "./cursor/index.js";

/**
 * EventPollingService
 * 
 * A background service that polls the Soroban RPC for contract events.
 * Now supports cursor persistence to resume safely across restarts.
 */
export class EventPollingService {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private lastLedgerPolled: number = 0;
  private consecutiveErrors: number = 0;

  constructor(
    private readonly env: BackendEnv,
    private readonly storage: CursorStorage,
  ) {}

  /**
   * Starts the polling loop if enabled in config.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    if (!this.env.eventPollingEnabled) {
      console.log("[events-service] event polling is disabled in config");
      return;
    }

    // Load last cursor from storage
    const lastCursor = await this.storage.getCursor();
    if (lastCursor) {
      this.lastLedgerPolled = lastCursor.lastLedger;
      console.log(`[events-service] resuming from cursor: ledger ${this.lastLedgerPolled}`);
    } else {
      // Default to 0 or a safe starter ledger from env
      this.lastLedgerPolled = 0;
      console.log("[events-service] no cursor found, starting from default ledger 0");
    }

    this.isRunning = true;
    console.log("[events-service] starting event polling loop");
    console.log(`- rpc: ${this.env.sorobanRpcUrl}`);
    console.log(`- contract: ${this.env.contractId}`);
    console.log(`- interval: ${this.env.eventPollingIntervalMs}ms`);

    this.scheduleNextPoll();
  }

  /**
   * Gracefully stops the polling loop.
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log("[events-service] stopped event polling loop");
  }

  /**
   * Schedules the next execution of the poll loop.
   */
  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(async () => {
      // Re-check running state in case stop() was called during timer wait
      if (!this.isRunning) return;

      try {
        await this.poll();
        this.consecutiveErrors = 0;
      } catch (error) {
        this.consecutiveErrors++;
        console.error(`[events-service] poll error (attempt ${this.consecutiveErrors}):`, error);
        
        // Potential backoff strategy could be implemented here
      } finally {
        this.scheduleNextPoll();
      }
    }, this.env.eventPollingIntervalMs);
  }

  /**
   * Performs the actual RPC call to find new events.
   */
  private async poll(): Promise<void> {
    // Placeholder for RPC call to get events
    // Example (future implementation):
    // const results = await this.rpcService.getContractEvents({
    //   startLedger: this.lastLedgerPolled + 1,
    //   contractIds: [this.env.contractId],
    // });
    
    // For now, we mock the polling activity
    const mockEvents: ContractEvent[] = []; 
    
    if (mockEvents.length > 0) {
      this.handleBatch(mockEvents);
    }

    // Advance the "last polled" pointer (simulation)
    // Normally this would be updated based on the last event's ledger or the RPC's newest ledger.
    this.lastLedgerPolled += 1;

    // Persist new cursor
    await this.storage.saveCursor({
      lastLedger: this.lastLedgerPolled,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Processes a batch of events discovered during polling.
   */
  private handleBatch(events: ContractEvent[]): void {
    console.log(`[events-service] processing batch of ${events.length} events`);
    for (const event of events) {
      this.processEvent(event);
    }
  }

  /**
   * Specialized event processor/router.
   * Reference: contracts/vault/src/events.rs for event topic structure.
   */
  private processEvent(event: ContractEvent): void {
    const mainTopic = event.topic[0];
    
    console.log(`[events-service] routing event: ${mainTopic} (id: ${event.id})`);

    // Placeholder routing logic
    switch (mainTopic) {
      case "proposal_created":
        this.handleProposalCreated(event);
        break;
      case "proposal_executed":
        this.handleProposalExecuted(event);
        break;
      // Add more cases as needed based on events.rs
      default:
        console.debug(`[events-service] ignoring unhandled event type: ${mainTopic}`);
    }
  }

  // --- Specialized Event Handlers (Scaffold) ---

  private handleProposalCreated(event: ContractEvent): void {
    console.log("[events-service] TODO: persistent indexing for proposal_created", event.value);
  }

  private handleProposalExecuted(event: ContractEvent): void {
    console.log("[events-service] TODO: persistent indexing for proposal_executed", event.value);
  }

  /**
   * Returns current service state for health monitoring.
   */
  public getStatus(): PollingState {
    return {
      lastLedgerPolled: this.lastLedgerPolled,
      isPolling: this.isRunning,
      errors: this.consecutiveErrors,
    };
  }
}
