/**
 * SelectorAI — obtains sidebar selectors or direct link arrays from an LLM.
 * Uses OpenRouter (https://openrouter.ai) with GPT-4.1-mini.
 */
import axios from 'axios';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL    = 'openai/gpt-4.1-mini';

export default class SelectorAI {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not set in environment');
    }
  }

  /**
   * Ask the LLM for a CSS selector or a direct link list.
   * @param {string} html  – full HTML of the docs landing page
   * @param {string} url   – absolute URL of that page (for context)
   * @returns {{type:'selector', value:string}|{type:'links', value:Array<{url,title}>}}
   */
  async extractNav(html, url) {
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

    const { data } = await axios.post(
      ENDPOINT,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: sys.trim() },
          { role: 'user',   content: user.trim() },
          { role: 'user',   content: snippet }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          Authorization : `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          // optional vanity headers → ranking on openrouter.ai
          'HTTP-Referer': 'https://github.com/ricardo-kupper/docs-scraper',
          'X-Title'     : 'Docs Scraper'
        },
        timeout: 60_000
      }
    );

    const parsed = JSON.parse(data.choices[0].message.content);
    if (!parsed || !parsed.type || !parsed.value) {
      throw new Error('LLM returned invalid structure');
    }
    return parsed;
  }
}
