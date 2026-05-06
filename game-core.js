
      // --- game-core.js ---
      // (Regras do tabuleiro, turnos, IA e lógica online)
    
      /*************************
       * Constantes / Estado
       *************************/
      const COR_CLARA   = 'bg-slate-200';
      const COR_ESCURA  = 'bg-slate-700';
      const P_VERMELHA  = 'bg-red-600 border-red-900';
      const P_BRANCA    = 'bg-white border-slate-400';
      const RED   = 'red';
      // === BigInt-safe JSON helpers (para salvar/ler histórico com hash BigInt) ===
      function stringifyWithBigInt(obj) {
        return JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() + 'n' : v);
      }
      function parseJSONWithBigInt(str) {
        if (!str) return null;
        try {
          return JSON.parse(str, (_k, v) => (typeof v === 'string' && /^[0-9]+n$/.test(v)) ? BigInt(v.slice(0, -1)) : v);
        } catch (e) {
          console.warn('Falha ao parsear JSON com BigInt:', e);
          return null;
        }
      }
      // === fim BigInt-safe helpers ===

      /*************************
       * Perfil do Jogador (login simples)
       *************************/
function atualizarNomeJogadorNaTela(nome) {
  const el = document.getElementById("player-name");
  if (el) el.textContent = nome || "Visitante";
}

function liberarMenuPrincipal() {
  const login = document.getElementById("loginScreen");
  const menu = document.getElementById("menuContainer");

  if (login) login.classList.add("hidden");
  if (menu) menu.classList.remove("hidden");
}

function mostrarTelaLogin() {
  const login = document.getElementById("loginScreen");
  const menu = document.getElementById("menuContainer");

  if (login) login.classList.remove("hidden");
  if (menu) menu.classList.add("hidden");
}

async function garantirSessaoSupabase() {
  const { data: sessionData } = await window.supabase.auth.getSession();

  if (sessionData?.session?.user) {
    window.userId = sessionData.session.user.id;
    return sessionData.session.user;
  }

  const { data, error } = await window.supabase.auth.signInAnonymously();
  if (error) throw error;

  window.userId = data.user.id;
  return data.user;
}

async function ensureAuthReady() {
  await garantirSessaoSupabase();
}

async function salvarPerfilJogador(nome) {
  const user = await garantirSessaoSupabase();

  const { error } = await window.supabase
    .from("profiles")
    .upsert({
      id: user.id,
      username: nome,
      rating: 1000,
      wins: 0,
      losses: 0,
      draws: 0
    }, { 
      onConflict: "id",
      ignoreDuplicates: false 
    });

  if (error) throw error;

  return user;
}

async function entrarComNick(nome, visitante = false) {
  nome = String(nome || "").trim();

  if (!nome) {
    nome = visitante
      ? "Visitante_" + crypto.randomUUID().slice(0, 8)
      : "Jogador_" + crypto.randomUUID().slice(0, 8);
  }

  localStorage.setItem("player_name", nome);
  window.playerName = nome;

  try {
    await salvarPerfilJogador(nome);
    console.log("✅ Perfil carregado:", nome, window.userId);
  } catch (e) {
    console.error("Erro ao salvar perfil:", e);
  }

  atualizarNomeJogadorNaTela(nome);
  liberarMenuPrincipal();
}

async function initPerfilJogador() {
  const nomeSalvo = localStorage.getItem("player_name");

  if (nomeSalvo) {
    window.playerName = nomeSalvo;

    try {
      await salvarPerfilJogador(nomeSalvo);
    } catch (e) {
      console.warn("Não consegui sincronizar perfil agora:", e);
    }

    atualizarNomeJogadorNaTela(nomeSalvo);
    liberarMenuPrincipal();
    return;
  }

  mostrarTelaLogin();

  const input = document.getElementById("loginNickInput");
  const btnEntrar = document.getElementById("btnLoginNick");
  const btnVisitante = document.getElementById("btnLoginVisitante");

  if (btnEntrar) {
    btnEntrar.onclick = () => entrarComNick(input?.value || "", false);
  }

  if (btnVisitante) {
    btnVisitante.onclick = () => entrarComNick("", true);
  }

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") entrarComNick(input.value, false);
    });
    setTimeout(() => input.focus(), 100);
  }
}

      const WHITE = 'white';
      const KING  = '-king';

      let board = Array(8).fill(null).map(()=>Array(8).fill(null));
      let current = WHITE;
      let selected = null;      // {row,col,el}
      let legal = [];
      let stats = JSON.parse(localStorage.getItem('damasStats') || '{"wins":0,"losses":0}');
      let matchHistory = parseJSONWithBigInt(localStorage.getItem('matchHistory')) || []; // 🧠 ETAPA 1: Histórico de partidas salvo
      let gameHistory = []; // 🧠 Histórico da partida atual
      let isOnline = false; // 🌐 Controla o modo de jogo
      let currentRoom = null; // 🌐 ID da sala online
      let onlineUnsubscribe = null; // 🌐 Função para parar de ouvir o Supabase
      let onlineStarted = false; // 🌐 garante initBoard só 1 vez por sala
      let worker; // Referência ao Web Worker
      let gameEnded = false; // 🔒 Travamento de interação pós-jogo
      let isReturningToMenu = false; // 🔄 Evita travar ao voltar ao menu depois de desistir
      
      // Rastreia timeouts para limpar no fim de jogo/início
      (function(){
        const __setTimeout = window.setTimeout;
        window.__timeouts = [];
        window.setTimeout = function(fn, t){
          const id = __setTimeout(fn, t);
          window.__timeouts.push(id);
          return id;
        };
        
        window.clearAllTimeouts = function(){
          for (const id of window.__timeouts) clearTimeout(id);
          window.__timeouts = [];
          // 🔧 Limpa partículas/efeitos temporários que poderiam ficar sem o timeout de remoção
          document.querySelectorAll('.particle').forEach(el => el.remove());
          // Remove possíveis anéis/hightlights de casas
          document.querySelectorAll('#board .ring-4').forEach(el => el.classList.remove('ring-4','ring-yellow-400','ring-red-500','opacity-80','z-10'));
        };

      })();
      
      function lockInteraction(lock=true){
        const b = document.getElementById('board');
        if (b) b.style.pointerEvents = lock ? 'none' : 'auto';
      }

      
      /* FIX: Removido comentário HTML inválido que causava SyntaxError
      */
      // 🔁 MODO TREINO IA vs IA
      let trainingMode = false;     // true = IA joga pelos dois lados
      let isTrainingMode = false;   // alias usado em initBoard
      let isMultiplayer = false;    // true = modo multiplayer externo
      let trainingSpeed = 400;      // velocidade em ms entre lances da IA
      let endgameTrainingMode = false;
      let endgameTrainingScenario = 'random';

      function resetGameModes() {
        isOnline = false;
        trainingMode = false;
        isTrainingMode = false;
        isMultiplayer = false;

        endgameTrainingMode = false;
        endgameTrainingScenario = 'random';
        trainingTargetGames = null;

        gameEnded = false;
        isReturningToMenu = false;
        current = WHITE;
        selected = null;
        legal = [];

        lockInteraction(false);

        if (typeof removeTrainingHud === 'function') {
          removeTrainingHud();
        }

        console.log("🧹 Modos resetados");
      }

      // Estatísticas da sessão de treino IA vs IA
      let trainingSessionStats = { games: 0, redWins: 0, whiteWins: 0 };
      let trainingTargetGames = null; // quando definido (>0), modo "treinar N partidas"

      function resetTrainingSessionStats() {
        trainingSessionStats = { games: 0, redWins: 0, whiteWins: 0 };
      }

      function ensureTrainingHud() {
        let hud = document.getElementById('trainingHud');
        if (!hud) {
          hud = document.createElement('div');
          hud.id = 'trainingHud';
          hud.className = "fixed top-3 left-1/2 -translate-x-1/2 bg-slate-950/90 text-xs text-slate-200 px-4 py-2 rounded-xl border border-emerald-400/60 shadow-lg z-40";
          hud.innerHTML = `
            <div class="font-semibold text-emerald-300 text-sm mb-1">🤖 IA Master treinando...</div>
            <div class="flex gap-4 text-[11px]">
              <span id="trainingHudGames">Partidas de treino: 0</span>
              <span id="trainingHudWinrate">Winrate no treino: --</span>
            </div>
          `;
          document.body.appendChild(hud);
        }
      }

      function removeTrainingHud() {
        const hud = document.getElementById('trainingHud');
        if (hud) hud.remove();
      }

      function updateTrainingHud() {
        const hudGames = document.getElementById('trainingHudGames');
        const hudWr    = document.getElementById('trainingHudWinrate');
        if (!hudGames || !hudWr) return;

        const total = trainingSessionStats.games || 0;
        const redWins = trainingSessionStats.redWins || 0;
        const target = (typeof trainingTargetGames === 'number' && trainingTargetGames > 0) ? trainingTargetGames : null;

        if (target) {
          hudGames.textContent = `Partidas de treino: ${total} / ${target}`;
        } else {
          hudGames.textContent = `Partidas de treino: ${total}`;
        }

        if (total > 0) {
          const wr = (redWins / Math.max(1, total)) * 100;
          hudWr.textContent = `Winrate no treino: ${wr.toFixed(1).replace('.', ',')}%`;
        } else {
          hudWr.textContent = 'Winrate no treino: --';
        }
      }

      function setTrainingSpeedFromOption(value) {
        // value: 'slow' | 'normal' | 'fast'
        if (value === 'slow')      trainingSpeed = 1000;
        else if (value === 'fast') trainingSpeed = 150;
        // ⚡ ADICIONADO
        else if (value === 'ultra') trainingSpeed = 50; 
        else                       trainingSpeed = 400; // normal
      }
      /* Fim da Etapa 1 */
      
      /*************************
       * IA Adaptativa — Perfil Dinâmico (IMPLEMENTAÇÃO 7 - "Modo Aprendiz")
       *************************/
      // 💡 Agora salva 'agg' (agressividade) e 'def' (defesa)
      // 🐞 CORREÇÃO: Removido. Agora usaremos perfis por cor.
      // let aiProfile = JSON.parse(localStorage.getItem('aiProfile') || '{"agg":0.5,"def":0.5}');
      
      // 💡 IMPLEMENTAÇÃO 7: "Modo Aprendiz" (ajuste contínuo do perfil)
      // 🧠 MODIFICADO: Atualiza o perfil do VENCEDOR e do PERDEDOR
      
      // 💡 IA Adaptativa — Perfil Dinâmico (persistente em Supabase + cache local)
      const AI_DEFAULT_PROFILE = { agg: 0.5, def: 0.5, games: 0, wins: 0 };

      // Cache de perfis por chave dinâmica (cor + dificuldade/sufixo)
      const aiProfileCache = {};

      // Retorna o sufixo do perfil de IA de acordo com a dificuldade atual.
      // Em modo treino (IA vs IA), sempre usa o perfil "master" para treinar a IA profissional.
      function getAIProfileSuffix() {
        try {
          // Modo treino força sempre o perfil "master"
          if (typeof trainingMode !== 'undefined' && trainingMode) {
            return 'master';
          }
        } catch (_) {}

        const diff = (localStorage.getItem('difficulty') || 'medium').toLowerCase();
        if (diff === 'easy' || diff === 'medium' || diff === 'hard' || diff === 'master') {
          return diff;
        }
        return 'medium';
      }

      function getAIProfileStorageKey(color) {
        const suffix = getAIProfileSuffix();
        return `aiProfile_${color}_${suffix}`; // Ex: aiProfile_red_master
      }

      function getAIProfileCacheKey(color) {
        return getAIProfileStorageKey(color); // Usa a mesma chave para o cache
      }

      // 💡 NEURAL HEURÍSTICA SIMPLES (pesos aprendidos por cor)
      // Vetor de 4 características: [material, reis, centro, mobilidade]
      const NEURAL_DEFAULT_WEIGHTS = [1.0, 0.4, 0.3, 0.2];

      function getNeuralKey(color) {
        return `neuralWeights_${color}`;
      }

      function loadNeuralWeights(color) {
        const key = getNeuralKey(color);
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length === 4) {
              return arr.map(v => (typeof v === 'number' ? v : 0));
            }
          }
        } catch (e) {
          console.warn("Falha ao ler pesos neurais:", e);
        }
        // Retorna uma cópia para evitar mutações acidentais
        return [...NEURAL_DEFAULT_WEIGHTS];
      }

      function saveNeuralWeights(color, weights) {
        try {
          localStorage.setItem(getNeuralKey(color), JSON.stringify(weights));
        } catch (e) {
          console.warn("Falha ao salvar pesos neurais:", e);
        }
      }

      function getNeuralWeights(player = RED) {
        const color = (player === WHITE) ? 'white' : 'red';
        if (!getNeuralWeights.cache) getNeuralWeights.cache = {};
        if (!getNeuralWeights.cache[color]) {
          getNeuralWeights.cache[color] = loadNeuralWeights(color);
        }
        return getNeuralWeights.cache[color];
      }

      function extractNeuralFeaturesFor(color) {
        const isWhite = (color === 'white');
        let material = 0, kings = 0, center = 0;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;
            const isW = p.startsWith(WHITE);
            if (isW !== isWhite) continue;
            const isK = p.endsWith(KING);
            material += isK ? 3 : 1;
            if (isK) kings++;
            if (r >= 2 && r <= 5 && c >= 2 && c <= 5) center++;
          }
        }
        const moves = allMoves(isWhite ? WHITE : RED, board).length;
        // [material, reis, casas de centro ocupadas, mobilidade]
        return [material, kings, center, moves];
      }

      function adjustNeuralWeights(winner) {
        // winner: WHITE ou RED
        const winnerColor = (winner === WHITE) ? 'white' : 'red';
        const loserColor  = (winner === WHITE) ? 'red'   : 'white';

        const featWinner = extractNeuralFeaturesFor(winnerColor);
        const featLoser  = extractNeuralFeaturesFor(loserColor);

        const wWeights = getNeuralWeights(winner === WHITE ? WHITE : RED).slice();
        const lWeights = getNeuralWeights(winner === WHITE ? RED : WHITE).slice();

        const lr = 0.02; // taxa de aprendizado pequena para estabilidade

        for (let i = 0; i < 4; i++) {
          const diff = (featWinner[i] - featLoser[i]) || 0;
          wWeights[i] += lr * diff;
          lWeights[i] -= lr * diff;
        }

        saveNeuralWeights(winnerColor, wWeights);
        saveNeuralWeights(loserColor, lWeights);

        if (!getNeuralWeights.cache) getNeuralWeights.cache = {};
        getNeuralWeights.cache[winnerColor] = wWeights;
        getNeuralWeights.cache[loserColor] = lWeights;
      }
      
      // ==========================================================
      // ✅ NOVO BLOCO: HEURÍSTICA DE FIM DE JOGO ADAPTATIVA (MAIN)
      // ==========================================================
      
      // [Controlo_Diagonais, Oposição_Rei, Forçar_Canto]
      const ENDGAME_DEFAULT_WEIGHTS = [1.0, 0.4, 0.3]; 

      function getEndgameKey(color) {
        return `endgameWeights_${color}`;
      }

      function loadEndgameWeights(color) {
        const key = getEndgameKey(color);
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length === 3) {
              return arr.map(v => (typeof v === 'number' ? v : 0));
            }
          }
        } catch (e) {
          console.warn("Falha ao ler pesos de fim de jogo:", e);
        }
        return [...ENDGAME_DEFAULT_WEIGHTS];
      }

      function saveEndgameWeights(color, weights) {
        try {
          localStorage.setItem(getEndgameKey(color), JSON.stringify(weights));
        } catch (e) {
          console.warn("Falha ao salvar pesos de fim de jogo:", e);
        }
      }

      function getEndgameWeights(player = RED) {
        const color = (player === WHITE) ? 'white' : 'red';
        if (!getEndgameWeights.cache) getEndgameWeights.cache = {};
        if (!getEndgameWeights.cache[color]) {
          getEndgameWeights.cache[color] = loadEndgameWeights(color);
        }
        return getEndgameWeights.cache[color];
      }

      function extractEndgameFeaturesFor(color) {
          const isWhite = (color === 'white');
          let controlDiag = 0, kingOpp = 0, cornering = 0;
          
          let myKings = [], oppKings = [];
          
          for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                  const p = board[r][c];
                  if (!p) continue;
                  const isW = p.startsWith(WHITE);
                  const isK = p.endsWith(KING);
                  
                  if (isW === isWhite) {
                      if (isK) myKings.push({r, c});
                      // 1. Control Diag: Controle da diagonal principal para a frente
                      if ((isWhite && r > c) || (!isWhite && c > r)) {
                          controlDiag += 0.1;
                      }
                      
                      // 3. Cornering: Peças no lado adversário (r=0 para White, r=7 para Red)
                      if (isWhite) cornering += (7 - r) / 7;
                      else cornering += r / 7;
                      
                  } else if (isK) {
                      oppKings.push({r, c});
                  }
              }
          }

          // 2. King Opposition: Distância mínima entre reis
          if (myKings.length > 0 && oppKings.length > 0) {
              let minDist = 100;
              for (const myK of myKings) {
                  for (const oppK of oppKings) {
                      // Distância xadrez
                      const dist = Math.max(Math.abs(myK.r - oppK.r), Math.abs(myK.c - oppK.c));
                      minDist = Math.min(minDist, dist);
                  }
              }
              // Oposição é boa se a distância for pequena (forcing move)
              kingOpp = 1 - Math.min(minDist / 7, 1); 
          }

          // [Control_Diag, King_Opp, Cornering]
          return [controlDiag, kingOpp, cornering];
      }

      function adjustEndgameWeights(winner) {
          // Só ajusta se houver peças suficientes para a análise (mais de 2 vs 1)
          const n = board.flat().filter(x => x !== null).length;
          if (n > 10 || n < 3) return; 

          const winnerColor = (winner === WHITE) ? 'white' : 'red';
          const loserColor  = (winner === WHITE) ? 'red'   : 'white';

          // A IA deve aprender a valorizar o que o vencedor tinha e desvalorizar o que o perdedor tinha
          const featWinner = extractEndgameFeaturesFor(winnerColor);
          const featLoser  = extractEndgameFeaturesFor(loserColor);

          const wWeights = getEndgameWeights(winner === WHITE ? WHITE : RED).slice();
          const lWeights = getEndgameWeights(winner === WHITE ? RED : WHITE).slice();

          const lr = 0.05; // Taxa de aprendizado um pouco maior para fins de jogo (aprendizagem mais rápida)

          for (let i = 0; i < 3; i++) {
              const diff = (featWinner[i] - featLoser[i]) || 0;
              // Ajusta o peso: se a feature foi maior para o vencedor, o peso aumenta
              wWeights[i] += lr * diff;
              // E diminui para o perdedor
              lWeights[i] -= lr * diff;
              
              // Mantém os pesos em um intervalo razoável (ex: [0.1, 2.0])
              wWeights[i] = Math.max(0.1, Math.min(wWeights[i], 2.0));
              lWeights[i] = Math.max(0.1, Math.min(lWeights[i], 2.0));
          }

          saveEndgameWeights(winnerColor, wWeights);
          saveEndgameWeights(loserColor, lWeights);

          if (!getEndgameWeights.cache) getEndgameWeights.cache = {};
          getEndgameWeights.cache[winnerColor] = wWeights;
          getEndgameWeights.cache[loserColor] = lWeights;
      }
      // ==========================================================
      // ✅ FIM DO NOVO BLOCO
      // ==========================================================

            async function updateSingleAIProfile(color, isWinner) {
        // color: 'white' ou 'red'
        const storageKey = getAIProfileStorageKey(color);
        const cacheKey   = getAIProfileCacheKey(color);

        let profile = { ...AI_DEFAULT_PROFILE };

        // 1. Tenta carregar do localStorage (perfil por dificuldade)
        try {
          const ls = localStorage.getItem(storageKey);
          if (ls) {
            const parsed = JSON.parse(ls);
            profile = {
              agg:  (typeof parsed.agg  === 'number') ? parsed.agg  : AI_DEFAULT_PROFILE.agg,
              def:  (typeof parsed.def  === 'number') ? parsed.def  : AI_DEFAULT_PROFILE.def,
              games:(typeof parsed.games=== 'number') ? parsed.games: 0,
              wins: (typeof parsed.wins === 'number') ? parsed.wins : 0
            };
          }
        } catch (e) {
          console.warn("Falha ao ler perfil IA do localStorage:", e);
        }

        // 2. Tenta carregar do Supabase (caso disponível) para esse storageKey
        if (window.db && window.doc && window.getDoc && window.setDoc) {
          try {
            const { db, doc, getDoc, setDoc } = window;
            const ref = doc(db, "aiProfiles", storageKey);
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const remote = snap.data();
              profile = {
                agg:  (typeof remote.agg  === 'number') ? remote.agg  : profile.agg,
                def:  (typeof remote.def  === 'number') ? remote.def  : profile.def,
                games:(typeof remote.games=== 'number') ? remote.games: profile.games,
                wins: (typeof remote.wins === 'number') ? remote.wins : profile.wins
              };
            } else {
              // Cria o doc inicial se ainda não existir
              await setDoc(ref, profile);
            }
          } catch (e) {
            console.warn("Falha ao ler perfil IA do Supabase:", e);
          }
        }

        // 3. Atualiza estatísticas básicas
        profile.games = (profile.games || 0) + 1;
        profile.wins = profile.wins || 0;
        if (isWinner) profile.wins++;

        const ratio = profile.wins / Math.max(1, profile.games);

        // 4. Ajusta agressividade/defesa conforme vitória/derrota
        if (isWinner) {
          // Se ganha muito, fica MENOS agressivo e MAIS defensivo (para estabilizar)
          profile.agg = Math.max(0.1, 0.8 - ratio * 0.5);
          profile.def = Math.min(0.9, 0.2 + ratio * 0.5);
        } else {
          // Se perde muito, fica MAIS agressivo e MENOS defensivo (para tentar virar)
          profile.agg = Math.min(0.9, 0.2 + (1.0 - ratio) * 0.5);
          profile.def = Math.max(0.1, 0.8 - (1.0 - ratio) * 0.5);
        }

        // 5. Atualiza cache em memória (usado por getAIProfile)
        aiProfileCache[cacheKey] = { ...profile };

        // 6. Persiste no localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(profile));
        } catch (e) {
          console.warn("Falha ao salvar perfil IA no localStorage:", e);
        }

        // 7. Persiste no Supabase (merge) se disponível
        if (window.db && window.doc && window.setDoc) {
          try {
            const { db, doc, setDoc } = window;
            const ref = doc(db, "aiProfiles", storageKey);
            await setDoc(ref, profile, { merge: true });
          } catch (e) {
            console.warn("Falha ao salvar perfil IA no Supabase:", e);
          }
        }
      }


      // 💡 IMPLEMENTAÇÃO 7: "Modo Aprendiz" (ajuste contínuo do perfil)
      // 🧠 MODIFICADO: Atualiza o perfil do VENCEDOR e do PERDEDOR, agora usando Supabase
      async function updateAIProfile(winner) {
        try {
          const winnerColor = (winner === WHITE) ? 'white' : 'red';
          const loserColor  = (winner === WHITE) ? 'red'   : 'white';

          await Promise.all([
            updateSingleAIProfile(winnerColor, true),
            updateSingleAIProfile(loserColor, false)
          ]);
        } catch (e) {
          console.error("Erro ao atualizar perfil de IA:", e);
        }
      }

      // 💡 Nova função para passar o perfil completo para o worker
      // 🧠 MODIFICADO: Pega o perfil da cor específica (lendo cache/localStorage e sincronizando com Supabase em background)
            function getAIProfile(player = RED) { // Padrão é RED para manter compatibilidade
        const color = (player === WHITE) ? 'white' : 'red';
        const storageKey = getAIProfileStorageKey(color);
        const cacheKey   = getAIProfileCacheKey(color);

        // 1. Se já está em cache, retorna direto
        if (aiProfileCache[cacheKey]) {
          return aiProfileCache[cacheKey];
        }

        // 2. Tenta carregar um snapshot local como base
        let base = {
          agg: AI_DEFAULT_PROFILE.agg,
          def: AI_DEFAULT_PROFILE.def,
          games: 0,
          wins: 0
        };

        try {
          const ls = localStorage.getItem(storageKey);
          if (ls) {
            const parsed = JSON.parse(ls);
            base = {
              agg:   (typeof parsed.agg   === 'number') ? parsed.agg   : base.agg,
              def:   (typeof parsed.def   === 'number') ? parsed.def   : base.def,
              games: (typeof parsed.games === 'number') ? parsed.games : base.games,
              wins:  (typeof parsed.wins  === 'number') ? parsed.wins  : base.wins
            };
          }
        } catch (e) {
          console.warn('Falha ao ler aiProfile do localStorage:', e);
        }

        // 3. Sincroniza em background com Supabase (não bloqueia a jogada)
        if (window.db && window.doc && window.getDoc && window.setDoc) {
          (async () => {
            try {
              const { db, doc, getDoc, setDoc } = window;
              const ref = doc(db, "aiProfiles", storageKey);
              const snap = await getDoc(ref);
              if (snap.exists()) {
                const remote = snap.data();
                const updated = {
                  agg:   (typeof remote.agg   === 'number') ? remote.agg   : base.agg,
                  def:   (typeof remote.def   === 'number') ? remote.def   : base.def,
                  games: (typeof remote.games === 'number') ? remote.games : base.games,
                  wins:  (typeof remote.wins  === 'number') ? remote.wins  : base.wins
                };
                aiProfileCache[cacheKey] = updated;
                try {
                  localStorage.setItem(storageKey, JSON.stringify({ ...remote, ...updated }));
                } catch (_) {}
              } else {
                await setDoc(ref, { 
                  ...AI_DEFAULT_PROFILE, 
                  agg: base.agg, 
                  def: base.def, 
                  games: base.games || 0, 
                  wins: base.wins || 0
                });
              }
            } catch (e) {
              console.warn("Falha ao sincronizar perfil IA com Supabase:", e);
            }
          })();
        }

        // Atualiza cache local e retorna
        aiProfileCache[cacheKey] = base;
        return base;
      }


      // 🔁 Helper para garantir que o aiProfile do localStorage seja espelhado explicitamente no Supabase
            // 🔁 Helper para garantir que TODOS os perfis aiProfile_* do localStorage
      // sejam espelhados explicitamente no Supabase (inclui dificuldades)
      async function forceSyncAIProfiles() {
        try {
          if (!(window.db && window.doc && window.setDoc)) return;
          const { db, doc, setDoc } = window;

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('aiProfile_')) continue;
            try {
              const ls = localStorage.getItem(key);
              if (!ls) continue;
              const profile = JSON.parse(ls);
              const ref = doc(db, "aiProfiles", key);
              await setDoc(ref, profile, { merge: true });
              console.log("🔥 aiProfile sincronizado com Supabase:", key, profile);
            } catch (e) {
              console.warn("Falha ao sincronizar aiProfile com Supabase (key):", key, e);
            }
          }
        } catch (e) {
          console.warn("forceSyncAIProfiles error:", e);
        }
      }


