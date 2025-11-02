// ======================================
// FIREBASE.JS
// (Atualizado com ferramentas de Query)
// ======================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, 
  collection, addDoc, query, where, getDocs // 🔧 ADICIONADO
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { 
  getAuth, signInAnonymously 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA6G1M1oUzQ-A-NkFYyrAjMwBRJEhLG3sI",
  authDomain: "meu-jogo-damas.firebaseapp.com",
  projectId: "meu-jogo-damas",
  storageBucket: "meu-jogo-damas.firebasestorage.app",
  messagingSenderId: "583407551751",
  appId: "1:583407551751:web:0f610a1494f40d59c7b1a2"
};

const appId = 'default-app-id';

let db, auth, userId;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  
  await signInAnonymously(auth);
  
  userId = auth.currentUser ? auth.currentUser.uid : 'anon-' + Math.random().toString(36).substring(2, 9);
  
  console.log("Firebase inicializado. AppID:", appId, "UserID:", userId);

} catch (error) {
  console.error("Falha ao inicializar o Firebase:", error);
  alert("Erro ao conectar ao servidor. O modo online não funcionará.");
}

// 🔄 Exporta TUDO que vamos precisar
export { 
  db, auth, userId, appId,
  doc, setDoc, getDoc, onSnapshot, updateDoc, 
  collection, addDoc, query, where, getDocs // 🔧 ADICIONADO
};