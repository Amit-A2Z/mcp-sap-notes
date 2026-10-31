// Playwright looks for its own Chromium download. A serverless function has none, so the
// browser comes from another package. Both our code and the auth library call
// `chromium.launch(...)` on the same object, so wrapping that one method covers both.

export interface ResolvedBrowser {
  executablePath: string;
  args: string[];
}

interface Launchable {
  launch: (options?: any) => Promise<any>;
}

const MARK = Symbol.for('sap-notes.vercel.launcher');

export function installLauncher(browserType: Launchable, resolve: () => Promise<ResolvedBrowser>): void {
  const target = browserType as Launchable & { [MARK]?: boolean };
  if (target[MARK]) return;

  const original = target.launch.bind(target);
  let resolved: Promise<ResolvedBrowser> | undefined;

  target.launch = async (options: any = {}) => {
    resolved ??= resolve();
    const browser = await resolved;
    return original({
      ...options,
      executablePath: browser.executablePath,
      args: [...browser.args, ...(options.args ?? [])],
    });
  };
  target[MARK] = true;
}