// 💡 ZOBRIST HASHING: Geração de Chaves Aleatórias (BigInt)
      const ZOBRIST_KEYS = [];
      function initializeZobrist() {
        // 5 peças possíveis (null=0, white=1, red=2, white-king=3, red-king=4)
        // Usamos 4 chaves (1-4) para 64 casas. null não precisa de chave.
        const pieces = 5; 
        const squares = 64;
        for (let i = 0; i < pieces * squares; i++) {
          // Gera um BigInt aleatório (64-bit)
          ZOBRIST_KEYS.push(BigInt(Math.floor(Math.random() * 0xFFFFFFFF)) * BigInt(0xFFFFFFFF) + BigInt(Math.floor(Math.random() * 0xFFFFFFFF)));
        }
        console.log("Zobrist Keys geradas:", ZOBRIST_KEYS.length);
        window.ZOBRIST_KEYS = ZOBRIST_KEYS; // Torna global para o worker
      }

      // Chama a inicialização no carregamento
      initializeZobrist();


      // ======================================================
      // 🔥 INÍCIO DA INTEGRAÇÃO FIREBASE (APRENDIZADO IA)
      // ======================================================
  
      /**
       * 🔥 PARTE 2 (ADAPTADA): Salva a inteligência (pesos e memória) no Supabase.
       * Puxa os dados do 'cache' local (localStorage) e envia para a nuvem.
       */
      async function salvarInteligenciaIA() {
        await ensureAuthReady();

        // Garante que o DB esteja pronto (vem do firebase.js)
        if (!window.db || !window.setDoc || !window.doc) {
          console.warn("DB não pronto, salvamento da IA abortado.");
          return;
        }
        const { db, setDoc, doc } = window;
  
        try {
          // 1. Pega os dados de APRENDIZADO REAIS que estão no localStorage
          
          // Seus pesos neurais
          const neural_w = loadNeuralWeights('white'); // Função loadNeuralWeights() já existe
          const neural_r = loadNeuralWeights('red');   // Função loadNeuralWeights() já existe

          // Seus pesos de fim de jogo
          const endgame_w = loadEndgameWeights('white'); // Função loadEndgameWeights() já existe
          const endgame_r = loadEndgameWeights('red');   // Função loadEndgameWeights() já existe
          
          // Sua variável 'patternMemory' está dividida em duas no script
          const patternMemory_w = JSON.parse(localStorage.getItem('patternMemory_white') || '{}');
          const patternMemory_r = JSON.parse(localStorage.getItem('patternMemory_red') || '{}');
  
          // 2. Salva no local que você definiu: /ia/inteligencia
          await setDoc(doc(db, "ia", "inteligencia"), {
            neural_w: neural_w,
            neural_r: neural_r,
            endgame_w: endgame_w, // NOVO: Pesos de fim de jogo
            endgame_r: endgame_r, // NOVO: Pesos de fim de jogo
            patternMemory_white: patternMemory_w, // Salva a memória das brancas
            patternMemory_red: patternMemory_r,   // Salva a memória das vermelhas
            updatedAt: Date.now()
          });
  
          console.log("🔥 Inteligência da IA (Pesos e Padrões) salva no Supabase!");
  
        } catch (e) {
          console.error("Erro ao salvar inteligência da IA no Supabase:", e);
        }
      }
  
      /**
       * 🔥 PARTE 3 (ADAPTADA): Carrega a inteligência do Supabase quando o jogo abre.
       * Coloca os dados no 'cache' local (localStorage) e envia para o Worker.
       */
      async function carregarInteligenciaIA(retryCount = 0) {
        if (!window.db || !window.getDoc || !window.doc) {
          if (retryCount < 5) {
            console.warn(`DB não pronto, tentativa ${retryCount + 1}/5...`);
            setTimeout(() => carregarInteligenciaIA(retryCount + 1), 1000 + retryCount * 500);
          } else {
            console.error("DB não ficou pronto após 5 tentativas. Abortando carregamento da IA.");
          }
          return false;
        }
        const { db, getDoc, doc } = window;
  
        try {
          const snap = await getDoc(doc(db, "ia", "inteligencia"));
  
          if (snap.exists()) {
            const data = snap.data();
            console.log("🔥 Inteligência da IA encontrada no Supabase. Carregando...");
  
            // 1. Carrega os Pesos Neurais (e salva no localStorage)
            if (data.neural_w) {
              saveNeuralWeights('white', data.neural_w); // saveNeuralWeights() já existe
              // Atualiza o cache em memória
              if (!getNeuralWeights.cache) getNeuralWeights.cache = {};
              getNeuralWeights.cache['white'] = data.neural_w;
            }
            if (data.neural_r) {
              saveNeuralWeights('red', data.neural_r);
              if (!getNeuralWeights.cache) getNeuralWeights.cache = {};
              getNeuralWeights.cache['red'] = data.neural_r;
            }

            // 1.5. Carrega os Pesos de Fim de Jogo (e salva no localStorage)
            if (data.endgame_w) {
                saveEndgameWeights('white', data.endgame_w); 
                if (!getEndgameWeights.cache) getEndgameWeights.cache = {};
                getEndgameWeights.cache['white'] = data.endgame_w;
            }
            if (data.endgame_r) {
                saveEndgameWeights('red', data.endgame_r);
                if (!getEndgameWeights.cache) getEndgameWeights.cache = {};
                getEndgameWeights.cache['red'] = data.endgame_r;
            }
  
            // 2. Carrega a Memória de Padrões (e salva no localStorage)
            const mem_w = data.patternMemory_white || {};
            const mem_r = data.patternMemory_red || {};
            localStorage.setItem('patternMemory_white', JSON.stringify(mem_w));
            localStorage.setItem('patternMemory_red', JSON.stringify(mem_r));
  
            // 3. (IMPORTANTE) Envia a memória carregada para o Worker
            // O worker será inicializado logo após esta função, então verificamos se ele já existe
            if (worker) {
              worker.postMessage({
                type: 'loadPatternMemory',
                patternMemory_white: mem_w,
                patternMemory_red: mem_r
              });
              console.log("🔥 Memória de padrões enviada ao Worker.");
            }
  
            return true;
  
          } else {
            console.log("Nenhuma inteligência de IA encontrada no Supabase. Usando dados locais/padrão.");
            // 🧠 Se não existir, cria o primeiro documento com os dados padrões
            console.log("🔥 Criando primeiro registro de inteligência no Supabase...");
            await salvarInteligenciaIA(); // Salva os valores padrões atuais
            return false;
          }
        } catch (e) {
          console.error("Erro ao carregar inteligência da IA do Supabase:", e);
          return false;
        }
      }
  
      // ======================================================
      // 🔥 FIM DA INTEGRAÇÃO FIREBASE
      // ======================================================

      /*
       * =====================================================
       * 🧠 Sincronização Persistente da Inteligência e Perfis da IA
       *
       * Para garantir que todas as instâncias do jogo compartilhem a mesma
       * inteligência (pesos neurais, heurística de fim de jogo e memória de
       * padrões) e os mesmos perfis de IA (agg/def/games/wins), criamos
       * assinantes (listeners) do Supabase. Sempre que um documento é
       * atualizado no servidor, atualizamos o cache local (localStorage e
       * caches em memória) e, quando aplicável, enviamos os dados ao Web
       * Worker. Estes listeners são registrados após o Supabase estar pronto
       * (supabaseReady) e podem ser removidos chamando as funções de
       * unsubscribe retornadas.
       */
      // Guardam funções de unsubscribe para evitar múltiplos ouvintes duplicados
      let iaIntelligenceUnsub = null;
      let iaProfilesUnsubs = [];

      /**
       * Inscreve-se no documento /ia/inteligencia no Supabase.
       * Quando os dados remotos mudam, atualiza localmente os pesos neurais,
       * pesos de fim de jogo e memórias de padrões, além de notificar o worker.
       */
      function subscribeToInteligenciaIA() {
        try {
          if (!window.onSnapshot || !window.doc || !window.db) return;
          // Remove listener anterior, se houver
          if (iaIntelligenceUnsub) {
            try { iaIntelligenceUnsub(); } catch (_) {}
            iaIntelligenceUnsub = null;
          }
          const { db, doc, onSnapshot } = window;
          const ref = doc(db, 'ia', 'inteligencia');
          iaIntelligenceUnsub = onSnapshot(ref, (snap) => {
            try {
              if (!snap.exists()) return;
              const data = snap.data() || {};
              // Atualiza pesos neurais
              if (data.neural_w) {
                saveNeuralWeights('white', data.neural_w);
                if (!getNeuralWeights.cache) getNeuralWeights.cache = {};
                getNeuralWeights.cache.white = data.neural_w;
              }
              if (data.neural_r) {
                saveNeuralWeights('red', data.neural_r);
                if (!getNeuralWeights.cache) getNeuralWeights.cache = {};
                getNeuralWeights.cache.red = data.neural_r;
              }
              // Atualiza pesos de fim de jogo
              if (data.endgame_w) {
                saveEndgameWeights('white', data.endgame_w);
                if (!getEndgameWeights.cache) getEndgameWeights.cache = {};
                getEndgameWeights.cache.white = data.endgame_w;
              }
              if (data.endgame_r) {
                saveEndgameWeights('red', data.endgame_r);
                if (!getEndgameWeights.cache) getEndgameWeights.cache = {};
                getEndgameWeights.cache.red = data.endgame_r;
              }
              // Atualiza memória de padrões
              const memW = data.patternMemory_white || {};
              const memR = data.patternMemory_red || {};
              localStorage.setItem('patternMemory_white', JSON.stringify(memW));
              localStorage.setItem('patternMemory_red', JSON.stringify(memR));
              // Se houver worker, envia nova memória
              if (worker) {
                worker.postMessage({
                  type: 'loadPatternMemory',
                  patternMemory_white: memW,
                  patternMemory_red: memR
                });
              }
            } catch (ex) {
              console.warn('Erro ao processar snapshot de inteligencia IA:', ex);
            }
          });
        } catch (ex) {
          console.warn('Falha ao inscrever inteligência IA:', ex);
        }
      }

      /**
       * Inscreve-se em todos os documentos de perfis de IA (aiProfiles).
       * Para cada combinação de cor (white/red) e dificuldade (easy, medium,
       * hard, master) haverá um documento. Quando um perfil muda, este
       * listener atualiza o localStorage e o cache em memória para que as
       * próximas leituras usem os valores mais recentes.
       */
      function subscribeToAIProfiles() {
        try {
          if (!window.onSnapshot || !window.doc || !window.db) return;
          // Cancela listeners anteriores
          if (iaProfilesUnsubs && iaProfilesUnsubs.length) {
            iaProfilesUnsubs.forEach(unsub => {
              try { unsub(); } catch (_) {}
            });
          }
          iaProfilesUnsubs = [];
          const { db, doc, onSnapshot } = window;
          const suffixes = ['easy','medium','hard','master'];
          const colors = ['white','red'];
          for (const color of colors) {
            for (const suf of suffixes) {
              const key = `aiProfile_${color}_${suf}`;
              const ref = doc(db, 'aiProfiles', key);
              const unsub = onSnapshot(ref, (snap) => {
                try {
                  if (!snap.exists()) return;
                  const data = snap.data() || {};
                  // Atualiza localStorage com o perfil remoto
                  try {
                    localStorage.setItem(key, JSON.stringify(data));
                  } catch (_) {}
                  // Atualiza cache em memória
                  if (!aiProfileCache) return;
                  aiProfileCache[key] = {
                    agg:  (typeof data.agg  === 'number') ? data.agg  : aiProfileCache[key]?.agg,
                    def:  (typeof data.def  === 'number') ? data.def  : aiProfileCache[key]?.def,
                    games:(typeof data.games=== 'number') ? data.games: aiProfileCache[key]?.games,
                    wins: (typeof data.wins === 'number') ? data.wins : aiProfileCache[key]?.wins
                  };
                } catch (ex) {
                  console.warn('Erro ao processar snapshot de perfil IA:', ex);
                }
              });
              iaProfilesUnsubs.push(unsub);
            }
          }
        } catch (ex) {
          console.warn('Falha ao inscrever perfis IA:', ex);
        }
      }

      // 🌐 PASSO 3 (JS): Helpers de Cor do Jogador
      // Manter a cor do jogador em memória além de gravá-la no localStorage
      // evita que a orientação do tabuleiro se perca caso outros fluxos
      // sobrescrevam localStorage (ex.: voltar ao menu). A variável
      // playerColorMem permanece constante durante uma sessão online.
      let playerColorMem = null;
      function setPlayerColor(color){ // 'white' ou 'red'
        try {
          localStorage.setItem('playerColor', color);
        } catch (_) {}
        playerColorMem = color;
      }
      function getPlayerColor(){
        // Prioriza o valor em memória para evitar que alterações no localStorage
        // durante a partida online causem inversão de cores.
        if (playerColorMem) return playerColorMem;
        try {
          const stored = localStorage.getItem('playerColor');
          if (stored) {
            playerColorMem = stored;
            return stored;
          }
        } catch (_) {}
        return 'white';
      }

      // ⭐️ ADIÇÃO: Helper para a nova regra de captura
      function getCaptureRule() {
        return localStorage.getItem('captureRule') || 'sim'; // 'sim' = pode para trás
      }

      /*************************
       * Helpers (Core)
       *************************/
      
      // *** OTIMIZAÇÃO B (Clone Manual - Frontend) ***
      // Substitui structuredClone() que é mais lento.
      function cloneBoard(b) {
        const nb = Array(8);
        for (let i = 0; i < 8; i++) nb[i] = b[i].slice();
        return nb;
      }
      
      // 💡 ZOBRIST HASHING: Converte board para Zobrist Hash (BigInt)
      function pieceToIndex(p) {
        if (p === WHITE) return 0;
        if (p === RED) return 1;
        if (p === WHITE + KING) return 2;
        if (p === RED + KING) return 3;
        return 4; // null ou peça inválida
      }

      function getBoardHash(b) {
        if (!window.ZOBRIST_KEYS) return ''; // Fallback
        
        let hash = BigInt(0);
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            const pieceIdx = pieceToIndex(p);
            // 5 peças * 64 casas. pieceIdx=0-4, squareIdx=0-63
            const keyIndex = pieceIdx * 64 + (r * 8 + c);
            if (pieceIdx !== 4 && keyIndex < window.ZOBRIST_KEYS.length) {
              hash ^= window.ZOBRIST_KEYS[keyIndex];
            }
          }
        }
        // O hash é retornado como BigInt
        return hash; 
      }
      
      // 🧠 Alias global para a função de hash (usado pela memória instintiva)
      window.getZobristHash = getBoardHash;
      
      // 🌐 Helper para serializar/desserializar o tabuleiro para o Supabase
      function serializeBoard(b) {
        // Converte o array 2D em uma string simples
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
        if (!s || typeof s !== 'string') return null; // Retorna null se a string for inválida
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

      /*************************
       * Regras & Movimentos
       *************************/
      function inB(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

      // 🌐 PASSO 2 (JS): Adicionar classe .piece
      function createPiece(colorClass, player){
        const piece=document.createElement('div');
        piece.className=`piece w-[70%] h-[70%] rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-lg border-4 cursor-pointer hover:opacity-90 transition ${colorClass}`;
        piece.dataset.player=player;
        const inner=document.createElement('div');
        inner.className='w-1/2 h-1/2 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 border-2 border-white/50';
        piece.appendChild(inner);
        // Não aplica mais contra‑rotação baseada em classes CSS; a orientação
        // visual do tabuleiro é tratada pelas funções de conversão de
        // coordenadas (toViewCoords/fromViewCoords).
        return piece;
      }

      // ♟️ FUNÇÕES DE TREINO DE FINAIS
      function emptyBoard() {
        return Array(8).fill(null).map(() => Array(8).fill(null));
      }

      function randomEndgameScenarioType() {
        const types = [
          '3x1',
          '3x2',
          '4x2',
          '4x3',
          'duas_damas_vs_uma',
          'dama_mais_duas_vs_duas'
        ];
        return types[Math.floor(Math.random() * types.length)];
      }

      function setupEndgameScenario(type = 'random') {
        const b = emptyBoard();
        const scenario = type === 'random' ? randomEndgameScenarioType() : type;

        switch (scenario) {
          case '3x1':
            b[2][3] = WHITE;
            b[3][4] = WHITE;
            b[4][5] = WHITE + KING;
            b[5][2] = RED;
            break;

          case '3x2':
            b[2][3] = WHITE;
            b[3][4] = WHITE;
            b[4][1] = WHITE + KING;
            b[5][2] = RED;
            b[6][5] = RED;
            break;

          case '4x2':
            b[2][1] = WHITE;
            b[2][3] = WHITE;
            b[3][4] = WHITE;
            b[4][5] = WHITE + KING;
            b[5][2] = RED;
            b[6][5] = RED;
            break;

          case '4x3':
            b[2][1] = WHITE;
            b[2][3] = WHITE;
            b[3][4] = WHITE;
            b[4][5] = WHITE + KING;
            b[5][2] = RED;
            b[5][6] = RED;
            b[6][3] = RED;
            break;

          case 'duas_damas_vs_uma':
            b[2][1] = WHITE + KING;
            b[3][4] = WHITE + KING;
            b[5][6] = RED + KING;
            break;

          case 'dama_mais_duas_vs_duas':
            b[2][1] = WHITE + KING;
            b[3][4] = WHITE;
            b[4][5] = WHITE;
            b[5][2] = RED;
            b[6][5] = RED;
            break;

          default:
            b[2][3] = WHITE;
            b[3][4] = WHITE;
            b[4][5] = WHITE + KING;
            b[5][2] = RED;
            break;
        }

        console.log('♟️ Treino de final criado:', scenario);
        return b;
      }

      // 🐞 Declaração antecipada para evitar closure frágil
      const elBoard = document.getElementById('board');
      const elOverlay = document.getElementById('overlay');

      function initBoard(){
        // 🐞 Mostra o app-container ao iniciar jogo (estava escondido atrás do login)
        try { document.getElementById('appContainer').classList.remove('hidden'); } catch(_) {}
        
        rankingJaPontuouNaPartida = false;
        iaJaAprendeuNaPartida = false;
        livroJaAtualizouNaPartida = false;
        gameEnded = false; lockInteraction(false); clearAllTimeouts(); current = WHITE;
        // 🧠 Mostra o botão de opções (⋮) com fade (Função de UI)
        showOptionsButton(true);
        // 🧠 ETAPA 1 (Reset): Reinicia histórico da partida
        gameHistory = [];
        // 🔄 Reseta contador de jogadas sem captura (empate técnico)
        window.noCaptureCount = 0;
        // 🔁 Reseta histórico de repetição de posição (empate por 3x)
        window.positionRepetition = {};
        // 🧊 Limpa motivo de empate forçado
        window.drawReason = null; 
        // 5️⃣ Limpeza de cache entre partidas
        if (worker) worker.postMessage({ resetCache: true });

        // 🔁 Reinicia flag de aviso de poucas peças (contexto lowMaterial)
        window.lowMaterialAnnounced = false;

        elBoard.innerHTML='';
        board = Array(8).fill(null).map(()=>Array(8).fill(null));
        selected=null; 
        
        // 🐝 COLMEIA: Baixa pesos da colmeia ao iniciar partida vs IA
        if (!isMultiplayer && !isTrainingMode) {
          setTimeout(() => baixarPesosColmeia(), 500);
        } 

        // Determina a cor do jogador para orientar o tabuleiro. Em modo online,
        // utiliza getPlayerColor(); para jogos locais ou treino, assume 'white'.
        let myColor;
        try {
          myColor = isOnline ? getPlayerColor() : WHITE;
        } catch (_) {
          myColor = WHITE;
        }

        // Constrói o tabuleiro usando coordenadas de visualização. A ordem dos
        // elementos no DOM é determinada por vRow/vCol, garantindo que o
        // primeiro elemento corresponda ao canto superior esquerdo da visão
        // atual. A partir de vRow/vCol convertemos para r/c (interno) para
        // inicializar as peças na matriz `board`.
        for (let vRow = 0; vRow < 8; vRow++) {
          for (let vCol = 0; vCol < 8; vCol++) {
            const [r, c] = fromViewCoords(vRow, vCol, myColor);
            const sq = document.createElement('div');
            const dark = ((r + c) % 2) !== 0;
            sq.className = `aspect-square relative ${dark ? COR_ESCURA : COR_CLARA}`;
            // Armazena as coordenadas de visualização no dataset para uso nos cliques
            sq.dataset.r = vRow;
            sq.dataset.c = vCol;
            // Povoamento inicial de peças com base nas coordenadas internas
            if (dark && !endgameTrainingMode) {
              if (r < 3) {
                const p = createPiece(P_VERMELHA, RED);
                sq.appendChild(p);
                board[r][c] = RED;
              } else if (r > 4) {
                const p = createPiece(P_BRANCA, WHITE);
                sq.appendChild(p);
                board[r][c] = WHITE;
              }
            }
            elBoard.appendChild(sq);
            sq.addEventListener('click', onSquareClick);
          }
        }

        if (endgameTrainingMode) {
          board = setupEndgameScenario(endgameTrainingScenario);
          drawBoardFromData(board);
        }

        computeLegal();
        
        if (isOnline) {
          // 🌐 UI para modo online (Funções de UI)
          setFace('idle'); // Mostra o rosto 🌐
          setBubbleVisibility(false); // Esconde falas
          setBubblePlaceholder(`Sala: ${currentRoom} | Aguardando jogada...`);
          
          // 🌐 PASSO 5 (JS): Aplicar orientação (Função de UI)
          ajustarOrientacao(getPlayerColor());
          
          // 🌐 Envia o tabuleiro inicial para o Supabase
          if (getPlayerColor() === WHITE) { // Só o dono da sala (Branco) envia o tabuleiro inicial
            enviarJogadaSupabase(null); // Envia o estado inicial
          }

        } else {
          // 💡 UI para modo IA (Funções de UI)
          // 🔁 Não fala 'start' se for modo treino
          if (!trainingMode) {
            setFace('idle'); 
            const diff = localStorage.getItem('difficulty') || 'medium';
            // No modo fácil, não confunda o usuário com mensagem de treinamento
            if(diff === 'easy') say("Modo fácil: calibrando nível humano.");
            else if(diff === 'master') say("Modo Grão-Mestre: nenhum erro será perdoado.");
            else say('start');
          } else {
            setFace('idle');
            say('thinking', 'Treino IA vs IA iniciado.');
          }
          ajustarOrientacao('white'); // Garante que vs IA esteja sempre normal
        }
      }
      
      // 🌐 Função para redesenhar o tabuleiro com base nos dados (usado no modo online)
      
// substitua inteira a função drawBoardFromData pelo código abaixo
function drawBoardFromData(newBoardData) {
  // Recebe um array[][] puro (retorno de deserializeBoard) e atualiza somente diferenças para evitar flicker.
  if (!newBoardData) return;
  board = Array.isArray(newBoardData) ? newBoardData : (newBoardData.board || newBoardData);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = squareEl(r, c);
      if (!sq) continue;

      const desired = board[r][c]; // null, "white", "red", "white-king", "red-king"
      const existing = sq.querySelector('.piece');

      // Se deveria estar vazio
      if (!desired) {
        if (existing) sq.innerHTML = '';
        continue;
      }

      const desiredPlayer = desired.startsWith(WHITE) ? WHITE : RED;
      const desiredIsKing = desired.endsWith(KING);

      // Se já tem peça igual, não mexe (evita flicker)
      if (existing) {
        const exPlayer = existing.dataset.player;
        const exIsKing = existing.classList.contains('king');
        if (exPlayer === desiredPlayer && exIsKing === desiredIsKing) continue;
      }

      // Caso mudou: troca a peça
      sq.innerHTML = '';
      const colorClass = desiredPlayer === WHITE ? P_BRANCA : P_VERMELHA;
      const el = createPiece(colorClass, desiredPlayer);
      if (desiredIsKing) el.classList.add('king');
      sq.appendChild(el);
    }
  }

  // Reforça orientação (caso alguém reconecte e o DOM seja recriado)
  if (isOnline) ajustarOrientacao(getPlayerColor());
}


