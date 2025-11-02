// ======================================
// GAME-CORE.JS
// Regras do Tabuleiro, Turnos e IA
// ======================================

// 1. IMPORTAÇÕES
// Importa helpers do Firebase (OK)
import { db, doc, setDoc, getDoc, onSnapshot, updateDoc, appId, userId } from './firebase.js';

// 🚫 IMPORTAÇÕES DA UI REMOVIDAS (Corrigindo a dependência circular)

// 🚀 FERRAMENTAS DA UI (Serão injetadas)
let ui;
export function injectUITools(tools) {
  ui = tools; // Armazena as ferramentas (say, setFace, sMove, elBoard, etc.)
}

// ======================================
// 2. CONSTANTES E ESTADO
// ======================================
export const COR_CLARA   = 'bg-slate-200';
export const COR_ESCURA  = 'bg-slate-700';
export const P_VERMELHA  = 'bg-red-600 border-red-900';
export const P_BRANCA    = 'bg-white border-slate-400';
export const RED   = 'red';
export const WHITE = 'white';
export const KING  = '-king';

export let board = Array(8).fill(null).map(()=>Array(8).fill(null));
export let current = WHITE;
export let selected = null;      // {row,col,el}
export let legal = [];
export let stats = JSON.parse(localStorage.getItem('damasStats') || '{"wins":0,"losses":0}');
export let matchHistory = JSON.parse(localStorage.getItem('matchHistory') || '[]');
export let gameHistory = [];

export let isOnline = false;
export let currentRoom = null;
export let onlineUnsubscribe = null;
export let worker;

export function setOnline(val) { isOnline = val; }
export function setCurrentRoom(val) { currentRoom = val; }
export function setOnlineUnsubscribe(val) { onlineUnsubscribe = val; }

// ======================================
// 3. IA ADAPTATIVA E PERFIL
// ======================================
let aiProfile = JSON.parse(localStorage.getItem('aiProfile') || '{"agg":0.5,"def":0.5}');

function updateAIProfile(result){
  const data = JSON.parse(localStorage.getItem('aiStats') || '{"games":0,"wins":0,"losses":0}');
  data.games++;
  if (result === 'win') data.wins++;
  else data.losses++;
  
  const ratio = data.wins / Math.max(1, data.games); 
  
  aiProfile.agg = Math.max(0.1, 0.8 - ratio * 0.5);
  aiProfile.def = Math.min(0.9, 0.2 + ratio * 0.5);
  
  localStorage.setItem('aiStats', JSON.stringify(data));
  localStorage.setItem('aiProfile', JSON.stringify(aiProfile));
}

export function getAIProfile(){
  return aiProfile;
}

// ======================================
// 4. HELPERS (COR, ROTAÇÃO, HASH)
// ======================================
export function setPlayerColor(color){
  localStorage.setItem('playerColor', color);
}
export function getPlayerColor(){
  return localStorage.getItem('playerColor') || 'white';
}

export function ajustarOrientacao(playerColor){
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  const isRed = playerColor === 'red';

  boardEl.classList.toggle('rot-180', isRed);
  boardEl.querySelectorAll('.piece').forEach(p=>{
    p.classList.toggle('counter-rot', isRed);
  });
}

function cloneBoard(b) {
  const nb = Array(8);
  for (let i = 0; i < 8; i++) nb[i] = b[i].slice();
  return nb;
}

function getBoardHash(b) {
  let hash = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p === null) hash += '0';
      else if (p === WHITE) hash += '1';
      else if (p === RED) hash += '2';
      else if (p === (WHITE + KING)) hash += '3';
      else if (p === (RED + KING)) hash += '4';
    }
  }
  return hash;
}

function serializeBoard(b) {
  return b.map(row => 
    row.map(p => {
      if (p === null) return '0';
      if (p === WHITE) return '1';
      if (p === RED) return '2';
      if (p === (WHITE + KING)) return '3';
      if (p === (RED + KING)) return '4';
      return '0';
    }).join('')
  ).join('|');
}

function deserializeBoard(s) {
  if (!s || typeof s !== 'string') return null;
  const rows = s.split('|');
  if (rows.length !== 8) return null;
  return rows.map(rowStr => {
    if (rowStr.length !== 8) return null;
    return rowStr.split('').map(c => {
      switch(c) {
        case '1': return WHITE;
        case '2': return RED;
        case '3': return WHITE + KING;
        case '4': return RED + KING;
        default: return null;
      }
    });
  });
}

