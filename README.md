🤖♟️ Damas vs IA — Nível Grão-Mestre Reflexiva

IA adaptativa com aprendizado, reflexões e emoções em tempo real.

🎮 Jogar Agora







<p align="center"> <img src="capa.png" alt="Capa do Projeto" width="720"> </p>
🇧🇷 Versão em Português
🧠 Sobre o Projeto

Damas vs IA é mais que um jogo — é uma simulação cognitiva.
Aqui, a inteligência artificial aprende, reflete e reage às suas decisões.
Ela evolui a cada partida, alterando agressividade, emoção e estratégia em tempo real.

💡 Desenvolvido em JavaScript puro, com uma IA baseada em:

Minimax com poda Alpha-Beta

Aprofundamento Iterativo (IDS)

Heurística adaptativa

Aprendizado simbólico entre partidas

💬 A IA pensa e fala:

“A vantagem posicional está se consolidando.”
“Você caiu na armadilha... desde o início.”
“Derrota inesperada. Ajustando parâmetros.”

⚙️ Arquitetura da Inteligência Artificial

A IA é formada por 4 camadas cognitivas que simulam raciocínio humano:

Camada	Descrição	Tipo
🧮 Núcleo Decisório (Minimax + Alpha-Beta)	Calcula a melhor jogada dentro de limites de tempo	Estratégica
⏳ Aprofundamento Iterativo (IDS)	Aumenta a profundidade enquanto houver tempo disponível	Temporal
🧠 Heurística Adaptativa	Ajusta agressividade, mobilidade e prioridades conforme contexto	Comportamental
💬 Camada Emocional Reflexiva	Gera falas, reações e "análises humanas"	Expressiva
💡 Aprofundamento Iterativo (IDS)

O motor cognitivo da IA raciocina progressivamente:

for (let d = 2; d <= 22; d++) {
  if (performance.now() - startTime > 1000) break;
}


Ela pensa até 1 segundo por jogada, analisando de 2 a 22 camadas de profundidade,
o que permite respostas rápidas e profundas ao mesmo tempo.

🧮 Heurística de Avaliação

A função evalBoard() analisa a força do tabuleiro considerando:

Critério	Descrição
Controle de Centro	Domínio posicional
Mobilidade	Quantidade de opções de movimento
Promoção	Potencial de virada e alcance
Proteção Mútua	Peças cobertas e seguras
Fase do Jogo	Abertura, meio e final
Agressividade Adaptativa	Peso dinâmico conforme o desempenho

Essa heurística cria um comportamento natural, estratégico e imprevisível —
a IA pensa, mas também sente o jogo.

🔁 Aprendizado entre Partidas

A IA lembra suas vitórias e derrotas e ajusta o perfil:

if(result === 'win')  aiProfile.agg = Math.max(0.1, aiProfile.agg - 0.05);
if(result === 'lose') aiProfile.agg = Math.min(0.9, aiProfile.agg + 0.1);


Quando vence, joga mais técnica e fria.

Quando perde, torna-se ousada e imprevisível.
Os parâmetros ficam salvos no navegador via localStorage, garantindo aprendizado real.

🗣️ Emoções e Reflexões Dinâmicas

A IA reage de forma contextual:

Situação	Reação
Pensando	🤔 “Analisando o ritmo do jogo.”
Em vantagem	😎 “Estou duas jogadas à frente.”
Em desvantagem	😐 “Desvantagem detectada. Adaptando parâmetros.”
Promoção	👑 “Transformação inevitável — o tabuleiro se expande.”
Vitória	🏆 “Execução concluída. Tabuleiro dominado.”
Derrota	🩹 “Erro detectado. Registrando aprendizado.”

💬 Ela se comporta como um verdadeiro rival reflexivo — comenta, provoca e analisa.

📊 Análise Pós-Jogo (Nova Função)

Ao final da partida, a IA realiza uma análise técnica e emocional:

Mede variações de vantagem;

Detecta falhas estratégicas;

Gera feedbacks personalizados baseados no histórico.

Exemplo de Análise:

• Muitas oscilações de vantagem — tente manter uma linha estratégica mais estável.
• Partida longa — considere encurtar trocas e forçar o avanço das damas.
• Observe o controle de centro da IA — evitar recuar demais nas aberturas.

Essa análise é gerada localmente, sem servidor, e armazenada junto ao histórico da IA.

🖥️ Interface & Experiência

Design responsivo com TailwindCSS

Rosto animado da IA reagindo às emoções

