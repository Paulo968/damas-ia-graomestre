const RED='red', WHITE='white', KING='-king';

// 📚 LIVRO DE ABERTURAS ...
const OPENINGS = [
  // ... (sem mudança)
  { seq: ['h6-g5'], reply: 'c3-b4' }
];

// 💡 IMPLEMENTAÇÃO 2: "Memória de padrões de jogada"
let patternMemory = {};
function memorizePattern(hash, result) {
  if (!patternMemory[hash]) patternMemory[hash] = { wins: 0, losses: 0 };
  if (result === 'win') patternMemory[hash].wins++;
  else patternMemory[hash].losses++;
}
function patternBias(hash) {
  const p = patternMemory[hash];
  if (!p) return 0;
  const total = p.wins + p.losses;
  if (total < 2) return 0;
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

// 🔧 CORREÇÃO: Lógica do PEÃO reescrita para Damas Brasileiras
// (Remove 'isFollowUp')
function movesForPiece(r,c,player,b,piece){
  const res=[]; const king = piece.endsWith(KING);
  const opp = (player===WHITE)? RED : WHITE;
  const DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];

  for(const [dr,dc] of DIRS){
    if(king){
      // Lógica da Dama (Rei) - (Correta, não mexe)
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
    } else {
      // 🔧 LÓGICA DO PEÃO (REFEITA)
      const forward = (player===WHITE)? -1 : 1;
      
      // 1. Movimento Simples (Apenas para frente)
      if(dr===forward){
        const nr=r+dr, nc=c+dc;
        if(inB(nr,nc) && b[nr][nc]===null){
          res.push({from:[r,c],to:[nr,nc],type:'move'});
        }
      }
      
      // 2. Captura (Qualquer direção, a qualquer hora)
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
        // 🔧 CORREÇÃO: Remove 'isFollowUp'
        M.push(...movesForPiece(r,c,player,b,piece));
      }
    }
  }
  return M;
}

function followUpCaptures(b, r,c, player){
  const piece = b[r][c];
  if(!piece) return [];
  // 🔧 CORREÇÃO: 'movesForPiece' agora está correta
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
  const dirs = (player===RED)? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  return dirs.some(([dr,dc])=>{
    const nr=r+dr, nc=c+dc;
    return inB(nr,nc) && b[nr][nc]?.startsWith(player);
  });
}

// *** HEURÍSTICA REFINADA ... ***
function evalBoard(b){
  // ... (nenhuma mudança aqui) ...
  return Math.tanh(score/8);
}

const TT = new Map(); // Tabela de Transposição (cache)

// Algoritmo Minimax
function minimax(b, depth, isMax, alpha, beta){
  // ... (nenhuma mudança aqui, pois as regras que ele chama foram corrigidas) ...
  if (TT.size > 150000) TT.clear(); 

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
  // ... (nenhuma mudança aqui) ...
  
  // --- Início do Aprofundamento Iterativo (IDS) ---
  const startTime = performance.now();
  const timeLimit = 1000;
  
  let bestMove = null;
  let bestScore = Infinity;
  let currentDepth = 0;

  const limit = e.data.maxDepth || 22;
  
  for (let d = 2; d <= limit; d++) {
    currentDepth = d;
    let currentBestMoveForDepth = null;
    let currentBestScoreForDepth = Infinity;

    if (bestMove) {
      moves.sort((a, b) => {
        if (a.from[0] === bestMove.from[0] && a.from[1] === bestMove.from[1] && a.to[0] === bestMove.to[0] && a.to[1] === bestMove.to[1]) return -1;
        if (b.from[0] === bestMove.from[0] && b.from[1] === bestMove.from[1] && b.to[0] === bestMove.to[0] && b.to[1] === bestMove.to[1]) return 1;
        if (a.type === 'capture' && b.type !== 'capture') return -1;
        if (a.type !== 'capture' && b.type === 'capture') return 1;
        return 0;
      });
    }
    
    for(const m of moves){
      const nb = simulate(board,m);
      // 🔧 CORREÇÃO: followUpCaptures está correta
      const contCaps = (m.type==='capture') ? followUpCaptures(nb, m.to[0], m.to[1], RED) : [];
      
      const val = contCaps.length
        ? minimax(nb, d-1, false, -Infinity, Infinity)
        : minimax(nb, d-1, true,  -Infinity, Infinity);
        
      if(val < currentBestScoreForDepth){ 
        currentBestScoreForDepth = val; 
        currentBestMoveForDepth = m; 
      }
    }
    
    bestMove = currentBestMoveForDepth;
    bestScore = currentBestScoreForDepth;

    if (performance.now() - startTime > timeLimit) {
      break; 
    }
  }
  // --- Fim do Aprofundamento Iterativo ---
  
  self.postMessage({best: bestMove, score: bestScore, depth: currentDepth});
};