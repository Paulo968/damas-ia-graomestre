
      // --- worker.js ---
      // (IA paralela - Minimax, Heurística, Livro de Aberturas)
    
      const RED='red', WHITE='white', KING='-king';

      // ⭐️ ADIÇÃO: Variável global no worker para guardar a regra
      let currentCaptureRule = 'sim'; // Padrão

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
      
      // 💡 ZOBRIST HASHING: Variáveis de Inicialização
      let ZOBRIST_KEYS;
      function pieceToIndex(p) {
        if (p === WHITE) return 0;
        if (p === RED) return 1;
        if (p === WHITE + KING) return 2;
        if (p === RED + KING) return 3;
        return 4; // null
      }
      
      // 💡 ZOBRIST HASHING: Hashing incremental (muito mais rápido que o hash de string)
      function getZobristHash(b) {
        if (!ZOBRIST_KEYS) return BigInt(0);
        
        let hash = BigInt(0);
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            const pieceIdx = pieceToIndex(p);
            const keyIndex = pieceIdx * 64 + (r * 8 + c);
            if (pieceIdx !== 4 && keyIndex < ZOBRIST_KEYS.length) {
              hash ^= ZOBRIST_KEYS[keyIndex];
            }
          }
        }
        return hash;
      }

      // 💡 ZOBRIST HASHING: Função de simulação que retorna o novo ZHash
      function simulate(b, mv, zHash){
        const nb = cloneBoard(b); // Clone do tabuleiro
        let newZHash = zHash;     // ZHash inicial
        
        const {from,to,type,jumped}=mv;
        const t=nb[from[0]][from[1]];
        const fromIdx = from[0] * 8 + from[1];
        const toIdx = to[0] * 8 + to[1];

        // 1. Remove a peça da casa 'from' (XOR out)
        let pieceIdx = pieceToIndex(t);
        let keyIndex = pieceIdx * 64 + fromIdx;
        if (pieceIdx !== 4 && keyIndex < ZOBRIST_KEYS.length) {
          newZHash ^= ZOBRIST_KEYS[keyIndex];
        }
        nb[from[0]][from[1]] = null;
        
        // 2. Remove a peça pulada (se houver)
        if(type==='capture'){ 
          const jIdx = jumped[0] * 8 + jumped[1];
          const jPiece = nb[jumped[0]][jumped[1]];
          let jPieceIdx = pieceToIndex(jPiece);
          let jKeyIndex = jPieceIdx * 64 + jIdx;
          if (jPieceIdx !== 4 && jKeyIndex < ZOBRIST_KEYS.length) {
            newZHash ^= ZOBRIST_KEYS[jKeyIndex];
          }
          nb[jumped[0]][jumped[1]] = null; 
        }

        // 3. Move/Coloca a peça na casa 'to' (XOR in)
        let promoted = t;
        if((t===WHITE && to[0]===0) || (t===RED && to[0]===7)){
          if(!t.endsWith(KING)) promoted = t+KING; // Promoção
        }
        
        nb[to[0]][to[1]] = promoted;
        
        let newPieceIdx = pieceToIndex(promoted);
        let newKeyIndex = newPieceIdx * 64 + toIdx;
        if (newPieceIdx !== 4 && newKeyIndex < ZOBRIST_KEYS.length) {
          newZHash ^= ZOBRIST_KEYS[newKeyIndex];
        }

        // Retorna o novo tabuleiro e o novo Zobrist Hash
        return { board: nb, zHash: newZHash };
      }

      // 💡 IMPLEMENTAÇÃO 2: "Memória de padrões de jogada"
      // 🧠 MODIFICADO: Memória dividida por cor
      let patternMemory_white = {};
      let patternMemory_red = {};

      // 🔄 PONTO 1/4: Anti-Loop: Contador de Repetições
      const repetitionCount = new Map(); // Global Map no Worker

      function memorizePattern(hash, result, player) {
        // 🧠 Seleciona a memória correta
        const memory = (player === WHITE) ? patternMemory_white : patternMemory_red;
        
        // ZOBRIST: Hash é agora um BigInt, usa toString() como chave
        const hashKey = hash.toString();

        if (!memory[hashKey]) memory[hashKey] = { wins: 0, losses: 0 };
        if (result === 'win') memory[hashKey].wins++;
        else memory[hashKey].losses++;
      }
      
      function patternBias(hash, player) {
        // 🧠 Seleciona a memória correta
        const memory = (player === WHITE) ? patternMemory_white : patternMemory_red;
        const hashKey = hash.toString(); // ZOBRIST: Hash é BigInt
        const p = memory[hashKey];
        
        if (!p) return 0;
        const total = p.wins + p.losses;
        if (total < 2) return 0; // Só aplica viés se já viu o padrão algumas vezes
        
        // Influência leve (máx de +/- 0.3)
        // Bias é positivo se 'player' tende a ganhar desta posição
        return (p.wins - p.losses) / total * 0.3; 
      }
      // Fim (Implementação 2)

      // ### OTIMIZAÇÃO B (Clone Manual - Worker) ###
      function cloneBoard(b) {
        const nb = Array(8);
        for (let i = 0; i < 8; i++) nb[i] = b[i].slice();
        return nb;
      }

      function inB(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
      
      // Funções de movimento (mantidas)
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

            const nr=r+dr, nc=c+dc; 
            const lr=r+dr*2, lc=c+dc*2; 
            
            if(dr===forward){
              if(inB(nr,nc) && b[nr][nc]===null){ res.push({from:[r,c],to:[nr,nc],type:'move'}); }
            }

            const rule = self.currentCaptureRule || 'sim';
            const isForwardCapture = (dr === forward);

            if (rule === 'sim' || (rule === 'nao' && isForwardCapture)) {
              if (inB(nr, nc) && inB(lr, lc)) {
                if(b[nr][nc] && b[nr][nc].startsWith(opp) && b[lr][lc]===null){
                  res.push({from:[r,c],to:[lr,lc],type:'capture',jumped:[nr,nc]});
                }
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
        // 💡 ZOBRIST: Não precisamos de zHash aqui, apenas para Minimax/TT
        const stack=[{board: simulate(b,mv, BigInt(0)).board, r: mv.to[0], c: mv.to[1], d:1}];

        while(stack.length){
          const {board:cb,r,c,d}=stack.pop();
          const caps = followUpCaptures(cb, r,c, player);
          if(caps.length===0){ if(d>best) best=d; }
          else{
            for(const m of caps) stack.push({board: simulate(cb,m, BigInt(0)).board, r:m.to[0], c:m.to[1], d:d+1});
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
      
      // ==========================================================
      // ✅ NOVA FUNÇÃO: EVALIAÇÃO DE FIM DE JOGO (ENDGAME EVAL)
      // ==========================================================
      // ==========================================================
      // ✅ FUNÇÃO: DETECÇÃO DE FIM DE JOGO (<= 6 peças)
      // ==========================================================

      function isEndgame(board) {
        let total = 0;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (board[r][c]) total++;
          }
        }
        return total <= 6;
      }

      // ==========================================================
      // ✅ FUNÇÃO: HEURÍSTICA DE FIM DE JOGO
      // ==========================================================

      function evaluateEndgame(board, player) {
        let score = 0;
        const opponent = (player === WHITE) ? RED : WHITE;

        let myMoves = allMoves(player, board).length;
        let oppMoves = allMoves(opponent, board).length;

        // mobilidade
        score += (myMoves - oppMoves) * 0.15;

        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;

            const mine = p.startsWith(player);

            // evitar borda
            if (mine && (c === 0 || c === 7)) {
              score -= 0.05;
            }

            // controle centro
            if (mine && r >= 2 && r <= 5 && c >= 2 && c <= 5) {
              score += 0.08;
            }

            // reis ativos
            if (mine && p.endsWith(KING)) {
              score += 0.25;
            }
          }
        }

        return score;
      }


      function evalEndgame(b, player, weights) {
          // [Control_Diag, Oposição_Rei, Forçar_Canto]
          const [wCD, wKO, wCor] = weights; 
          
          const isWhite = (player === WHITE);
          const opp = isWhite ? RED : WHITE;

          let score = 0;
          let myKings = [], oppKings = [];
          
          // 1. Encontra posições dos Reis
          for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                  const p = b[r][c];
                  if (!p) continue;
                  const isK = p.endsWith(KING);
                  if (p.startsWith(player) && isK) myKings.push({r, c});
                  else if (p.startsWith(opp) && isK) oppKings.push({r, c});
              }
          }
          
          // 2. Control Diag (Controlo de Diagonais) - Favorece o lado da maioria
          for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                  const p = b[r][c];
                  if (!p || !p.startsWith(player)) continue;
                  
                  // Foco nas diagonais que avançam para o território inimigo
                  const forwardRows = isWhite ? 7 - r : r; 
                  score += forwardRows * 0.05 * wCD;
              }
          }

          // 3. King Opposition (Oposição do Rei) - Tenta manter o Rei inimigo perto
          if (myKings.length > 0 && oppKings.length > 0) {
              let minDist = 100;
              for (const myK of myKings) {
                  for (const oppK of oppKings) {
                      // Distância xadrez (Rei)
                      const dist = Math.max(Math.abs(myK.r - oppK.r), Math.abs(myK.c - oppK.c));
                      minDist = Math.min(minDist, dist);
                  }
              }
              // Oposição é boa se a distância for pequena (forcing move)
              // 1 - (minDist / 7) -> Maior para menor distância
              score += (1 - Math.min(minDist / 7, 1)) * wKO * 1.5; 
          }
          
          // 4. Cornering Bias (Forçar o Canto) - Empurrar o Rei inimigo para o lado oposto
          if (oppKings.length > 0) {
              let avgOppRow = oppKings.reduce((sum, p) => sum + p.r, 0) / oppKings.length;
              // Row 7 (top) é a row ideal para Vermelho (RED)
              // Row 0 (bottom) é a row ideal para Branco (WHITE)
              
              if (isWhite) {
                  // Branco quer que a Row Média do Vermelho seja ALTA (perto de 7)
                  score += avgOppRow / 7 * wCor * 1.0;
              } else {
                  // Vermelho quer que a Row Média do Branco seja BAIXA (perto de 0)
                  score += (7 - avgOppRow) / 7 * wCor * 1.0;
              }
          }
          
          // 5. Mobilidade (Extra: Força o jogador com mais peças a manter a mobilidade)
          score += allMoves(player, b).length * 0.1;
          
          return score;
      }
      
      // ==========================================================
      // ✅ FUNÇÃO EVALBOARD: Agora prioriza a evalEndgame
      // ==========================================================

      // *** IMPLEMENTAÇÃO 1 & 3: HEURÍSTICA REFINADA + PERFIL ADAPTATIVO (POR COR) ***
      function evalBoard(b){
        const n = b.flat().filter(x => x !== null).length;
        
        // 📌 NOVO: HEURÍSTICA DE FIM DE JOGO (Menos de 10 peças)
        if (n <= 10) {
            // A heurística de fim de jogo se torna DOMINANTE
            const weightsW = self.endgame_w || [1.0, 0.4, 0.3];
            const weightsR = self.endgame_r || [1.0, 0.4, 0.3];
            
            let scoreEndgame = 0;
            
            // Avaliação para Brancas (MAX)
            const evalW = evalEndgame(b, WHITE, weightsW);
            // Avaliação para Vermelhas (MIN)
            const evalR = evalEndgame(b, RED, weightsR);
            
            // O score é: (Avaliação Branca) - (Avaliação Vermelha)
            scoreEndgame = evalW - evalR;
            
            // Adiciona o viés de padrão e anti-loop (Ponto 2)
            const hash = getZobristHash(b); // ZOBRIST Hash
            if (repetitionCount) {
                const rep = repetitionCount.get(hash.toString()) || 0; // ZOBRIST BigInt para string
                if (rep > 1) scoreEndgame *= (1 - Math.min(0.03 * rep, 0.25));
            }
            scoreEndgame += patternBias(hash, WHITE);
            scoreEndgame -= patternBias(hash, RED);

            // Um valor grande no fim de jogo (ex: 100) garante que o minimax não vai errar.
            // Para forçar a IA a se concentrar em *concluir* o jogo.
            return scoreEndgame * 100;
        }


        // Fase da partida (abertura/meio/final) - Continua a lógica padrão
        const phase = n > 24 ? 'opening' : n > 12 ? 'mid' : 'end';
        
        // Perfis da IA por cor (branca/vermelha)
        const profileW = self.aiProfile_w || { agg: 0.5, def: 0.5 };
        const profileR = self.aiProfile_r || { agg: 0.5, def: 0.5 };
      
        const aggR = (typeof profileR.agg === 'number') ? profileR.agg : 0.5;
        const defR = (typeof profileR.def === 'number') ? profileR.def : 0.5;
      
        let score = 0;
      
        const baseCenter  = (phase === 'opening' ? 1.0 : (phase === 'mid' ? 0.6 : 0.2));
        const basePromo   = (phase === 'end' ? 1.8 : 0.7);
        const baseAdvance = (phase === 'opening' ? 0.3 : 0.1);
      
        // [material, reis, centro, mobilidade]
        const featW = [0, 0, 0, 0];
        const featR = [0, 0, 0, 0];
      
        // 💡 NOVO: guardar posições para detectar "duplas" e cercos
        const positionsW = [];
        const positionsR = [];
      
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const v = b[r][c];
            if (!v) continue;
      
            const isW = v.startsWith(WHITE);
            const isK = v.endsWith(KING);
            const player = isW ? WHITE : RED;
      
            // guarda posição para análise de sinergia depois
            if (isW) positionsW.push([r, c, isK]);
            else     positionsR.push([r, c, isK]);
      
            const pProfile = isW ? profileW : profileR;
            const agg = (typeof pProfile.agg === 'number') ? pProfile.agg : 0.5;
            const def = (typeof pProfile.def === 'number') ? pProfile.def : 0.5;
      
            // valor base
            let val = isK ? 6.0 : 2.0;
      
            const wCenter  = baseCenter  * (0.5 + agg);
            const wPromo   = basePromo;
            const wAdvance = baseAdvance;
      
            const advance = (isW ? (7 - r) : r) * (wAdvance * (0.5 + agg * 0.5));
            const center  = (c >= 2 && c <= 5 && r >= 2 && r <= 5)
              ? (wCenter * (0.5 + 0.5 * agg))
              : 0;
      
            let promo = 0;
            if (isW && !isK && r <= 1) promo = wPromo * (0.5 + 0.5 * agg);
            if (!isW && !isK && r >= 6) promo = wPromo * (0.5 + 0.5 * agg);
      
            let bonus = 0;
      
            // Rei dominando o centro
            if (isK && r >= 2 && r <= 5 && c >= 2 && c <= 5) bonus += 0.3;
      
            // Peças protegidas ganham valor extra
            if (!isK && isProtected(b, r, c, player)) {
              bonus += 0.4 * (0.5 + def);
            }
      
            // Ligeira preferência por linhas "boas"
            if (!isK) {
              if (isW && (r === 2 || r === 3)) bonus += 0.2;
              if (!isW && (r === 4 || r === 5)) bonus += 0.2;
            }
      
            const total = val + advance + center + promo + bonus;
      
            if (isW) {
              featW[0] += isK ? 3 : 1;
              if (isK) featW[1] += 1;
              if (center > 0) featW[2] += 1;
            } else {
              featR[0] += isK ? 3 : 1;
              if (isK) featR[1] += 1;
              if (center > 0) featR[2] += 1;
            }
      
            score += isW ? total : -total;
      
            // leve preferência por diagonais principais
            if (r === c || r + c === 7) score += isW ? 0.2 : -0.2;
          }
        }
      
        // Mobilidade básica (antes de sinergia)
        const wMoves = allMoves(WHITE, b).length;
        const rMoves = allMoves(RED, b).length;
      
        featW[3] = wMoves;
        featR[3] = rMoves;
      
        // 💡 NOVO BLOCO: "duplas" e cercos (armadilhas simples)
        // A IA passa a gostar de jogar em grupo e cercar peças inimigas.
        const dirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
        let pairW = 0, pairR = 0;
        let surroundW = 0, surroundR = 0;
      
        function accumulateSynergy(positionsFriend, positionsEnemy, isWhiteSide) {
          const seenPairs = new Set();
      
          // 🔁 Duplas: duas peças amigas lado a lado na diagonal contam como parceria
          for (const [r, c, isK] of positionsFriend) {
            const key1 = r * 8 + c;
            for (const [dr, dc] of dirs) {
              const nr = r + dr;
              const nc = c + dc;
              if (!inB(nr, nc)) continue;
              const p = b[nr][nc];
              if (!p) continue;
              const friend = isWhiteSide ? p.startsWith(WHITE) : p.startsWith(RED);
              if (!friend) continue;
              const key2 = nr * 8 + nc;
              const a = Math.min(key1, key2);
              const d = Math.max(key1, key2);
              const code = a + '-' + d;
              if (!seenPairs.has(code)) {
                seenPairs.add(code);
                if (isWhiteSide) pairW++; else pairR++;
              }
            }
          }
      
          // 🔒 Cercos: peça inimiga cercada por 2+ amigos nas diagonais
          for (const [er, ec, eK] of positionsEnemy) {
            let friends = 0;
            for (const [dr, dc] of dirs) {
              const nr = er + dr;
              const nc = ec + dc;
              if (!inB(nr, nc)) continue;
              const p = b[nr][nc];
              if (!p) continue;
              const friend = isWhiteSide ? p.startsWith(WHITE) : p.startsWith(RED);
              if (friend) friends++;
            }
            if (friends >= 2) {
              if (isWhiteSide) surroundW++; else surroundR++;
            }
          }
        }
      
        // Brancas analisam sua própria sinergia contra as vermelhas
        accumulateSynergy(positionsW, positionsR, true);
        // Vermelhas analisam sua sinergia contra as brancas
        accumulateSynergy(positionsR, positionsW, false);
      
        // Pesos: quanto vale jogar em dupla e cercar
        const pairWeight = 0.18;      // jogo em dupla
        const surroundWeight = 0.30;  // cerco / armadilha leve
      
        // Lembrando: score > 0 favorece as BRANCAS; score < 0 favorece as VERMELHAS
        score += (pairW - pairR) * pairWeight;
        score += (surroundW - surroundR) * surroundWeight;

        // ==========================================================
        // 📌 PONTO 1: HEURÍSTICAS DE FIM DE JOGO (KING HUNT, EDGE PRESSURE, COMPRESSION)
        // ==========================================================
        if (n <= 16) { // Ativa só no meio/fim de jogo
            let kingHuntScore = 0;
            let edgePressureScore = 0;
            let quadrantCompressionScore = 0;

            // 🐞 CORRIGIDO: Removido o ': p' extra que estava a causar o SyntaxError
            const whiteKings = positionsW.filter(p => p[2]).map(p => ({ r: p[0], c: p[1] }));
            const redKings   = positionsR.filter(p => p[2]).map(p => ({ r: p[0], c: p[1] }));

            // 1. King Hunt (Perseguição ao Rei) - Favorece quem está mais perto (IA é RED/MIN)
            if (redKings.length > 0 && whiteKings.length > 0) {
                for (const rK of redKings) {
                    let minDist = 100;
                    for (const wK of whiteKings) {
                        // Distância de Manhattan (boa para xadrez/damas)
                        const dist = Math.abs(rK.r - wK.r) + Math.abs(rK.c - wK.c);
                        minDist = Math.min(minDist, dist);
                    }
                    // A distância mais curta é melhor (score deve diminuir para RED)
                    kingHuntScore += (10 - minDist) * 0.15 * (1 + aggR); 
                }
            }
            score -= kingHuntScore; // Menos score é melhor para RED

            // 2. Edge Pressure (Peças na Borda/Canto) - Penaliza peças vulneráveis na borda
            for (const [r, c, isK] of positionsR) { // Peças RED
                // Penaliza peças RED na borda (r=0, r=7, c=0, c=7) a menos que sejam reis ou protegidas.
                if (!isK && (r === 0 || r === 7 || c === 0 || c === 7)) {
                    const isCorner = (r === 0 || r === 7) && (c === 0 || c === 7);
                    const isProt = isProtected(b, r, c, RED);
                    
                    if (!isProt) {
                        edgePressureScore += 0.3 + (isCorner ? 0.2 : 0);
                    }
                }
            }
            score += edgePressureScore; // Mais score é pior para RED

            // 3. Quadrant Compression (Fechamento de Quadrante) - Empurra WHITE (MAX) para a borda (r=0)
            let avgWhiteRow = positionsW.reduce((sum, p) => sum + p[0], 0) / Math.max(1, positionsW.length);
            // Quanto menor avgWhiteRow, mais WHITE está encurralado perto de 0 (melhor para RED)
            quadrantCompressionScore += (4 - avgWhiteRow) * 0.15 * (1 + aggR); // Fator de agressividade
            
            score -= quadrantCompressionScore; // Menos score é melhor para RED
        }
        
        // 🔍 NOVO: padrões táticos extras (corrida para dama + base defensiva)
        {
          // 1) Corrida desigual para Dama (promoção)
          let minDistW = 99, minDistR = 99;
          for (const [r, c, isK] of positionsW) {
            if (!isK) {
              // Brancas promovem perto da linha 0
              minDistW = Math.min(minDistW, r);
            }
          }
          for (const [r, c, isK] of positionsR) {
            if (!isK) {
              // Vermelhas promovem perto da linha 7
              minDistR = Math.min(minDistR, 7 - r);
            }
          }
          if (minDistW < 99 && minDistR < 99) {
            // Se as brancas chegam mais rápido, isso é bom para elas; se as vermelhas chegam mais rápido, é ruim para elas.
            const raceDiff = (minDistR - minDistW);
            score += raceDiff * 0.12; // peso leve para não distorcer o resto
          }

          // 2) Vulnerabilidade da base defensiva
          let backRowWhite = 0, backRowRed = 0;
          for (const [r, c, isK] of positionsW) {
            if (!isK && r === 7) backRowWhite++;
          }
          for (const [r, c, isK] of positionsR) {
            if (!isK && r === 0) backRowRed++;
          }

          // Se a base RED está completamente vazia enquanto ainda há muitas peças, isso abre corredores de ataque.
          if (backRowRed === 0 && positionsR.length >= 4) {
            score += 0.4 * (1 + aggR); // bom para WHITE, péssimo para RED
          }

          // Se a base WHITE está vazia cedo demais, isso é perigoso para elas.
          if (backRowWhite === 0 && positionsW.length >= 4) {
            score -= 0.35; // ligeira punição para WHITE abrir demais a retaguarda
          }
        }


        // Mobilidade (mantida)
        score += (wMoves - rMoves) * 0.22;
      
        // Heurística de fim de jogo (<= 6 peças)
        if (isEndgame(b)) {
          score += evaluateEndgame(b, WHITE);
        }

        // Predição de armadilhas / ritmo (bloco antigo mantido)
        if (rMoves > wMoves + 4) score -= 0.3;
        if (phase === 'mid' && Math.abs(score) < 0.2) {
          score -= 0.1 * Math.sign(aggR - 0.5);
        }
        if (rMoves < wMoves && phase === 'mid') score -= 0.15 * defR;
        if (Math.abs(wMoves - rMoves) < 2 && aggR > 0.6) score -= 0.2;
      
        // ==========================================================
        // 📌 PONTO 2: ANTI-LOOP (ACHATAMENTO DO SCORE)
        // ==========================================================
        if (repetitionCount) {
            const hash = getZobristHash(b); // ZOBRIST Hash
            const rep = repetitionCount.get(hash.toString()) || 0; // ZOBRIST BigInt para string
            if (rep > 1) {
                // Acha o fator de "achatamento" (reduz o score total)
                const factor = 1 - Math.min(0.03 * rep, 0.25);
                score *= factor; // Multiplica o score, forçando a IA a procurar posições com menos repetição
            }
        }
        
        // Memória de padrões (hash da posição)
        const hash = getZobristHash(b); // ZOBRIST Hash
        score += patternBias(hash, WHITE);
        score -= patternBias(hash, RED);
      
        // Combinação com heurística neural
        const baseScore = score;
        const defaultNeural = [1.0, 0.4, 0.3, 0.2]; // mesmo formato do main
      
        const wWeights = (self.neural_w && Array.isArray(self.neural_w) && self.neural_w.length === 4)
          ? self.neural_w
          : defaultNeural;
      
        const rWeights = (self.neural_r && Array.isArray(self.neural_r) && self.neural_r.length === 4)
          ? self.neural_r
          : defaultNeural;
      
        let neuralScore = 0;
        for (let i = 0; i < 4; i++) {
          neuralScore += featW[i] * wWeights[i];
          neuralScore -= featR[i] * rWeights[i];
        }
      
        // mistura 70% heurística clássica, 30% heurística "aprendida"
        const finalScore = baseScore * 0.7 + neuralScore * 0.3;
        return finalScore;
      }

      const TT = new Map(); // Tabela de Transposição (cache)

      // === Killer move e tabela de histórico para Move Ordering ===
      // Cada profundidade (ply) terá até dois "killer moves" que causaram um corte beta.
      // Eles são priorizados no ordenamento de lances, pois têm alta chance de provocar novo corte.
      const KILLERS = Array.from({ length: 64 }, () => [null, null]);
      // Tabela de histórico: acumula uma pontuação para cada lance (from/to) baseado em cortes anteriores.
      const HISTORY = {};

      // Gera uma chave única para um lance na tabela de histórico.
      function historyKey(m) {
        return `${m.from[0]}${m.from[1]}${m.to[0]}${m.to[1]}`;
      }

      // 💡 NOVO: Função para checar Simetria Vertical
      function isVerticallySymmetric(b) {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 4; c++) {
            // Verifica se a peça em (r, c) é igual à peça em (r, 7-c)
            if (b[r][c] !== b[r][7 - c]) return false;
          }
        }
        return true;
      }

      // Algoritmo Minimax
      function minimax(b, depth, isMax, alpha, beta, zHash){
        // 📌 PONTO 3: Contador de Repetição (usa zHash)
        const hashKey = zHash.toString(); // ZOBRIST BigInt para string
        const visits = (repetitionCount.get(hashKey) || 0) + 1;
        repetitionCount.set(hashKey, visits); // <<<<< INSERIDO

        // 🧠 TT v2.0: Limpeza seletiva - remove entradas menos profundas primeiro
        if (TT.size > 150000) {
          const entries = [...TT.entries()];
          // Ordena por profundidade crescente (menos profundas primeiro)
          entries.sort((a, b) => (a[1].depth || 0) - (b[1].depth || 0));
          // Remove as 50% menos profundas
          const toRemove = Math.floor(entries.length * 0.5);
          for (let i = 0; i < toRemove; i++) {
            TT.delete(entries[i][0]);
          }
        }

        // 💡 IMPLEMENTAÇÃO 2: Usa o ZHash como chave do cache
        const key = hashKey + '|' + depth + '|' + isMax; // Usa ZHash (BigInt -> string)
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
            // 💡 ZOBRIST: Chama o simulate que retorna o novo ZHash
            const { board: nb, zHash: newZHash } = simulate(b, m, zHash);
            const contCaps = (m.type==='capture') ? followUpCaptures(nb, m.to[0], m.to[1], player) : [];
            const val = contCaps.length
              ? minimax(nb, depth-1, true, alpha, beta, newZHash)
              : minimax(nb, depth-1, false, alpha, beta, newZHash);
            if(val>best) best=val;
            if(best>alpha) alpha=best;
            if(beta<=alpha) break;
          }
          TT.set(key,best); return best;
        } else {
          let best=Infinity;
          for(const m of legal){
            // 💡 ZOBRIST: Chama o simulate que retorna o novo ZHash
            const { board: nb, zHash: newZHash } = simulate(b, m, zHash);
            const contCaps = (m.type==='capture') ? followUpCaptures(nb, m.to[0], m.to[1], player) : [];
            const val = contCaps.length
              ? minimax(nb, depth-1, false, alpha, beta, newZHash)
              : minimax(nb, depth-1, true, alpha, beta, newZHash);
            if(val<best) best=val;
            if(best<beta) beta=best;
            if(beta<=alpha) break;
          }
          TT.set(key,best); return best;
        }
      }

      /*
       * Algoritmo NegaScout / Principal Variation Search (PVS)
       *
       * Esta variante do Alpha-Beta utiliza uma busca "null-window" para as jogadas
       * subsequentes à melhor jogada conhecida. Com isso, reduz o número de nós
       * avaliados ao reaproveitar informação do primeiro filho. Também implementa
       * killer moves e histórico para ordenar lances de maneira mais eficaz.
       *
       * Parâmetros:
       *   b       – tabuleiro 8x8 (matriz de peças ou null)
       *   depth   – profundidade restante de busca
       *   isMax   – true se o jogador atual é MAX (brancas), false se MIN (vermelhas)
       *   alpha   – limite inferior (valor mínimo aceitável para MAX)
       *   beta    – limite superior (valor máximo aceitável para MIN)
       *   zHash   – hash Zobrist (BigInt) da posição atual
       *   ply     – profundidade absoluta (0 para raiz, 1 para filhos, ...)
       *
       * Retorna a avaliação numérica da posição.
       */
      function negascout(b, depth, isMax, alpha, beta, zHash, ply) {
        // Guarda os valores originais de alpha/beta para determinar a flag da TT
        const originalAlpha = alpha;
        const originalBeta = beta;

        // Contagem de repetições para anti-loop
        const hashKey = zHash.toString();
        const visits = (repetitionCount.get(hashKey) || 0) + 1;
        repetitionCount.set(hashKey, visits);

        // ==========================
        // 🧠 TRANSPOSITION TABLE v2.0
        // Agora com flags EXACT/LOWERBOUND/UPPERBOUND e bestMove
        // ==========================
        const ttKey = hashKey + '|' + depth + '|' + isMax;
        const ttEntry = TT.get(ttKey);
        if (ttEntry) {
          // Verifica se a entrada é profunda o suficiente
          if (ttEntry.depth >= depth) {
            if (ttEntry.flag === 'EXACT') {
              return ttEntry.score;
            }
            if (ttEntry.flag === 'LOWERBOUND') {
              alpha = Math.max(alpha, ttEntry.score);
            } else if (ttEntry.flag === 'UPPERBOUND') {
              beta = Math.min(beta, ttEntry.score);
            }
            // Se a janela colapsou, retorna imediatamente
            if (alpha >= beta) {
              return ttEntry.score;
            }
          }
        }

        // Determina o jogador atual
        const player = isMax ? WHITE : RED;

        // Condição terminal: profundidade esgotada ou posição terminal
        if (depth === 0 || isGameOver(b, player)) {
          const v = evalBoard(b);
          TT.set(ttKey, { score: v, flag: 'EXACT', depth: depth, bestMove: null });
          return v;
        }

        // Gera lances e filtra capturas obrigatórias
        const all = allMoves(player, b);
        let legalMoves = filterMandatoryWithMaxChain(b, player, all);

        // Ordenação de lances com heurísticas avançadas
        // Prioridade: TT bestMove > capturas > promoções > killers > histórico
        legalMoves.sort((a, c) => {
          // 🏆 TT bestMove: se a TT tem um bestMove armazenado, joga PRIMEIRO
          if (ttEntry && ttEntry.bestMove) {
            const bm = ttEntry.bestMove;
            const aIsTT = a.from[0] === bm.from[0] && a.from[1] === bm.from[1] && a.to[0] === bm.to[0] && a.to[1] === bm.to[1];
            const cIsTT = c.from[0] === bm.from[0] && c.from[1] === bm.from[1] && c.to[0] === bm.to[0] && c.to[1] === bm.to[1];
            if (aIsTT && !cIsTT) return -1;
            if (!aIsTT && cIsTT) return 1;
          }
          // Capturas primeiro
          if (a.type === 'capture' && c.type !== 'capture') return -1;
          if (a.type !== 'capture' && c.type === 'capture') return 1;
          // Promoções priorizadas
          const aPromo = (player === RED && a.to[0] === 7) || (player === WHITE && a.to[0] === 0);
          const cPromo = (player === RED && c.to[0] === 7) || (player === WHITE && c.to[0] === 0);
          if (aPromo && !cPromo) return -1;
          if (!aPromo && cPromo) return 1;
          // Killer moves
          const killers = KILLERS[ply] || [];
          const aIsKiller = killers && killers.some(k => k && k.from[0] === a.from[0] && k.from[1] === a.from[1] && k.to[0] === a.to[0] && k.to[1] === a.to[1]);
          const cIsKiller = killers && killers.some(k => k && k.from[0] === c.from[0] && k.from[1] === c.from[1] && k.to[0] === c.to[0] && k.to[1] === c.to[1]);
          if (aIsKiller && !cIsKiller) return -1;
          if (!aIsKiller && cIsKiller) return 1;
          // Histórico
          const aHist = HISTORY[historyKey(a)] || 0;
          const cHist = HISTORY[historyKey(c)] || 0;
          if (aHist !== cHist) return cHist - aHist;
          return 0;
        });

        // Inicializa melhor avaliação e bestMove local
        let bestVal = isMax ? -Infinity : Infinity;
        let bestMoveLocal = null;

        // Loop pelos lances
        for (let i = 0; i < legalMoves.length; i++) {
          const m = legalMoves[i];
          // Simula o lance e obtém novo tabuleiro e hash
          const simResult = simulate(b, m, zHash);
          const nb = simResult.board;
          const newZHash = simResult.zHash;
          // Verifica se há capturas sequenciais
          const contCaps = (m.type === 'capture') ? followUpCaptures(nb, m.to[0], m.to[1], player) : [];
          const nextIsMax = contCaps.length ? isMax : !isMax;

          let score;
          if (i === 0) {
            // Primeiro filho: janela completa
            score = negascout(nb, depth - 1, nextIsMax, alpha, beta, newZHash, ply + 1);
          } else {
            if (isMax) {
              // Jogador MAX: null-window [alpha, alpha+1]
              score = negascout(nb, depth - 1, nextIsMax, alpha, alpha + 1, newZHash, ply + 1);
              if (score > alpha && score < beta) {
                score = negascout(nb, depth - 1, nextIsMax, score, beta, newZHash, ply + 1);
              }
            } else {
              // Jogador MIN: null-window [beta-1, beta]
              score = negascout(nb, depth - 1, nextIsMax, beta - 1, beta, newZHash, ply + 1);
              if (score < beta && score > alpha) {
                score = negascout(nb, depth - 1, nextIsMax, alpha, score, newZHash, ply + 1);
              }
            }
          }

          // Atualiza melhor valor e bestMove
          if (isMax) {
            if (score > bestVal) { bestVal = score; bestMoveLocal = m; }
            if (score > alpha) alpha = score;
          } else {
            if (score < bestVal) { bestVal = score; bestMoveLocal = m; }
            if (score < beta) beta = score;
          }

          // Corte alpha-beta
          if (alpha >= beta) {
            // Atualiza killers
            const killers = KILLERS[ply] || [];
            const found = killers.find(k => k && k.from[0] === m.from[0] && k.from[1] === m.from[1] && k.to[0] === m.to[0] && k.to[1] === m.to[1]);
            if (!found) {
              killers[1] = killers[0];
              killers[0] = m;
              KILLERS[ply] = killers;
            }
            // Atualiza histórico
            const hk = historyKey(m);
            HISTORY[hk] = (HISTORY[hk] || 0) + depth * depth;
            break;
          }
        }

        // ==========================
        // 🧠 TT v2.0: Armazena com flag correta + bestMove
        // ==========================
        let flag;
        if (bestVal <= originalAlpha) {
          flag = 'UPPERBOUND';  // Foi cortado por alpha (falhou em produzir um valor > alpha)
        } else if (bestVal >= originalBeta) {
          flag = 'LOWERBOUND';  // Causou corte beta
        } else {
          flag = 'EXACT';       // Valor preciso dentro da janela
        }
        TT.set(ttKey, { score: bestVal, flag: flag, depth: depth, bestMove: bestMoveLocal });
        return bestVal;
      }

      // *** GERENCIADOR DE BUSCA (onmessage) ***
      self.onmessage = (e)=>{
        const data = e.data || {};

        // 💡 ZOBRIST: Recebe e inicializa as chaves (BigInt)
        if (data.ZOBRIST_KEYS && data.ZOBRIST_KEYS.length > 0) {
            ZOBRIST_KEYS = data.ZOBRIST_KEYS.map(s => BigInt(s));
        }

        // 🔁 Carrega memória persistida de padrões (enviada pelo main-thread)
        if (data.type === 'loadPatternMemory') {
          patternMemory_white = data.patternMemory_white || {};
          patternMemory_red   = data.patternMemory_red   || {};
          return;
        }

        if (data.resetCache) {
          TT.clear();
          return;
        }

        // 📌 PONTO 4: Limpa o contador de repetição para uma nova busca
        repetitionCount.clear(); // <<<<< INSERIDO

        // 🧠 MODIFICADO: Recebe os perfis de AMBOS os jogadores
        self.aiProfile_w = e.data.aiProfile_w || {agg:0.5, def:0.5};
        self.aiProfile_r = e.data.aiProfile_r || {agg:0.5, def:0.5};

        // 💡 Pesos da heurística neural simples (por cor)
        self.neural_w = e.data.neural_w || null;
        self.neural_r = e.data.neural_r || null;
        
        // 💡 NOVO: Pesos de fim de jogo adaptativos
        self.endgame_w = e.data.endgame_w || null;
        self.endgame_r = e.data.endgame_r || null;

        // ⭐️ ADIÇÃO: Recebe a regra de captura do game-core.js
        if (e.data.captureRule) {
          self.currentCaptureRule = e.data.captureRule;
        }

        // 💡 IMPLEMENTAÇÃO 2: "Memória de padrões de jogada" (Listener)
        if (data.action === 'memorize') {
            const winner = data.winner; // 🧠 Recebe o vencedor
            for (const turn of data.history) {
                if (turn.hash) {
                    // ZOBRIST: Hash é agora um BigInt
                    const hash = BigInt(turn.hash);
                    // 🧠 Memoriza para o jogador daquele turno, com o resultado final da partida
                    if (turn.player === WHITE) {
                        memorizePattern(hash, winner === WHITE ? 'win' : 'lose', WHITE);
                    } else if (turn.player === RED) {
                        memorizePattern(hash, winner === RED ? 'win' : 'lose', RED);
                    }
                }
            }

            // 🔄 Envia a memória atualizada de volta para o main-thread salvar no localStorage
            self.postMessage({
                type: 'patternMemoryUpdate',
                patternMemory_white,
                patternMemory_red
            });

            return; // Termina, isso não era um pedido de jogada
        }

        // 🧠 TT v2.0: Limpeza seletiva
        if (TT.size > 150000) {
          const entries = [...TT.entries()];
          entries.sort((a, b) => (a[1].depth || 0) - (b[1].depth || 0));
          const toRemove = Math.floor(entries.length * 0.5);
          for (let i = 0; i < toRemove; i++) TT.delete(entries[i][0]);
        }
        const {board, legal, subset} = e.data;
        let moves = (subset || legal).slice(); // Clona a lista de lances
        
        if(!moves || !moves.length){ self.postMessage({best:null, score:0, depth:0}); return; }
        
        // 💡 ZOBRIST: Calcula o hash inicial
        let zHash = getZobristHash(board);

        // Livro de Aberturas (ATIVADO DE VERDADE)
        const nPieces = board.flat().filter(x => x !== null).length;

        // Usar livro enquanto ainda estamos em fase bem inicial
        if (nPieces >= 20) {
          const rand = OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
          if (rand && rand.reply) {
            const [from, to] = rand.reply.split('-');
            if (from && to) {
              const fromCol = from.charCodeAt(0) - 97;
              const fromRow = 8 - parseInt(from.substring(1));
              const toCol   = to.charCodeAt(0) - 97;
              const toRow   = 8 - parseInt(to.substring(1));

              const mv = legal.find(m =>
                m.from[0] === fromRow && m.from[1] === fromCol &&
                m.to[0]   === toRow   && m.to[1]   === toCol
              );

              if (mv) {
                setTimeout(() => {
                  self.postMessage({ best: mv, score: 0.1, depth: 0 }); // fake score só pra animar
                }, 200 + Math.random() * 300);
                return;
              }
            }
          }
        }
        
        // 📌 NOVO: PODA DE SIMETRIA (Vertical)
        const isSymmetric = isVerticallySymmetric(board);
        
        if (isSymmetric) {
            // Reduz a lista de lances para a metade esquerda (colunas 0, 1, 2, 3)
            moves = moves.filter(m => m.from[1] <= 3);
            self.postMessage({ action: 'say', group: 'thinking', extra: 'Simetria detectada. Busca reduzida em 50%.' });
        }

        
        // 💡 IMPLEMENTAÇÃO 3: "Modo Reflexivo" (IA comenta decisões)
        // 🧠 MODIFICADO: Usa o perfil do jogador ATUAL (RED)
        const agg = self.aiProfile_r?.agg ?? 0.5;
        const nPiecesTotal = board.flat().filter(x=>x!==null).length; 
        const phase = nPiecesTotal > 24 ? 'opening' : nPiecesTotal > 12 ? 'mid' : 'end';
        
        if (phase === 'mid' && agg > 0.7) {
            self.postMessage({ action: 'say', group: 'thinking', extra: 'Pressionando o centro agora.' });
        } else if (phase === 'end' && nPiecesTotal > 10) {
            self.postMessage({ action: 'say', group: 'thinking', extra: 'Foco na defesa e promoção.' });
        } else if (phase === 'end' && nPiecesTotal <= 10) {
            self.postMessage({ action: 'say', group: 'thinking', extra: 'Ativando protocolos de final de jogo. Movimentos forçados.' });
        }
        // Fim (Implementação 3)


        // Função de tempo adaptativo: mais tempo em finais críticos, menos em posições simples
        function adaptiveTimeLimit(board){
          try {
            const pieces = board.flat().filter(x => x !== null).length;
            // valores um pouco menores para manter a IA forte, porém mais responsiva
            if (pieces <= 8) return 1400;   // final crítico
            if (pieces <= 16) return 1100;  // meio-jogo tenso
            return 800;                     // abertura / posições simples
          } catch (e) {
            return 900; // fallback seguro
          }
        }

        
        // --- Monte Carlo Leve (Refinamento Opcional) ---
        // Faz playouts aleatórios curtos a partir de um lance candidato
        function randomPlayoutFromMove(initialBoard, firstMove, pliesLimit){
          // Clona o tabuleiro e aplica o primeiro lance da IA (vermelha)
          let b = cloneBoard(initialBoard);
          let current = RED;

          try {
            const sim = simulate(b, firstMove, BigInt(0));
            b = sim.board;
            current = WHITE; // após a jogada da vermelha, é a vez das brancas
          } catch (e) {
            return evalBoard(initialBoard); // fallback seguro
          }

          let ply = 0;
          while (ply < pliesLimit){
            // Se o jogo acabou para o jogador atual, encerra
            if (isGameOver(b, current)) break;

            const all = allMoves(current, b);
            const legal = filterMandatoryWithMaxChain(b, current, all);
            if (!legal.length) break;

            const mv = legal[Math.floor(Math.random() * legal.length)];
            try {
              const sim2 = simulate(b, mv, BigInt(0));
              b = sim2.board;
            } catch (e) {
              break;
            }
            current = (current === WHITE ? RED : WHITE);
            ply++;
          }

          // Usa a mesma heurística global para avaliar o resultado do playout
          return evalBoard(b);
        }

        function refineWithMonteCarlo(board, moves, bestMove, bestScore){
          // Usa Monte Carlo apenas se houver mais de uma opção interessante
          if (!bestMove || !moves || moves.length < 2) {
            return { move: bestMove, score: bestScore };
          }

          // Seleciona até 3 candidatos: o melhor da busca + outros aleatórios
          const candidates = [];
          candidates.push(bestMove);
          while (candidates.length < Math.min(3, moves.length)) {
            const m = moves[Math.floor(Math.random() * moves.length)];
            if (!candidates.includes(m)) candidates.push(m);
          }

          const pliesLimit = 18;        // profundidade máxima de cada playout
          const playoutsPerMove = 10;   // quantidade de simulações por lance

          let mcBestMove = bestMove;
          let mcBestScore = bestScore;

          for (const cand of candidates) {
            let acc = 0;
            let count = 0;
            for (let k = 0; k < playoutsPerMove; k++) {
              const s = randomPlayoutFromMove(board, cand, pliesLimit);
              acc += s;
              count++;
            }
            const avg = acc / Math.max(1, count);

            // Lembrando: score positivo favorece as brancas, negativo favorece a vermelha (nossa IA é MIN)
            if (avg < mcBestScore) {
              mcBestScore = avg;
              mcBestMove = cand;
            }
          }

          return { move: mcBestMove, score: mcBestScore };
        }

// --- Início do Aprofundamento Iterativo (IDS) ---
        const startTime = performance.now();
        const baseTimeLimit = adaptiveTimeLimit(board); // tempo adaptativo de pensamento
        const timeLimit = (typeof e.data.thinkTimeMs === 'number' && e.data.thinkTimeMs > 0)
          ? e.data.thinkTimeMs
          : baseTimeLimit;
        
        let bestMove = null;
        let bestScore = Infinity; // IA é MIN, então começa com +Infinito
        let currentDepth = 0;

        // 🎚️ PASSO 3: Worker respeita o limite
        const limit = e.data.maxDepth || 22; // recebe o limite do main
        
        // Loop de Aprofundamento Iterativo
        for (let d = 2; d <= limit; d++) { // Profundidade máxima vinda do main
          currentDepth = d;
          // 📢 Reporta progresso para a UI
          self.postMessage({ action: 'say', group: 'thinking', extra: 'Profundidade ' + d + '/' + limit + '...' });
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
            // 💡 ZOBRIST: Simula e obtém o novo board E o novo ZHash
            const { board: nb, zHash: newZHash } = simulate(board, m, zHash);

            const contCaps = (m.type==='capture') ? followUpCaptures(nb, m.to[0], m.to[1], RED) : [];
            
            // Chama a busca avançada (NegaScout / PVS) na profundidade 'd-1'
            // Para sequências de captura, o jogador permanece o mesmo (Red = MIN);
            // caso contrário, alterna entre MAX e MIN.
            const val = contCaps.length
              ? negascout(nb, d-1, /* isMax = false para Red (MIN) */ false, -Infinity, Infinity, newZHash, 1)
              : negascout(nb, d-1, /* isMax = true para White (MAX) */ true,  -Infinity, Infinity, newZHash, 1);

            if (val < currentBestScoreForDepth) { 
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

        // --- Refinamento Monte Carlo (opcional, níveis altos) ---
        if (e.data.useMonteCarlo && bestMove && moves && moves.length > 1) {
          try {
            const mcResult = refineWithMonteCarlo(board, moves, bestMove, bestScore);
            if (mcResult && mcResult.move) {
              bestMove = mcResult.move;
              bestScore = mcResult.score;
              self.postMessage({ action: 'say', group: 'thinking', extra: 'Simulações Monte Carlo concluídas.' });
            }
          } catch (err) {
            // Falha silenciosa: se algo der errado, mantemos o resultado da busca clássica
          }
        }

        
        // 📌 PODA DE SIMETRIA: Escolha Aleatória do Espelho (para variedade)
        if (bestMove && isSymmetric) {
            const originalMove = bestMove;
            const mirrorMove = {
                from: [originalMove.from[0], 7 - originalMove.from[1]],
                to: [originalMove.to[0], 7 - originalMove.to[1]],
                type: originalMove.type,
                jumped: originalMove.jumped ? [originalMove.jumped[0], 7 - originalMove.jumped[1]] : undefined
            };

            // Para escolher aleatoriamente entre o lance e seu espelho, garantimos que o espelho é legal
            const movesToCheck = (subset || legal); 
            const isMirrorLegal = movesToCheck.some(m => 
                m.from[0] === mirrorMove.from[0] && m.from[1] === mirrorMove.from[1] &&
                m.to[0] === mirrorMove.to[0] && m.to[1] === mirrorMove.to[1]
            );

            if (isMirrorLegal && Math.random() < 0.5) {
                bestMove = mirrorMove; // Randomly choose the mirror for variety!
                self.postMessage({ action: 'say', group: 'thinking', extra: 'Movimento espelhado escolhido para variedade.' });
            }
        }
        
        // Comentários adicionais com base na avaliação final
        if (bestMove && typeof bestScore === 'number') {
          // Lógica simples: como a IA (vermelha) é o "MIN", valores bem negativos indicam vantagem
          if (bestScore < -0.4) {
            self.postMessage({ action: 'say', group: 'ahead', extra: 'Previsão indica vantagem crescente.' });
          } else if (bestScore > 0.4) {
            self.postMessage({ action: 'say', group: 'behind', extra: 'Posição instável, ajustando estratégia.' });
          } else {
            self.postMessage({ action: 'say', group: 'thinking', extra: 'Equilíbrio tático, calculando transições.' });
          }

          // Promoção iminente / alcançada para a IA (vermelha)
          if (bestMove.to && typeof bestMove.to[0] === 'number' && bestMove.to[0] === 7) {
            self.postMessage({ action: 'say', group: 'promo', extra: 'Promoção garantida.' });
          }

          // Captura crítica na melhor linha
          if (bestMove.type === 'capture') {
            self.postMessage({ action: 'say', group: 'capture', extra: 'Sequência tática identificada.' });
          }
        }


        
        // Envia o melhor lance encontrado dentro do limite de tempo
        self.postMessage({best: bestMove, score: bestScore, depth: currentDepth});
      };
  