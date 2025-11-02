// ======================================
// UI.JS
// Menus, Sons, Botões e Ponto de Entrada
// ======================================

// 1. IMPORTAÇÕES
// Importa o Firebase (para checar a conexão)
import { db, userId } from './firebase.js';

// Importa a LÓGICA DO JOGO
import { 
  initBoard, initWorker, getDepthByDifficulty,
  setPlayerColor, getPlayerColor, 
  setOnline, setCurrentRoom, setOnlineUnsubscribe,
  ouvirSala, criarSalaFirebase, entrarSalaFirebase, gerarCodigo,
  isOnline, currentRoom, onlineUnsubscribe,
  countPieces, board, current, getAIProfile,
  onGameOver, // 🔧 Importa onGameOver para desistir
  requestDesistir, // 🔧 Importa a nova função de desistir
  injectUITools, // 🚀 Importa a função de INJEÇÃO
  RED, WHITE // 🔧 Importa constantes para a UI
} from './game-core.js';

// ======================================
// 2. SELETORES DE ELEMENTOS E SONS
// (Exportados para o "pacote" de ferramentas)
// ======================================
export const elBoard    = document.getElementById('board');
export const elOverlay  = document.getElementById('overlay');
export const sMove = document.getElementById('s-move');
export const sCap  = document.getElementById('s-cap');
export const sWin  = document.getElementById('s-win');
export const sLose = document.getElementById('s-lose');
export const sDesist = document.getElementById('s-desist');
export const openSound = document.getElementById('openSound');
export const closeSound = document.getElementById('closeSound');

export const face = document.getElementById('face');
export const faceEmoji = document.getElementById('faceEmoji');
export const bubble = document.getElementById('bubble');
export const bubbleText = document.getElementById('bubbleText');
export const bubblePlaceholder = document.getElementById('bubblePlaceholder');

// ======================================
// 3. LÓGICA DE UI (EMOJI, FALAS)
// (Exportados para o "pacote" de ferramentas)
// ======================================
let lastTauntAt = 0;

const EMOJI = {
  idle: ['🤖','🧠','🧐','😑','😏','💭','🤫'],
  thinking: ['🤔','🧮','🧠','⏳','⚙️','🔍','📊'],
  ahead: ['😎','🧠','♟️','😏','📈','🧭'],
  behind: ['😐','😤','⚙️','🤔','🩹','📉'],
  capture: ['⚔️','🎯','💥','📍','🚨'],
  multi: ['💥','🎯','⚡','🔥','♟️'],
  promo: ['👑','✨','🎓','🚀','🧩'],
  win: ['🏆','😎','🥇','🤖','📘','📊'],
  lose: ['😵','🤯','🏳️','🧩','😓','💭'],
  nearWin: ['🎯','⏳','🧭','📈','😏'],
  surprise: ['😮','😲','😐','🤨','😯','💡']
};

const TAUNTS = {
  start: ["IA online. Iniciando protocolos estratégicos."],
  thinking: ["Analisando o ritmo do jogo."],
  ahead: ["A vantagem posicional está se consolidando."],
  behind: ["Desvantagem detectada. Adaptando parâmetros."],
  capture: ["Troca necessária. Controle mantido."],
  multi: ["Sequência limpa. Padrão completo."],
  promo: ["Promoção alcançada. Nova camada de controle."],
  nearWin: ["Vitória iminente. Só resta administrar o tempo."],
  win: ["Execução concluída. Tabuleiro dominado."],
  lose: ["Resultado inesperado. Processando falha."]
  // (Abreviação para o exemplo)
};

export function say(group, extra = ""){
  if (isOnline) return;
  const now = performance.now();
  if (now - lastTauntAt < 900) return;
  lastTauntAt = now;

  const pick = (arr)=>arr[Math.floor(Math.random()*arr.length)];
  const text = (Array.isArray(group) ? pick(group) : (TAUNTS[group] ? pick(TAUNTS[group]) : group)) + (extra ? " " + extra : "");
  
  bubbleText.textContent = text;
  bubble.classList.add('show');
  
  setTimeout(()=>{
    bubble.classList.remove('show');
  }, 7000);
}

export function setFace(arrKey, opts={pulse:true, shake:false, ahead:false, behind:false}){
  if (isOnline) {
    faceEmoji.textContent = '🌐';
    face.classList.remove('face-pulse', 'face-glow-ahead', 'face-glow-behind');
    return;
  }
  faceEmoji.textContent = EMOJI[arrKey][Math.floor(Math.random()*EMOJI[arrKey].length)] || '🤖';
  face.classList.toggle('face-pulse', !!opts.pulse);
  face.classList.toggle('face-glow-ahead', !!opts.ahead);
  face.classList.toggle('face-glow-behind', !!opts.behind);
  if(opts.shake){
    face.classList.add('face-shake');
    setTimeout(()=> face.classList.remove('face-shake'), 300);
  }
}

