# Language coverage

The extension and site offer 16 interface choices. Arabic, Bengali, English, French, Gujarati, Hindi, Indonesian, Marathi, Portuguese, Spanish, Tamil and Telugu have complete baseline dictionaries. New long helper/personality/Plans text still uses English in several bundles; the new core movement, music, picture and adult controls have localized strings. These additions need native review too.

German, Italian, Japanese and Punjabi are explicitly marked **Beta**. Their basic playback, settings, reaction and playlist controls are translated. Advanced controls, payment instructions and other untranslated text fall back to English. These are partial bundles, not four fully localized interfaces. Native speakers should review tone, terminology and clarity before removing the Beta label.

The extension merges the English dictionary when a language is selected, so the call panel and extension pages share the same fallback. Chrome itself uses its default-locale fallback when choosing the browser's language automatically. The site already falls back to English for missing keys.

Voice languages and interface languages are separate. The bundled speech engine supports 26 languages. Bhojpuri, Haryanvi, Rajasthani and other regional dialects need original recorded audio until a suitable bundled voice exists. Do not label Hindi or English speech as an authentic regional voice.

Review with a native speaker: settings, mute and stop controls, pass activation/pause, each checkout and recovery state, mobile layout, and screen-reader labels. Add remaining translations using the English keys and preserve `$1` placeholders. Run the i18n unit tests and browser language tests.
