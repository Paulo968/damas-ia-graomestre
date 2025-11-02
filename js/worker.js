const RED='red', WHITE='white', KING='-king';

// 📚 LIVRO DE ABERTURAS — VERSÃO GRÃO-MESTRE
const OPENINGS = [
  // 🔸 Aberturas Clássicas
  { seq: ['f6-e5'], reply: 'c3-d4' },   // Abertura cruzada padrão
  { seq: ['f6-d4'], reply: 'b2-c3' },   // Variante defensiva
  { seq: ['g5-f4'], reply: 'c3-d4' },   // Defesa francesa
  { seq: ['h6-g5'], reply: 'c3-b4' },   // Defesa lateral clássica
  { seq: ['g7-f6'], reply: 'd2-c3' },   // Avanço seguro central

  // 🔹 Aberturas Avançadas (controle de centro)
  { seq: ['e5-d4'], reply: 'b2-c3' },
  { seq: ['e7-d6'], reply: 'c3-d4' },
  { seq: ['d6-c5'], reply: 'b4-c5' },
  { seq: ['f4-e3'], reply: 'd2-c3' },
  { seq: ['g5-e3'], reply: 'f2-g3' },

  // 🔹 Aberturas Brasileiras e Variantes
  { seq: ['h6-f4'], reply: 'c3-d4' },   // Abertura do Brasileiro
  { seq: ['g7-e5'], reply: 'd2-c3' },
  { seq: ['b6-a5'], reply: 'c3-b4' },
  { seq: ['b6-c5'], reply: 'd2-e3' },
  { seq: ['c7-b6'], reply: 'b2-c3' },

  // 🔹 Aberturas “Espelho” (contra-ataques)
  { seq: ['d6-b4'], reply: 'c3-d4' },
  { seq: ['c7-e5'], reply: 'd2-c3' },
  { seq: ['f6-h4'], reply: 'f2-g3' },
  { seq: ['g7-e5'], reply: 'f2-g3' },
  { seq: ['h6-f4'], reply: 'e3-f4' },

  // 🔸 Estratégias de controle lateral
  { seq: ['a5-b4'], reply: 'c3-d4' },
  { seq: ['b6-d4'], reply: 'b2-c3' },
  { seq: ['c5-d4'], reply: 'b2-c3' },
  { seq: ['g7-f6'], reply: 'e3-f4' },
  { seq: ['f6-g5'], reply: 'd2-e3' },

  // 🔸 Aberturas de Defesa Tática
  { seq: ['f6-e5'], reply: 'b2-c3' },
  { seq: ['e7-d6'], reply: 'c3-d4' },
  { seq: ['d6-e5'], reply: 'f2-g3' },
  { seq: ['c7-b6'], reply: 'd2-c3' },
  { seq: ['g5-f4'], reply: 'e3-f4' },

  // 🔹 Aberturas de Reversão (resposta estratégica)
  { seq: ['f6-d4'], reply: 'e3-f4' },
  { seq: ['d6-c5'], reply: 'b4-c5' },
  { seq: ['e7-f6'], reply: 'c3-d4' },
  { seq: ['g7-f6'], reply: 'f2-g3' },
  { seq: ['h6-g5'], reply: 'c3-b4' }
];

// 💡 IMPLEMENTAÇÃO 2: "Memória de padrões de jogada"
let patternMemory = {};
function memorizePattern(hash, result) {
  if (!patternMemory[hash]) patternMemory[hash] = { wins: 0, losses: 0 };
  if (result === 'win') patternMemory[hash].wins++;
  else patternMemory[hash].losses++;
  // console.log("Memorizado:", hash, patternMemory[hash]); // (Debug)
}
function patternBias(hash) {
  const p = patternMemory[hash];
  if (!p) return 0;
  const total = p.wins + p.losses;
  if (total < 2) return 0; // Só aplica viés se já viu o padrão algumas vezes
  // Influência leve (máx de +/- 0.3)
  return (p.wins - p.losses) / total * 0.3; 
}
// Fim (Implementação 2)


// ### OTIMIZAÇÃO B (Clone Manual - Worker) ###
function cloneBoard(b) {
  const nb = Array(8);
  for (let i = 0; i < 8; i++) nb[i] = b[i].slice();
  return nb;
}

// ### OTIMIZAÇÃO 2 (Hashing Rápido) ###
// Converte o tabuleiro em uma string compacta para usar como chave de cache
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

