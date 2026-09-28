// MemeBox site: feedback form and uninstall survey (English and Hindi).
// Sends only what the person filled in, plus the version and call site from the link
// the extension opened (?v=1.0.0&site=meet). Spam protection: Turnstile + a honeypot.
(() => {
  'use strict';

  const HI = {
    fb_title: 'MemeBox आपको कैसा लगा?',
    fb_intro: 'बस एक मिनट लगेगा। हम हर मैसेज पढ़ते हैं।',
    fb_rating: 'आपकी रेटिंग',
    fb_r1: 'खराब', fb_r2: 'ठीक-ठाक', fb_r3: 'अच्छा', fb_r4: 'बहुत पसंद आया',
    fb_used: 'आपने क्या इस्तेमाल किया?',
    fb_u_soundboard: 'साउंडबोर्ड', fb_u_voices: 'आवाज़ें', fb_u_clips: 'क्लिप्स',
    fb_u_tab: 'टैब की आवाज़', fb_u_voice: 'वॉइस चेंजर', fb_u_captions: 'कैप्शन',
    fb_wants: 'हमें आगे क्या जोड़ना चाहिए?',
    fb_message: 'आपका मैसेज',
    fb_email: 'ईमेल (वैकल्पिक, सिर्फ़ अगर आप जवाब चाहते हैं)',
    fb_send: 'फ़ीडबैक भेजें',
    fb_privacy: 'हम सिर्फ़ वही सेव करते हैं जो आप यहाँ लिखते हैं, और MemeBox का वर्ज़न। कोई ट्रैकिंग नहीं।',
    fb_thanks: 'धन्यवाद! 🙏',
    fb_thanks_text: 'आपका फ़ीडबैक भेज दिया गया। अब आप यह टैब बंद कर सकते हैं।',
    un_title: 'MemeBox हटा दिया गया',
    un_intro: 'आपको जाते देख दुख हुआ। एक छोटा सा सवाल हमें इसे बेहतर बनाने में मदद करेगा।',
    un_why: 'आपने इसे क्यों हटाया?',
    un_r_work: 'मेरी कॉल पर काम नहीं किया',
    un_r_hard: 'इस्तेमाल करना मुश्किल था',
    un_r_funny: 'मज़ेदार नहीं लगा',
    un_r_another: 'मुझे कोई दूसरा मिल गया',
    un_r_other: 'कुछ और',
    un_more: 'और कुछ कहना है? (वैकल्पिक)',
    un_send: 'भेजें',
    un_thanks_text: 'इससे सच में मदद मिलती है। अब आप यह टैब बंद कर सकते हैं।',
    privacy: 'प्राइवेसी',
    err_rating: 'कृपया एक रेटिंग चुनें।',
    err_reason: 'कृपया एक वजह चुनें।',
    err_email: 'यह ईमेल सही नहीं लग रहा।',
    err_network: 'भेजा नहीं जा सका। इंटरनेट चेक करके फिर कोशिश करें।',
    err_wait: 'स्पैम चेक अभी चल रहा है। कुछ सेकंड बाद फिर से भेजें।',
  };
  const EN_ERRORS = {
    err_rating: 'Please pick a rating.',
    err_reason: 'Please pick a reason.',
    err_email: "That email doesn't look right.",
    err_network: "Couldn't send. Check your internet and try again.",
    err_wait: 'The spam check is still running. Try again in a few seconds.',
  };
  const SITES = ['meet', 'zoom', 'teams', 'discord'];

  const params = new URLSearchParams(location.search);
  const lang = params.get('lang') === 'hi' || (params.get('lang') !== 'en' && /^hi\b/i.test(navigator.language)) ? 'hi' : 'en';
  const t = (key) => (lang === 'hi' && HI[key]) || EN_ERRORS[key] || key;

  if (lang === 'hi') {
    document.documentElement.lang = 'hi';
    for (const n of document.querySelectorAll('[data-t]')) if (HI[n.dataset.t]) n.textContent = HI[n.dataset.t];
  }

  const form = document.getElementById('form');
  const errorEl = document.getElementById('error');
  const type = form.dataset.type === 'uninstall' ? 'uninstall' : 'feedback';
  const version = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(params.get('v') || '') ? params.get('v') : '';
  const site = SITES.includes(params.get('site')) ? params.get('site') : '';

  // ---------- Turnstile ----------
  let token = '';
  let widget = null;

  function loadTurnstile(siteKey) {
    window.onMemeTurnstile = () => {
      widget = window.turnstile.render('#turnstile', {
        sitekey: siteKey,
        appearance: 'interaction-only', // stays invisible unless Cloudflare needs a click
        language: lang,
        callback: (x) => { token = x; },
        'expired-callback': () => { token = ''; },
        'error-callback': () => { token = ''; },
      });
    };
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onMemeTurnstile';
    s.async = true;
    document.head.append(s);
  }

  fetch('/api/config').then((r) => r.json()).then((c) => {
    if (c && c.turnstileSiteKey) loadTurnstile(c.turnstileSiteKey);
  }).catch(() => {});

  // ---------- submit ----------
  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
  }

  function collect() {
    const fd = new FormData(form);
    const body = { type, version, lang, website: String(fd.get('website') || ''), token };
    if (site) body.site = site;
    if (type === 'feedback') {
      body.rating = Number(fd.get('rating')) || 0;
      body.used = fd.getAll('used').map(String);
      body.wants = String(fd.get('wants') || '');
      body.message = String(fd.get('message') || '');
      body.email = String(fd.get('email') || '').trim();
    } else {
      body.reason = String(fd.get('reason') || '');
      body.message = String(fd.get('message') || '');
    }
    return body;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = collect();
    if (type === 'feedback' && !body.rating) return showError(t('err_rating'));
    if (type === 'uninstall' && !body.reason) return showError(t('err_reason'));
    if (body.email && !form.elements.email.checkValidity()) return showError(t('err_email'));
    if (!body.token && widget !== null) return showError(t('err_wait'));
    showError('');
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.hidden = true;
        document.getElementById('thanks').hidden = false;
        return;
      }
      showError(data.error || (data.errors && data.errors.join(' ')) || t('err_network'));
      if (widget !== null && window.turnstile) { token = ''; window.turnstile.reset(widget); }
    } catch {
      showError(t('err_network'));
    } finally {
      button.disabled = false;
    }
  });
})();
