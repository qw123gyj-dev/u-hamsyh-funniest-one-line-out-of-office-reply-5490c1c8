[![make.fun](https://make.fun/badge/u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8.svg)](https://make.fun/bounty/u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8?utm_source=github&utm_medium=readme&utm_campaign=u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8)
[![rank](https://make.fun/badge/u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8/qw123gyj-dev/u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8/rank.svg)](https://make.fun/bounty/u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8)
[![reward](https://make.fun/badge/u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8/qw123gyj-dev/u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8/reward.svg)](https://make.fun/bounty/u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8?utm_source=github&utm_medium=readme&utm_campaign=u-hamsyh-funniest-one-line-out-of-office-reply-5490c1c8)

# Funniest One-Line Out-of-Office Reply

A deterministic entry picker for the make.fun bounty "Funniest One-Line Out-of-Office Reply". `main.ts` scores 17 hand-written candidate one-liners against the judge's brief — in the brief's own order: a one-line out-of-office reply, the sort a person sets before going away; a punchline that lands on the first read, with no setup and nothing to explain afterwards; a line that still reads like a real away message a person would be glad to switch on, not a notice with a joke bolted to it; a fresh turn on the usual away message rather than the same beach, inbox or limited email lines; and wording short enough to take in at a glance, with every word earning its place — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–160 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only states the absence without turning it into a joke is capped, the shopworn beach, inbox and limited-email lines are docked hard, the twist must land inside the last six words, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> I'm out of the office until Friday. For anything urgent, send a carrier pigeon — it answers faster than I do.

It reads exactly like a real away message — out until Friday, with an instruction for anything urgent — and the punchline turns the usual "contact someone else" instruction into a carrier pigeon that answers faster than its owner ever did.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/ooo-out node main.ts
cat /tmp/ooo-out/entry.txt
```
