/* ==========================================================================
   LENDAS SITIADAS - ENGINE V0.5 (STATE-DRIVEN)
   Código refatorado para usar GameState centralizado e Módulos.
   ========================================================================== */

// --- 1. ESTADO DO JOGO (SINGLE SOURCE OF TRUTH) ---
const GameState = {
    // Configurações Estáticas
    config: {
        maxMonstros: 7,
        debugMode: false,
        itemsPerPage: 4
    },
    // Estado Dinâmico (O que muda durante o jogo)
    status: {
        turno: 1,
        corrupcao: 0,
        gameOver: false
    },
    // Listas de Entidades
    entidades: {
        herois: [],       // Lista de nomes (strings)
        monstros: [],     // Objetos de monstros na mesa
        inventario: []    // Itens coletados
    },
    // Controle de Crise
    crise: {
        ativa: false,
        timer: 0,
        tipo: null,
        alvos: [],
        titulo: ""
    },
    // Controle de UI (Paginação)
    ui: {
        pageRegras: 1,
        pageItens: 1,
        eventoAtual: null,
        eventosDisponiveis: []
    },
    // IDs únicos
    counters: {
        idMonstro: 0
    }
};

// --- DADOS ESTÁTICOS (CONSTANTES) ---
const zonas = ["N1", "N2", "N3", "N4", "NE1", "NE2", "NE3", "CO1", "CO2", "CO3", "SE1", "SE2", "SE3", "S1", "S2", "S3"];
const problemas = ["Queimada", "Garimpo", "Seca", "Desmatamento", "Óleo na Água"];
const crisesDB = [
    { id: 'fogo', titulo: "🔥 O Cerco de Fogo", desc: "Apague os 'Fogos Fátuos' (N1 e S3) antes que se espalhem!", prazo: 3, spawn: [{ nome: "Fogo Fátuo", hp: 3, loc: "N1" }, { nome: "Fogo Fátuo", hp: 3, loc: "S3" }] },
    { id: 'torre', titulo: "🚫 Bloqueio de Sinal", desc: "Tecnologia hostil detectada! Destrua os 2 'Inibidores de Frequência' (CO2 e CO3) para recuperar o acesso à magia!", prazo: 4, spawn: [{ nome: "Inibidor de Frequência", hp: 3, loc: "CO2" }, { nome: "Inibidor de Frequência", hp: 3, loc: "CO3" }] },
    { id: 'curupira', titulo: "🆘 Resgate do Curupira", desc: "Salve o aliado em NE2 matando os 2 'Rastros de Pólvora'!", prazo: 3, spawn: [{ nome: "Rastro de Pólvora", hp: 3, loc: "NE2" }, { nome: "Rastro de Pólvora", hp: 3, loc: "NE2" }] },
    { id: 'oleo', titulo: "☣️ Maré Negra", desc: "Derrote a 'Lama Tóxica' (S2) antes que ela polua tudo!", prazo: 4, spawn: [{ nome: "Lama Tóxica", hp: 4, loc: "S2" }] }
];

// Variável de compatibilidade temporária (para não quebrar funções legadas se houver)
let monstroCombateAtual = null;

