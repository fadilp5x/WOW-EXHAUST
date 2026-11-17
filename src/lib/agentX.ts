import type {
  AgentXState,
  AnyScanReport,
  ProofOfScrub,
  ScanStatus,
} from '../types/forensics';

export type AgentXQuestionId =
  | 'what_found'
  | 'why_risky'
  | 'what_see'
  | 'how_remove'
  | 'safe_to_share';

export const AGENT_X_QUESTIONS: Array<{ id: AgentXQuestionId; label: string }> = [
  { id: 'what_found', label: 'What did you find?' },
  { id: 'why_risky', label: 'Why is this risky?' },
  { id: 'what_see', label: 'What can someone see?' },
  { id: 'how_remove', label: 'How do I remove it?' },
  { id: 'safe_to_share', label: 'Is my file safe to share?' },
];

export function deriveAgentXState(
  scanStatus: ScanStatus,
  report: AnyScanReport | null,
  isSpeaking: boolean
): AgentXState {
  if (isSpeaking) return 'EXPLAINING';
  if (scanStatus === 'processing') return 'SCANNING';
  if (scanStatus === 'revealing') return 'ANALYZING';
  if (scanStatus === 'waiting_ai') return 'ANALYZING';
  if (!report || scanStatus === 'idle' || scanStatus === 'ready') return 'STANDBY';

  const presentCount = report.findings.filter((f) => f.present).length;
  if (report.kind !== 'text' && report.risk.score >= 25 && presentCount > 0) {
    return 'FIX AVAILABLE';
  }
  if (presentCount > 0) return 'FINDING DETECTED';
  return 'COMPLETE';
}

export function buildAgentXPrimaryBriefing(
  report: AnyScanReport | null,
  proof?: ProofOfScrub | null
): string {
  if (proof) {
    const removedGps = proof.removedFields.some((f) =>
      f.toLowerCase().includes('gps')
    );
    if (removedGps) {
      return 'Verification complete. The cleaned file no longer contains the GPS metadata detected in the original.';
    }
    return `Verification complete. Exposure score moved from ${proof.originalScore} to ${proof.cleanedScore} after local re-encoding and re-inspection.`;
  }

  if (!report) {
    return 'Agent X standing by. Select a local image, PDF, or text sample to inspect embedded metadata on this device.';
  }

  if (report.kind === 'image') {
    if (report.gps) {
      return 'Agent X here. This image contains geographic coordinates. Anyone receiving the original file may be able to inspect them. I recommend removing location metadata before sharing.';
    }
    const presentCount = report.findings.filter((f) => f.present).length;
    if (presentCount === 0) {
      return 'No GPS metadata was detected. That is useful, but it does not mean the file contains no privacy-sensitive information inside the image itself.';
    }
    return `No GPS metadata was detected, which lowers location risk. However, ${presentCount} device or capture field(s) remain embedded. Review the findings before deciding what to remove.`;
  }

  if (report.kind === 'pdf') {
    const hasAuthor = report.findings.some((f) => f.id === 'pdf_author' && f.present);
    if (hasAuthor) {
      return 'This document includes an author field in its PDF Info dictionary. You can reduce that exposure by creating a verified metadata-clean copy.';
    }
    const presentCount = report.findings.filter((f) => f.present).length;
    if (presentCount === 0) {
      return 'Analysis complete. Standard PDF Info metadata appears minimal, though visible page contents should still be reviewed.';
    }
    return `Analysis complete. Detected ${presentCount} PDF document properties. Review the findings before deciding what to remove.`;
  }

  // Text
  if (report.tooShortForMetrics) {
    return 'This text snippet is short, so statistical style measures are limited. No personal identity is inferred from writing patterns.';
  }
  return 'Text analysis complete. These pattern distinctiveness scores describe formatting and phrasing tendencies only—they do not identify an author or prove AI use.';
}

export function answerAgentXQuestion(
  questionId: AgentXQuestionId,
  report: AnyScanReport | null,
  proof?: ProofOfScrub | null
): string {
  if (!report) {
    return 'No active scan yet. Choose a file, paste text, or click one of the Judge Live Samples first.';
  }

  const presentFindings = report.findings.filter((f) => f.present);

  if (questionId === 'what_found') {
    if (presentFindings.length === 0) {
      return 'The local parser found no tracked header metadata fields in this file.';
    }
    const names = presentFindings.map((f) => `${f.label} (${f.value})`).join('; ');
    return `Found ${presentFindings.length} item(s): ${names}.`;
  }

  if (questionId === 'why_risky') {
    if (report.kind === 'text') {
      return 'Writing measurements themselves are not an immediate privacy leak, though hidden smart quotes or non-breaking spaces can hint at copy-paste formatting origins. They cannot prove authorship.';
    }
    if (report.kind === 'image' && report.gps) {
      return 'Embedded GPS coordinates reveal the exact location recorded by the device when the photo was saved, and device/time fields add context when files are shared unmodified.';
    }
    if (presentFindings.length === 0) {
      return `Metadata exposure is LOW (${report.risk.score}/100). Remaining risk comes only from what is visibly shown inside the file content.`;
    }
    return `Exposure is ${report.risk.score}/100 (${report.risk.band}) because ${presentFindings.length} metadata tag(s) travel hidden inside the file container beyond what is visible on screen.`;
  }

  if (questionId === 'what_see') {
    if (report.kind === 'text') {
      return 'Recipients see the text itself, typographic characters (like curly quotes or non-breaking spaces), and general phrasing structure—nothing hidden outside the characters you entered.';
    }
    if (presentFindings.length === 0) {
      return 'Recipients inspecting standard EXIF or PDF Info headers will find NOT PRESENT for the tracked metadata fields.';
    }
    return `Anyone downloading the original unmodified file can read: ${presentFindings
      .map((f) => f.sourceTag)
      .join(', ')}.`;
  }

  if (questionId === 'how_remove') {
    if (report.kind === 'text') {
      return 'Use Copy Clean Text inside Findings to normalize smart quotes, non-breaking spaces, and irregular whitespace. Remember formatting normalization does not anonymize writing style.';
    }
    if (report.kind === 'image') {
      return 'Click CLEAN THIS FILE to re-encode pixel data onto a fresh local canvas without EXIF headers, then verify the re-scanned output score drops before sharing. If visible badges or text appear inside pixels, use the Visual Editor blur/crop tool.';
    }
    return 'Click CLEAN THIS FILE to rebuild pages into a fresh PDF without standard Info metadata, then review visible page text manually.';
  }

  // safe_to_share
  if (proof && proof.cleanedScore === 0) {
    return `The scrubbed copy verified at ${proof.cleanedScore}/100 metadata exposure (${proof.cleanedBand}). Still inspect visual content or page text manually before publishing.`;
  }
  if (report.kind === 'text') {
    return 'Text pattern distinctiveness is not a vulnerability score; review the message body itself to make sure you did not type private names, links, or secrets.';
  }
  if (report.risk.band === 'LOW') {
    return `Header exposure is LOW (${report.risk.score}/100 · PROTECTED). Do a quick visual check of the pixels/pages and you are in good shape.`;
  }
  return `Not yet recommended as-is (${report.risk.score}/100 · ${report.risk.band}). Run CLEAN THIS FILE first to strip embedded metadata and verify the cleaned output.`;
}
