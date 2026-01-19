/* ==========================================================================
   LENDAS SITIADAS - ENGINE V0.5 (STATE-DRIVEN)
   Autor: Wagner Marques
   Descrição: Core Engine controlando Estado, Turnos, Combate e UI.
   ========================================================================== */

/**
 * 1. GAME STATE (FONTE ÚNICA DA VERDADE)
 * Este objeto armazena TODO o estado do jogo. 
 * Se algo não está aqui, não existe para a lógica do jogo.
 * O HTML é apenas um reflexo visual (View) destes dados (Model).
 */
const GameState = {
    // Configurações que não mudam durante a partida
    config: {
        maxMonstros: 7,     // Limite para Game Over por superpopulação
        debugMode: false,   // Ativa ferramentas de trapaça
        itemsPerPage: 4     // Paginação do grimório (futuro)
    },
    // Variáveis que flutuam a cada ação
    status: {
        turno: 1,           // Contador global de tempo
        corrupcao: 0,       // Barra de progresso da derrota (0-100%)
        gameOver: false     // Trava o jogo se for true
    },
    // Listas dinâmicas de objetos
    entidades: {
        herois: [],       // Nomes dos heróis escolhidos (ex: ["Saci", "Iara"])
        monstros: [],     // Array de objetos de monstros vivos na mesa
        inventario: []    // Array de objetos de itens coletados
    },
    // Estado da Missão Temporária (Crise)
    crise: {
        ativa: false,     // Se tem missão rodando agora
        timer: 0,         // Turnos restantes para falhar
        tipo: null,       // ID da crise (ex: 'fogo')
        alvos: [],        // IDs dos monstros que precisam morrer para completar
        titulo: ""        // Texto para exibir na tela
    },
    // Estado da Interface (Paginação, Menus)
    ui: {
        pageRegras: 1,
        pageItens: 1,
        eventoAtual: null,
        eventosDisponiveis: [] // Cópia dos eventos para não repetir
    },
    // Gerador de IDs únicos (Auto-incremento)
    counters: {
        idMonstro: 0      // Garante que cada monstro tenha ID 1, 2, 3...
    }
};

// --- DADOS ESTÁTICOS (CONSTANTES) ---
// Zonas do Tabuleiro Físico (usado para dizer onde o monstro nasce)
const zonas = ["N1", "N2", "N3", "N4", "NE1", "NE2", "NE3", "CO1", "CO2", "CO3", "SE1", "SE2", "SE3", "S1", "S2", "S3"];
const problemas = ["Queimada", "Garimpo", "Seca", "Desmatamento", "Óleo na Água"];

// Definição das Missões de Crise (Objetivos Temporários)
const crisesDB = [
    { id: 'fogo', titulo: "🔥 O Cerco de Fogo", desc: "Apague os 'Fogos Fátuos' (N1 e S3) antes que se espalhem!", prazo: 3, spawn: [{ nome: "Fogo Fátuo", hp: 3, loc: "N1" }, { nome: "Fogo Fátuo", hp: 3, loc: "S3" }] },
    { id: 'torre', titulo: "🚫 Bloqueio de Sinal", desc: "Tecnologia hostil detectada! Destrua os 2 'Inibidores'!", prazo: 4, spawn: [{ nome: "Inibidor de Frequência", hp: 3, loc: "CO2" }, { nome: "Inibidor de Frequência", hp: 3, loc: "CO3" }] },
    { id: 'curupira', titulo: "🆘 Resgate do Curupira", desc: "Salve o aliado em NE2 matando os 2 'Rastros'!", prazo: 3, spawn: [{ nome: "Rastro de Pólvora", hp: 3, loc: "NE2" }, { nome: "Rastro de Pólvora", hp: 3, loc: "NE2" }] },
    { id: 'oleo', titulo: "☣️ Maré Negra", desc: "Derrote a 'Lama Tóxica' (S2) antes que ela polua tudo!", prazo: 4, spawn: [{ nome: "Lama Tóxica", hp: 4, loc: "S2" }] }
];

// Variável global para compatibilidade (guarda quem está lutando agora)
let monstroCombateAtual = null;

// --- 2. SISTEMA DE ÁUDIO (LIMPO) ---
// Objeto Singleton para gerenciar sons e música sem sobreposição
const AudioSys = {
    ctx: null, muted: false,
    tracks: { explore: null, common: null, boss: null, victory: null },
    currentTrack: null,

    /** Inicializa o Contexto de Áudio do Navegador (exige interação do usuário) */
    init: function () {
        if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        this.checkResume();
        // Vincula elementos <audio> do HTML
        this.tracks.explore = document.getElementById('bgm-explore');
        this.tracks.common = document.getElementById('bgm-common');
        this.tracks.boss = document.getElementById('bgm-boss');
        this.tracks.victory = document.getElementById('bgm-victory');
        this.setVolume(0.3);
    },
    
    /** Garante que o áudio não esteja suspenso pelo navegador */
    checkResume: function () { if (this.ctx && this.ctx.state === 'suspended') { this.ctx.resume(); } },
    
    /** Gera um beep sintético (Oscilador) para efeitos sonoros leves */
    playTone: function (f, t, d, v = 0.1) {
        if (this.muted || !this.ctx) return; this.checkResume(); try { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = t; o.frequency.setValueAtTime(f, this.ctx.currentTime); g.gain.setValueAtTime(v, this.ctx.currentTime); g.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + d); o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + d); } catch (e) { }
    },
    
    /** Gera ruído branco (chiado) para sons de impacto */
    playNoise: function (d) {
        if (this.muted || !this.ctx) return; this.checkResume(); try { const b = this.ctx.createBuffer(1, this.ctx.sampleRate * d, this.ctx.sampleRate); const data = b.getChannelData(0); for (let i = 0; i < data.length; i++)data[i] = Math.random() * 2 - 1; const n = this.ctx.createBufferSource(); n.buffer = b; const g = this.ctx.createGain(); g.gain.setValueAtTime(0.2, this.ctx.currentTime); g.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + d); n.connect(g); g.connect(this.ctx.destination); n.start(); } catch (e) { }
    },
    
    /** Troca a música de fundo com fade-out (simples) */
    playMusic: function (type) {
        if (this.muted) return; this.checkResume();
        Object.values(this.tracks).forEach(t => { if (t) t.pause(); });
        if (type === 'victory' && this.tracks.victory) this.tracks.victory.currentTime = 0;
        const track = this.tracks[type];
        if (track) { track.play().catch(e => { }); this.currentTrack = track; }
    },
    
    setVolume: function (v) { Object.values(this.tracks).forEach(t => { if (t) t.volume = v; }); },
    
    // Biblioteca de SFX pré-configurados
    sfx: {
        click: () => AudioSys.playTone(800, 'sine', 0.1),
        start: () => { AudioSys.playTone(400, 'square', 0.1); setTimeout(() => AudioSys.playTone(600, 'square', 0.2), 100); },
        alarm: () => { AudioSys.playTone(300, 'sawtooth', 0.3); setTimeout(() => AudioSys.playTone(250, 'sawtooth', 0.3), 150); },
        hit: () => AudioSys.playNoise(0.2),
        crit: () => { AudioSys.playTone(1200, 'triangle', 0.1); setTimeout(() => AudioSys.playTone(1500, 'triangle', 0.3), 100); },
        villain: () => { AudioSys.playTone(100, 'sawtooth', 0.4); setTimeout(() => AudioSys.playNoise(0.3), 100); }
    }
};