// --- 2. SISTEMA DE ÁUDIO (LIMPO) ---
const AudioSys = {
    ctx: null, muted: false,
    tracks: { explore: null, common: null, boss: null, victory: null },
    currentTrack: null,

    init: function () {
        if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        this.checkResume();
        this.tracks.explore = document.getElementById('bgm-explore');
        this.tracks.common = document.getElementById('bgm-common');
        this.tracks.boss = document.getElementById('bgm-boss');
        this.tracks.victory = document.getElementById('bgm-victory');
        this.setVolume(0.3);
    },
    checkResume: function () { if (this.ctx && this.ctx.state === 'suspended') { this.ctx.resume(); } },
    playTone: function (f, t, d, v = 0.1) {
        if (this.muted || !this.ctx) return; this.checkResume(); try { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = t; o.frequency.setValueAtTime(f, this.ctx.currentTime); g.gain.setValueAtTime(v, this.ctx.currentTime); g.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + d); o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + d); } catch (e) { }
    },
    playNoise: function (d) {
        if (this.muted || !this.ctx) return; this.checkResume(); try { const b = this.ctx.createBuffer(1, this.ctx.sampleRate * d, this.ctx.sampleRate); const data = b.getChannelData(0); for (let i = 0; i < data.length; i++)data[i] = Math.random() * 2 - 1; const n = this.ctx.createBufferSource(); n.buffer = b; const g = this.ctx.createGain(); g.gain.setValueAtTime(0.2, this.ctx.currentTime); g.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + d); n.connect(g); g.connect(this.ctx.destination); n.start(); } catch (e) { }
    },
    playMusic: function (type) {
        if (this.muted) return; this.checkResume();
        Object.values(this.tracks).forEach(t => { if (t) t.pause(); });
        if (type === 'victory' && this.tracks.victory) this.tracks.victory.currentTime = 0;
        const track = this.tracks[type];
        if (track) { track.play().catch(e => { }); this.currentTrack = track; }
    },
    setVolume: function (v) { Object.values(this.tracks).forEach(t => { if (t) t.volume = v; }); },
    sfx: {
        click: () => AudioSys.playTone(800, 'sine', 0.1),
        start: () => { AudioSys.playTone(400, 'square', 0.1); setTimeout(() => AudioSys.playTone(600, 'square', 0.2), 100); },
        alarm: () => { AudioSys.playTone(300, 'sawtooth', 0.3); setTimeout(() => AudioSys.playTone(250, 'sawtooth', 0.3), 150); },
        hit: () => AudioSys.playNoise(0.2),
        crit: () => { AudioSys.playTone(1200, 'triangle', 0.1); setTimeout(() => AudioSys.playTone(1500, 'triangle', 0.3), 100); },
        villain: () => { AudioSys.playTone(100, 'sawtooth', 0.4); setTimeout(() => AudioSys.playNoise(0.3), 100); }
    }
};

// --- 3. FUNÇÕES DE INTERFACE ---
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
    renderItemBookPage();
    m.style.display = 'flex';
}

function updateObjective() {
    const o = document.getElementById('obj-display');
    const t = GameState.status.turno;
    if (t < 10) o.innerText = "OBJETIVO: CONTENHA A INVASÃO";
    else if (t < 15) o.innerText = "ALERTA: DESTRUA A MÁQUINA!";
    else o.innerText = "FINAL: ELIMINE O VÍRUS!";
    if (t >= 10) { o.style.color = "var(--red-fire)"; o.style.borderColor = "var(--red-fire)"; }
}

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

function addLog(t) {
    const u = document.getElementById('log-lista');
    const l = document.createElement('li');
    l.innerHTML = `T${GameState.status.turno}: ${t}`;
    u.prepend(l);
}

// --- 4. GAME LOOP & LÓGICA PRINCIPAL ---

function prepararBriefing() {
    const inputs = document.querySelectorAll('#screen-setup input:checked');
    if (inputs.length === 0) { alert("Escolha pelo menos 1 herói."); return; }

    // Migração: Usando GameState
    inputs.forEach(i => GameState.entidades.herois.push(i.value));

    GameState.ui.eventosDisponiveis = [...eventosDB];
    GameState.config.maxMonstros = 4 + GameState.entidades.herois.length;

    const crise = crisesDB[Math.floor(Math.random() * crisesDB.length)];

    GameState.crise.ativa = true;
    GameState.crise.timer = crise.prazo;
    GameState.crise.tipo = crise.id;
    GameState.crise.titulo = crise.titulo.toUpperCase();
    GameState.crise.alvos = [];

    const display = document.getElementById('crisis-display');
    display.innerHTML = `${crise.titulo}<br><span style='font-size:0.9rem; color:#555; font-weight:normal;'>${crise.desc}<br><b>PRAZO: ${crise.prazo} TURNOS</b></span>`;

    crise.spawn.forEach(m => {
        const id = spawnMonstro(m.nome, m.hp, `⚠️ CRISE: ${m.nome} em ${m.loc}!`, m.loc);
        GameState.crise.alvos.push(id);
    });

    // Reforço para grupos grandes
    if (GameState.entidades.herois.length >= 3) {
        const extraEnemy = crise.spawn[0];
        const extraLoc = zonas[Math.floor(Math.random() * zonas.length)];
        spawnMonstro(extraEnemy.nome, extraEnemy.hp, `⚠️ REFORÇO: ${extraEnemy.nome} em ${extraLoc}!`, extraLoc);
    }

    document.getElementById('screen-setup').classList.remove('active-screen');
    document.getElementById('modal-briefing').style.display = 'flex';
    AudioSys.init(); AudioSys.sfx.alarm();
}

