import type { AnyScanReport, Deduction } from '../types/forensics';

export interface MinimizedFindingsPayload {
  fileType: 'image' | 'pdf' | 'text';
  riskScore: number;
  band: string;
  findings: Array<{
    findingId: string;
    category: string;
    label: string;
    sourceTag: string;
    present: boolean;
    // Notice: NEVER include raw GPS coordinates or raw document body/filenames if sensitive
    redactedSummary: string;
  }>;
}

export function buildMinimizedFindings(report: AnyScanReport): MinimizedFindingsPayload {
  if (report.kind === 'image') {
    return {
      fileType: 'image',
      riskScore: report.risk.score,
      band: report.risk.band,
      findings: report.findings
        .filter((f) => f.present)
        .map((f) => ({
          findingId: f.id,
          category: f.category,
          label: f.label,
          sourceTag: f.sourceTag,
          present: f.present,
          redactedSummary:
            f.id === 'where_gps'
              ? 'Geographic coordinates present in EXIF GPS IFD (exact coordinates withheld from remote AI).'
              : f.value,
        })),
    };
  }

  if (report.kind === 'pdf') {
    return {
      fileType: 'pdf',
      riskScore: report.risk.score,
      band: report.risk.band,
      findings: report.findings
        .filter((f) => f.present)
        .map((f) => ({
          findingId: f.id,
          category: f.category,
          label: f.label,
          sourceTag: f.sourceTag,
          present: f.present,
          redactedSummary: f.value,
        })),
    };
  }

  return {
    fileType: 'text',
    riskScore: report.patternStrengthIndex,
    band: report.patternBand,
    findings: report.findings
      .filter((f) => f.present)
      .map((f) => ({
        findingId: f.id,
        category: f.category,
        label: f.label,
        sourceTag: f.sourceTag,
        present: f.present,
        redactedSummary: f.value,
      })),
  };
}

