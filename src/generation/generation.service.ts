import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDisk, type StorageDisk } from '@nestjs/storage';
import Handlebars from 'handlebars';
import { randomUUID } from 'node:crypto';
import { PdfRendererService } from './pdf-renderer.service.js';
import type { GenerateRequest } from './generate-request.schema.js';

const TEMPLATE_KEY = 'Application_DemoV3.html';
const TEXT_BINDING = /\bvalue="\{\{\s*([A-Za-z0-9_.]+)\s*\}\}"/g;
const CHECKBOX_BINDING = /\{\{\s*checked\s+([A-Za-z0-9_.]+)\s*\}\}/g;
const DIGIT_BINDING = /\{\{\s*digit\s+([A-Za-z0-9_.]+)\s+\d+\s*\}\}/g;

@Injectable()
export class GenerationService {
  private readonly handlebars = Handlebars.create();
  private readonly archiveQueues = new Map<string, Promise<void>>();

  constructor(
    @InjectDisk('templates') private readonly templates: StorageDisk,
    @InjectDisk('backups') private readonly backups: StorageDisk,
    private readonly pdfRenderer: PdfRendererService,
    private readonly config: ConfigService,
  ) {
    this.handlebars.registerHelper('checked', (value: unknown) =>
      value === true ? 'checked' : '',
    );
    this.handlebars.registerHelper('digit', (value: unknown, index: number) => {
      if (typeof value !== 'string') {
        return '';
      }
      return value.replace(/\D/g, '')[index] ?? '';
    });
  }

  async generate(request: GenerateRequest): Promise<StreamableFile> {
    assertJsonScalarLeaves(request);

    let template: string;
    try {
      template = await this.templates.getText(TEMPLATE_KEY);
    } catch {
      throw new InternalServerErrorException('The PDF template could not be read');
    }

    validateRequestPaths(template, request);
    validateBoundValues(template, request);

    let pdf: Buffer;
    try {
      const render = this.handlebars.compile(template, { noEscape: false });
      const html = render(request);
      if (/\{\{[^}]+\}\}/.test(html)) {
        throw new Error('The rendered HTML still contains a template expression');
      }
      pdf = await this.pdfRenderer.render(html);
    } catch {
      throw new InternalServerErrorException('The application PDF could not be generated');
    }

    try {
      await this.archiveRequest(request);
    } catch {
      throw new InternalServerErrorException('The application request could not be archived');
    }

    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="${request.applicationId}.pdf"`,
    });
  }

  private async archiveRequest(request: GenerateRequest): Promise<void> {
    const timeZone = this.config.getOrThrow<string>('generation.timeZone');
    const { date, timestamp } = formatTimestamp(new Date(), timeZone);
    const directory = `appForm/${date}/${request.applicationId}-${timestamp}`;
    const json = `${JSON.stringify(request, null, 2)}\n`;

    await this.withArchiveLock(directory, async () => {
      const defaultKey = `${directory}/request.json`;
      const key = (await this.backups.exists(defaultKey))
        ? `${directory}/request-${randomUUID()}.json`
        : defaultKey;

      await this.backups.put(key, json, { contentType: 'application/json' });
    });
  }

  private async withArchiveLock<T>(directory: string, write: () => Promise<T>): Promise<T> {
    const previous = this.archiveQueues.get(directory) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.archiveQueues.set(directory, queued);

    await previous;
    try {
      return await write();
    } finally {
      release();
      if (this.archiveQueues.get(directory) === queued) {
        this.archiveQueues.delete(directory);
      }
    }
  }
}

function assertJsonScalarLeaves(value: unknown, path = 'request'): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return;
  }

  if (Array.isArray(value)) {
    throw new BadRequestException(`${path} must use nested objects, not arrays`);
  }

  if (typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      assertJsonScalarLeaves(nestedValue, `${path}.${key}`);
    }
    return;
  }

  throw new BadRequestException(`${path} must contain only strings, numbers, booleans, or null`);
}

function validateBoundValues(template: string, request: GenerateRequest): void {
  for (const [, path] of template.matchAll(CHECKBOX_BINDING)) {
    const value = getPathValue(request, path);
    if (value !== undefined && value !== null && typeof value !== 'boolean') {
      throw new BadRequestException(`${path} must be a boolean`);
    }
  }

  for (const [, path] of template.matchAll(TEXT_BINDING)) {
    const value = getPathValue(request, path);
    if (
      value !== undefined &&
      value !== null &&
      typeof value !== 'string' &&
      typeof value !== 'number'
    ) {
      throw new BadRequestException(`${path} must be a string or number`);
    }
  }

  for (const [, path] of template.matchAll(DIGIT_BINDING)) {
    const value = getPathValue(request, path);
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new BadRequestException(`${path} must be a string`);
    }
  }
}

function validateRequestPaths(template: string, request: GenerateRequest): void {
  const allowedPaths = new Set(['applicationId']);
  for (const [, path] of template.matchAll(TEXT_BINDING)) {
    allowedPaths.add(path);
  }
  for (const [, path] of template.matchAll(CHECKBOX_BINDING)) {
    allowedPaths.add(path);
  }
  for (const [, path] of template.matchAll(DIGIT_BINDING)) {
    allowedPaths.add(path);
  }

  const visit = (value: unknown, path: string): void => {
    if (
      path &&
      ![...allowedPaths].some((allowed) => allowed === path || allowed.startsWith(`${path}.`))
    ) {
      throw new BadRequestException(`Unknown request field: ${path}`);
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, path ? `${path}.${key}` : key);
      }
      return;
    }

    if (path && !allowedPaths.has(path)) {
      throw new BadRequestException(`Unknown request field: ${path}`);
    }
  };

  visit(request, '');
}

function getPathValue(root: unknown, path: string): unknown {
  let value: unknown = root;
  for (const segment of path.split('.')) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(value, segment)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function formatTimestamp(date: Date, timeZone: string): { date: string; timestamp: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  const datePart = `${part('year')}${part('month')}${part('day')}`;
  return {
    date: datePart,
    timestamp: `${datePart}-${part('hour')}${part('minute')}${part('second')}`,
  };
}
