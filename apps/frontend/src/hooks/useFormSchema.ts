/**
 * useFormSchema — react-hook-form with zod resolver wrapper.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodTypeAny, z } from 'zod';

export function useFormSchema<TSchema extends ZodTypeAny>(schema: TSchema) {
  type Values = z.infer<TSchema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });
  return form;
}
