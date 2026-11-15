import { z } from 'zod';

const safeApplicationId = /^[A-Za-z0-9_-]{1,100}$/;

export const generateRequestSchema = z
  .object({
    applicationId: z
      .string()
      .regex(safeApplicationId, 'applicationId must use 1–100 letters, digits, hyphens, or underscores'),
  })
  .passthrough();

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