function ouvirSala(codigo) {
  console.log("[online] ouvirSala:", codigo);

  // Garante cleanup obrigatório de canal anterior antes de tudo
  if (onlineUnsubscribe) {
    try { onlineUnsubscribe(); } catch (_) {}
    onlineUnsubscribe = null;
  }

  if (!window.supabase) {
    console.warn("[online] Supabase ainda não pronto.");
    setTimeout(() => ouvirSala(codigo), 500);
    return;
  }

  const supabase = window.supabase;

  if (onlineUnsubscribe) {
    try { onlineUnsubscribe(); } catch (_) {}
    onlineUnsubscribe = null;
  }

  async function carregarSalaAtual() {
    const { data, error } = await supabase
      .from("salas")
      .select("*")
      .eq("id", codigo)
      .maybeSingle();

    if (error) {
      console.error("[online] erro ao buscar sala:", error);
      return;
    }

    processarSalaSupabase(data);
  }

  function processarSalaSupabase(data) {
    console.log("[online] sala:", data);

    // 🐞 Guarda: se o usuário já saiu do modo online, ignora atualizações pendentes
    if (!isOnline || !currentRoom) {
      console.log("[online] ignorando atualização — modo offline ou sem sala");
      return;
    }

    if (!data) {
      console.warn("[online] sala ainda sem dados, aguardando...");
      return;
    }

    window.currentRoomData = data;
    currentRoom = codigo;

    if (data.status === "esperando") {
      setBubblePlaceholder(`Sala ${codigo} criada. Aguardando oponente...`);
      return;
    }

    if (data.status === "em_jogo" && !onlineStarted) {
      onlineStarted = true;

      showOverlay("🛰️<br/>Oponente conectado! Iniciando...", true);

      setTimeout(() => {
        showOverlay("", false);

        const menu = document.getElementById("menuContainer");
        if (menu) menu.style.display = "none";

        initBoard();
      }, 800);

      return;
    }

    if (data.tabuleiro && data.jogador_da_vez && document.getElementById("board").innerHTML) {
      const novoTabuleiro = data.tabuleiro;
      const novoCurrent = data.jogador_da_vez;

      if (serializeBoard(board) !== novoTabuleiro) {
        board = deserializeBoard(novoTabuleiro);
        current = novoCurrent;

        if (typeof drawBoardFromData === "function") {
          drawBoardFromData(board);
        } else {
          drawBoard();
        }

        try { sMove.play().catch(()=>{}); } catch (_) {}

        if (data.ultima_jogada?.type === "capture") {
          try { sCap.play().catch(()=>{}); } catch (_) {}
          if (typeof shakeBoard === "function") shakeBoard();
        }
      } else {
        current = novoCurrent;
      }

      computeLegal();

      const myColor = getPlayerColor();
      setBubblePlaceholder(
        current === myColor
          ? `Sala ${currentRoom} | Sua vez!`
          : `Sala ${currentRoom} | Vez do oponente...`
      );

      try { ajustarOrientacao(myColor); } catch (_) {}
    }

    if (data.status === "encerrado") {
      onGameOver(data.vencedor);
      if (onlineUnsubscribe) {
        try { onlineUnsubscribe(); } catch (_) {}
        onlineUnsubscribe = null;
      }
    }
  }

  carregarSalaAtual();

  const channel = supabase
    .channel("room:" + codigo)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "salas",
      filter: "id=eq." + codigo
    }, (payload) => {
      processarSalaSupabase(payload.new);
    })
    .subscribe((status) => {
      console.log("[online] realtime status:", status);
    });

  onlineUnsubscribe = () => {
    supabase.removeChannel(channel);
  };
}

      // 🌐 Envia a jogada para o Supabase
      async function enviarJogadaSupabase(mv) {
        if (!isOnline || !currentRoom) return;
        if (!window.supabase) {
          console.error("[online] Supabase não está inicializado.");
          return;
        }

        // 'current' aqui é o jogador QUE ACABOU de mover, exceto nos casos especiais abaixo.
        // Se mv for nulo (estado inicial) ou se mv.continuation estiver definido (captura múltipla em andamento),
        // não devemos alternar a vez, pois o mesmo jogador ainda deve jogar.
        // Caso contrário, alternamos para o outro jogador normalmente.
        const proximoJogador = (!mv || (mv && mv.continuation))
          ? current
          : ((current === WHITE) ? RED : WHITE);

        try {
          const { error } = await window.supabase
            .from("salas")
            .update({
              tabuleiro: serializeBoard(board),
              jogador_da_vez: proximoJogador,
              ultima_jogada: mv ? { from: mv.from, to: mv.to, type: mv.type } : null,
              atualizado_em: new Date().toISOString()
            })
            .eq("id", currentRoom);

          if (error) throw error;
          console.log("[online] jogada enviada. Próximo:", proximoJogador);
        } catch (error) {
          console.error("[online] erro ao enviar jogada:", error);
        }
      }
      
      // 🌐 Envia o fim de jogo para o Supabase
      async function enviarFimDeJogoSupabase(vencedor) {
        if (!isOnline || !currentRoom || getPlayerColor() !== WHITE) return; // Só o dono da sala (Branco) encerra
        if (!window.supabase) {
          console.error("[online] Supabase não está inicializado.");
          return;
        }

        try {
          const { error } = await window.supabase
            .from("salas")
            .update({
              status: "encerrado",
              vencedor: vencedor,
              atualizado_em: new Date().toISOString()
            })
            .eq("id", currentRoom);

          if (error) throw error;
          console.log("[online] fim de jogo enviado. Vencedor:", vencedor);
        } catch (error) {
          console.error("[online] erro ao enviar fim de jogo:", error);
        }
      }

      // 🌐 Funções de Sala (chamadas pela UI)
