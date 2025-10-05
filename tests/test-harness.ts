export type TestCase = { name: string; fn: () => void | Promise<void> };
export const cases: TestCase[] = [];
export function test(name: string, fn: () => void | Promise<void>) {
  cases.push({ name, fn });
}

