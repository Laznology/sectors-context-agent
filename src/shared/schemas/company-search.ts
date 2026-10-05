import { z } from "zod";

export const CompanyScreenerResultSchema = z.looseObject({
  symbol: z.string().min(1),
  company_name: z.string().min(1),
});

export const CompanyScreenerResponseSchema = z.looseObject({
  results: z.array(CompanyScreenerResultSchema),
  pagination: z.looseObject({
    total_count: z.number().int().nonnegative(),
    showing: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    has_next: z.boolean(),
    has_previous: z.boolean(),
    next_offset: z.number().int().nonnegative().nullable(),
    previous_offset: z.number().int().nonnegative().nullable(),
  }),
  llm_translation: z
    .looseObject({
      natural_query: z.string().nullable().optional(),
      translated_params: z.looseObject({}).optional(),
      message: z.string().nullable().optional(),
    })
    .optional(),
});

export type CompanyScreenerResponse = z.infer<typeof CompanyScreenerResponseSchema>;
export type CompanyScreenerResult = z.infer<typeof CompanyScreenerResultSchema>;