// --- 3. FUNÇÕES DE INTERFACE (VIEW) ---
// Controlam a abertura e fechamento de modais e menus laterais

function toggleMenu() { const m = document.getElementById('side-menu'); const o = document.getElementById('overlay'); if (m.classList.contains('open')) { m.classList.remove('open'); o.style.display = 'none'; } else { m.classList.add('open'); o.style.display = 'block'; } }
function toggleRegras() { AudioSys.sfx.click(); const m = document.getElementById('modal-regras'); m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; }
function toggleGrimorio() { AudioSys.sfx.click(); const m = document.getElementById('modal-grimorio'); m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; }
function toggleMorte() { AudioSys.sfx.click(); const m = document.getElementById('modal-morte'); m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; }
function toggleSound() { AudioSys.muted = !AudioSys.muted; document.getElementById('btn-sound').innerText = AudioSys.muted ? '🔇 SFX' : '🔊 SFX'; if (!AudioSys.muted) { AudioSys.init(); if (AudioSys.currentTrack) AudioSys.currentTrack.play(); } else { if (AudioSys.currentTrack) AudioSys.currentTrack.pause(); } }
function setVolume(v) { AudioSys.setVolume(v); }

function toggleItens() {
    AudioSys.sfx.click();
    const m = document.getElementById('modal-itens');
    if (m.style.display === 'flex') { m.style.display = 'none'; return; }
    GameState.ui.pageItens = 1;
    // renderItemBookPage(); // Futura implementação de paginação
    m.style.display = 'flex';
}

/** Atualiza o texto do objetivo no topo da tela baseado no Turno */
function updateObjective() {
    const o = document.getElementById('obj-display');
    const t = GameState.status.turno;
    if (t < 10) o.innerText = "OBJETIVO: CONTENHA A INVASÃO";
    else if (t < 15) o.innerText = "ALERTA: DESTRUA A MÁQUINA!";
    else o.innerText = "FINAL: ELIMINE O VÍRUS!";
    
    // Muda cor para vermelho quando está perto do fim
    if (t >= 10) { o.style.color = "var(--red-fire)"; o.style.borderColor = "var(--red-fire)"; }
}

/** Mostra ou esconde o Tracker de Crise (Missão Temporária) */
function updateCrisisUI() {
    const el = document.getElementById('crisis-tracker');
    const turnEl = document.getElementById('crisis-turns');
    const nameEl = document.getElementById('crisis-name');
    if (GameState.crise.ativa) {
        el.style.display = 'block';
        turnEl.innerText = GameState.crise.timer;
        nameEl.innerText = GameState.crise.titulo || "CRISE EM ANDAMENTO";
    } else {
        el.style.display = 'none';
    }
}

/** Atualiza a barra de progresso da Corrupção */
function atualizarCorrupcaoUI() {
    let c = GameState.status.corrupcao;
    if (c > 100) c = 100;
    document.getElementById('bar-corr').style.width = c + "%";
    document.getElementById('label-corr').innerText = c + "%";
    if (c >= 100 && !GameState.status.gameOver) {
        alert("GAME OVER! A Floresta foi corrompida.");
        GameState.status.gameOver = true;
    }
}

/** Adiciona mensagens no log de histórico lateral */
function addLog(t) {
    const u = document.getElementById('log-lista');
    const l = document.createElement('li');
    l.innerHTML = `T${GameState.status.turno}: ${t}`;
    u.prepend(l);
}

// --- 4. GAME LOOP & LÓGICA PRINCIPAL (CONTROLLER) ---

/**
 * Prepara o jogo com base nos heróis selecionados no Setup.
 * Gera a primeira Crise e transfere o usuário para o Briefing.
 */
function prepararBriefing() {
    const inputs = document.querySelectorAll('#screen-setup input:checked');
    if (inputs.length === 0) { alert("Escolha pelo menos 1 herói."); return; }

    // Salva heróis no GameState
    inputs.forEach(i => GameState.entidades.herois.push(i.value));

    // Clona eventos para consumo
    GameState.ui.eventosDisponiveis = [...eventosDB];
    
    // Define dificuldade dinâmica (Limite de monstros)
    GameState.config.maxMonstros = 4 + GameState.entidades.herois.length;

    // Sorteia Crise Inicial
    const crise = crisesDB[Math.floor(Math.random() * crisesDB.length)];

    GameState.crise.ativa = true;
    GameState.crise.timer = crise.prazo;
    GameState.crise.tipo = crise.id;
    GameState.crise.titulo = crise.titulo.toUpperCase();
    GameState.crise.alvos = [];

    const display = document.getElementById('crisis-display');
    display.innerHTML = `${crise.titulo}<br><span style='font-size:0.9rem; color:#555; font-weight:normal;'>${crise.desc}<br><b>PRAZO: ${crise.prazo} TURNOS</b></span>`;

    // Spawna os monstros da Crise
    crise.spawn.forEach(m => {
        const id = spawnMonstro(m.nome, m.hp, `⚠️ CRISE: ${m.nome} em ${m.loc}!`, m.loc);
        GameState.crise.alvos.push(id); // Guarda ID para verificar morte depois
    });

    // Reforço se tiver muitos jogadores
    if (GameState.entidades.herois.length >= 3) {
        const extraEnemy = crise.spawn[0];
        const extraLoc = zonas[Math.floor(Math.random() * zonas.length)];
        spawnMonstro(extraEnemy.nome, extraEnemy.hp, `⚠️ REFORÇO: ${extraEnemy.nome} em ${extraLoc}!`, extraLoc);
    }

    document.getElementById('screen-setup').classList.remove('active-screen');
    document.getElementById('modal-briefing').style.display = 'flex';
    AudioSys.init(); AudioSys.sfx.alarm();
}

/** Inicia o jogo de fato após o briefing */
function comecarJogoReal() {
    AudioSys.sfx.click();
    document.getElementById('modal-briefing').style.display = 'none';
    document.getElementById('screen-game').classList.add('active-screen');
    AudioSys.sfx.start(); AudioSys.playMusic('explore');
    addLog("🎮 Missão iniciada! Boa sorte.");
    updateObjective();
    updateCrisisUI();
}

