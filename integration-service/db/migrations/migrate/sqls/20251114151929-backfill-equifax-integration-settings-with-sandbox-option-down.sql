/* 
 * Down migration intentionally left empty
 * This is a backfill migration to ensure data consistency - rolling it back
 * would create inconsistent data states and we cannot distinguish between
 * records updated by this migration vs the original migration (20251014155313)
 */