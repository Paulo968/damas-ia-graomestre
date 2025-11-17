🧠 Damas Grão-Mestre: IA Estratégica com Aprendizado na Nuvem

Este projeto vai além de um simples jogo de damas. É um sistema de inteligência artificial com um "cérebro" centralizado na nuvem (Firebase) que aprende coletivamente com cada partida jogada.

A IA é capaz de refletir, criar cercos, armadilhas, estratégias de jogo em dupla e evoluir constantemente através de um modo de treino dedicado (IA vs IA).

🎮 Modos de Jogo

♟️ Modo IA vs Jogador

🤖 Modo IA vs IA (Treino)

🌐 Modo Online (Firebase)

Jogue contra o cérebro central da IA.

Observe a IA jogar contra si mesma para treinar e evoluir o cérebro na nuvem.

Jogue com um amigo em tempo real.

Jogue agora: https://paulo968.github.io/damas-ia-graomestre/

(Recomendo adicionar um GIF de 10 segundos do gameplay aqui)

🛠️ Stack de Tecnologia

Categoria

Tecnologia

Função

Front-End

JavaScript (ES6+)

Motor principal do jogo, lógica e manipulação do DOM.



HTML5 / CSS3

Estrutura e layout da interface.



TailwindCSS

Framework de estilização para uma UI moderna e responsiva.

Back-End

Firebase Firestore

"Cérebro" da IA: armazena pesos neurais, perfis e memória de padrões.



Firebase Auth

Autenticação anônima de usuários para o modo online.

IA & Performance

Web Workers

Executa o algoritmo Minimax da IA em uma thread paralela, sem travar a interface.

⚙️ Arquitetura da Inteligência

A IA evoluiu de um protótipo offline (index1.html) para um sistema de ML distribuído (index.html). A arquitetura de aprendizado possui várias camadas:

Cérebro Centralizado (Firestore):
Diferente de um aprendizado em localStorage (preso ao navegador), o cérebro da IA (perfis, pesos neurais, memória) vive no Firestore. Cada vez que um jogo termina, o cérebro central é atualizado, e cada novo jogador baixa a versão mais "inteligente" da IA.

Perfis Duplos (Brancas vs. Vermelhas):
A IA aprende de forma independente a jogar de Brancas (aiProfile_w) e Vermelhas (aiProfile_r), ajustando seus parâmetros de agressividade e defesa com base em vitórias e derrotas para cada lado.

Heurística Neural (Pesos Ajustáveis):
A IA usa um vetor de 4 características (material, reis, centro, mobilidade) e ajusta os "pesos" desses vetores (neuralWeights) após cada partida, aprendendo o valor real de cada estratégia.

Memória de Padrões (Hashing):
O tabuleiro é "hasheado" (transformado em uma string única) a cada movimento. A IA armazena posições que levaram a vitórias ou derrotas e usa essa memória (patternBias) para evitar repetir erros táticos.

Heurística Tática Avançada (Sua visão!):
A IA não avalia só o básico. A heurística (evalBoard) foi treinada para identificar e valorizar:

Cercos e Armadilhas: Posições onde peças inimigas estão sendo "prensadas" ou têm pouca mobilidade.

Sinergia de Dupla: Peças que se protegem mutuamente (jogo em dupla) recebem um bônus de avaliação.

Estratégia de Fase: A IA entende que no meio-jogo deve "Dominar" (manter peças), mas em um final claro (ex: 4x2), ela entra em "Modo Finalizador" e foca em simplificar trocas para garantir a vitória.

🔁 Como Funciona o Aprendizado Evolutivo

O "cérebro" da IA evolui ativamente de duas maneiras:

Aprendizado Coletivo (Jogos Normais):

Um jogador (Humano vs IA) termina uma partida.

O jogo chama updateAIProfile(winner) e adjustNeuralWeights(winner).

O jogo envia os movimentos para o Worker (action: 'memorize').

A função salvarInteligenciaIA() é chamada, atualizando o cérebro central no Firestore com essa nova "lição".

Aprendizado Acelerado (Modo Treino 🤖 IA vs IA):

Este modo executa o "Aprendizado Coletivo" (acima) de forma automática e em alta velocidade.

A IA Branca joga contra a IA Vermelha, ambas usando o mesmo cérebro central.

No final da partida, o cérebro no Firestore é atualizado com a lição aprendida.

Isso permite que a IA jogue milhares de partidas contra si mesma, refinando seus pesos neurais e memória de padrões de forma muito mais rápida.

🚀 Como Rodar o Projeto

Clone o repositório:

git clone [https://github.com/Paulo968/damas-ia-graomestre.git](https://github.com/Paulo968/damas-ia-graomestre.git)


Abra o arquivo:

Para o jogo offline simples (protótipo), abra index1.html.

Para o sistema completo (sem o modo online e aprendizado), basta abrir index.html no navegador.

(Opcional) Para Evolução da IA e Modo Online:

Você precisará criar seu próprio projeto no Firebase.

Copie suas chaves de configuração do Firebase para o Bloco 1 (firebase.js) no index.html.

Configure as regras de segurança do seu Firestore (recomenda-se allow read, write: if request.auth != null; para usuários autenticados).

👑 Autor

Paulo Zaqueu





Desenvolvedor independente apaixonado por IA e jogos estratégicos.

📧 paulozaqueu3@gmail.com





🔗 GitHub: https://github.com/Paulo968

🧬 Licença

Este projeto está sob a licença MIT. Sinta-se à vontade para utilizar, estudar, modificar e evoluir o código, mantendo os devidos créditos.
