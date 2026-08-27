'use strict';

/* =========================================================
   ARENA DO SABER — Lógica da Aplicação
   ========================================================= */

// --- CONFIGURAÇÃO ---
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABELS = { easy: 'Fácil 🟢', medium: 'Médio 🟡', hard: 'Difícil 🔴' };
const DIFFICULTY_EMOJI = { easy: '🟢', medium: '🟡', hard: '🔴' };

const TOPICS = [
  'Comunicação Empresarial', 'Educação Física', 'Física', 'Gestão de Operações',
  'Gestão Financeira e Contabilidade', 'História', 'Inovação e Desenvolvimento de Negócios',
  'Língua Portuguesa', 'Marketing Estratégico', 'Matemática', 'História do Cinema',
  'Design de Jogos e Gamificação', 'Jornalismo Esportivo', 'E-sports e Cultura Digital',
  'Produção Audiovisual', 'Sociologia do Esporte', 'Animação e Efeitos Visuais',
  'História dos Jogos de Tabuleiro'
];

const CARDS_PER_ROUND = 10;
const PASS_THRESHOLD = 7;
const ANSWER_REVEAL_MS = 1200;
const COMP_QUESTIONS_PER_PLAYER = 5;

// --- ESTADO GLOBAL ---
const state = {
  selectedCategory: 'all',
  modules: [],
  availableModules: [],
  viewedCards: [],
  currentDiffIndex: 0,

  quizQueue: [],
  currentQuizIndex: 0,
  quizScore: 0,

  compPhase: 1, // 1: P1 cria, 2: P2 responde, 3: P2 cria, 4: P1 responde, 5: resultado
  p1Questions: [],
  p2Questions: [],
  p1Score: 0,
  p2Score: 0,
  currentCompQIndex: 0,

  isLoading: false,
};

// --- CACHE DE ELEMENTOS DO DOM ---
const el = {};
function cacheElements() {
  const ids = [
    'nav-cards', 'nav-quiz', 'nav-comp',
    'tab-cards', 'tab-quiz', 'tab-comp',
    'topic-select',
    'card-counter', 'punch-track', 'card-subject', 'card-medal',
    'card-title', 'card-teach', 'btn-next-card',
    'quiz-area', 'quiz-result', 'quiz-counter', 'quiz-subject', 'quiz-q', 'quiz-options', 'quiz-score-msg',
    'comp-setup', 'comp-play', 'comp-result',
    'comp-title', 'comp-q-count', 'comp-q', 'comp-ans', 'comp-w1', 'comp-w2', 'comp-w3',
    'comp-player-turn', 'comp-play-q', 'comp-options',
    'comp-score-p1', 'comp-score-p2', 'comp-winner',
  ];
  ids.forEach(id => { el[toCamel(id)] = document.getElementById(id); });
}

