import type { ResolvedBrowser } from './browser.js';

// Chromium for a serverless function comes from @sparticuz/chromium. It unpacks a compressed
// binary into /tmp on first use (about 220 MB, 500 MB is available).

/**
 * The package default includes --single-process. Its maintainer reports problems with that flag
 * when a script opens a new browser context, and the certificate login needs one.
 * It is removed unless CHROMIUM_SINGLE_PROCESS=1 puts it back.
 */
export function selectChromiumArgs(args: readonly string[], options: { keepSingleProcess?: boolean } = {}): string[] {
  return options.keepSingleProcess ? [...args] : args.filter((arg) => arg !== '--single-process');
}

export async function resolveSparticuz(env: Record<string, string | undefined> = process.env): Promise<ResolvedBrowser> {
  const { default: chromium } = await import('@sparticuz/chromium');
  return {
    executablePath: await chromium.executablePath(),
    args: selectChromiumArgs(chromium.args, { keepSingleProcess: env.CHROMIUM_SINGLE_PROCESS === '1' }),
  };
}
