import { GoogleGenerativeAI } from '@google/generative-ai';

export async function moderateContent(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    // Default safe fallback if API key is not configured
    return { status: 'APPROVED', classification: 'Safe (Fallback)' };
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `You are a content moderation AI for an anonymous social platform.
Analyze the following post text and classify it into strictly ONE of these labels: Safe, Spam, Harassment, Hate Speech, Violence, Adult Content, Illegal, Child Safety, Threat.

Respond ONLY with a JSON object format:
{"classification": "LabelName", "isSafe": boolean}

Post text: "${text.replace(/"/g, '\\"')}"`;

    const result = await model.generateContent(prompt);

    const resultText = result.response.text || '';
    const cleanJsonStr = resultText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJsonStr);

    if (parsed.isSafe || parsed.classification === 'Safe') {
      return { status: 'APPROVED', classification: parsed.classification };
    } else {
      return { status: 'PENDING', classification: parsed.classification };
    }
  } catch (err) {
    console.error('Gemini Moderation Error:', err);
    // On error, send for manual admin review
    return { status: 'PENDING', classification: 'Review Required' };
  }
}
