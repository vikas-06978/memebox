// MemeBox: built-in meme packs. Original lines, friendly roasts only, nothing about religion,
// caste, gender, sexuality, looks, disability or any group). Classic script.
// The "general" pack is MEME.LINES in defaults.js.
(() => {
  'use strict';
  const hi = (id, text, say, tone, fav = 0) => ({ id, kind: 'tts', lang: 'hi', text, say, tone, fav });
  const en = (id, text, tone, fav = 0) => ({ id, kind: 'tts', lang: 'en', text, tone, fav });

  // Lines for people around the world, in their own language and accent (eSpeak voice of that language): local food, tea/coffee breaks and everyday jokes.
  const w = (lang, id, text, tone) => ({ id, kind: 'tts', lang, text, tone, fav: 0 });

  const fx = (id, sfx, text) => ({ id, kind: 'sfx', sfx, lang: 'en', text, tone: 'normal', fav: 0 });

  const PACKS = {
    // OPTIONAL pack of real sound effects, not speech (synthesized, see tools/lib/sfx.mjs). Not added automatically:
    // Options → Packs → Add.
    effects: [
      fx('p-fx-airhorn', 'airhorn', 'AIRHORN!'),
      fx('p-fx-rimshot', 'rimshot', 'Ba-dum-tss!'),
      fx('p-fx-sad-trombone', 'sad-trombone', 'Sad trombone: wah wah wah waaah'),
      fx('p-fx-drumroll', 'drumroll', 'Drumroll...'),
      fx('p-fx-wrong-buzzer', 'wrong-buzzer', 'WRONG!'),
      fx('p-fx-tada', 'tada', 'Ta-da!'),
      fx('p-fx-applause', 'applause', 'Applause!'),
      fx('p-fx-crickets', 'crickets', 'Crickets... awkward silence'),
      fx('p-fx-evil-laugh', 'evil-laugh', 'Mwahaha!'),
      fx('p-fx-dramatic', 'dramatic', 'Dun dun DUNNN!'),
      fx('p-fx-record-scratch', 'record-scratch', 'Record scratch... wait, what?'),
      fx('p-fx-boing', 'boing', 'BOING!'),
      fx('p-fx-slide-whistle', 'slide-whistle', 'Slide whistle'),
    ],
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
    world: [
      w("es", 'p-w-es-1', "¡Hora de la siesta!", 'slowmo'),
      w("es", 'p-w-es-2', "¡Ay, caramba!", 'excited'),
      w("es", 'p-w-es-3', "Mañana lo hago, sin falta", 'slowmo'),
      w("es", 'p-w-es-4', "¿Nos vamos de tapas?", 'normal'),
      w("fr", 'p-w-fr-1', "Pause café, s'il vous plaît !", 'normal'),
      w("fr", 'p-w-fr-2', "Oh là là, quel drame !", 'excited'),
      w("fr", 'p-w-fr-3', "On se fait une baguette ?", 'chipmunk'),
      w("fr", 'p-w-fr-4', "Je suis en réunion… enfin, presque", 'robot'),
      w("de", 'p-w-de-1', "Feierabend!", 'excited'),
      w("de", 'p-w-de-2', "Ordnung muss sein!", 'villain'),
      w("de", 'p-w-de-3', "Kaffee und Kuchen um drei!", 'normal'),
      w("de", 'p-w-de-4', "Du bist stumm geschaltet!", 'robot'),
      w("pt", 'p-w-pt-1', "Bora tomar um cafezinho?", 'normal'),
      w("pt", 'p-w-pt-2', "Foi mal, o Wi-Fi caiu", 'robot'),
      w("pt", 'p-w-pt-3', "Deixa comigo, eu resolvo… amanhã", 'slowmo'),
      w("pt", 'p-w-pt-4', "Que saudade!", 'excited'),
      w("it", 'p-w-it-1', "Mamma mia, che dramma!", 'excited'),
      w("it", 'p-w-it-2', "Facciamo una pausa caffè?", 'normal'),
      w("it", 'p-w-it-3', "Andiamo a mangiare la pizza!", 'chipmunk'),
      w("it", 'p-w-it-4', "Sei in muto!", 'robot'),
      w("id", 'p-w-id-1', "Ngopi dulu, yuk!", 'normal'),
      w("id", 'p-w-id-2', "Santai aja, bro", 'slowmo'),
      w("id", 'p-w-id-3', "Aduh, sinyalnya hilang!", 'robot'),
      w("id", 'p-w-id-4', "Besok aja deh, janji", 'villain'),
      w("tr", 'p-w-tr-1', "Çay molası!", 'excited'),
      w("tr", 'p-w-tr-2', "Hadi be!", 'chipmunk'),
      w("tr", 'p-w-tr-3', "Yarın yaparım, söz", 'slowmo'),
      w("tr", 'p-w-tr-4', "Mikrofonun kapalı kardeşim!", 'robot'),
      w("ar", 'p-w-ar-1', "يلا نشرب قهوة!", 'excited'),
      w("ar", 'p-w-ar-2', "ميكروفونك مغلق يا صديقي!", 'robot'),
      w("ar", 'p-w-ar-3', "أنا في الاجتماع… تقريباً", 'slowmo'),
      w("ar", 'p-w-ar-4', "يلا بينا!", 'chipmunk'),
      w("bn", 'p-w-bn-1', "চায়ের বিরতি!", 'excited'),
      w("bn", 'p-w-bn-2', "আড্ডা দেওয়া যাক", 'normal'),
      w("bn", 'p-w-bn-3', "দাদা, মিউট করে দাও", 'robot'),
      w("bn", 'p-w-bn-4', "ইলিশ মাছ দিয়ে ভাত!", 'chipmunk'),
      w("ta", 'p-w-ta-1', "டீ பிரேக்!", 'excited'),
      w("ta", 'p-w-ta-2', "என்ன மச்சான் சொல்ற?", 'chipmunk'),
      w("ta", 'p-w-ta-3', "நாளைக்கு கண்டிப்பா படிக்கிறேன்", 'slowmo'),
      w("ta", 'p-w-ta-4', "இன்னைக்கும் வைஃபை ஏமாத்திடுச்சு", 'villain'),
      w("te", 'p-w-te-1', "చాయ్ బ్రేక్!", 'excited'),
      w("te", 'p-w-te-2', "ఏంట్రా బాబు ఇది?", 'chipmunk'),
      w("te", 'p-w-te-3', "రేపు పక్కా చేస్తా", 'slowmo'),
      w("te", 'p-w-te-4', "మ్యూట్ చెయ్యి బ్రదర్", 'robot'),
      w("mr", 'p-w-mr-1', "चहाचा ब्रेक!", 'excited'),
      w("mr", 'p-w-mr-2', "काय रे भावा?", 'chipmunk'),
      w("mr", 'p-w-mr-3', "उद्यापासून नक्की अभ्यास", 'slowmo'),
      w("mr", 'p-w-mr-4', "वडापाव खायला जायचं का?", 'normal'),
      w("gu", 'p-w-gu-1', "ચાનો બ્રેક!", 'excited'),
      w("gu", 'p-w-gu-2', "કેમ છો, મજામાં?", 'normal'),
      w("gu", 'p-w-gu-3', "ચાલો ફાફડા જલેબી ખાવા જઈએ", 'chipmunk'),
      w("gu", 'p-w-gu-4', "કાલથી પાક્કું કામ કરીશ", 'slowmo'),
      w("pa", 'p-w-pa-1', "ਚਾਹ ਦਾ ਬਰੇਕ!", 'excited'),
      w("pa", 'p-w-pa-2', "ਓਏ ਹੋਏ, ਕੀ ਗੱਲ ਆ!", 'chipmunk'),
      w("pa", 'p-w-pa-3', "ਚੱਲ ਲੱਸੀ ਪੀਣ ਚੱਲੀਏ", 'normal'),
      w("pa", 'p-w-pa-4', "ਕੱਲ੍ਹ ਤੋਂ ਪੱਕਾ ਪੜ੍ਹਾਂਗਾ", 'slowmo'),
      w("ur", 'p-w-ur-1', "چائے کا وقفہ!", 'excited'),
      w("ur", 'p-w-ur-2', "یار، مائیک بند کرو", 'robot'),
      w("ur", 'p-w-ur-3', "کل سے پکا کام کروں گا", 'slowmo'),
      w("ur", 'p-w-ur-4', "چلو بریانی کھانے چلیں", 'chipmunk'),
      w("vi", 'p-w-vi-1', "Nghỉ uống cà phê thôi!", 'excited'),
      w("vi", 'p-w-vi-2', "Đi ăn phở không?", 'chipmunk'),
      w("vi", 'p-w-vi-3', "Mai làm, hứa luôn!", 'slowmo'),
      w("vi", 'p-w-vi-4', "Mạng lại rớt rồi", 'robot'),
      w("ja", 'p-w-ja-1', "お疲れさまです！", 'normal'),
      w("ja", 'p-w-ja-2', "ちょっと休憩しましょう", 'slowmo'),
      w("ja", 'p-w-ja-3', "明日から本気出す", 'villain'),
      w("ja", 'p-w-ja-4', "ラーメン食べに行こう", 'excited'),
      w("ko", 'p-w-ko-1', "치맥 하러 가자!", 'excited'),
      w("ko", 'p-w-ko-2', "대박!", 'chipmunk'),
      w("ko", 'p-w-ko-3', "내일부터 진짜 열심히 할게", 'slowmo'),
      w("ko", 'p-w-ko-4', "커피 한잔 할까요?", 'normal'),
      w("nl", 'p-w-nl-1', "Koffiepauze!", 'excited'),
      w("nl", 'p-w-nl-2', "Gezellig!", 'chipmunk'),
      w("nl", 'p-w-nl-3', "Doe maar gewoon, dan doe je al gek genoeg", 'villain'),
      w("nl", 'p-w-nl-4', "Je staat op mute!", 'robot'),
      w("pl", 'p-w-pl-1', "Przerwa na kawę!", 'excited'),
      w("pl", 'p-w-pl-2', "Nie ma problemu… jutro", 'slowmo'),
      w("pl", 'p-w-pl-3', "Na zdrowie!", 'chipmunk'),
      w("pl", 'p-w-pl-4', "Pierogi na obiad?", 'normal'),
      w("sw", 'p-w-sw-1', "Hakuna matata!", 'excited'),
      w("sw", 'p-w-sw-2', "Pole pole", 'slowmo'),
      w("sw", 'p-w-sw-3', "Tunywe chai!", 'chipmunk'),
      w("sw", 'p-w-sw-4', "Kesho nitafanya, ahadi", 'villain'),
      w("ro", 'p-w-ro-1', "Pauză de cafea!", 'excited'),
      w("ro", 'p-w-ro-2', "Las' că merge și așa", 'slowmo'),
      w("ro", 'p-w-ro-3', "Noroc!", 'chipmunk'),
      w("ro", 'p-w-ro-4', "Mâine fac, promit", 'villain'),
      w("sv", 'p-w-sv-1', "Fika!", 'excited'),
      w("sv", 'p-w-sv-2', "Lagom är bäst", 'slowmo'),
      w("sv", 'p-w-sv-3', "Jag gör det imorgon, jag lovar", 'villain'),
      w("sv", 'p-w-sv-4', "Du är på mute!", 'robot'),
      w("fa", 'p-w-fa-1', "وقت چای!", 'excited'),
      w("fa", 'p-w-fa-2', "بریم کباب بخوریم؟", 'chipmunk'),
      w("fa", 'p-w-fa-3', "فردا حتماً انجامش میدم", 'slowmo'),
      w("fa", 'p-w-fa-4', "میکروفونت رو ببند دیگه", 'robot'),
    ],
  };

  for (const [cat, lines] of Object.entries(PACKS)) {
    for (const l of lines) Object.assign(l, { category: cat, volume: 1 });
  }

  globalThis.MEME_PACKS = Object.freeze({
    ids: ['general', 'effects', 'college', 'cricket', 'office', 'party', 'world'],
    // Lines of one built-in pack (fresh copies).
    lines(id) {
      if (id === 'general') return globalThis.MEME.defaultLines();
      return (PACKS[id] || []).map((l) => ({ ...l }));
    },
    // Built-in lines a stored library doesn't have yet, for people who updated (own lines are never touched).
    // seeded: 0 = from before packs existed. The optional Sound effects pack is never added by itself:
    // people add it in Options → Packs, so Random and the list stay exactly as they were.
    missing(lines, seeded) {
      if (seeded >= 2) return [];
      const have = new Set(lines.map((l) => l && l.id));
      const fresh = seeded >= 1 ? this.lines('world') : this.all(); // v1 people already have the other packs: only the world pack is new
      return fresh.filter((l) => !have.has(l.id)).map((l) => ({ ...l, fav: 0 }));
    },
    // Every built-in line that comes with a first install (not the optional Sound effects pack).
    all() {
      return this.ids.filter((id) => id !== 'effects').flatMap((id) => this.lines(id));
    },
  });
})();