// ======================================
// 5. LÓGICA DE REDE (FIREBASE)
// ======================================
export async function criarSalaFirebase(codigo, jogador1_uid) {
  if (!db || !doc || !setDoc || !appId) {
    ui.showOverlayError("Erro de conexão (DB1). O modo online não funcionará.");
    return;
  }
  const salaRef = doc(db, `artifacts/${appId}/public/data/salas`, codigo);
  try {
    await setDoc(salaRef, {
      Jogador1: jogador1_uid,
      Jogador2: "",
      Tabuleiro: null,
      JogadorDaVez: WHITE,
      Status: "Esperando",
      Timestamp: Date.now()
    });
  } catch (error) {
     console.error("Erro ao criar sala:", error);
     ui.showOverlayError("Erro ao criar sala no servidor.");
  }
}

export async function entrarSalaFirebase(codigo, jogador2_uid) {
  if (!db || !doc || !getDoc || !updateDoc || !appId) {
    ui.showOverlayError("Erro de conexão (DB2). O modo online não funcionará.");
    return false;
  }
  const salaRef = doc(db, `artifacts/${appId}/public/data/salas`, codigo);
  
  try {
    const salaSnap = await getDoc(salaRef);
  
    if (!salaSnap.exists()) {
      ui.showOverlayError("Sala não encontrada!");
      return false;
    }
    
    const data = salaSnap.data();
    if (data.Status !== "Esperando") {
      ui.showOverlayError("Esta sala já está cheia ou encerrada.");
      return false;
    }
  
    await updateDoc(salaRef, { 
      Jogador2: jogador2_uid,
      Status: "Em jogo",
      Timestamp: Date.now()
    });
    return true;
  } catch (error) {
    console.error("Erro ao entrar na sala:", error);
    ui.showOverlayError("Erro ao conectar à sala.");
    return false;
  }
}

export function gerarCodigo() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

export function ouvirSala(codigo) {
  if (!db || !doc || !onSnapshot) {
    console.error("Firebase DB não está inicializado. Aguardando...");
    setTimeout(() => ouvirSala(codigo), 500);
    return;
  }
  
  if (onlineUnsubscribe) {
    onlineUnsubscribe();
    setOnlineUnsubscribe(null);
  }
  
  const salaRef = doc(db, `artifacts/${appId}/public/data/salas`, codigo);

  const unsub = onSnapshot(salaRef, (docSnap) => {
    const data = docSnap.data();
    if (!data) {
      console.log("Dados da sala não encontrados ou sala removida.");
      return;
    }

    if (data.Status === "Em jogo" && !document.getElementById('board').innerHTML) {
      console.log("Oponente entrou! Iniciando jogo.");
      ui.elOverlay.innerHTML = "🛰️<br/>Oponente conectado! Iniciando...";
      ui.elOverlay.classList.add('show');
      setTimeout(() => {
          ui.elOverlay.classList.remove('show');
          document.getElementById('menuContainer').style.display = 'none'; 
          initBoard(); 
      }, 2000);
    }

    if (data.Tabuleiro && data.JogadorDaVez) {
      const newBoard = deserializeBoard(data.Tabuleiro);
      const newCurrent = data.JogadorDaVez;
      
      const souHost = getPlayerColor() === 'white';
      
      if (serializeBoard(board) !== data.Tabuleiro) {
         console.log("Recebendo atualização do tabuleiro...");
         drawBoardFromData(newBoard, souHost); 
         ui.sMove.play().catch(()=>{});
         if (data.UltimaJogada?.type === 'capture') {
           ui.sCap.play().catch(()=>{});
           ui.shakeBoard();
         }
      }
      
      current = newCurrent;
      computeLegal();
      
      const myColor = getPlayerColor();
      if (current === myColor) {
        ui.bubblePlaceholder.textContent = `Sala: ${currentRoom} | Sua vez!`;
      } else {
        ui.bubblePlaceholder.textContent = `Sala: ${currentRoom} | Vez do oponente...`;
      }
    }

    if (data.Status === "Encerrado") {
      console.log("🏁 Sala encerrada!");
      onGameOver(data.Vencedor);
      if (onlineUnsubscribe) onlineUnsubscribe();
    }
  });
  setOnlineUnsubscribe(unsub);
}