async function criarSalaSupabase(codigo, jogador1_uid) {
  console.log("[online] criar sala:", codigo);

  if (!window.supabase) {
    showOverlayError("Erro de conexão com Supabase.");
    return false;
  }

  await ensureAuthReady();

  const uid = jogador1_uid || window.userId;

  try {
    const { error } = await window.supabase.from("salas").insert({
      id: codigo,
      jogador1: uid,
      jogador2: null,
      tabuleiro: null,
      jogador_da_vez: WHITE,
      status: "esperando",
      vencedor: null,
      ultima_jogada: null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    });

    if (error) throw error;

    currentRoom = codigo;
    isOnline = true;
    onlineStarted = false;

    console.log("[online] sala criada:", codigo);
    return true;
  } catch (error) {
    console.error("[online] erro criar sala:", error);
    showOverlayError("Erro ao criar sala no Supabase.");
    return false;
  }
}
        
async function entrarSalaSupabase(codigo, jogador2_uid) {
  console.log("[online] entrar sala:", codigo);

  if (!window.supabase) {
    showOverlayError("Erro de conexão com Supabase.");
    return false;
  }

  await ensureAuthReady();

  const uid = jogador2_uid || window.userId;

  try {
    const { data, error } = await window.supabase
      .from("salas")
      .select("*")
      .eq("id", codigo)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      showOverlayError("Sala não encontrada!");
      return false;
    }

    if (data.jogador1 === uid) {
      showOverlayError("Você não pode entrar na própria sala.");
      return false;
    }

    if (data.status !== "esperando") {
      showOverlayError("Esta sala já está cheia ou encerrada.");
      return false;
    }

    const { error: updError } = await window.supabase
      .from("salas")
      .update({
        jogador2: uid,
        status: "em_jogo",
        atualizado_em: new Date().toISOString()
      })
      .eq("id", codigo);

    if (updError) throw updError;

    currentRoom = codigo;
    isOnline = true;
    onlineStarted = false;

    console.log("[online] entrou na sala:", codigo);
    return true;
  } catch (error) {
    console.error("[online] erro entrar sala:", error);
    showOverlayError("Erro ao entrar na sala.");
    return false;
  }
}

      /* ETAPA 4: onSquareClick (bloqueio de clique humano)
      */
      function onSquareClick(e){
        if (gameEnded) return;
        // 🌐 Se for online, só permite jogar se for a vez do jogador
        if (isOnline && current !== getPlayerColor()) {
          // Mostra mensagem sutil informando que é a vez do oponente
          setBubblePlaceholder(`Sala: ${currentRoom} | Vez do oponente...`);
          console.log("Não é sua vez!");
          return;
        }

        // 🧠 MODO TREINO: bloqueia totalmente o humano
        if (!isOnline && trainingMode) {
          console.log("Modo treino IA vs IA: movimentos manuais desativados.");
          return;
        }

        // Se for IA normal vs humano, só permite se for a vez do humano (WHITE)
        if (!isOnline && current === RED) {
          console.log("IA está jogando!");
          return;
        }
        
        const sq = e.currentTarget;
        const rr = +sq.dataset.r;
        const cc = +sq.dataset.c;
        // Converte coordenadas da visualização para coordenadas lógicas
        const [r, c] = viewToLogicalCoords(rr, cc);
        const piece = board[r][c];

        if(selected){
          // selected.r e selected.c já são coordenadas lógicas
          const mv = legal.find(m=> m.from[0]===selected.r && m.from[1]===selected.c && m.to[0]===r && m.to[1]===c);
          if(mv){ 
            applyMove(mv); 
            endTurn(mv); 
          }
          else{
            clearSelect(); // Helper de UI
            // Se clicou na própria peça, seleciona novamente
            if(piece && piece.startsWith(current)) selectPiece(sq,r,c); // Helper de UI
          }
        } else if(piece && piece.startsWith(current)){
          selectPiece(sq,r,c); // Helper de UI (r,c são lógicos)
        }
      }
      /* Fim da Etapa 4 */

      function promoteIfNeeded(r,c,el){
        const t=board[r][c];
        if(!t || t.endsWith(KING)) return;
        if((t===WHITE && r===0) || (t===RED && r===7)){
          board[r][c]=t+KING;
          if(el) el.classList.add('king');
          setFace('promo',{shake:true,pulse:true}); // Helper de UI
          // Usa contexto especial para promoção surpresa
          sayWithContext('surprisePromo');
        }
      }

            function applyMove(mv){
        const {from,to,type,jumped} = mv;
        const pieceEl = selected ? selected.el : squareEl(from[0],from[1])?.querySelector('div[data-player]');
        
        // 🌐 Correção: Se a peça não for encontrada (ex: outro jogador moveu), busca no DOM
        const pieceElFallback = squareEl(from[0],from[1])?.querySelector('div[data-player]');
        const finalPieceEl = pieceEl || pieceElFallback;
        
        const t = board[from[0]][from[1]];

        // 🔒 Regra: se a peça virar dama nesse lance, ela NÃO pode continuar capturando em seguida
        let promotedThisMove = false;
        if (t && !t.endsWith(KING)) {
          if ((t === WHITE && to[0] === 0) || (t === RED && to[0] === 7)) {
            promotedThisMove = true;
          }
        }
        
        // 💡 IMPLEMENTAÇÃO 2: Pega o hash ANTES de aplicar a jogada
        const hash = getBoardHash(board); 
        board[to[0]][to[1]] = t;
        board[from[0]][from[1]] = null;
        
        // Limpa a casa de origem
        const fromSq = squareEl(from[0],from[1]); // Helper de UI
        if (fromSq) fromSq.innerHTML = '';

        const toSq = squareEl(to[0],to[1]); // Helper de UI
        if(finalPieceEl && toSq) {
          toSq.innerHTML = ''; // Limpa a casa de destino (segurança)
          toSq.appendChild(finalPieceEl);
        }

        sMove.play().catch(()=>{});

        if(type==='capture'){
          const jSq = squareEl(jumped[0],jumped[1]); // Helper de UI
          // 🎨 Captura a cor da peça vítima antes de apagar
          const victimPiece = board[jumped[0]][jumped[1]];
          const victimColor = victimPiece && victimPiece.startsWith('white') ? 'white' : 'red';
          if(jSq){ board[jumped[0]][jumped[1]]=null; jSq.innerHTML=''; }

          // 🐞 CORREÇÃO: Adicionada verificação de 'toSq' antes de 'getBoundingClientRect'
          if (toSq) {
              const rect = toSq.getBoundingClientRect();
              explodeAt(rect.left+rect.width/2, rect.top+rect.height/2, victimColor); // Helper de UI
          }
          shakeBoard(); // Helper de UI
          sCap.play().catch(()=>{});
          setFace('capture',{shake:true}); // Helper de UI
          say('capture'); // Helper de UI
        }

        // 🔄 Contador de jogadas sem captura (para detectar empate técnico)
        if (typeof window.noCaptureCount !== 'number') window.noCaptureCount = 0;
        // Zera se houve captura OU promoção (sem progresso não conta)
        if (type === 'capture' || promotedThisMove) {
          window.noCaptureCount = 0;
        } else {
          window.noCaptureCount++;
        }

        // 🧠 ETAPA 2: Registrar jogada no histórico (ATUALIZADO)
        const { w, r } = countPieces();
        gameHistory.push({
          player: current, // 'current' é o jogador que ACABOU de mover
          move: mv,
          hash: hash, // 💡 IMPLEMENTAÇÃO 2: Salva o hash do tabuleiro *antes* da jogada (AGORA ZOBRIST BIGINT)
          white: w,
          red: r,
          diff: r - w, // vantagem da IA (positivo = IA à frente)
          time: Date.now()
        });

        // Marca no objeto de movimento se houve promoção
        if (promotedThisMove) {
          mv.promoted = true;
        }

        promoteIfNeeded(to[0],to[1],finalPieceEl);
        // 🌐 Reaplica a orientação após mover a peça no modo online
        if (isOnline) {
          try {
            ajustarOrientacao(getPlayerColor());
          } catch (_) {}
        }
        clearSelect(); // Helper de UI

        // 🔒 Verifica se o jogo acabou após a jogada
        if (verificarFimDeJogoForcado()) return;
      }

      function contarPecas(player) {
        let total = 0;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.startsWith(player)) total++;
          }
        }
        return total;
      }

      function verificarFimDeJogoForcado() {
        if (gameEnded) return true;

        const brancas = contarPecas(WHITE);
        const vermelhas = contarPecas(RED);

        if (brancas === 0) {
          onGameOver(RED);
          return true;
        }

        if (vermelhas === 0) {
          onGameOver(WHITE);
          return true;
        }

        const movimentosBranco = allMoves(WHITE, board);
        const movimentosVermelho = allMoves(RED, board);

        if (movimentosBranco.length === 0) {
          onGameOver(RED);
          return true;
        }

        if (movimentosVermelho.length === 0) {
          onGameOver(WHITE);
          return true;
        }

        return false;
      }

            function endTurn(mv){
        // 🔒 Verifica se o jogo já acabou antes de processar a vez
        if (verificarFimDeJogoForcado()) return;

        // 🔒 Regra: se a peça acabou de ser promovida nesse lance,
        // NÃO é permitido continuar capturando na mesma jogada.
        if (mv && mv.promoted) {
          if (isOnline) {
            enviarJogadaSupabase(mv);
          }
          switchPlayer();
          return;
        }

        // 🌐 Se for online, envia a jogada (APÓS a captura múltipla ser checada)
        let isMultiCapture = false;

        if(mv.type==='capture'){
          const more = followUpCaptures(board, mv.to[0], mv.to[1], current);
          if(more.length){
            isMultiCapture = true; // 🌐 Marca como captura múltipla
            // 🔁 Marca a jogada como continuação para que o servidor não alterne a vez
            try { mv.continuation = true; } catch(_){ /* ignore se não for objeto */ }
            legal = more;
            
            // 🌐 Lógica de captura múltipla online/offline
            const myColor = getPlayerColor();
            // 🔁 MODO TREINO: A IA continua jogando por qualquer lado
            if (trainingMode) {
              setTimeout(()=> aiMove(more), trainingSpeed);
            } else if ((!isOnline && current === WHITE) || (isOnline && current === myColor)) {
              // É a vez do jogador local (Humano vs IA ou Jogador Online)
              const sq = squareEl(mv.to[0], mv.to[1]); // Helper de UI
              setTimeout(()=> selectPiece(sq, mv.to[0], mv.to[1]), 60); // Helper de UI
            } else if (!isOnline && current === RED) {
              // É a vez da IA (Modo normal)
              setTimeout(()=> aiMove(more), 250);
            }
            // 🌐 Se for online e for a vez do oponente, não faz nada, só espera a próxima jogada dele
            
          }
        }
        
        // 🌐 Se não for captura múltipla, troca o jogador
        if (!isMultiCapture) {
          // 🌐 Se for online, envia a jogada final (or única)
          if (isOnline) {
            enviarJogadaSupabase(mv);
          }
          switchPlayer();
        } else {
          // 🌐 Se for online E for uma captura múltipla, envia o estado *intermediário*
          if (isOnline) {
            // Não troca o jogador, mas atualiza o tabuleiro
            enviarJogadaSupabase(mv);
          }
        }
      }


      /* ETAPA 5: switchPlayer (lógica do modo treino)
      */
      function switchPlayer() {
        current = (current === WHITE) ? RED : WHITE;
        computeLegal();

        // === REGRAS DE EMPATE (somente modo local/treino) ===
        if (!isOnline) {
          try {
            // 3️⃣ Empate por material insuficiente: apenas 1 dama branca vs 1 dama vermelha
            const { w, r } = countPieces();
            if (w === 1 && r === 1) {
              let whiteKings = 0, redKings = 0, normals = 0;
              for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                  const v = board[i][j];
                  if (!v) continue;
                  if (v === WHITE || v === RED) normals++;
                  if (v === WHITE + KING) whiteKings++;
                  if (v === RED + KING) redKings++;
                }
              }
              if (normals === 0 && whiteKings === 1 && redKings === 1) {
                window.drawReason = 'material';
                onGameOver(null);
                return;
              }
            }

            // 2️⃣ Empate por repetição de posição (3x mesma posição + vez de jogar)
            if (typeof getBoardHash === 'function') {
              const hash = getBoardHash(board);
              const key = hash.toString() + '|' + current;
              if (!window.positionRepetition) window.positionRepetition = {};
              const prev = window.positionRepetition[key] || 0;
              const next = prev + 1;
              window.positionRepetition[key] = next;
              if (next >= 3) {
                window.drawReason = 'repetition';
                onGameOver(null);
                return;
              }
            }

            // 1️⃣ Empate por 20 lances de cada lado (40 movimentos) sem captura/promoção
            if (typeof window.noCaptureCount === 'number' && window.noCaptureCount >= 40) {
              window.drawReason = 'noProgress';
              onGameOver(null);
              return;
            }
          } catch (e) {
            console.warn('Empate técnico: falha leve ignorada.', e);
          }
        }

        if (isOnline) {
          // 🌐 Lógica Online
          const myColor = getPlayerColor();
          if (current === myColor) {
            setBubblePlaceholder(`Sala: ${currentRoom} | Sua vez!`); // Helper de UI
          } else {
            setBubblePlaceholder(`Sala: ${currentRoom} | Vez do oponente...`); // Helper de UI
          }
        } else {
          // 💡 Lógica vs IA / Treino

          // 🔁 MODO TREINO: IA joga pelos dois lados
          if (trainingMode) {
            if (legal.length > 0) {
              setTimeout(() => aiMove(), trainingSpeed);
            }
            return;
          }

          // 🎮 MODO NORMAL: humano (WHITE) x IA (RED)
          if (current === WHITE) {
            startProvokeTimer(); // provocações da IA esperando o humano
          }
          if (current === RED && legal.length > 0) {
            aiMove();
          }
        }
      }
      /* Fim da Etapa 5 */

      function computeLegal(){
        const all = allMoves(current, board);
        legal = filterMandatoryWithMaxChain(board, current, all);
        // No modo online, só detecta fim de jogo se o tabuleiro já tiver peças
        // (evita falso "fim de jogo" antes do initBoard concluir)
        if(legal.length===0 && current!==null){
          if (isOnline) {
            const { w, r } = countPieces();
            if (w === 0 && r === 0) return; // tabuleiro vazio = jogo não iniciado
          }
          const winner = (current===WHITE)? RED : WHITE;
          onGameOver(winner);
        }
      }

      // ✅ FUNÇÃO ONGAMEOVER (MODIFICADA PARA CHAMAR ANÁLISE)

