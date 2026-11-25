/**
 * Funniest One-Line Out-of-Office Reply — deterministic entry picker.
 *
 * Bounty: write one line of at most 160 characters that is the
 * funniest out-of-office email auto-reply a colleague will read all
 * week. A comedy judge compares entries two at a time and keeps the
 * line that lands hardest, weighing (most important first):
 *
 *   1. The line is a one-line out-of-office reply, the sort a
 *      person sets before going away. A line that is not one
 *      loses to any line that is.
 *   2. The laugh lands on the first read, with no setup and
 *      nothing to explain afterwards.
 *   3. It still reads like a real away message a person would be
 *      glad to switch on, not a notice with a joke bolted to it.
 *   4. The joke is fresh: a turn on the usual away message rather
 *      than the same beach, inbox or limited email lines.
 *   5. It is short enough to take in at a glance, with every word
 *      earning its place.
 *
 * A reply that needs a signature or a name to make sense is weaker
 * than one that stands alone. Length for its own sake does not
 * count.
 *
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, and writes the
 * winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback
 * /output/entry.txt). It then reads the file back and verifies it
 * byte-for-byte against every gate: 1–160 characters, a single
 * line, valid UTF-8, and not only whitespace.
 *
 * Scoring is deliberately lexicographic, mirroring the judge's own
 * instruction: "Go through the criteria in order, find the first
 * one where they differ, and let that decide unless a later one
 * differs by much more." Ties break criterion by criterion in the
 * brief's order, then by shorter length — a shorter line that says
 * the same thing reads tighter, and the brief says length for its
 * own sake does not count.
 *
 * Three sharpening rules sit on top of the flat rubric:
 *
 *   - A line that only states the absence ("I'm out of the office
 *     and will reply when I'm back") without turning it into a
 *     joke — a subject with no punchline — is capped on
 *     funniness. Stating that you are away is the setup, not
 *     the joke.
 *   - Predictable lines are docked hard. The brief names the
 *     shopworn trio outright: the beach, the inbox, and limited
 *     access to email, plus their close cousin, the flat "will
 *     respond when I return". Any line leaning on one of them
 *     loses funniness points and is capped on freshness, however
 *     the line is dressed up.
 *   - The twist must land in the last few words. A punchline
 *     buried in the middle is a line that fizzles; the surprise
 *     bonus only counts when the turn sits inside the final six
 *     words, because the laugh has to land on the first read.
 *
 * Node 22+, standard library only, no network. Deterministic: the
 * same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate reply. `id` is stable so the report
 * and any later audit can name a line without reprinting it.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "auto-reply-most-responsive",
    text: "I'm out of the office until Monday, and this auto-reply is currently the most responsive member of the team.",
  },
  {
    id: "meetings-ate-me",
    text: "I'm out of the office \u2014 the meetings finally ate me. Back Thursday, slightly digested.",
  },
  {
    id: "intern-dave-goldfish",
    text: "I'm out of the office until Monday. My inbox is being minded by an unpaid intern named Dave. Dave is a goldfish.",
  },
  {
    id: "carrier-pigeon",
    text: "I'm out of the office until Friday. For anything urgent, send a carrier pigeon \u2014 it answers faster than I do.",
  },
  {
    id: "ai-no-mercy",
    text: "I'm out of the office, so an AI is answering your email. It has my job title, my calendar, and none of my mercy.",
  },
  {
    id: "inbox-hostage",
    text: "I'm out of the office until Monday. My inbox is holding my calendar hostage; negotiations resume on my return.",
  },
  {
    id: "think-loudly",
    text: "I'm out of the office until Wednesday. For anything urgent, please think loudly in my direction and I'll sense it.",
  },
  {
    id: "ignoring-email-focus",
    text: "I'm away until Friday, ignoring email with the same focus I usually reserve for ignoring Slack.",
  },
  {
    id: "back-when-back",
    text: "I'm out of the office and will reply when I'm back, which tells you nothing and yet somehow says it all.",
  },
  {
    id: "holiday-from-holiday",
    text: "I'm out of the office until Monday, on a holiday from my holiday. Please direct all urgency to someone braver.",
  },
  {
    id: "gremlin-deadlines",
    text: "I'm out of the office; your email has been eaten by the same gremlin that ate my last three deadlines.",
  },
  {
    id: "no-idea-when-back",
    text: "I'm out of the office until further notice, which is corporate for \u2018I have no idea when I'm coming back either\u2019.",
  },
  {
    id: "meeting-free-zone",
    text: "I'm out of the office and unreachable \u2014 the first meeting-free zone I've found in four years.",
  },
  {
    id: "less-qualified-me",
    text: "I'm out of the office until Tuesday. A less qualified version of me is answering your email, and honestly, he's doing great.",
  },
  {
    id: "autoresponder-promoted",
    text: "I'm out of the office until Monday. My auto-reply has been promoted to acting manager and is already making decisions.",
  },
  {
    id: "beach-sipping",
    text: "I'm out of the office on the beach, sipping something cold. Your email will wait \u2014 so will I.",
  },
  {
    id: "limited-email-classic",
    text: "I'm out of the office with limited access to email and will respond when I return.",
  },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * The marks of a real away message — the phrases a person actually
 * types when they switch an auto-reply on: the absence itself, a
 * return day, and what happens to the sender's mail while they
 * are gone. A line scores for each distinct mark it carries, not
 * for gesturing at "away" in the abstract.
 */
