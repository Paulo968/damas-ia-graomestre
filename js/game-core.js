// ======================================
// GAME-CORE.JS
// (Atualizado com funções de Login/Registro)
// ======================================

// 1. IMPORTAÇÕES
import { 
  db, doc, setDoc, getDoc, onSnapshot, updateDoc, 
  collection, addDoc, query, where, getDocs // 🔧 Ferramentas novas
} from './firebase.js';

let ui;
export function injectUITools(tools) {
  ui = tools;
}

// ... (Constantes, Estado do Jogo, IA, Helpers... sem mudanças) ...
export const COR_CLARA   = 'bg-slate-200';
export const COR_ESCURA  = 'bg-slate-700';
export const P_VERMELHA  = 'bg-red-600 border-red-900';
export const P_BRANCA    = 'bg-white border-slate-400';
export const RED   = 'red';
export const WHITE = 'white';
export const KING  = '-king';
export let board = Array(8).fill(null).map(()=>Array(8).fill(null));
export let current = WHITE;
export let selected = null;
export let legal = [];
export let stats = JSON.parse(localStorage.getItem('damasStats') || '{"wins":0,"losses":0}');
export let matchHistory = JSON.parse(localStorage.getItem('matchHistory') || '[]');
export let gameHistory = [];
export let isOnline = false;
export let currentRoom = null;
export let onlineUnsubscribe = null;
export let worker;
let lastMoveSentTimestamp = 0;
export function setOnline(val) { isOnline = val; }
export function setCurrentRoom(val) { currentRoom = val; }
export function setOnlineUnsubscribe(val) { onlineUnsubscribe = val; }
let aiProfile = JSON.parse(localStorage.getItem('aiProfile') || '{"agg":0.5,"def":0.5}');
function updateAIProfile(result){ /* ... (sem mudança) ... */ }
export function getAIProfile(){ return aiProfile; }
export function setPlayerColor(color){ localStorage.setItem('playerColor', color); }
export function getPlayerColor(){ return localStorage.getItem('playerColor') || 'white'; }
export function ajustarOrientacao(playerColor){ /* ... (sem mudança) ... */ }
function cloneBoard(b) { /* ... (sem mudança) ... */ }
function getBoardHash(b) { /* ... (sem mudança) ... */ }
function serializeBoard(b) { /* ... (sem mudança) ... */ }
function deserializeBoard(s) { /* ... (sem mudança) ... */ }


// ======================================
// 🔧 5. LÓGICA DE LOGIN E REGISTRO (NOVO)
// ======================================

// A "tabela" de jogadores no Firestore
const playersCollection = collection(db, "players");

/**
 * Salva os dados do jogador logado no localStorage
 */
function salvarSessao(playerData) {
  localStorage.setItem('playerDocId', playerData.id); // O ID do documento
  localStorage.setItem('playerName', playerData.nome);
  localStorage.setItem('playerElo', playerData.elo);
  console.log("Sessão salva:", playerData.nome);
}

/**
 * Tenta registrar um novo jogador
 */
export async function registrarJogador(nome, pin) {
  if (nome.length < 3 || pin.length !== 4) {
    return { success: false, message: "Nome (mín 3) e PIN (4 dígitos)!" };
  }

  // 1. Verifica se o nome já existe
  const q = query(playersCollection, where("nome", "==", nome.toUpperCase()));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    // Nome já existe
    return { success: false, message: "Este nome já está em uso!" };
  }

  // 2. Se não existe, cria o novo jogador
  try {
    const newPlayerData = {
      nome: nome.toUpperCase(),
      pin: pin, // ⚠️ ALERTA: Salvando PIN como texto puro!
      elo: 1000,
      vitorias: 0,
      derrotas: 0
    };
    const docRef = await addDoc(playersCollection, newPlayerData);
    
    // 3. Salva a sessão
    salvarSessao({ id: docRef.id, ...newPlayerData });
    return { success: true, user: newPlayerData };

  } catch (error) {
    console.error("Erro ao registrar:", error);
    return { success: false, message: "Erro ao conectar ao banco de dados." };
  }
}