let rankingJaPontuouNaPartida = false;
let iaJaAprendeuNaPartida = false;
let livroJaAtualizouNaPartida = false;

function getDificuldadeAtualIA() {
  return (
    localStorage.getItem("difficulty") ||
    document.getElementById("difficulty")?.value ||
    "medium"
  ).toLowerCase();
}

function podeTreinarIA() {
  if (isOnline || isMultiplayer) return false;

  // IA vs IA sempre é treino nobre
  if (trainingMode || isTrainingMode) return true;

  const diff = getDificuldadeAtualIA();

  // Só hard/master ensinam a inteligência global
  return diff === "hard" || diff === "master";
}

function getPontosRankingPorDificuldade(resultado) {
  const diff = (localStorage.getItem("difficulty") || document.getElementById("difficulty")?.value || "medium").toLowerCase();

  const tabela = {
    easy:   { win: 5,  loss: -5,  draw: 2 },
    medium: { win: 10, loss: -8,  draw: 2 },
    hard:   { win: 18, loss: -12, draw: 2 },
    master: { win: 30, loss: -15, draw: 2 }
  };

  return tabela[diff]?.[resultado] ?? tabela.medium[resultado] ?? 0;
}

async function registrarLivroAberturaAutomatico(winner) {
  try {
    if (livroJaAtualizouNaPartida) return;
    if (!podeTreinarIA()) {
      console.log("📚 Livro não atualizou: modo atual só usa conhecimento.", {
        dificuldade: getDificuldadeAtualIA(),
        trainingMode,
        isOnline,
        isMultiplayer
      });
      return;
    }
    if (!window.supabase) return;
    if (!Array.isArray(gameHistory) || gameHistory.length < 4) return;

    // Por seguranca: so salva abertura quando a IA vermelha ganhou.
    // Se ela perdeu, nao vamos ensinar jogada ruim ao livro.
    if (winner !== RED) return;

    const totalLancesPartida = Array.isArray(gameHistory) ? gameHistory.length : 999;

    // Vitoria rapida vale mais para o livro.
    // Se a IA venceu em poucos lances, provavelmente a abertura foi forte.
    const pesoVitoria = totalLancesPartida <= 24 ? 2 : 1;

    livroJaAtualizouNaPartida = true;

    const dificuldadeAtual = document.getElementById("difficulty")?.value || "medium";
    const dificuldadeLivro = dificuldadeAtual === "master" ? "master" : "universal";

    const jogadasDeAberturaIA = gameHistory
      .filter(h =>
        h &&
        h.player === RED &&
        h.hash !== undefined &&
        h.hash !== null &&
        h.move &&
        Array.isArray(h.move.from) &&
        Array.isArray(h.move.to)
      )
      .slice(0, 6);

    if (!jogadasDeAberturaIA.length) return;

    for (const h of jogadasDeAberturaIA) {
      const chave = String(h.hash).replace(/n$/, "");

      const fromRow = Number(h.move.from[0]);
      const fromCol = Number(h.move.from[1]);
      const toRow = Number(h.move.to[0]);
      const toCol = Number(h.move.to[1]);

      const { data: existente, error: erroBusca } = await window.supabase
        .from("aberturas")
        .select("*")
        .eq("zobrist_hash", chave)
        .eq("from_row", fromRow)
        .eq("from_col", fromCol)
        .eq("to_row", toRow)
        .eq("to_col", toCol)
        .eq("dificuldade", dificuldadeLivro)
        .maybeSingle();

      if (erroBusca) throw erroBusca;

      if (existente) {
        const novasVitorias = Number(existente.vitorias_vermelho || 0) + pesoVitoria;

        const { error: erroUpdate } = await window.supabase
          .from("aberturas")
          .update({
            vitorias_vermelho: novasVitorias
          })
          .eq("zobrist_hash", chave)
          .eq("from_row", fromRow)
          .eq("from_col", fromCol)
          .eq("to_row", toRow)
          .eq("to_col", toCol)
          .eq("dificuldade", dificuldadeLivro);

        if (erroUpdate) throw erroUpdate;
      } else {
        const { error: erroInsert } = await window.supabase
          .from("aberturas")
          .insert({
            zobrist_hash: chave,
            from_row: fromRow,
            from_col: fromCol,
            to_row: toRow,
            to_col: toCol,
            dificuldade: dificuldadeLivro,
            nome_abertura: `Auto-${dificuldadeLivro}`,
            vitorias_vermelho: pesoVitoria,
            vitorias_branco: 0
          });

        if (erroInsert) throw erroInsert;
      }
    }

    console.log("Livro de abertura atualizado:", {
      dificuldade: dificuldadeLivro,
      jogadas: jogadasDeAberturaIA.length,
      pesoVitoria,
      totalLancesPartida
    });

  } catch (e) {
    console.error("Erro ao atualizar livro de abertura:", e);
  }
}

async function registrarAprendizadoIAPosPartida(winner) {
  try {
    if (iaJaAprendeuNaPartida) return;
    if (!podeTreinarIA()) {
      console.log("🧠 IA não treinou: dificuldade atual apenas consome sabedoria.", {
        dificuldade: getDificuldadeAtualIA(),
        trainingMode,
        isOnline,
        isMultiplayer
      });
      return;
    }
    if (!window.supabase) return;
    if (!Array.isArray(gameHistory) || gameHistory.length < 4) return;

    iaJaAprendeuNaPartida = true;

    let resultadoIA = "draw";
    if (winner === RED) resultadoIA = "win";
    if (winner === WHITE) resultadoIA = "loss";

    const fator =
      resultadoIA === "win" ? 0.08 :
      resultadoIA === "loss" ? -0.08 :
      0.01;

    const jogadasIA = gameHistory
      .filter(h => h.player === RED && h.hash !== undefined && h.hash !== null)
      .slice(-8);

    if (!jogadasIA.length) return;

    for (const h of jogadasIA) {
      const chave = String(h.hash).replace(/n$/, "");

      const { data: memoriaAtual, error: erroBusca } = await window.supabase
        .from("memoria_ia")
        .select("chave, tipo, cor, dados")
        .eq("chave", chave)
        .eq("cor", RED)
        .maybeSingle();

      if (erroBusca) throw erroBusca;

      const dadosAntigos = memoriaAtual?.dados || {};
      const confidenceAntiga = Number(dadosAntigos.confidence ?? 0.5);
      const vezesVistoAntigo = Number(dadosAntigos.vezes_visto ?? 0);

      const confidenceNova = Math.max(
        0.05,
        Math.min(0.95, confidenceAntiga + fator)
      );

      const dadosNovos = {
        ...dadosAntigos,
        confidence: Number(confidenceNova.toFixed(3)),
        vezes_visto: vezesVistoAntigo + 1,
        ultimo_resultado: resultadoIA,
        ultima_jogada: h.move || null,
        diff_material: h.diff ?? null,
        white: h.white ?? null,
        red: h.red ?? null,
        atualizado_por: "aprendizado_pos_partida",
        atualizado_em: new Date().toISOString()
      };

      const { error: erroUpsert } = await window.supabase
        .from("memoria_ia")
        .upsert({
          chave,
          tipo: "pattern",
          cor: RED,
          dados: dadosNovos,
          atualizado_em: new Date().toISOString()
        }, { onConflict: "chave" });

      if (erroUpsert) throw erroUpsert;
    }

    console.log("🧠 IA aprendeu com a partida:", {
      resultadoIA,
      padroes: jogadasIA.length
    });
    
    // 🐝 COLMEIA: só professores alimentam o cérebro coletivo
    if (podeTreinarIA()) {
      const resultadoFinal =
        resultadoIA === "win"  ? "ia_win" :
        resultadoIA === "loss" ? "player_win" :
        "draw";

      setTimeout(() => {
        enviarPesosColmeia(
          resultadoFinal,
          jogadasIA.length || gameHistory?.length || 0
        );
      }, 800);
    }

  } catch (e) {
    console.error("Erro no aprendizado pós-partida da IA:", e);
  }
}

async function salvarTreinoFinalNoBanco(winner) {
  try {
    if (!endgameTrainingMode) return;
    if (!window.supabase) return;
    if (!Array.isArray(gameHistory) || !gameHistory.length) return;

    const resultado =
      winner === RED ? "red_win" :
      winner === WHITE ? "white_win" :
      "draw";

    const totalPecas = board.flat().filter(Boolean).length;
    const estado = stringifyWithBigInt(board);

    const rows = gameHistory
      .filter(m => m?.from && m?.to)
      .slice(-12)
      .map(m => ({
        zobrist_hash: String(getBoardHash(board)).replace(/n$/, ""),
        estado_tabuleiro: estado,
        scenario: endgameTrainingScenario || "random",
        total_pecas: totalPecas,
        resultado,
        from_row: m.from[0],
        from_col: m.from[1],
        to_row: m.to[0],
        to_col: m.to[1],
        peso: resultado === "draw" ? 0.3 : 1,
        origem: "treino_final"
      }));

    if (!rows.length) return;

    const { error } = await window.supabase
      .from("endgame_patterns")
      .insert(rows);

    if (error) {
      console.warn("♟️ Erro ao salvar treino de final:", error.message);
      return;
    }

    console.log("♟️ Treino de final salvo no banco:", rows.length, "padrões");

  } catch (e) {
    console.warn("♟️ Falha leve ao salvar final:", e);
  }
}

