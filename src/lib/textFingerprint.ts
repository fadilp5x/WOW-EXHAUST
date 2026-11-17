import type {
  ForensicFinding,
  TextMetrics,
  TextScanReport,
} from '../types/forensics';

const FUNCTION_WORDS = new Set([
  'the',
  'and',
  'of',
  'to',
  'a',
  'in',
  'that',
  'is',
  'was',
  'for',
  'it',
  'with',
  'as',
  'on',
  'by',
  'this',
  'be',
  'are',
  'or',
  'from',
  'at',
  'not',
  'but',
  'which',
  'have',
  'an',
  'they',
  'we',
  'you',
]);

export function normalizeTextCopy(input: string): {
  normalizedText: string;
  changes: string[];
} {
  let out = input;
  const changes: string[] = [];

  const smartDouble = /[\u201C\u201D\u201E\u201F]/g;
  const smartSingle = /[\u2018\u2019\u201A\u201B]/g;
  if (smartDouble.test(out) || smartSingle.test(out)) {
    out = out.replace(smartDouble, '"').replace(smartSingle, "'");
    changes.push('Converted typographic smart quotes to standard ASCII quotes');
  }

  const nbsp = /\u00A0/g;
  if (nbsp.test(out)) {
    out = out.replace(nbsp, ' ');
    changes.push('Replaced non-breaking spaces (U+00A0) with standard spaces');
  }

  const zeroWidth = /[\u200B-\u200D\uFEFF]/g;
  if (zeroWidth.test(out)) {
    out = out.replace(zeroWidth, '');
    changes.push('Removed zero-width formatting characters');
  }

  const emDash = /[\u2013\u2014]/g;
  if (emDash.test(out)) {
    out = out.replace(emDash, '-');
    changes.push('Normalized typographic dashes to standard hyphens');
  }

  const multiSpaces = /[^\S\r\n]{2,}/g;
  if (multiSpaces.test(out)) {
    out = out.replace(multiSpaces, ' ');
    changes.push('Collapsed repeated inline whitespace');
  }

  const crlf = /\r\n/g;
  if (crlf.test(out)) {
    out = out.replace(crlf, '\n');
    changes.push('Normalized CRLF line endings to LF');
  }

  out = out.trim();
  return { normalizedText: out, changes };
}

