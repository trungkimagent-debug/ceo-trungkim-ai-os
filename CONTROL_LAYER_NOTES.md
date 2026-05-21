# System Control Layer Notes

This branch is for a safe AI supervisor layer.

Scope:
- Read system health signals.
- Summarize operational status.
- Recommend next actions.
- Avoid direct destructive operations.

Planned modules:
- functions/src/systemSupervisor.ts
- /ai/system-status endpoint
- /ai/control-briefing endpoint

Safety:
- No production deploy from this branch until build passes.
- No change to Hosting artifact.
- No change to Firestore rules in this patch.