async function registrarResultadoRankingVsIA(winner) {
  try {
    if (rankingJaPontuouNaPartida) return;
    if (isOnline || trainingMode) return;
    if (!window.supabase || !window.userId) return;

    rankingJaPontuouNaPartida = true;

    let resultado = "draw";
    if (winner === WHITE) resultado = "win";
    if (winner === RED) resultado = "loss";

    const pontos = getPontosRankingPorDificuldade(resultado);

    const { data: perfil, error: erroBusca } = await window.supabase
      .from("profiles")
      .select("id, username, rating, wins, losses, draws")
      .eq("id", window.userId)
      .maybeSingle();

    if (erroBusca) throw erroBusca;

    const ratingAtual = Number(perfil?.rating ?? 1000);
    const novoRating = Math.max(0, ratingAtual + pontos);

    const wins = Number(perfil?.wins ?? 0) + (resultado === "win" ? 1 : 0);
    const losses = Number(perfil?.losses ?? 0) + (resultado === "loss" ? 1 : 0);
    const draws = Number(perfil?.draws ?? 0) + (resultado === "draw" ? 1 : 0);

    const username = perfil?.username || window.playerName || localStorage.getItem("player_name") || "Jogador";

    const { error: erroUpdate } = await window.supabase
      .from("profiles")
      .upsert({
        id: window.userId,
        username,
        rating: novoRating,
        wins,
        losses,
        draws
      }, { onConflict: "id" });

    if (erroUpdate) throw erroUpdate;

    console.log("🏆 Ranking atualizado:", {
      resultado,
      pontos,
      ratingAnterior: ratingAtual,
      ratingNovo: novoRating,
      wins,
      losses,
      draws
    });

  } catch (e) {
    console.error("Erro ao atualizar ranking:", e);
  }
}

      function onGameOver(winner){

// === EMPATE PROFISSIONAL: Regras avançadas (painel) ===
if (window.drawReason) {
        registrarResultadoRankingVsIA(null);
        registrarAprendizadoIAPosPartida(null);
        // Marca fim de jogo
        gameEnded = true;
        lockInteraction(true);
        clearAllTimeouts();
        current = null;

        // Esconde menus flutuantes
        showOptionsButton(false);
        if (typeof showMenuFlutuante === 'function') {
          showMenuFlutuante(false);
        }

        // Mensagem de empate em overlay profissional
        let overlayMsg = "🤝 EMPATE!<br/>Partida encerrada sem vencedor.";
        if (window.drawReason === 'noProgress') {
          overlayMsg = "🤝 EMPATE TÉCNICO<br/>20 lances de cada lado sem capturas nem promoções.<br/><span style='font-size:11px;opacity:.8'>Nenhum dos dois arriscou além do limite. Equilíbrio total.</span>";
        } else if (window.drawReason === 'repetition') {
          overlayMsg = "🤝 EMPATE POR REPETIÇÃO<br/>A mesma posição se repetiu 3 vezes com a mesma vez de jogar.<br/><span style='font-size:11px;opacity:.8'>Loop detectado. Sistema encerrou a partida com justiça.</span>";
        } else if (window.drawReason === 'material') {
          overlayMsg = "🤝 EMPATE POR MATERIAL INSUFICIENTE<br/>Apenas uma dama branca contra uma dama vermelha.<br/><span style='font-size:11px;opacity:.8'>Matematicamente empatado. Só venceria com erro grosseiro.</span>";
        }

        // Exibe painel de fim de jogo (overlay)
        showOverlay(overlayMsg, true);

        setTimeout(() => {
          showOverlay("", false);
        }, 4000);

        setTimeout(() => {
          if (typeof openAnalysisModal === "function") {
            openAnalysisModal([
              "Partida encerrada em empate.",
              "O sistema detectou uma condição sem vantagem real para nenhum lado.",
              "Esse resultado foi registrado como equilíbrio técnico da posição."
            ], "neutral");
          }
        }, 5000);

        // Opcional: fala leve da IA (apenas modo IA local)
        if (!isOnline && !trainingMode && typeof say === 'function') {
          setTimeout(() => {
            say("draw");
          }, 1500);
        }

        // Limpa motivo para futuros jogos
        if (endgameTrainingMode) {
          salvarTreinoFinalNoBanco(null);
        }

        window.drawReason = null;
        return;
}

        gameEnded = true; lockInteraction(true); clearAllTimeouts(); current = null;

        registrarResultadoRankingVsIA(winner);
        registrarAprendizadoIAPosPartida(winner);
        salvarTreinoFinalNoBanco(winner);
        if (!endgameTrainingMode) {
          registrarLivroAberturaAutomatico(winner);
        }

        // 🐝 ALIMENTAR COLMEIA: só professores (hard/master) ensinam
        const dificuldadeAtual = getDificuldadeAtualIA();
        const resultadoFinal = (winner === RED) ? 'ia_win' : (winner === WHITE ? 'player_win' : 'draw');
        if (!endgameTrainingMode) {
          alimentarColmeia(gameHistory, resultadoFinal, dificuldadeAtual);
        } else {
          console.log("♟️ Treino de final: não envia para colmeia geral ainda.");
        }

        // 🔁 Modo TREINO (IA vs IA): fluxo focado em estatísticas e looping opcional
        if (trainingMode) {
          // Esconde opções e menu flutuante
          showOptionsButton(false);
          if (typeof showMenuFlutuante === 'function') {
            showMenuFlutuante(false);
          }

          // Atualiza estatísticas da sessão de treino
          try {
            if (!trainingSessionStats) {
              trainingSessionStats = { games: 0, redWins: 0, whiteWins: 0 };
            }
            trainingSessionStats.games = (trainingSessionStats.games || 0) + 1;
            if (winner === RED) {
              trainingSessionStats.redWins = (trainingSessionStats.redWins || 0) + 1;
            } else if (winner === WHITE) {
              trainingSessionStats.whiteWins = (trainingSessionStats.whiteWins || 0) + 1;
            }
            if (typeof updateTrainingHud === 'function') {
              updateTrainingHud();
            }

            // 💾 Atualiza também o perfil global da IA vermelha durante o treino (modo aprendiz)
            try {
              if (typeof updateSingleAIProfile === 'function') {
                const isRedWinner = (winner === RED);
                // Não aguardamos (fire-and-forget) para não travar o loop visual
                updateSingleAIProfile('red', isRedWinner);
              }
            } catch (e2) {
              console.warn('Erro ao atualizar perfil da IA durante treino:', e2);
            }
          } catch (e) {
            console.warn('Erro ao atualizar estatísticas de treino:', e);
          }

          const hasTarget = (typeof trainingTargetGames === 'number' && trainingTargetGames > 0);
          const reachedTarget = hasTarget && trainingSessionStats.games >= trainingTargetGames;

          // Se temos alvo de partidas e ainda não atingiu, reinicia diretamente outra partida de treino
          if (hasTarget && !reachedTarget) {
            setTimeout(() => {
              try { showOverlay("", false, true); } catch(_) {}
              gameEnded = false;
              lockInteraction(false);
              clearAllTimeouts();
              if (typeof initBoard === 'function') {
                initBoard();
                setTimeout(() => aiMove(), trainingSpeed);
              }
            }, 200);
            return;
          }

          // Treino concluído (ou partida única, ou atingiu o alvo de partidas)
          let overlayHtml = `<div class="text-lg font-bold text-slate-200">🏁 Treino IA vs IA concluído.</div>`;
          if (hasTarget) {
            const total = trainingSessionStats.games || 0;
            const redWins = trainingSessionStats.redWins || 0;
            const wr = total > 0 ? ((redWins / Math.max(1, total)) * 100).toFixed(1).replace('.', ',') : '--';
            overlayHtml = `
              <div class="text-sm text-slate-200">
                <div class="font-semibold mb-1">🏁 Treino IA vs IA concluído.</div>
                <div class="text-xs text-slate-400">
                  Partidas: ${total} • Vitórias IA vermelha: ${redWins} • Winrate no treino: ${wr}%
                </div>
              </div>
            `;
          }

          showOverlay(overlayHtml, true);

          setTimeout(() => {
            showOverlay("", false);
            // Ao finalizar, volta especificamente para o menu de treino
            if (typeof returnToTrainingMenu === 'function') {
              returnToTrainingMenu();
            } else {
              // fallback: volta para o menu principal
              returnToMenu();
            }
            if (typeof removeTrainingHud === 'function') {
              removeTrainingHud();
            }
            // Reseta alvo de treino para próxima sessão
            trainingTargetGames = null;
            endgameTrainingMode = false;
            endgameTrainingScenario = 'random';
            // Salva a inteligência global ao final do lote de treino
            try { salvarInteligenciaIA().catch(() => {}); } catch(_) {}
          }, 2000);

          return;
        }

        // 🌐 Se for online, envia o resultado (só o host/branco)
        if (isOnline && getPlayerColor() === WHITE) {
          enviarFimDeJogoSupabase(winner);
        }
        
        // 🌐 Para de ouvir a sala
        if (onlineUnsubscribe) {
          onlineUnsubscribe();
          onlineUnsubscribe = null;
        }
        currentRoom = null; // Reseta a sala
        
        // 🧠 Esconde o botão de opções (⋮) com fade (Helper de UI)
        showOptionsButton(false);
        showMenuFlutuante(false);

        current = null;
        const { w, r } = countPieces();
        const diff = r - w;
        let overlayMsg = "";

        if (winner === RED) { // 🌐 VERMELHO VENCEU
          if (!isOnline) { // Lógica da IA
            stats.losses++;
            localStorage.setItem('damasStats', JSON.stringify(stats));
            // 🔁 Mensagem de Fim de Jogo no modo treino
            overlayMsg = trainingMode ? "🤖 VENCEU 🏆<br/>(IA Vermelha)" : "🤖♟️ <br/> IA VENCEU. Fim de jogo.";
            setFace('win', { ahead: true }); // Helper de UI
            if (!trainingMode) say('win'); // Helper de UI
            sLose.play().catch(() => {});

            // 💬 Pós-jogo: provocações e análises técnicas (IA VENCEU)
            // 🔁 Desativado no modo treino
            if (!trainingMode) {
              setTimeout(() => {
                say("win");
                setTimeout(() => say("thinking"), 5000);
              }, 1500);
            }
            
          } else { // 🌐 Lógica Online (Vermelho venceu)
            if (getPlayerColor() === RED) {
              overlayMsg = "🏆👏 <br/> VOCÊ VENCEU! (Vermelho)";
              sWin.play().catch(() => {});
            } else {
              overlayMsg = "💔😔 <br/> VOCÊ PERDEU. (Branco)";
              sLose.play().catch(() => {});
            }
          }
        } else { // 🌐 BRANCO VENCEU
          if (!isOnline) { // Lógica da IA
            stats.wins++;
            localStorage.setItem('damasStats', JSON.stringify(stats));
            // 🔁 Mensagem de Fim de Jogo no modo treino
            overlayMsg = trainingMode ? "🏆 VENCEU 🏆<br/>(IA Branca)" : "🏆👏 <br/> VOCÊ VENCEU! Parabéns.";
            setFace('lose', { behind: true, shake: true }); // Helper de UI
            if (!trainingMode) say('lose'); // Helper de UI
            sWin.play().catch(() => {});

            // 💬 Pós-jogo: provocações e análises técnicas (JOGADOR VENCEU)
            // 🔁 Desativado no modo treino
            if (!trainingMode) {
              setTimeout(() => {
                say("lose");
                setTimeout(() => say("thinking"), 5000);
              }, 1500);
            }
            
          } else { // 🌐 Lógica Online (Branco venceu)
            if (getPlayerColor() === WHITE) {
              overlayMsg = "🏆👏 <br/> VOCÊ VENCEU! (Branco)";
              sWin.play().catch(() => {});
            } else {
              overlayMsg = "💔😔 <br/> VOCÊ PERDEU. (Vermelho)";
              sLose.play().catch(() => {});
            }
          }
        }

        // IMPLEMENTAÇÃO 7: IA "aprende" com o resultado (só no modo IA)
        if (!isOnline) {
          updateAIProfile(winner);
          // 🧠 Ajuste adicional via heurística neural (brancas e vermelhas)
          adjustNeuralWeights(winner);
          // 🧠 NOVO: Ajuste de pesos de fim de jogo (se aplicável)
          adjustEndgameWeights(winner);
          // Salva a inteligência global após cada partida local (humano vs IA)
          try { salvarInteligenciaIA(); } catch(_) {}
        }

        // 🧠 ETAPA 4: Salva partida no histórico e Gera análise (só no modo IA)
        if (!isOnline) {
          matchHistory.push({ winner, date: new Date().toISOString(), moves: gameHistory });
          if (matchHistory.length > 3) matchHistory.shift(); // mantém apenas as 3 últimas
          localStorage.setItem('matchHistory', stringifyWithBigInt(matchHistory));
        }
        
        const feedback = analyzeMatch(gameHistory, winner);

        // 💡 IMPLEMENTAÇÃO 2: Envia histórico para worker memorizar padrões (só no modo IA)
        if (!isOnline && worker) {
            worker.postMessage({ 
                action: 'memorize', 
                history: gameHistory, // Envia o histórico com hashes
                winner: winner // 🧠 ENVIA O VENCEDOR
                // 🐞 CORREÇÃO: 'result' removido, 'winner' é mais claro
                // result: (winner === RED ? 'win' : 'lose') 
            });
        }

        // Mostra a tela de fim de jogo (overlay) (Helper de UI)
        showOverlay(overlayMsg, true);

        // 🎬 Efeito de transição: Mostra overlay, DEPOIS mostra análise
        // 🔹 Evita atraso e falha em dispositivos móveis
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
          // exibe análise mais rápido, sem fade
          setTimeout(() => {
            showOverlay("", false, true); // Helper de UI (force remove)
            openAnalysisModal(feedback, (winner===WHITE ? 'positive' : 'negative')); // Helper de UI
          }, 1200);
        } else {
          // mantém transição no desktop
          setTimeout(() => {
            showOverlay("", false); // Helper de UI (fade out)
          }, 3000);
          setTimeout(() => {
            openAnalysisModal(feedback, (winner===WHITE ? 'positive' : 'negative')); // Helper de UI
          }, 4000);
        }
      }
      /*************************
       * Geração de lances
       *************************/
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
            // ==========================================================
            // ✅ INÍCIO DA CORREÇÃO (game-core.js) - Aplicando sua lógica
            // ==========================================================
            const forward = (player===WHITE)? -1 : 1;
            
            // 1. Cálculo das casas (feito uma vez)
            const nr=r+dr, nc=c+dc; // Casa intermediária (ou de movimento)
            const lr=r+dr*2, lc=c+dc*2; // Casa de destino (captura)

            // 2. Movimento simples (só para frente)
            if(dr===forward){
              if(inB(nr,nc) && b[nr][nc]===null){
                res.push({from:[r,c],to:[nr,nc],type:'move'});
              }
            }
            
            // 3. Captura (MODIFICADO PARA REGRA)
            // Checa a regra salva no localStorage
            const rule = getCaptureRule();
            const isForwardCapture = (dr === forward);

            if (rule === 'sim' || (rule === 'nao' && isForwardCapture)) {
              // Se a regra é "sim" (pode tudo) 
              // OU Se a regra é "nao" E a captura é para frente
              
              // Checa limites de ambas as casas ANTES de checar o conteúdo.
              if (inB(nr, nc) && inB(lr, lc)) {
                // Ambas estão dentro, checa a lógica de captura
                if(b[nr][nc] && b[nr][nc].startsWith(opp) && b[lr][lc]===null){
                  res.push({from:[r,c],to:[lr,lc],type:'capture',jumped:[nr,nc]});
                }
              }
            }
            // ==========================================================
            // ✅ FIM DA CORREÇÃO
            // ==========================================================
          }
        }
        return res;
      }

      function simulate(b, mv){
        // *** OTIMIZAÇÃO B (Clone Manual - Frontend) ***
        // const nb = structuredClone(b); // <-- Lento
        const nb = cloneBoard(b); // <-- Rápido
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
      /* Fim do bloco reintroduzido */
      
      /*************************
       * Edge Function (IA híbrida cloud + local)
       *************************/
      function boardToEdgeString(b) {
        try {
          return (b || board || []).map(row =>
            row.map(cell => {
              if (!cell) return '0';
              if (cell === WHITE) return 'w';
              if (cell === RED) return 'r';
              if (cell === WHITE + KING) return 'W';
              if (cell === RED + KING) return 'R';
              return '0';
            }).join('')
          ).join('|');
        } catch (e) {
          console.warn('Falha ao serializar board para Edge:', e);
          return '';
        }
      }

      function getCurrentZobristForEdge() {
        try {
          if (typeof hashBoard === 'function') return String(hashBoard(board));
          if (typeof computeZobristHash === 'function') return String(computeZobristHash(board));
          if (window.currentZobrist) return String(window.currentZobrist);
        } catch (e) {
          console.warn('Falha ao calcular zobrist para Edge:', e);
        }
        return null;
      }

      async function consultarEdgeIA({ boardString, legalMoves, zobrist, difficulty, playerColor }) {
        try {
          const res = await fetch("https://ynhlhdluafgmujfkrnlz.supabase.co/functions/v1/ia-think", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaGxoZGx1YWZnbXVqZmtybmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTkwMDQsImV4cCI6MjA5MzIzNTAwNH0.KT3HNLJ4pSZChBNroOrZtJGU55xMKaxAnoI6ZhOKkbM",
              "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaGxoZGx1YWZnbXVqZmtybmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTkwMDQsImV4cCI6MjA5MzIzNTAwNH0.KT3HNLJ4pSZChBNroOrZtJGU55xMKaxAnoI6ZhOKkbM"
            },
            body: JSON.stringify({
              board: boardString,
              legal: legalMoves || [],
              zobrist,
              difficulty,
              playerColor
            })
          });

          if (!res.ok) {
            console.warn('Edge IA respondeu erro:', res.status, await res.text());
            return null;
          }

          return await res.json();
        } catch (e) {
          console.warn('Edge IA indisponível, usando worker local:', e);
          return null;
        }
      }

      /*************************
       * IA via Web Worker
       *************************/
      
      // 🎚️ PASSO 1: Define a profundidade máxima de busca conforme a dificuldade
      function getDepthByDifficulty() {
  const diff = localStorage.getItem('difficulty') || 'medium';
  switch (diff) {
    case 'easy':   return 3;   // Fácil: visão curta, comete mais erros
    case 'medium': return 6;   // Médio: padrão
    case 'hard':   return 9;   // Difícil: vê bem mais lances à frente
    case 'master': return 11;  // Mestre / Implacável: profundidade máxima (otimizado para não travar)
    default:       return 6;
  }
}

      
      async function initWorker(){
        try {
          const response = await fetch('worker-code.js');
          const code = await response.text();
          if (!code) {
            console.error("Falha ao carregar o script do Worker (resposta vazia)!");
            return;
          }

          const blob = new Blob([code], {type:'application/javascript'});
          worker = new Worker(URL.createObjectURL(blob));

          worker.onmessage = (e)=>{
            const data = e.data;

            if (data && data.type === 'patternMemoryUpdate') {
              try {
                if (data.patternMemory_white) {
                  localStorage.setItem('patternMemory_white', JSON.stringify(data.patternMemory_white));
                }
                if (data.patternMemory_red) {
                  localStorage.setItem('patternMemory_red', JSON.stringify(data.patternMemory_red));
                }
                salvarInteligenciaIA();
              } catch (err) {
                console.warn("Falha ao salvar patternMemory no localStorage:", err);
              }
              return;
            }

            if (data.action === 'say') {
              say(data.group, data.extra || '');
              return;
            }

            const {best, score, depth} = data;

            if (typeof score === 'number' && isFinite(score)) {
              window.lastAIScore = score;
              window.lastAIDepth = typeof depth === 'number' && isFinite(depth) ? depth : null;
            }

            if(!best){ 
              if(legal[0]) handleAIResult(legal[0], -999, 0, 'fallback');
              return;
            }
            handleAIResult(best, score, depth);
          };

          try {
            const memWhite = JSON.parse(localStorage.getItem('patternMemory_white') || '{}');
            const memRed   = JSON.parse(localStorage.getItem('patternMemory_red') || '{}');
            worker.postMessage({
              type: 'loadPatternMemory',
              patternMemory_white: memWhite,
              patternMemory_red: memRed,
              ZOBRIST_KEYS: window.ZOBRIST_KEYS.map(key => key.toString())
            });
          } catch (err) {
            console.warn("Falha ao carregar patternMemory do localStorage:", err);
          }
        } catch (err) {
          console.error("Falha ao carregar worker-code.js:", err);
        }
      }

      // 🧠 INSTINTO POR MEMÓRIA — consulta rápida antes de Edge/Worker
      function computeHash(b) {
        return b.flat().map(p => p || "0").join("");
      }

      function movimentosIguais(a, b) {
        if (!a || !b || !Array.isArray(a.from) || !Array.isArray(a.to) || !Array.isArray(b.from) || !Array.isArray(b.to)) {
          return false;
        }
        return (
          a.from[0] === b.from[0] &&
          a.from[1] === b.from[1] &&
          a.to[0] === b.to[0] &&
          a.to[1] === b.to[1]
        );
      }

      function encontrarLegalPorMemoria(memMove) {
        if (!memMove || !Array.isArray(legal)) return null;
        return legal.find(m => movimentosIguais(m, memMove)) || null;
      }

      async function consultarInstintoMemoriaIA() {
        try {
          if (trainingMode || isTrainingMode) return null;

          if (!window.supabase) return null;
          if (!Array.isArray(legal) || !legal.length) return null;

          const hashAtual = String(computeHash(board)).replace(/n$/, "");

          const { data, error } = await window.supabase
            .from("memoria_ia")
            .select("chave, cor, dados")
            .eq("chave", hashAtual)
            .eq("cor", RED)
            .maybeSingle();

          if (error) {
            console.warn("🧠 Instinto IA: erro ao consultar memória:", error.message);
            return null;
          }

          if (!data?.dados) return null;

          const confidence = Number(data.dados.confidence ?? 0);
          const vezesVisto = Number(data.dados.vezes_visto ?? 0);
          const ultimoResultado = data.dados.ultimo_resultado || null;
          const memMove = data.dados.ultima_jogada || null;

          // Só usa memória confiável. Sem chute.
          if (confidence < 0.72) return null;
          if (vezesVisto < 3) return null;
          if (ultimoResultado === "loss") return null;

          const jogadaLegal = encontrarLegalPorMemoria(memMove);

          if (!jogadaLegal) {
            console.log("🧠 Instinto IA ignorado: jogada lembrada não é legal agora.", {
              confidence,
              vezesVisto,
              memMove
            });
            return null;
          }

          console.log("🧠 Instinto IA ativado:", {
            confidence,
            vezesVisto,
            ultimoResultado,
            jogada: jogadaLegal
          });

          return jogadaLegal;

        } catch (e) {
          console.warn("🧠 Instinto IA falhou sem travar jogo:", e);
          return null;
        }
      }

      async function consultarLivroAberturasSupabase() {
  try {
    if (trainingMode || isTrainingMode) return null;
    if (!window.supabase) return null;
    if (!Array.isArray(legal) || !legal.length) return null;

    // Só usa livro no começo/meio inicial
    if (Array.isArray(gameHistory) && gameHistory.length > 12) return null;

    const dificuldadeAtual = getDificuldadeAtualIA();
    const dificuldadeLivro = dificuldadeAtual === "master" ? "master" : "universal";

    const hashAtual = String(getBoardHash(board)).replace(/n$/, "");

    const { data, error } = await window.supabase
      .from("aberturas")
      .select("*")
      .eq("zobrist_hash", hashAtual)
      .in("dificuldade", [dificuldadeLivro, "universal"])
      .order("peso", { ascending: false })
      .order("vitorias_vermelho", { ascending: false })
      .order("vezes_usada", { ascending: true })
      .limit(10);

    if (error) {
      console.warn("📚 Livro Supabase: erro ao consultar:", error.message);
      return null;
    }

    if (!data?.length) return null;

    for (const row of data) {
      const mv = legal.find(m =>
        m.from?.[0] === Number(row.from_row) &&
        m.from?.[1] === Number(row.from_col) &&
        m.to?.[0] === Number(row.to_row) &&
        m.to?.[1] === Number(row.to_col)
      );

      if (!mv) continue;

      console.log("📚 Livro Supabase ativado:", {
        nome: row.nome_abertura,
        dificuldade: row.dificuldade,
        peso: row.peso,
        vezes_usada: row.vezes_usada,
        jogada: mv
      });

      // Atualiza uso sem travar a jogada
      window.supabase
        .from("aberturas")
        .update({
          vezes_usada: Number(row.vezes_usada || 0) + 1,
          atualizado_em: new Date().toISOString()
        })
        .eq("id", row.id)
        .then(({ error }) => {
          if (error) console.warn("📚 Livro Supabase: erro ao atualizar uso:", error.message);
        });

      return mv;
    }

    return null;

  } catch (e) {
    console.warn("📚 Livro Supabase falhou sem travar jogo:", e);
    return null;
  }
}

      async function aiMove(movesToConsider=null){
        if (gameEnded) return;
        if(isOnline) return; // IA não joga online
        if(!worker) return;
        const subset = movesToConsider || null;

        // 💡 IMPLEMENTAÇÃO 6: Rosto muda *antes* de pensar
        updateFaceState(); 
        // 🔁 Não fala 'thinking' se for modo treino (polui muito)
        if (!trainingMode) say('thinking'); // Helper de UI

        // 🎚️ PASSO 2: Envia a profundidade conforme dificuldade
        const depth = getDepthByDifficulty();
        const diff = (localStorage.getItem('difficulty') || 'medium');

        // 🎲 Monte Carlo opcional: dá mais "variedade" em níveis baixos
        let useMonteCarlo = false;
        if (!trainingMode) {
          if (diff === 'easy') {
            useMonteCarlo = true;      // Easy: joga mais solto, mais aleatório
          } else if (diff === 'medium') {
            useMonteCarlo = true;      // Medium: ainda com um pouco de variedade
          } else if (diff === 'hard') {
            useMonteCarlo = false;     // Hard/Master: foco em precisão
          } else if (diff === 'master') {
            useMonteCarlo = false;
          }
        }

        // 🎯 Tempo de pensamento por dificuldade
        // Configura o tempo de busca de acordo com a dificuldade. Para os níveis mais
        // baixos, a IA responde rapidamente; no nível mestre, dedica mais tempo para
        // aumentar a força sem travar a interface. Estes valores substituem o
        // modelo anterior (350/700/1100/1500ms).
        let thinkTimeMs = 800; // padrão
        if (diff === 'easy')      thinkTimeMs = 200;
        else if (diff === 'medium') thinkTimeMs = 800;
        else if (diff === 'hard')   thinkTimeMs = 1600;
        else if (diff === 'master') thinkTimeMs = 3000;

        // 📚 LIVRO SUPABASE: aberturas catalogadas pela colmeia
        const jogadaLivroSupabase = await consultarLivroAberturasSupabase();

        if (jogadaLivroSupabase) {
          setTimeout(() => {
            handleAIResult(jogadaLivroSupabase, -0.15, 0);
          }, 250);
          return;
        }

        // 🧠 INSTINTO: memória confiável da posição atual
        const jogadaInstinto = await consultarInstintoMemoriaIA();

        if (jogadaInstinto) {
          setTimeout(() => {
            applyMove(jogadaInstinto);
          }, 250);
          return;
        }

        // ☁️ IA HÍBRIDA: consulta Edge Function antes do worker local
        if (!trainingMode) {
          const edge = await consultarEdgeIA({
            boardString: boardToEdgeString(board),
            legalMoves: legal,
            zobrist: getCurrentZobristForEdge(),
            difficulty: diff,
            playerColor: RED
          });

          if (edge?.source === 'opening_book' && edge.move) {
            const edgeMove = {
              from: edge.move.from,
              to: edge.move.to,
              type: 'move'
            };

            const matched = (legal || []).find(m =>
              m?.from?.[0] === edgeMove.from?.[0] &&
              m?.from?.[1] === edgeMove.from?.[1] &&
              m?.to?.[0] === edgeMove.to?.[0] &&
              m?.to?.[1] === edgeMove.to?.[1]
            );

            if (matched) {
              console.log('☁️ Edge IA usou abertura:', edge.name || edge);
              handleAIResult(matched, edge.score ?? 0, edge.depth ?? 0);
              return;
            }

            console.warn('Edge IA sugeriu lance fora da lista legal. Usando worker local.', edgeMove);
          }

          if (edge?.source === 'pattern_memory') {
            console.log('☁️ Edge IA encontrou memória de padrão:', edge);
          }

          if (edge?.source === 'compute_local') {
            console.log('☁️ Edge IA sem abertura/memória. Worker local continua.');
          }
        }

        // 🧠 FALLBACK: Se a Edge não retornou jogada, usa o worker local
        // ⭐️ MODIFICADO: Envia também a regra de captura para a IA
        // 🧠 MODIFICADO: Envia AMBOS os perfis + pesos neurais + pesos de fim de jogo
        worker.postMessage({ 
          board, 
          legal, 
          subset, 
          aiProfile_w: getAIProfile(WHITE), 
          aiProfile_r: getAIProfile(RED),   
          neural_w: getNeuralWeights(WHITE), 
          neural_r: getNeuralWeights(RED),   
          endgame_w: getEndgameWeights(WHITE), // NOVO: Pesos de fim de jogo
          endgame_r: getEndgameWeights(RED),   // NOVO: Pesos de fim de jogo
          maxDepth: depth, 
          captureRule: getCaptureRule(),
          useMonteCarlo,
          thinkTimeMs
        });
      }


      function handleAIResult(best, score, depth){
        // 🔒 Se o jogo já acabou ou não veio jogada válida do worker, ignora a resposta
        if (gameEnded || !best) return;

        // 🎯 Escolha final do lance considerando a dificuldade
        // Por padrão, usamos o melhor lance encontrado pelo worker
        let moveToPlay = best;

        // Em modos com dificuldade (fora do treino IA vs IA), podemos introduzir
        // um pouco de imprecisão controlada para deixar o EASY/MEDIUM mais humanos.
        if (!trainingMode && Array.isArray(legal) && legal.length > 1) {
          const diff = (localStorage.getItem('difficulty') || 'medium');
          const r = Math.random();

          if (diff === 'easy') {
            // EASY: ~35% de chance de jogar qualquer lance legal (inclusive não ótimo)
            if (r < 0.35) {
              moveToPlay = legal[Math.floor(Math.random() * legal.length)];
            }
          } else if (diff === 'medium') {
            // MEDIUM: ~15% de chance de variar o lance
            if (r < 0.15) {
              moveToPlay = legal[Math.floor(Math.random() * legal.length)];
            }
          } else if (diff === 'hard') {
            // HARD: raramente erra (~5%), mas ainda pode variar um pouco
            if (r < 0.05) {
              moveToPlay = legal[Math.floor(Math.random() * legal.length)];
            }
          }
          // MASTER: nunca altera o lance (usa sempre o melhor do worker)
        }

        // 💡 IMPLEMENTAÇÃO 6: "Expressões e emoção dinâmica"
        // score < 0 é bom para IA (RED). score > 0 é bom para HUMANO (WHITE)
        // 🔁 Desativado no modo treino
        if (!trainingMode) {
          if (score < -0.4) { // IA está muito à frente
            setFace('ahead', { ahead: true }); // Helper de UI
            if (moveToPlay.type !== 'capture' && moveToPlay.type !== 'multi') say('ahead'); // Helper de UI
          } else if (score > 0.4) { // IA está muito atrás
            setFace('behind', { behind: true }); // Helper de UI
            if (moveToPlay.type !== 'capture' && moveToPlay.type !== 'multi') say('behind'); // Helper de UI
          }
        }

        // 💬 Contexto de sacrifício: se a IA estiver bem atrás (score > 0.8) e optar por capturar,
        // considera-se um sacrifício calculado. Fala uma frase especial antes do lance.
        if (!trainingMode && moveToPlay.type === 'capture' && score > 0.8) {
          sayWithContext('sacrifice');
        }
        // Fim (Implementação 6)

        // 💬 Contexto de poucas peças: se restarem 8 peças ou menos no total, a IA comenta uma vez
        // Não em modo treino, para evitar falas excessivas
        if (!trainingMode) {
          try {
            const { w, r } = countPieces();
            const total = w + r;
            if (total <= 8 && !window.lowMaterialAnnounced) {
              window.lowMaterialAnnounced = true;
              sayWithContext('lowMaterial');
            }
          } catch (_) {}
        }

        const fs = squareEl(moveToPlay.from[0],moveToPlay.from[1]); // Helper de UI
        const ts = squareEl(moveToPlay.to[0],moveToPlay.to[1]); // Helper de UI
        // 🔁 Não mostra anéis no modo treino (polui muito)
        if (!trainingMode) {
          fs && fs.classList.add('ring-4','ring-red-500','opacity-80','z-10');
          ts && ts.classList.add('ring-4','ring-yellow-400','opacity-80','z-10');
        }

        // 🔁 Velocidade da animação no modo treino é 0, controlada pelo 'trainingSpeed'
        const animationDelay = trainingMode ? 0 : 280;

        setTimeout(()=>{
          applyMove(moveToPlay);
          if (!trainingMode) {
            fs && fs.classList.remove('ring-4','ring-red-500','opacity-80','z-10');
            ts && ts.classList.remove('ring-4','ring-yellow-400','opacity-80','z-10');
          }
          endTurn(moveToPlay);
        }, animationDelay);
      }


      /*************************
       * Emoções contextuais
       *************************/
      function countPieces(){
        let w=0,r=0;
        for(let i=0;i<8;i++) for(let j=0;j<8;j++){
          const v=board[i][j];
          if(v?.startsWith(WHITE)) w++;
          if(v?.startsWith(RED)) r++;
        }
        return {w,r};
      }

      function updateFaceState(){
        if (isOnline) {
          setFace('idle'); // Rosto 🌐 (Helper de UI)
          return;
        }
        // 🔁 Se for modo treino, rosto neutro
        if (trainingMode) {
          setFace('idle');
          faceEmoji.textContent = '🧠'; // Emoji de cérebro
          return;
        }
        
        // 💡 Esta função agora é chamada ANTES da IA pensar (em aiMove)
        // e reflete o estado do perfil
        const {w,r}=countPieces();
        
        const humanMoves = filterMandatoryWithMaxChain(board, WHITE, allMoves(WHITE, board));
        if(humanMoves.length<=2 && current===RED){ setFace('nearWin',{ahead:true}); say('nearWin'); } // Helpers de UI

        // 💡 IMPLEMENTAÇÃO 3: Visual do modo adaptativo (agg + def)
        // 🧠 MODIFICADO: Puxa o perfil da IA (RED) para o modo vs Humano
        const { agg, def } = getAIProfile(RED); // Puxa ambos os valores
        const now = performance.now();
        
        // Define o emoji com base no perfil, mas 'setFace' (Ponto 6) pode sobrepor
        if (agg > 0.7) {
          faceEmoji.textContent = '😈';
          if (now - lastTauntAt > 2000) say('thinking', 'Modo agressivo ativo.'); // Helper de UI
        } else if (def > 0.7) { // 💡 Novo: Reage ao modo defensivo
          faceEmoji.textContent = '🛡️'; // Emoji de escudo
          if (now - lastTauntAt > 2000) say('thinking', 'Modo defensivo priorizado.'); // Helper de UI
        } else {
          // Se não está em modo extremo, usa um emoji de pensamento padrão
          faceEmoji.textContent = EMOJI['thinking'][Math.floor(Math.random()*EMOJI['thinking'].length)] || '🤔';
        }
      }
      
      /*************************
       * 🧠 ETAPA 3: Função de Análise (IMPLEMENTAÇÃO 8 - "Análise Profissional")
       *************************/
      // 🚀 FUNÇÃO DE ANÁLISE TOTALMENTE REFEITA (MAIS DETALHADA)
      function analyzeMatch(history, winner) {
        let tips = [];
        // 🌐 Não analisa jogos online
        if (isOnline) {
          tips.push("Análise de partida não disponível para jogos online.");
          return tips;
        }

        // 🤝 Lógica de Empate (vinda da merge anterior)
        if (winner === 'draw') {
          tips.push("Jogo empatado! Uma partida tática onde nenhum lado cedeu vantagem.");
        }
        
        if (history.length < 5) {
          if (winner !== 'draw') tips.push("Partida curta demais para análise detalhada.");
          return tips; // Retorna, mas *depois* de checar o empate
        }

        // --- Início da Análise Detalhada ---

        // 1. Métricas Básicas (Total de Capturas)
        const totalMoves = history.length;
        const playerMoves = history.filter(h => h.player === WHITE);
        const aiMoves = history.filter(h => h.player === RED);
        const playerCaptures = playerMoves.filter(h => h.move.type === 'capture').length;
        const aiCaptures = aiMoves.filter(h => h.move.type === 'capture').length;

        tips.push(`Total de jogadas: ${totalMoves}`);
        tips.push(`Você capturou ${playerCaptures} peças.`);
        tips.push(`A IA capturou ${aiCaptures} peças.`);

        // 2. Análise de Ritmo (Tempo)
        // Só calcula se não for online e não for modo treino
        if (!isOnline && !trainingMode && playerMoves.length > 2) { 
          let totalTime = 0;
          let moveCount = 0;
          for (let i = 1; i < playerMoves.length; i++) {
            // Tenta pegar o tempo da jogada anterior da IA. 
            // Se não existir (primeira jogada), usa a jogada anterior do player.
            const lastMoveTime = aiMoves[i-1]?.time || playerMoves[i-1]?.time;
            if (lastMoveTime) {
                const timeDiff = playerMoves[i].time - lastMoveTime;
                // Ignora jogadas muito rápidas (provavelmente cliques errados) ou pausas longas (mais de 1 min)
                if (timeDiff > 100 && timeDiff < 60000) { 
                  totalTime += timeDiff;
                  moveCount++;
                }
            }
          }
          
          if (moveCount > 0) {
              const avgTime = (totalTime / moveCount / 1000).toFixed(1); // em segundos
              tips.push(`Seu tempo médio por jogada foi de ${avgTime} segundos.`);
              if (avgTime < 3) tips.push("Ritmo de jogo rápido! Bom instinto.");
              else if (avgTime > 10) tips.push("Ritmo de jogo cauteloso. Você ponderou bem suas jogadas.");
          }
        }

        // 3. Ponto de Virada (Turning Point)
        let maxSwing = 0;
        let swingTurn = -1; // Índice da jogada no histórico

        for (let i = 1; i < history.length; i++) {
          const prevDiff = history[i-1].diff; // Vantagem da IA no turno anterior
          const currDiff = history[i].diff; // Vantagem da IA agora
          const swing = currDiff - prevDiff; // Positivo: IA ganhou vantagem. Negativo: Player ganhou.
          
          // Estamos interessados na jogada do *jogador* (WHITE)
          if (history[i].player === WHITE) {
              // Se o 'swing' for positivo, o jogador fez uma jogada que deu vantagem à IA
              if (swing > maxSwing) {
                  maxSwing = swing;
                  swingTurn = i; // Salva o índice da jogada
              }
          }
        }

        // Se um erro significativo (perda de 2+ peças) foi encontrado
        if (swingTurn !== -1 && maxSwing >= 2) { 
          // Calcula o "número da jogada" (ex: Jogada 5)
          const moveNumber = history.slice(0, swingTurn + 1).filter(h => h.player === WHITE).length;
          tips.push(`**Ponto de Virada (Sua jogada ${moveNumber}):** Esta jogada permitiu à IA ganhar uma vantagem material de ${maxSwing} peças.`);
        }

        // 4. Análise de Fases e Vencedor
        const lastState = history[history.length - 1];

        if (winner === WHITE) {
          tips.push("**Vitória!** Você manteve a pressão e converteu a vantagem.");
          if (playerCaptures > aiCaptures) {
              tips.push("Sua eficiência nas trocas foi decisiva.");
          }
          if (lastState.white > 5 && lastState.red === 0) {
              tips.push("Domínio total do tabuleiro. Excelente!");
          }
        } else if (winner === RED) {
          tips.push("**Derrota.** A IA conseguiu capitalizar em aberturas ou erros de meio-jogo.");
          if (aiCaptures > playerCaptures) {
              tips.push("A IA foi mais agressiva nas capturas. Tente proteger suas peças-chave.");
          }
          if (swingTurn !== -1 && maxSwing >= 2) { // Só menciona se o ponto de virada foi significativo
              tips.push("Aquele Ponto de Virada foi crucial. Revise essa jogada.");
          }
        }

        // 5. Dicas Genéricas (mantidas)
        if (history.length < 20 && winner !== 'draw') tips.push("Partida rápida — reveja aberturas e defesas iniciais.");
        
        return tips;
      }

