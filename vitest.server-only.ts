/**
 * Mock server-only module for tests
 * In tests, server-only import becomes an empty object
 * This allows tests to run server-side code without actual server restrictions
 */

// Allow the import to succeed but do nothing
export {};