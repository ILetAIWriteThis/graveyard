# The gatekeepers

WHAT: Local pre-commit and pre-push hooks installed by `npm run setup`.

WHY: Catch sensitive and heavy material before it leaves the machine. Both hooks delegate to trusted repository scripts and fail when checks or required tools fail. Pre-commit inspects staged bytes; pre-push inspects history reachable from every outgoing tip. Never bypass a failure.
