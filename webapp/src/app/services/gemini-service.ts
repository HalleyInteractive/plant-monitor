import { Injectable, signal } from '@angular/core';
import { GoogleGenAI } from "@google/genai";

const API_KEY_STORAGE = 'gemini_api_key';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {

  public readonly geminiResponse = signal<string | undefined>(undefined);
  private _apiKey = signal<string | null>(this.getApiKey());

  public getApiKey(): string | null {
    return localStorage.getItem(API_KEY_STORAGE);
  }

  public setApiKey(apiKey: string): void {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    this._apiKey.set(apiKey);
  }

  public async getNewResponse(water: number, light: number) {
    const apiKey = this._apiKey();
    if (!apiKey) {
      this.geminiResponse.set('Gemini API key is not set.');
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const contents = `The current water reading is ${water} and the current light reading is ${light}. What should I do for my plant?`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          thinkingConfig: {
            thinkingBudget: 0, // Disables thinking
          },
        }
      });
      this.geminiResponse.set(response.text);
    } catch (e: any) {
      this.geminiResponse.set(`Error: ${e.message}`);
    }
  }
}