// ============================================================
// 🐝 COLMEIA DE PESOS NEURAIS
// ============================================================

// Baixa pesos da colmeia ao iniciar o jogo
async function baixarPesosColmeia() {
  try {
    if (!window.supabase) {
      console.log("[Colmeia] Supabase não disponível ainda");
      return;
    }

    const { data, error } = await window.supabase
      .from("hive_weights")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[Colmeia] Erro ao baixar:", error.message);
      return;
    }

    if (!data) {
      console.log("[Colmeia] Nenhum peso global ainda.");
      return;
    }

    console.log("[Colmeia] Pesos globais recebidos:", data);

    const misturar = (local, hive, pesoHive = 0.3) => {
      const l = Number(local);
      const h = Number(hive);
      if (!Number.isFinite(h) || h <= 0) return l;
      if (!Number.isFinite(l)) return h;
      return Number((l * (1 - pesoHive) + h * pesoHive).toFixed(4));
    };

    // Pesos reais usados pela IA vermelha
    const neuralRed = getNeuralWeights(RED).slice();
    const endgameRed = getEndgameWeights(RED).slice();

    // neural: [material, reis, centro, mobilidade]
    neuralRed[0] = misturar(neuralRed[0], data.material_weight, 0.3);
    neuralRed[1] = misturar(neuralRed[1], data.king_value_weight, 0.3);
    neuralRed[2] = misturar(neuralRed[2], data.center_control_weight, 0.3);
    neuralRed[3] = misturar(neuralRed[3], data.mobility_weight, 0.3);

    // endgame: [diagonal, oposição, canto]
    endgameRed[0] = misturar(endgameRed[0], data.diagonal_control_weight, 0.3);
    endgameRed[1] = misturar(endgameRed[1], data.opposition_weight, 0.3);
    endgameRed[2] = misturar(endgameRed[2], data.king_cornering_weight, 0.3);

    // Salva e atualiza cache real (ambas as cores)
    saveNeuralWeights("red", neuralRed);
    saveNeuralWeights("white", neuralRed);

    saveEndgameWeights("red", endgameRed);
    saveEndgameWeights("white", endgameRed);

    if (!getNeuralWeights.cache) getNeuralWeights.cache = {};
    if (!getEndgameWeights.cache) getEndgameWeights.cache = {};

    getNeuralWeights.cache.red = neuralRed;
    getNeuralWeights.cache.white = neuralRed;

    getEndgameWeights.cache.red = endgameRed;
    getEndgameWeights.cache.white = endgameRed;

    console.log("🐝 Colmeia universal aplicada nas duas IAs:", {
      neuralRed,
      endgameRed,
      total_contributors: data.total_contributors,
      total_games: data.total_games
    });

  } catch (e) {
    console.error("[Colmeia] Falha ao aplicar pesos:", e);
  }
}

