# Gesture Arena — Rock Paper Scissors AI

A browser-based Rock–Paper–Scissors game that recognizes hand gestures in real time using **MediaPipe Hand Landmarker**. It includes a neon gaming interface, live landmark overlay, gesture stabilization, countdown animation, score tracking, and responsive layout.

## Features

- Real-time hand tracking from the browser camera
- Rule-based gesture recognition:
  - **Rock:** all four fingers folded
  - **Paper:** all four fingers extended
  - **Scissors:** index and middle fingers extended, ring and pinky folded
- Multi-frame smoothing to reduce flickering
- Animated countdown and move reveal
- Player/computer/draw scoreboard and reset control
- Camera processing runs locally in the browser; frames are not uploaded by this app
- Responsive UI for desktop and mobile layouts

## Demo

After deploying with GitHub Pages, add your live URL here:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

## Run locally

Camera access generally requires **localhost or HTTPS**. Do not open `index.html` by double-clicking it.

### Option A: Python

1. Install Python 3 if you do not already have it.
2. Open a terminal in this folder.
3. Run:

   ```bash
   python -m http.server 8000
   ```

4. Open <http://localhost:8000> in Chrome or Edge.
5. Click **Start camera** and allow camera permission.

On Windows, `py -m http.server 8000` also works.

### Option B: VS Code Live Server

Open this folder in VS Code, install the **Live Server** extension, then choose **Open with Live Server**.

## Deploy on GitHub Pages

1. Create a new **public** repository on GitHub, for example `gesture-arena-rps-ai`.
2. Upload `index.html`, `style.css`, `app.js`, `README.md`, `.gitignore`, and `LICENSE` to the repository root.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then click **Save**.
6. Wait for GitHub Pages to publish. Open the URL shown on the Pages settings screen.
7. Test the live site in Chrome/Edge and allow camera permission.

GitHub Pages serves static files over HTTPS, which supports camera permissions. The first run needs an internet connection to load MediaPipe's JavaScript/WASM files and the hand-landmarker model.

## Controls

- **Start camera:** asks permission and begins hand tracking.
- **Lock gesture & play:** starts a 3–2–1 countdown and plays a round using the currently stabilized gesture.
- **Stop camera:** stops the camera stream.
- **Reset match score:** resets all scores and round count.

## Gesture tips

- Keep your hand fully in frame and reasonably well lit.
- Face your palm toward the camera.
- Hold your gesture steady for a moment before playing.
- The current rule-based detector is a lightweight baseline; rotated hands, partially occluded fingers, or fingers pointing sideways can be ambiguous.

## Tech stack

- HTML, CSS, JavaScript ES modules
- MediaPipe Tasks Vision / Hand Landmarker
- Browser `getUserMedia` camera API
- Canvas overlay for landmark visualization

## Privacy

This project uses the camera only after the user clicks **Start camera**. Inference runs locally in the browser. The app does not send camera frames to a server. MediaPipe runtime files and the model are fetched from public CDNs when needed.

## Project structure

```text
gesture-arena-rps-ai/
├── index.html
├── style.css
├── app.js
├── README.md
├── LICENSE
└── .gitignore
```

## License

MIT — see [LICENSE](LICENSE).

---

Built as a computer-vision learning and portfolio project.
