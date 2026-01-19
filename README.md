# 🌿 Lendas Sitiadas: O Mestre Digital

> **Um Board Game Híbrido onde o Folclore Brasileiro enfrenta a Corrupção Digital.**

![Status](https://img.shields.io/badge/Status-Playable_Alpha-success)
![Tech](https://img.shields.io/badge/Tech-Vanilla_JS_%7C_CSS3-yellow)
![Platform](https://img.shields.io/badge/Plataforma-Web_%2F_Mobile-blue)

## 🎮 A Proposta
**Lendas Sitiadas** não é apenas um jogo, é uma experiência híbrida. Ele combina a taticidade física de um jogo de tabuleiro com a agilidade de um aplicativo web.

Você controla entidades lendárias como o **Saci**, a **Iara**, o **Boitatá** e a **Caipora**, lutando para proteger a floresta de uma "Corrupção Digital" invasora (robôs, glitches e poluição).

---

## 📱 A Solução Híbrida: Por que um App?

Jogos de tabuleiro modernos (estilo *Gloomhaven* ou *Zombicide*) sofrem de um problema comum: o **"Bookkeeping"** (microgerenciamento). Jogadores perdem muito tempo calculando vida de inimigos, embaralhando cartas de eventos ou consultando manuais de regras complexos.

**Este Web App resolve isso atuando como o "Mestre do Jogo" (Dungeon Master).**

### O Papel da Aplicação
A aplicação foi desenhada para rodar em um celular ou tablet ao lado do tabuleiro físico. Ela é responsável por:

1.  **Gerenciamento de Estado (State Management):** Controla o HP de todos os monstros, o nível de Corrupção global e os turnos.
2.  **Inteligência Artificial (IA) dos Inimigos:** Decide quem o vilão ataca e quanto dano causa, eliminando a necessidade de um jogador controlar os "maus".
3.  **Narrativa Emergente:** Gera eventos aleatórios, crises e loot de forma procedural, garantindo que nenhuma partida seja igual à outra.
4.  **Cálculo Matemático:** Resolve rolagens de dados complexas e aplica buffs/debuffs automaticamente.

> **Filosofia de Design:** *"Deixe o computador fazer a matemática chata, deixe os jogadores fazerem as escolhas táticas."*

---

## 🛠️ Funcionalidades Técnicas

Este projeto foi construído com **Vanilla JavaScript** moderno, focando em performance e arquitetura limpa, sem dependência de frameworks pesados.

* **Arquitetura State-Driven:** Todo o jogo roda em torno de um objeto central `GameState` (Single Source of Truth), facilitando a depuração e expansão.
* **Sistema de Persistência:** Utiliza `localStorage` para Salvar e Carregar o progresso, permitindo que sessões longas sejam interrompidas e retomadas.
* **Design Responsivo & Temático:** CSS avançado com variáveis (`:root`), animações CSS3 (Keyframes) e estética *Skeuomorphic* (imita pergaminhos e couro) para imersão total.
* **Modularidade:** Código separado em lógica de Combate, Áudio, UI e Dados, seguindo princípios de *Separation of Concerns*.

---

## 🚀 Como Jogar (O Fluxo Híbrido)

### Pré-requisitos
* O Tabuleiro Físico (ou print-and-play).
* Miniaturas ou Tokens dos Heróis.
* Este App aberto em um celular.

### Passo a Passo
1.  **Setup:** Abra o App e selecione quais heróis estarão na mesa (Ex: Saci e Boitatá).
2.  **O Tabuleiro:** Posicione seus bonecos na zona inicial do mapa físico.
3.  **Ação Digital:** No App, o sistema gerará a "Crise" (o objetivo da missão) e dirá onde os monstros surgiram (Ex: "Fogo Fátuo em N1").
4.  **Ação Física:** Coloque os monstros nas zonas indicadas do tabuleiro.
5.  **Combate:** Quando encontrar um monstro, clique em **LUTAR** no App. Role seus dados físicos e insira os resultados no App. O sistema calcula o dano, aplica efeitos e narra o contra-ataque do vilão.

---
💻 Autor
Desenvolvido por [Seu Nome / WagDev]. Estudante de Sistemas de Informação - UFC Quixadá.

Projeto criado para demonstrar domínio em Lógica de Programação, Manipulação de DOM e Game Design.

"O sertão vai virar mar... de dados?" 🎲🌵
## 📂 Estrutura do Projeto

```bash
/
├── index.html      # A estrutura semântica e containers da UI
├── style.css       # Estilização "Folclore Fantasy" e animações
├── script.js       # Core Engine, Game Loop e Lógica de Estado
├── data.js         # "Banco de Dados" JSON (Monstros, Itens, Eventos)
└── assets/         # Áudios e Imagens


💻 Autor
Desenvolvido por Wagner Marques / WagDev. Estudante de Sistemas de Informação - UFC Quixadá.

Projeto criado para demonstrar domínio em Lógica de Programação, Manipulação de DOM e Game Design.

"O sertão vai virar mar... de dados?" 🎲🌵