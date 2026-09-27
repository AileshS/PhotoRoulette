# PhotoRoulette

a better, free, photo roulette

A party game for phones: everyone in the room shares their camera roll, a random photo from **someone's** camera
roll pops up, and you have **5 seconds** to guess whose it is. Fast, correct answers score up to **500 points**.

## How it plays

1. **Open the app.** You're asked for camera-roll access, then a username.
2. **Create or join.** Create a game to get a 4-letter room code, or join a friend's game with their code.
3. **Lobby.** Everyone's avatar shows up live as they join. The host picks the number of rounds (1–30, with 5/10/15/20
   shortcuts) and starts the game once at least 2 players are in.
4. **Rounds.** Each phone quietly picks random photos from its own camera roll. Each round shows one photo, and every
   other player has 5 seconds to tap the name of the person they think it belongs to. The owner sees _"This one's
   yours! Keep a straight face."_ and sits that round out.
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

## Running it

You need Node 22.18+ (the server runs TypeScript directly with Node's built-in type stripping).

### 1. Start the game server

```sh
cd server
npm install
npm start            # listens on port 3001 (set PORT to change)
```

### 2. Start the app

```sh
cd app
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone. During development the app automatically connects to the game server
on the same machine that serves the app (port 3001), so phones on the same Wi-Fi just work. To point at a deployed
server instead:

```sh
EXPO_PUBLIC_SERVER_URL=https://your-server.example.com npx expo start
```

Every player needs the app and has to reach the same server.

> **Android note:** Android restricts broad photo-library access. If the camera-roll prompt doesn't work in Expo Go on
> your device, use a development build instead (`npx expo run:android` or `eas build --profile development`).

**Web:** `npx expo start --web` also works. Browsers can't browse a camera roll, so on the web you pick a batch of
photos once and the game draws randomly from those.

## Privacy

- A phone only uploads the photos picked for the current game (about `rounds ÷ players` each), downscaled to at most
  1080 px.
- The server keeps photos **in memory only**, behind unguessable URLs. They're deleted when the game ends, the host
  starts over, or the room closes.
- Photo URLs don't reveal the owner. The owner is only sent to players at the reveal.

## Development

```sh
cd server && npm test          # full games played by simulated phones against a real server
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
