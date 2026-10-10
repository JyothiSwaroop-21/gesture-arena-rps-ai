import { FilesetResolver, HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

const $ = (id) => document.getElementById(id);
const video = $("webcam");
const canvas = $("overlay");
const ctx = canvas.getContext("2d");
const startBtn = $("startCameraBtn");
const stopBtn = $("stopCameraBtn");
const playBtn = $("playBtn");
const toastEl = $("toast");

const MOVE_INFO = {
  rock: { label: "Rock", emoji: "✊", hint: "Closed fist detected" },
  paper: { label: "Paper", emoji: "✋", hint: "Open palm detected" },
  scissors: { label: "Scissors", emoji: "✌️", hint: "Index + middle fingers detected" }
};
const MOVES = Object.keys(MOVE_INFO);
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12], [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20], [0,17]
];

let landmarker = null;
let stream = null;
let rafId = null;
let lastVideoTime = -1;
let stableHistory = [];
let stableMove = "unknown";
let playerScore = 0;
let computerScore = 0;
let drawScore = 0;
let rounds = 0;
let isPlayingRound = false;
let toastTimer = null;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function setCameraStatus(active, message = "") {
  $("headerDot").classList.toggle("active", active);
  $("headerStatus").textContent = active ? "CAMERA LIVE" : "CAMERA OFF";
  $("cameraBadge").classList.toggle("active", active);
  $("cameraBadge").innerHTML = `<span class="mini-dot"></span> ${active ? "TRACKING" : "STANDBY"}`;
  if (message) showToast(message);
}

async function setupLandmarker() {
  if (landmarker) return landmarker;
  $("fpsLabel").textContent = "LOADING MODEL";
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
  );
  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55
  });
  return landmarker;
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Keep the same practical landmark rules as the Python version.
// The palm should face the camera and fingers should be reasonably upright.
function detectGesture(hand) {
  const fingerExtended = (tipId, pipId, mcpId) => {
    const tipDistance = distance2D(hand[tipId], hand[mcpId]);
    const pipDistance = distance2D(hand[pipId], hand[mcpId]);
    return tipDistance > pipDistance * 1.15;
  };

  const fingers = [
    fingerExtended(8, 6, 5),    // index
    fingerExtended(12, 10, 9),  // middle
    fingerExtended(16, 14, 13), // ring
    fingerExtended(20, 18, 17)  // pinky
  ];

  if (fingers.every((value) => !value)) return "rock";
  if (fingers.every(Boolean)) return "paper";
  if (fingers[0] && fingers[1] && !fingers[2] && !fingers[3]) return "scissors";
  return "unknown";
}

