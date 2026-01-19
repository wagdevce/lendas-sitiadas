

# 📘 Documentação Técnica: Lendas Sitiadas (Engine v0.5)

> **Versão da Engine:** 0.5 (State-Driven)
> **Arquitetura:** MVC (Model-View-Controller) adaptado para Vanilla JS
> **Padrão de Design:** Single Source of Truth (Fonte Única da Verdade)

---

## 1. Arquitetura do Sistema

O projeto não manipula o HTML diretamente para guardar informações. Em vez disso, ele utiliza um padrão onde **o Estado (Dados) dita a Interface (Visual)**.

### 1.1 O "Cérebro" (`GameState`)

Localizado no topo do `script.js`, o objeto `GameState` é a memória do jogo. Nada acontece no jogo sem que este objeto seja alterado primeiro.

* **`config`**: Configurações globais (máximo de monstros, modo debug).
* **`status`**: Variáveis que mudam a cada turno (Turno atual, % de Corrupção, Game Over).
* **`entidades`**: Arrays dinâmicos que guardam o que existe na mesa agora.
* `herois`: Lista de strings (ex: `["Saci", "Boitatá"]`).
* `monstros`: Lista de objetos (cada inimigo vivo).
* `inventario`: Lista de objetos (itens coletados).


* **`crise`**: Gerencia o estado da missão temporária (Timer, Alvos, Tipo).

### 1.2 Separação de Responsabilidades

1. **MODEL (Dados Estáticos):** O arquivo `data.js` contém as "Regras Imutáveis". Ele diz quanto dano a habilidade do Saci causa ou o que um item faz. O código apenas lê isso, nunca altera.
2. **CONTROLLER (Lógica):** O `script.js` contém as funções que alteram o `GameState` (ex: `ataqueBasico`, `proximoTurno`).
3. **VIEW (Renderização):** Funções como `renderLista()` e `renderInventario()` apagam o HTML antigo e desenham um novo baseado no estado atual do `GameState`.

---

## 2. Dicionário de Módulos e Funções

### 2.1 Módulo de Loop de Jogo (Game Loop)

Responsável por fazer o tempo passar e gerar desafios procedurais.

| Função | Descrição Técnica | Integração |
| --- | --- | --- |
| **`proximoTurno()`** | O coração da engine. Incrementa `GameState.status.turno`, reduz timers de Crise e decide eventos aleatórios. | Chama `spawnMonstro()` ou aciona eventos de `eventosDB`. Atualiza a UI da Corrupção. |
| **`spawnMonstro(nome, hp, msg, loc)`** | Factory Function. Cria uma nova instância de monstro, atribui um ID único (`counters.idMonstro`) e insere no array `entidades.monstros`. | Acionada automaticamente pelo `proximoTurno()` ou manualmente por eventos de Crise. |
| **`renderLista()`** | Função de renderização declarativa. Limpa a `div` da lista de ameaças e recria o HTML de todos os monstros vivos, agrupando-os por Zona. | Chamada sempre que um monstro morre ou nasce. |

### 2.2 Módulo de Combate (Encapsulado)

O combate roda em um "Mini-Estado" isolado chamado `CombatState`. Isso evita poluir o `GameState` principal com dados temporários de uma luta.

* **Objeto `CombatState**`: Armazena quem é o inimigo atual e os status temporários (`stun`, `bleed`, `burn`, `fragile`).

| Função | Descrição Técnica | Integração |
| --- | --- | --- |
| **`abrirCombate(id)`** | Busca o monstro pelo ID no `GameState`, reseta o `CombatState`, carrega os dados e exibe o Modal. | Conecta a Lista de Monstros (UI) à Lógica de Combate. |
| **`ataqueBasico()`** | Lê os inputs numéricos (DOM), calcula acertos (4+) e verifica Críticos (Dados Iguais). Se houver Crítico, consulta `heroisDB` para aplicar efeitos passivos (ex: Sangramento da Caipora). | Altera `CombatState.status` e reduz `CombatState.inimigo.hp`. |
| **`usarHabilidade()`** | Consulta o `heroisDB` baseado no herói selecionado. Aplica dano direto ou seta status (`CombatState.status.stun = true`). | Exige confirmação de custo físico (Energy Management Híbrido). |
| **`turnoVilao()`** | A "Inteligência Artificial". Verifica se está atordoado (pula turno) ou sangrando (toma dano) antes de rodar o ataque. | Modifica o HP do herói (físico/narrativo) ou do próprio monstro (sangramento). |

