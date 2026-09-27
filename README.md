# PhotoRoulette

a better, free, photo roulette

A party game for phones: everyone in the room shares their camera roll, a random photo from **someone's** camera
roll pops up, and you have **5 seconds** to guess whose it is. Fast, correct answers score up to **500 points**.

## How it plays

1. **Open the app.** You're asked for camera-roll access, then a username.
2. **Create or join.** Create a game to get a 4-letter room code, or join a friend's game with their code.
3. **Lobby.** Everyone's avatar shows up live as they join. The host picks the number of rounds (1–30, with 5/10/15/20
   shortcuts) and starts the game once at least 2 players are in.
4. **Rounds.** Each phone quietly picks random photos from its own camera roll. Each round shows one photo, and
   **everyone**, including the photo's owner, has 5 seconds to tap the name of the person they think it belongs to.
   Nobody is told whose photo it is until the reveal, so owners have to recognise their own shots (and play it cool).
5. **Reveal and leaderboard.** The owner is revealed along with who guessed what. Then the leaderboard re-sorts itself
   with the new scores.
6. **Podium.** After the last round, a final podium with confetti. The host can hit **Play again** to return everyone to
   the lobby.

### Scoring

| Answer                       | Points                      |
| ---------------------------- | --------------------------- |
| Correct, instantly           | 500                         |
| Correct, at the buzzer (5 s) | 250                         |
| Correct, in between          | linear from 500 down to 250 |
| Wrong or no answer           | 0                           |

The 5-second clock starts when the photo actually appears on _your_ screen, so a slow download doesn't cost you time.
The server caps this at the time it actually observed, so a modified client can't claim a faster answer.

Photos are spread evenly across players, and the same person's photo never shows up twice in a row (when there's
anyone else to pick).

## Project layout

```
app/      Expo (React Native) app for iOS, Android and web
server/   Node + Socket.IO game server (rooms, rounds, scoring, photo hosting)
shared/   TypeScript types for the client/server protocol
```

## Playing on iPhones

You need one computer (Mac, Windows or Linux) to run the game while you play. Friends' iPhones can be on any network.

> **SDK versions:** Expo Go runs exactly one Expo SDK version, and the project has to match it. The App Store Expo Go
> is currently SDK 57, and so is this app. If Expo Go updates to a newer SDK, the project has to be upgraded to match.

### One-time setup

