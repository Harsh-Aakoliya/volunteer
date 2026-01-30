// Shared HTML/rich-text helpers for message input and edit

export function cleanHtml(html: string): string {
  if (!html) return "";
  let text = html;
  text = text.replace(
    /<font\s+color=["']?((?:#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|[a-z]+))["']?>(.*?)<\/font>/gi,
    '<span style="color:$1">$2</span>'
  );
  text = text.replace(/^(<br\s*\/?>|&nbsp;|\s|<div>\s*<\/div>)+/, '');
  text = text.replace(/(<br\s*\/?>|&nbsp;|\s|<div>\s*<\/div>)+$/, '');
  return text.trim();
}

export function stripHtml(html: string): string {
  if (!html) return "";
  let text = html.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  return text.trim();
}

export function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | null;

export function detectCurrentHeading(html: string): HeadingLevel {
  if (!html) return null;
  const headingMatch = html.match(/<(h[1-6])[^>]*>/i);
  if (headingMatch) {
    return headingMatch[1].toLowerCase() as HeadingLevel;
  }
  return null;
}