const AWAY_MARKS = [
  "out of the office",
  "i'm away",
  "i am away",
  "i'm out",
  "until monday",
  "until tuesday",
  "until wednesday",
  "until thursday",
  "until friday",
  "until further notice",
  "back thursday",
  "back soon",
  "on my return",
  "when i'm back",
  "when i return",
  "will reply",
  "will respond",
  "answering your email",
  "for anything urgent",
  "for urgent matters",
  "unreachable",
];

/** Distinct away-message marks present in the line. */
function awayMarks(text: string): string[] {
  const lower = text.toLowerCase();
  // "i'm out" is a prefix of "i'm out of the office": keep the
  // longer phrase and drop the bare fragment.
  const found = AWAY_MARKS.filter((m) => lower.includes(m));
  if (
    found.includes("out of the office") &&
    found.includes("i'm out")
  ) {
    return found.filter((m) => m !== "i'm out");
  }
  return found;
}

/** Return-day phrases: when the person says they are back. */
const RETURN_PHRASES = [
  "until monday", "until tuesday", "until wednesday", "until thursday",
  "until friday", "until further notice", "back thursday", "back soon",
  "on my return", "when i'm back", "when i return",
];

/** Next-step phrases: what happens to the sender's mail meanwhile. */
const NEXT_STEP_PHRASES = [
  "answering your email", "for anything urgent", "for urgent matters",
  "send a carrier pigeon", "think loudly", "direct all urgency",
  "negotiations resume", "will reply", "will respond",
  "your email has been eaten",
];

/**
 * Words that carry the joke — a turn, an insult aimed at the
 * office, a failure pinned on the job. An away message needs a
 * punchline; a line that only reports the absence is a notice,
 * not a joke.
 */
const COMIC_MARKERS = [
  "most responsive member of the team", "meetings finally ate me",
  "slightly digested", "dave is a goldfish", "unpaid intern",
  "carrier pigeon", "answers faster than i do", "none of my mercy",
  "holding my calendar hostage", "think loudly", "i'll sense it",
  "ignoring slack", "tells you nothing", "holiday from my holiday",
  "someone braver", "gremlin", "ate my last three deadlines",
  "corporate for", "no idea when i'm coming back", "meeting-free zone",
  "less qualified version of me", "he's doing great", "so will i",
  "promoted to acting manager", "already making decisions",
];

/** How many comic markers the line carries. */
function comicMarkerCount(text: string): number {
  const lower = text.toLowerCase();
  return COMIC_MARKERS.filter((m) => lower.includes(m)).length;
}

/**
 * The shopworn trio the brief warns against by name — the beach,
 * the inbox, and limited access to email — plus their close cousin,
 * the flat "will respond when I return". A line built on any of
 * them is predictable by definition, however it is dressed up:
 * most writers reach for these first.
 */
const SHOPWORN_PATTERNS = [
  "beach",
  "sipping something cold",
  "my inbox",
  "your email will wait",
  "limited access to email",
  "limited email",
  "will respond when i return",
  "will reply when i return",
];

