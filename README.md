# CyberQuest: The AI Defense Protocol

CyberQuest is an interactive security-operations simulator that runs in a web browser. The player is an AI security analyst defending a fictional organisation's network. In about four minutes they investigate alerts, train a real machine-learning model, decide when to trust an AI copilot, and respond to a coordinated attack under time pressure.

It was built as an educational exhibition experience introducing the **Artificial Intelligence & Cybersecurity** major at King Fahd University of Petroleum & Minerals (KFUPM). It is a student/portfolio project and is not an official university product or endorsed by the university.

![Mission 1: investigating an alert on the security console](docs/screenshots/console.png)

---

## Contents

1. [Motivation](#motivation)
2. [Features](#features)
3. [Screenshots](#screenshots)
4. [Gameplay](#gameplay)
5. [Technology](#technology)
6. [Project structure](#project-structure)
7. [Running locally](#running-locally)
8. [Deploying to GitHub Pages](#deploying-to-github-pages)
9. [How the AI works](#how-the-ai-works)
10. [Educational concepts](#educational-concepts)
11. [Leaderboard limitations](#leaderboard-limitations)
12. [Testing](#testing)
13. [Future improvements](#future-improvements)

---

## Motivation

Visitors to an exhibition booth have a few minutes and no background in security. A poster can say "AI and cybersecurity complement each other". CyberQuest lets them *experience* it instead:

- an anomaly score that is high for perfectly legitimate work,
- a model that gets worse when they label its training data badly,
- an AI copilot that is confidently wrong, twice,
- an incident where blocking the wrong thing hurts the business as much as missing an attack.

The goal is for visitors to leave thinking: *I didn't realise AI and cybersecurity could be this interesting.*

## Features

- **Four connected missions**, about 3–5 minutes in total, with no sign-up and no reading manual.
- **Interactive network map**: an SVG schematic of the organisation with device states (suspicious, compromised, isolated, secured), live traffic and clickable devices. It switches to a tall layout on phones.
- **NEXUS AI copilot**: a transparent rule-based engine that shows every rule it fired and its weight. It can only see network telemetry, so it makes realistic mistakes.
- **Real machine learning** in Mission 2: a k-nearest-neighbours classifier trained in the browser on the player's labels and evaluated on a held-out test set.
- **Consequences**: decisions move system integrity, operational stability, threat level and score. Isolating legitimate services costs stability; ignoring threats costs integrity.
- **Transparent scoring**: every point is written to a ledger that the results screen breaks down line by line. Nothing is random.
- **Results and ranks**: five deterministic ranks, a result card that can be downloaded as a PNG, and a "What you learned" debrief personalised to the run.
- **Local leaderboard**: top 10 on the device, with reset protected by a confirmation.
- **Built for a booth**: large controls, keyboard shortcuts, optional how-to, persistent restart and mute, an idle prompt that returns the game to the start screen, and fully offline operation (fonts are self-hosted).
- **Accessible**: semantic HTML, keyboard navigation, visible focus, live-region announcements, `prefers-reduced-motion` support and AA contrast for text.

## Screenshots

These are real captures from the game, not mock-ups. They were taken during a scripted test run, which is why the completion time is so short.

| Start screen | Mission 2: training results |
| --- | --- |
| ![Start screen](docs/screenshots/intro.png) | ![Defender model results](docs/screenshots/training.png) |

| Mission 3: following or overriding NEXUS | Mission report |
| --- | --- |
| ![Human vs AI](docs/screenshots/versus.png) | ![Results](docs/screenshots/results.png) |

## Gameplay

| | Mission | What the player does | Concept |
| --- | --- | --- | --- |
| 1 | **Identify the intrusion** | Inspects four overnight alerts and chooses Investigate, Isolate, Allow or Dismiss. Two are legitimate: a scheduled vulnerability scan with a high anomaly score, and an approved admin session. | Anomaly detection, false positives |
| 2 | **Train the AI defender** | Labels eight events as benign or malicious, trains the model, then sees how it does on six unseen events, including which neighbours drove each prediction. They can flip labels and retrain as an experiment; the score is locked to the first run. | Supervised learning, data quality, uncertainty, data leakage |
| 3 | **Human vs. AI** | NEXUS recommends an action for four incidents. The player can inspect context records, then follow or override. NEXUS is wrong twice: a month-end backup (false positive) and an MFA-fatigue account takeover (false negative). | Human–AI collaboration |
| 4 | **Final defense** | Four alerts arrive within seconds and active threats drain integrity every second. The player prioritises, inspects and picks one of three containment options per alert, against a 90-second clock. | Incident response, prioritisation, availability |

### Scoring

| Source | Points |
| --- | --- |
| Best response (Missions 1, 3) | +100 (+150 for correctly overriding a wrong AI call) |
| Acceptable / partly right response | +70 / +20–30 |
| Wrong response | −40 to −80, plus integrity or stability damage |
| Checking evidence before a correct Mission 3 decision | +20 |
| Each correct training label / each correct test prediction | +15 / +25 |
| Mission 4 best / acceptable / wrong option | +150 / +60 / −80 |
| Mission 4 priority (handling the ransomware first) | +100 (−50 for starting with the legitimate payroll transfer) |
| Mission 4 unhandled threat | −60 |
| Mission completion | +50 each |
| Decisiveness (Missions 1–3, at or under par time) | up to +50 each |
| Mission 4 time remaining / final integrity | +2 per second / +2 per integrity point |

Ranks: **Cyber Recruit** (below 800), **Threat Hunter** (800+), **Security Analyst** (1,300+), **Cyber Defender** (1,800+), **Elite AI Guardian** (2,200+). A perfect, fast run scores roughly 2,600.

### Keyboard

| Key | Action |
| --- | --- |
| `E` | Inspect evidence |
| `I` `X` `A` `D` | Investigate / Isolate / Allow / Dismiss (Mission 1) |
| `F` `O` | Follow AI / Override AI (Mission 3) |
| `1` `2` `3` | Choose a containment option (Mission 4) |
| `N` | Next alert or complete the mission |
| `Esc` | Close a dialog |

## Technology

- HTML5, CSS3 (custom properties, grid, container queries) and vanilla JavaScript (ES2017+).
- SVG for the network map and rank emblem; Canvas for the downloadable result card.
- Web Audio API for short synthesised sound effects (no audio files).
- `localStorage` for the leaderboard and the mute preference.
- **No frameworks, no build step, no backend, no API keys, no external requests at runtime.**

Scripts are plain classic scripts sharing one `CQ` namespace rather than ES modules. That is deliberate: it means `index.html` also works when opened directly from disk (`file://`), which is common on exhibition laptops.

## Project structure

```text
CyberQuest/
├── index.html              App shell: intro, console, results, dialog layer
├── css/
│   ├── style.css           Design tokens, fonts, base type, screen layouts, breakpoints
│   ├── components.css      Buttons, panels, map, case files, lab, dialogs, results
│   └── animations.css      Functional motion and reduced-motion overrides
├── js/
│   ├── scenarios.js        All incident data, network topology, mission copy (no logic)
│   ├── ai-engine.js        NEXUS rule engine and the k-NN classifier
│   ├── game.js             Game state, scoring ledger, ranks, managed timers (no DOM)
│   ├── leaderboard.js      Leaderboard with a swappable storage adapter
│   ├── audio.js            Web Audio sound cues and mute
│   ├── network.js          SVG network map: layouts, routing, states, packets
│   ├── ui.js               Safe DOM builder, status bar, queue, NEXUS feed, dialogs
│   ├── missions.js         The four mission controllers
│   ├── results.js          Results screen, leaderboard view, debrief, result card
│   └── app.js              Screen flow, run lifecycle, keyboard, idle watchdog
├── assets/
│   ├── fonts/              Self-hosted Space Grotesk, IBM Plex Sans, IBM Plex Mono (OFL)
│   └── icons/favicon.svg
├── docs/screenshots/       Captures used in this README
├── tests/logic.test.js     Dependency-free tests for engine, classifier, scoring, leaderboard
├── README.md
└── LICENSE
```

Gameplay rules (`game.js`, `ai-engine.js`, `scenarios.js`) contain no DOM code, so they can be tested in Node. Scenarios are pure data: adding an incident means adding an object, not changing the engine.

## Running locally

No installation is needed.

**Option 1: open the file.** Double-click `index.html`. Everything, including fonts, loads from the repository.

**Option 2: serve the folder** (recommended, closest to GitHub Pages):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

For an exhibition, open the page in a full-screen browser window (F11). The game returns to the start screen after a period of inactivity, so it's ready for the next visitor.

## Deploying to GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the branch (for example `main`) and the `/ (root)` folder, then save.
4. After a minute the site is published at `https://<user>.github.io/<repository>/`.

All asset paths are relative, so the game works from a project sub-path, not just a domain root. The repository includes an empty `.nojekyll` file so Pages serves the files as they are.

## How the AI works

CyberQuest contains two different kinds of "AI", and the game is explicit about which is which.

### NEXUS: a simulated, rule-based copilot

NEXUS is **not** a language model and is **not** connected to anything. It is a weighted rule engine in `js/ai-engine.js`:

- Each incident has *telemetry*: counts, ratios and flags such as failed logins, data volume relative to baseline, off-hours activity, destination reputation, whether the program is signed.
- About twenty rules each add or subtract a fixed weight (for example, `+35` for volume over 10× baseline, `−25` when multi-factor authentication passed).
- The **risk score** is the sum of fired weights clamped to 0–100. **It is not a probability** and is not calibrated against real data; the interface says so.
- Bands: under 40 → allow, 40–69 → investigate, 70+ → contain. **Confidence** reflects only how far the score sits from a band threshold.
- NEXUS only sees telemetry. Business context such as change tickets, schedules and HR records is shown to the player as "context records" that NEXUS cannot read. That is why it raises a false positive on an approved month-end backup and misses an account takeover that passed MFA. These mistakes come out of the rules, not from a flag saying "be wrong here", and the test suite checks that they happen.

### The Defender: a real k-nearest-neighbours classifier

Mission 2 uses genuine machine learning, implemented from scratch in a few dozen lines:

- **Features** (normalised 0–1): failed logins, unusual hour, destination risk, data volume, device unfamiliarity.
- **Training data**: eight synthetic events. Their labels come **only from the player**. The ground truth is used afterwards to score labelling, never to train.
- **Algorithm**: k-NN with *k* = 3 and Euclidean distance. "Training" stores the labelled examples (k-NN is a lazy learner); a prediction is the majority label among the three nearest examples.
- **Evaluation**: six held-out events that are never shown during labelling and never used in training. The game reports accuracy, false positives, false negatives, the three neighbours behind each prediction, and flags 2-to-1 votes as uncertain.
- **Data leakage**: players may flip labels and retrain to see the effect, but the score is locked to the first run, and the game explains why tuning against the test set would be cheating.

With correct labels the model scores 6/6. Labelling everything "benign" drops it to 3/6, with three missed attacks. Mislabelling a single example such as T3 or T5 costs two predictions.

## Educational concepts

The end-of-game debrief connects each concept to what the player actually did in that run:

- **Anomaly detection**: unusual is not the same as malicious.
- **Machine learning**: models learn patterns from labelled examples; bad labels make bad models.
- **False positives**: legitimate activity flagged as a threat (the scan, the backup, the payroll transfer).
- **False negatives**: real attacks scored as safe (MFA fatigue, a slow leak to a "trusted" cloud provider).
- **Human–AI collaboration**: AI scores signals at scale; people bring context and judgement.
- **Incident response**: prioritise what spreads, contain precisely, keep the business running.

All scenarios are fictional and safe. External addresses come from the documentation-reserved ranges in RFC 5737 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`), domains use the reserved `.example` TLD, and no code touches a real network.

## Leaderboard limitations

- Scores are stored in the browser's `localStorage`, **only on the device where the game was played**. They do not sync between machines, and clearing site data erases them.
- Players can edit `localStorage` in the browser's developer tools, so scores are not tamper-proof. That is acceptable for a friendly booth competition.
- Each run is saved once, keyed by a run ID, so repeated clicks or re-renders cannot create duplicates.
- `js/leaderboard.js` takes a storage adapter with `load`, `save` and `clear`. A shared backend can be added by writing an adapter that talks to an API, without changing the UI.

## Testing

Logic tests (no dependencies):

```bash
node tests/logic.test.js
```

They cover the rule engine (bands, clamping, and that NEXUS really does make the intended false positive and false negative), the classifier (perfect with correct labels, sensitive to wrong labels, no train/test overlap), scoring, ranks, nickname sanitisation, timer cleanup and leaderboard ordering and de-duplication.

During development the full game was also played end to end in headless Chromium (Playwright) at 375, 768, 1024 and 1440 px wide, checking every mission on correct and incorrect decision paths, the results screen, the leaderboard and the debrief for console errors and horizontal overflow.

## Future improvements

- Optional shared leaderboard through a small backend adapter.
- Arabic localisation with right-to-left layout.
- More scenario packs (phishing triage, cloud misconfiguration, insider threat) and a randomised scenario order for replay variety.
- A "booth mode" settings screen for staff (session length, idle timeout, leaderboard reset PIN).
- A small decision-tree classifier alongside k-NN, to compare interpretable models.

## License

Code is released under the MIT License (see `LICENSE`). Fonts in `assets/fonts` are licensed under the SIL Open Font License 1.1.
