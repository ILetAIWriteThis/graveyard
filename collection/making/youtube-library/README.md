# YouTube Library

## WHAT

A YouTube attention tracker that grew large enough to disprove its own premise. The user reports that it held about 1.3 million video records at one point. The supplied ZIP is an older backup, not that peak snapshot, but it still contains 1,194 channels and 214,888 videos.

The backup’s schema shows channels with categories, priorities, creation dates, and refresh timestamps. Videos have upload dates, durations, short-form flags, four states, progress, and a progress queue. This supports a picture of a substantial catalog with prioritization and viewing-state tracking. No application code, documentation, Git history, or license was supplied, so its interface, ingestion process, and implementation are unknown.

Anonymous totals from the older backup:

| Measure | Archive evidence |
| --- | ---: |
| Channels | 1,194 |
| Videos | 214,888 |
| Unwatched | 166,567 |
| In progress | 52 |
| Watched | 32,824 |
| Hidden | 15,445 |
| Remaining unwatched/in-progress duration | about 52,208 hours |
| Remaining duration at one hour per day | about 143 years |

The unwatched and in-progress records make up about 77.5% of this snapshot. Their known remaining duration is almost six years of continuous playback, or roughly a century even at about one hour and 26 minutes every day. The unavailable 1.3-million-record peak is user-supplied context; no duration estimate is invented for it.

## WHY

The biggest result was not a better queue. It was an eye-opening measure of how impossible the queue had become. The user stopped using the project after seeing how many lifetimes of unwatched material it represented and asking: what is the point?

That makes the project useful precisely because it ended. A system intended to organize abundance instead exposed attention debt: collecting a video creates an implied future commitment, while better ingestion can make an impossible commitment grow faster and look tidier.

The reusable mechanism is to translate a backlog into human time before optimizing it. Show years at a realistic daily viewing budget, distinguish selected material from an automatically accumulated feed, and make hiding, expiry, sampling, or deletion first-class actions. A future tool should help decide what not to watch rather than aspire to complete coverage.

## What was tried

The populated backup is evidence that a large dataset was assembled and maintained. It records channel categorization and priority, refresh metadata, video duration and format, and a state machine of `unwatched`, `in_progress`, `watched`, and `hidden`. The 52 in-progress records also have progress-queue values, although only one record has non-zero numeric progress, so the precise progress workflow cannot be reconstructed from data alone.

There is evidence of real scale and state assignment, but not of how those values were produced. Watched status may have been imported, changed through the application, or both. No source was available to verify API behavior, scheduling, deduplication, or user-interface claims.

## Limitations

The archive contains app data, not source. Its two JSON files are approximately 307 KiB and 83 MiB, with channel identities, video titles, categories, and viewing state. They are private, exceed the collection’s per-file limit, and are deliberately not preserved or published.

This older snapshot is internally imperfect: 25,589 videos have zero or negative recorded duration, overwhelmingly among watched records, and 25,486 video records refer to channel IDs absent from the channel export. Only 68 unwatched records lack a positive duration, so the archive’s unwatched-time total is nearly complete, but it remains a snapshot calculation rather than a promise of exact lifetime cost.

The project directory was not a Git repository. No implementation, requirements, license, or evidence explaining the difference between this backup and the reported 1.3-million-record peak was available. Individual channel and video records were inspected only through structure and anonymous aggregates. The collected material was never executed.

If credentials previously existed elsewhere for this project, they were not included in the archive. They should be revoked or rotated before reuse if their exposure cannot be ruled out.

## Revival condition

Dig it up only for a bounded, deletion-first experiment: define an attention budget, show the cost before adding an item, and retain a video because it serves a current purpose—not because an API can find it.

## Nearby graves

[Problem Space](../problem-space/README.md) suggests a stricter filter than a standalone library. A video could be retained only when it supports an active problem as evidence or context; the problem supplies a reason to keep it and a reason to discard everything else. This connection is the caretaker’s proposal.

## Provenance

The user supplied the local project directory for burial on 2026-09-13, then added an older backup dated 2026-05-27. The user reports that the live collection reached about 1.3 million records and that confronting the unwatched lifetime was why they stopped using it. Those statements are preserved as user context and distinguished from the older backup’s measured totals.

The caretaker listed and integrity-checked the ZIP before extracting its two regular JSON files into a temporary directory. There were no traversal paths or symlinks. Static inspection validated the schemas and computed only anonymous aggregates; no titles, channel identities, categories, URLs, credentials, or individual viewing records were copied into this repository. The archive and extracted app data are omitted by design, and no collected code was available or executed.
