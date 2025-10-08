export * from './types';
export * from './registry';
export * from './resolver';
export * from './normalize';

// Seed registry with basic items (development/demo)
import { registerMany } from './registry';
import { BASIC_ITEMS } from './data/basic';
import { GREYFALL_ITEMS } from './data/greyfall';
import { GREYFALL_EXPANDED_EQUIPMENT } from './data/greyfall_generated';

registerMany([...BASIC_ITEMS, ...GREYFALL_ITEMS, ...GREYFALL_EXPANDED_EQUIPMENT]);
