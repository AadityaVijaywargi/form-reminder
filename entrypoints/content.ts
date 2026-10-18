import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { contentScriptMatches, pickProvider } from '@/providers/registry';
import { watchForm } from '@/lib/watcher';

export default defineContentScript({
  matches: contentScriptMatches,
  allFrames: true, // forms embedded in other sites (decision Q4)
  runAt: 'document_idle',

  main(ctx) {
    const adapter = pickProvider(new URL(location.href));
    if (!adapter) return;

    const cleanup = watchForm(adapter, {
      send: (msg) => {
        if (ctx.isInvalid) return;
        browser.runtime.sendMessage(msg).catch(() => {});
      },
    });
    ctx.onInvalidated(cleanup);
  },
});
