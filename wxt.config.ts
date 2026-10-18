import { defineConfig } from 'wxt';
import { contentScriptMatches, submitRequestUrls } from './providers/registry';

// Hosts the relay lives on. Apps Script web apps answer from script.google.com and
// redirect the response body to script.googleusercontent.com.
const RELAY_HOSTS = ['https://script.google.com/macros/*', 'https://script.googleusercontent.com/*'];

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Form Submit Receipt',
    description:
      'Get an email receipt (form name, time and your answers) every time you submit an online form.',
    // webRequest only observes (never blocks) the providers' submit requests.
    permissions: ['storage', 'alarms', 'notifications', 'webRequest'],
    host_permissions: [...new Set([...contentScriptMatches, ...submitRequestUrls, ...RELAY_HOSTS])],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'form-receipt@formreceipt.app',
          strict_min_version: '128.0',
          // AMO data disclosure: the email address, form titles/links and answers leave the device.
          data_collection_permissions: {
            required: ['personallyIdentifyingInfo', 'websiteActivity', 'websiteContent'],
          },
        },
        gecko_android: { strict_min_version: '128.0' },
      },
    }),
  }),
});