async function enviarJogadaFirebase(mv) {
  if (!isOnline || !currentRoom) return;
  if (!db || !doc || !updateDoc) {
     console.error("Firebase DB não está inicializado.");
     return;
  }
  const salaRef = doc(db, `artifacts/${appId}/public/data/salas`, currentRoom);
  const proximoJogador = (current === WHITE) ? RED : WHITE;

  try {
    await updateDoc(salaRef, {
      Tabuleiro: serializeBoard(board),
      JogadorDaVez: proximoJogador,
      UltimaJogada: mv ? { from: mv.from, to: mv.to, type: mv.type } : null,
      Timestamp: Date.now()
    });
    console.log("Jogada enviada. Próximo:", proximoJogador);
  } catch (error) {
    console.error("Erro ao enviar jogada:", error);
  }
}

async function enviarFimDeJogoFirebase(vencedor) {
  if (!isOnline || !currentRoom || getPlayerColor() !== WHITE) return;
  if (!db || !doc || !updateDoc) {
     console.error("Firebase DB não está inicializado.");
     return;
  }
  const salaRef = doc(db, `artifacts/${appId}/public/data/salas`, currentRoom);
  
  try {
    await updateDoc(salaRef, {
      Status: "Encerrado",
      Vencedor: vencedor
    });
    console.log("Fim de jogo enviado. Vencedor:", vencedor);
  } catch (error) {
    console.error("Erro ao enviar fim de jogo:", error);
  }
}

// ======================================
// 6. REGRAS E MOVIMENTOS
// ======================================

function inB(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

function createPiece(colorClass, player){
  const piece=document.createElement('div');
  piece.className=`piece w-[70%] h-[70%] rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-lg border-4 cursor-pointer hover:opacity-90 transition ${colorClass}`;
  piece.dataset.player=player;
  const inner=document.createElement('div');
  inner.className='w-1/2 h-1/2 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 border-2 border-white/50';
  piece.appendChild(inner);
  return piece;
}

export function initBoard(){
  const btnOpcoes = document.getElementById('btnMenuOpcoes');
  btnOpcoes.style.opacity = '0';
  btnOpcoes.style.display = 'block';
  setTimeout(() => btnOpcoes.style.opacity = '1', 50);

  gameHistory = []; 

  if (worker) worker.postMessage({ resetCache: true });

  ui.elBoard.innerHTML=''; // 🔧 MUDADO
  board = Array(8).fill(null).map(()=>Array(8).fill(null));
  selected=null; 
  current = WHITE; 

  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const sq=document.createElement('div');
      const dark=(r+c)%2!==0;
      sq.className=`aspect-square relative ${dark?COR_ESCURA:COR_CLARA}`;
      sq.dataset.r=r; sq.dataset.c=c;
      if(dark){
        if(r<3){ const p=createPiece(P_VERMELHA,RED); sq.appendChild(p); board[r][c]=RED; }
        else if(r>4){ const p=createPiece(P_BRANCA,WHITE); sq.appendChild(p); board[r][c]=WHITE; }
      }
      ui.elBoard.appendChild(sq); // 🔧 MUDADO
      sq.addEventListener('click', onSquareClick);
    }
  }

  computeLegal();
  
  if (isOnline) {
    ui.setFace('idle'); // 🔧 MUDADO
    ui.bubble.classList.remove('show'); // 🔧 MUDADO
    ui.bubblePlaceholder.textContent = `Sala: ${currentRoom} | Aguardando jogada...`; // 🔧 MUDADO
    
    ajustarOrientacao(getPlayerColor());
    
    if (getPlayerColor() === WHITE) {
      enviarJogadaFirebase(null);
    }

  } else {
    ui.setFace('idle'); // 🔧 MUDADO
    const diff = localStorage.getItem('difficulty') || 'medium';
    if(diff === 'easy') ui.say("Modo de treino ativo. Ajustando nível humano."); // 🔧 MUDADO
    else if(diff === 'master') ui.say("Modo Grão-Mestre: nenhum erro será perdoado."); // 🔧 MUDADO
    else ui.say('start'); // 🔧 MUDADO
    ajustarOrientacao('white');
  }
}

