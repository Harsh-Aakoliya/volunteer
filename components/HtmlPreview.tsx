export const getPreviewHTML = (content: string, isPreview: boolean = false) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: ${isPreview ? '8px' : '16px'};
              margin: 0;
              color: #1f2937;
              font-size: ${isPreview ? '14px' : '16px'};
              line-height: 1.5;
              background-color: white;
              ${isPreview ? 'max-height: 60px; overflow: hidden;' : ''}
            }
            img {
              max-width: 100%;
              height: auto;
            }
            ul, ol {
              padding-left: 20px;
            }
            a {
              color: #2563eb;
              text-decoration: underline;
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              line-height: 1.2;
            }
            h1 {
              font-size: 1.8em;
            }
            h2 {
              font-size: 1.5em;
            }
            blockquote {
              border-left: 4px solid #e5e7eb;
              padding-left: 16px;
              margin-left: 0;
              color: #4b5563;
            }
            pre {
              background-color: #f3f4f6;
              padding: 16px;
              border-radius: 4px;
              overflow-x: auto;
            }
            code {
              font-family: monospace;
              background-color: #f3f4f6;
              padding: 2px 4px;
              border-radius: 4px;
            }
            .announcement-content {
              ${isPreview ? 'display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;' : ''}
            }
            .announcement-title {
              font-size: 24px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 16px;
              color: #111827;
            }
            .announcement-date {
              text-align: center;
              margin-bottom: 24px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="announcement-content">
            ${content || '<span style="color: #9ca3af; font-style: italic;">No content available</span>'}
          </div>
        </body>
      </html>
    `;
  };