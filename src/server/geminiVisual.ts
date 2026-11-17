import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { z } from 'zod';
import type {
  VisualInspectionResponse,
  VisualObservation,
} from '../types/forensics.ts';
import { GEMINI_MODEL, isGeminiConfigured } from './geminiDeduce.ts';

export const VisualInspectRequestSchema = z.object({
  consentGranted: z.literal(true),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  imageBase64: z.string().min(32).max(5_500_000),
});

export type VisualInspectRequest = z.infer<typeof VisualInspectRequestSchema>;

const GeminiVisualItemSchema = z.object({
  category: z.enum([
    'id_badge',
    'name_tag',
    'logo',
    'readable_text',
    'license_plate',
    'background_document',
    'screen_info',
    'other_visible_detail',
  ]),
  title: z.string().min(1).max(120),
  evidenceDescription: z.string().min(1).max(400),
  confidenceDescription: z.string().min(1).max(200),
  whyItMatters: z.string().min(1).max(300),
  suggestedMitigation: z.string().min(1).max(300),
  region: z
    .object({
      ymin: z.number().min(0).max(1000),
      xmin: z.number().min(0).max(1000),
      ymax: z.number().min(0).max(1000),
      xmax: z.number().min(0).max(1000),
    })
    .optional(),
});

const GeminiVisualArraySchema = z.array(GeminiVisualItemSchema);

export const VISUAL_DISCLOSURE =
  'Consented visual inspection sends a downscaled copy of this image to the server-configured Gemini provider. Local EXIF analysis never uploads images. Hosted API retention/data terms depend on your tier and are separate from MongoDB 2-hour saved-report TTL.';

export async function runGeminiVisualInspection(
  input: VisualInspectRequest
): Promise<VisualInspectionResponse> {
  if (!isGeminiConfigured()) {
    return {
      available: false,
      provider: 'unavailable',
      observations: [],
      summaryNote:
        'AI visual inspection is currently unavailable. Local file analysis remains available.',
      disclosure: VISUAL_DISCLOSURE,
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = [
      'Inspect this image strictly for visible objects or text that a sender might want to obscure before sharing publicly.',
      'Allowed categories ONLY: id_badge, name_tag, logo, readable_text, license_plate, background_document, screen_info, other_visible_detail.',
      'STRICT ETHICAL & SAFETY PROHIBITIONS:',
      '- NEVER identify an unknown person by face or name.',
      '- NEVER infer home address, religion, occupation, ethnicity, or private personal attributes from appearance.',
      '- Include "region" (0-1000 normalized ymin, xmin, ymax, xmax) ONLY when you can localize the visible object/text reliably; omit "region" if uncertain.',
      '- Use qualitative confidenceDescription (e.g. "Clearly legible badge text" or "Possible blurred text on background paper"), never fabricated percentage scores.',
      '- Remember metadata scrubbers cannot remove visible image content; recommend manual blur or crop.',
    ].join('\n');

    const imagePart = {
      inlineData: {
        mimeType: input.mimeType,
        data: input.imageBase64,
      },
    };
    const textPart = { text: prompt };

    const candidateModels = [
      { model: GEMINI_MODEL, useLowThinking: true },
      { model: 'gemini-3.1-flash-lite', useLowThinking: false },
    ] as const;

    let response: { text?: string } | null = null;
    let activeModel = GEMINI_MODEL;
    let lastError: unknown = null;

    for (const candidate of candidateModels) {
      try {
        const attempt = await Promise.race([
          ai.models.generateContent({
            model: candidate.model,
            contents: { parts: [imagePart, textPart] },
            config: {
              ...(candidate.useLowThinking
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
              systemInstruction:
                'Return strictly a JSON array of visible privacy observations. If no sensitive visible objects or text appear, return [].',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    title: { type: Type.STRING },
                    evidenceDescription: { type: Type.STRING },
                    confidenceDescription: { type: Type.STRING },
                    whyItMatters: { type: Type.STRING },
                    suggestedMitigation: { type: Type.STRING },
                    region: {
                      type: Type.OBJECT,
                      properties: {
                        ymin: { type: Type.NUMBER },
                        xmin: { type: Type.NUMBER },
                        ymax: { type: Type.NUMBER },
                        xmax: { type: Type.NUMBER },
                      },
                    },
                  },
                  required: [
                    'category',
                    'title',
                    'evidenceDescription',
                    'confidenceDescription',
                    'whyItMatters',
                    'suggestedMitigation',
                  ],
                },
              },
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`${candidate.model} visual inspection timed out`)),
              15000
            )
          ),
        ]);
        response = attempt;
        activeModel = candidate.model;
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!/503|429|500|UNAVAILABLE|high demand|timed out/i.test(msg)) {
          throw err;
        }
      }
    }

    if (!response) {
      throw lastError ?? new Error('Visual inspection models unavailable.');
    }

    const rawText = (response.text ?? '[]').trim();
    const parsedJson = JSON.parse(rawText);
    const validated = GeminiVisualArraySchema.parse(parsedJson);

    const observations: VisualObservation[] = validated.map((item, idx) => {
      const hasValidBox =
        item.region &&
        item.region.ymax > item.region.ymin &&
        item.region.xmax > item.region.xmin;
      return {
        id: `vis_${idx}_${Date.now()}`,
        category: item.category,
        title: item.title,
        evidenceDescription: item.evidenceDescription,
        confidenceDescription: item.confidenceDescription,
        whyItMatters: item.whyItMatters,
        suggestedMitigation: item.suggestedMitigation,
        region: hasValidBox ? item.region : undefined,
      };
    });

    return {
      available: true,
      provider: 'gemini',
      model: activeModel,
      observations,
      summaryNote:
        observations.length > 0
          ? `${observations.length} AI visual observation(s) flagged for manual review.`
          : 'No prominent visible badges, readable sensitive text, or background documents were flagged by visual inspection.',
      disclosure: VISUAL_DISCLOSURE,
    };
  } catch {
    return {
      available: false,
      provider: 'unavailable',
      observations: [],
      summaryNote:
        'AI visual inspection is currently unavailable. Local file analysis remains available.',
      disclosure: VISUAL_DISCLOSURE,
    };
  }
}