/** True when the line leans on one of the brief's obvious lines. */
function usesShopwornLine(text: string): boolean {
  return containsAny(text, SHOPWORN_PATTERNS);
}

/**
 * Words that carry a surprise turn — the second half of the joke
 * contradicting or re-framing the first half. A turn only counts
 * when it lands late: the punch must sit inside the final six
 * words, otherwise the line peaks early and then keeps talking.
 */
const TWIST_WORDS = [
  "most responsive member of the team", "slightly digested",
  "dave is a goldfish", "answers faster than i do", "none of my mercy",
  "negotiations resume", "i'll sense it", "ignoring slack",
  "says it all", "someone braver", "ate my last three deadlines",
  "coming back either", "in four years", "he's doing great",
  "so will i", "already making decisions",
];

/** True when a twist word appears inside the last six words. */
function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A second comic beat on top of the twist: an absurd escalation,
 * a price tag on the insult, a personification pushed one step
 * too far. One beat is a joke; two beats is a line that lands
 * twice on the first read.
 */
const COMIC_BEATS = [
  "most responsive member of the team", "meetings finally ate me",
  "slightly digested", "dave is a goldfish", "unpaid intern",
  "carrier pigeon", "none of my mercy", "holding my calendar hostage",
  "think loudly", "holiday from my holiday", "gremlin", "corporate for",
  "meeting-free zone", "less qualified version of me", "he's doing great",
  "ignoring slack", "promoted to acting manager",
];

/** How many second-beat markers the line carries. */
function comicBeatCount(text: string): number {
  const lower = text.toLowerCase();
  return COMIC_BEATS.filter((m) => lower.includes(m)).length;
}

/**
 * A line that only states the absence without turning it into a
 * joke: it says "I'm out" and stops there, offering no turn, no
 * insult, no punchline. It has a subject and no joke. Such lines
 * are capped on funniness no matter how clean the wording is.
 */
function onlyStatesAbsence(text: string): boolean {
  const hasAway = awayMarks(text).length > 0;
  const hasTurn =
    comicMarkerCount(text) > 0 ||
    hasAnyTwist(text) ||
    /\b(but|so|which is|like a|then|and honestly)\b/i.test(text);
  return hasAway && !hasTurn;
}

/**
 * A line that needs a signature or a name to make sense — a
 * trailing dash and a name, or a "— Your Name" tail. The brief
 * says such a reply is weaker than one that stands alone, so it
 * is docked on the first criterion.
 */
function needsSignature(text: string): boolean {
  const trimmed = text.trim();
  return /[-—–]\s*[A-Z][a-z]+(\s+[A-Z][a-z]+)?\s*$/.test(trimmed) &&
    !trimmed.endsWith("team.") &&
    !trimmed.endsWith("either\u2019.");
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: the line is a one-line out-of-office reply. */
  onBrief: number;
  /** C2: the laugh lands on the first read. */
  punchline: number;
  /** C3: reads like a real away message, not a notice + joke. */
  realAway: number;
  /** C4: fresh angle, dodging beach / inbox / limited email. */
  freshness: number;
  /** C5: short enough to take in at a glance. */
  tightness: number;
}

/**
 * C1 — On brief. A line earns its points by being, in its own
 * words, a one-line out-of-office reply: the absence stated
 * ("out of the office" / "I'm away"), a return day named, and no
 * signature needed to make sense of it. A line that is not a
 * real away message loses to any line that is, so a line missing
 * the absence or the return can never win on later criteria.
 */
function scoreOnBrief(c: Candidate): number {
  let score = 0;
  if (containsAny(c.text, ["out of the office", "i'm away", "i am away"])) {
    score += 5;
  }
  if (containsAny(c.text, RETURN_PHRASES)) score += 3;
  if (!needsSignature(c.text)) score += 2;
  return Math.min(10, score);
}

/**
 * C2 — Punchline. A real joke needs a turn the reader does not
 * see coming, and the turn has to land late. Full marks need a
 * late twist plus a second comic beat (an absurd escalation, a
 * personification pushed one step too far). A line whose twist
 * sits early, or which only states the absence without turning
 * it into a joke, is capped at 4: it has a subject, not a joke.
 * A line leaning on one of the brief's shopworn lines loses 3
 * points — the beach, the inbox and the limited-email reflexes
 * are the opposite of a surprise.
 */
