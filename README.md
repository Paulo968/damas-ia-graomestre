🧠 Damas vs IA – Inteligência Adaptativa, Evolutiva e Estratégica

Um sistema avançado de Inteligência Artificial para Damas, capaz de aprender, evoluir, refletir, criar cercos, armadilhas e estratégias em dupla, além de armazenar sua inteligência na nuvem via Firebase.

<img src="capa.png" alt="Capa do Projeto" width="600"/>
🎮 Jogar Agora

🔗 GitHub Pages: https://paulo968.github.io/damas-ia-graomestre/

♟️ Modo IA vs Jogador
🤖 Modo IA vs IA (Treino Evolutivo)
🌐 Modo Online via Firebase

🚀 Destaques

🧠 IA adaptativa real (aprende com vitórias/derrotas)

🔥 Treino próprio IA vs IA para evolução constante

♟ Heurística avançada: centro, mobilidade, cerco, armadilhas, jogo em dupla

⚡ Minimax + Alpha-Beta + IDS (Iterative Deepening)

💬 Reflexões e emoções dinâmicas

🧬 Memória neural persistente (Firebase Firestore)

🎚 Personalidade dinâmica (agressivo/defensivo/equilibrado)

🎮 Modo online real-time sincronizado

🎨 Interface moderna com Tailwind + áudio + animações

🧩 Sobre o Projeto

Este projeto cria uma IA viva, que:

Pensa profundamente

Ajusta personalidade

Cria cercos e armadilhas

Joga em dupla com sinergia

Aprende com erros

Evolui entre partidas

Salva sua inteligência na nuvem

“Cada jogo é uma lição. Cada vitória, uma evolução.”

🧠 Arquitetura da Inteligência Artificial
⚙️ Núcleo de Decisão
🔹 Minimax + Alpha-Beta

Garantia de decisões racionais e rápidas.

🔹 Aprofundamento Iterativo (IDS)

Até 1 segundo de reflexão por jogada:

for (let d = 2; d <= 22; d++) {
  if (performance.now() - startTime > 1000) break;
}

🔹 Heurística Evolutiva

A IA analisa:

Centro do tabuleiro

Mobilidade

Avanço

Promoções

Proteção mútua

Fase do jogo

Cerco e armadilhas

Sinergia entre peças (duplas)

Estilo adaptativo

♟️ IA Estratégica – Cerco, Armadilha e Duplas
🟢 Sinergia em Dupla

Peças coordenadas recebem pontuação extra.

🔴 Cercos

Quando 2+ peças cercam um inimigo pelas diagonais, o sistema reconhece e premia.

🟡 Armadilhas

Identificação de iscas, recuos estratégicos e manipulação tática.

Essas técnicas deixam a IA extremamente humana e inteligente.

🔁 Inteligência Evolutiva

A IA ajusta agressividade com base nas partidas:

if (result === 'win')  aiProfile.agg -= 0.05;
if (result === 'lose') aiProfile.agg += 0.10;


E evolui via:

Perfis dinâmicos

Pesos neurais

Memória tática

Treino IA vs IA

Salvamento no Firebase

🔥 Firebase – Memória Neural Persistente

A IA salva sua inteligência na nuvem:

✔️ Dados salvos:

neural_w

neural_r

patternMemory

aiProfile

Parâmetros de treino

✔️ Carregamento Automático

Ao abrir, o jogo baixa a inteligência mais recente.

✔️ Regras Usadas:
match /ia/{docId} {
  allow read: if true;
  allow write: if true;
}

💬 Emoções e Reflexões

A IA reage:

"Calculando linhas de cerco."

"A vantagem posicional está aumentando."

"Você caiu na minha armadilha."

"Derrota inesperada. Ajustando parâmetros."

Isso cria uma experiência imersiva e única.

📊 Análise Pós-Partida

Após a partida, a IA gera insights:

Oscilações de vantagem

Controle central

Trocas e precisão

Ritmo da partida

Pressão criada

Recomendações

🧑‍💻 Tecnologias Utilizadas
Tecnologia	Função
JavaScript (ES6)	Motor da IA
Web Worker	IA paralela
Firebase Firestore	Memória neural
TailwindCSS	Interface
HTML5 Canvas	Renderização
LocalStorage	Cache
Áudio API	Efeitos sonoros
🔧 Como Instalar

Clone:

git clone https://github.com/Paulo968/damas-ia-graomestre.git


Abra o arquivo:

index.html


Configure seu Firebase se quiser usar o modo online + IA evolutiva.

👑 Autor

Paulo Zaqueu
Desenvolvedor independente apaixonado por IA e jogos estratégicos.

📧 paulozaqueu3@gmail.com

🔗 GitHub: https://github.com/Paulo968

“Cada movimento é um cálculo. Cada vitória, uma evolução.”

🧬 Licença

Projeto sob MIT License.
Utilize, estude, modifique e evolua — mantendo os créditos.