export function buildDeterministicDeductions(report: AnyScanReport): Deduction[] {
  const deductions: Deduction[] = [];

  if (report.kind === 'image') {
    for (const f of report.findings) {
      if (!f.present) continue;
      if (f.id === 'where_gps') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: 'GPS coordinates embedded in the image.',
          implication:
            'Someone receiving the original file may be able to retrieve those coordinates.',
          uncertainty:
            'Coordinates reflect device sensor lock at capture time and do not by themselves establish current location, home address, or identity.',
          mitigation: 'Download a metadata-cleaned copy and share that instead.',
          whatWeFound: 'GPS coordinates embedded in the image.',
          whatItMeans: 'The original file records a geographic point.',
          whyItMatters: 'Someone receiving the original file may be able to retrieve those coordinates.',
          howToFix: 'Download a metadata-cleaned copy and share that instead.',
          actionLabel: 'REMOVE LOCATION DATA',
          actionTarget: 'scrub_location',
          priorityRank: 1,
          source: 'deterministic',
        });
      } else if (f.id === 'device_serial') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `Camera or lens serial number recorded (${f.value}).`,
          implication:
            'Unstripped images containing the same serial number can be linked to the same physical camera body.',
          uncertainty:
            'A serial number links files to a device unit, not automatically to a named person without external records.',
          mitigation: 'Clean this file to strip EXIF SubIFD serial identifiers before sharing.',
          whatWeFound: 'Hardware serial number embedded in photo.',
          whatItMeans: `The file stores serial identifier ${f.value}.`,
          whyItMatters: 'Multiple unmodified photos can be linked back to the same physical device.',
          howToFix: 'Re-encode the image into a fresh scrubbed copy.',
          actionLabel: 'CLEAN THIS FILE',
          actionTarget: 'scrub_file',
          priorityRank: 2,
          source: 'deterministic',
        });
      } else if (f.id === 'owner_signals') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `Owner or copyright metadata embedded (${f.value}).`,
          implication:
            'Displays explicit name, handle, or copyright notice configured in the camera or editing software.',
          uncertainty:
            'Metadata strings are user-entered and may reflect a studio, template, or prior device owner.',
          mitigation: 'Clean this file to remove Artist, Creator, and Copyright fields.',
          whatWeFound: 'Creator or copyright label inside file.',
          whatItMeans: `The header lists "${f.value}" as artist or rights owner.`,
          whyItMatters: 'Anyone inspecting the file properties sees this attribution.',
          howToFix: 'Strip embedded EXIF and XMP ownership fields before publishing.',
          actionLabel: 'CLEAN THIS FILE',
          actionTarget: 'scrub_file',
          priorityRank: 3,
          source: 'deterministic',
        });
      } else if (f.id === 'when_capture') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `Exact capture date and time embedded (${f.value}).`,
          implication:
            'Recipients can observe the date and time reported by the capturing device.',
          uncertainty:
            'Device clocks can be misconfigured or timezone-shifted; timestamp alone does not verify location or activity.',
          mitigation: 'Clean this file locally to remove DateTimeOriginal before sharing.',
          whatWeFound: 'Exact shutter date and time.',
          whatItMeans: `The file records capture time ${f.value}.`,
          whyItMatters: 'Reveals a precise timeline when correlated with other posts or events.',
          howToFix: 'Create a metadata-cleaned copy using the local Scrubber.',
          actionLabel: 'CLEAN THIS FILE',
          actionTarget: 'scrub_file',
          priorityRank: 4,
          source: 'deterministic',
        });
      } else if (f.id === 'device_model') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `Camera make and model embedded (${f.value}).`,
          implication:
            'Discloses the camera or smartphone model used to take or save the photograph.',
          uncertainty:
            'Hardware model is shared across millions of identical devices and cannot identify an owner alone.',
          mitigation: 'Clean this file to remove EXIF device tags.',
          whatWeFound: 'Phone or camera model name.',
          whatItMeans: `The header identifies capture hardware as ${f.value}.`,
          whyItMatters: 'Narrows down the hardware ecosystem alongside other clues.',
          howToFix: 'Export a scrubbed copy before sharing publicly.',
          actionLabel: 'CLEAN THIS FILE',
          actionTarget: 'scrub_file',
          priorityRank: 5,
          source: 'deterministic',
        });
      } else if (f.id === 'software_trace') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `Processing software version embedded (${f.value}).`,
          implication:
            'Indicates the OS build or editing suite that exported the file.',
          uncertainty:
            'Does not confirm which specific visual edits were made.',
          mitigation: 'Scrubbing removes the Software tag during fresh canvas export.',
          whatWeFound: 'OS or editing app trace.',
          whatItMeans: `Recorded software string: ${f.value}.`,
          whyItMatters: 'Reveals your operating system version or desktop workflow.',
          howToFix: 'Re-encode the image into a fresh scrubbed copy.',
          actionLabel: 'CLEAN THIS FILE',
          actionTarget: 'scrub_file',
          priorityRank: 6,
          source: 'deterministic',
        });
      } else {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `${f.label}: ${f.value}`,
          implication: f.explanation,
          uncertainty: 'Reflects camera optical parameters recorded in file header.',
          mitigation: 'Re-encode image locally to strip optional EXIF parameters.',
          whatWeFound: f.label,
          whatItMeans: f.value,
          whyItMatters: f.explanation,
          howToFix: 'Re-encode image locally to remove EXIF headers.',
          actionLabel: 'CLEAN THIS FILE',
          actionTarget: 'scrub_file',
          priorityRank: 7,
          source: 'deterministic',
        });
      }
    }

    if (deductions.length === 0) {
      deductions.push({
        findingId: 'no_exif',
        evidenceField: 'EXIF / File Header',
        observation: 'No EXIF GPS, device, owner, or software metadata was detected.',
        implication:
          'Some messaging apps remove metadata when photos are shared. The original file on your device may contain different information.',
        uncertainty:
          'Absence of EXIF metadata does not protect against visual clues inside the pixels themselves.',
        mitigation: 'Review the visible image content before posting to public channels.',
        whatWeFound: 'No hidden EXIF metadata detected.',
        whatItMeans: 'Standard camera, GPS, and owner tags are not present in this file.',
        whyItMatters: 'Header leakage is low, though sensitive text or badges could still appear inside the image pixels.',
        howToFix: 'Inspect the image preview visually (or run opt-in Visual Inspection) before sharing.',
        actionLabel: 'REVIEW IMAGE CONTENT',
        actionTarget: 'review_visual',
        priorityRank: 10,
        source: 'deterministic',
      });
    }
    return deductions.sort((a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99));
  }

  if (report.kind === 'pdf') {
    for (const f of report.findings) {
      if (!f.present) continue;
      if (f.id === 'pdf_author') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `Document author metadata (${f.value}).`,
          implication:
            'This may reveal information the sender did not intend to publish.',
          uncertainty:
            'Author fields can be inherited from templates or shared workstations.',
          mitigation: 'Remove supported author metadata and verify the new file.',
          whatWeFound: 'Document author metadata.',
          whatItMeans: `The file contains an author field ("${f.value}").`,
          whyItMatters: 'This may reveal a personal name or computer account the sender did not intend to publish.',
          howToFix: 'Remove supported author metadata and verify the new file.',
          actionLabel: 'CLEAN DOCUMENT METADATA',
          actionTarget: 'scrub_document',
          priorityRank: 1,
          source: 'deterministic',
        });
      } else if (f.id === 'pdf_incremental') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `Structural scan found ${report.structuralFlags.incrementalUpdatesCount} %%EOF markers.`,
          implication:
            'Incremental PDF saves append new updates rather than rewriting earlier objects.',
          uncertainty:
            'Full revision history is not reconstructed from EOF counts alone.',
          mitigation: 'Rebuild pages into a fresh PDF container and verify remaining structures.',
          whatWeFound: 'Multiple incremental PDF save markers.',
          whatItMeans: `The byte stream contains ${report.structuralFlags.incrementalUpdatesCount} %%EOF trailers.`,
          whyItMatters: 'Appended updates can sometimes retain superseded objects in older PDF versions.',
          howToFix: 'Rebuild pages into a clean PDF copy and re-verify.',
          actionLabel: 'CLEAN DOCUMENT METADATA',
          actionTarget: 'scrub_document',
          priorityRank: 2,
          source: 'deterministic',
        });
      } else if (f.id === 'pdf_creator') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `Creator/Producer software details are present (${f.value}).`,
          implication:
            'Reveals the application and OS pipeline that generated the PDF.',
          uncertainty:
            'Software strings do not identify an individual.',
          mitigation: 'Strip Creator and Producer fields using PDF metadata reduction.',
          whatWeFound: 'Authoring software metadata.',
          whatItMeans: `The document lists ${f.value} as Creator/Producer.`,
          whyItMatters: 'Discloses what OS and word processor exported the PDF.',
          howToFix: 'Create a metadata-reduced PDF copy.',
          actionLabel: 'CLEAN DOCUMENT METADATA',
          actionTarget: 'scrub_document',
          priorityRank: 3,
          source: 'deterministic',
        });
      } else if (f.id === 'pdf_timestamps') {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `Document timestamps are embedded (${f.value}).`,
          implication:
            'Exposes when the PDF claims to have been created or last modified.',
          uncertainty:
            'Differing timestamps alone do not prove or reconstruct prior revision contents.',
          mitigation: 'Clear CreationDate and ModDate fields before distribution.',
          whatWeFound: 'Document creation and edit dates.',
          whatItMeans: `The Info header records ${f.value}.`,
          whyItMatters: 'Shows when the draft was originally created and last saved.',
          howToFix: 'Clean document metadata to strip Info timestamps.',
          actionLabel: 'CLEAN DOCUMENT METADATA',
          actionTarget: 'scrub_document',
          priorityRank: 4,
          source: 'deterministic',
        });
      } else {
        deductions.push({
          findingId: f.id,
          evidenceField: f.sourceTag,
          observation: `${f.label} metadata is present (${f.value}).`,
          implication: f.explanation,
          uncertainty: 'Metadata field reflects file header state at scan time.',
          mitigation: 'Use the PDF Scrubber to reduce header metadata.',
          whatWeFound: f.label,
          whatItMeans: `The PDF header contains "${f.value}".`,
          whyItMatters: f.explanation,
          howToFix: 'Clean document metadata before sharing.',
          actionLabel: 'CLEAN DOCUMENT METADATA',
          actionTarget: 'scrub_document',
          priorityRank: 5,
          source: 'deterministic',
        });
      }
    }

    if (deductions.length === 0) {
      deductions.push({
        findingId: 'pdf_clean_header',
        evidenceField: 'PDF Info Dictionary',
        observation: 'No Author, Creator, Producer, Keywords, or timestamp metadata was detected.',
        implication: 'Standard PDF header properties appear minimal.',
        uncertainty:
          'Visible page content, embedded images, or unsupported PDF structures should still be reviewed.',
        mitigation: 'Verify document pages visually before sharing.',
        whatWeFound: 'No tracked PDF Info metadata.',
        whatItMeans: 'Author, creator app, keywords, and timestamps were not present.',
        whyItMatters: 'Header exposure is low, though page text or attachments should still be checked.',
        howToFix: 'Review the rendered PDF pages in the preview before sending.',
        actionLabel: 'REVIEW DOCUMENT PAGES',
        actionTarget: 'none',
        priorityRank: 10,
        source: 'deterministic',
      });
    }
    return deductions.sort((a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99));
  }

  // Text report
  for (const f of report.findings) {
    if (!f.present) continue;
    const isFormatting = f.id === 'text_formatting';
    deductions.push({
      findingId: f.id,
      evidenceField: f.sourceTag,
      observation: `${f.label}: ${f.value}.`,
      implication: f.explanation,
      uncertainty:
        'These measurements describe patterns in this text. They do not prove authorship, identity, or AI use.',
      mitigation: isFormatting
        ? 'Use Copy Clean Text to normalize smart quotes, non-breaking spaces, and irregular whitespace.'
        : 'Note that text normalization adjusts formatting only and does not guarantee anonymity.',
      whatWeFound: isFormatting ? 'Rich-text formatting characters.' : f.label,
      whatItMeans: `${f.value}. ${f.explanation}`,
      whyItMatters: isFormatting
        ? 'Smart quotes and non-breaking spaces commonly carry over from word processors.'
        : 'Describes writing rhythm only — not a privacy leak or proof of identity.',
      howToFix: isFormatting
        ? 'Use Copy Clean Text to convert formatting to plain ASCII.'
        : 'Review your message body manually to ensure no private names or details were typed.',
      actionLabel: isFormatting ? 'NORMALIZE TEXT COPY' : 'REVIEW MESSAGE BODY',
      actionTarget: isFormatting ? 'normalize_text' : 'none',
      priorityRank: isFormatting ? 1 : 5,
      source: 'deterministic',
    });
  }

  return deductions.sort((a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99));
}