function comecarJogoReal() {
    AudioSys.sfx.click();
    document.getElementById('modal-briefing').style.display = 'none';
    document.getElementById('screen-game').classList.add('active-screen');
    AudioSys.sfx.start(); AudioSys.playMusic('explore');
    addLog("🎮 Missão iniciada! Boa sorte.");
    updateObjective();
    updateCrisisUI();
}

function proximoTurno() {
    AudioSys.sfx.click();
    GameState.status.turno++;
    document.getElementById('turno-num').innerText = GameState.status.turno;

    const div = document.getElementById('evento-texto');
    const loc = zonas[Math.floor(Math.random() * zonas.length)];
    const dado = Math.floor(Math.random() * 6) + 1;

    updateObjective();

    // Check de Maldição
    const temOlho = GameState.entidades.inventario.some(i => i.nome === "💎 O Olho da Cobiça");
    if (temOlho) {
        GameState.status.corrupcao += 2;
        addLog("👁️ Maldição do Olho: +2% Corrupção");
    }

    // Check de Crise
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

    // Aumento passivo de corrupção
    const aum = GameState.entidades.monstros.length * 3;
    if (aum > 0) {
        GameState.status.corrupcao += aum;
        addLog(`⚠️ +${aum}% Corrupção (Ameaça)`);
    }
    atualizarCorrupcaoUI();

    // Check de Boss por Turno
    const boss = bossesDB.find(b => b.turn === GameState.status.turno);

    if (boss) {
        spawnMonstro(boss.nome, boss.hp, `${boss.title}<br>📍 ZONA: ${loc}`, loc);
    } else {
        // Chance de Evento Aleatório (Saco de Eventos)
        if (Math.random() < 0.3) {
            if (GameState.ui.eventosDisponiveis.length === 0) {
                GameState.ui.eventosDisponiveis = [...eventosDB]; // Refill
            }

            const index = Math.floor(Math.random() * GameState.ui.eventosDisponiveis.length);
            const evt = GameState.ui.eventosDisponiveis[index];
            GameState.ui.eventosDisponiveis.splice(index, 1);

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

        // Spawn Normal
        let monstrosParaSpawnar = 0;
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

function spawnMonstro(n, h, msg, loc) {
    if (GameState.entidades.monstros.length >= GameState.config.maxMonstros) {
        alert(`GAME OVER! Colapso por Superpopulação (Máx ${GameState.config.maxMonstros})!`);
        GameState.status.corrupcao = 100;
        atualizarCorrupcaoUI();
        return;
    }
    GameState.counters.idMonstro++;
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

function renderLista() {
    const container = document.getElementById('lista-monstros');
    container.innerHTML = "";
    const lista = GameState.entidades.monstros;
    const count = lista.length;
    const max = GameState.config.maxMonstros;

    const titleEl = document.getElementById('threat-title');
    titleEl.innerText = `Ameaças Ativas (${count}/${max})`;
    titleEl.style.color = count >= (max - 1) ? "var(--red-fire)" : "var(--text-ink)";

    const grupos = {};
    lista.forEach(m => {
        const zona = m.loc || "DESCONHECIDO";
        if (!grupos[zona]) grupos[zona] = [];
        grupos[zona].push(m);
    });

    Object.keys(grupos).sort().forEach(zona => {
        const header = document.createElement('div');
        header.className = 'zone-header';
        header.innerText = `📍 ZONA ${zona}`;
        container.appendChild(header);

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
    document.getElementById('threat-level').innerText = `Aumento: +${count * 3}% Corrupção/Turno`;
}

// --- 5. LÓGICA DE EVENTOS ---

function fecharEvento() { document.getElementById('modal-evento').style.display = 'none'; }

function abrirEvento(idList) {
    const item = GameState.entidades.monstros.find(x => x.id === idList);
    if (!item || item.type !== 'evento') return;
    const evtData = eventosDB.find(e => e.nome === item.nome);
    if (!evtData) return;

    GameState.ui.eventoAtual = { ...evtData, listId: idList };

    document.getElementById('evt-icon').innerText = evtData.icon;
    document.getElementById('evt-title').innerText = evtData.nome;
    document.getElementById('evt-desc').innerText = evtData.desc;

    // Atualiza botões
    const optsDiv = document.querySelector('.event-card-content'); // Fallback visual
    // Aqui assume-se que o HTML tem botões estáticos ou que são gerados.
    // Para simplificar, usamos a lógica antiga de botões HTML fixos chamando resolverEvento('A' ou 'B')
    document.getElementById('modal-evento').style.display = 'flex';
}

function resolverEvento(opt) {
    const evt = GameState.ui.eventoAtual;
    if (!evt) return;

    const data = (opt === 'A') ? evt.optA : evt.optB;
    alert(data.res);
    addLog(`❓ Evento: ${data.res}`);

    if (data.loot) pegarLoot(data.loot, true);
    if (data.corr) {
        GameState.status.corrupcao += data.corr;
        if (GameState.status.corrupcao < 0) GameState.status.corrupcao = 0;
        atualizarCorrupcaoUI();
    }

    if (data.spawn) {
        const hp = data.spawnHp || 4;
        const monstroOrigem = GameState.entidades.monstros.find(m => m.id === evt.listId);
        if (monstroOrigem) {
            spawnMonstro(data.spawn, hp, `⚠️ PERIGO: ${data.spawn} acordou!`, monstroOrigem.loc);
        }
    }

    GameState.entidades.monstros = GameState.entidades.monstros.filter(m => m.id !== evt.listId);
    renderLista();
    fecharEvento();
}

// --- 6. SISTEMA DE LOOT & INVENTÁRIO (STRATEGY PATTERN) ---

const ItemEffects = {
    "Água de Coco": () => { GameState.status.corrupcao = Math.max(0, GameState.status.corrupcao - 3); atualizarCorrupcaoUI(); alert("Água de Coco: Corrupção reduzida em 3%!"); return true; },
    "Óleo": () => { GameState.status.corrupcao = Math.max(0, GameState.status.corrupcao - 3); atualizarCorrupcaoUI(); alert("Óleo: Cura Total aplicada."); return true; },
    "Mel de Jataí": () => { alert("Recuperou 1 HP!"); return true; },
    "Panelada da Vovó": () => { alert("Recuperou 2 HP!"); return true; },
    "Berrante da Mata": () => { if (GameState.entidades.monstros.length > 0) { GameState.entidades.monstros.pop(); renderLista(); alert("O som do berrante espantou um monstro!"); return true; } alert("Não há monstros para espantar."); return false; },
    "Vento do Saci": () => { alert("Teletransporte realizado!"); return true; },
    "Pen Drive Ancestral": () => { alert("Reroll dos dados disponível!"); return true; },
    "Açaí Atômico": () => { alert("Energia recuperada!"); return true; },
    "Bebida de Guaraná": () => { alert("Foco aumentado!"); return true; },

    // Combate
    "Veneno de Sapo": (inBattle) => { if (!inBattle) return "BATALHA"; CombatState.buffDano += 2; alert("Lâmina envenenada! +2 de Dano."); return true; },
    "Dente de Onça": (inBattle) => { alert("Fúria da Onça! Role +1 dado."); return true; },
    "Rede de Pesca": (inBattle) => { if (!inBattle) return "BATALHA"; if (CombatState.inimigo) { CombatState.inimigo.fraqueza = true; alert("Inimigo enredado!"); return true; } return false; },
    "Esporos de Confusão": (inBattle) => { if (!inBattle) return "BATALHA"; if (CombatState.inimigo) { CombatState.inimigo.fraqueza = true; alert("Inimigo atordoado!"); return true; } return false; },
    "Lança de Tucum": (inBattle) => aplicarDanoItem(3, inBattle),
    "Tridente do Rio": (inBattle) => aplicarDanoItem(3, inBattle),
    "Chama": (inBattle) => aplicarDanoItem(5, inBattle),
    "Arco Sombrio": (inBattle) => aplicarDanoItem(5, inBattle),

    // Passivos
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

function usarItem(index, isBattleContext) {
    const item = GameState.entidades.inventario[index];
    if (!item) return;
    const effectKey = Object.keys(ItemEffects).find(key => item.nome.includes(key));

    if (effectKey) {
        if (confirm(`Deseja usar: ${item.nome}?`)) {
            const action = ItemEffects[effectKey];
            const result = action(isBattleContext);
            if (result === "BATALHA") { alert("Este item só pode ser usado durante o combate!"); }
            else if (result === true) {
                GameState.entidades.inventario.splice(index, 1);
                addLog(`✨ Usou: ${item.nome}`);
                renderInventario();
                if (isBattleContext) renderBattleInventory();
            }
        }
    } else { alert(`O item "${item.nome}" foi usado, mas não teve efeito visível.`); }
}

function gerarLoot(t) {
    const m = document.getElementById('modal-loot');
    const c = document.getElementById('loot-container');
    c.innerHTML = "";

    const itensQuest = ["Panelada da Vovó", "Esporos de Confusão", "O Olho da Cobiça"];
    const bossDrops = bossesDB.map(b => b.loot);
    const itensProibidos = [...itensQuest, ...bossDrops];

    let pool;
    if (t === 'boss') {
        pool = lootDB.filter(i => (i.tier === 'epico' || i.tier === 'lendario') && !itensProibidos.includes(i.nome));
    } else {
        pool = lootDB.filter(i => (i.tier === 'comum' || i.tier === 'raro') && !itensProibidos.includes(i.nome));
    }

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

const CombatState = {
    inimigo: null,
    buffDano: 0,
    buffEnxame: 0,
    isBoss: false,

    reset: function (monstro) {
        this.inimigo = monstro;
        this.buffDano = 0;
        this.buffEnxame = 0;
        this.isBoss = monstro.nome.includes("BOSS") || monstro.nome.includes("GLITCH") || monstro.nome.includes("Cuca") || monstro.nome.includes("Boto") || monstro.nome.includes("Jurupari") || monstro.nome.includes("Devorador");

        const aliados = GameState.entidades.monstros.filter(m => m.loc === monstro.loc && m.id !== monstro.id).length;
        if (aliados > 0 && !this.isBoss && monstro.type !== 'evento') {
            this.buffEnxame = 1;
        }
    }
};

function abrirCombate(id) {
    AudioSys.sfx.click();
    const monstro = GameState.entidades.monstros.find(m => m.id === id);
    if (!monstro) return;

    CombatState.reset(monstro);
    monstroCombateAtual = monstro; // Compatibilidade

    document.getElementById('modal-combate').style.display = 'flex';
    document.getElementById('modal-titulo').innerText = "VS " + monstro.nome.toUpperCase();

    let hpText = monstro.hp + " HP";
    if (CombatState.buffEnxame > 0) hpText += " <span style='color:red; font-size:0.6em'>(+1 Dano Enxame)</span>";
    document.getElementById('modal-hp').innerHTML = hpText;

    AudioSys.playMusic(CombatState.isBoss ? 'boss' : 'common');
    document.getElementById('btn-villain-atk').innerText = CombatState.isBoss ? "👹 ATAQUE BOSS (1d4)" : "👹 ATAQUE VILÃO (1d3)";
    document.getElementById('combat-feedback').innerHTML = "Preparem-se...";
    document.getElementById('dmg-manual').value = "";

    renderBattleInventory();
    resetDice();
    atualizarSelecaoHerois(monstro);
}

function ataqueBasico() {
    AudioSys.checkResume();
    const dadosBons = Array.from(document.querySelectorAll('.dice-input.good')).map(i => parseInt(i.value) || 0);
    const dadosRuins = Array.from(document.querySelectorAll('.dice-input.bad')).map(i => parseInt(i.value) || 0);
    if (dadosBons.length === 0 && dadosRuins.length === 0) return;

    const hits = [...dadosBons, ...dadosRuins].filter(v => v >= 4).length;
    const maxBom = Math.max(0, ...dadosBons);
    const maxRuim = Math.max(0, ...dadosRuins);
    const ganhouEnergia = maxBom > maxRuim;
    const isCritico = (maxBom === maxRuim && maxBom > 0);

    let danoFinal = hits;
    let msg = "";
    let cssClass = "log-miss";

    if (isCritico) {
        if (danoFinal === 0) danoFinal = 1;
        msg = `💥 CRÍTICO! (${danoFinal} Dano)`;
        cssClass = "log-crit";
        AudioSys.sfx.crit();
    } else if (danoFinal > 0) {
        msg = `⚔️ ACERTOU! (${danoFinal} Dano)`;
        if (ganhouEnergia) msg += " + ⚡ Energia";
        cssClass = "log-hit";
        AudioSys.sfx.hit();
    } else {
        msg = ganhouEnergia ? "❌ ERROU (+ ⚡ Energia)" : "❌ ERROU!";
        AudioSys.playTone(150, 'sine', 0.2);
    }

    if (danoFinal > 0 && CombatState.buffDano > 0) {
        danoFinal += CombatState.buffDano;
        msg += `<br><small>+${CombatState.buffDano} Bônus</small>`;
        CombatState.buffDano = 0;
    }

    document.getElementById('combat-feedback').innerHTML = `<span class="${cssClass}">${msg}</span>`;
    addLog(`🎲 ${getActiveHeroName()}: ${msg.replace('<br>', ' ')}`);

    if (danoFinal > 0) aplicarDanoReal(danoFinal, false);
}

function aplicarDanoReal(dano, isDanoNoHeroi) {
    if (!CombatState.inimigo) return;

    if (!isDanoNoHeroi) {
        CombatState.inimigo.hp -= dano;
        document.getElementById('modal-hp').innerText = CombatState.inimigo.hp + " HP";

        showFloatingText(dano, window.innerWidth / 2, window.innerHeight / 2 - 100, 'dmg-hero');

        if (CombatState.inimigo.hp <= 0) {
            finalizarVitoria();
        }
    }
}

function turnoVilao(isCarregando) {
    AudioSys.checkResume();
    if (!CombatState.inimigo) return;

    const alvos = document.querySelectorAll('.target-chk:checked');
    if (alvos.length === 0) { alert("Selecione quem vai tomar o dano!"); return; }

    const alvoEscolhido = alvos[Math.floor(Math.random() * alvos.length)].value.toUpperCase();
    const btn = document.getElementById('btn-villain-atk');

    btn.disabled = true;
    btn.style.opacity = "0.5";
    document.getElementById('combat-feedback').innerText = "⚠ Vilão preparando ataque...";
    AudioSys.playTone(100, 'sawtooth', 0.5);

    setTimeout(() => {
        let danoMax = CombatState.isBoss ? 4 : 2;
        let dano = Math.floor(Math.random() * danoMax) + 1;

        if (CombatState.buffEnxame > 0 && !CombatState.isBoss) dano += 1;
        if (CombatState.inimigo.fraqueza) {
            dano = 1;
            CombatState.inimigo.fraqueza = false;
            addLog("🕸️ Vilão estava enredado (Dano reduzido para 1)");
        }

        document.body.classList.add('shake-active');
        AudioSys.sfx.villain();
        showFloatingText(dano, window.innerWidth / 2, window.innerHeight / 2 + 50, 'dmg-enemy');

        const msg = `⚔️ ${alvoEscolhido} TOMOU ${dano} DANO!`;
        document.getElementById('combat-feedback').innerHTML = `<div class="villain-strike-text">${msg}</div>`;
        addLog(`👹 ${CombatState.inimigo.nome} atacou ${alvoEscolhido} (${dano})`);

        setTimeout(() => {
            document.body.classList.remove('shake-active');
            btn.disabled = false;
            btn.style.opacity = "1";
        }, 500);
    }, 800);
}

function finalizarVitoria() {
    AudioSys.playMusic('victory');
    document.getElementById('combat-feedback').innerHTML = "<span class='log-crit'>💀 INIMIGO DERROTADO!</span>";

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

function usarHabilidade() {
    const dano = parseInt(document.getElementById('dmg-manual').value);
    if (isNaN(dano)) return;
    AudioSys.sfx.crit();
    document.getElementById('combat-feedback').innerHTML = `<span class="log-hit">✨ HABILIDADE (-${dano} HP)</span>`;
    addLog(`✨ Habilidade usada: ${dano} dano.`);
    aplicarDanoReal(dano, false);
}

function atualizarSelecaoHerois(monstro) {
    const select = document.getElementById('active-hero');
    const zoneDiv = document.getElementById('zone-targets');
    select.innerHTML = ""; zoneDiv.innerHTML = "";

    GameState.entidades.herois.forEach(heroi => {
        const opt = document.createElement('option');
        opt.value = heroi;
        opt.innerText = heroi.toUpperCase();
        select.appendChild(opt);

        const disabledAttr = CombatState.isBoss ? "onclick='return false;'" : "";
        zoneDiv.innerHTML += `<label class="target-label"><input type="checkbox" value="${heroi}" class="target-chk" checked ${disabledAttr}> ${heroi.toUpperCase()}</label>`;
    });
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

// --- DEBUG SYSTEM ---
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