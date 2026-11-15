import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { chromium, type Browser } from 'playwright';

@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private browserPromise: Promise<Browser> | undefined;

  async render(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({ locale: 'th-TH' });

    try {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      return await page.pdf({
        format: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
      });
    } finally {
      await context.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    const browser = await this.browserPromise?.catch(() => undefined);
    await browser?.close();
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({ headless: true }).catch((error: unknown) => {
        this.browserPromise = undefined;
        throw error;
      });
    }

    return this.browserPromise;
  }
}
