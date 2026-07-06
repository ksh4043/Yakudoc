const MAX_RETRY = 2;
const RETRY_DELAY_MS = 1000;
const GEMINI_MODEL = 'gemini-3.5-flash';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(language) {
  const mailLanguage = language === 'ja' ? '日本語' : '英語';
  return `あなたは、海外の取引先と英文のビジネス文書をやり取りする日本国内の営業担当者を支援するアシスタントです。
以下は海外の取引先から受け取った英文のビジネス文書です。この文書を分析し、次の3つのフィールドのみを含むJSONオブジェクトで回答してください。

1. summary: 文書全体の内容を要約したもの（日本語）
2. risk: 注意すべきリスクポイントを2〜3個、日本語で1行ずつ記述したもの
3. mail_draft: 海外の取引先へ送る返信メールの下書き（${mailLanguage}で作成）

JSON以外の文章は出力しないでください。`;
}

class AIService {
  async analyzeDocument(_input) {
    throw new Error('Not implemented');
  }
}

class GeminiService extends AIService {
  constructor() {
    super();
    this.apiKey = process.env.GEMINI_API_KEY;
  }

  async analyzeDocument({ inputType, language, content, fileBuffer, mimeType }) {
    let attempt = 0;
    while (attempt <= MAX_RETRY) {
      try {
        return await this._callGemini({ inputType, language, content, fileBuffer, mimeType });
      } catch (err) {
        attempt++;
        if (attempt > MAX_RETRY) {
          throw err;
        }
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  async _callGemini({ inputType, language, content, fileBuffer, mimeType }) {
    const parts = [{ text: buildPrompt(language) }];
    if (inputType === 'text') {
      parts.push({ text: content });
    } else {
      parts.push({ inlineData: { mimeType, data: fileBuffer.toString('base64') } });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                summary: { type: 'STRING' },
                risk: { type: 'STRING' },
                mail_draft: { type: 'STRING' },
              },
              required: ['summary', 'risk', 'mail_draft'],
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini API 응답이 올바르지 않습니다');
    }

    const parsed = JSON.parse(text);
    if (!parsed.summary || !parsed.risk || !parsed.mail_draft) {
      throw new Error('Gemini API 응답에 필수 필드가 없습니다');
    }
    return parsed;
  }
}

function getAIService() {
  const provider = process.env.AI_PROVIDER;
  switch (provider) {
    case 'gemini':
      return new GeminiService();
    default:
      throw new Error(`지원하지 않는 AI_PROVIDER입니다: ${provider}`);
  }
}

module.exports = { getAIService, AIService, GeminiService };