function inB(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

function simulate(b, mv){
  const nb = cloneBoard(b); // Rápido (OTIMIZAÇÃO B)
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
        if(inB(nr,nc) && b[nr][nc]===null){ res.push({from:[r,c],to:[nr,nc],type:'move'}); }
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
function allMoves(player,b){
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
function followUpCaptures(b, r,c, player){
  const piece = b[r][c];
  if(!piece) return [];
  const moves = movesForPiece(r,c,player,b,piece).filter(m=>m.type==='capture');
  return moves;
}
function isGameOver(b, player){
  const all = allMoves(player,b);
  const legal = filterMandatoryWithMaxChain(b, player, all);
  return legal.length===0;
}
function maxChainFromMove(b, player, mv){
  let best=1;
  const stack=[{board: simulate(b,mv), r: mv.to[0], c: mv.to[1], d:1}];
  while(stack.length){
    const {board:cb,r,c,d}=stack.pop();
    const caps = followUpCaptures(cb, r,c, player);
    if(caps.length===0){ if(d>best) best=d; }
    else{
      for(const m of caps) stack.push({board: simulate(cb,m), r:m.to[0], c:m.to[1], d:d+1});
    }
  }
  return best;
}
function filterMandatoryWithMaxChain(b, player, moves){
  const caps = moves.filter(m=>m.type==='capture');
  if(caps.length===0) return moves.filter(m=>m.type==='move');
  let bestLen=1, scored=[];
  for(const m of caps){
    const len=maxChainFromMove(b, player, m);
    scored.push({m,len});
    if(len>bestLen) bestLen=len;
  }
  return scored.filter(s=>s.len===bestLen).map(s=>s.m);
}

function isProtected(b,r,c,player){
  // 💡 Verifica se a peça está protegida por outra peça *atrás* dela
  const dirs = (player===RED)? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]; // Direções "para trás"
  return dirs.some(([dr,dc])=>{
    const nr=r+dr, nc=c+dc;
    return inB(nr,nc) && b[nr][nc]?.startsWith(player);
  });
}

// *** IMPLEMENTAÇÃO 1 & 3: HEURÍSTICA REFINADA + PERFIL ADAPTATIVO ***
function evalBoard(b){
  // 💡 Puxa o perfil de 'agg' e 'def' enviado pelo main script
  let agg = self.aiProfile?.agg ?? 0.5; // Agressividade
  let def = self.aiProfile?.def ?? 0.5; // Defesa

  let score=0;
  
  const n = b.flat().filter(x=>x!==null).length;
  const phase = n > 24 ? 'opening' : n > 12 ? 'mid' : 'end';
  
  // 💡 Pesos da fase agora são influenciados pelo perfil (agg/def)
  let wCenter = (phase === 'opening' ? 1.0 : (phase === 'mid' ? 0.6 : 0.2)) * (0.5 + agg); // Agressivo quer centro
  let wPromo  = (phase === 'end' ? 1.5 : 0.7);
  let wAdvance = (phase === 'opening' ? 0.3 : 0.1);
  // (Lógica de proteção foi movida para dentro do loop)

  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const v=b[r][c]; if(!v) continue;
      const isW=v.startsWith(WHITE), isK=v.endsWith(KING);
      const player = isW ? WHITE : RED;
      
      let val = isK ? 6.0 : 2.0; // Valor base (Rei vale 3x)
      
      // Avanço e Centro (influenciados pela agressividade)
      const advance = (isW ? (7 - r) : r) * (wAdvance * (0.5 + agg * 0.5));
      const center  = (c>=2 && c<=5 && r>=2 && r<=5) ? (wCenter * (0.5 + 0.5 * agg)) : 0;
      
      // Promoção
      let promo = 0;
      if(isW && !isK && r<=1) promo = wPromo * (0.5 + 0.5 * agg);
      if(!isW && !isK && r>=6) promo = wPromo * (0.5 + 0.5 * agg);
      
      // 💡 IMPLEMENTAÇÃO 1: Novas heurísticas posicionais
      let bonus = 0;

      // 1. Reis preferem o centro
      if (isK && r >= 2 && r <= 5 && c >= 2 && c <= 5) bonus += 0.3;
      
      // 2. Peças protegidas (influenciado pelo perfil 'def')
      if (!isK && isProtected(b, r, c, player)) {
          bonus += 0.4 * (0.5 + def); // IA defensiva valoriza mais
      }
      
      // 3. Avanço seguro (linhas 2/3 para brancas, 4/5 para vermelhas)
      if (!isK) {
          if (isW && (r === 2 || r === 3)) bonus += 0.2; // Avanço seguro branco
          if (!isW && (r === 4 || r === 5)) bonus += 0.2; // Avanço seguro vermelho
      }

      // (Lógica 'prot' complexa removida em favor dos bônus acima)
      const total = val + advance + center + promo + bonus;
      score += isW ? total : -total;

      // Bônus de diagonal (mantido)
      if (r === c || r + c === 7) score += isW ? 0.2 : -0.2;
    }
  }

  const wMoves = allMoves(WHITE, b).length;
  const rMoves = allMoves(RED, b).length;
  score += (wMoves - rMoves) * 0.18; // Mobilidade

  // 💡 IMPLEMENTAÇÃO 4: "Predição de armadilhas" (regras anteriores)
  if (rMoves > wMoves + 4) score -= 0.3; // Diminui score do WHITE (bom p/ IA)
  if (phase === 'mid' && Math.abs(score) < 0.2) {
      score -= 0.1 * Math.sign(agg - 0.5); // Se agg > 0.5, diminui score (bom p/ IA)
  }

  // 💡 IMPLEMENTAÇÃO 4: "Predição de armadilhas humanas" (Novas regras)
  // Se IA (RED) tem menos lances e é defensiva, penaliza score do oponente (ajuda IA)
  if (rMoves < wMoves && phase === 'mid') score -= 0.15 * def; 
  
  // Se jogo empatado em lances e IA é agressiva, bônus p/ IA (diminui score)
  if (Math.abs(wMoves - rMoves) < 2 && agg > 0.6) score -= 0.2;

  // 💡 IMPLEMENTAÇÃO 2: Aplica viés da "Memória de Padrões"
  // (Score < 0 é bom para IA, então subtraímos o viés)
  score -= patternBias(getBoardHash(b));

  return Math.tanh(score/8);
}

