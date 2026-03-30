# Pull Request: Event Deduplication

**Issue:** #569

## Description

Implements event deduplication in EventPollingService to prevent duplicate processing when the RPC returns overlapping ledger ranges across consecutive polls. This can occur due to cursor drift and would cause the same event to be processed and persisted twice, leading to duplicate records in ProposalActivityAggregator.

## Changes

### Modified Files
- `backend/src/modules/events/events.service.ts` - Added deduplication logic
- `backend/src/modules/events/events.service.test.ts` - Added comprehensive tests

## Features

✅ **Event ID Tracking**
- Maintains bounded set of processed event IDs (max 1000)
- O(1) duplicate detection using Set
- FIFO eviction when set reaches capacity
- Cleared on service restart for fresh session

✅ **Deduplication Logic**
- Checks event ID before processing
- Skips duplicate events (no forwarding to consumers)
- Prevents WebSocket broadcast for duplicates
- Prevents storage persistence for duplicates

✅ **Observability**
- Debug logging for duplicate detection
- Logs include event ID, topic, and ledger number
- Summary logging after batch processing
- Warning logs on set overflow

## Testing

### Unit Tests (6)
- ✅ processedEventIds set is cleared on start()
- ✅ processedEventIds maintains bounded size (max 1000)
- ✅ Duplicate events are skipped
- ✅ New events are added to processedEventIds
- ✅ FIFO eviction removes oldest entry when set is full
- ✅ Batch processing summary logged

### Property-Based Tests (6)
- ✅ Property 1: Duplicate Detection - duplicate events are skipped
- ✅ Property 2: Event ID Tracking - all event IDs are tracked
- ✅ Property 3: Bounded Set Maintenance - set never exceeds max size
- ✅ Property 4: Duplicate Logging - duplicates are logged with context
- ✅ Property 5: Set Cleared on Restart - processedEventIds cleared on start()
- ✅ Property 6: Overlapping Range Deduplication - events in overlaps are deduplicated

**Test Results:** 31/31 passing ✅

## Correctness Properties

1. **Duplicate Detection** - *For any* batch of events where some events have duplicate IDs, the service SHALL skip processing for events whose IDs have already been processed in the current session.

2. **Event ID Tracking** - *For any* event processed by handleBatch, its ID SHALL be added to the processedEventIds set before processing.

3. **Bounded Set Maintenance** - *For any* processedEventIds set, when the size exceeds the maximum (1000), the oldest entry SHALL be removed to maintain bounded memory.

4. **Duplicate Logging** - *For any* duplicate event detected, a debug log message SHALL be recorded including the event ID, topic, and ledger number.

5. **Set Cleared on Restart** - *For any* EventPollingService instance, when start() is called, the processedEventIds set SHALL be cleared to allow fresh processing.

6. **Overlapping Range Deduplication** - *For any* two consecutive polls with overlapping ledger ranges, events in the overlap SHALL be deduplicated (processed only once).

## Requirements Addressed

- ✅ Requirement 1: Event ID Tracking
- ✅ Requirement 2: Duplicate Detection and Skipping
- ✅ Requirement 3: Logging and Observability
- ✅ Requirement 4: Correctness Under Overlapping Ranges

## Breaking Changes

None - This is a non-breaking enhancement that prevents data corruption.

## Performance Impact

- O(1) duplicate detection using Set
- Minimal memory overhead (bounded to 1000 entries)
- No performance regression
- Prevents duplicate processing overhead

## Deployment Notes

- Bounded set size (1000) is appropriate for typical polling intervals
- Can be made configurable via constant if needed
- No database migrations required
- No configuration changes required
- Session-scoped deduplication (cleared on restart)

## Related Issues

- Closes #569

## Checklist

- ✅ Code follows project style guidelines
- ✅ All tests passing (31/31)
- ✅ No TypeScript errors
- ✅ No breaking changes
- ✅ Documentation updated
- ✅ Specs created (.kiro/specs/event-deduplication/)

