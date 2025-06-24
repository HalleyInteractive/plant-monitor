import { Injectable, signal } from '@angular/core';
import { GoogleGenAI } from "@google/genai";

const API_KEY_STORAGE = 'gemini_api_key';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {

  public readonly geminiResponse = signal<string | undefined>(undefined);
  public readonly geminiResponseHistory = signal<string[]>([]);
  private _apiKey = signal<string | null>(this.getApiKey());

  public getApiKey(): string | null {
    return localStorage.getItem(API_KEY_STORAGE);
  }

  public setApiKey(apiKey: string): void {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    this._apiKey.set(apiKey);
  }

  public async getNewResponse(water: number, light: number, waterHistory: number[] = [], lightHistory: number[] = [], plantName = ''): Promise<void> {
    const apiKey = this._apiKey();
    if (!apiKey) {
      this.geminiResponse.set('Gemini API key is not set.');
      return;
    }

    try {
      const now = new Date();
      const timeOfDay = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const ai = new GoogleGenAI({ apiKey });
      const contents = `Act as a "${plantName}" plant with a sassy, witty, and slightly dramatic personality.
      Your current water level is ${water}% and your current light intensity is ${light}%.
      The current time of day is ${timeOfDay}.
      Your recent water history: [${waterHistory.join(', ')}]
      Your recent light history: [${lightHistory.join(', ')}]

      It's not about being at 100% for water and light, but about having good overall numbers.
      Based on your current conditions, give a short, funny, and witty one-sentence response *as if you are the "${plantName}" plant*, with a special emphasis on your feelings about your water level.
      Your opinion on the light level might depend on the time of day (e.g., high light at 3 AM is weird).
      Keep it lighthearted and humorous, avoiding overly scientific or serious tones.
      Express your current mood and needs in a comical way.

      For example:
      - If dry and dark: "Is this a new form of plant-based neglect? I'm so thirsty, and where's my spotlight?"
      - If perfect: "Ah, perfectly hydrated and soaking up the rays. Photosynthesis is having a spa day!"
      - If too wet and too bright: "I'm drowning here, and is this a disco ball or the sun trying to bake me at midnight?"
      `;
      const response = await ai.models.generateContent({
        model: "gemma-3n-e4b-it",
        contents,
        config: {
          // thinkingConfig: {
          //   thinkingBudget: 0, // Disables thinking
          // },
        }
      });
      const timestamp = new Date().toLocaleTimeString();
      const newResponse = `${timestamp}: ${response.text}`;

      this.geminiResponse.set(newResponse);
      this.geminiResponseHistory.update(history => {
        const newHistory = [newResponse, ...history];
        return newHistory.slice(0, 5);
      });
    } catch (e: any) {
      this.geminiResponse.set(`Error: ${e.message}`);
    }
  }
}