// Mü's Memory – Classic Mode (Beta)
const GAME_VERSION = "1.0.1";
const SCORE_API_URL = "https://api.mywiel.de/score.php";
const animals = [
    { name: "cat", image: "assets/animals/cat.png" },
    { name: "doggo", image: "assets/animals/doggo.png" },
    { name: "fox", image: "assets/animals/fox.png" },
    { name: "panda", image: "assets/animals/panda.png" },
    { name: "penguin", image: "assets/animals/penguin.png" },
    { name: "raccoon", image: "assets/animals/raccoon.png" }
];

const board = document.getElementById("game-board");
const movesDisplay = document.getElementById("moves");
const matchesDisplay = document.getElementById("matches");
const restartBtn = document.getElementById("restart-btn");
const winOverlay = document.getElementById("win-overlay");
const finalMovesDisplay = document.getElementById("final-moves");
const playAgainBtn = document.getElementById("play-again-btn");
const versionLabel = document.getElementById("version-label");
const scoreForm = document.getElementById("score-form");
const playerNameInput = document.getElementById("player-name");
const saveScoreBtn = document.getElementById("save-score-btn");
const scoreStatus = document.getElementById("score-status");

versionLabel.textContent = `✦ BETA v${GAME_VERSION} ✦`;

// Copy your own sound files into assets/sounds/.
const flipSound = new Audio("assets/sounds/flip.wav");
const shuffleSound = new Audio("assets/sounds/shuffle.mp3");
flipSound.preload = "auto";
shuffleSound.preload = "auto";

function playSound(sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {}); // e.g. audio blocked or unavailable
}

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let moves = 0;
let matches = 0;
let unflipTimer = null;
let winTimer = null;
let scoreSaved = false;
let submittingScore = false;
let gameRunId = 0;

function createDeck() {
    const doubled = [...animals, ...animals];
    return shuffle(doubled).map((animal, index) => ({
        id: index,
        name: animal.name,
        image: animal.image
    }));
}

function shuffle(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function renderBoard() {
    board.innerHTML = "";
    const deck = createDeck();

    deck.forEach((cardData) => {
        const card = document.createElement("button");
        card.type = "button";
        card.classList.add("card");
        card.dataset.name = cardData.name;
        card.setAttribute("aria-label", "Verdeckte Karte");
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-back"></div>
                <div class="card-face card-front">
                    <img src="${cardData.image}" alt="${cardData.name}">
                </div>
            </div>
        `;
        card.addEventListener("click", () => flipCard(card));
        board.appendChild(card);
    });
}

function flipCard(card) {
    if (lockBoard || card === firstCard || card.classList.contains("matched") || card.classList.contains("flipped")) return;

    playSound(flipSound);
    card.classList.add("flipped");
    card.setAttribute("aria-label", card.dataset.name);

    if (!firstCard) {
        firstCard = card;
        return;
    }

    secondCard = card;
    moves++;
    movesDisplay.textContent = moves;
    checkForMatch();
}

function checkForMatch() {
    const isMatch = firstCard.dataset.name === secondCard.dataset.name;

    if (isMatch) {
        firstCard.classList.add("matched");
        secondCard.classList.add("matched");
        matches++;
        matchesDisplay.textContent = matches;
        resetTurn();

        if (matches === animals.length) {
            lockBoard = true;
            // Let the final pair finish its flip before showing Mü.
            winTimer = setTimeout(() => {
                finalMovesDisplay.textContent = moves;
                winOverlay.classList.remove("hidden");
                playerNameInput.focus();
                winTimer = null;
            }, 650);
        }
    } else {
        unflipCards();
    }
}

function unflipCards() {
    lockBoard = true;
    unflipTimer = setTimeout(() => {
        firstCard.classList.remove("flipped");
        secondCard.classList.remove("flipped");
        firstCard.setAttribute("aria-label", "Verdeckte Karte");
        secondCard.setAttribute("aria-label", "Verdeckte Karte");
        resetTurn();
        unflipTimer = null;
    }, 900);
}

function resetTurn() {
    firstCard = null;
    secondCard = null;
    lockBoard = false;
}

function restartGame() {
    gameRunId++;
    scoreSaved = false;
    submittingScore = false;
    scoreForm.reset();
    scoreStatus.textContent = "";
    saveScoreBtn.disabled = false;
    resetTurn();
    moves = 0;
    matches = 0;
    movesDisplay.textContent = moves;
    matchesDisplay.textContent = matches;
    winOverlay.classList.add("hidden");
    board.classList.remove("shuffling");
    renderBoard();
}

function startShuffle() {
    if (restartBtn.disabled) return;
    restartBtn.disabled = true;
    playAgainBtn.disabled = true;
    lockBoard = true;
    winOverlay.classList.add("hidden");

    if (unflipTimer !== null) {
        clearTimeout(unflipTimer);
        unflipTimer = null;
    }
    if (winTimer !== null) {
        clearTimeout(winTimer);
        winTimer = null;
    }

    // Flip any revealed cards back over, then visually shuffle them.
    board.querySelectorAll(".card").forEach((card) => {
        card.classList.remove("flipped", "matched");
        card.setAttribute("aria-label", "Verdeckte Karte");
    });

    setTimeout(() => {
        playSound(shuffleSound);
        board.classList.add("shuffling");

        setTimeout(() => {
            restartGame();
            restartBtn.disabled = false;
            playAgainBtn.disabled = false;
            restartBtn.focus();
        }, 800);
    }, 500);
}

// Only completed games can submit their move count.
scoreForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (matches !== animals.length || scoreSaved || submittingScore) return;

    const playerName = playerNameInput.value.trim();
    if (!/^[\p{L}\p{N}_-]{3,15}$/u.test(playerName)) {
        scoreStatus.textContent = "Bitte 3–15 Zeichen eingeben (Buchstaben, Zahlen, _ oder -).";
        playerNameInput.focus();
        return;
    }

    // Keep this game's final score fixed, even if the user starts a new round.
    const completedMoves = moves;
    const submissionRun = gameRunId;
    submittingScore = true;
    saveScoreBtn.disabled = true;
    scoreStatus.textContent = "Ergebnis wird gespeichert …";

    try {
        const response = await fetch(SCORE_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                game: "memory",
                player_name: playerName,
                score: completedMoves,
                game_version: GAME_VERSION
            })
        });

        const result = await response.json().catch(() => ({}));
        if (submissionRun !== gameRunId) return;

        if (!response.ok || result.saved !== true) {
            if (response.status === 429) {
                throw new Error("Bitte kurz warten und dann erneut speichern.");
            }
            throw new Error("Speichern fehlgeschlagen. Bitte erneut versuchen.");
        }

        scoreSaved = true;
        scoreStatus.textContent = `Gespeichert! ${completedMoves} Züge für ${playerName}. 🏆`;
    } catch (error) {
        if (submissionRun !== gameRunId) return;
        scoreStatus.textContent = error.message || "Verbindung fehlgeschlagen. Bitte erneut versuchen.";
        saveScoreBtn.disabled = false;
    } finally {
        if (submissionRun === gameRunId) submittingScore = false;
    }
});

restartBtn.addEventListener("click", startShuffle);
playAgainBtn.addEventListener("click", startShuffle);
restartGame(); // Important: show the initial deck on page load.