// ======================================
// 4. HELPERS DE UI (EFEITOS, MODAIS)
// (Exportados para o "pacote" de ferramentas)
// ======================================
export function squareEl(r,c){ return document.querySelector(`[data-r="${r}"][data-c="${c}"]`); }

export function explodeAt(x,y){
  for(let i=0;i<8;i++){
    const p=document.createElement('div');
    p.className='fixed w-1.5 h-1.5 bg-red-400 rounded-full z-40';
    p.style.left=x+'px'; p.style.top=y+'px';
    document.body.appendChild(p);
    const ang=Math.random()*Math.PI*2, dist=Math.random()*60+35;
    const dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist;
    p.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${dx}px,${dy}px)`,opacity:0}],{duration:650,easing:'ease-out'});
    setTimeout(()=>p.remove(),650);
  }
}

export function shakeBoard(){ elBoard.classList.add('shake'); setTimeout(()=>elBoard.classList.remove('shake'), 280); }

export function showOverlayError(message) {
  elOverlay.innerHTML = `🚫<br/>${message}`;
  elOverlay.classList.add('show');
  setTimeout(() => elOverlay.classList.remove('show'), 2500);
}

export function updateFaceState(){
  if (isOnline) {
    setFace('idle');
    return;
  }
  const {w,r}=countPieces();
  const { agg, def } = getAIProfile();
  const now = performance.now();
  
  if (agg > 0.7) {
    faceEmoji.textContent = '😈';
    if (now - lastTauntAt > 2000) say('thinking', 'Modo agressivo ativo.');
  } else if (def > 0.7) {
    faceEmoji.textContent = '🛡️';
    if (now - lastTauntAt > 2000) say('thinking', 'Modo defensivo priorizado.');
  } else {
    faceEmoji.textContent = EMOJI['thinking'][Math.floor(Math.random()*EMOJI['thinking'].length)] || '🤔';
  }
}

// ======================================
// 5. LÓGICA DE ANÁLISE E MODAIS
// ======================================

export function openAnalysisModal(feedback) {
  const analysisModal = document.getElementById('analysisModal');
  const analysisPanel = analysisModal.querySelector('.analysis-panel');
  const analysisContent = document.getElementById('analysisContent');

  if (!feedback || !feedback.length) {
    feedback = ["Sem análise disponível — jogada final detectada sem histórico completo."];
  }
  let msg = "";
  feedback.forEach((tip) => {
    msg += `<p class="border-b border-cyan-900/50 pb-2 mb-2">• ${tip}</p>`;
  });
  analysisContent.innerHTML = msg;

  analysisModal.classList.remove('hidden');
  openSound.play().catch(()=>{});
  setTimeout(() => {
    analysisPanel.style.opacity = '1';
    analysisPanel.style.transform = 'scale(1)';
  }, 20);
}

function closeAnalysisModal() {
  const analysisModal = document.getElementById('analysisModal');
  const analysisPanel = analysisModal.querySelector('.analysis-panel');

  closeSound.play().catch(()=>{});
  analysisPanel.style.opacity = '0';
  analysisPanel.style.transform = 'scale(0.95)';
  setTimeout(() => {
    analysisModal.classList.add('hidden');
    setOnline(false);
    setPlayerColor('white');
    setCurrentRoom(null);
    document.body.style.background = '#0f172a';
    initBoard(); 
  }, 250);
}

export function returnToMenu() {
    document.getElementById('menuContainer').style.display = 'block';
    document.getElementById('mainMenuScreen').classList.remove('hidden');
    document.getElementById('onlineMenuScreen').classList.add('hidden');
    document.getElementById('createRoomScreen').classList.add('hidden');
    document.getElementById('joinRoomScreen').classList.add('hidden');
    
    document.body.style.background = '#0f172a';
    
    if (onlineUnsubscribe) {
      onlineUnsubscribe();
      setOnlineUnsubscribe(null);
    }
    setOnline(false);
    setPlayerColor('white');
    setCurrentRoom(null);
    
    const btnOpcoes = document.getElementById('btnMenuOpcoes');
    btnOpcoes.style.opacity = '0';
    setTimeout(() => btnOpcoes.style.display = 'none', 300);
    
    elBoard.innerHTML = '';
}

// ======================================
// 🚀 INJEÇÃO DE DEPENDÊNCIA
// ======================================
const uiTools = {
  // Funções
  say,
  setFace,
  shakeBoard,
  explodeAt,
  squareEl,
  updateFaceState,
  openAnalysisModal,
  showOverlayError,
  returnToMenu,
  
  // Elementos do DOM
  elBoard,
  elOverlay,
  bubble,
  bubblePlaceholder,
  
  // Sons
  sMove,
  sCap,
  sWin,
  sLose,
  sDesist,
  openSound,
  closeSound
};

injectUITools(uiTools);


// ===================================================================
// 6. PONTO DE ENTRADA (BOOT)
// ===================================================================

initWorker();

// --- Seletores do Menu ---
const menuContainer = document.getElementById('menuContainer');
const mainMenuScreen = document.getElementById('mainMenuScreen');
const onlineMenuScreen = document.getElementById('onlineMenuScreen');
const createRoomScreen = document.getElementById('createRoomScreen');
const joinRoomScreen = document.getElementById('joinRoomScreen');

const startBtn = document.getElementById('btnStart');
const btnOnline = document.getElementById('btnOnline');
const btnVoltarMenu = document.getElementById('btnVoltarMenu');

// 🔧 NOVO: CARREGA A DIFICULDADE SALVA QUANDO A PÁGINA ABRE
const selectDiff = document.getElementById('difficulty');
if (selectDiff) {
    const savedDiff = localStorage.getItem('difficulty') || 'medium';
    selectDiff.value = savedDiff;
}
// Fim da adição

const btnCriarSala = document.getElementById('btnCriarSala');
const btnEntrarSala = document.getElementById('btnEntrarSala');
const btnVoltarOnline1 = document.getElementById('btnVoltarOnline1');
const btnVoltarOnline2 = document.getElementById('btnVoltarOnline2');
const roomCodeEl = document.getElementById('roomCode');
const inputRoomCode = document.getElementById('inputRoomCode');
const btnJoin = document.getElementById('btnJoin');

// --- Lógica de Navegação do Menu ---

if (startBtn) {
  startBtn.addEventListener('click', ()=>{
    setOnline(false);
    setPlayerColor('white');
    setCurrentRoom(null);
  
    // Esta linha agora lê o valor atual do dropdown (que nós já ajustamos)
    const diff = selectDiff.value; 
    // E esta linha SALVA a escolha (que já estava correta)
    localStorage.setItem('difficulty', diff); 
  
    if(diff === 'easy') document.body.style.background = '#1e293b';
    else if(diff === 'master') document.body.style.background = 'radial-gradient(circle at center, #0f172a, #020617)';
    else document.body.style.background = '#0f172a';
  
    const intro = document.createElement('div');
    intro.className = "fixed inset-0 flex flex-col items-center justify-center bg-slate-900 text-cyan-300 text-xl font-semibold z-50 transition-opacity duration-700";
    intro.innerHTML = `
      <div class="animate-pulse text-4xl mb-4">🤖</div>
      <p>Carregando protocolos estratégicos...</p>
    `;
    document.body.appendChild(intro);
  
    if (openSound) openSound.play().catch(()=>{});
    
    menuContainer.style.display = 'none'; 
    
    setTimeout(() => {
      intro.style.opacity = '0';
      setTimeout(() => {
        intro.remove();
        initBoard();
      }, 700);
    }, 2000);
  });
} else {
  console.error("Botão 'btnStart' não encontrado!");
}

if (btnOnline) {
  btnOnline.addEventListener('click', () => {
    if (!db) {
      showOverlayError("Conectando ao servidor... Tente novamente em alguns segundos.");
      return;
    }
    mainMenuScreen.classList.add('hidden');
    onlineMenuScreen.classList.remove('hidden');
    if (openSound) openSound.play().catch(()=>{});
  });
}

if (btnVoltarMenu) {
  btnVoltarMenu.addEventListener('click', () => {
    onlineMenuScreen.classList.add('hidden');
    mainMenuScreen.classList.remove('hidden');
    setOnline(false);
    setPlayerColor('white');
    if (closeSound) closeSound.play().catch(()=>{});
  });
}

if (btnCriarSala) {
  btnCriarSala.addEventListener('click', async () => {
    setOnline(true);
    setPlayerColor('white');
    
    onlineMenuScreen.classList.add('hidden');
    createRoomScreen.classList.remove('hidden');
    
    const code = gerarCodigo();
    setCurrentRoom(code);
    roomCodeEl.textContent = code;
  
    await criarSalaFirebase(code, userId);
    ouvirSala(currentRoom);
    
    bubblePlaceholder.textContent = `Sala: ${currentRoom} | Aguardando oponente...`;
    
    if (openSound) openSound.play().catch(()=>{});
  });
}

if (btnEntrarSala) {
  btnEntrarSala.addEventListener('click', () => {
    onlineMenuScreen.classList.add('hidden');
    joinRoomScreen.classList.remove('hidden');
    if (openSound) openSound.play().catch(()=>{});
  });
}

if (btnVoltarOnline1) {
  btnVoltarOnline1.addEventListener('click', () => {
    createRoomScreen.classList.add('hidden');
    onlineMenuScreen.classList.remove('hidden');
    if (onlineUnsubscribe) onlineUnsubscribe();
    setCurrentRoom(null);
    if (closeSound) closeSound.play().catch(()=>{});
  });
}

if (btnVoltarOnline2) {
  btnVoltarOnline2.addEventListener('click', () => {
    joinRoomScreen.classList.add('hidden');
    onlineMenuScreen.classList.remove('hidden');
    if (closeSound) closeSound.play().catch(()=>{});
  });
}

if (btnJoin) {
  btnJoin.addEventListener('click', async () => {
    setOnline(true);
    setPlayerColor('red');
    
    const code = inputRoomCode.value.trim().toUpperCase();
    if (!code) {
      showOverlayError("Digite um código válido para entrar!");
      return;
    }
  
    const sucesso = await entrarSalaFirebase(code, userId);
    if (!sucesso) return;
    
    setCurrentRoom(code);
    elOverlay.innerHTML = `🛰️<br/>Entrando na sala ${code}...`;
    elOverlay.classList.add('show');
    
    ouvirSala(currentRoom);
  });
}


// --- Lógica dos Modais (Manual e Análise) ---

const btnManual = document.getElementById('btnManualMenu');
const manualModal = document.getElementById('manualModal');
const panel = manualModal.querySelector('.manual-panel'); 
const closeManual = document.getElementById('closeManual');

if (btnManual) {
  btnManual.addEventListener('click', () => {
    manualModal.classList.remove('hidden');
    openSound.play().catch(()=>{});
    setTimeout(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'scale(1)';
    }, 20);
  });
}

function closeModal() {
  closeSound.play().catch(()=>{});
  panel.style.opacity = '0';
  panel.style.transform = 'scale(0.95)';
  setTimeout(() => {
    manualModal.classList.add('hidden');
  }, 250);
}
if (closeManual) closeManual.addEventListener('click', closeModal);
if (manualModal) manualModal.addEventListener('click', (e) => {
  if (e.target === manualModal) closeModal();
});

const analysisModal = document.getElementById('analysisModal');
const analysisPanel = analysisModal.querySelector('.analysis-panel');
const closeAnalysis = document.getElementById('closeAnalysis');
const backToMenu = document.getElementById('backToMenu');

if (closeAnalysis) closeAnalysis.addEventListener('click', closeAnalysisModal);

if (backToMenu) {
  backToMenu.addEventListener('click', () => {
    closeSound.play().catch(()=>{});
    analysisPanel.style.opacity = '0';
    analysisPanel.style.transform = 'scale(0.95)';
    setTimeout(() => {
      analysisModal.classList.add('hidden');
      returnToMenu();
    }, 250);
  });
}

// --- Menu Flutuante (⋮) ---
const btnMenuOpcoes = document.getElementById('btnMenuOpcoes');
const menuFlutuante = document.getElementById('menuFlutuante');

if (btnMenuOpcoes) {
  btnMenuOpcoes.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuFlutuante.classList.contains('hidden')) {
      menuFlutuante.classList.remove('hidden', 'hide');
      menuFlutuante.classList.add('show');
    } else {
      menuFlutuante.classList.remove('show');
      menuFlutuante.classList.add('hide');
      setTimeout(() => menuFlutuante.classList.add('hidden'), 250);
    }
  });
}

document.addEventListener('click', (e) => {
  if (menuFlutuante && !menuFlutuante.contains(e.target) && e.target !== btnMenuOpcoes && !menuFlutuante.classList.contains('hidden')) {
    menuFlutuante.classList.remove('show');
    menuFlutuante.classList.add('hide');
    setTimeout(() => menuFlutuante.classList.add('hidden'), 250);
  }
});

const btnVoltarMenuFlutuante = document.getElementById('voltarMenu');
if (btnVoltarMenuFlutuante) {
  btnVoltarMenuFlutuante.addEventListener('click', () => {
    menuFlutuante.classList.remove('show');
    menuFlutuante.classList.add('hide');
    setTimeout(() => menuFlutuante.classList.add('hidden'), 250);

    const btnOpcoes = document.getElementById('btnMenuOpcoes');
    btnOpcoes.style.opacity = '0';
    setTimeout(() => btnOpcoes.style.display = 'none', 300);

    returnToMenu();
    if (closeSound) closeSound.play().catch(()=>{});
  });
}

const btnDesistirJogo = document.getElementById('desistirJogo');
if (btnDesistirJogo) {
  btnDesistirJogo.addEventListener('click', () => {
    menuFlutuante.classList.remove('show');
    menuFlutuante.classList.add('hide');
    setTimeout(() => menuFlutuante.classList.add('hidden'), 250);
    
    requestDesistir(); 
  });
}

console.log("UI.js carregado e listeners anexados!");