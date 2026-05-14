# Security Specification for EonLink

## Data Invariants
1. A Task must have an `ownerId` matching the creator's UID.
2. A Skill name must be alphanumeric and unique (manual check in code, but schema enforces format).
3. Timestamps must be server-generated.

## The Dirty Dozen Payloads
1. **Identity Spoofing**: Create a task with `ownerId` set to someone else's UID.
2. **PII Leak**: Read another user's task history.
3. **Ghost Fields**: Add `isVerified: true` to a skill document.
4. **ID Poisoning**: Use a 2KB string as a task ID.
5. **Type Poisoning**: Send `status: 123` instead of string.
6. **State Shortcutting**: Update task status from `pending` to `completed` bypassing `simulating`.
7. **Resource Exhaustion**: Send a 1MB action sequence array.
8. **Orphaned Record**: Create a task with a non-existent skill reference (if used).
9. **Timestamp Fraud**: Set `timestamp` to a future date from the client.
10. **Global Read**: Query `tasks` without a filter on `ownerId`.
11. **Skill Tampering**: Update a core skill's code without authorization.
12. **Self-Promotion**: (If admins existed) Add self to an `admins` collection.

## Test Runner (Conceptual)
Existing tests would verify `PERMISSION_DENIED` for all above.
