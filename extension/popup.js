// MemeBox – toolbar popup: send THIS tab's sound (YouTube, Instagram…) into the call's mic.
// Opening the popup counts as "invoking the extension" on this tab, which is what
// chrome.tabCapture requires – so the capture only ever happens on a tab you chose.
'use strict';

const $ = (id) => document.getElementById(id);
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
    show('Join a call first (in another tab), then come back to the video tab and click here.', 'warn');
    return;
  }
  if (info.thisIsCall) {
    show('This is your call tab. Open the YouTube / Instagram tab and click MemeBox there to send its sound. Use 😂 on this page for memes.', 'warn');
    $('how').open = false;
    return;
  }
  if (info.sendingThisTab) {
    show("✅ This tab's sound is going into your call.", 'ok');
    $('stop').hidden = false;
    return;
  }
  show(info.sendingOther
    ? "Another tab is being sent right now. Sending this one will replace it."
    : 'Start the video at the funny part, then:', '');
  $('send').hidden = false;
}

$('send').addEventListener('click', async () => {
  $('send').disabled = true;
  show('Connecting…');
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id, consumerTabId: info.callTabId });
    const res = await chrome.runtime.sendMessage({ type: 'popup-start-tab-audio', callTabId: info.callTabId, sourceTabId: tab.id, streamId });
    if (!res || !res.ok) {
      const why = res && res.error === 'no-call' ? 'Join the call and unmute first.' : (res && res.error) || 'Unknown error';
      show("Couldn't send this tab: " + why, 'err');
      $('send').disabled = false;
      return;
    }
    await refresh();
  } catch (err) {
    // e.g. chrome:// pages and the Web Store can't be captured.
    show("Chrome won't let this tab be captured: " + err.message, 'err');
    $('send').disabled = false;
  }
});

$('stop').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'popup-stop-tab-audio', callTabId: info.callTabId });
  setTimeout(refresh, 300);
});

$('options').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });

refresh().catch((err) => show('Error: ' + err.message, 'err'));