/**
 * O MOTOR DO JOGO. É chamado quando clica em "AVANÇAR TURNO".
 * 1. Incrementa turno.
 * 2. Aplica efeitos passivos (Maldição, Crise).
 * 3. Aumenta corrupção.
 * 4. Decide se Spawna monstro, Boss ou Evento.
 */
function proximoTurno() {
    AudioSys.sfx.click();
    GameState.status.turno++;
    document.getElementById('turno-num').innerText = GameState.status.turno;

    const div = document.getElementById('evento-texto');
    const loc = zonas[Math.floor(Math.random() * zonas.length)];
    const dado = Math.floor(Math.random() * 6) + 1; // Rola 1d6 interno

    updateObjective();

    // Lógica da Maldição do Olho (Item amaldiçoado)
    const temOlho = GameState.entidades.inventario.some(i => i.nome === "💎 O Olho da Cobiça");
    if (temOlho) {
        GameState.status.corrupcao += 2;
        addLog("👁️ Maldição do Olho: +2% Corrupção");
    }

    // Lógica da Crise (Timer)
    if (GameState.crise.ativa) {
        GameState.crise.timer--;
        updateCrisisUI();
        if (GameState.crise.timer <= 0) {
            alert("CRISE FALHOU! CONSEQUÊNCIAS TERRÍVEIS!");
            GameState.status.corrupcao += 15;
            addLog("⚠️ Crise falhou: +15% Corrupção!");
            GameState.crise.ativa = false;
            document.getElementById('crisis-tracker').style.display = 'none';
        }
    }

    // Aumento passivo de corrupção baseada no número de monstros vivos
    const aum = GameState.entidades.monstros.length * 3;
    if (aum > 0) {
        GameState.status.corrupcao += aum;
        addLog(`⚠️ +${aum}% Corrupção (Ameaça)`);
    }
    atualizarCorrupcaoUI();

    // Checa se é turno de Boss (definido em bossesDB)
    const boss = bossesDB.find(b => b.turn === GameState.status.turno);

    if (boss) {
        spawnMonstro(boss.nome, boss.hp, `${boss.title}<br>📍 ZONA: ${loc}`, loc);
    } else {
        // 30% de chance de Evento Aleatório
        if (Math.random() < 0.3) {
            // Recarrega eventos se acabarem
            if (GameState.ui.eventosDisponiveis.length === 0) {
                GameState.ui.eventosDisponiveis = [...eventosDB]; 
            }

            const index = Math.floor(Math.random() * GameState.ui.eventosDisponiveis.length);
            const evt = GameState.ui.eventosDisponiveis[index];
            GameState.ui.eventosDisponiveis.splice(index, 1);

            // Cria um "Monstro do tipo Evento" para aparecer na lista
            GameState.counters.idMonstro++;
            GameState.entidades.monstros.push({
                id: GameState.counters.idMonstro,
                nome: evt.nome, hp: 0, hpMax: 0, loc: loc, type: 'evento'
            });

            div.innerHTML = `❓ MISTÉRIO: ${evt.nome} em ${loc}!`;
            div.className = "text-warn";
            addLog(`❓ Evento em ${loc}`);
            renderLista();
            return;
        }

        // Spawn Normal de Monstros
        let monstrosParaSpawnar = 0;
        // Se time for grande, chance de spawn duplo
        if (GameState.entidades.herois.length >= 3) {
            monstrosParaSpawnar = 1;
            if (Math.random() > 0.4) monstrosParaSpawnar++;
        } else {
            if (Math.random() > 0.3) monstrosParaSpawnar = 1;
        }

        if (monstrosParaSpawnar > 0) {
            for (let i = 0; i < monstrosParaSpawnar; i++) {
                const m = monstrosDB[Math.floor(Math.random() * monstrosDB.length)];
                const localSpawn = zonas[Math.floor(Math.random() * zonas.length)];
                spawnMonstro(m.nome, m.hp, `⚔️ ${m.nome} em ${localSpawn}!`, localSpawn);
            }
            if (monstrosParaSpawnar > 1) addLog("⚠️ HORDA: Múltiplos inimigos!");
        } else if (dado > 3) {
            // Se não spawnar monstro, gera problema ambiental (Corrupção)
            const p = problemas[Math.floor(Math.random() * problemas.length)];
            GameState.status.corrupcao += 5;
            atualizarCorrupcaoUI();
            div.innerHTML = `⚠️ ${p} em ${loc}`;
            div.className = "text-warn";
            AudioSys.playTone(200, 'sine', 0.3);
            addLog(`⚠️ ${p} em ${loc}`);
        } else {
            div.innerHTML = "Caminho livre."; div.className = "text-safe";
        }
    }
}

/**
 * Factory Function para criar monstros.
 * Atribui ID único e insere no array global.
 */
function spawnMonstro(n, h, msg, loc) {
    // Checagem de limite (Game Over)
    if (GameState.entidades.monstros.length >= GameState.config.maxMonstros) {
        alert(`GAME OVER! Colapso por Superpopulação (Máx ${GameState.config.maxMonstros})!`);
        GameState.status.corrupcao = 100;
        atualizarCorrupcaoUI();
        return;
    }
    GameState.counters.idMonstro++;
    
    // Objeto Monstro
    GameState.entidades.monstros.push({
        id: GameState.counters.idMonstro,
        nome: n, hp: h, hpMax: h, loc: loc
    });

    const div = document.getElementById('evento-texto');
    div.innerHTML = msg || n;
    div.className = "text-danger";

    if (n.includes("BOSS") || n.includes("CHEFE") || n.includes("GLITCH")) AudioSys.sfx.alarm();
    renderLista();
    return GameState.counters.idMonstro;
}

/**
 * Renderiza (desenha) a lista de monstros na tela.
 * Usa abordagem Declarativa: Apaga tudo e desenha de novo baseado no GameState.
 */
