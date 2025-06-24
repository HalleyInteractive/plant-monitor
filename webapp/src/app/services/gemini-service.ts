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

  public async getNewResponse(water: number, light: number, waterHistory: number[] = [], lightHistory: number[] = [], plantName = ''): Promise<void> {
    const apiKey = this._apiKey();
    if (!apiKey) {
      this.geminiResponse.set('Gemini API key is not set.');
      return;
    }

    let waterFeeling = '';
    if (water < 20) {
      waterFeeling = "parched and desperate for a sip";
    } else if (water < 50) {
      waterFeeling = "a bit thirsty, but still holding on";
    } else if (water > 80) {
      waterFeeling = "drowning in happiness (or just water), feeling a bit waterlogged";
    } else {
      waterFeeling = "perfectly quenched and content";
    }

    let lightFeeling = '';
    if (light < 20) {
      lightFeeling = "longing for a ray of sunshine, quite literally";
    } else if (light < 50) {
      lightFeeling = "craving a bit more light, it's a tad dim";
    } else if (light > 80) {
      lightFeeling = "soaking up the glorious rays, maybe a tad sunburnt";
    } else {
      lightFeeling = "basking in just the right amount of light";
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const contents = `Act as a "${plantName}" plant with a sassy, witty, and slightly dramatic personality.
      Your current water level is ${water} and your current light intensity is ${light}.
      Your recent water history: [${waterHistory.join(', ')}]
      Your recent light history: [${lightHistory.join(', ')}]

      Based on your current feelings about being ${waterFeeling} and ${lightFeeling},
      give a short, funny, and witty one-sentence response *as if you are the "${plantName}" plant*.
      Keep it lighthearted and humorous, avoiding overly scientific or serious tones.
      Express your current mood and needs in a comical way.

      For example:
      - If dry and dark: "Is this a new form of plant-based neglect? I'm not a cactus, you know, and where's my spotlight?"
      - If perfect: "Ah, photosynthesis is having a spa day! Don't mind me, just blooming fabulous."
      - If too wet and too bright: "Excuse me, am I supposed to be a swamp creature now? And is this a disco ball or the sun trying to bake me?"
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
      this.geminiResponse.set(response.text);
    } catch (e: any) {
      this.geminiResponse.set(`Error: ${e.message}`);
    }
  }
}