const TT = new Map(); // Tabela de Transposição (cache)

// Algoritmo Minimax
function minimax(b, depth, isMax, alpha, beta){
  if (TT.size > 150000) TT.clear(); // Limpa cache se ficar muito grande

  // 💡 IMPLEMENTAÇÃO 2: Usa o HASH rápido como chave do cache
  const key = getBoardHash(b) + '|' + depth + '|' + isMax;
  if(TT.has(key)) return TT.get(key);
  
  const player = isMax? WHITE : RED;

  if(depth===0 || isGameOver(b, player)){
    const v=evalBoard(b);
    TT.set(key,v);
    return v;
  }
  const all = allMoves(player,b);
  let legal = filterMandatoryWithMaxChain(b, player, all);
  
  // Ordenação de lances (Move Ordering) - Prioriza capturas e promoções
  legal.sort((a, b) => {
    if (a.type === 'capture' && b.type !== 'capture') return -1;
    if (a.type !== 'capture' && b.type === 'capture') return 1;
    const aPromo = (a.to[0] === 7 && player === RED) || (a.to[0] === 0 && player === WHITE);
    const bPromo = (b.to[0] === 7 && player === RED) || (b.to[0] === 0 && player === WHITE);
    if (aPromo && !bPromo) return -1;
    if (!aPromo && bPromo) return 1;
    return 0;
  });

  if(isMax){
    let best=-Infinity;
    for(const m of legal){
      const nb=simulate(b,m);
      const contCaps = (m.type==='capture') ? followUpCaptures(nb, m.to[0], m.to[1], player) : [];
      const val = contCaps.length
        ? minimax(nb, depth-1, true, alpha, beta)
        : minimax(nb, depth-1, false, alpha, beta);
      if(val>best) best=val;
      if(best>alpha) alpha=best;
      if(beta<=alpha) break;
    }
    TT.set(key,best); return best;
  } else {
    let best=Infinity;
    for(const m of legal){
      const nb=simulate(b,m);
      const contCaps = (m.type==='capture') ? followUpCaptures(nb, m.to[0], m.to[1], player) : [];
      const val = contCaps.length
        ? minimax(nb, depth-1, false, alpha, beta)
        : minimax(nb, depth-1, true, alpha, beta);
      if(val<best) best=val;
      if(best<beta) beta=best;
      if(beta<=alpha) break;
    }
    TT.set(key,best); return best;
  }
}