function renderLista() {
    const container = document.getElementById('lista-monstros');
    container.innerHTML = "";
    const lista = GameState.entidades.monstros;
    const count = lista.length;
    const max = GameState.config.maxMonstros;

    // Atualiza cabeçalho de Ameaças
    const titleEl = document.getElementById('threat-title');
    titleEl.innerText = `Ameaças Ativas (${count}/${max})`;
    titleEl.style.color = count >= (max - 1) ? "var(--red-fire)" : "var(--text-ink)";

    // Agrupa monstros por Zona para facilitar visualização
    const grupos = {};
    lista.forEach(m => {
        const zona = m.loc || "DESCONHECIDO";
        if (!grupos[zona]) grupos[zona] = [];
        grupos[zona].push(m);
    });

    Object.keys(grupos).sort().forEach(zona => {
        // Cabeçalho da Zona
        const header = document.createElement('div');
        header.className = 'zone-header';
        header.innerText = `📍 ZONA ${zona}`;
        container.appendChild(header);

        // Lista de monstros naquela zona
        grupos[zona].forEach(m => {
            const isBoss = m.nome.includes("BOSS") || m.nome.includes("Alucinação") || m.nome.includes("Boto") || m.nome.includes("Devorador") || m.nome.includes("Jurupari") || m.nome.includes("Falha");
            const isEvent = m.type === 'evento';

            const item = document.createElement('div');
            item.className = `monstro-item ${isBoss ? 'boss-item' : ''}`;
            const nameClass = isBoss ? 'boss-name-fx' : '';
            const nameStyle = isBoss ? 'font-size:1rem; color:#D32F2F;' : 'font-weight:bold;';

            let btnHtml = `<button class="btn-lutar" onclick="abrirCombate(${m.id})">LUTAR</button>`;
            let hpDisplay = `<span style="color:var(--red-fire); margin-left:5px;">${m.hp}HP</span>`;

            if (isEvent) {
                btnHtml = `<button class="btn-investigate" onclick="abrirEvento(${m.id})">INVESTIGAR</button>`;
                hpDisplay = `<span style="color:#0288D1; margin-left:5px; font-size:0.8rem;">? ? ?</span>`;
            }
            item.innerHTML = `<div style="${nameStyle}" class="${nameClass}">${isBoss ? '💀 ' : ''}${isEvent ? '❓ ' : ''}${m.nome} ${hpDisplay}</div>${btnHtml}`;
            container.appendChild(item);
        });
    });
    // Feedback de aumento de corrupção
    document.getElementById('threat-level').innerText = `Aumento: +${count * 3}% Corrupção/Turno`;
}

// --- 5. LÓGICA DE EVENTOS ---
// Gerencia os encontros narrativos (não-combate)

function fecharEvento() { document.getElementById('modal-evento').style.display = 'none'; }

function abrirEvento(idList) {
    const item = GameState.entidades.monstros.find(x => x.id === idList);
    if (!item || item.type !== 'evento') return;
    const evtData = eventosDB.find(e => e.nome === item.nome);
    if (!evtData) return;

    // Guarda qual evento estamos resolvendo
    GameState.ui.eventoAtual = { ...evtData, listId: idList };

    document.getElementById('evt-icon').innerText = evtData.icon;
    document.getElementById('evt-title').innerText = evtData.nome;
    document.getElementById('evt-desc').innerText = evtData.desc;

    // (Simplificado) Assume botões fixos HTML que chamam resolverEvento('A' ou 'B')
    document.getElementById('modal-evento').style.display = 'flex';
}

function resolverEvento(opt) {
    const evt = GameState.ui.eventoAtual;
    if (!evt) return;

    const data = (opt === 'A') ? evt.optA : evt.optB;
    alert(data.res);
    addLog(`❓ Evento: ${data.res}`);

    // Entrega recompensas
    if (data.loot) pegarLoot(data.loot, true);
    if (data.corr) {
        GameState.status.corrupcao += data.corr;
        if (GameState.status.corrupcao < 0) GameState.status.corrupcao = 0;
        atualizarCorrupcaoUI();
    }

    // Se o evento gerar um monstro (armadilha)
    if (data.spawn) {
        const hp = data.spawnHp || 4;
        const monstroOrigem = GameState.entidades.monstros.find(m => m.id === evt.listId);
        if (monstroOrigem) {
            spawnMonstro(data.spawn, hp, `⚠️ PERIGO: ${data.spawn} acordou!`, monstroOrigem.loc);
        }
    }

    // Remove o evento da lista de monstros/ameaças
    GameState.entidades.monstros = GameState.entidades.monstros.filter(m => m.id !== evt.listId);
    renderLista();
    fecharEvento();
}

// --- 6. SISTEMA DE LOOT & INVENTÁRIO (STRATEGY PATTERN) ---
// Usa um objeto Dicionário para mapear "Nome do Item" -> "Função a executar"

const ItemEffects = {
    // Itens de Cura / Utilidade
    "Água de Coco": () => { GameState.status.corrupcao = Math.max(0, GameState.status.corrupcao - 3); atualizarCorrupcaoUI(); alert("Água de Coco: Corrupção reduzida em 3%!"); return true; },
    "Óleo": () => { GameState.status.corrupcao = Math.max(0, GameState.status.corrupcao - 3); atualizarCorrupcaoUI(); alert("Óleo: Cura Total aplicada."); return true; },
    "Mel de Jataí": () => { alert("Recuperou 1 HP!"); return true; },
    "Panelada da Vovó": () => { alert("Recuperou 2 HP!"); return true; },
    "Berrante da Mata": () => { if (GameState.entidades.monstros.length > 0) { GameState.entidades.monstros.pop(); renderLista(); alert("O som do berrante espantou um monstro!"); return true; } alert("Não há monstros para espantar."); return false; },
    "Vento do Saci": () => { alert("Teletransporte realizado!"); return true; },
    "Pen Drive Ancestral": () => { alert("Reroll dos dados disponível!"); return true; },
    "Açaí Atômico": () => { alert("Energia recuperada!"); return true; },
    "Bebida de Guaraná": () => { alert("Foco aumentado!"); return true; },

    // Itens de Combate (recebem o parâmetro inBattle)
    "Veneno de Sapo": (inBattle) => { if (!inBattle) return "BATALHA"; CombatState.buffDano += 2; alert("Lâmina envenenada! +2 de Dano."); return true; },
    "Dente de Onça": (inBattle) => { alert("Fúria da Onça! Role +1 dado."); return true; },
    "Rede de Pesca": (inBattle) => { if (!inBattle) return "BATALHA"; if (CombatState.inimigo) { CombatState.inimigo.fraqueza = true; alert("Inimigo enredado!"); return true; } return false; },
    "Esporos de Confusão": (inBattle) => { if (!inBattle) return "BATALHA"; if (CombatState.inimigo) { CombatState.inimigo.fraqueza = true; alert("Inimigo atordoado!"); return true; } return false; },
    "Lança de Tucum": (inBattle) => aplicarDanoItem(3, inBattle),
    "Tridente do Rio": (inBattle) => aplicarDanoItem(3, inBattle),
    "Chama": (inBattle) => aplicarDanoItem(5, inBattle),
    "Arco Sombrio": (inBattle) => aplicarDanoItem(5, inBattle),

    // Passivos (não podem ser usados clicando)
    "Amuleto da Cuca": () => { alert("Item Passivo: Imunidade."); return false; },
    "Coroa do Rei": () => { alert("Item de Vitória."); return false; },
    "O Olho da Cobiça": () => { alert("Item Amaldiçoado."); return false; }
};

function aplicarDanoItem(dano, inBattle) {
    if (!inBattle) return "BATALHA";
    aplicarDanoReal(dano, false);
    alert(`${dano} de Dano Direto causado!`);
    return true;
}

