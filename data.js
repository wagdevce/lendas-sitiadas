/* --- BANCO DE DADOS DE HERÓIS (Fiel às Cartas) --- */
const heroisDB = {
    "Saci": {
        role: "Controle",
        // Ataque Básico (Automático no Crítico)
        onCrit: "stun", // Confusão = Stun por enquanto
        onCritTurns: 1,
        
        // Botão de Habilidade: Skill [2] Redemoinho
        skillName: "🌪️ Redemoinho",
        desc: "ATAQUE EM ÁREA. Causa 1 de dano em TODOS os inimigos da zona.",
        cost: "1 Energia ⚡",
        damage: 1, 
        statusApply: null // Redemoinho é dano puro em área
    },
    "Boitatá": {
        role: "Tanque",
        // Ataque Básico (Automático no Crítico)
        onCrit: "burn",
        onCritTurns: 2,

        // Botão de Habilidade: Skill [3] Escudo de Escamas
        skillName: "🛡️ Escudo de Escamas",
        desc: "IMUNIDADE TOTAL. Você não recebe dano ou status até o próximo turno.",
        cost: "3 Energias ⚡⚡⚡",
        damage: 0,
        statusApply: "immune", // Novo status para implementar depois se quiser
        turns: 1
    },
    "Iara": {
        role: "Suporte",
        // Ataque Básico (Automático no Crítico)
        onCrit: "stun", // Prisão = Stun
        onCritTurns: 1,

        // Botão de Habilidade: Skill [2] Melodia Suave
        skillName: "🎵 Melodia Suave",
        desc: "CURA FLEXÍVEL. Cure 1 de Vida de aliados na sua zona.",
        cost: "1 Energia ⚡",
        damage: 0,
        statusApply: null,
        isHeal: true
    },
    "Caipora": {
        role: "Dano",
        // Ataque Básico (Automático no Crítico)
        onCrit: "bleed", 
        onCritTurns: 3,

        // Botão de Habilidade: Skill [3] Fúria da Alcatéia
        skillName: "🐾 Fúria da Alcatéia",
        desc: "ATAQUE BRUTAL. Role 4 Dados Bons manualmente. (O App apenas registra o uso).",
        cost: "2 Energias ⚡⚡",
        damage: 0, // Dano variável, jogador resolve no dado físico
        statusApply: null
    }
};

const monstrosDB = [{ nome: "Rastro de Pólvora", hp: 3 }, { nome: "Serra Autônoma", hp: 4 }, { nome: "Lama Tóxica", hp: 3 }, { nome: "Fogo Fátuo", hp: 3 }, { nome: "Golem de Mercúrio", hp: 4 }];
const bossesDB = [
    { nome: "👁️ Alucinação da Cuca", hp: 13, turn: 5, title: "BOSS: A MENTE MENTE!", loot: "🧿 Amuleto da Cuca" },
    { nome: "☣️ Boto de Piche", hp: 15, turn: 8, title: "BOSS: O SEDUTOR TÓXICO!", loot: "🔱 Tridente do Rio" },
    { nome: "🚜 O Devorador de Ferro", hp: 18, turn: 10, title: "SUB-CHEFE MECÂNICO!", loot: "🛢️ Óleo de Motor" },
    { nome: "🌑 Jurupari, o Pesadelo", hp: 21, turn: 12, title: "BOSS: O PROTETOR CAÍDO!", loot: "🏹 Arco Sombrio" },
    { nome: "👾 A Falha na Realidade", hp: 33, turn: 15, title: "OBJETIVO FINAL: DELETE O VÍRUS!", loot: "👑 Coroa do Rei do Mato" }
];

const lootDB = [
    { nome: "🍇 Açaí Atômico", effect: "Recupere 2 Energias.", tier: "comum", discovered: false },
    { nome: "🥤 Bebida de Guaraná", effect: "Reroll dados.", tier: "comum", discovered: false },
    { nome: "🍯 Mel de Jataí", effect: "Cura 1 HP.", tier: "comum", discovered: false },
    { nome: "🥘 Panelada da Vovó", effect: "Cura 2 HP.", tier: "missao", discovered: false },
    { nome: "🥥 Água de Coco", effect: "Remove 3% Corrupção.", tier: "comum", discovered: false },
    { nome: "🕸️ Rede de Pesca", effect: "Aplica Fraqueza.", tier: "raro", discovered: false },
    { nome: "🐸 Veneno de Sapo", effect: "+2 Dano prox atk.", tier: "raro", discovered: false },
    { nome: "🦷 Dente de Onça", effect: "Role +1 Dado neste turno.", tier: "raro", discovered: false },
    { nome: "✨ Esporos de Confusão", effect: "Stun Inimigo.", tier: "missao", discovered: false },
    { nome: "📯 Berrante da Mata", effect: "Remove 1 monstro.", tier: "raro", discovered: false },
    { nome: "🌿 Óleo de Copaíba", effect: "Cura 2 HP + Veneno.", tier: "raro", discovered: false },
    { nome: "🗡️ Lança de Tucum", effect: "3 Dano direto.", tier: "epico", discovered: false },
    { nome: "🌪️ Vento do Saci", effect: "Teletransporte.", tier: "epico", discovered: false },
    { nome: "💾 Pen Drive Ancestral", effect: "Reroll Total.", tier: "epico", discovered: false },
    { nome: "🧿 Amuleto da Cuca", effect: "Imunidade Total por 1 Turno.", tier: "lendario", discovered: false },
    { nome: "🔱 Tridente do Rio", effect: "Cause 3 Dano + Stun.", tier: "lendario", discovered: false },
    { nome: "🛢️ Óleo de Motor", effect: "Recupera TODA Vida e Energia.", tier: "lendario", discovered: false },
    { nome: "🏹 Arco Sombrio", effect: "5 Dano direto (Ignora defesa).", tier: "lendario", discovered: false },
    { nome: "💎 O Olho da Cobiça", effect: "Passiva: +1 Dado ATK. Maldição: +2% Corr/Turno.", tier: "missao", discovered: false },
    { nome: "👑 Coroa do Rei do Mato", effect: "VENCE O JOGO.", tier: "lendario", discovered: false }
];

const eventosDB = [
    {
        id: "cabana", nome: "Cabana do Eremita", icon: "🏚️",
        desc: "Uma chaminé solta fumaça roxa. Alguém mora ali.",
        optA: { txt: "Bater na Porta", res: "O eremita cura você! (Recupere 3 HP)" },
        optB: { txt: "Roubar Suprimentos", res: "Você roubou uma Panelada! (+5% Corrupção)", loot: "🥘 Panelada da Vovó", corr: 5 }
    },
    {
        id: "cogumelos", nome: "Círculo de Cogumelos", icon: "🍄",
        desc: "Um círculo de fungos neon pulsa no chão.",
        optA: { txt: "Entrar no Círculo", res: "Magia selvagem! Você ganha 2 Energias." },
        optB: { txt: "Queimar Tudo", res: "Os esporos explodem! (Tome 1 Dano). Mas você coleta o pó.", loot: "✨ Esporos de Confusão" }
    },
    {
        id: "totem", nome: "Totem Esquecido", icon: "🗿",
        desc: "Uma estátua antiga com um rubi brilhante na testa.",
        optA: { txt: "Rezar aos Antigos", res: "Paz momentânea. (A Corrupção desce 5%).", corr: -5 },
        optB: { txt: "Roubar o Rubi", res: "Você pegou a Joia Maldita! O Guardião despertou!", loot: "💎 O Olho da Cobiça", spawn: "👹 O Guardião do Rubi", spawnHp: 6 }
    }
];
