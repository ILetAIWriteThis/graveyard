# A pocket inventory

## WHAT

A small Node script that prints a Markdown list of relative file names and sizes. It reads directory entries and file metadata, not contents. It skips symlinks and common dependency/build directories, stops after 500 files, and limits descent to six levels.

```sh
node inventory.mjs /path/to/a/project
```

The [source](inventory.mjs) uses only Node built-ins and writes to stdout. Redirect the output yourself if you want to keep it. No files are changed.

## WHY

Sometimes an entire project is too large to preserve, but its shape explains what was attempted. An inventory helps choose which source files deserve a burial.

## Limitations

Names can reveal private information even when contents are never read. Review the output before saving it. Permission errors are reported as skipped entries, and truncation is explicit. This is an inventory, not a backup, secret scanner, or license audit.
