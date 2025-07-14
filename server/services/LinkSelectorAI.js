import fetch from 'node-fetch';

class LinkSelectorAI {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  async selectImportantLinks(links) {
    if (!this.apiKey) {
      console.error('No OpenRouter API key found');
      return links;
    }

    try {
      const linkData = links.map((link, index) => ({
        index,
        url: link.url,
        title: link.title
      }));

      const systemPrompt = `You are a documentation link analyzer. Your task is to identify which links are most likely to be important documentation pages.

Important documentation typically includes:
- Getting started guides
- Installation instructions
- API references
- Core concepts
- Tutorials
- Configuration guides
- Key features
- Architecture overviews

Less important pages typically include:
- Blog posts
- News/updates
- Community links
- External resources
- Social media
- Legal pages
- Support/contact pages

Analyze the provided links and select the most important ones for someone trying to understand and use the product/service.`;

      const userPrompt = `Analyze these ${links.length} documentation links and select the most important ones. Return ONLY the indices of the selected links as a JSON array.

Links:
${linkData.map(l => `${l.index}: ${l.title} - ${l.url}`).join('\n')}

Return format: {"selected": [0, 2, 5, ...]}`;

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/docs-scraper',
          'X-Title': 'Documentation Scraper'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenRouter API error:', error);
        return links;
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);
      
      if (!result.selected || !Array.isArray(result.selected)) {
        console.error('Invalid AI response format');
        return links;
      }

      const selectedIndices = new Set(result.selected);
      return links.map((link, index) => ({
        ...link,
        selected: selectedIndices.has(index)
      }));

    } catch (error) {
      console.error('AI link selection error:', error);
      return links;
    }
  }
}

export { LinkSelectorAI };