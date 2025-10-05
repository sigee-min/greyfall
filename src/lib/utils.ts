import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TAG_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateUserTag(length = 3) {
  let tag = '#';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * TAG_CHARS.length);
    tag += TAG_CHARS[index];
  }
  return tag;
}