1. **On the computer**, install [Node.js](https://nodejs.org) 22.18 or newer, then download this repo and install
   everything:

   ```sh
   git clone https://github.com/AileshS/PhotoRoulette.git
   cd PhotoRoulette
   npm run setup
   ```

2. **Make one Expo account for the game.** Expo Go on iPhone only opens a project when Expo Go and the computer are
   signed in to the **same** Expo account ([Expo's docs](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/)).
   So every player signs in with one shared account. Create a free one just for game nights at
   [expo.dev/signup](https://expo.dev/signup), with a password you don't use anywhere else, since friends will know it.
   `npm run play` asks the computer to sign in the first time.

3. **On every iPhone**, install **Expo Go** from the App Store (free). Open it, tap the account icon in the top-right
   corner, and sign in with the game account.

### Each time you play

1. **Start the game** on the computer, from the `PhotoRoulette` folder:

   ```sh
   npm run play
   ```

   The first time, it asks you to sign in to the game's Expo account. Then it starts the game server and the app
   together and shows a QR code once the tunnel connects (give it a few seconds). Leave the window open while you play
   and press `Ctrl+C` when you're done.

2. **Open the app on each iPhone.** Point the regular **Camera** app at the QR code and tap the banner that appears.
   It opens in Expo Go. If iOS asks to let Expo Go find devices on your **local network**, tap **Allow**. The first
   load takes a little while.

3. **Give photo access and a name.** Tap **Allow photo access**. Choose **Allow Full Access** so the game can pick from
   your whole camera roll. **Limit Access** also works, but then only the photos you select can come up. Then type
   your name and tap **Let's play**.

4. **One person creates the game.** The host taps **Create game** and a 4-letter room code appears (tap it to copy).

5. **Everyone else joins.** Tap **Join game** and type the code. Each player pops into the lobby as they join.

6. **The host starts the game.** Pick the number of rounds (tap − / + or a 5 / 10 / 15 / 20 shortcut), then tap
   **Start game**. It needs at least 2 players.

7. **Play.** Each round a random photo appears. Tap whose you think it is within 5 seconds. Faster correct answers score
   more. After the reveal and the leaderboard, the next photo comes up automatically.

8. **Play again.** After the final podium, the host can tap **Play again** to go back to the lobby with the same group.

### How the connection works

`npm run play` uses an Expo **tunnel**: the QR code points at a public address (something like
`xxxx.boltexpo.dev`) that forwards to your computer, so phones don't need to be on your Wi-Fi and firewalls don't get
in the way. The app's game traffic rides along on the same address (Expo's dev server forwards it to the game server;
see `app/metro.config.js`). The address stays the same between game nights on the same computer.

This uses Expo's WebSocket tunnel (`@expo/ws-tunnel`) rather than ngrok, so there's no `ngrok.exe` for antivirus to
quarantine and it works on ARM PCs too. Expo built that tunnel for browser-based coding tools and only switches it on
through the `EXPO_FORCE_WEBCONTAINER_ENV` setting, which `npm run play` sets for you. If Expo ever changes it,
`npm run play:wifi` still works with everyone on one Wi-Fi.

If everyone is on the same Wi-Fi as the computer, `npm run play:wifi` skips the tunnel and is a bit faster.

### Troubleshooting

- **`git pull` says your local changes to `package-lock.json` would be overwritten**: an older `npm install` rewrote
  it. Throw that copy away with `git checkout -- app/package-lock.json` (or `server/…`), then `git pull` again.
  `npm run setup` uses `npm ci`, which never changes these files.
- **Stuck on "Opening project…"**: the phone can't reach your computer. Use `npm run play` (tunnel mode) rather than
  `play:wifi`, and wait for the QR code to appear before scanning.
- **"Project is incompatible with this version of Expo Go"**: Expo Go and the project are on different SDK versions
  (the message names both). Update Expo Go from the App Store. If Expo Go is now newer than the project (SDK 57), the
  project needs upgrading to match.
- **"You need to be signed in to Expo Go and Expo CLI"**, or **"these accounts need to match"**: sign in to Expo Go
  (account icon, top right) with the same account `npm run play` printed ("Signed in to Expo as …"). To switch the
  computer's account, run `npx expo logout` in the `app` folder, then `npm run play` again.
- **"Tunnel connection has been closed"** or the tunnel never connects: Expo's tunnel service had a hiccup. Press
  `Ctrl+C` and run `npm run play` again (see [status.expo.dev](https://status.expo.dev)), or use
  `npm run play:wifi` with everyone on the same Wi-Fi.
- **"WS-tunnel only supports tunneling over port 8081"** or "port 8081 is in use": another Expo project is still
  running. Close it (or restart the computer) and run `npm run play` again.
- **Wi-Fi mode on Windows hangs on "Opening project…"**: Windows Firewall blocks phones when your Wi-Fi is set to a
  **Public** network. Set it to **Private** (Settings → Network & internet → Wi-Fi → your network), and allow Node.js
  through the firewall if Windows asks. Or just use `npm run play`.
- **"Can't reach the game server"**: make sure the `npm run play` window is still open.
- **Local network was denied** (Wi-Fi mode only): on the iPhone go to **Settings → Privacy & Security → Local Network**
  and turn on Expo Go.
- **Photo access was denied**: on the iPhone go to **Settings → Expo Go → Photos** and choose **Full Access**.
- **A phone locks or switches apps mid-game**: just reopen Expo Go. The player rejoins the same game and keeps their
  score.

### Hosting the game server online

To skip running the game server on your computer, deploy `server/` to any Node host with HTTPS, then start the app
pointed at it (Expo still serves the app itself to Expo Go):

```sh
cd app
EXPO_PUBLIC_SERVER_URL=https://your-server.example.com EXPO_FORCE_WEBCONTAINER_ENV=1 npx expo start --tunnel
```

### Other platforms

- **Android:** the same steps work with Expo Go from the Play Store. Android restricts broad photo-library access, so
  if the camera-roll prompt doesn't work in Expo Go, use a development build (`npx expo run:android` or
  `eas build --profile development`).
- **Web:** `npm run play`, then press `w`, also works. Browsers can't browse a camera roll, so on the web you pick a batch of
  photos once and the game draws randomly from those.

## Privacy

- A phone only uploads the photos picked for the current game (about `rounds ÷ players` each), downscaled to at most
  1080 px.
- The server keeps photos **in memory only**, behind unguessable URLs. They're deleted when the game ends, the host
  starts over, or the room closes.
- Photo URLs don't reveal the owner. The owner is only sent to players at the reveal.

## Development

```sh
npm test                       # full games played by simulated phones against a real server
cd server && npm run typecheck
cd app && npm run typecheck && npm run lint
```

### Resilience

- **Reconnects:** if a phone drops (app backgrounded, network switch), it rejoins the same room automatically, even
  mid-game, and keeps its score.
- **Leaving:** if the host leaves, another player becomes host. If fewer than 2 players are left mid-game, the game
  returns to the lobby with a notice.
- **No photos:** if a player's phone can't provide photos (access denied, empty library, timeout), the other players'
  phones cover those rounds.
- **Late joiners** are turned away while a game is in progress. Rooms hold up to 16 players.
