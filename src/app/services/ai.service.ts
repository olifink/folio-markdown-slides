import { Injectable, inject } from '@angular/core';
import { AppStore } from '../store/app-store';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly store = inject(AppStore);

  async generateContent(prompt: string, currentContent: string): Promise<string> {
    const apiKey = this.store.prefs().geminiApiKey;
    if (!apiKey) {
      throw new Error('Gemini API Key is not set. Please add it in Advanced Settings.');
    }

    const requestedModel = 'gemini-flash-lite-latest';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey}`;

    const systemPrompt = `You are an expert Markdown and Marp slide editor. 
Your task is to modify the provided Markdown content based on the user's instructions.
Return ONLY the modified Markdown content. Do not include any explanations, preamble, or markdown code blocks (unless they are part of the content itself).
Current content:
${currentContent}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          { text: systemPrompt }
        ]
      },
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        responseMimeType: 'text/plain',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate content');
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!result) {
      throw new Error('No content generated');
    }

    return result.trim();
  }
}