function drawBoardFromData(newBoardData, souHost) {
  if (!newBoardData) return;
  board = newBoardData;
  
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const sq = ui.squareEl(r,c); // 🔧 MUDADO
      if (!sq) continue;
      sq.innerHTML = '';
      
      const piece = board[r][c];
      if (piece) {
        const colorClass = piece.startsWith(WHITE) ? P_BRANCA : P_VERMELHA;
        const player = piece.startsWith(WHITE) ? WHITE : RED;
        const pEl = createPiece(colorClass, player);
        
        if (piece.endsWith(KING)) {
          pEl.classList.add('king');
        }
        
        if (!souHost) { 
          pEl.classList.add('counter-rot');
        }
        sq.appendChild(pEl);
      }
    }
  }
  
  if (!souHost) {
    document.getElementById('board').classList.add('rot-180');
  }
}


export function onSquareClick(e){
  if (isOnline && current !== getPlayerColor()) {
    console.log("Não é sua vez!");
    return;
  }
  if (!isOnline && current === RED) {
    console.log("IA está jogando!");
    return;
  }
  
  const sq=e.currentTarget;
  const r=+sq.dataset.r, c=+sq.dataset.c;
  const piece=board[r][c];

  if(selected){
    const mv = legal.find(m=> m.from[0]===selected.r && m.from[1]===selected.c && m.to[0]===r && m.to[1]===c);
    if(mv){ 
      applyMove(mv); 
      endTurn(mv); 
    }
    else{
      clearSelect();
      if(piece && piece.startsWith(current)) selectPiece(sq,r,c);
    }
  } else if(piece && piece.startsWith(current)){
    selectPiece(sq,r,c);
  }
}

function selectPiece(sq,r,c){
  clearSelect();
  const el= sq.querySelector('div[data-player]');
  if(!el) return;
  el.classList.add('ring-4','ring-yellow-400');
  selected={r,c,el};
}
function clearSelect(){
  if(selected?.el) selected.el.classList.remove('ring-4','ring-yellow-400');
  selected=null;
}

function promoteIfNeeded(r,c,el){
  const t=board[r][c];
  if(!t || t.endsWith(KING)) return;
  if((t===WHITE && r===0) || (t===RED && r===7)){
    board[r][c]=t+KING;
    if(el) el.classList.add('king');
    ui.setFace('promo',{shake:true,pulse:true}); // 🔧 MUDADO
    ui.say('promo'); // 🔧 MUDADO
  }
}

function applyMove(mv){
  const {from,to,type,jumped} = mv;
  const pieceEl = selected ? selected.el : ui.squareEl(from[0],from[1])?.querySelector('div[data-player]'); // 🔧 MUDADO
  
  const pieceElFallback = ui.squareEl(from[0],from[1])?.querySelector('div[data-player]'); // 🔧 MUDADO
  const finalPieceEl = pieceEl || pieceElFallback;
  
  const t = board[from[0]][from[1]];
  
  const hash = getBoardHash(board); 

  board[to[0]][to[1]] = t;
  board[from[0]][from[1]] = null;
  
  const fromSq = ui.squareEl(from[0],from[1]); // 🔧 MUDADO
  if (fromSq) fromSq.innerHTML = '';

  const toSq = ui.squareEl(to[0],to[1]); // 🔧 MUDADO
  if(finalPieceEl && toSq) {
    toSq.innerHTML = '';
    toSq.appendChild(finalPieceEl);
  }

  ui.sMove.play().catch(()=>{}); // 🔧 MUDADO
  if(type==='capture'){
    const jSq = ui.squareEl(jumped[0],jumped[1]); // 🔧 MUDADO
    if(jSq){ board[jumped[0]][jumped[1]]=null; jSq.innerHTML=''; }
    const rect = toSq.getBoundingClientRect();
    ui.explodeAt(rect.left+rect.width/2, rect.top+rect.height/2); // 🔧 MUDADO
    ui.shakeBoard(); ui.sCap.play().catch(()=>{}); // 🔧 MUDADO
    ui.setFace('capture',{shake:true}); // 🔧 MUDADO
    ui.say('capture'); // 🔧 MUDADO
  }

  const { w, r } = countPieces();
  gameHistory.push({
    player: current,
    move: mv,
    hash: hash,
    white: w,
    red: r,
    diff: r - w,
    time: Date.now()
  });

  promoteIfNeeded(to[0],to[1],finalPieceEl);
  clearSelect();
}

