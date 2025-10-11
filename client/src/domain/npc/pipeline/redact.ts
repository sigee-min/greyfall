export function redactReply(raw: string, maxLen = 140): string {
  let s = (raw || '').replace(/\((ooc|meta)[^)]*\)/gi, '');
  s = s.replace(/\[\s*action:[^\]]*\]/gi, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen - 1) + '…';
  return s || '...';
}