// *** GERENCIADOR DE BUSCA (onmessage) ***
self.onmessage = (e)=>{
  if (e.data.resetCache) {
    TT.clear();
    return;
  }
  // 💡 IMPLEMENTAÇÃO 3: Recebe o perfil completo
  if (e.data.aiProfile) {
    self.aiProfile = e.data.aiProfile;
  }

  // 💡 IMPLEMENTAÇÃO 2: "Memória de padrões de jogada" (Listener)
  if (e.data.action === 'memorize') {
      const result = e.data.result;
      for (const turn of e.data.history) {
          // Memoriza todos os hashes que a IA (RED) encontrou
          if (turn.player === RED && turn.hash) {
              memorizePattern(turn.hash, result);
          }
      }
      return; // Termina, isso não era um pedido de jogada
  }

  if (TT.size > 150000) TT.clear();

  const {board, legal, subset} = e.data;
  let moves = (subset || legal).slice(); // Clona a lista de lances
  if(!moves || !moves.length){ self.postMessage({best:null, score:0, depth:0}); return; }

  // Livro de Aberturas (mantido)
  const nPieces = board.flat().filter(x=>x!==null).length;
  if(nPieces > 28) {
    const rand = OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
    if (rand && rand.reply) {
      const [from, to] = rand.reply.split('-');
      if (from && to) {
        const fromCol = from.charCodeAt(0) - 97, fromRow = 8 - parseInt(from.substring(1));
        const toCol = to.charCodeAt(0) - 97, toRow = 8 - parseInt(to.substring(1));
        const mv = legal.find(m => 
          m.from[0] === fromRow && m.from[1] === fromCol &&
          m.to[0] === toRow && m.to[1] === toCol
        );
        if (mv) {
          setTimeout(() => {
            self.postMessage({ best: mv, score: 0.1, depth: 0 }); // Retorna fake score
          }, 200 + Math.random() * 300);
          return;
        }
      }
    }
  }
  
  // 💡 IMPLEMENTAÇÃO 3: "Modo Reflexivo" (IA comenta decisões)
  const agg = self.aiProfile?.agg ?? 0.5;
  const def = self.aiProfile?.def ?? 0.5;
  const nPiecesTotal = board.flat().filter(x=>x!==null).length; // Renomeado para evitar conflito
  const phase = nPiecesTotal > 24 ? 'opening' : nPiecesTotal > 12 ? 'mid' : 'end';
  
  if (phase === 'mid' && agg > 0.7) {
      self.postMessage({ action: 'say', group: 'thinking', extra: 'Pressionando o centro agora.' });
  } else if (phase === 'end' && def > 0.7) {
      self.postMessage({ action: 'say', group: 'thinking', extra: 'Foco na defesa e promoção.' });
  }
  // Fim (Implementação 3)

  // --- Início do Aprofundamento Iterativo (IDS) ---
  const startTime = performance.now();
  const timeLimit = 1000; // 1 segundo de tempo de pensamento
  
  let bestMove = null;
  let bestScore = Infinity; // IA é MIN, então começa com +Infinito
  let currentDepth = 0;

  // 🎚️ PASSO 3: Worker respeita o limite
  const limit = e.data.maxDepth || 22; // recebe o limite do main
  
  // Loop de Aprofundamento Iterativo
  for (let d = 2; d <= limit; d++) { // Profundidade máxima vinda do main
    currentDepth = d;
    let currentBestMoveForDepth = null;
    let currentBestScoreForDepth = Infinity;

    // Reordena os lances, colocando o melhor lance da iteração passada primeiro
    if (bestMove) {
      moves.sort((a, b) => {
        if (a.from[0] === bestMove.from[0] && a.from[1] === bestMove.from[1] && a.to[0] === bestMove.to[0] && a.to[1] === bestMove.to[1]) return -1;
        if (b.from[0] === bestMove.from[0] && b.from[1] === bestMove.from[1] && b.to[0] === bestMove.to[0] && b.to[1] === bestMove.to[1]) return 1;
        if (a.type === 'capture' && b.type !== 'capture') return -1;
        if (a.type !== 'capture' && b.type === 'capture') return 1;
        return 0;
      });
    }
    
    // Itera sobre os lances na raiz (nível 0)
    for(const m of moves){
      const nb = simulate(board,m);
      const contCaps = (m.type==='capture') ? followUpCaptures(nb, m.to[0], m.to[1], RED) : [];
      
      // Chama o minimax para a profundidade 'd-1'
      const val = contCaps.length
        ? minimax(nb, d-1, false, -Infinity, Infinity) // Continua como MIN
        : minimax(nb, d-1, true,  -Infinity, Infinity); // Passa para MAX
        
      if(val < currentBestScoreForDepth){ 
        currentBestScoreForDepth = val; 
        currentBestMoveForDepth = m; 
      }
    }
    
    // A busca *para esta profundidade* terminou.
    // Atualiza o melhor lance encontrado ATÉ AGORA.
    bestMove = currentBestMoveForDepth;
    bestScore = currentBestScoreForDepth;

    // Checa o tempo *apenas* após completar uma profundidade inteira.
    if (performance.now() - startTime > timeLimit) {
      // Estourou o tempo. Para de aprofundar.
      // O 'bestMove' que temos é da última profundidade completa (d).
      break; 
    }
  }
  // --- Fim do Aprofundamento Iterativo ---
  
  // Envia o melhor lance encontrado dentro do limite de tempo
  self.postMessage({best: bestMove, score: bestScore, depth: currentDepth});
};