function endTurn(mv){
  let isMultiCapture = false;

  if(mv.type==='capture'){
    const more = followUpCaptures(board, mv.to[0], mv.to[1], current);
    if(more.length){
      isMultiCapture = true;
      legal = more;
      
      const myColor = getPlayerColor();
      if ((!isOnline && current === WHITE) || (isOnline && current === myColor)) {
        const sq = ui.squareEl(mv.to[0], mv.to[1]); // 🔧 MUDADO
        setTimeout(()=> selectPiece(sq, mv.to[0], mv.to[1]), 60);
      } else if (!isOnline && current === RED) {
        setTimeout(()=> aiMove(more), 250);
      }
      
    }
  }
  
  if (!isMultiCapture) {
    if (isOnline) {
      enviarJogadaFirebase(mv);
    }
    switchPlayer();
  } else {
    if (isOnline) {
      enviarJogadaFirebase(mv);
    }
  }
}

// 🔧 NOVO: 'startProvokeTimer' movido para cá (lógica do jogo)
let provokeTimeout;
function startProvokeTimer() {
  clearTimeout(provokeTimeout);
  if (isOnline) return;
  provokeTimeout = setTimeout(() => {
    if (current === WHITE) {
      const provocations = [
        "Ainda calculando? O tempo não espera, humano.",
        "Silêncio... o medo fala mais alto que a lógica?",
        "Cada segundo é uma vantagem que eu registro."
      ];
      ui.say(provocations[Math.floor(Math.random() * provocations.length)]); // 🔧 MUDADO
      ui.setFace('thinking', { pulse: true }); // 🔧 MUDADO
    }
  }, 12000);
}

function switchPlayer() {
  current = (current === WHITE) ? RED : WHITE;
  computeLegal();
  
  if (isOnline) {
    const myColor = getPlayerColor();
    if (current === myColor) {
      ui.bubblePlaceholder.textContent = `Sala: ${currentRoom} | Sua vez!`; // 🔧 MUDADO
    } else {
      ui.bubblePlaceholder.textContent = `Sala: ${currentRoom} | Vez do oponente...`; // 🔧 MUDADO
    }
  } else {
    if (current === WHITE) startProvokeTimer(); // 🔧 MUDADO (chama a função local)
    if (current === RED && legal.length > 0) aiMove();
  }
}

export function computeLegal(){
  const all = allMoves(current, board);
  legal = filterMandatoryWithMaxChain(board, current, all);
  if(legal.length===0 && current!==null){
    const winner = (current===WHITE)? RED : WHITE;
    onGameOver(winner);
  }
}

// 🔧 NOVO: 'analyzeMatch' movido para cá (lógica do jogo)
function analyzeMatch(history, winner) {
  let tips = [];
  // (A verificação 'isOnline' foi removida, 
  // pois onGameOver já faz essa checagem)
  
  if (history.length < 3) {
    tips.push("Partida curta demais para análise detalhada.");
  } else {
    let swings = 0;
    for (let i = 1; i < history.length; i++) {
      if (Math.abs(history[i].diff - history[i - 1].diff) >= 2) swings++;
    }
    if (swings > 2) tips.push("Muitas oscilações de vantagem — tente manter uma linha estratégica mais estável.");
    if (swings > 4) tips.push("Tua variação tática é alta — IA detecta padrão de risco em lances médios.");

    const last = history[history.length - 1];
    if (last.diff < 0 && winner === RED) tips.push("Perdeu mais peças do que o necessário — foque em trocas vantajosas.");
    if (last.diff > 0 && winner === RED) tips.push("Boa vantagem material — controle sólido do tabuleiro!");
    if (winner === RED && last.diff > 4) tips.push("Controle de ritmo absoluto — humano perdeu domínio do tempo.");

    if (history.length > 50) tips.push("Partida longa — considere encurtar trocas e forçar o avanço das damas.");
    else if (history.length < 20) tips.push("Partida rápida — reveja aberturas e defesas iniciais.");

    if (winner === WHITE) tips.push("Vitória estratégica! Continue priorizando o centro e as diagonais longas.");
    else tips.push("Observe o controle de centro da IA — evitar recuar demais nas aberturas.");
    if (winner === WHITE && swings < 2) tips.push("Controle estável — IA reconhece jogada de precisão.");
  }
  return tips;
}

