/**
 * SelectorAI — obtains sidebar selectors or direct link arrays from an LLM.
 * Uses OpenRouter (https://openrouter.ai) with GPT-4.1-mini.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL    = 'openai/gpt-4.1-mini';

interface SelectorResult {
  type: 'selector';
  value: string;
}

interface LinksResult {
  type: 'links';
  value: Array<{ url: string; title: string }>;
}

type ExtractionResult = SelectorResult | LinksResult;

export class SelectorAI {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not set in environment');
    }
  }

  /**
   * Ask the LLM for a CSS selector or a direct link list.
   * @param html – full HTML of the docs landing page
   * @param url – absolute URL of that page (for context)
   * @returns CSS selector or array of links
   */
  async extractNav(html: string, url: string): Promise<ExtractionResult> {
    // Keep token-count low: truncate after 30 000 chars
    const snippet = html.slice(0, 30_000);

    const sys = `You are an expert documentation analyser.`;
    const user = `
Here is the HTML of a documentation page hosted at ${url}.
Task:
1. If you can identify a single CSS selector that selects ALL sidebar or table-of-contents links
   (and *only* those), answer exactly:
   {"type":"selector","value":"<CSS SELECTOR>"}

2. If that is impossible, output the explicit list of links you do find, as:
   {"type":"links","value":[{"url":"...","title":"..."}, ...]}

Rules:
• MUST return *only* valid JSON, no extra text.
• Titles may be empty strings if missing.
• Limit to max 100 links.
`;

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Title': 'Docs Scraper AI'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: sys.trim() },
          { role: 'user', content: user.trim() + '\n\n' + snippet }
        ],
        temperature: 0.2,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    
    if (!answer) {
      throw new Error('Empty response from OpenRouter');
    }

    try {
      return JSON.parse(answer);
    } catch (e) {
      throw new Error(`LLM response is not valid JSON: ${answer}`);
    }
  }
}