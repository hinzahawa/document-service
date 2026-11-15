# Use Playwright Chromium to render application PDFs

The existing application form is maintained as HTML with a carefully arranged A4 print layout, so PDF generation uses Playwright's Chromium renderer to retain that layout and its Thai text rather than rebuilding hundreds of controls in a PDF drawing library. This requires a Chromium runtime and Thai-capable system font where the service runs.