function resizeCanvas() {
  const rect = video.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawHand(hand) {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!hand) return;

  // Canvas and video are mirrored together in CSS, so use normal landmark coordinates here.
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#55e7f2";
  ctx.shadowColor = "#55e7f2";
  ctx.shadowBlur = 8;
  for (const [start, end] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(hand[start].x * canvas.width, hand[start].y * canvas.height);
    ctx.lineTo(hand[end].x * canvas.width, hand[end].y * canvas.height);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (const point of hand) {
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, point.y * canvas.height, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "#a78bfa";
    ctx.fill();
    ctx.strokeStyle = "#f3f1ff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function updateGestureUI(move) {
  const info = MOVE_INFO[move];
  $("gestureIcon").textContent = info ? info.emoji : (move === "nohand" ? "◎" : "?");
  $("gestureName").textContent = info ? info.label : (move === "nohand" ? "No hand detected" : "Gesture unclear");
  $("gestureHint").textContent = info ? info.hint : (move === "nohand" ? "Bring one hand into the camera view" : "Try facing your palm toward the camera");
  $("confidenceChip").textContent = info ? "LOCKED" : "SCANNING";
  playBtn.disabled = !info || isPlayingRound;
}

function updateScoreboard() {
  $("playerScore").textContent = playerScore;
  $("computerScore").textContent = computerScore;
  $("drawScore").textContent = drawScore;
  $("roundCounter").textContent = `ROUND ${String(rounds).padStart(2, "0")}`;
}

function showResult(title, detail, outcome = "") {
  $("resultTitle").textContent = title;
  $("resultText").textContent = detail;
  $("resultBanner").classList.remove("win", "lose");
  if (outcome) $("resultBanner").classList.add(outcome);
}

function resetArena() {
  $("playerEmoji").textContent = "✊";
  $("computerEmoji").textContent = "✦";
  $("playerMove").textContent = "Ready?";
  $("computerMove").textContent = "Waiting";
  $("playerSub").textContent = "You";
  $("playerOrb").classList.remove("reveal");
  $("computerOrb").classList.remove("reveal");
  showResult("Ready when you are", "Show ✊, ✋, or ✌️ to the camera.");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playRound() {
  if (!MOVES.includes(stableMove) || isPlayingRound) return;
  const player = stableMove;
  isPlayingRound = true;
  playBtn.disabled = true;
  const overlay = $("countdownOverlay");
  overlay.classList.remove("hidden");

  try {
    for (let count = 3; count >= 1; count--) {
      overlay.textContent = String(count);
      overlay.style.animation = "none";
      void overlay.offsetWidth;
      overlay.style.animation = "";
      await wait(650);
    }
    overlay.textContent = "GO!";
    await wait(250);
    overlay.classList.add("hidden");

    const cpu = MOVES[Math.floor(Math.random() * MOVES.length)];
    rounds++;
    $("playerEmoji").textContent = MOVE_INFO[player].emoji;
    $("computerEmoji").textContent = MOVE_INFO[cpu].emoji;
    $("playerMove").textContent = MOVE_INFO[player].label;
    $("computerMove").textContent = MOVE_INFO[cpu].label;
    $("playerSub").textContent = "You played";
    $("playerOrb").classList.remove("reveal");
    $("computerOrb").classList.remove("reveal");
    void $("playerOrb").offsetWidth;
    $("playerOrb").classList.add("reveal");
    $("computerOrb").classList.add("reveal");

    if (player === cpu) {
      drawScore++;
      showResult("It's a draw!", "You both chose " + MOVE_INFO[player].label + ".", "");
    } else if (
      (player === "rock" && cpu === "scissors") ||
      (player === "paper" && cpu === "rock") ||
      (player === "scissors" && cpu === "paper")
    ) {
      playerScore++;
      showResult("You win this round!", `${MOVE_INFO[player].label} beats ${MOVE_INFO[cpu].label}. Nice move.`, "win");
    } else {
      computerScore++;
      showResult("Computer takes this one", `${MOVE_INFO[cpu].label} beats ${MOVE_INFO[player].label}. Run it back!`, "lose");
    }
    updateScoreboard();
  } finally {
    overlay.classList.add("hidden");
    isPlayingRound = false;
    updateGestureUI(stableMove);
  }
}

async function detectLoop() {
  if (!stream || !landmarker) return;
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = landmarker.detectForVideo(video, performance.now());
    const hand = result.landmarks?.[0] ?? null;
    drawHand(hand);
    $("landmarkCount").textContent = hand ? `${hand.length} TRACKED` : "0 TRACKED";

    if (hand) {
      const detected = detectGesture(hand);
      if (MOVES.includes(detected)) {
        stableHistory.push(detected);
        if (stableHistory.length > 7) stableHistory.shift();
        const counts = stableHistory.reduce((acc, move) => {
          acc[move] = (acc[move] || 0) + 1;
          return acc;
        }, {});
        const [candidate, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ["unknown", 0];
        stableMove = count >= 5 ? candidate : "unknown";
      } else {
        stableHistory = [];
        stableMove = "unknown";
      }
      $("fpsLabel").textContent = "TRACKING ACTIVE";
      updateGestureUI(stableMove);
    } else {
      stableHistory = [];
      stableMove = "unknown";
      $("fpsLabel").textContent = "SEARCHING";
      updateGestureUI("nohand");
    }
  }
  rafId = requestAnimationFrame(detectLoop);
}

async function startCamera() {
  if (stream) return;
  startBtn.disabled = true;
  startBtn.textContent = "Loading AI model…";
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access requires HTTPS or localhost. Open this app on localhost or a secure hosted URL.");
    }
    await setupLandmarker();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    await video.play();
    video.classList.add("ready");
    $("cameraPlaceholder").classList.add("hidden");
    setCameraStatus(true, "Camera started. Show a clear hand gesture.");
    startBtn.textContent = "Camera running";
    startBtn.disabled = true;
    stopBtn.disabled = false;
    stableHistory = [];
    lastVideoTime = -1;
    rafId = requestAnimationFrame(detectLoop);
  } catch (error) {
    console.error(error);
    startBtn.disabled = false;
    startBtn.innerHTML = "<span>◉</span> Start camera";
    showToast(error.message || "Could not start camera. Check browser permissions and try again.");
    setCameraStatus(false);
  }
}

function stopCamera() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.pause();
  video.srcObject = null;
  video.classList.remove("ready");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $("cameraPlaceholder").classList.remove("hidden");
  $("landmarkCount").textContent = "0 TRACKED";
  $("fpsLabel").textContent = "AI READY";
  stableHistory = [];
  stableMove = "unknown";
  updateGestureUI("nohand");
  setCameraStatus(false);
  startBtn.disabled = false;
  startBtn.innerHTML = "<span>◉</span> Start camera";
  stopBtn.disabled = true;
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
playBtn.addEventListener("click", playRound);
$("resetBtn").addEventListener("click", () => {
  playerScore = 0;
  computerScore = 0;
  drawScore = 0;
  rounds = 0;
  updateScoreboard();
  resetArena();
  showToast("Match score reset.");
});
window.addEventListener("resize", resizeCanvas);
window.addEventListener("beforeunload", stopCamera);

updateScoreboard();
updateGestureUI("nohand");