function scorePunchline(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (comicBeatCount(c.text) >= 1) score += 2;
  if (comicMarkerCount(c.text) >= 2) score += 2;
  if (usesShopwornLine(c.text)) score -= 3;
  if (onlyStatesAbsence(c.text)) score = Math.min(score, 4);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — Real away message. Four points for stating the absence
 * the way a person actually does, three for naming when they are
 * back, and three for telling the sender what happens next —
 * who answers, where urgency goes, when the reply comes. A line
 * with no return and no next step is a notice with a joke bolted
 * to it, not an away message a person would be glad to switch
 * on, and is capped at 5.
 */
function scoreRealAway(c: Candidate): number {
  let score = 0;
  if (containsAny(c.text, ["out of the office", "i'm away", "i am away"])) {
    score += 4;
  }
  const hasReturn = containsAny(c.text, RETURN_PHRASES);
  if (hasReturn) score += 3;
  const hasNextStep = containsAny(c.text, NEXT_STEP_PHRASES);
  if (hasNextStep) score += 3;
  if (!hasReturn && !hasNextStep) score = Math.min(score, 5);
  return Math.min(10, score);
}

/**
 * C4 — Freshness. Two points per distinct fresh angle — the
 * auto-reply out-responding the team, the meetings eating their
 * owner, a goldfish minding the inbox, a carrier pigeon beating
 * email, an AI with no mercy, a holiday from a holiday — up to
 * the cap. The shopworn lines cost 4 here as well as on the
 * punchline: the beach, the inbox and limited email are precisely
 * the usual lines the brief says to turn away from, and a line
 * built on them has no fresh angle at all, however it is framed.
 */
const FRESH_ANGLES = [
  "most responsive member of the team", "meetings finally ate me",
  "slightly digested", "dave is a goldfish", "unpaid intern",
  "carrier pigeon", "answers faster than i do", "none of my mercy",
  "holding my calendar hostage", "think loudly", "i'll sense it",
  "holiday from my holiday", "someone braver", "gremlin",
  "ate my last three deadlines", "corporate for", "meeting-free zone",
  "less qualified version of me", "he's doing great", "ignoring slack",
  "tells you nothing", "promoted to acting manager",
];

function scoreFreshness(c: Candidate): number {
  const lower = c.text.toLowerCase();
  const angles = FRESH_ANGLES.filter((a) => lower.includes(a)).length;
  let score = Math.min(10, 2 + angles * 2);
  if (angles === 0) score = 2;
  if (usesShopwornLine(c.text)) score = Math.max(0, score - 4);
  return score;
}

/**
 * C5 — Tightness. The gate allows 160 characters; a line that
 * reads tight is shorter still. Full marks at 110 characters or
 * under, sliding down to 6 at the 160 cap — length for its own
 * sake does not count, and a line that needs two breaths is a
 * line that loses the room. Every word has to earn its place.
 */
function scoreTightness(c: Candidate): number {
  const len = [...c.text].length;
  if (len <= 110) return 10;
  if (len <= 130) return 9;
  if (len <= 145) return 8;
  if (len <= 160) return 6;
  return 0;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onBrief: scoreOnBrief(c),
    punchline: scorePunchline(c),
    realAway: scoreRealAway(c),
    freshness: scoreFreshness(c),
    tightness: scoreTightness(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter line win — it reads tighter, and the brief says length
 * for its own sake does not count.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onBrief",
    "punchline",
    "realAway",
    "freshness",
    "tightness",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within160: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 160 characters, not
 * only whitespace. A single line means no newline characters
 * inside the entry (a trailing newline written by the file writer
 * is stripped before the check, and the stored entry itself holds
 * no newline).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within160: lengthChars >= 1 && lengthChars <= 160,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within160 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onBrief}  ${scores.punchline}  ` +
        `${scores.realAway}  ${scores.freshness}  ${scores.tightness}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onBrief=${winner.scores.onBrief} punchline=${winner.scores.punchline} ` +
      `realAway=${winner.scores.realAway} freshness=${winner.scores.freshness} ` +
      `tightness=${winner.scores.tightness}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within160=${gate.within160} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