/** Executa a lógica de um item do inventário */
function usarItem(index, isBattleContext) {
    const item = GameState.entidades.inventario[index];
    if (!item) return;
    
    // Busca a função no dicionário ItemEffects parcial ou total
    const effectKey = Object.keys(ItemEffects).find(key => item.nome.includes(key));

    if (effectKey) {
        if (confirm(`Deseja usar: ${item.nome}?`)) {
            const action = ItemEffects[effectKey];
            const result = action(isBattleContext); // Executa a função
            
            if (result === "BATALHA") { alert("Este item só pode ser usado durante o combate!"); }
            else if (result === true) {
                // Consome o item se retornou true
                GameState.entidades.inventario.splice(index, 1);
                addLog(`✨ Usou: ${item.nome}`);
                renderInventario();
                if (isBattleContext) renderBattleInventory();
            }
        }
    } else { alert(`O item "${item.nome}" foi usado, mas não teve efeito visível.`); }
}

/** Sorteia itens baseado no tipo (Boss ou Normal) */
function gerarLoot(t) {
    const m = document.getElementById('modal-loot');
    const c = document.getElementById('loot-container');
    c.innerHTML = "";

    const itensQuest = ["Panelada da Vovó", "Esporos de Confusão", "O Olho da Cobiça"];
    const bossDrops = bossesDB.map(b => b.loot);
    const itensProibidos = [...itensQuest, ...bossDrops];

    // Filtra itens disponíveis no data.js
    let pool;
    if (t === 'boss') {
        pool = lootDB.filter(i => (i.tier === 'epico' || i.tier === 'lendario') && !itensProibidos.includes(i.nome));
    } else {
        pool = lootDB.filter(i => (i.tier === 'comum' || i.tier === 'raro') && !itensProibidos.includes(i.nome));
    }

    // Pega 3 aleatórios
    let o = pool.sort(() => 0.5 - Math.random()).slice(0, 3);
    o.forEach(i => {
        const tc = `tier-${i.tier}`;
        c.innerHTML += `<div class="loot-card ${tc}" onclick="pegarLoot('${i.nome}')"><div class="loot-name">${i.nome}</div><div class="loot-tier-tag">${i.tier}</div><div class="loot-desc">${i.effect}</div></div>`;
    });
    m.style.display = 'flex';
}

function pegarLoot(n, direto = false) {
    const o = lootDB.find(i => i.nome === n);
    if (o) {
        GameState.entidades.inventario.push(o);
        if (!o.discovered) { o.discovered = true; addLog("📖 Item registrado no Compêndio!"); }
        if (direto) alert(`VOCÊ OBTEVE UM ITEM LENDÁRIO: ${n}`);
    }
    document.getElementById('modal-loot').style.display = 'none';
    renderInventario();
    AudioSys.playMusic('explore');
    addLog(`🎒 Item: ${n}`);
}

function renderInventario() {
    const container = document.getElementById('inv-list-container');
    container.innerHTML = "";
    if (GameState.entidades.inventario.length === 0) { container.innerHTML = '<span class="inv-empty">Vazio</span>'; return; }
    GameState.entidades.inventario.forEach((item, index) => {
        const tierClass = `tier-${item.tier}`;
        // Adiciona data-desc para tooltip CSS
        container.innerHTML += `<div class="inv-item-side ${tierClass}" data-desc="${item.effect}" onclick="usarItem(${index}, false)">📦 ${item.nome}</div>`;
    });
}

function renderBattleInventory() {
    const container = document.getElementById('combat-inventory');
    if (GameState.entidades.inventario.length === 0) { container.innerHTML = '<span class="battle-inv-item">Vazio</span>'; return; }
    container.innerHTML = "";
    GameState.entidades.inventario.forEach((item, index) => {
        const tierClass = `tier-${item.tier}`;
        const shortName = item.nome.split(' ')[1] || item.nome.split(' ')[0];
        container.innerHTML += `<div class="battle-inv-item ${tierClass}" onclick="usarItem(${index}, true)">${shortName}</div>`;
    });
}

// --- 7. MÓDULO DE COMBATE (ENCAPSULADO) ---

/**
 * CombatState: Um "mini-estado" que existe apenas durante a luta.
 * Evita poluir o GameState principal com dados voláteis.
 */
const CombatState = {
    inimigo: null,
    buffDano: 0,
    isBoss: false,
    bossCharge: 0, // NOVO: Energia do Chefe (0 a 3)
    // ... (resto igual)
    status: { stun: false, fragile: false, bleed: 0, burn: 0, immune: false, reflect: false },

    reset: function (monstro) {
        this.inimigo = monstro;
        this.buffDano = 0;
        this.bossCharge = 0; // Reseta carga
        this.isBoss = monstro.nome.includes("BOSS") || monstro.nome.includes("Devorador") || monstro.nome.includes("Falha");
        this.status = { stun: false, fragile: false, bleed: 0, burn: 0, immune: false, reflect: false };
        this.updateBossUI();
    },

    updateBossUI: function() {
        // Atualiza visualmente a barra de carga do Boss (Texto simples por enquanto)
        const el = document.getElementById('modal-titulo');
        if(this.isBoss) {
            const cargas = "⚡".repeat(this.bossCharge) + "⚪".repeat(3 - this.bossCharge);
            el.innerHTML = `VS ${this.inimigo.nome.toUpperCase()} <br><span style="font-size:0.7em">${cargas}</span>`;
        } else {
            // Lógica normal para monstros comuns
             // ... (código existente de ícones de status)
             let html = "VS " + this.inimigo.nome.toUpperCase();
             if (this.status.stun) html += " 😵";
             if (this.status.fragile) html += " 💔";
             el.innerHTML = html;
        }
    }
};

/** Prepara a UI e carrega dados do monstro para o combate */
function abrirCombate(id) {
    AudioSys.sfx.click();
    const monstro = GameState.entidades.monstros.find(m => m.id === id);
    if (!monstro) return;

    CombatState.reset(monstro);
    monstroCombateAtual = monstro;

    // --- CARREGAMENTO DE SPRITES (Visual Idle) ---
    const spriteImg = document.getElementById('monster-sprite');
    if(spriteImg) {
        const fileName = monstro.nome.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, ''); 
        spriteImg.src = `assets/monstros/${fileName}.png`;
        spriteImg.onerror = function() { this.src = 'assets/monstros/default_monster.png'; };
    }
    // ---------------------------------------------

    document.getElementById('modal-combate').style.display = 'flex';
    document.getElementById('modal-titulo').innerText = "VS " + monstro.nome.toUpperCase();

    let hpText = monstro.hp + " HP";
    document.getElementById('modal-hp').innerHTML = hpText;

    AudioSys.playMusic(CombatState.isBoss ? 'boss' : 'common');
    document.getElementById('btn-villain-atk').innerText = CombatState.isBoss ? "👹 ATAQUE BOSS (1d4)" : "👹 ATAQUE VILÃO (1d3)";
    document.getElementById('combat-feedback').innerHTML = "Preparem-se...";
    document.getElementById('dmg-manual').value = "";

    renderBattleInventory();
    resetDice();
    atualizarSelecaoHerois(monstro);
}