export function onGameOver(winner){
  if (isOnline && getPlayerColor() === WHITE) {
    enviarFimDeJogoFirebase(winner);
  }
  
  if (onlineUnsubscribe) {
    onlineUnsubscribe();
    setOnlineUnsubscribe(null);
  }
  setCurrentRoom(null);
  
  const btnOpcoes = document.getElementById('btnMenuOpcoes');
  btnOpcoes.style.opacity = '0';
  setTimeout(() => btnOpcoes.style.display = 'none', 300);
  document.getElementById('menuFlutuante').classList.add('hidden');

  current = null;
  const { w, r } = countPieces();
  const diff = r - w;

  if (winner === RED) {
    if (!isOnline) {
      stats.losses++;
      localStorage.setItem('damasStats', JSON.stringify(stats));
      ui.elOverlay.innerHTML = "🤖♟️ <br/> IA VENCEU. Fim de jogo."; // 🔧 MUDADO
      ui.setFace('win', { ahead: true }); // 🔧 MUDADO
      ui.say('win'); // 🔧 MUDADO
      ui.sLose.play().catch(() => {}); // 🔧 MUDADO

      setTimeout(() => {
        if (diff > 5) ui.say(["Domínio completo. Tua defesa foi lenta demais."]); // 🔧 MUDADO
        else if (diff >= 2) ui.say(["Equilíbrio até o meio-jogo, mas minha leitura foi superior."]); // 🔧 MUDADO
        else ui.say(["Partida disputada. Um erro e a vantagem virou avalanche."]); // 🔧 MUDADO
        
        setTimeout(() => ui.say(["Reiniciando protocolos para revanche..."]), 5000); // 🔧 MUDADO
      }, 1500);
      
    } else {
      if (getPlayerColor() === RED) {
        ui.elOverlay.innerHTML = "🏆👏 <br/> VOCÊ VENCEU! (Vermelho)"; // 🔧 MUDADO
        ui.sWin.play().catch(() => {}); // 🔧 MUDADO
      } else {
        ui.elOverlay.innerHTML = "💔😔 <br/> VOCÊ PERDEU. (Branco)"; // 🔧 MUDADO
        ui.sLose.play().catch(() => {}); // 🔧 MUDADO
      }
    }

  } else {
    if (!isOnline) {
      stats.wins++;
      localStorage.setItem('damasStats', JSON.stringify(stats));
      ui.elOverlay.innerHTML = "🏆👏 <br/> VOCÊ VENCEU! Parabéns."; // 🔧 MUDADO
      ui.setFace('lose', { behind: true, shake: true }); // 🔧 MUDADO
      ui.say('lose'); // 🔧 MUDADO
      ui.sWin.play().catch(() => {}); // 🔧 MUDADO

      setTimeout(() => {
        if (diff < -5) ui.say(["Derrota ampla. Teu domínio foi técnico e frio."]); // 🔧 MUDADO
        else if (diff <= -2) ui.say(["Boa partida. Tuas trocas foram mais eficientes que o previsto."]); // 🔧 MUDADO
        else ui.say(["Margem pequena, mas tua paciência venceu."]); // 🔧 MUDADO
        
        setTimeout(() => ui.say(["Reajustando parâmetros... pronto para a revanche."]), 5000); // 🔧 MUDADO
      }, 1500);
      
    } else {
      if (getPlayerColor() === WHITE) {
        ui.elOverlay.innerHTML = "🏆👏 <br/> VOCÊ VENCEU! (Branco)"; // 🔧 MUDADO
        ui.sWin.play().catch(() => {}); // 🔧 MUDADO
      } else {
        ui.elOverlay.innerHTML = "💔😔 <br/> VOCÊ PERDEU. (Vermelho)"; // 🔧 MUDADO
        ui.sLose.play().catch(() => {}); // 🔧 MUDADO
      }
    }
  }

  if (!isOnline) {
    updateAIProfile(winner === RED ? 'win' : 'lose');
  }

  let feedback;
  if (!isOnline) {
    matchHistory.push({ winner, date: new Date().toISOString(), moves: gameHistory });
    if (matchHistory.length > 3) matchHistory.shift();
    localStorage.setItem('matchHistory', JSON.stringify(matchHistory));
    
    // 🔧 MUDADO: chama a função local
    feedback = analyzeMatch(gameHistory, winner); 
  } else {
    feedback = ["Análise de partida não disponível para jogos online."];
  }
  
  if (!isOnline && worker) {
      worker.postMessage({ 
          action: 'memorize', 
          history: gameHistory,
          result: (winner === RED ? 'win' : 'lose') 
      });
  }

  ui.elOverlay.classList.add('show'); // 🔧 MUDADO

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    setTimeout(async () => {
      ui.elOverlay.classList.remove('show'); // 🔧 MUDADO
      ui.elOverlay.style.opacity = ''; // 🔧 MUDADO
      ui.openAnalysisModal(feedback); // 🔧 MUDADO
    }, 1200);
  } else {
    setTimeout(() => {
      ui.elOverlay.style.transition = 'opacity 1s ease'; // 🔧 MUDADO
      ui.elOverlay.style.opacity = '0'; // 🔧 MUDADO
    }, 3000);

    setTimeout(async () => {
      ui.elOverlay.classList.remove('show'); // 🔧 MUDADO
      ui.elOverlay.style.opacity = ''; // 🔧 MUDADO
      ui.openAnalysisModal(feedback); // 🔧 MUDADO
    }, 4000);
  }
}

