// MemeBox: built-in meme packs. Original lines, friendly roasts only, nothing about religion,
// caste, gender, sexuality, looks, disability or any group). Classic script.
// The "general" pack is MEME.LINES in defaults.js.
(() => {
  'use strict';
  const hi = (id, text, say, tone, fav = 0) => ({ id, kind: 'tts', lang: 'hi', text, say, tone, fav });
  const en = (id, text, tone, fav = 0) => ({ id, kind: 'tts', lang: 'en', text, tone, fav });

  const PACKS = {
    college: [
      hi('p-college-1', 'Attendance 75% nahi hai? Medical certificate ready rakh', 'अटेंडेंस पचहत्तर परसेंट नहीं है? मेडिकल सर्टिफ़िकेट रेडी रख', 'villain'),
      hi('p-college-2', 'Assignment kal submit hai? Aaj raat ka plan: panic', 'असाइनमेंट कल सबमिट है? आज रात का प्लान: पैनिक', 'excited'),
      hi('p-college-3', 'Sir, network issue tha', 'सर, नेटवर्क इशू था', 'robot'),
      en('p-college-4', 'Backbenchers, assemble!', 'excited'),
      hi('p-college-5', 'Proxy laga de bhai', 'प्रॉक्सी लगा दे भाई', 'chipmunk'),
      hi('p-college-6', 'Exam se ek raat pehle: full syllabus, zero tension', 'एग्ज़ाम से एक रात पहले: फ़ुल सिलेबस, ज़ीरो टेंशन', 'slowmo'),
      en('p-college-7', 'Group project: one person works, four people nod', 'normal'),
      hi('p-college-8', 'Canteen chalein?', 'कैंटीन चलें?', 'normal'),
    ],
    cricket: [
      hi('p-cricket-1', 'Kya shot hai!', 'क्या शॉट है!', 'excited'),
      hi('p-cricket-2', 'Out! Seedha pavilion', 'आउट! सीधा पवेलियन', 'villain'),
      hi('p-cricket-3', 'Free hit mil gaya', 'फ़्री हिट मिल गया', 'chipmunk'),
      en('p-cricket-4', "That's a massive six!", 'excited'),
      hi('p-cricket-5', 'DRS le lo bhai', 'डीआरएस ले लो भाई', 'robot'),
      en('p-cricket-6', 'Rain stopped play', 'slowmo'),
      hi('p-cricket-7', 'Last over, full drama', 'लास्ट ओवर, फ़ुल ड्रामा', 'villain'),
      en('p-cricket-8', 'Howzat!', 'excited'),
    ],
    office: [
      en('p-office-1', 'Can you see my screen?', 'robot'),
      en('p-office-2', "Let's take this offline", 'normal'),
      hi('p-office-3', 'Ye meeting ek email ho sakti thi', 'ये मीटिंग एक ईमेल हो सकती थी', 'villain'),
      en('p-office-4', 'Sorry, I was on mute', 'chipmunk'),
      hi('p-office-5', 'Deadline kal hai? Kal dekhenge', 'डेडलाइन कल है? कल देखेंगे', 'slowmo'),
      en('p-office-6', 'Per my last email...', 'villain'),
      hi('p-office-7', 'Chai pe discuss karte hain', 'चाय पे डिस्कस करते हैं', 'normal'),
      en('p-office-8', 'Friday deploy? Bold move', 'excited'),
    ],
    party: [
      hi('p-party-1', 'Party toh banti hai!', 'पार्टी तो बनती है!', 'excited'),
      hi('p-party-2', 'DJ, volume badhao!', 'डीजे, वॉल्यूम बढ़ाओ!', 'chipmunk'),
      en('p-party-3', 'Happy birthday to you!', 'excited'),
      hi('p-party-4', 'Nacho nacho!', 'नाचो नाचो!', 'chipmunk'),
      hi('p-party-5', 'Cake kaatne ka time!', 'केक काटने का टाइम!', 'excited'),
      en('p-party-6', "Let's goooo!", 'excited'),
      hi('p-party-7', 'Ek selfie ho jaye', 'एक सेल्फ़ी हो जाए', 'normal'),
      en('p-party-8', 'Weekend mode: ON', 'robot'),
    ],
  };

  for (const [cat, lines] of Object.entries(PACKS)) {
    for (const l of lines) Object.assign(l, { category: cat, volume: 1 });
  }

  globalThis.MEME_PACKS = Object.freeze({
    ids: ['general', ...Object.keys(PACKS)],
    // Lines of one built-in pack (fresh copies).
    lines(id) {
      if (id === 'general') return globalThis.MEME.defaultLines();
      return (PACKS[id] || []).map((l) => ({ ...l }));
    },
    // Every built-in line, for the first install.
    all() {
      return this.ids.flatMap((id) => this.lines(id));
    },
  });
})();
