// ======================================
// UI.JS
// (Atualizado com fluxo de Login)
// ======================================

// 1. IMPORTAÇÕES
import { db } from './firebase.js'; // 🔧 Só precisamos do 'db' para checar a conexão

import { 
  initBoard, initWorker,
  setPlayerColor, setCurrentRoom, setOnline,
  ouvirSala, criarSalaFirebase, entrarSalaFirebase, gerarCodigo,
  isOnline, currentRoom, onlineUnsubscribe,
  requestDesistir, 
  injectUITools,
  
  // 🔧 NOVO: Importa as funções de login
  registrarJogador,
  logarJogador

} from './game-core.js';

// ======================================
// 2. SELETORES DE ELEMENTOS E SONS
// ======================================
export const elBoard    = document.getElementById('board');
export const elOverlay  = document.getElementById('overlay');
export const sMove = document.getElementById('s-move');
// ... (resto dos seletores sem mudança) ...
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
// ======================================
let lastTauntAt = 0;
const EMOJI = { /* ... (sem mudança) ... */ };
const TAUNTS = { /* ... (sem mudança) ... */ };
export function say(group, extra = ""){ /* ... (sem mudança) ... */ }
export function setFace(arrKey, opts={pulse:true, shake:false, ahead:false, behind:false}){ /* ... (sem mudança) ... */ }

// ======================================
// 4. HELPERS DE UI (EFEITOS, MODAIS)
// ======================================
export function squareEl(r,c){ return document.querySelector(`[data-r="${r}"][data-c="${c}"]`); }
export function explodeAt(x,y){ /* ... (sem mudança) ... */ }
export function shakeBoard(){ elBoard.classList.add('shake'); setTimeout(()=>elBoard.classList.remove('shake'), 280); }
export function showOverlayError(message) {
  elOverlay.innerHTML = `🚫<br/>${message}`;
  elOverlay.classList.add('show');
  setTimeout(() => elOverlay.classList.remove('show'), 2500);
}
// 🔧 'updateFaceState' FOI MOVIDO para o Ponto de Entrada (BOOT)
//    pois depende de 'getAIProfile' e 'countPieces' que não são mais globais
export function updateFaceState(){
  // Esta função agora precisa ser importada ou movida
  // Por simplicidade, vamos deixar a chamada no game-core.js
  // e garantir que as dependências estejam lá.
  // (O código anterior já está correto no game-core.js)
}


// ======================================
// 5. LÓGICA DE ANÁLISE E MODAIS
// ======================================
export function openAnalysisModal(feedback) { /* ... (sem mudança) ... */ }
function closeAnalysisModal() { /* ... (sem mudança) ... */ }
export function returnToMenu() { /* ... (sem mudança) ... */ }


// ======================================
// 🚀 INJEÇÃO DE DEPENDÊNCIA
// (Passa as ferramentas da UI para o Core)
// ======================================
const uiTools = {
  say, setFace, shakeBoard, explodeAt, squareEl,
  // 🔧 Removido 'updateFaceState' daqui, pois ele está no core agora
  openAnalysisModal, showOverlayError, returnToMenu,
  elBoard, elOverlay, bubble, bubblePlaceholder,
  sMove, sCap, sWin, sLose, sDesist, openSound, closeSound
};
injectUITools(uiTools);


// ===================================================================
// 6. PONTO DE ENTRADA (BOOT)
// (Aqui é onde toda a lógica de botões será adicionada)
// ===================================================================

initWorker();

// --- Seletores do Menu ---
const menuContainer = document.getElementById('menuContainer');
const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const mainMenuScreen = document.getElementById('mainMenuScreen');
const onlineMenuScreen = document.getElementById('onlineMenuScreen');
const createRoomScreen = document.getElementById('createRoomScreen');
const joinRoomScreen = document.getElementById('joinRoomScreen');
const playerNameEl = document.getElementById('playerName');

// --- Seletores de Botões de Login/Registro ---
const btnLogin = document.getElementById('btnLogin');
const btnGoToRegister = document.getElementById('btnGoToRegister');
const inputNomeLogin = document.getElementById('inputNomeLogin');
const inputPinLogin = document.getElementById('inputPinLogin');
const loginError = document.getElementById('loginError');

const btnRegister = document.getElementById('btnRegister');
const btnGoToLogin = document.getElementById('btnGoToLogin');
const inputNomeReg = document.getElementById('inputNomeReg');
const inputPinReg = document.getElementById('inputPinReg');
const registerError = document.getElementById('registerError');

