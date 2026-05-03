
document.addEventListener("DOMContentLoaded", ()=>{
  const b=document.getElementById("btnMultiplayer");
  if(b){ b.onclick=()=>{ window.location.href="mesa.html"; } }

  const btnRanking = document.getElementById("btnRanking");
  const btnVoltarRanking = document.getElementById("btnVoltarRanking");
  const btnAtualizarRanking = document.getElementById("btnAtualizarRanking");
  const mainMenuScreen = document.getElementById("mainMenuScreen");
  const rankingScreen = document.getElementById("rankingScreen");

  // 🐞 CORREÇÃO: carregarRanking é global para que o botão "Tentar novamente" funcione
  window.App = window.App || {};

window.App.carregarRanking = async function() {
    const lista = document.getElementById("rankingList");
    const btnAtualizar = document.getElementById("btnAtualizarRanking");
    if (!lista) {
      console.error("[Ranking] Elemento #rankingList não encontrado");
      return;
    }

    // Feedback visual no botão
    const btnTextoOriginal = btnAtualizar ? btnAtualizar.textContent : "🔄 Atualizar";
    if (btnAtualizar) {
      btnAtualizar.disabled = true;
      btnAtualizar.textContent = "⏳ Atualizando...";
      btnAtualizar.classList.add("opacity-60", "cursor-not-allowed");
    }

    lista.innerHTML = `<div class="text-center text-slate-400 py-6 animate-pulse">Carregando ranking...</div>`;

    // Verifica se Supabase está disponível
    if (!window.supabase) {
      console.error("[Ranking] window.supabase não está disponível");
      lista.innerHTML = `
        <div class="text-center text-red-300 py-6">
          ⚠️ Banco de dados não conectado.<br>
          <span class="text-xs text-slate-400">Aguarde alguns segundos e tente novamente.</span>
          <br><button id="rankingRetryBtn" class="mt-3 bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-xs">🔄 Tentar novamente</button>
        </div>
      `;
      const retryBtn = document.getElementById("rankingRetryBtn");
      if (retryBtn) retryBtn.addEventListener("click", window.App.carregarRanking);
      if (btnAtualizar) {
        btnAtualizar.disabled = false;
        btnAtualizar.textContent = btnTextoOriginal;
        btnAtualizar.classList.remove("opacity-60", "cursor-not-allowed");
      }
      return;
    }

    try {
      console.log("[Ranking] Carregando dados do Supabase...");
      const { data, error } = await window.supabase
        .from("profiles")
        .select("username, rating, wins, losses, draws")
        .order("rating", { ascending: false })
        .limit(10);

      if (error) {
        console.error("[Ranking] Erro Supabase:", error);
        throw error;
      }

      console.log("[Ranking] Dados recebidos:", data ? data.length : 0, "jogadores");

      if (!data?.length) {
        lista.innerHTML = `<div class="text-center text-slate-400 py-6">Nenhum jogador no ranking ainda.<br><span class="text-xs">Seja o primeiro a jogar!</span></div>`;
        return;
      }

      lista.innerHTML = data.map((p, i) => {
        const pos = i + 1;
        const medalha = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `#${pos}`;

        return `
          <div class="flex items-center justify-between gap-3 py-3 border-b border-slate-700/70 last:border-b-0">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 text-center text-xl font-bold">${medalha}</div>
              <div class="min-w-0">
                <div class="font-bold text-slate-100 truncate">${p.username || "Jogador"}</div>
                <div class="text-xs text-slate-400">
                  ${p.wins || 0}V • ${p.losses || 0}D • ${p.draws || 0}E
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-amber-300 font-black">${p.rating || 1000}</div>
              <div class="text-[10px] text-slate-500 uppercase">rating</div>
            </div>
          </div>
        `;
      }).join("");

    } catch (e) {
      console.error("[Ranking] Erro:", e);
      const erroMsg = e.message || e.error_description || "Erro desconhecido";
      lista.innerHTML = `
        <div class="text-center text-red-300 py-6">
          ⚠️ Erro ao carregar ranking.<br>
          <span class="text-xs text-slate-400">${erroMsg}</span>
          <br><button id="rankingRetryBtn" class="mt-3 bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-xs">🔄 Tentar novamente</button>
        </div>
      `;
      const retryBtn = document.getElementById("rankingRetryBtn");
      if (retryBtn) retryBtn.addEventListener("click", window.App.carregarRanking);
    } finally {
      // ✅ Feedback visual de sucesso — evita sensação de "nada aconteceu"
      if (btnAtualizar) {
        btnAtualizar.textContent = "✅ Atualizado!";
        btnAtualizar.classList.remove("opacity-60", "cursor-not-allowed");
        btnAtualizar.classList.add("bg-emerald-700", "hover:bg-emerald-600");
        setTimeout(() => {
          btnAtualizar.disabled = false;
          btnAtualizar.textContent = btnTextoOriginal;
          btnAtualizar.classList.remove("bg-emerald-700", "hover:bg-emerald-600");
        }, 900);
      }
    }
  };

  if (btnRanking) {
    btnRanking.addEventListener("click", () => {
      mainMenuScreen.classList.add("hidden");
      rankingScreen.classList.remove("hidden");
      window.App.carregarRanking();
    });
  }

  if (btnVoltarRanking) {
    btnVoltarRanking.addEventListener("click", () => {
      rankingScreen.classList.add("hidden");
      mainMenuScreen.classList.remove("hidden");
    });
  }

  if (btnAtualizarRanking) {
    btnAtualizarRanking.addEventListener("click", window.App.carregarRanking);
  }
  
  const btnConfig = document.getElementById("btnConfig");
  const configModal = document.getElementById("configModal");
  const btnCloseConfig = document.getElementById("btnCloseConfig");
  const configContent = document.getElementById("configContent");
  const btnOpenManualFromConfig = document.getElementById("btnOpenManualFromConfig");

  function montarConfigModal() {
    if (!configContent) return;

    const difficultyContainer = document.getElementById("difficultyContainer");
    const ruleContainer = document.getElementById("ruleContainer");
    const speechModeContainer = document.getElementById("speechModeContainer");

    if (difficultyContainer && !configContent.contains(difficultyContainer)) {
      difficultyContainer.classList.remove("hidden");
      configContent.appendChild(difficultyContainer);
    }

    if (ruleContainer && !configContent.contains(ruleContainer)) {
      ruleContainer.classList.remove("hidden");
      configContent.appendChild(ruleContainer);
    }

    if (speechModeContainer && !configContent.contains(speechModeContainer)) {
      speechModeContainer.classList.remove("hidden");
      configContent.appendChild(speechModeContainer);
    }
  }

  if (btnConfig && configModal) {
    btnConfig.onclick = () => {
      montarConfigModal();
      configModal.classList.remove("hidden");
    };
  }

  if (btnCloseConfig && configModal) {
    btnCloseConfig.onclick = () => {
      configModal.classList.add("hidden");
    };
  }

  if (btnOpenManualFromConfig) {
    btnOpenManualFromConfig.onclick = () => {
      if (configModal) configModal.classList.add("hidden");
      const manualBtn = document.getElementById("btnManualMenu");
      if (manualBtn) manualBtn.click();
    };
  }

  // 👤 Inicializa perfil do jogador (login simples)
  if (typeof initPerfilJogador === "function") {
    initPerfilJogador();
  }
});


// Botão Inteligência da IA
document.addEventListener('DOMContentLoaded', ()=>{
  const b=document.getElementById('btnOpenInteligenciaIA');
  if(b){ b.onclick=()=>window.open('Inteligencia-da-IA.html','_blank'); }
});
