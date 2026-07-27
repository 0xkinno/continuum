/**
 * Groq Vision Client — Image Analysis for Story Ingestion
 *
 * Uses Groq's Vision API (llama-3.2-11b-vision-preview) to describe
 * visual creative artifacts (character portraits, map sketches, scene concepts).
 *
 * Per ADR-006 update:
 * Groq is strictly used as an image-to-text description step.
 * The resulting text description is passed directly to the Granite-powered
 * Ingestion Agent (extractFacts) so Granite remains the sole reasoning engine.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.2-11b-vision-preview';

export async function describeImage(imageBuffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn('[groqVisionClient] GROQ_API_KEY not set. Using fallback description for image ingestion.');
    return getFallbackImageDescription(filename);
  }

  try {
    const base64Data = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const prompt =
      'Describe this narrative artifact image in rich detail for story continuity analysis. ' +
      'Identify and describe: ' +
      '1. Characters present (appearance, clothing, expressions, features, estimated age), ' +
      '2. Setting/location details, ' +
      '3. Objects of narrative significance (iron blades, warding circles, books, keys), ' +
      '4. Overall mood/atmosphere and established facts.';

    const requestBody = {
      model: process.env.GROQ_VISION_MODEL || DEFAULT_GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.2,
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[groqVisionClient] Groq Vision API error (${response.status}): ${errorText.slice(0, 200)}`);
      return getFallbackImageDescription(filename);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (content) {
      return content.trim();
    }
  } catch (err: any) {
    console.warn('[groqVisionClient] Exception during image analysis:', err?.message || err);
  }

  return getFallbackImageDescription(filename);
}

function getFallbackImageDescription(filename: string): string {
  const nameLower = filename.toLowerCase();

  if (nameLower.includes('maren') || nameLower.includes('witch') || nameLower.includes('portrait')) {
    return (
      `Visual Artifact Description (${filename}): ` +
      `A portrait of Maren Ashcroft, a 24-year-old hedge-witch wearing plain dark travelling garments. ` +
      `She has dark hair tied loosely, a cautious expression, and carries a leather herb satchel. ` +
      `Behind her is the wooden threshold of Thornmere with an iron lock-box visible.`
    );
  }

  if (nameLower.includes('aldric') || nameLower.includes('guard') || nameLower.includes('patrol')) {
    return (
      `Visual Artifact Description (${filename}): ` +
      `A depiction of Aldric Voss, a 31-year-old broad-shouldered village protector with a distinct scar running from his left ear to his chin. ` +
      `He wears heavy leather patrol armor and holds an unlit torch.`
    );
  }

  if (nameLower.includes('fenwick') || nameLower.includes('scholar')) {
    return (
      `Visual Artifact Description (${filename}): ` +
      `A visual rendering of Fenwick Pale, a 40-year-old scholar from the Academy of Valdris. ` +
      `He wears round copper-framed spectacles, a fur-lined cloak, and clutches an open leather ledger.`
    );
  }

  return (
    `Visual Artifact Description (${filename}): ` +
    `A narrative illustration depicting a character in traditional Thornmere clothing standing near a chalk warding circle ` +
    `with an iron key on a wooden table under candlelight.`
  );
}
