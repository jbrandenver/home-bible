import { z } from 'zod';
import { PROPERTY_TYPES, ROOM_TYPES, UTILITY_TYPES } from './constants';

export const createPropertySchema = z.object({
  household_id: z.string().uuid().optional(),
  owner_user_id: z.string().uuid(),
  nickname: z.string().min(1),
  property_type: z.enum(PROPERTY_TYPES as any),
  address_line_1: z.string().nullable().optional(),
  address_line_2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  address_is_enabled: z.boolean().default(false),
  square_feet: z.number().nullable().optional(),
  year_built: z.number().nullable().optional(),
  floor_count: z.number().nullable().optional(),
  has_garage: z.boolean().default(false),
  has_basement: z.boolean().default(false),
  has_attic: z.boolean().default(false),
  has_crawl_space: z.boolean().default(false),
  has_yard: z.boolean().default(false),
  has_shed: z.boolean().default(false)
});

export const createFloorSchema = z.object({
  property_id: z.string().uuid(),
  name: z.string().min(1),
  floor_number: z.number().int(),
  sort_order: z.number().int().optional()
});

export const createRoomSchema = z.object({
  property_id: z.string().uuid(),
  floor_id: z.string().uuid().optional(),
  name: z.string().min(1),
  room_type: z.enum(ROOM_TYPES as any),
  sort_order: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  outlet_count: z.number().nullable().optional(),
  switch_count: z.number().nullable().optional(),
  vent_count: z.number().nullable().optional(),
  vent_type: z.string().nullable().optional(),
  breaker_label: z.string().nullable().optional(),
  has_plumbing: z.boolean().default(false)
});

export const createUtilitySchema = z.object({
  property_id: z.string().uuid(),
  room_id: z.string().uuid().nullable().optional(),
  utility_type: z.enum(UTILITY_TYPES as any),
  name: z.string().min(1),
  location_notes: z.string().nullable().optional(),
  emergency_notes: z.string().nullable().optional()
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateUtilityInput = z.infer<typeof createUtilitySchema>;
