/**
 * reviewContentFilter — a first-pass screen for objectionable review text (App Store guideline 1.2).
 * A match holds the review back for an admin instead of publishing it; admins can publish it from the
 * Hidden tab if the match was wrong. Whole-word so "Scunthorpe"-style substrings don't trip it.
 */
const BLOCKED_TERMS = [
  'asshole',
  'bastard',
  'bitch',
  'bullshit',
  'cunt',
  'dickhead',
  'fuck',
  'fucked',
  'fucker',
  'fucking',
  'motherfucker',
  'nigger',
  'porn',
  'pussy',
  'rape',
  'shit',
  'slut',
  'whore',
];

const BLOCKED_PATTERN = new RegExp(`\\b(${BLOCKED_TERMS.join('|')})\\b`, 'i');

export function containsObjectionableText(...texts: unknown[]): boolean {
  return texts.some((text) => typeof text === 'string' && BLOCKED_PATTERN.test(text));
}