Falas sincronizadas com contexto e tempo

Efeitos sonoros de movimento, captura e vitória

Transição de fim de jogo com análise reflexiva

<p align="center"> <img src="assets/ui-preview.png" alt="Interface Preview" width="720"> </p>
⚙️ Tecnologias Utilizadas
Tecnologia	Função
HTML5 / TailwindCSS	Interface e layout responsivo
JavaScript (ES6)	Motor principal e lógica da IA
Web Worker API	Processamento paralelo da inteligência
LocalStorage API	Memória e aprendizado persistente
Audio API	Sons e feedback auditivo
Análise Dinâmica Pós-Partida	Geração automática de relatórios de desempenho
🧩 Recursos Avançados e Roadmap

🧮 Zobrist Hashing (planejado) — cache rápido e sem colisões

🧠 Self-Play Training (experimental) — IA treinando contra si mesma

⏱️ Tempo de Pensamento Dinâmico — variação por jogada

🧬 Avaliação Neural (futuro) — rede neural leve aplicada à heurística

📈 Relatórios de Evolução do Jogador — histórico estatístico visual

🧑‍💻 Autor

Paulo Zaqueu
Desenvolvedor independente apaixonado por IA e jogos estratégicos.

“Cada jogo é um cálculo. Cada vitória, uma evolução.”

📧 paulozaqueu3@gmail.com

🔗 GitHub

🧬 Licença

Este projeto é de código aberto sob a Licença MIT.
Sinta-se à vontade para estudar, modificar e aprimorar — apenas mantenha os créditos.

🇬🇧 English Version
🧠 About the Project

Checkers vs AI is an adaptive artificial intelligence experiment —
a self-learning opponent that thinks, reacts, and evolves after each match.

Developed entirely in pure JavaScript, featuring:

Minimax with Alpha-Beta pruning

Iterative Deepening Search (IDS)

Adaptive Heuristics

Persistent learning between matches

💬 AI reflections:

“Promotion achieved. Range supremacy guaranteed.”
“You fell into my trap... from the very start.”
“Unexpected result. Adjusting strategy.”

⚙️ Core Intelligence Layers
Layer	Purpose	Type
Decision Core (Minimax + Alpha-Beta)	Calculates the optimal move	Strategic
Depth Control (IDS)	Time-aware deep reasoning	Optimization
Adaptive Heuristics	Adjusts style based on context	Behavioral
Emotional Engine	Real-time reflections and speech	Expressive
💡 Iterative Deepening
for (let d = 2; d <= 22; d++) {
  if (performance.now() - startTime > 1000) break;
}


The AI thinks up to 1 second per move, analyzing 2–22 layers deep — balancing depth and responsiveness.

🧮 Board Evaluation

Center control

Piece mobility

Promotion potential

Mutual protection

Game phase awareness

Adaptive aggressiveness

🔁 Learning Between Matches
if(result === 'win')  aiProfile.agg = Math.max(0.1, aiProfile.agg - 0.05);
if(result === 'lose') aiProfile.agg = Math.min(0.9, aiProfile.agg + 0.1);


When the AI wins, it becomes calmer; when it loses, bolder.
It remembers — adapting with every match.

🧩 Post-Game Analysis

After each match, the AI generates a contextual feedback report:

“Many advantage swings — try to maintain positional stability.”
“Your control of the center forced me into passive play.”
“Excellent tempo — you dictated the rhythm.”

🧠 Technologies Used
Technology	Purpose
HTML5 / TailwindCSS	Responsive modern UI
JavaScript (ES6)	Core logic and AI engine
Web Worker API	Parallel processing
LocalStorage	Adaptive learning memory
Audio API	Sound feedback
Post-Game Analysis	Self-reflection and performance insights
🏆 Highlights

⚡ Ultra-fast and adaptive AI

🧠 Self-evolving opponent

💬 Reflective mode with contextual dialogue

👑 Realistic animations and promotions

💥 Immersive visual and sound effects

🧑‍💻 Author

Paulo Zaqueu
Independent developer passionate about AI and strategic gameplay.

“Every move is a calculation. Every victory, an evolution.”

📧 paulozaqueu3@gmail.com

🔗 GitHub

🧬 License

This project is open source under the MIT License.
Feel free to study, modify, and improve — just keep the credits.

💎 Versão atual: IA Grão-Mestre Reflexiva v3.0
📅 Última atualização: Outubro de 2025
🧩 Status: Estável e otimizada
