import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ynhlhdluafgmujfkrnlz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_UxqBEJSBU__Z8ec123DTTg_qpiNLymf";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabase = supabase;
window.db = supabase;

let localUserId = localStorage.getItem("damas_user_id");
if (!localUserId) {
  localUserId = crypto.randomUUID();
  localStorage.setItem("damas_user_id", localUserId);
}
window.userId = localUserId;

const TABLE_MAP = {
  aiProfiles: "memoria_ia",
  ia: "memoria_ia",
  opening_book: "memoria_ia",
  salas: "salas"
};

const FIELD_TO_DB = {
  Jogador1: "jogador1",
  Jogador2: "jogador2",
  Tabuleiro: "tabuleiro",
  JogadorDaVez: "jogador_da_vez",
  Status: "status",
  Vencedor: "vencedor",
  UltimaJogada: "ultima_jogada",
  Timestamp: "atualizado_em"
};

const FIELD_FROM_DB = {
  jogador1: "Jogador1",
  jogador2: "Jogador2",
  tabuleiro: "Tabuleiro",
  jogador_da_vez: "JogadorDaVez",
  status: "Status",
  vencedor: "Vencedor",
  ultima_jogada: "UltimaJogada",
  atualizado_em: "Timestamp"
};

function normalizeTable(table) {
  return TABLE_MAP[table] || table;
}

function toDbFields(data = {}) {
  const out = {};

  for (const [key, value] of Object.entries(data)) {
    const dbKey = FIELD_TO_DB[key] || key;

    if (dbKey === "atualizado_em") {
      out[dbKey] = new Date().toISOString();
    } else if ((dbKey === "jogador1" || dbKey === "jogador2") && value === "") {
      out[dbKey] = null;
    } else {
      out[dbKey] = value;
    }
  }

  return out;
}

function fromDbFields(data = {}) {
  const out = { ...data };

  for (const [dbKey, jsKey] of Object.entries(FIELD_FROM_DB)) {
    if (dbKey in data) out[jsKey] = data[dbKey];
  }

  if (data.atualizado_em) {
    out.Timestamp = new Date(data.atualizado_em).getTime();
  }

  return out;
}

function inferMemoriaTipo(chave) {
  if (chave === "inteligencia") return "inteligencia";
  if (String(chave).startsWith("aiProfile_")) return "perfil";
  return "geral";
}

function inferMemoriaCor(chave) {
  const s = String(chave);
  if (s.includes("_white")) return "white";
  if (s.includes("_red")) return "red";
  return null;
}

function makeSnap(data) {
  return {
    exists: () => !!data,
    data: () => data || null
  };
}

window.doc = function (_db, table, id) {
  return {
    table: normalizeTable(table),
    originalTable: table,
    id
  };
};

window.setDoc = async function (ref, data, options = {}) {
  if (ref.table === "memoria_ia") {
    const payload = {
      chave: ref.id,
      tipo: inferMemoriaTipo(ref.id),
      cor: inferMemoriaCor(ref.id),
      dados: data || {},
      atualizado_em: new Date().toISOString()
    };

    const { error } = await supabase
      .from("memoria_ia")
      .upsert(payload, { onConflict: "chave" });

    if (error) throw error;
    return true;
  }

  if (ref.table === "salas") {
    const payload = {
      id: ref.id,
      ...toDbFields(data)
    };

    const { error } = await supabase
      .from("salas")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;
    return true;
  }

  const payload = { id: ref.id, ...data };

  const { error } = await supabase
    .from(ref.table)
    .upsert(payload, { onConflict: "id" });

  if (error) throw error;
  return true;
};

window.getDoc = async function (ref) {
  if (ref.table === "memoria_ia") {
    const { data, error } = await supabase
      .from("memoria_ia")
      .select("*")
      .eq("chave", ref.id)
      .maybeSingle();

    if (error) throw error;
    return makeSnap(data ? (data.dados || {}) : null);
  }

  if (ref.table === "salas") {
    const { data, error } = await supabase
      .from("salas")
      .select("*")
      .eq("id", ref.id)
      .maybeSingle();

    if (error) throw error;
    return makeSnap(data ? fromDbFields(data) : null);
  }

  const { data, error } = await supabase
    .from(ref.table)
    .select("*")
    .eq("id", ref.id)
    .maybeSingle();

  if (error) throw error;
  return makeSnap(data);
};

window.updateDoc = async function (ref, data) {
  if (ref.table === "memoria_ia") {
    const snap = await window.getDoc(ref);
    const atual = snap.exists() ? snap.data() : {};
    return window.setDoc(ref, { ...atual, ...(data || {}) }, { merge: true });
  }

  if (ref.table === "salas") {
    const payload = toDbFields(data);
    payload.atualizado_em = new Date().toISOString();

    const { error } = await supabase
      .from("salas")
      .update(payload)
      .eq("id", ref.id);

    if (error) throw error;
    return true;
  }

  const { error } = await supabase
    .from(ref.table)
    .update(data)
    .eq("id", ref.id);

  if (error) throw error;
  return true;
};

window.onSnapshot = function (ref, callback) {
  window.getDoc(ref).then(callback).catch(console.error);

  const channel = supabase
    .channel(`${ref.table}:${ref.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: ref.table,
        filter: ref.table === "memoria_ia"
          ? `chave=eq.${ref.id}`
          : `id=eq.${ref.id}`
      },
      async () => {
        try {
          const snap = await window.getDoc(ref);
          callback(snap);
        } catch (e) {
          console.error("Erro no realtime Supabase:", e);
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};

window.collection = function (_db, table) {
  return { table: normalizeTable(table) };
};

window.supabaseReady = Promise.resolve(true);

console.log("✅ Supabase adaptador pronto:", {
  url: SUPABASE_URL,
  userId: window.userId,
  db: !!window.db,
  doc: !!window.doc,
  getDoc: !!window.getDoc,
  setDoc: !!window.setDoc,
  updateDoc: !!window.updateDoc,
  onSnapshot: !!window.onSnapshot
});

try {
  if (typeof forceSyncAIProfiles === "function") {
    forceSyncAIProfiles();
  }
} catch (e) {
  console.warn("Falha ao sincronizar perfis de IA após Supabase pronto:", e);
}
