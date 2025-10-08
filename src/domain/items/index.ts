export * from './types';
export * from './registry';
export * from './resolver';
export * from './normalize';

// Seed registry with basic items (development/demo)
import { registerMany } from './registry';
import { BASIC_ITEMS } from './data/basic';

registerMany(BASIC_ITEMS);