// 🔧 NOVO: Lógica de desistência movida para cá
export function requestDesistir() {
    if (ui.sDesist) ui.sDesist.play().catch(()=>{});
    else if (ui.closeSound) ui.closeSound.play().catch(()=>{});
    
    if (isOnline) {
      onGameOver(getPlayerColor() === WHITE ? RED : WHITE);
    } else {
      const frasesDesistencia = [
        "Fugindo da lógica? Eu ainda estava me aquecendo.",
        "Abandonar é uma jogada... previsível.",
        "A covardia é o atalho dos impacientes."
      ];
      const fala = frasesDesistencia[Math.floor(Math.random() * frasesDesistencia.length)];
      ui.say(fala);
      ui.setFace('thinking', { shake:true });
    
      ui.elOverlay.innerHTML = "🏳️ Desistência registrada.<br/> IA vence por abandono.";
      ui.elOverlay.classList.add('show');
      
      const btnOpcoes = document.getElementById('btnMenuOpcoes');
      btnOpcoes.style.opacity = '0';
      setTimeout(() => btnOpcoes.style.display = 'none', 300);

      setTimeout(() => {
        ui.elOverlay.classList.remove('show');
        ui.returnToMenu(); // Chama a função da UI
      }, 3000);
    }
}


// ======================================
// 7. GERAÇÃO DE LANCES (REGRAS)
// ======================================
function allMoves(player, b){
  const M=[];
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const piece=b[r][c];
      if(piece && piece.startsWith(player)){
        M.push(...movesForPiece(r,c,player,b,piece));
      }
    }
  }
  return M;
}

function movesForPiece(r,c,player,b,piece){
  const res=[]; const king = piece.endsWith(KING);
  const opp = (player===WHITE)? RED : WHITE;
  const DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for(const [dr,dc] of DIRS){
    if(king){
      for(let i=1;i<8;i++){
        const nr=r+dr*i, nc=c+dc*i; if(!inB(nr,nc)) break;
        const cont=b[nr][nc];
        if(cont===null){
          res.push({from:[r,c],to:[nr,nc],type:'move'});
        }else if(cont.startsWith(opp)){
          for(let j=i+1;j<8;j++){
            const lr=r+dr*j, lc=c+dc*j; if(!inB(lr,lc)) break;
            if(b[lr][lc]===null){
              res.push({from:[r,c],to:[lr,lc],type:'capture',jumped:[nr,nc]});
            } else break;
          }
          break;
        } else break;
      }
    }else{
      const forward = (player===WHITE)? -1 : 1;
      if(dr===forward){
        const nr=r+dr, nc=c+dc;
        if(inB(nr,nc) && b[nr][nc]===null){
          res.push({from:[r,c],to:[nr,nc],type:'move'});
        }
      }
      const nr=r+dr, nc=c+dc, lr=r+dr*2, lc=c+dc*2;
      if(inB(lr,lc) && b[lr][lc]===null){
        if(inB(nr,nc) && b[nr][nc] && b[nr][nc].startsWith(opp)){
          res.push({from:[r,c],to:[lr,lc],type:'capture',jumped:[nr,nc]});
        }
      }
    }
  }
  return res;
}

function simulate(b, mv){
  const nb = cloneBoard(b);
  const {from,to,type,jumped}=mv;
  const t=nb[from[0]][from[1]];
  nb[to[0]][to[1]] = t;
  nb[from[0]][from[1]] = null;
  if(type==='capture'){ nb[jumped[0]][jumped[1]] = null; }
  if((t===WHITE && to[0]===0) || (t===RED && to[0]===7)){
    if(!t.endsWith(KING)) nb[to[0]][to[1]] = t+KING;
  }
  return nb;
}