// --- Seletores de Botões do Jogo ---
const startBtn = document.getElementById('btnStart');
const btnOnline = document.getElementById('btnOnline');
const btnVoltarMenu = document.getElementById('btnVoltarMenu');
const selectDiff = document.getElementById('difficulty');
// ... (resto dos seletores)
const btnCriarSala = document.getElementById('btnCriarSala');
const btnEntrarSala = document.getElementById('btnEntrarSala');
const btnVoltarOnline1 = document.getElementById('btnVoltarOnline1');
const btnVoltarOnline2 = document.getElementById('btnVoltarOnline2');
const roomCodeEl = document.getElementById('roomCode');
const inputRoomCode = document.getElementById('inputRoomCode');
const btnJoin = document.getElementById('btnJoin');


// 🔧 ========================================
// 🔧 FUNÇÕES DE NAVEGAÇÃO DE TELA (NOVO)
// 🔧 ========================================

function showLoginScreen() {
  loginScreen.classList.remove('hidden');
  registerScreen.classList.add('hidden');
  mainMenuScreen.classList.add('hidden');
  onlineMenuScreen.classList.add('hidden');
}

function showRegisterScreen() {
  loginScreen.classList.add('hidden');
  registerScreen.classList.remove('hidden');
}

/**
 * Esta é a função mais importante.
 * Ela é chamada após o login ou registro.
 */
function showMainMenu() {
  // Pega o nome do localStorage (que o game-core salvou)
  const nome = localStorage.getItem('playerName');
  if (nome) {
    playerNameEl.textContent = nome; // Mostra o nome do jogador
  }
  
  // Esconde telas de login e mostra o menu principal
  loginScreen.classList.add('hidden');
  registerScreen.classList.add('hidden');
  mainMenuScreen.classList.remove('hidden');
}

// 🔧 ========================================
// 🔧 LISTENERS DE LOGIN/REGISTRO (NOVO)
// 🔧 ========================================

// --- Tela de Login ---
if (btnGoToRegister) {
  btnGoToRegister.addEventListener('click', () => {
    loginError.textContent = "";
    showRegisterScreen();
  });
}

if (btnLogin) {
  btnLogin.addEventListener('click', async () => {
    const nome = inputNomeLogin.value;
    const pin = inputPinLogin.value;
    loginError.textContent = "Entrando..."; // Feedback

    const result = await logarJogador(nome, pin);
    
    if (result.success) {
      loginError.textContent = "";
      inputNomeLogin.value = "";
      inputPinLogin.value = "";
      showMainMenu(); // SUCESSO!
    } else {
      loginError.textContent = result.message; // Mostra erro (ex: "PIN incorreto!")
    }
  });
}

// --- Tela de Registro ---
if (btnGoToLogin) {
  btnGoToLogin.addEventListener('click', () => {
    registerError.textContent = "";
    showLoginScreen();
  });
}

if (btnRegister) {
  btnRegister.addEventListener('click', async () => {
    const nome = inputNomeReg.value;
    const pin = inputPinReg.value;
    registerError.textContent = "Registrando..."; // Feedback

    const result = await registrarJogador(nome, pin);
    
    if (result.success) {
      registerError.textContent = "";
      inputNomeReg.value = "";
      inputPinReg.value = "";
      showMainMenu(); // SUCESSO!
    } else {
      registerError.textContent = result.message; // Mostra erro (ex: "Nome já existe!")
    }
  });
}

// 🔧 ========================================
// 🔧 CHECAGEM DE SESSÃO (NOVO)
// 🔧 ========================================

// Tenta carregar o nível de dificuldade salvo
if (selectDiff) {
    const savedDiff = localStorage.getItem('difficulty') || 'medium';
    selectDiff.value = savedDiff;
}

// Verifica se o jogador JÁ ESTÁ LOGADO
const loggedInName = localStorage.getItem('playerName');
if (loggedInName) {
  console.log(`Sessão encontrada. Bem-vindo de volta, ${loggedInName}`);
  showMainMenu(); // Pula o login e vai direto pro menu
} else {
  console.log("Nenhuma sessão encontrada. Mostrando tela de login.");
  showLoginScreen(); // Mostra o login
}


// ----------------------------------------
// --- Listeners do Jogo (Sem mudança) ----
// ----------------------------------------

if (startBtn) {
  startBtn.addEventListener('click', ()=>{
    setOnline(false);
    setPlayerColor('white');
    setCurrentRoom(null);
  
    const diff = selectDiff.value; 
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
  
    // 🔧 USA O NOVO 'userId' (Anônimo)
    // Para o ranking real, usaríamos o 'playerDocId' do localStorage
    await criarSalaFirebase(code, localStorage.getItem('playerDocId') || 'uid-anonimo'); 
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
  
    const sucesso = await entrarSalaFirebase(code, localStorage.getItem('playerDocId') || 'uid-anonimo');
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