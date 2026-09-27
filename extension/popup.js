// MemeBox – toolbar popup: send THIS tab's sound (YouTube, Instagram…) into the call's mic.
// Opening the popup counts as "invoking the extension" on this tab, which is what
// chrome.tabCapture requires – so the capture only ever happens on a tab you chose.
'use strict';

const $ = (id) => document.getElementById(id);
const { t } = globalThis.MemeI18n;
let tab = null;
let info = null;

function show(text, kind) {
  $('msg').textContent = text;
  $('msg').className = 'msg ' + (kind || '');
}

async function refresh() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  info = await chrome.runtime.sendMessage({ type: 'popup-info', tabId: tab && tab.id });
  $('send').hidden = true;
  $('stop').hidden = true;

  if (!info || info.callTabId == null) {
    show(t('pp_no_call'), 'warn');
    return;
  }
  if (info.thisIsCall) {
    show(t('pp_this_is_call'), 'warn');
    $('how').open = false;
    return;
  }
  if (info.sendingThisTab) {
    show(t('pp_sending'), 'ok');
    $('stop').hidden = false;
    return;
  }
  show(info.sendingOther ? t('pp_replace') : t('pp_start_video'), '');
  $('send').hidden = false;
}

$('send').addEventListener('click', async () => {
  $('send').disabled = true;
  show(t('pp_connecting'));
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id, consumerTabId: info.callTabId });
    const res = await chrome.runtime.sendMessage({ type: 'popup-start-tab-audio', callTabId: info.callTabId, sourceTabId: tab.id, streamId });
    if (!res || !res.ok) {
      const why = res && res.error === 'no-call' ? t('pp_join_unmute') : (res && res.error) || '?';
      show(t('pp_send_failed', why), 'err');
      $('send').disabled = false;
      return;
    }
    await refresh();
  } catch (err) {
    // e.g. chrome:// pages and the Web Store can't be captured.
    show(t('pp_cant_capture', err.message), 'err');
    $('send').disabled = false;
  }
});

$('stop').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'popup-stop-tab-audio', callTabId: info.callTabId });
  setTimeout(refresh, 300);
});

$('options').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });

refresh().catch((err) => show(t('pp_error', err.message), 'err'));