function followUpCaptures(b, r,c, player){
  const piece = b[r][c];
  if(!piece) return [];
  const next = movesForPiece(r,c,player,b,piece).filter(m=>m.type==='capture');
  return next;
}

function maxChainFromMove(b, player, mv){
  let depth=1;
  const stack = [{board: simulate(b,mv), r: mv.to[0], c: mv.to[1], d:1}];
  let best=1;
  while(stack.length){
    const {board:cb,r,c,d} = stack.pop();
    const caps = followUpCaptures(cb, r,c, player);
    if(caps.length===0){ if(d>best) best=d; }
    else{
      for(const m of caps){
        stack.push({board: simulate(cb,m), r:m.to[0], c:m.to[1], d:d+1});
      }
    }
  }
  return best;
}

function filterMandatoryWithMaxChain(b, player, moves){
  const caps = moves.filter(m=>m.type==='capture');
  if(caps.length===0) return moves.filter(m=>m.type==='move');
  let bestLen = 1, scored=[];
  for(const m of caps){
    const len = maxChainFromMove(b, player, m);
    scored.push({m, len});
    if(len>bestLen) bestLen=len;
  }
  return scored.filter(s=>s.len===bestLen).map(s=>s.m);
}

// ======================================
// 8. IA (WEB WORKER)
// ======================================
export function getDepthByDifficulty() {
  const diff = localStorage.getItem('difficulty') || 'medium';
  switch (diff) {
    case 'easy': return 4;
    case 'medium': return 8;
    case 'hard': return 14;
    case 'master': return 22;
    default: return 8;
  }
}

export function initWorker(){
  worker = new Worker('./js/worker.js');
  
  worker.onmessage = (e)=>{
    const data = e.data;
    
    if (data.action === 'say') {
      ui.say(data.group, data.extra || ''); // 🔧 MUDADO
      return;
    }

    const {best, score, depth} = data;
    if(!best){ 
      if(legal[0]) handleAIResult(legal[0], -999, 0, 'fallback');
      return;
    }
    handleAIResult(best, score, depth);
  };
}

function aiMove(movesToConsider=null){
  if(isOnline) return;
  if(!worker) return;
  const subset = movesToConsider || null;
  
  ui.updateFaceState(); // 🔧 MUDADO
  ui.say('thinking'); // 🔧 MUDADO

  worker.postMessage({ 
    board, 
    legal, 
    subset, 
    aiProfile: getAIProfile(),
    maxDepth: getDepthByDifficulty()
  });
}

function handleAIResult(best, score, depth){
  if (score < -0.4) {
    ui.setFace('ahead', { ahead: true }); // 🔧 MUDADO
    if (best.type !== 'capture' && best.type !== 'multi') ui.say('ahead'); // 🔧 MUDADO
  } else if (score > 0.4) {
    ui.setFace('behind', { behind: true }); // 🔧 MUDADO
    if (best.type !== 'capture' && best.type !== 'multi') ui.say('behind'); // 🔧 MUDADO
  }

  const fs = ui.squareEl(best.from[0],best.from[1]); // 🔧 MUDADO
  const ts = ui.squareEl(best.to[0],best.to[1]); // 🔧 MUDADO
  fs && fs.classList.add('ring-4','ring-red-500','opacity-80','z-10');
  ts && ts.classList.add('ring-4','ring-yellow-400','opacity-80','z-10');

  setTimeout(()=>{
    applyMove(best);
    fs && fs.classList.remove('ring-4','ring-red-500','opacity-80','z-10');
    ts && ts.classList.remove('ring-4','ring-yellow-400','opacity-80','z-10');
    endTurn(best);
  }, 280);
}

// ======================================
// 9. HELPERS FINAIS (EMOÇÕES)
// ======================================
export function countPieces(){
  let w=0,r=0;
  for(let i=0;i<8;i++) for(let j=0;j<8;j++){
    const v=board[i][j];
    if(v?.startsWith(WHITE)) w++;
    if(v?.startsWith(RED)) r++;
  }
  return {w,r};
}

// Helper para o dev console
window.toggleColor = () => {
  const newColor = getPlayerColor() === 'white' ? 'red' : 'white';
  setPlayerColor(newColor);
  ajustarOrientacao(newColor);
  console.log('Agora você é:', newColor);
};