/**
 * Tenta logar um jogador existente
 */
export async function logarJogador(nome, pin) {
  if (!nome || pin.length !== 4) {
    return { success: false, message: "Preencha nome e PIN de 4 dígitos." };
  }
  
  // 1. Procura pelo nome
  const q = query(playersCollection, where("nome", "==", nome.toUpperCase()));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return { success: false, message: "Nome não encontrado!" };
  }

  // 2. Encontrou o nome, checa o PIN
  const userDoc = querySnapshot.docs[0]; // Pega o primeiro (e único) resultado
  const userData = userDoc.data();

  if (userData.pin !== pin) {
    return { success: false, message: "PIN incorreto!" };
  }

  // 3. Tudo certo, salva a sessão
  const playerData = { id: userDoc.id, ...userData };
  salvarSessao(playerData);
  return { success: true, user: playerData };
}


// ======================================
// 6. LÓGICA DE REDE (FIREBASE)
// (Nenhuma mudança aqui)
// ======================================
export async function criarSalaFirebase(codigo, jogador1_uid) { /* ... (sem mudança) ... */ }
export async function entrarSalaFirebase(codigo, jogador2_uid) { /* ... (sem mudança) ... */ }
export function gerarCodigo() { /* ... (sem mudança) ... */ }
export function ouvirSala(codigo) { /* ... (sem mudança) ... */ }
async function enviarJogadaFirebase(mv, isMultiCapture = false) { /* ... (sem mudança) ... */ }
async function enviarFimDeJogoFirebase(vencedor) { /* ... (sem mudança) ... */ }

// ======================================
// 7. REGRAS E MOVIMENTOS
// (Nenhuma mudança aqui)
// ======================================
export function initBoard(){ /* ... (sem mudança) ... */ }
function drawBoardFromData(newBoardData, souHost) { /* ... (sem mudança) ... */ }
export function onSquareClick(e){ /* ... (sem mudança) ... */ }
function selectPiece(sq,r,c){ /* ... (sem mudança) ... */ }
function clearSelect(){ /* ... (sem mudança) ... */ }
function promoteIfNeeded(r,c,el){ /* ... (sem mudança) ... */ }
function applyMove(mv){ /* ... (sem mudança) ... */ }
function endTurn(mv){ /* ... (sem mudança) ... */ }
let provokeTimeout;
function startProvokeTimer() { /* ... (sem mudança) ... */ }
function switchPlayer() { /* ... (sem mudança) ... */ }
export function computeLegal(){ /* ... (sem mudança) ... */ }
function analyzeMatch(history, winner) { /* ... (sem mudança) ... */ }
export function onGameOver(winner){ /* ... (sem mudança) ... */ }
export function requestDesistir() { /* ... (sem mudança) ... */ }
function allMoves(player, b){ /* ... (sem mudança) ... */ }
function movesForPiece(r,c,player,b,piece){ /* ... (sem mudança) ... */ }
function simulate(b, mv){ /* ... (sem mudança) ... */ }
function followUpCaptures(b, r,c, player){ /* ... (sem mudança) ... */ }
function maxChainFromMove(b, player, mv){ /* ... (sem mudança) ... */ }
function filterMandatoryWithMaxChain(b, player, moves){ /* ... (sem mudança) ... */ }

// ======================================
// 8. IA (WEB WORKER)
// (Nenhuma mudança aqui)
// ======================================
export function getDepthByDifficulty() { /* ... (sem mudança) ... */ }
export function initWorker(){ /* ... (sem mudança) ... */ }
// ... (resto do game-core.js sem mudanças) ...

/* (Resto do arquivo game-core.js) */
function aiMove(movesToConsider=null){ /* ... (sem mudança) ... */ }
function handleAIResult(best, score, depth){ /* ... (sem mudança) ... */ }
export function countPieces(){ /* ... (sem mudança) ... */ }
window.toggleColor = () => { /* ... (sem mudança) ... */ };