### 2.3 Módulo de Persistência (Save System)

Permite salvar o estado complexo do jogo no navegador.

| Função | Descrição Técnica |
| --- | --- |
| **`salvarJogo()`** | Serializa o objeto `GameState` inteiro para uma string JSON e salva no `localStorage` com a chave `'lendas_save_v1'`. |
| **`carregarJogo()`** | Recupera a string, faz o parse para JSON e usa `Object.assign` para sobrescrever o `GameState` atual com os dados salvos. Em seguida, força a re-renderização de todas as telas. |

---

## 3. Fluxo de Dados: Exemplos Práticos

Para entender como o código conecta as partes, veja o caminho que a informação percorre em duas situações comuns:

### Cenário A: O Ataque Crítico da Caipora

1. **Input:** O jogador rola dados físicos (5, 5), digita no App e clica em "Resolver Dados".
2. **Lógica (`ataqueBasico`):**
* Detecta `isCritico = true`.
* Identifica o herói ativo: "Caipora".
* Consulta `heroisDB["Caipora"]` e encontra `onCrit: "bleed"` e `onCritTurns: 3`.
* Atualiza o estado: `CombatState.status.bleed = 3`.


3. **Feedback (UI):** Exibe "💥 CRÍTICO! 🩸 SANGRANDO (3T)" na tela e adiciona o ícone de sangue no título do modal.

### Cenário B: O Turno do Vilão Sangrando

1. **Gatilho:** Jogador clica em "👹 ATAQUE VILÃO".
2. **IA (`turnoVilao`):**
* Verifica `CombatState.status.bleed > 0`.
* **Ação:** Reduz HP do monstro (`inimigo.hp -= 1`) e decrementa o contador (`bleed--`).
* **Verificação de Morte:** Se HP <= 0, chama `finalizarVitoria()` imediatamente, cancelando o ataque do vilão.


3. **Ataque:** Se sobreviver, calcula o dano aleatório e exibe na tela.

---

## 4. Estrutura do Banco de Dados (`data.js`)

O arquivo `data.js` alimenta toda a inteligência do jogo.

### `heroisDB` (Definição de Classes)

Cada chave (ex: "Saci") contém:

* `role`: Papel na equipe (ex: "Controle").
* `onCrit`: Status aplicado automaticamente no crítico (ex: "stun").
* `skillName`: Nome da habilidade Ultimate.
* `statusApply`: Qual status a Ultimate aplica (ex: "stun").
* `cost`: Texto descritivo do custo físico (ex: "2 Energias ⚡⚡").

### `lootDB` (Itens)

* `tier`: Define a raridade (comum, raro, epico, lendario, missao).
* `effect`: Descrição textual.
* **Nota:** A lógica funcional dos itens está no `script.js` dentro do objeto `ItemEffects` (Padrão Strategy).

---

## 5. Como Manter e Expandir

### Adicionar um Novo Monstro

Basta adicionar um objeto na lista `monstrosDB` em `data.js`:

```javascript
{ nome: "Mula Sem Cabeça", hp: 6 }

```

### Adicionar um Novo Item

1. Adicione os dados em `lootDB` no `data.js`.
2. Adicione a lógica do efeito em `ItemEffects` no `script.js`.

### Criar uma Nova Crise

Adicione um objeto em `crisesDB` no `script.js` definindo:

* `prazo`: Quantos turnos para explodir.
* `spawn`: Quais monstros e onde eles nascem.

---

## 6. Instalação e Execução

Como o projeto é **Vanilla JS** (sem dependências de build), a execução é imediata:

1. Certifique-se de que os arquivos `index.html`, `style.css`, `script.js` e `data.js` estão na mesma pasta.
2. Crie uma pasta `assets/` e coloque os arquivos de áudio (.mp3).
3. Abra o `index.html` em qualquer navegador moderno (Chrome, Firefox, Edge).
4. Recomendado usar a extensão **Live Server** do VS Code para evitar bloqueios de CORS locais, embora não seja estritamente necessário para esta versão.

---

*Documentação gerada automaticamente para o projeto Lendas Sitiadas.*