function toCamel(id) {
  return id.replace(-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function setButtonsBusy(container, busy) {
  container.querySelectorAll('button').forEach(b => { b.disabled = busy; });
}

// --- GERAÇÃO DE CONTEÚDO POR TÓPICO ---
function generateTopicModules(topic, difficulty) {
  const diffLabel = DIFFICULTY_LABELS[difficulty];

  return Array.from({ length: CARDS_PER_ROUND }, (_, i) => ({
    subject: topic,
    difficulty,
    title: `Conceito ${i + 1}: ${topic}`,
    teach: `Ficha de estudo sobre ${topic} (Nível: ${diffLabel}).\n\n💡 Ponto-chave ${i + 1}: Definição prática e aplicação dos conceitos fundamentais de ${topic}.`,
    quizQ: `Qual é o princípio fundamental do conceito ${i + 1} em ${topic}?`,
    quizAns: `Princípio correto de ${topic}`,
    wrong: [
      `Alternativa incorreta A de ${topic}`,
      `Alternativa incorreta B de ${topic}`,
      `Alternativa incorreta C de ${topic}`
    ]
  }));
}

async function fetchNewModulesFromAPI() {
  const difficulty = DIFFICULTIES[state.currentDiffIndex];
  
  const activeTopic = state.selectedCategory === 'all'
    ? TOPICS[Math.floor(Math.random() * TOPICS.length)]
    : state.selectedCategory;

  el.cardTitle.innerText = `🌐 Carregando ${activeTopic}...`;
  el.cardTeach.innerText = `Preparando fichas do nível ${DIFFICULTY_LABELS[difficulty]}...`;

  state.modules = generateTopicModules(activeTopic, difficulty);
}

async function changeTopic(event) {
  state.selectedCategory = event.target.value;
  await initFlashcards();
}

// --- NAVEGAÇÃO ENTRE ABAS ---
function switchTab(tabId, event) {
  if (tabId === 'quiz' && el.navQuiz.disabled) return;

  document.querySelectorAll('.tab-content').forEach(node => node.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(node => node.classList.remove('active'));

  document.getElementById(`tab-${tabId}`).classList.add('active');
  const targetBtn = event ? event.currentTarget : document.getElementById(`nav-${tabId}`);
  if (targetBtn) targetBtn.classList.add('active');
}

// --- FICHAS DE ESTUDO ---
async function initFlashcards() {
  state.isLoading = true;
  el.navQuiz.disabled = true;
  el.navQuiz.innerText = '🎯 Quiz (Bloqueado)';
  el.btnNextCard.disabled = true;

  await fetchNewModulesFromAPI();

  state.availableModules = [...state.modules];
  state.viewedCards = [];
  renderPunchTrack();
  loadNextFlashcard();

  el.btnNextCard.disabled = false;
  state.isLoading = false;
}

function renderPunchTrack() {
  const total = state.modules.length || CARDS_PER_ROUND;
  el.punchTrack.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    dot.className = 'punch-dot';
    el.punchTrack.appendChild(dot);
  }
}

function updatePunchTrack() {
  const dots = el.punchTrack.querySelectorAll('.punch-dot');
  dots.forEach((dot, i) => dot.classList.toggle('filled', i < state.viewedCards.length));
}

function loadNextFlashcard() {
  if (state.viewedCards.length >= state.modules.length) {
    startQuizPhase();
    return;
  }

  const currentModule = state.availableModules.pop();
  state.viewedCards.push(currentModule);
  updatePunchTrack();

  el.cardCounter.innerText = `Ficha ${state.viewedCards.length}/${state.modules.length}`;
  el.cardSubject.innerText = currentModule.subject;
  el.cardTitle.innerText = currentModule.title;
  el.cardTeach.innerText = currentModule.teach;
  el.cardMedal.dataset.level = currentModule.difficulty;
  el.cardMedal.innerText = DIFFICULTY_EMOJI[currentModule.difficulty];
}

function nextFlashcard() {
  if (state.isLoading) return;
  loadNextFlashcard();
}

// --- QUIZ ---
function startQuizPhase() {
  el.navQuiz.disabled = false;
  el.navQuiz.innerText = '🎯 Quiz';

  document.querySelectorAll('.tab-content').forEach(node => node.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(node => node.classList.remove('active'));
  el.tabQuiz.classList.add('active');
  el.navQuiz.classList.add('active');

  state.quizQueue = shuffle(state.viewedCards);
  state.currentQuizIndex = 0;
  state.quizScore = 0;

  el.quizArea.style.display = 'block';
  el.quizResult.style.display = 'none';

  loadQuizQuestion();
}

function loadQuizQuestion() {
  if (state.currentQuizIndex >= state.quizQueue.length) {
    finishQuiz();
    return;
  }

  const qData = state.quizQueue[state.currentQuizIndex];
  el.quizCounter.innerText = `Pergunta ${state.currentQuizIndex + 1}/${state.quizQueue.length}`;
  el.quizSubject.innerText = qData.subject;
  el.quizQ.innerText = qData.quizQ;

  renderOptions(el.quizOptions, qData.quizAns, qData.wrong, (btn, selected) =>
    checkQuizAnswer(btn, selected, qData.quizAns)
  );
}

function renderOptions(container, correctAnswer, wrongAnswers, onSelect) {
  const options = shuffle([correctAnswer, ...wrongAnswers]);
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.type = 'button';
    btn.innerText = opt;
    btn.onclick = () => onSelect(btn, opt);
    container.appendChild(btn);
  });
}

function revealAnswer(container, selectedBtn, selected, correct) {
  setButtonsBusy(container, true);
  if (selected === correct) {
    selectedBtn.classList.add('correct');
    return true;
  }
  selectedBtn.classList.add('wrong');
  container.querySelectorAll('.option-btn').forEach(b => {
    if (b.innerText === correct) b.classList.add('correct');
  });
  return false;
}

function checkQuizAnswer(btn, selected, correct) {
  const isCorrect = revealAnswer(el.quizOptions, btn, selected, correct);
  if (isCorrect) state.quizScore++;

  setTimeout(() => {
    state.currentQuizIndex++;
    loadQuizQuestion();
  }, ANSWER_REVEAL_MS);
}

function finishQuiz() {
  el.quizArea.style.display = 'none';
  el.quizResult.style.display = 'block';

  const passed = state.quizScore >= PASS_THRESHOLD;
  if (passed) {
    const atMaxLevel = state.currentDiffIndex === DIFFICULTIES.length - 1;
    const levelMsg = atMaxLevel
      ? 'Você já está no nível máximo (Difícil)!'
      : 'Você avançará para o próximo nível de dificuldade!';
    el.quizScoreMsg.innerText = `Parabéns! 🎉 Você acertou ${state.quizScore}/${state.quizQueue.length}.\n${levelMsg}`;
    el.quizScoreMsg.style.color = 'var(--success)';
  } else {
    el.quizScoreMsg.innerText = `Atenção! Você acertou ${state.quizScore}/${state.quizQueue.length}.\nA meta é ${PASS_THRESHOLD} acertos para subir de nível. Vamos repetir esta rodada!`;
    el.quizScoreMsg.style.color = 'var(--danger)';
  }
}

function resetCycle() {
  if (state.quizScore >= PASS_THRESHOLD) {
    if (state.currentDiffIndex < DIFFICULTIES.length - 1) state.currentDiffIndex++;
    switchTab('cards');
    initFlashcards();
  } else {
    startQuizPhase();
  }
}

// --- DUELO 1V1 (COMPETIÇÃO) ---
function readCompForm() {
  return {
    q: el.compQ.value.trim(),
    a: el.compAns.value.trim(),
    w1: el.compW1.value.trim(),
    w2: el.compW2.value.trim(),
    w3: el.compW3.value.trim(),
  };
}

function clearCompForm() {
  el.compQ.value = '';
  el.compAns.value = '';
  el.compW1.value = '';
  el.compW2.value = '';
  el.compW3.value = '';
}

function addCompQuestion() {
  const { q, a, w1, w2, w3 } = readCompForm();

  if (!q || !a || !w1 || !w2 || !w3) {
    alert('Por favor, preencha a pergunta e todas as opções de resposta!');
    return;
  }

  const qObj = { q, a, wrong: [w1, w2, w3] };

  if (state.compPhase === 1) {
    state.p1Questions.push(qObj);
    el.compQCount.innerText = state.p1Questions.length;
    if (state.p1Questions.length === COMP_QUESTIONS_PER_PLAYER) {
      state.compPhase = 2;
      startCompPlay(state.p1Questions, 'Jogador 2');
    }
  } else if (state.compPhase === 3) {
    state.p2Questions.push(qObj);
    el.compQCount.innerText = state.p2Questions.length;
    if (state.p2Questions.length === COMP_QUESTIONS_PER_PLAYER) {
      state.compPhase = 4;
      startCompPlay(state.p2Questions, 'Jogador 1');
    }
  }

  clearCompForm();
}

function startCompPlay(questions, playerTurn) {
  el.compSetup.style.display = 'none';
  el.compPlay.style.display = 'block';
  el.compPlayerTurn.innerText = `Turno do ${playerTurn} (respondendo)`;
  state.currentCompQIndex = 0;
  loadCompQuestion(questions);
}

function loadCompQuestion(questions) {
  if (state.currentCompQIndex >= questions.length) {
    if (state.compPhase === 2) {
      state.compPhase = 3;
      el.compPlay.style.display = 'none';
      el.compSetup.style.display = 'block';
      el.compTitle.innerText = 'Jogador 2: crie 5 perguntas';
      el.compQCount.innerText = '0';
    } else if (state.compPhase === 4) {
      state.compPhase = 5;
      showCompResult();
    }
    return;
  }

  const qData = questions[state.currentCompQIndex];
  el.compPlayQ.innerText = qData.q;

  renderOptions(el.compOptions, qData.a, qData.wrong, (btn, selected) =>
    checkCompAnswer(btn, selected, qData.a, questions)
  );
}

function checkCompAnswer(btn, selected, correct, questions) {
  const isCorrect = revealAnswer(el.compOptions, btn, selected, correct);
  if (isCorrect) {
    if (state.compPhase === 2) state.p2Score++;
    if (state.compPhase === 4) state.p1Score++;
  }

  setTimeout(() => {
    state.currentCompQIndex++;
    loadCompQuestion(questions);
  }, 1500);
}

function showCompResult() {
  el.compPlay.style.display = 'none';
  el.compResult.style.display = 'block';

  el.compScoreP1.innerText = `Pontos do Jogador 1: ${state.p1Score}`;
  el.compScoreP2.innerText = `Pontos do Jogador 2: ${state.p2Score}`;

  if (state.p1Score > state.p2Score) {
    el.compWinner.innerText = '🏆 Jogador 1 venceu o duelo!';
  } else if (state.p2Score > state.p1Score) {
    el.compWinner.innerText = '🏆 Jogador 2 venceu o duelo!';
  } else {
    el.compWinner.innerText = '🤝 Uau, deu empate!';
  }
}

function resetComp() {
  state.compPhase = 1;
  state.p1Questions = [];
  state.p2Questions = [];
  state.p1Score = 0;
  state.p2Score = 0;

  el.compResult.style.display = 'none';
  el.compSetup.style.display = 'block';
  el.compTitle.innerText = 'Jogador 1: crie 5 perguntas';
  el.compQCount.innerText = '0';
}

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
window.onload = () => {
  cacheElements();
  initFlashcards();
};
