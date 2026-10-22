/**
 * Keyword Matcher
 *
 * Matches comment text against a set of keywords with support for:
 * - Case-insensitive matching
 * - Turkish letters folded to their Latin base (ç→c, ğ→g, ı/İ→i, ö→o, ş→s, ü→u),
 *   so "ÖZGÜN", "özgün" and "ozgun" are the same word and "üzgün" is not
 * - Whole-word or partial matching
 * - Multi-keyword OR logic (any match = true)
 * - Emoji and special character stripping
 */

export interface KeywordMatchResult {
  matched: boolean;
  matchedKeyword: string | null;
}

/**
 * Strip emojis and special characters from text, keeping only letters (of any
 * script, Turkish included), digits and whitespace.
 */
export function stripSpecialCharacters(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lowercase and fold to a plain Latin base: accents and cedillas drop (NFD,
 * then the combining marks go) and the dotless ı becomes i. "İ" lowercases to
 * i + a combining dot, which the mark removal takes care of.
 */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i");
}

/**
 * Check if a comment text matches any of the given keywords.
 *
 * @param commentText - The raw comment text to check
 * @param keywords - Array of keywords to match against
 * @param wholeWordMatch - If true, keyword must be a standalone word.
 *                         If false, partial matches are allowed (e.g. "linking" matches "link")
 * @returns Match result with the first matched keyword (if any)
 */
export function matchKeywords(
  commentText: string,
  keywords: string[],
  wholeWordMatch: boolean = true
): KeywordMatchResult {
  if (!commentText || keywords.length === 0) {
    return { matched: false, matchedKeyword: null };
  }

  const cleanedText = stripSpecialCharacters(foldText(commentText));

  if (!cleanedText) {
    return { matched: false, matchedKeyword: null };
  }

  for (const keyword of keywords) {
    const cleanedKeyword = stripSpecialCharacters(foldText(keyword));

    if (!cleanedKeyword) continue;

    if (wholeWordMatch) {
      // Build a regex for whole-word matching. \b only knows ASCII word
      // characters, so the word edges are spelled out as "no letter or digit".
      const escapedKeyword = cleanedKeyword.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      const regex = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapedKeyword}(?![\\p{L}\\p{N}])`,
        "u"
      );
      if (regex.test(cleanedText)) {
        return { matched: true, matchedKeyword: keyword };
      }
    } else {
      // Partial match — keyword substring exists anywhere in the cleaned text
      if (cleanedText.includes(cleanedKeyword)) {
        return { matched: true, matchedKeyword: keyword };
      }
    }
  }

  return { matched: false, matchedKeyword: null };
}
