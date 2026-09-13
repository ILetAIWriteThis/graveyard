# YouTube Library

## WHAT

An empty project shell named `youtube-library`. At intake it contained no regular files, source code, database, archive, symlink, documentation, Git metadata, or generated output. Its only contents were two empty directories: one for data and one whose name resembled a Google OAuth client-credential filename. The credential-like name is deliberately not reproduced here.

The narrowest defensible interpretation is an intention to make some kind of YouTube library with separate places for authentication material and application data. No supplied material explains what “library” meant, who it was for, how it would work, or why it stopped. There is no implementation evidence and no evidence of real use.

This record comes from static inspection of the supplied directory. The collected app was not executed; there was nothing executable to preserve.

## WHY

Caretaker interpretation: a personal video library could solve a more durable problem than “save this for later” by recording why a video matters, which topic or problem it informs, and what was learned from it. That framing was not recovered from project source; it is a possible direction suggested by the name alone.

No reusable code survived. The reusable lesson is a boundary: OAuth credentials and private account data should remain outside preserved source, while durable, non-sensitive annotations can be represented as reviewed text. A future version should begin by naming the smallest useful record—perhaps a public video URL, a reason for saving it, topics, and notes—before choosing an API, database, or synchronization mechanism.

## What was tried

Only directory setup is evident. Empty data and credential-named directories may indicate preparation for local state and OAuth, but they do not demonstrate that authentication, ingestion, storage, or a user interface was implemented. Their original purpose is unknown.

## Limitations

There was no Git history to compare and no working-tree snapshot beyond the two empty directories. Consequently, the original requirements, language, architecture, license, completion level, and cause of abandonment are all unknown. This burial preserves no source files because the supplied location had none.

If credentials previously existed elsewhere for this project, they were not available for inspection here. They should be revoked or rotated before reuse if their exposure cannot be ruled out.

## Revival condition

Dig it up when a real collection of videos needs context that YouTube’s own lists do not retain, and when the first useful workflow can be tested without copying watch history, tokens, or other private account data into the repository.

## Nearby graves

[Problem Space](../problem-space/README.md) offers a possible home for the reason a video was saved: a selected video could support a problem node as evidence or context, rather than becoming one more item in a flat backlog. This connection is the caretaker’s proposal, not recovered project intent.

## Provenance

The user supplied the local project directory for burial on 2026-09-13 and specifically asked that secrets, databases, and real app data be ignored. Static inventory found no such files and no source code—only the empty directories described above. No contents were copied from the source. The title comes from the directory name; all proposed uses are caretaker interpretation.
