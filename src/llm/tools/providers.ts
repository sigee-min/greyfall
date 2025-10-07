import type { ToolCtx } from './types';

let providers: ToolCtx['providers'] | undefined = undefined;

export function setToolsProviders(p: ToolCtx['providers'] | undefined) {
  providers = p;
}

export function getToolsProviders(): ToolCtx['providers'] | undefined {
  return providers;
}

