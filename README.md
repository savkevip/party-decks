# Party Decks 🎉

A dead simple DJ app for house parties, built on YouTube.

Nobody wants to babysit a playlist all night. Drop songs in a queue, hit Play, and the app fades each song into the next one by itself, like a DJ with two decks. You only add songs, and so can your guests from their phones.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5199 on the laptop that plays the music.

## How it works

- **Two decks, A and B.** Each one is a YouTube player. Drag a song onto a deck, or click A / B next to it.
- **Crossfader** in the middle blends between the two decks.
- **Auto mix** fades in the next song from the queue when the current one has a few seconds left.
- **Queue:** paste a song link, or a whole playlist link (up to 1000 songs). Drag to reorder, search to find. Played songs stay at the bottom, marked "played".
- **Guests:** click 📱 Guests and show the QR code. Anyone on the same WiFi can send songs from their phone.
- **Effects:** horn, applause, drums and friends on keys 1 to 6.
- **Video** toggle: show the YouTube video, or a spinning record instead.

## Good to know

- Runs fully in the browser, plus the small dev server for guests and playlists. No accounts, no API keys.
- **Ads:** YouTube may play ads. Use the Brave browser or YouTube Premium to avoid them.
- Some songs can't be played outside youtube.com (the publisher blocks it). The app skips them.
- Just for fun, not a product. YouTube's terms don't allow selling something like this.

## Sounds

Free clips from [Mixkit](https://mixkit.co/free-sound-effects/) and [Pixabay](https://pixabay.com/sound-effects/), in `public/sounds`.
