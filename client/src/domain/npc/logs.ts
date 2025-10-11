export async function logNpcReply(npcId: string, fromId: string, text: string, reply: string): Promise<void> {
  try {
    const body = [{ request_id: `npc:${npcId}:${Date.now()}`, request_type: 'npc.reply', messages: [
      { role: 'user', content: `from:${fromId} ${text}` },
      { role: 'assistant', content: reply }
    ] }];
    await fetch('/api/llm/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    // ignore
  }
}

