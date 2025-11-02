// NOTA: Estas importações podem precisar de URLs atualizadas dependendo da versão do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
// 🐞 CORREÇÃO: Importar signInWithCustomToken
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// Configuração global do Firebase (use as variáveis de ambiente __firebase_config se disponível)
// ✏️ PASSO 2 (HTML) - Bloco substituído conforme pedido
const firebaseConfig = {
  apiKey: "AIzaSyA6G1M1oUzQ-A-NkFYyrAjMwBRJEhLG3sI",
  authDomain: "meu-jogo-damas.firebaseapp.com",
  projectId: "meu-jogo-damas",
  storageBucket: "meu-jogo-damas.firebasestorage.app",
  messagingSenderId: "583407551751",
  appId: "1:583407551751:web:0f610a1494f40d59c7b1a2"
};

// ID da Aplicação (use a variável de ambiente __app_id se disponível)
// ✏️ Modificado para não depender do __app_id
const appId = 'default-app-id';

let db, auth, userId;

try {
  // 🚀 Inicializa o Firebase
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  
  // 🐞 CORREÇÃO: Autenticar com o token customizado do Canvas, ou anonimamente como fallback.
  // O token customizado é necessário para permissões de escrita/leitura.
  // ✏️ MODIFICADO: Como uma configuração manual do Firebase está sendo usada,
  // não podemos usar o __initial_auth_token (que é para outro projeto).
  // Forçamos a autenticação anônima para este projeto.
  await signInAnonymously(auth);
  
  // Removido o bloco 'if' que causava o erro 'auth/custom-token-mismatch'
  /*
  if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
    await signInWithCustomToken(auth, __initial_auth_token);
  } else {
    await signInAnonymously(auth);
  }
  */
  userId = auth.currentUser ? auth.currentUser.uid : 'anon-' + Math.random().toString(36).substring(2, 9);
  
  console.log("Firebase inicializado. AppID:", appId, "UserID:", userId);

} catch (error) {
  console.error("Falha ao inicializar o Firebase:", error);
  // Informa ao usuário que o modo online não funcionará
  // (Você pode querer usar um modal customizado aqui)
  alert("Erro ao conectar ao servidor. O modo online não funcionará.");
}

// 🔄 Deixa visível pro código principal
// As atribuições 'window.' foram removidas
export { db, doc, setDoc, getDoc, onSnapshot, updateDoc, appId, userId, auth };