// --- LÓGICA DO JOGADOR (ATAQUE BÁSICO + CRÍTICO AUTOMÁTICO) ---
function ataqueBasico() {
    AudioSys.checkResume();
    // Lê inputs do DOM (Dice Wrappers)
    const dadosBons = Array.from(document.querySelectorAll('.dice-input.good')).map(i => parseInt(i.value) || 0);
    const dadosRuins = Array.from(document.querySelectorAll('.dice-input.bad')).map(i => parseInt(i.value) || 0);
    
    if (dadosBons.length === 0 && dadosRuins.length === 0) return;

    // Regra: Sucesso em 4, 5 ou 6
    const hits = [...dadosBons, ...dadosRuins].filter(v => v >= 4).length;
    
    // Regra: Crítico se Maior Bom == Maior Ruim
    const maxBom = Math.max(0, ...dadosBons);
    const maxRuim = Math.max(0, ...dadosRuins);
    const ganhouEnergia = maxBom > maxRuim;
    const isCritico = (maxBom === maxRuim && maxBom > 0);

    let danoFinal = hits;
    let msg = "";
    let cssClass = "log-miss";

    // Pega dados do Herói Ativo para aplicar Efeito Passivo no Crítico
    const nomeHeroi = document.getElementById('active-hero').value;
    const heroData = heroisDB[nomeHeroi];

    if (isCritico) {
        if (danoFinal === 0) danoFinal = 1; // Crítico garante min 1 dano
        msg = `💥 CRÍTICO! (${danoFinal} Dano)`;
        cssClass = "log-crit";
        AudioSys.sfx.crit();

        // Aplica efeitos passivos baseados na carta do herói
        if (heroData && heroData.onCrit) {
            const tipo = heroData.onCrit;
            const turnos = heroData.onCritTurns;

            if (tipo === 'bleed') {
                CombatState.status.bleed = turnos;
                msg += `<br>🩸 SANGRANDO (${turnos}T)`;
            }
            else if (tipo === 'burn') {
                CombatState.status.burn = turnos;
                msg += `<br>🔥 QUEIMANDO (${turnos}T)`;
            }
            else if (tipo === 'stun') {
                CombatState.status.stun = true;
                msg += `<br>😵 ATORDOADO!`;
            }
            
            atualizarIconesStatus();
        }

    } else if (danoFinal > 0) {
        // Consome o status Frágil do inimigo (Bônus de dano)
        if (CombatState.status.fragile) {
            danoFinal += 1;
            msg = `💔 FRÁGIL: +1 Dano! `;
            CombatState.status.fragile = false;
            atualizarIconesStatus();
        }

        msg += `⚔️ ACERTOU! (${danoFinal} Dano)`;
        if (ganhouEnergia) msg += " + ⚡ Energia";
        cssClass = "log-hit";
        AudioSys.sfx.hit();
    } else {
        msg = ganhouEnergia ? "❌ ERROU (+ ⚡ Energia)" : "❌ ERROU!";
        AudioSys.playTone(150, 'sine', 0.2);
        
        // NOVO: Errar contra Boss enche a barra dele!
        if (CombatState.isBoss && CombatState.bossCharge < 3) {
            CombatState.bossCharge++;
            msg += "<br>⚠️ BOSS CARREGANDO!";
            CombatState.updateBossUI();
        }
    }

    // Aplica buffs de itens consumíveis (ex: Veneno de Sapo)
    if (danoFinal > 0 && CombatState.buffDano > 0) {
        danoFinal += CombatState.buffDano;
        msg += `<br><small>+${CombatState.buffDano} Bônus Item</small>`;
        CombatState.buffDano = 0;
    }

    document.getElementById('combat-feedback').innerHTML = `<span class="${cssClass}">${msg}</span>`;
    addLog(`🎲 ${nomeHeroi}: ${msg.replace('<br>', ' ')}`);

    if (danoFinal > 0) aplicarDanoReal(danoFinal, false);
}

// --- LÓGICA DE HABILIDADE (COM STATUS) ---
function usarHabilidade() {
    AudioSys.checkResume();
    const nomeHeroi = document.getElementById('active-hero').value;
    const heroData = heroisDB[nomeHeroi]; // Pega do data.js

    if (!heroData) {
        // Fallback para input manual se não tiver herói selecionado
        const dano = parseInt(document.getElementById('dmg-manual').value);
        if (!isNaN(dano)) {
            AudioSys.sfx.crit();
            document.getElementById('combat-feedback').innerHTML = `<span class="log-hit">✨ HABILIDADE MANUAL (-${dano} HP)</span>`;
            aplicarDanoReal(dano, false);
        }
        return;
    }

    // Confirmação Híbrida (App pergunta se jogador pagou tokens físicos)
    if (!confirm(`Você pagou o custo físico?\n(${heroData.cost})\n\nUsar ${heroData.skillName}?`)) return;

    AudioSys.sfx.crit();
    let msg = `✨ ${heroData.skillName}`;

    // 1. Aplica Dano Imediato
    if (heroData.damage > 0) {
        aplicarDanoReal(heroData.damage, false);
        msg += ` (-${heroData.damage} HP)`;
    }

    // 2. Aplica Status e Define Contadores
    if (heroData.statusApply) {
        const tipo = heroData.statusApply;
        
        if (tipo === 'stun') {
            CombatState.status.stun = true;
            msg += "<br>😵 APLICOU STUN!";
        } 
        else if (tipo === 'fragile') {
            CombatState.status.fragile = true;
            msg += "<br>💔 APLICOU FRÁGIL!";
        }
        else if (tipo === 'bleed') {
            CombatState.status.bleed = heroData.turns; 
            msg += `<br>🩸 SANGRAR (${heroData.turns} Turnos)`;
        }
        else if (tipo === 'burn') {
            CombatState.status.burn = heroData.turns; 
            msg += `<br>🔥 QUEIMAR (${heroData.turns} Turnos)`;
        }
    }

    document.getElementById('combat-feedback').innerHTML = `<span class="log-crit" style="color:#29B6F6;">${msg}</span>`;
    addLog(`🌟 ${nomeHeroi} usou habilidade: ${heroData.skillName}`);
    atualizarIconesStatus();
}

