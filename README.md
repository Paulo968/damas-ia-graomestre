# 🤖♟️ Damas vs IA — Nível Grão-Mestre Reflexiva  
IA adaptativa com aprendizado, reflexões e emoções em tempo real.

🎮 **[Jogar Agora](https://paulo968.github.io/damas-ia-graomestre/)**  
[![GitHub Pages](https://img.shields.io/badge/Online-Damas%20vs%20IA-brightgreen?style=for-the-badge&logo=github)](https://paulo968.github.io/damas-ia-graomestre/)  
![IA Adaptativa](https://img.shields.io/badge/IA%20Adaptativa-Ativa-blue?style=for-the-badge&logo=python)  
![Análise Automática](https://img.shields.io/badge/An%C3%A1lise%20Autom%C3%A1tica-Ativa-green?style=for-the-badge&logo=codeium)

---

<p align="center">
  <img src="capa.png" alt="Capa do Projeto" width="720">
</p>

---

## 🇧🇷 Versão em Português

### 🧠 Sobre o Projeto
Bem-vindo(a) ao **Damas vs IA**, um projeto que combina **inteligência artificial adaptativa**, **aprendizado dinâmico** e **emoções simuladas**.  
Aqui, a IA **pensa, reage e evolui a cada partida** — alcançando o verdadeiro nível *Grão-Mestre*.

Este jogo de Damas foi desenvolvido em **JavaScript puro**, com um motor de IA que:

- Aprende com vitórias e derrotas (ajustando agressividade);  
- Analisa jogadas com **Minimax + poda Alpha-Beta**;  
- Usa **Aprofundamento Iterativo (IDS)** para pensar dentro do tempo limite;  
- Expressa emoções e reflexões analíticas em tempo real;  
- Aplica **heurísticas evolutivas** com foco em posição, mobilidade e controle do centro.

💬 A IA comenta suas decisões:
> "Promoção alcançada. A supremacia de alcance está garantida."  
> “Você caiu na armadilha... desde o início!”

---

## 🧩 Inteligência Adaptativa — Estrutura Técnica
A IA combina **velocidade e estratégia real**, unindo pensamento estratégico e comportamento dinâmico.

### ⚙️ Núcleo de Decisão
1. **Minimax com poda Alpha-Beta** — garante decisões racionais dentro do limite de tempo.  
2. **Aprofundamento Iterativo (IDS)** — a IA pensa o máximo possível dentro de 1 segundo, sem travar.  
3. **Heurística Adaptativa** — muda o estilo de jogo conforme a fase da partida e os erros do jogador.

#### 💡 Aprofundamento Iterativo (IDS)
```js
for (let d = 2; d <= 22; d++) {
  if (performance.now() - startTime > 1000) break;
}
Esse loop faz a IA pensar até 1 segundo por jogada, prevendo de 2 a 22 camadas à frente —
mantendo o raciocínio profundo e a resposta instantânea.

📊 Exemplo de Análise Pós-Partida
Após cada partida, a IA gera um feedback técnico automático, avaliando o desempenho com base em estratégia, controle e ritmo de jogo.

<p align="center"> <img src="https://raw.githubusercontent.com/Paulo968/damas-ia-graomestre/master/1.png" alt="Análise da Partida — Exemplo" width="420" style="border-radius:12px; box-shadow:0 0 15px rgba(0,0,0,0.25);"> </p>
🧠 A análise identifica:

Oscilações de vantagem (instabilidade estratégica);

Controle de material e promoções;

Ritmo de jogo e duração da partida;

Dicas de melhoria adaptadas ao estilo do jogador.

💬 Exemplo real da IA:

• Boa vantagem material — controle sólido do tabuleiro.
• Observe o controle de centro da IA — evitar recuar demais nas aberturas.

🧮 Heurística de Avaliação
A função evalBoard() calcula a força do tabuleiro com base em:

Controle de centro

Mobilidade das peças

Avanço e promoção

Proteção mútua

Fase do jogo (abertura, meio, final)

Agressividade adaptativa

Essa combinação cria decisões inteligentes, realistas e imprevisíveis.

🔁 Aprendizado entre Partidas
A IA ajusta seu comportamento conforme ganha ou perde:

js
Copiar código
if(result === 'win')  aiProfile.agg = Math.max(0.1, aiProfile.agg - 0.05);
if(result === 'lose') aiProfile.agg = Math.min(0.9, aiProfile.agg + 0.1);
Ela se torna mais calma quando vence e mais agressiva quando perde — simulando aprendizado real.

🤖 Emoções e Reflexões
Durante o jogo, a IA expressa “pensamentos” e reações contextuais:

"Analisando o ritmo do jogo."
"A vantagem posicional está se consolidando."
"Derrota inesperada. Ajustando parâmetros."

Essas falas tornam o desafio mais imersivo e humano.

⚙️ Tecnologias Utilizadas
Tecnologia	Função
HTML5 / TailwindCSS	Interface moderna e responsiva
JavaScript (ES6)	Motor principal e IA
API Web Worker	Processamento paralelo
Armazenamento local	Memória e aprendizagem adaptativa
API de áudio	Sons de jogo
Emoções Dinâmicas	Expressões e falas da IA

🧩 Recursos Avançados da IA
🧮 Zobrist Hashing (planejado) — cache rápido e sem colisões

🧠 Self-Play Training (experimental) — IA treinando contra si mesma

⏱️ Alocação Dinâmica de Tempo — tempo variável por jogada

🧬 Avaliação Neural (futuro) — heurística via rede neural leve

🏆 Destaques
⚡ IA ultra-rápida e adaptável

🎓 Aprendizado com base em resultados

💬 Modo Reflexivo com falas inteligentes

👑 Promoções animadas

💥 Efeitos sonoros e visuais de impacto

🧑‍💻 Autor
Paulo Zaqueu
Desenvolvedor independente apaixonado por IA e jogos estratégicos.

"Cada jogo é um cálculo. Cada vitória, uma evolução."

📧 paulozaqueu3@gmail.com
🔗 GitHub

🧬 Licença
Este projeto é de código aberto sob a Licença MIT.
Sinta-se à vontade para estudá-lo, modificá-lo e aprimorá-lo — apenas mantenha os créditos.

🇬🇧 English Version
🧠 About the Project
Welcome to Checkers vs AI, a project that merges adaptive intelligence, dynamic learning, and simulated emotions.
Here, the AI thinks, reacts, and evolves after every match — reaching true Grandmaster level.

Developed entirely in pure JavaScript, this engine:

Learns from wins and losses (adjusting aggressiveness);

Thinks using Minimax + Alpha-Beta pruning;

Uses Iterative Deepening Search (IDS) to stay within time limits;

Expresses emotions and reflections in real time;

Applies evolutionary heuristics focused on position, mobility, and board control.

💬 The AI explains its reasoning:

"Promotion achieved. Range supremacy guaranteed."
"You fell into my trap... from the very start."

📊 Example of Post-Match Analysis
After each match, the AI produces a technical feedback summary, evaluating performance, control, and rhythm.

<p align="center"> <img src="https://raw.githubusercontent.com/Paulo968/damas-ia-graomestre/master/1.png" alt="Match Analysis Example" width="420" style="border-radius:12px; box-shadow:0 0 15px rgba(0,0,0,0.25);"> </p>
🧠 The analysis identifies:

Advantage swings (strategic instability);

Material control and promotions;

Game pace and move length;

Personalized improvement tips.

💬 Example:

• Strong material advantage — solid board control.
• Watch AI’s center control — avoid retreating too early in openings.

🧩 Technologies Used
Technology	Purpose
HTML5 / TailwindCSS	Modern and responsive UI
JavaScript (ES6)	Core logic and AI engine
Web Worker API	Parallel computation
Local Storage	Persistent adaptive learning
Audio API	Game effects
Dynamic Emotions	AI expressions and reflections

🧑‍💻 Author
Paulo Zaqueu
Independent developer passionate about AI and strategic gameplay.

“Every move is a calculation. Every victory, an evolution.”

📧 paulozaqueu3@gmail.com
🔗 GitHub

🧬 License
This project is open source under the MIT License.
Feel free to study, modify, and improve it — just keep the credits.