export function computeTextMetrics(rawText: string): TextMetrics {
  const trimmed = rawText.trim();
  const paragraphs = trimmed
    ? trimmed.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
    : [];

  const sentences = trimmed
    ? trimmed
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  const words = trimmed.match(/[A-Za-z0-9\u00C0-\u024F']+/g) ?? [];
  const lowerWords = words.map((w) => w.toLowerCase());
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const paragraphCount = paragraphs.length;

  const sentenceLengths = sentences.map((s) => (s.match(/[A-Za-z0-9']+/g) ?? []).length);
  const meanSentenceLength =
    sentenceCount > 0
      ? Number(
          (
            sentenceLengths.reduce((acc, n) => acc + n, 0) / sentenceCount
          ).toFixed(2)
        )
      : 0;

  const sentenceLengthVariance =
    sentenceCount > 1
      ? Number(
          (
            sentenceLengths.reduce(
              (acc, n) => acc + Math.pow(n - meanSentenceLength, 2),
              0
            ) / sentenceCount
          ).toFixed(2)
        )
      : 0;

  const uniqueWords = new Set(lowerWords);
  const lexicalDiversity =
    wordCount > 0 ? Number((uniqueWords.size / wordCount).toFixed(3)) : 0;

  const funcCounts = new Map<string, number>();
  let totalFunctionWords = 0;
  for (const w of lowerWords) {
    if (FUNCTION_WORDS.has(w)) {
      totalFunctionWords += 1;
      funcCounts.set(w, (funcCounts.get(w) ?? 0) + 1);
    }
  }
  const functionWordRatio =
    wordCount > 0 ? Number((totalFunctionWords / wordCount).toFixed(3)) : 0;

  const topFunctionWords = Array.from(funcCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([word, count]) => ({ word, count }));

  const punctuationMatches = trimmed.match(/[.,;:!?—–\-()"']/g) ?? [];
  const punctuationPer100Words =
    wordCount > 0
      ? Number(((punctuationMatches.length / wordCount) * 100).toFixed(1))
      : 0;

  // Repeated 2-gram and 3-gram phrases (count >= 2)
  const phraseCounts = new Map<string, number>();
  for (let i = 0; i < lowerWords.length - 1; i++) {
    const bigram = `${lowerWords[i]} ${lowerWords[i + 1]}`;
    phraseCounts.set(bigram, (phraseCounts.get(bigram) ?? 0) + 1);
    if (i < lowerWords.length - 2) {
      const trigram = `${bigram} ${lowerWords[i + 2]}`;
      phraseCounts.set(trigram, (phraseCounts.get(trigram) ?? 0) + 1);
    }
  }
  const repeatedPhrases = Array.from(phraseCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 5)
    .map(([phrase, count]) => ({ phrase, count }));

  const paragraphWordCounts = paragraphs.map(
    (p) => (p.match(/[A-Za-z0-9']+/g) ?? []).length
  );
  const meanParagraphLength =
    paragraphCount > 0
      ? Number(
          (
            paragraphWordCounts.reduce((a, b) => a + b, 0) / paragraphCount
          ).toFixed(1)
        )
      : 0;

  const allCapsCount = words.filter(
    (w) => w.length >= 2 && w === w.toUpperCase() && /[A-Z]/.test(w)
  ).length;
  const titleCaseCount = words.filter(
    (w) => /^[A-Z][a-z]/.test(w)
  ).length;

  const allCapsWordRatio =
    wordCount > 0 ? Number((allCapsCount / wordCount).toFixed(3)) : 0;
  const titleCaseRatio =
    wordCount > 0 ? Number((titleCaseCount / wordCount).toFixed(3)) : 0;

  const smartQuoteCount = (rawText.match(/[\u201C\u201D\u2018\u2019]/g) ?? []).length;
  const nonBreakingSpaceCount = (rawText.match(/\u00A0/g) ?? []).length;
  const unusualWhitespaceCount = (rawText.match(/[\u200B-\u200D\uFEFF]|\s{2,}/g) ?? []).length;
  const emojiMatches = rawText.match(/\p{Extended_Pictographic}/gu) ?? [];
  const emojiCount = emojiMatches.length;

  return {
    wordCount,
    sentenceCount,
    paragraphCount,
    meanSentenceLength,
    sentenceLengthVariance,
    lexicalDiversity,
    functionWordRatio,
    topFunctionWords,
    punctuationPer100Words,
    repeatedPhrases,
    meanParagraphLength,
    allCapsWordRatio,
    titleCaseRatio,
    smartQuoteCount,
    nonBreakingSpaceCount,
    unusualWhitespaceCount,
    emojiCount,
  };
}

export function analyzeText(
  rawText: string,
  options?: { sourceLabel?: string; isSample?: boolean; sampleLabel?: string }
): TextScanReport {
  const metrics = computeTextMetrics(rawText);
  const { normalizedText, changes } = normalizeTextCopy(rawText);

  // Descriptive Writing Pattern Strength Index (0-100):
  // Reflects statistical density & stylistic distinctiveness of measurements, NOT authorship or AI probability.
  const lengthFactor = Math.min(30, Math.round((metrics.wordCount / 150) * 30));
  const varianceFactor = Math.min(20, Math.round(Math.sqrt(metrics.sentenceLengthVariance) * 2.5));
  const diversityFactor = Math.round(metrics.lexicalDiversity * 25);
  const formattingSignals =
    (metrics.smartQuoteCount > 0 ? 8 : 0) +
    (metrics.nonBreakingSpaceCount > 0 ? 7 : 0) +
    (metrics.repeatedPhrases.length > 0 ? 10 : 0);

  const patternStrengthIndex =
    metrics.wordCount === 0
      ? 0
      : Math.min(100, Math.max(5, lengthFactor + varianceFactor + diversityFactor + formattingSignals));

  const tooShortForMetrics = metrics.wordCount < 15;

  const patternBand =
    metrics.wordCount === 0
      ? 'EMPTY INPUT'
      : tooShortForMetrics
        ? 'LIMITED SAMPLE (<15 WORDS)'
        : patternStrengthIndex >= 70
          ? 'HIGHLY DISTINCTIVE'
          : patternStrengthIndex >= 40
            ? 'MODERATELY DISTINCTIVE'
            : 'SUBTLE PATTERN';

  const findings: ForensicFinding[] = [
    {
      id: 'text_sentence_rhythm',
      category: 'STYLE',
      label: 'Sentence Length & Variance',
      value: `${metrics.meanSentenceLength} words avg (var ${metrics.sentenceLengthVariance})`,
      present: metrics.sentenceCount > 0,
      sourceTag: 'Text / Sentence Rhythm',
      explanation:
        'Measures how many words you typically use per sentence and how much sentence lengths vary.',
    },
    {
      id: 'text_lexical',
      category: 'STYLE',
      label: 'Vocabulary Variety & Common Words',
      value: `TTR ${metrics.lexicalDiversity} · Connecting words ${Math.round(metrics.functionWordRatio * 100)}%`,
      present: metrics.wordCount > 0,
      sourceTag: 'Text / Lexical & Function Words',
      explanation:
        'Compares unique words to total words (sensitive to text length) and measures common connecting words.',
    },
    {
      id: 'text_formatting',
      category: 'STYLE',
      label: 'Typography & Whitespace Signals',
      value:
        metrics.smartQuoteCount + metrics.nonBreakingSpaceCount + metrics.unusualWhitespaceCount > 0
          ? `${metrics.smartQuoteCount} smart quotes · ${metrics.nonBreakingSpaceCount} NBSP · ${metrics.unusualWhitespaceCount} irregular spaces`
          : 'Clean ASCII spacing (no irregular whitespace)',
      present:
        metrics.smartQuoteCount > 0 ||
        metrics.nonBreakingSpaceCount > 0 ||
        metrics.unusualWhitespaceCount > 0,
      sourceTag: 'Text / Unicode & Whitespace',
      explanation:
        'Typographic quotes, non-breaking spaces, and zero-width characters often travel over from desktop word processors.',
    },
    {
      id: 'text_phrases',
      category: 'STYLE',
      label: 'Repeated Word Patterns & Punctuation',
      value:
        metrics.repeatedPhrases.length > 0
          ? `${metrics.repeatedPhrases.map((p) => `"${p.phrase}" (${p.count}x)`).join(', ')} · ${metrics.punctuationPer100Words} punct/100w`
          : `No repeated n-grams · ${metrics.punctuationPer100Words} punct/100w`,
      present: metrics.repeatedPhrases.length > 0,
      sourceTag: 'Text / N-Gram & Punctuation',
      explanation:
        'Tracks short word sequences that repeat and overall punctuation density.',
    },
  ];

  return {
    kind: 'text',
    id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sourceLabel: options?.sourceLabel ?? 'Pasted Text Input',
    charCount: rawText.length,
    tooShortForMetrics,
    isSample: Boolean(options?.isSample),
    sampleLabel: options?.sampleLabel,
    metrics,
    patternStrengthIndex,
    patternBand,
    interpretationNotice: tooShortForMetrics
      ? 'This sample has fewer than 15 words, so statistical pattern measures are unreliable. These measurements do not prove authorship, identity, or AI use.'
      : 'These measurements describe patterns in this text. They do not prove authorship, identity, or AI use.',
    normalizedText,
    normalizationChanges: changes,
    findings,
    fieldsFound: {
      sentence_rhythm: metrics.sentenceCount > 0,
      lexical_profile: metrics.wordCount > 0,
      formatting_signals:
        metrics.smartQuoteCount > 0 ||
        metrics.nonBreakingSpaceCount > 0 ||
        metrics.unusualWhitespaceCount > 0,
      repeated_phrases: metrics.repeatedPhrases.length > 0,
    },
    scannedAt: new Date().toISOString(),
  };
}