// --- LÓGICA DO INIMIGO (TURNO INTELIGENTE) ---
function turnoVilao(isCarregando) {
    AudioSys.checkResume();
    if (!CombatState.inimigo) return;

    // 1. CHECA STUN
    if (CombatState.status.stun) {
        alert("O INIMIGO ESTÁ ATORDOADO!\nEle perde a vez.");
        CombatState.status.stun = false;
        CombatState.updateBossUI(); // Atualiza UI
        return;
    }

    const btn = document.getElementById('btn-villain-atk');
    btn.disabled = true;
    btn.style.opacity = "0.5";
    document.getElementById('combat-feedback').innerText = "⚠ Vilão preparando ataque...";
    
    // 2. CHECA SE VAI USAR HABILIDADE (Carga Cheia = 3)
    const bossData = bossesDB.find(b => b.nome === CombatState.inimigo.nome);
    const vaiUsarSkill = CombatState.isBoss && CombatState.bossCharge >= 3 && bossData;

    setTimeout(() => {
        // Processa Sangramento/Queimadura primeiro (dano passivo)
        if (CombatState.status.bleed > 0) {
            CombatState.inimigo.hp -= 1;
            CombatState.status.bleed--;
            document.getElementById('modal-hp').innerText = CombatState.inimigo.hp + " HP";
            if (CombatState.inimigo.hp <= 0) { finalizeVitoria(); return; }
        }

        // --- EXECUÇÃO DO ATAQUE OU SKILL ---
        if (vaiUsarSkill) {
            // Escolhe 1 das 3 skills aleatoriamente
            const skill = bossData.skills[Math.floor(Math.random() * bossData.skills.length)];
            executarSkillBoss(skill);
            
            // Reseta a carga
            CombatState.bossCharge = 0;
            CombatState.updateBossUI();
        } else {
            // Ataque Normal
            let danoBase = CombatState.isBoss ? 4 : 2;
            let danoRolado = Math.floor(Math.random() * danoBase) + 1;
            
            // Reflete Dano (Se Boto estiver com escudo)
            if (CombatState.status.reflect) {
                alert("O ESCUDO DO BOTO REFLETE O DANO!"); 
                // Logica de refletir (narrativa)
                CombatState.status.reflect = false; // Consome escudo
            }

            document.body.classList.add('shake-active');
            AudioSys.sfx.villain();
            
            const msg = `⚔️ ATAQUE: ${danoRolado} DANO!`;
            document.getElementById('combat-feedback').innerHTML = `<div class="villain-strike-text">${msg}</div>`;
            addLog(`👹 ${CombatState.inimigo.nome} atacou (${danoRolado})`);
        }

        setTimeout(() => {
            document.body.classList.remove('shake-active');
            btn.disabled = false;
            btn.style.opacity = "1";
        }, 500);
    }, 800);
}

// NOVO: Função que processa os efeitos das skills
function executarSkillBoss(skill) {
    AudioSys.sfx.alarm(); // Som de perigo
    let msg = `<span style="color:#FFD700">💀 ${skill.name.toUpperCase()}</span><br><small>${skill.desc}</small>`;
    
    // Aplica lógica baseada no tipo
    switch(skill.type) {
        case 'heal':
            CombatState.inimigo.hp += skill.val;
            document.getElementById('modal-hp').innerText = CombatState.inimigo.hp + " HP";
            break;
        case 'immune':
            CombatState.status.immune = true;
            break;
        case 'corr':
            GameState.status.corrupcao += skill.val;
            atualizarCorrupcaoUI();
            break;
        case 'reflect':
            CombatState.status.reflect = true;
            break;
        // Outros tipos são puramente narrativos/instrucionais para os jogadores
    }

    document.getElementById('combat-feedback').innerHTML = `<div class="villain-strike-text" style="font-size:1.2rem; color:#FFD700; border-color:#FFD700;">${msg}</div>`;
    addLog(`💀 BOSS SKILL: ${skill.name}`);
    alert(`⚠️ O CHEFE USOU UMA HABILIDADE!\n\n${skill.name}\n${skill.desc}`);
}

// --- FUNÇÕES AUXILIARES E UI ---

function aplicarDanoReal(dano, isDanoNoHeroi) {
    if (!CombatState.inimigo) return;

    if (!isDanoNoHeroi) {
        // --- Animação de Hit no Sprite ---
        const sprite = document.getElementById('monster-sprite');
        if(sprite) {
            sprite.style.transform = "scale(0.8) rotate(5deg)";
            sprite.style.filter = "brightness(2) sepia(1) saturate(5) hue-rotate(-50deg)";
            setTimeout(() => {
                sprite.style.transform = "scale(1) rotate(0deg)";
                sprite.style.filter = "drop-shadow(0 0 10px rgba(0,0,0,0.5))";
            }, 150);
        }
        // ---------------------------------------

        CombatState.inimigo.hp -= dano;
        document.getElementById('modal-hp').innerText = CombatState.inimigo.hp + " HP";
        showFloatingText(dano, window.innerWidth / 2, window.innerHeight / 2 - 100, 'dmg-hero');
        if (CombatState.inimigo.hp <= 0) {
            finalizarVitoria();
        }
    }
}

function atualizarIconesStatus() {
    let html = "VS " + CombatState.inimigo.nome.toUpperCase();
    
    // Adiciona ícones se os status estiverem ativos
    if (CombatState.status.stun) html += " 😵";
    if (CombatState.status.fragile) html += " 💔";
    if (CombatState.status.bleed > 0) html += ` 🩸(${CombatState.status.bleed})`;
    if (CombatState.status.burn > 0) html += ` 🔥(${CombatState.status.burn})`;
    
    document.getElementById('modal-titulo').innerHTML = html;
}

/** Atualiza Dropdown de Heróis e texto do Botão de Habilidade */
function atualizarSelecaoHerois(monstro) {
    const select = document.getElementById('active-hero');
    const zoneDiv = document.getElementById('zone-targets');
    const btnSkill = document.querySelector('.btn-skill'); 
    
    select.innerHTML = ""; 
    zoneDiv.innerHTML = "";

    GameState.entidades.herois.forEach(heroi => {
        // Preenche Dropdown
        const opt = document.createElement('option');
        opt.value = heroi;
        opt.innerText = heroi.toUpperCase();
        select.appendChild(opt);

        // Preenche Checkboxes de Alvo
        const disabledAttr = CombatState.isBoss ? "onclick='return false;'" : "";
        zoneDiv.innerHTML += `<label class="target-label"><input type="checkbox" value="${heroi}" class="target-chk" checked ${disabledAttr}> ${heroi.toUpperCase()}</label>`;
    });

    // Atualiza o texto do botão quando troca o herói no select
    select.onchange = function() {
        const nome = this.value;
        const dados = heroisDB[nome];
        if (dados) {
            btnSkill.innerHTML = `✨ ${dados.skillName}`;
            btnSkill.title = dados.desc;
        } else {
            btnSkill.innerHTML = "✨ Habilidade";
        }
    };
    
    // Dispara uma vez para iniciar com o primeiro da lista
    if (GameState.entidades.herois.length > 0) select.onchange();
}