// Alimenta a colmeia com jogadas/pesos da partida
async function alimentarColmeia(moves, resultado, dificuldade) {
  try {
    if (dificuldade !== "hard" && dificuldade !== "master") return;
    if (!window.supabase) return;

    // Pega o jogador autenticado
    const { data: { user } } = await window.supabase.auth.getUser();
    const playerId = user?.id || null;

    if (!playerId) {
      console.warn("🐝 Colmeia: sem player_id, não alimenta.");
      return;
    }

    // Pesos REAIS da IA vermelha (o que ela aprendeu nesta partida)
    const neural = getNeuralWeights(RED);
    const endgame = getEndgameWeights(RED);

    const payload = {
      player_id: playerId,
      material_weight: neural?.[0] ?? 1.0,
      center_control_weight: neural?.[2] ?? 0.3,
      king_value_weight: neural?.[1] ?? 0.4,
      mobility_weight: neural?.[3] ?? 0.2,
      edge_control_weight: 0.15,
      endgame_weight: endgame?.[0] ?? 1.0,
      diagonal_control_weight: endgame?.[0] ?? 0.3,
      opposition_weight: endgame?.[1] ?? 0.5,
      king_cornering_weight: endgame?.[2] ?? 0.4,
      difficulty: dificuldade,
      game_result: resultado,
      total_moves: Array.isArray(moves) ? moves.length : 0,
    };

    const { error } = await window.supabase
      .from("hive_contributors")
      .insert(payload);

    if (error) {
      console.warn("🐝 Erro colmeia:", error.message);
    } else {
      console.log("🐝 Colmeia alimentada:", payload.total_moves, "jogadas");
      // 🔄 Recalcula pesos globais após nova contribuição
      await recalcularHiveWeights();
    }

  } catch (e) {
    console.warn("🐝 Erro alimentar colmeia:", e);
  }
}

// Recalcula média global da colmeia e atualiza hive_weights
async function recalcularHiveWeights() {
  try {
    if (!window.supabase) return;

    // 1. Busca todos os contribuidores
    const { data: contributors, error: errContrib } = await window.supabase
      .from("hive_contributors")
      .select("*");

    if (errContrib) {
      console.warn("🐝 Erro ao buscar contribuidores:", errContrib.message);
      return;
    }

    if (!Array.isArray(contributors) || contributors.length === 0) {
      console.log("🐝 Colmeia vazia, nada a recalcular.");
      return;
    }

    // 2. Calcula médias
    const n = contributors.length;
    const avg = (key) => {
      const sum = contributors.reduce((acc, c) => acc + (Number(c[key]) || 0), 0);
      return Number((sum / n).toFixed(4));
    };

    const totalContributors = new Set(contributors.map(c => c.player_id).filter(Boolean)).size;
    const totalGames = contributors.reduce((acc, c) => acc + (Number(c.total_moves) || 0), 0);

    const payload = {
      material_weight: avg("material_weight"),
      center_control_weight: avg("center_control_weight"),
      king_value_weight: avg("king_value_weight"),
      mobility_weight: avg("mobility_weight"),
      edge_control_weight: avg("edge_control_weight"),
      endgame_weight: avg("endgame_weight"),
      diagonal_control_weight: avg("diagonal_control_weight"),
      opposition_weight: avg("opposition_weight"),
      king_cornering_weight: avg("king_cornering_weight"),
      total_contributors: totalContributors,
      total_games: totalGames,
      updated_at: new Date().toISOString()
    };

    // 3. Upsert em hive_weights (id fixo = 1, uma só linha global)
    const { error: errUpsert } = await window.supabase
      .from("hive_weights")
      .upsert({ id: "00000000-0000-0000-0000-000000000001", ...payload }, { onConflict: "id" });

    if (errUpsert) {
      console.warn("🐝 Erro ao atualizar hive_weights:", errUpsert.message);
    } else {
      console.log("🐝 hive_weights recalculado:", {
        contribuidores: totalContributors,
        jogos: totalGames,
        pesos: payload
      });
    }

  } catch (e) {
    console.warn("🐝 Erro recalcularHiveWeights:", e);
  }
}

// Envia pesos locais para a colmeia (LEGADO — mantido para compatibilidade)
async function enviarPesosColmeia(resultado, lances) {
  try {
    if (!window.supabase) {
      console.log('[Colmeia] Supabase não disponível');
      return;
    }

    const dif = getDificuldadeAtualIA();
    const validas = ['hard', 'master', 'dificil', 'mestre'];
    if (!validas.includes(dif)) {
      console.log('[Colmeia] Dificuldade baixa, não envia:', dif);
      return;
    }

    if (resultado !== 'ia_loss' && resultado !== 'player_win') {
      console.log('[Colmeia] IA não perdeu, nada a aprender');
      return;
    }

    // Pesos REAIS da IA vermelha
    const neural = getNeuralWeights(RED);
    const endgame = getEndgameWeights(RED);

    // Pega o jogador autenticado
    const { data: { user } } = await window.supabase.auth.getUser();
    const playerId = user?.id || null;

    const payload = {
      player_id: playerId,
      material_weight: neural?.[0] ?? 1.0,
      center_control_weight: neural?.[2] ?? 0.3,
      king_value_weight: neural?.[1] ?? 0.4,
      mobility_weight: neural?.[3] ?? 0.2,
      edge_control_weight: 0.15,
      endgame_weight: endgame?.[0] ?? 1.0,
      diagonal_control_weight: endgame?.[0] ?? 0.3,
      opposition_weight: endgame?.[1] ?? 0.5,
      king_cornering_weight: endgame?.[2] ?? 0.4,
      difficulty: dif,
      game_result: resultado === 'player_win' ? 'loss' : 'draw',
      total_moves: lances || 0,
    };

    const { data, error } = await window.supabase
      .from('hive_contributors')
      .insert(payload)
      .select();

    if (error) {
      console.warn('[Colmeia] Erro ao enviar:', error.message);
      return;
    }

    console.log('[Colmeia] Pesos enviados! 🐝');
    await recalcularHiveWeights();
  } catch (e) {
    console.warn('[Colmeia] Erro:', e.message);
  }
}

// Retorna estatísticas da colmeia para o Diagnóstico
async function statsColmeia() {
  try {
    if (!window.supabase) return null;
    const { data, error } = await window.supabase
      .from('hive_weights')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return {
      jogadores: data.total_contributors,
      partidas: data.total_games,
      atualizado: data.updated_at,
      ativa: data.total_contributors > 0,
    };
  } catch (e) {
    return null;
  }
}