function finalizarVitoria() {
    AudioSys.playMusic('victory');
    document.getElementById('combat-feedback').innerHTML = "<span class='log-crit'>💀 INIMIGO DERROTADO!</span>";

    // Remove monstro do GameState
    GameState.entidades.monstros = GameState.entidades.monstros.filter(m => m.id !== CombatState.inimigo.id);
    checkCrisisObjective(CombatState.inimigo.id);

    setTimeout(() => {
        document.getElementById('modal-combate').style.display = 'none';
        renderLista();

        if (CombatState.inimigo.nome.includes("GLITCH")) {
            alert("PARABÉNS! VOCÊ DELETOU O VÍRUS E SALVOU A FLORESTA!");
        } else {
            const bossData = bossesDB.find(b => b.nome === CombatState.inimigo.nome);
            if (bossData && bossData.loot) {
                pegarLoot(bossData.loot, true);
            } else {
                gerarLoot(CombatState.isBoss ? 'boss' : 'normal');
            }
        }
        CombatState.inimigo = null;
        monstroCombateAtual = null;
    }, 2500);
}

function fecharCombate() {
    AudioSys.sfx.click();
    AudioSys.playMusic('explore');
    document.getElementById('modal-combate').style.display = 'none';
    CombatState.inimigo = null;
    monstroCombateAtual = null;
}

function checkCrisisObjective(deadId) {
    if (GameState.crise.ativa && GameState.crise.alvos.includes(deadId)) {
        GameState.crise.alvos = GameState.crise.alvos.filter(id => id !== deadId);
        if (GameState.crise.alvos.length === 0) {
            alert("MISSÃO DE CRISE CUMPRIDA! Ameaça contida.");
            addLog("🎉 Crise Resolvida!");
            GameState.crise.ativa = false;
            document.getElementById('crisis-tracker').style.display = 'none';
            gerarLoot('boss');
        }
    }
}

// --- UTILITÁRIOS VISUAIS ---
function openDiceMenu() { AudioSys.checkResume(); document.getElementById('modal-dice-select').style.display = 'flex'; }
function addDice(t) { AudioSys.sfx.click(); const w = document.getElementById('dice-wrapper'); const b = document.querySelector('.btn-add-dice'); const d = document.createElement('div'); d.className = 'dice-wrapper'; d.innerHTML = `<input type="number" class="dice-input ${t}" placeholder="${t === 'good' ? '+' : '-'}" inputmode="numeric"><div class="remove-dice-btn" onclick="this.parentElement.remove()">×</div>`; w.insertBefore(d, b); document.getElementById('modal-dice-select').style.display = 'none'; }
function resetDice() { document.getElementById('dice-wrapper').innerHTML = `<div class="dice-wrapper"><input type="number" class="dice-input good" placeholder="+" inputmode="numeric"></div><div class="dice-wrapper"><input type="number" class="dice-input bad" placeholder="-" inputmode="numeric"></div><div class="btn-add-dice" onclick="openDiceMenu()">+</div>`; }
function getActiveHeroName() { const s = document.getElementById('active-hero'); return s.value || "HERÓI"; }

/** Cria texto flutuante de dano na tela (efeito visual) */
function showFloatingText(text, x, y, type = 'dmg-hero') {
    const el = document.createElement('div');
    el.innerText = text;
    el.className = `damage-number ${type}`;
    const randomX = (Math.random() * 40) - 20;
    el.style.left = (x + randomX) + 'px';
    el.style.top = (y - 50) + 'px';
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 1000);
}

// --- DEBUG SYSTEM (FERRAMENTAS DE DESENVOLVIMENTO) ---
function toggleDebug() { AudioSys.sfx.click(); const m = document.getElementById('modal-debug'); m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; }

function debugSpawnBoss(name) {
    const loc = zonas[Math.floor(Math.random() * zonas.length)];
    const boss = bossesDB.find(b => b.nome === name);
    if (boss) {
        spawnMonstro(name, boss.hp, `💀 CHEAT: ${name} INVOCADO EM ${loc}!`, loc);
        alert(`${name} invocado!`);
        toggleDebug();
    }
}

function debugHealAll() {
    GameState.status.corrupcao = 0;
    atualizarCorrupcaoUI();
    pegarLoot('🥘 Panelada da Vovó');
    pegarLoot('🥘 Panelada da Vovó');
    alert("Corrupção Resetada e Itens de Cura Entregues!");
    toggleDebug();
}

function debugForceEvent() {
    const evt = eventosDB[Math.floor(Math.random() * eventosDB.length)];
    GameState.counters.idMonstro++;
    const loc = zonas[Math.floor(Math.random() * zonas.length)];
    GameState.entidades.monstros.push({ id: GameState.counters.idMonstro, nome: evt.nome, hp: 0, hpMax: 0, loc: loc, type: 'evento' });
    renderLista();
    alert(`Evento ${evt.nome} forçado em ${loc}!`);
    toggleDebug();
}

function checkDebugPassword() {
    const pass = document.getElementById('debug-pass').value;
    if (pass === "admin") {
        AudioSys.sfx.start();
        document.getElementById('debug-login').style.display = 'none';
        document.getElementById('debug-controls').style.display = 'block';
    } else {
        alert("Senha Incorreta!");
        AudioSys.playTone(150, 'sawtooth', 0.5);
    }
}

/* ==========================================================================
   SISTEMA DE PERSISTÊNCIA (SAVE/LOAD)
   ========================================================================== */

function salvarJogo() {
    try {
        AudioSys.sfx.click();
        
        // Salva o GameState inteiro no navegador
        localStorage.setItem('lendas_save_v1', JSON.stringify(GameState));
        
        alert("JOGO SALVO!\nSeus heróis descansam por enquanto...");
        addLog("💾 Progresso salvo com sucesso.");
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
}

function carregarJogo() {
    try {
        AudioSys.sfx.click();
        
        const saveString = localStorage.getItem('lendas_save_v1');
        
        if (!saveString) {
            alert("Nenhum jogo salvo encontrado.");
            return;
        }

        if (confirm("Carregar jogo salvo? O progresso atual será perdido.")) {
            const loadedState = JSON.parse(saveString);
            
            // Mescla o estado salvo com o objeto atual
            Object.assign(GameState, loadedState);
            
            // RECONSTRÓI A TELA (Importante!)
            // 1. Troca a tela de Setup pela de Jogo
            document.getElementById('screen-setup').classList.remove('active-screen');
            document.getElementById('modal-briefing').style.display = 'none';
            document.getElementById('screen-game').classList.add('active-screen');
            
            // 2. Atualiza os textos e barras
            document.getElementById('turno-num').innerText = GameState.status.turno;
            atualizarCorrupcaoUI();
            updateObjective();
            updateCrisisUI();
            
            // 3. Recria as listas visuais
            renderLista();      // Monstros
            renderInventario(); // Itens
            
            addLog("📂 Jogo carregado com sucesso.");
            AudioSys.playMusic('explore');
        }
    } catch (e) {
        alert("Erro ao carregar (Save corrompido ou versão antiga).");
        console.error(e);
    }
}

// Verifica se tem save ao abrir a página (Opcional - UX)
window.onload = function() {
    if (localStorage.getItem('lendas_save_v1')) {
        console.log("Save encontrado. Jogador pode continuar.");
        // Futuramente podemos mudar o botão "Iniciar" para "Continuar"
    }
};