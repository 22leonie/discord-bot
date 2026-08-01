const { sendSupportEmbed } = require('./embed-support-haven.js');
const path = require('path');
require("dotenv").config();

// ==========================================
// SYSTÈME DE LOGGING CENTRALISÉ
// ==========================================
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

const LOG_COLORS = {
  ERROR: '\x1b[31m', // Rouge
  WARN: '\x1b[33m',  // Jaune
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[35m', // Magenta
  RESET: '\x1b[0m',  // Reset
};

function getTimestamp() {
  return new Date().toLocaleString('fr-FR', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

function log(level, category, message, data = null) {
  const color = LOG_COLORS[level] || LOG_COLORS.INFO;
  const timestamp = getTimestamp();
  const emoji = {
    ERROR: '❌',
    WARN: '⚠️',
    INFO: 'ℹ️',
    DEBUG: '🐛'
  }[level];
  
  let logMessage = `${color}[${timestamp}] ${emoji} [${level}] [${category}]${LOG_COLORS.RESET} ${message}`;
  
  if (data) {
    logMessage += '\n' + JSON.stringify(data, null, 2);
  }
  
  if (level === 'ERROR') {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
}

const logger = {
  info: (category, message, data) => {
    log(LOG_LEVELS.INFO, category, message, data);
    if (global.botClient && global.botClient.user) {
      sendLogToChannel(category, `**INFO** - ${message}${data ? '\n```json\n' + JSON.stringify(data, null, 2) + '\n```' : ''}`, global.botClient).catch(() => {});
    }
  },
  warn: (category, message, data) => {
    log(LOG_LEVELS.WARN, category, message, data);
    if (global.botClient && global.botClient.user) {
      sendLogToChannel(category, `**WARN** - ${message}${data ? '\n```json\n' + JSON.stringify(data, null, 2) + '\n```' : ''}`, global.botClient).catch(() => {});
    }
  },
  error: (category, message, data) => {
    log(LOG_LEVELS.ERROR, category, message, data);
    if (global.botClient && global.botClient.user) {
      sendLogToChannel(category, `**ERROR** - ${message}${data ? '\n```json\n' + JSON.stringify(data, null, 2) + '\n```' : ''}`, global.botClient).catch(() => {});
    }
  },
  debug: (category, message, data) => {
    log(LOG_LEVELS.DEBUG, category, message, data);
  },
};

// ==========================================
// FONCTION POUR ENVOYER LES LOGS AUX SALONS
// ==========================================
async function sendLogToChannel(category, message, client) {
  try {
    let channelId = null;
    
    // Déterminer le salon selon la catégorie
    switch(category) {
      case 'MEMBER_JOIN':
      case 'MEMBER_LEAVE':
        channelId = LOGS_MEMBRES_CHANNEL_ID;
        break;
      case 'MESSAGE_DELETE':
      case 'MESSAGE_UPDATE':
      case 'MESSAGE':
        channelId = MESSAGE_LOGS_CHANNEL_ID;
        break;
      case 'MODERATION':
      case 'SLASH_COMMAND':
        channelId = LOGS_MODERATION_CHANNEL_ID;
        break;
      case 'RAID':
        channelId = LOGS_RAIDS_CHANNEL_ID;
        break;
      case 'TICKET':
        channelId = LOGS_TICKETS_CHANNEL_ID;
        break;
      case 'BLACKLIST':
        channelId = BLACKLIST_LOG_CHANNEL_ID;
        break;
      case 'ERROR':
      case 'PROCESS':
        channelId = LOGS_ERREURS_CHANNEL_ID;
        break;
      case 'BOT':
        channelId = LOGS_COMMANDES_CHANNEL_ID;
        break;
    }
    
    if (channelId && client && client.user) {
      try {
        const guild = client.guilds.cache.first();
        if (guild) {
          const channel = guild.channels.cache.get(channelId);
          if (channel && channel.isTextBased && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle(`📋 [${category}]`)
              .setDescription(message)
              .setColor(0x5865F2)
              .setTimestamp();
            
            await channel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      } catch (e) {
        // Silencieusement ignorer les erreurs d'envoi
      }
    }
  } catch (err) {
    // Silencieusement ignorer les erreurs d'envoi de logs
  }
}

// ==========================================
// BLACKLIST SYSTEM
// ==========================================

const fs = require('fs');

// Chemin du fichier de blacklist
const BLACKLIST_FILE = './blacklist.json';

// Charger les données de blacklist
function loadBlacklist() {
  if (!fs.existsSync(BLACKLIST_FILE)) {
    logger.info('BLACKLIST', 'Fichier blacklist non trouvé, création d\'un nouveau');
    saveBlacklist({ guilds: {} });
    return { guilds: {} };
  }
  try {
    const data = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
    logger.info('BLACKLIST', 'Fichier blacklist chargé avec succès', { guilds: Object.keys(data.guilds || {}).length });
    return data;
  } catch (err) {
    logger.error('BLACKLIST', 'Erreur lors du chargement de la blacklist', err);
    return { guilds: {} };
  }
}

// Sauvegarder les données de blacklist
function saveBlacklist(data) {
  try {
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(data, null, 2));
    logger.debug('BLACKLIST', 'Blacklist sauvegardée');
  } catch (err) {
    logger.error('BLACKLIST', 'Erreur lors de la sauvegarde de la blacklist', err);
  }
}

let blacklistData = loadBlacklist();

// Helper: obtenir la blacklist d'un serveur
function getServerBlacklist(guildId) {
  if (!blacklistData.guilds[guildId]) {
    blacklistData.guilds[guildId] = {};
  }
  return blacklistData.guilds[guildId];
}

// ==========================================
// STATS SYSTEM
// ==========================================

const STATS_FILE = './stats.json';

function loadStats() {
  if (!fs.existsSync(STATS_FILE)) {
    logger.info('STATS', 'Fichier stats non trouvé, création d\'un nouveau');
    saveStats({ guilds: {} });
    return { guilds: {} };
  }
  try {
    const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    logger.info('STATS', 'Fichier stats chargé avec succès');
    return data;
  } catch (err) {
    logger.error('STATS', 'Erreur lors du chargement des stats', err);
    return { guilds: {} };
  }
}

function saveStats(data) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
    logger.debug('STATS', 'Stats sauvegardées');
  } catch (err) {
    logger.error('STATS', 'Erreur lors de la sauvegarde des stats', err);
  }
}

let statsData = loadStats();

function getGuildStats(guildId) {
  if (!statsData.guilds[guildId]) {
    statsData.guilds[guildId] = { members: {} };
  }
  return statsData.guilds[guildId];
}

// ==========================================
// FONCTION: EMBED STATS SERVEUR (OWNER ONLY)
// ==========================================
async function createServerStatsEmbed(guild) {
  const totalMembers = guild.memberCount;
  const inviteUrl = "https://discord.gg/haven";
  
  const embed = new EmbedBuilder()
    .setTitle(`🔒 Total : ${totalMembers}`)
    .setColor(0x5865F2)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: "🔗 Lien d'invitation", value: inviteUrl, inline: false }
    )
    .setFooter({ text: "Stats du serveur Haven" })
    .setTimestamp();
  
  return embed;
}

const snipeCache = new Map();
const MAX_SNIPE = 5;

// Helper: log une action blacklist
async function logBlacklistAction(guild, action, userId, moderatorId, reason = '') {
  try {
    const logChannel = await guild.channels.fetch(BLACKLIST_LOG_CHANNEL_ID);
    if (!logChannel) {
      logger.warn('BLACKLIST', `Canal de log blacklist non trouvé (${BLACKLIST_LOG_CHANNEL_ID})`);
      return;
    }

    const moderator = await guild.members.fetch(moderatorId).catch(() => null);
    const modName = moderator ? moderator.user.tag : `ID: ${moderatorId}`;

    const embed = new EmbedBuilder();
    
    if (action === 'add') {
      embed
        .setTitle('🚫 Membre Blacklisté')
        .setDescription(`**ID:** ${userId}\n**Raison:** ${reason || 'Non spécifiée'}`)
        .setColor(0xff0000)
        .setFooter({ text: `Par ${modName}` })
        .setTimestamp();
      logger.info('BLACKLIST', `Membre ajouté à la blacklist`, { userId, moderatorId: modName, reason });
    } else if (action === 'remove') {
      embed
        .setTitle('✅ Retiré de la Blacklist')
        .setDescription(`**ID:** ${userId}`)
        .setColor(0x00ff00)
        .setFooter({ text: `Par ${modName}` })
        .setTimestamp();
      logger.info('BLACKLIST', `Membre retiré de la blacklist`, { userId, moderatorId: modName });
    }

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error('BLACKLIST', 'Erreur lors de l\'envoi du log blacklist', err);
  }
}

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
} = require("discord.js");

// ==========================================
// CAPTURE DES ERREURS GLOBALES (pour debug)
// ==========================================
process.on("unhandledRejection", (err) => {
  logger.error("PROCESS", "Erreur non gérée (unhandledRejection)", err);
});

process.on("uncaughtException", (err) => {
  logger.error("PROCESS", "Erreur non gérée (uncaughtException)", err);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Stocker le client dans une variable globale pour les logs
global.botClient = client;

// ==========================================
// CONFIG — à adapter à ton serveur
// ==========================================
const WELCOME_CHANNEL_ID = "1529824541503914116"; // salon de bienvenue
const TICKET_PARENT_CATEGORY_ID = "1529829854202036264"; // catégorie où seront créés les tickets
const SUPPORT_CHANNEL_ID = "1529830375755612350"; // salon info-support
const LEASH_ROLE_ID = "1530570875856748654"; // rôle attribué aux membres "en laisse"

// ==========================================
// SALONS DE LOGS
// ==========================================
const LOG_CHANNEL_ID = "1529952686995279942"; // logs-sanctions
const MESSAGE_LOGS_CHANNEL_ID = "1530534584511631503"; // logs-messages
const LOGS_MODERATION_CHANNEL_ID = "1531613018104795287"; // logs-moderation
const LOGS_MEMBRES_CHANNEL_ID = "1531613107963691049"; // logs-membres
const LOGS_RAIDS_CHANNEL_ID = "1531613185415839846"; // logs-raids
const LOGS_TICKETS_CHANNEL_ID = "1531613257457209444"; // logs-tickets
const LOGS_ERREURS_CHANNEL_ID = "1531613307859894282"; // logs-erreurs
const LOGS_COMMANDES_CHANNEL_ID = "1531613356686049321"; // logs-commandes
const BLACKLIST_LOG_CHANNEL_ID = "1531050059964354781"; // logs-bl

// ==========================================
// AUTRES CONFIGS
// ==========================================
const TICKET_MENTION_ID = "1529830524498087967"; // salon/catégorie à mentionner dans le règlement
const LEVELS_CHANNEL_ID = "1530404061810135240"; // salon où sont annoncés les passages de niveau

// ==========================================
// SALONS VOCAUX TEMPORAIRES (Voicemaster-like)
// ==========================================
const VOICE_HUB_CHANNEL_ID = "1530541906600132739"; // salon "➕ Créer un salon"
const VOICE_TEMP_CATEGORY_ID = "1530542137219874876"; // catégorie où créer les salons temporaires

// ==========================================
// ANTI-RAID
// ==========================================
const RAID_JOIN_THRESHOLD = 5; // nombre d'arrivées
const RAID_TIME_WINDOW = 10000; // en 10 secondes -> déclenche le mode raid
const RAID_MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // comptes < 7 jours expulsés pendant un raid
const RAID_AUTO_DURATION = 10 * 60 * 1000; // durée du mode auto (10 minutes)

const joinTracker = []; // timestamps des arrivées récentes
let raidModeActive = false;
let raidModeAuto = false; // true si activé automatiquement (donc auto-désactivable)
let raidModeTimeout = null;

const TICKET_CATEGORIES = {
  staff: {
    label: "Gestion Staff",
    roleId: "1529899264644481126",
    emoji: "🎓",
  },
  abus: {
    label: "Gestion Abus",
    roleId: "1529899417199710390",
    emoji: "🛡️",
  },
  animation: {
    label: "Animation",
    roleId: "1529899852165808148",
    emoji: "🎪",
  },
  partenariat: {
    label: "Community Manager",
    roleId: "1529899994583138454",
    emoji: "🤝",
  },
};

const SELF_ROLES = {
  genre: {
    homme: "1530171634516758578",
    femme: "1530171391616356393",
  },
  age: {
    mineur: "1530171965581561977",
    majeur: "1530172039132877002",
  },
  situation: {
    celibataire: "1530172303483342889",
    couple: "1530172421569515690",
    complique: "1530172607540760626",
  },
};

// ==========================================
// AIDE / LISTE DES COMMANDES PAR CATÉGORIE (!aide)
// ==========================================
const HELP_CATEGORIES = {
  moderation: {
    label: "Modération",
    emoji: "🛡️",
    commands: [
      "`!clear <nombre>` — Supprime en masse des messages (1-100)",
      "`!purge @user <nombre>` — Supprime les X derniers messages d'une personne",
      "`!lock` — Verrouille le salon actuel",
      "`!unlock` — Déverrouille le salon actuel",
      "`!warnings [@user]` — Affiche l'historique des avertissements",
      "`!unban <id>` — Débannit un membre via son ID",
      "`!raidmode [on/off]` — Active/désactive le mode anti-raid",
      "`!dog-add @user` — Met un membre en laisse 🐕",
      "`!dog-del @user` — Retire la laisse d'un membre",
      "`!dog-list` — Affiche la liste des membres en laisse",
      "`/ban /kick /mute /warn` — Commandes slash de modération",
    ],
  },
  tickets: {
    label: "Support & Panels",
    emoji: "🎫",
    commands: [
      "`!support` — Envoie l'embed de support",
      "`!ticketpanel` — Poste le menu de création de tickets",
      "`!rolesmenu` — Poste les menus de rôles auto",
      "`!soutiens` — Poste l'embed « Soutiens Haven »",
      "`!reglement` — Poste le règlement du serveur",
    ],
  },
  vocaux: {
    label: "Salons vocaux",
    emoji: "🔊",
    commands: [
      "`=pv` — Rend ton salon privé / public",
      "`=all` — Donne l'accès à tous les membres présents",
      "`=acces @user` — Donne/retire l'accès à un membre",
      "`=mv @user` — Déplace un membre dans ton salon",
      "`=limit <0-99>` — Définit une limite de membres",
      "`=transfer @user` — Transfère la propriété du salon",
      "`=find @user` — Trouve dans quel vocal est un membre",
      "`=join @user` — Demande à rejoindre un salon privé",
      "`=follow @user` / `=unfollow` — Suivre/arrêter de suivre",
      "`=ghost @user` — Bloque l'accès (staff)",
      "`=menotte @user <id_salon>` / `=demenotte @user` — (staff)",
      "`=vmall #salon1 #salon2` — Déplace tout le monde (staff)",
    ],
  },
  niveaux: {
    label: "Niveaux & Profils",
    emoji: "📈",
    commands: [
      "`!rank [@user]` — Affiche le niveau et l'XP",
      "`!leaderboard` / `!top` — Classement des 10 plus actifs",
      "`!badges [@user]` — Affiche les badges débloqués",
      "`!profile [@user]` — Génère une carte de profil",
    ],
  },
  mariage: {
    label: "Mariage & Ship",
    emoji: "💍",
    commands: [
      "`!marry @user` — Demande quelqu'un en mariage",
      "`!divorce` — Rompt ton mariage actuel",
      "`!married [@user]` — Affiche le/la partenaire",
      "`!couples` — Liste les couples mariés",
      "`!ship @user1 [@user2]` — % de compatibilité",
    ],
  },
  fun: {
    label: "Fun & Social",
    emoji: "🎉",
    commands: [
      "`!doro @user` — Demande un câlin doro",
      "`!compliment @user` / `!insulte @user`",
      "`!calin` `!bisou` `!slap` `!pat @user` — GIFs",
      "`!8ball <question>` — Boule magique",
      "`!blague` — Blague aléatoire",
      "`!meme` — Meme aléatoire",
      "`=confession <texte>` — Confession anonyme dans #confessions",
      "`=coin` — Lance une pièce (pile/face)",
      "`=suggest <texte>` — Suggestion votable 👍👎",
      "`=affinité [@user]` — % de compatibilité",
      "`=profile [@user]` — Carte de profil complet",
    ],
  },
  animation: {
    label: "Animation & Jeux",
    emoji: "🎪",
    commands: [
      "`!rps @user` — Pierre-feuille-ciseaux",
      "`!tictactoe @user` / `!ttt @user` — Morpion",
      "`!dice [NdN]` — Lance un ou plusieurs dés",
      "`!roulette <options>` — Roue animée",
      "`!quiz` — Quiz à choix multiples",
    ],
  },
  sondages: {
    label: "Sondages",
    emoji: "📊",
    commands: [
      "`!sondage <question>` — Sondage simple ✅/❌",
      "`!poll <question> | opt1 | opt2...` — Sondage à choix multiples",
      "`!suggestion <texte>` — Suggestion votable 👍/👎",
    ],
  },
  utilitaires: {
    label: "Utilitaires",
    emoji: "🛠️",
    commands: [
      "`!avatar [@user]` — Affiche l'avatar en grand",
      "`!userinfo [@user]` — Infos sur un membre",
      "`!serverinfo` — Infos sur le serveur",
      "`!uptime` — Depuis quand le bot tourne",
      "`!ping` — Latence du bot",
      "`!rappel <minutes> <message>` — Programme un rappel",
    ],
  },
  blacklist: {
    label: "Blacklist",
    emoji: "🚫",
    commands: [
      "`=bl` — Affiche la blacklist du serveur",
      "`=bl <id> <raison>` — Blacklist et ban (raison obligatoire)",
      "`=unbl <id>` — Retire de la BL et unban",
      "`=blinfo <id>` — Qui / quand / pourquoi",
    ],
  },
  infos: {
    label: "Infos",
    emoji: "ℹ️",
    commands: [
      "`=ui [@user]` — Profil utilisateur",
      "`=avatar [@user]` — Affiche l'avatar",
      "`=banner [@user]` — Affiche la banner",
      "`=roleinfo @role` — Infos rôle",
      "`=channelinfo [#salon]` — Infos salon",
    ],
  },
  divers: {
    label: "Divers",
    emoji: "🎲",
    commands: [
      "`=snipe` — Derniers messages supprimés",
      "`=poll Question | Opt1 | Opt2 | ...` — Créer un sondage",
      "`=invite-info [lien]` — Infos invite",
    ],
  },
  stats: {
    label: "Stats",
    emoji: "📊",
    commands: [
      "`=stats [@user]` — Stats utilisateur",
      "`=top` — Top 10 messages",
      "`=top-vocal` — Top 10 temps vocal",
    ],
  },
};

function buildHelpEmbed(categoryKey) {
  const cat = HELP_CATEGORIES[categoryKey];
  return new EmbedBuilder()
    .setTitle(`${cat.emoji} ${cat.label}`)
    .setDescription(cat.commands.join("\n"))
    .setColor(0x2b2d31)
    .setFooter({ text: "Haven • Utilise le menu ci-dessous pour changer de catégorie" });
}

function buildHelpMenu(selected) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("help_menu")
    .setPlaceholder("Choisis une catégorie")
    .addOptions(
      Object.entries(HELP_CATEGORIES).map(([key, cat]) => ({
        label: cat.label,
        value: key,
        emoji: cat.emoji,
        default: key === selected,
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

// ==========================================
// DONNÉES POUR !8ball ET !blague
// ==========================================
const EIGHT_BALL_RESPONSES = [
  "Oui, sans aucun doute.",
  "C'est certain.",
  "Sans l'ombre d'un doute.",
  "Oui, définitivement.",
  "Tu peux compter dessus.",
  "Selon moi, oui.",
  "Les perspectives sont bonnes.",
  "Oui.",
  "Les signes indiquent que oui.",
  "Réponse floue, retente.",
  "Redemande plus tard.",
  "Mieux vaut ne pas te le dire maintenant.",
  "Impossible de prédire pour l'instant.",
  "Concentre-toi et redemande.",
  "N'y compte pas.",
  "Ma réponse est non.",
  "Mes sources disent non.",
  "Les perspectives ne sont pas si bonnes.",
  "Très douteux.",
];

const BLAGUES = [
  "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon ils tombent dans le bateau.",
  "C'est l'histoire d'un mec sur son lit de mort qui sent une odeur de tarte aux pommes... Ce sera sa dernière blague.",
  "Qu'est-ce qu'un crocodile qui surveille la Bourse ? Un cayman trader.",
  "Que dit un escargot quand il croise une limace ? Regarde le nudiste !",
  "Pourquoi les poissons détestent l'ordinateur ? Ils ont peur du net.",
  "Quel est le sport le plus silencieux ? Le hand-ball.",
  "Comment appelle-t-on un chat qui vient de manger un canard ? Un chat-canard.",
  "Qu'est-ce qui est jaune et qui attend ? Jonathan.",
  "Pourquoi le football c'est trop bien ? Parce qu'il y a du foot et du all.",
  "Deux poules discutent, l'une dit à l'autre : bientôt les vacances ! L'autre répond : Ah bon, cocotte ?",
];

const QUIZ_QUESTIONS = [
  { question: "Quelle est la capitale de la France ?", choices: ["Lyon", "Paris", "Marseille", "Toulouse"], correct: 1 },
  { question: "Combien de continents y a-t-il sur Terre ?", choices: ["5", "6", "7", "8"], correct: 2 },
  { question: "Quel est l'animal le plus rapide du monde ?", choices: ["Guépard", "Faucon pèlerin", "Lion", "Antilope"], correct: 1 },
  { question: "En quelle année a eu lieu la Révolution française ?", choices: ["1789", "1804", "1815", "1799"], correct: 0 },
  { question: "Quel est le plus grand océan du monde ?", choices: ["Atlantique", "Indien", "Arctique", "Pacifique"], correct: 3 },
  { question: "Combien de joueurs y a-t-il dans une équipe de foot sur le terrain ?", choices: ["9", "10", "11", "12"], correct: 2 },
  { question: "Quelle planète est surnommée la planète rouge ?", choices: ["Vénus", "Mars", "Jupiter", "Saturne"], correct: 1 },
];

// ==========================================
// UTILITAIRE : récupère une image via l'API purrbot.site
// ==========================================
async function fetchNekoImage(endpoint) {
  const response = await fetch(`https://purrbot.site/api/img/sfw/${endpoint}/gif`);

  if (!response.ok) {
    throw new Error(`Réponse API invalide : ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.message || "Erreur API inconnue");
  }

  return data.link;
}

// ==========================================
// PRET
// ==========================================
const { GifWriter } = require("omggif");
const Jimp = require("jimp");

const startTime = Date.now();

// Anti-spam : userId -> tableau de timestamps des derniers messages
const spamTracker = new Map();
const SPAM_MAX_MESSAGES = 5; // nombre de messages
const SPAM_TIME_WINDOW = 5000; // en 5 secondes
const SPAM_TIMEOUT_DURATION = 60000; // timeout de 60 secondes

// ==========================================
// SYSTÈME DE NIVEAUX / XP
// ==========================================
const LEVELS_FILE = "./levels.json";
let levelsData = {};

if (fs.existsSync(LEVELS_FILE)) {
  try {
    levelsData = JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
  } catch (err) {
    console.error("❌ Erreur lecture levels.json :", err);
    levelsData = {};
  }
}

function saveLevels() {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(levelsData, null, 2));
}

function xpForLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

const xpCooldown = new Map(); // userId -> timestamp du dernier gain d'XP
const XP_COOLDOWN_MS = 60000; // 1 message compté toutes les 60 secondes max

// ==========================================
// SYSTÈME DE MARIAGE
// ==========================================
const MARRIAGES_FILE = "./marriages.json";
let marriagesData = {}; // userId -> partnerId (miroir dans les deux sens)

if (fs.existsSync(MARRIAGES_FILE)) {
  try {
    marriagesData = JSON.parse(fs.readFileSync(MARRIAGES_FILE, "utf8"));
  } catch (err) {
    console.error("❌ Erreur lecture marriages.json :", err);
    marriagesData = {};
  }
}

function saveMarriages() {
  fs.writeFileSync(MARRIAGES_FILE, JSON.stringify(marriagesData, null, 2));
}

// ==========================================
// SYSTÈME DE SHIP SAUVEGARDÉ (couples mémorisés)
// ==========================================
const SHIPS_FILE = "./ships.json";
let shipsData = {}; // "id1_id2" (triés) -> pourcentage

if (fs.existsSync(SHIPS_FILE)) {
  try {
    shipsData = JSON.parse(fs.readFileSync(SHIPS_FILE, "utf8"));
  } catch (err) {
    console.error("❌ Erreur lecture ships.json :", err);
    shipsData = {};
  }
}

function saveShips() {
  fs.writeFileSync(SHIPS_FILE, JSON.stringify(shipsData, null, 2));
}

function shipKey(id1, id2) {
  return [id1, id2].sort().join("_");
}

// ==========================================
// SYSTÈME DE LAISSE (!dog-add / !dog-del / !dog-list)
// ==========================================
const LEASHES_FILE = "./leashes.json";
let leashesData = {}; // userId -> { by: modId, date: timestamp, originalNickname: "ancien_surnom" }

if (fs.existsSync(LEASHES_FILE)) {
  try {
    leashesData = JSON.parse(fs.readFileSync(LEASHES_FILE, "utf8"));
  } catch (err) {
    console.error("❌ Erreur lecture leashes.json :", err);
    leashesData = {};
  }
}

function saveLeashes() {
  fs.writeFileSync(LEASHES_FILE, JSON.stringify(leashesData, null, 2));
}

// ==========================================
// BADGES (paliers de niveau + badges spéciaux)
// ==========================================
const LEVEL_BADGES = [
  { level: 5, name: "Débutant", emoji: "🌱" },
  { level: 10, name: "Habitué", emoji: "⭐" },
  { level: 20, name: "Vétéran", emoji: "💎" },
  { level: 35, name: "Expert", emoji: "🔥" },
  { level: 50, name: "Légende", emoji: "👑" },
];

function getUserBadges(userId) {
  const badges = [];
  const data = levelsData[userId] || { level: 1 };

  for (const b of LEVEL_BADGES) {
    if (data.level >= b.level) badges.push(b);
  }

  if (marriagesData[userId]) {
    badges.push({ name: "Marié(e)", emoji: "💍" });
  }

  return badges;
}

// ==========================================
// DONNÉES POUR !compliment ET !insulte
// ==========================================
const COMPLIMENTS = [
  "a un sourire qui illumine la pièce ✨",
  "est quelqu'un sur qui on peut vraiment compter 🤝",
  "a un goût musical impeccable 🎵",
  "rend cette communauté meilleure rien qu'en étant là 💗",
  "a clairement le meilleur sens de l'humour du serveur 😄",
  "mérite tout le bien du monde aujourd'hui 🌸",
  "a une énergie hyper contagieuse ⚡",
  "est bien plus intelligent(e) qu'il/elle ne le pense 🧠",
  "illumine chaque conversation 🌟",
  "a un cœur en or 💛",
];

const INSULTES = [
  "a le sens de l'humour d'une chaussette mouillée 🧦",
  "tape moins vite qu'un escargot sur Internet Explorer 🐌",
  "a la répartie d'un panneau STOP 🛑",
  "confond encore sa gauche et sa droite 🤦",
  "a le charisme d'une notice IKEA 📄",
  "perd même contre un bot au 8ball 🎱",
  "a l'élégance d'un pingouin sur des rollers 🐧",
  "réfléchit à la vitesse d'un Internet en 56k 📞",
  "a un swag proche du néant absolu 😴",
  "ferait perdre une partie de morpion 🎮",
];

// ==========================================
// SYSTÈME D'AVERTISSEMENTS (/warn)
// ==========================================
const WARNINGS_FILE = "./warnings.json";
let warningsData = {}; // userId -> [{ reason, date, moderator }]

if (fs.existsSync(WARNINGS_FILE)) {
  try {
    warningsData = JSON.parse(fs.readFileSync(WARNINGS_FILE, "utf8"));
  } catch (err) {
    console.error("❌ Erreur lecture warnings.json :", err);
    warningsData = {};
  }
}

function saveWarnings() {
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warningsData, null, 2));
}

// ==========================================
// CONFESSIONS ANONYMES (!confession)
// ==========================================
const CONFESSIONS_CHANNEL_ID = "REMPLACE_PAR_ID_SALON_CONFESSIONS";
const CONFESSIONS_FILE = "./confessions.json";
let confessionsCount = 0;

if (fs.existsSync(CONFESSIONS_FILE)) {
  try {
    confessionsCount = JSON.parse(fs.readFileSync(CONFESSIONS_FILE, "utf8")).count || 0;
  } catch (err) {
    confessionsCount = 0;
  }
}

function saveConfessionsCount() {
  fs.writeFileSync(CONFESSIONS_FILE, JSON.stringify({ count: confessionsCount }, null, 2));
}

// ==========================================
// JEUX EN MÉMOIRE (!rps) — pas besoin de persister entre redémarrages
// ==========================================
const rpsGames = new Map(); // gameId -> { players: [id1, id2], choices: {} }

// ==========================================
// DONNÉES DES SALONS VOCAUX TEMPORAIRES
// ==========================================
const tempVoiceChannels = new Map(); // channelId -> { ownerId }
const voiceFollows = new Map(); // followerId -> targetId
const voiceHandcuffs = new Map(); // userId -> channelId
const voiceJoinRequests = new Map(); // requesterId_channelId -> true (anti-doublon)

function getOwnedVoiceChannel(member) {
  const channelId = member.voice.channelId;
  if (!channelId) return null;
  const entry = tempVoiceChannels.get(channelId);
  if (!entry || entry.ownerId !== member.id) return null;
  return member.voice.channel;
}

// ==========================================
// MORPION (!tictactoe / !ttt) — version simplifiée sans état côté bot.
// Le plateau (9 caractères, "_" = case vide) voyage directement dans le
// customId des boutons : ttt_<board>_<playerX>_<playerO>_<turn>_<cell>
// ==========================================
const TTT_WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkTttWinner(board) {
  for (const [a, b, c] of TTT_WIN_LINES) {
    if (board[a] !== "_" && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.includes("_") ? null : "draw";
}

function buildTttRows(board, playerX, playerO, turn, disabled = false) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const cell = board[i];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_${board}_${playerX}_${playerO}_${turn}_${i}`)
          .setLabel(cell === "_" ? "\u200b" : cell)
          .setStyle(cell === "X" ? ButtonStyle.Danger : cell === "O" ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(disabled || cell !== "_")
      );
    }
    rows.push(row);
  }
  return rows;
}

// ==========================================
// GÉNÉRATION DE LA CARTE DE PROFIL (!profile)
// ==========================================
async function buildProfileCard(user, levelData, badges, partnerUsername) {
  const width = 700;
  const height = 260;
  const bg = new Jimp(width, height, 0x2b2d31ff);

  // ----- Avatar circulaire avec anneau doré -----
  const avatarSize = 180;
  const avatarX = 40;
  const avatarY = 40;
  const radius = avatarSize / 2;

  const avatarUrl = user.displayAvatarURL({ size: 256, extension: "png" });
  const avatarRes = await fetch(avatarUrl);
  const avatarBuf = Buffer.from(await avatarRes.arrayBuffer());
  const avatar = await Jimp.read(avatarBuf);
  avatar.resize(avatarSize, avatarSize);

  // masque circulaire (alpha à 0 hors du cercle)
  for (let y = 0; y < avatarSize; y++) {
    for (let x = 0; x < avatarSize; x++) {
      const dx = x - radius;
      const dy = y - radius;
      if (dx * dx + dy * dy > radius * radius) {
        avatar.bitmap.data[(y * avatarSize + x) * 4 + 3] = 0;
      }
    }
  }

  // anneau doré autour de l'avatar
  const ringThickness = 5;
  for (let y = -ringThickness; y < avatarSize + ringThickness; y++) {
    for (let x = -ringThickness; x < avatarSize + ringThickness; x++) {
      const px = avatarX + x;
      const py = avatarY + y;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const dx = x - radius;
      const dy = y - radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius && dist <= radius + ringThickness) {
        const idx = (py * width + px) * 4;
        bg.bitmap.data[idx] = 0xff;
        bg.bitmap.data[idx + 1] = 0xd7;
        bg.bitmap.data[idx + 2] = 0x00;
        bg.bitmap.data[idx + 3] = 0xff;
      }
    }
  }

  bg.composite(avatar, avatarX, avatarY);

  // ----- Textes -----
  const fontBig = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fontMed = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const fontSmall = fontMed;

  const textX = 250;
  bg.print(fontBig, textX, 32, user.username);
  bg.print(fontMed, textX, 78, `Niveau ${levelData.level}`);

  // ----- Barre d'XP -----
  const needed = xpForLevel(levelData.level);
  const barX = textX;
  const barY = 112;
  const barW = 400;
  const barH = 22;
  const filledW = Math.max(0, Math.min(barW, Math.floor((barW * levelData.xp) / needed)));

  for (let y = 0; y < barH; y++) {
    for (let x = 0; x < barW; x++) {
      const idx = ((barY + y) * width + (barX + x)) * 4;
      const isFilled = x < filledW;
      if (isFilled) {
        bg.bitmap.data[idx] = 0xff;
        bg.bitmap.data[idx + 1] = 0xd7;
        bg.bitmap.data[idx + 2] = 0x00;
      } else {
        bg.bitmap.data[idx] = 0x40;
        bg.bitmap.data[idx + 1] = 0x42;
        bg.bitmap.data[idx + 2] = 0x48;
      }
      bg.bitmap.data[idx + 3] = 0xff;
    }
  }

  bg.print(fontSmall, textX, barY + barH + 8, `${levelData.xp} / ${needed} XP`);

  // ----- Badges -----
  const badgesText = badges.length > 0 ? badges.map((b) => b.emoji).join("  ") : "Aucun badge pour l'instant";
  bg.print(fontMed, textX, 190, badgesText);

  // ----- Statut marital -----
  if (partnerUsername) {
    bg.print(fontSmall, textX, 224, `💍 Marié(e) à ${partnerUsername}`);
  }

  return bg.getBufferAsync(Jimp.MIME_PNG);
}

// ==========================================
// GESTION DES SALONS VOCAUX TEMPORAIRES
// ==========================================
client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    const guild = newState.guild || oldState.guild;

    // ----- Création d'un salon temporaire en rejoignant le hub -----
    if (newState.channelId === VOICE_HUB_CHANNEL_ID && newState.channelId !== oldState.channelId) {
      const parent = VOICE_TEMP_CATEGORY_ID !== "REMPLACE_PAR_ID_CATEGORIE_VOCAUX_TEMP" ? VOICE_TEMP_CATEGORY_ID : newState.channel.parentId;

      const newChannel = await guild.channels.create({
        name: `🔊 Salon de ${newState.member.displayName}`,
        type: ChannelType.GuildVoice,
        parent,
        permissionOverwrites: [
          {
            id: newState.id,
            allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers],
          },
        ],
      });

      tempVoiceChannels.set(newChannel.id, { ownerId: newState.id });
      await newState.member.voice.setChannel(newChannel).catch(() => {});
    }

    // ----- Suppression d'un salon temporaire vide -----
    if (oldState.channelId && tempVoiceChannels.has(oldState.channelId)) {
      const channel = oldState.channel;
      if (channel && channel.members.size === 0) {
        tempVoiceChannels.delete(oldState.channelId);
        await channel.delete().catch(() => {});
      }
    }

    // ----- Système de follow (!follow) -----
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      for (const [followerId, targetId] of voiceFollows.entries()) {
        if (targetId === newState.id) {
          const followerMember = await guild.members.fetch(followerId).catch(() => null);
          if (followerMember && followerMember.voice.channelId) {
            await followerMember.voice.setChannel(newState.channelId).catch(() => {});
          }
        }
      }
    }

    // ----- Système de laisse (!dog-add) : les membres en laisse suivent leur maître en vocal -----
    if (newState.channelId !== oldState.channelId) {
      for (const [dogId, info] of Object.entries(leashesData)) {
        if (info.by === newState.id) {
          const dogMember = await guild.members.fetch(dogId).catch(() => null);
          if (dogMember && dogMember.voice.channelId) {
            await dogMember.voice.setChannel(newState.channelId).catch(() => {});
          }
        }
      }
    }

    // ----- Système de menottes (=menotte) -----
    if (voiceHandcuffs.has(newState.id)) {
      const forcedChannelId = voiceHandcuffs.get(newState.id);
      if (newState.channelId && newState.channelId !== forcedChannelId) {
        await newState.member.voice.setChannel(forcedChannelId).catch(() => {});
      }
    }
  } catch (err) {
    console.error("❌ Erreur dans voiceStateUpdate :", err);
  }
});

client.once("ready", () => {
  logger.info("BOT", `${client.user.tag} est connecté et prêt !`, { 
    guilds: client.guilds.cache.size, 
    users: client.users.cache.size 
  });
  client.user.setStatus('online');
  client.user.setActivity('!aide pour les commandes', { type: 'WATCHING' });
});

// ==========================================
// MESSAGE DE BIENVENUE
// ==========================================
client.on("guildMemberAdd", async (member) => {
  try {
    const accountAge = Date.now() - member.user.createdTimestamp;
    const accountAgeInDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    logger.info("MEMBER_JOIN", `${member.user.tag} a rejoint le serveur`, { 
      userId: member.id, 
      serverName: member.guild.name,
      accountAgeDays: accountAgeInDays 
    });

    // ----- Détection anti-raid -----
    const now = Date.now();
    joinTracker.push(now);
    while (joinTracker.length && now - joinTracker[0] > RAID_TIME_WINDOW) {
      joinTracker.shift();
    }

    if (!raidModeActive && joinTracker.length >= RAID_JOIN_THRESHOLD) {
      raidModeActive = true;
      raidModeAuto = true;
      logger.warn("RAID", `Raid détecté ! ${joinTracker.length} arrivées en ${RAID_TIME_WINDOW / 1000}s`);

      const alertChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (alertChannel) {
        alertChannel.send(
          `🚨 **RAID DÉTECTÉ** : ${joinTracker.length} arrivées en moins de ${RAID_TIME_WINDOW / 1000} secondes !\n` +
            `🔒 Mode anti-raid activé automatiquement pendant ${RAID_AUTO_DURATION / 60000} minutes. Les comptes de moins de 7 jours seront expulsés à l'arrivée.`
        );
      }

      if (raidModeTimeout) clearTimeout(raidModeTimeout);
      raidModeTimeout = setTimeout(() => {
        raidModeActive = false;
        raidModeAuto = false;
        raidModeTimeout = null;
        logger.info("RAID", "Mode anti-raid désactivé automatiquement");
        const lc = member.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (lc) lc.send("✅ Mode anti-raid désactivé automatiquement.");
      }, RAID_AUTO_DURATION);
    }

    if (raidModeActive) {
      const accountAge = now - member.user.createdTimestamp;
      if (accountAge < RAID_MIN_ACCOUNT_AGE_MS) {
        await member
          .send(
            "🚨 Le serveur **Haven** est actuellement en mode anti-raid suite à une vague d'arrivées suspectes.\n" +
              "Ton compte étant très récent, tu as été expulsé automatiquement par précaution. Tu peux réessayer de rejoindre plus tard."
          )
          .catch(() => {});
        await member.kick("Anti-raid : compte trop récent pendant une alerte raid").catch(() => {});

        const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          logChannel.send(
            `🚨 **Anti-raid** : ${member.user.tag} expulsé automatiquement (compte créé <t:${Math.floor(
              member.user.createdTimestamp / 1000
            )}:R>).`
          );
        }
        return;
      }
    }

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (channel) {
      try {
        const attachment = new AttachmentBuilder("./welcome.gif");

        const embed = new EmbedBuilder()
          .setImage("attachment://welcome.gif")
          .setColor(0xffd700);

        await channel.send({
          content:
            `🌟 Bienvenue à toi ${member} sur **Haven** !\n\n` +
            `J'espère que tu passeras de bons moments ici ! 💗\n` +
            `Nous sommes maintenant **${member.guild.memberCount} membres** sur le serveur ✨`,
          embeds: [embed],
          files: [attachment],
        });
      } catch (err) {
        console.error("❌ Erreur envoi message de bienvenue :", err);
      }
    }

    const logsChannel = member.guild.channels.cache.get(MESSAGE_LOGS_CHANNEL_ID);
    if (logsChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("📥 Arrivée d'un membre")
        .setColor(0x57f287)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "Utilisateur", value: `${member.user.tag}`, inline: true },
          { name: "ID", value: member.id, inline: true },
          { name: "Compte créé le", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`, inline: false },
          { name: "Nombre de membres", value: `${member.guild.memberCount}`, inline: true }
        )
        .setTimestamp();
      await logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }
  } catch (err) {
    logger.error("MEMBER_JOIN", "Erreur lors de l'arrivée d'un membre", err);
  }
});

// ==========================================
// LOG DE DÉPART D'UN MEMBRE
// ==========================================
client.on("guildMemberRemove", async (member) => {
  try {
    logger.info("MEMBER_LEAVE", `${member.user.tag} a quitté le serveur`, { 
      userId: member.id, 
      serverName: member.guild.name,
      remainingMembers: member.guild.memberCount
    });

    const logsChannel = member.guild.channels.cache.get(MESSAGE_LOGS_CHANNEL_ID);
    if (!logsChannel) return;

    const embed = new EmbedBuilder()
      .setTitle("📤 Départ d'un membre")
      .setColor(0x99aab5)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Utilisateur", value: `${member.user.tag}`, inline: true },
        { name: "ID", value: member.id, inline: true },
        { name: "Membres restants", value: `${member.guild.memberCount}`, inline: true }
      )
      .setTimestamp();

    await logsChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("MEMBER_LEAVE", "Erreur lors du traitement du départ d'un membre", err);
  }
});

// ==========================================
// LOGS DE MESSAGES SUPPRIMÉS / MODIFIÉS
// ==========================================
client.on("messageDelete", async (message) => {
  try {
    if (message.partial) return; // contenu non disponible (message non mis en cache)
    if (!message.guild || message.author?.bot) return;

    const logsChannel = message.guild.channels.cache.get(MESSAGE_LOGS_CHANNEL_ID);
    if (!logsChannel) return;

    const embed = new EmbedBuilder()
      .setTitle("🗑️ Message supprimé")
      .setColor(0xff4500)
      .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "Auteur", value: `${message.author} (${message.author.tag})`, inline: true },
        { name: "Salon", value: `${message.channel}`, inline: true },
        {
          name: "Contenu",
          value: message.content ? message.content.slice(0, 1000) : "*(aucun texte — probablement une image/fichier)*",
        }
      )
      .setFooter({ text: `ID : ${message.author.id}` })
      .setTimestamp();

    await logsChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("MESSAGE_DELETE", "Erreur lors du traitement de la suppression de message", err);
  }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  try {
    if (oldMessage.partial || newMessage.partial) return;
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // pas un vrai changement de texte

    const logsChannel = newMessage.guild.channels.cache.get(MESSAGE_LOGS_CHANNEL_ID);
    if (!logsChannel) return;

    const embed = new EmbedBuilder()
      .setTitle("✏️ Message modifié")
      .setColor(0xffa500)
      .setThumbnail(newMessage.author.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "Auteur", value: `${newMessage.author} (${newMessage.author.tag})`, inline: true },
        { name: "Salon", value: `${newMessage.channel}`, inline: true },
        { name: "Avant", value: oldMessage.content ? oldMessage.content.slice(0, 500) : "*(vide)*" },
        { name: "Après", value: newMessage.content ? newMessage.content.slice(0, 500) : "*(vide)*" },
        { name: "Lien", value: `[Aller au message](${newMessage.url})` }
      )
      .setFooter({ text: `ID : ${newMessage.author.id}` })
      .setTimestamp();

    await logsChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("MESSAGE_UPDATE", "Erreur lors du traitement de la modification de message", err);
  }
});

// ==========================================
// COMMANDES !support, !ticketpanel, !rolesmenu, !doro
// ==========================================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    logger.debug("MESSAGE", `Message reçu de ${message.author.tag}`, { 
      content: message.content.substring(0, 50),
      channel: message.channel.name || "DM"
    });

    // ========== STATS TRACKING ==========
    const guildStats = getGuildStats(message.guildId);
    if (!guildStats.members[message.author.id]) {
      guildStats.members[message.author.id] = { messages: 0, voiceTime: 0 };
    }
    guildStats.members[message.author.id].messages += 1;
    saveStats(statsData);

    // ----- ANTI-SPAM -----
    // Le staff (Gérer les messages) n'est pas concerné
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const now = Date.now();
      const timestamps = spamTracker.get(message.author.id) || [];
      const recent = timestamps.filter((t) => now - t < SPAM_TIME_WINDOW);
      recent.push(now);
      spamTracker.set(message.author.id, recent);

      if (recent.length > SPAM_MAX_MESSAGES) {
        spamTracker.delete(message.author.id);

        await message.delete().catch(() => {});
        await message.member.timeout(SPAM_TIMEOUT_DURATION, "Spam détecté").catch(() => {});

        const warnMsg = await message.channel.send(
          `🚫 ${message.author} a été mute 1 minute pour spam.`
        );
        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);

        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          logChannel.send(`🚫 **Anti-spam** : ${message.author.tag} a été mute automatiquement pour spam dans ${message.channel}.`);
        }
        return;
      }
    }

    // ----- SYSTÈME XP -----
    const userId = message.author.id;
    const lastXpGain = xpCooldown.get(userId) || 0;

    if (Date.now() - lastXpGain > XP_COOLDOWN_MS) {
      xpCooldown.set(userId, Date.now());

      if (!levelsData[userId]) {
        levelsData[userId] = { xp: 0, level: 1 };
      }

      const gained = Math.floor(Math.random() * 11) + 5; // entre 5 et 15 XP
      levelsData[userId].xp += gained;

      const needed = xpForLevel(levelsData[userId].level);
      if (levelsData[userId].xp >= needed) {
        levelsData[userId].xp -= needed;
        levelsData[userId].level += 1;

        const levelsChannel = message.guild.channels.cache.get(LEVELS_CHANNEL_ID);
        if (levelsChannel) {
          const levelUpAttachment = new AttachmentBuilder("./levelup.gif");

          const levelUpEmbed = new EmbedBuilder()
            .setTitle("🎉 Level Up !")
            .setDescription(
              `${message.author} vient d'atteindre le **niveau ${levelsData[userId].level}** !\n\nContinue comme ça ✨`
            )
            .setImage("attachment://levelup.gif")
            .setColor(0xffd700)
            .setFooter({ text: "Haven • Système de niveaux" });

          levelsChannel
            .send({ embeds: [levelUpEmbed], files: [levelUpAttachment] })
            .catch(() => {});
        }
      }

      saveLevels();
    }

    // ==========================================
    // COMMANDES SALONS VOCAUX TEMPORAIRES (préfixe =)
    // ==========================================
    if (message.content.startsWith("=")) {
      const args = message.content.slice(1).trim().split(/\s+/);
      const sub = args[0]?.toLowerCase();

      // =pv -> privatise / déprivatise le salon
      if (sub === "pv") {
        const channel = getOwnedVoiceChannel(message.member);
        if (!channel) return message.reply("Tu dois être dans **ton** salon vocal pour faire ça !");

        const everyoneOverwrite = channel.permissionOverwrites.cache.get(message.guild.id);
        const isPrivate = everyoneOverwrite && everyoneOverwrite.deny.has(PermissionFlagsBits.Connect);

        await channel.permissionOverwrites.edit(message.guild.id, { Connect: isPrivate ? null : false });

        await message.channel.send(
          isPrivate ? "🔓 Ton salon est maintenant **public**." : "🔒 Ton salon est maintenant **privé**."
        );
        return;
      }

      // =all -> donne l'accès à tous les membres présents
      if (sub === "all") {
        const channel = getOwnedVoiceChannel(message.member);
        if (!channel) return message.reply("Tu dois être dans **ton** salon vocal pour faire ça !");

        for (const [, member] of channel.members) {
          await channel.permissionOverwrites.edit(member.id, { Connect: true }).catch(() => {});
        }

        await message.channel.send("✅ Tous les membres présents ont maintenant accès au salon.");
        return;
      }

      // =acces @membre -> donne/retire l'accès à un membre
      if (sub === "acces") {
        const channel = getOwnedVoiceChannel(message.member);
        if (!channel) return message.reply("Tu dois être dans **ton** salon vocal pour faire ça !");

        const target = message.mentions.members.first();
        if (!target) return message.reply("Mentionne un membre ! Exemple : `=acces @pseudo`");

        const overwrite = channel.permissionOverwrites.cache.get(target.id);
        const hasAccess = overwrite && overwrite.allow.has(PermissionFlagsBits.Connect);

        await channel.permissionOverwrites.edit(target.id, { Connect: hasAccess ? null : true });

        await message.channel.send(
          hasAccess ? `❌ Accès retiré à ${target}.` : `✅ Accès donné à ${target}.`
        );
        return;
      }

      // =mv @membre -> déplace un membre dans ton salon
      if (sub === "mv") {
        const channel = getOwnedVoiceChannel(message.member);
        if (!channel) return message.reply("Tu dois être dans **ton** salon vocal pour faire ça !");

        const target = message.mentions.members.first();
        if (!target) return message.reply("Mentionne un membre ! Exemple : `=mv @pseudo`");
        if (!target.voice.channelId) return message.reply("Ce membre n'est dans aucun salon vocal.");

        await target.voice.setChannel(channel).catch(() => {});
        await message.channel.send(`✅ ${target} a été déplacé dans ton salon.`);
        return;
      }

      // =limit X -> définit une limite de membres
      if (sub === "limit") {
        const channel = getOwnedVoiceChannel(message.member);
        if (!channel) return message.reply("Tu dois être dans **ton** salon vocal pour faire ça !");

        const limit = parseInt(args[1]);
        if (isNaN(limit) || limit < 0 || limit > 99) {
          return message.reply("Indique un nombre entre 0 (illimité) et 99 ! Exemple : `=limit 5`");
        }

        await channel.setUserLimit(limit);
        await message.channel.send(limit === 0 ? "✅ Limite retirée (illimité)." : `✅ Limite fixée à **${limit}** membres.`);
        return;
      }

      // =transfer @membre -> transfère la propriété du salon
      if (sub === "transfer") {
        const channel = getOwnedVoiceChannel(message.member);
        if (!channel) return message.reply("Tu dois être dans **ton** salon vocal pour faire ça !");

        const target = message.mentions.members.first();
        if (!target) return message.reply("Mentionne un membre ! Exemple : `=transfer @pseudo`");
        if (target.voice.channelId !== channel.id) {
          return message.reply("Ce membre doit être présent dans le salon pour en devenir propriétaire.");
        }

        tempVoiceChannels.set(channel.id, { ownerId: target.id });
        await channel.permissionOverwrites.edit(target.id, {
          ManageChannels: true,
          MoveMembers: true,
        });

        await message.channel.send(`👑 ${target} est maintenant propriétaire du salon.`);
        return;
      }

      // =find @membre -> trouve un membre dans les vocaux
      if (sub === "find") {
        const target = message.mentions.members.first();
        if (!target) return message.reply("Mentionne un membre ! Exemple : `=find @pseudo`");

        if (!target.voice.channelId) {
          return message.channel.send(`${target.user.username} n'est dans aucun salon vocal.`);
        }

        await message.channel.send(`🔍 ${target.user.username} est dans **${target.voice.channel.name}**.`);
        return;
      }

      // =join @membre -> demande à rejoindre le salon privé de quelqu'un
      if (sub === "join") {
        const target = message.mentions.members.first();
        if (!target) return message.reply("Mentionne un membre ! Exemple : `=join @pseudo`");
        if (!target.voice.channelId) return message.reply("Ce membre n'est dans aucun salon vocal.");

        const channel = target.voice.channel;
        const entry = tempVoiceChannels.get(channel.id);

        if (!entry) {
          if (!message.member.voice.channelId) return message.reply("Tu dois être en vocal pour rejoindre quelqu'un.");
          await message.member.voice.setChannel(channel).catch(() => {});
          return message.channel.send(`✅ Tu as rejoint le salon de ${target.user.username}.`);
        }

        const owner = await message.guild.members.fetch(entry.ownerId).catch(() => null);
        if (!owner) return message.reply("Impossible de trouver le propriétaire de ce salon.");

        const yesButton = new ButtonBuilder()
          .setCustomId(`vcjoin_yes_${message.author.id}_${channel.id}`)
          .setLabel("Accepter")
          .setStyle(ButtonStyle.Success);
        const noButton = new ButtonBuilder()
          .setCustomId(`vcjoin_no_${message.author.id}_${channel.id}`)
          .setLabel("Refuser")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(yesButton, noButton);

        await message.channel.send({
          content: `🔔 ${owner} , ${message.author} demande à rejoindre ton salon vocal.`,
          components: [row],
        });
        return;
      }

      // =follow @membre -> suit quelqu'un dans les vocaux
      if (sub === "follow") {
        const target = message.mentions.members.first();
        if (!target) return message.reply("Mentionne un membre ! Exemple : `=follow @pseudo`");
        if (target.id === message.author.id) return message.reply("Tu ne peux pas te suivre toi-même 😅");

        voiceFollows.set(message.author.id, target.id);
        await message.channel.send(`👣 Tu suis maintenant ${target.user.username} dans les vocaux. (\`=unfollow\` pour arrêter)`);
        return;
      }

      // =unfollow -> arrête de suivre
      if (sub === "unfollow") {
        voiceFollows.delete(message.author.id);
        await message.channel.send("✅ Tu ne suis plus personne.");
        return;
      }

      // =ghost @membre -> bloque l'accès d'un membre (staff)
      if (sub === "ghost") {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("Réservé au staff (permission Gérer les salons).");
        }

        const channel = getOwnedVoiceChannel(message.member) || message.member.voice.channel;
        if (!channel) return message.reply("Tu dois être en vocal pour faire ça !");

        const target = message.mentions.members.first();
        if (!target) return message.reply("Mentionne un membre ! Exemple : `=ghost @pseudo`");

        await channel.permissionOverwrites.edit(target.id, { Connect: false });
        if (target.voice.channelId === channel.id) {
          await target.voice.disconnect().catch(() => {});
        }

        await message.channel.send(`👻 ${target} a été bloqué du salon.`);
        return;
      }

      // =menotte @membre id_salon -> force un membre dans un salon (staff)
      if (sub === "menotte") {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("Réservé au staff (permission Gérer les salons).");
        }

        const target = message.mentions.members.first();
        const voiceChannelId = args[2];
        if (!target || !voiceChannelId) {
          return message.reply("Utilise le format : `=menotte @membre id_salon`");
        }

        const targetChannel = message.guild.channels.cache.get(voiceChannelId);
        if (!targetChannel || targetChannel.type !== ChannelType.GuildVoice) {
          return message.reply("ID de salon vocal invalide.");
        }

        voiceHandcuffs.set(target.id, voiceChannelId);
        if (target.voice.channelId) {
          await target.voice.setChannel(voiceChannelId).catch(() => {});
        }

        await message.channel.send(`⛓️ ${target} est maintenant menotté à **${targetChannel.name}**. (\`=demenotte @membre\` pour libérer)`);
        return;
      }

      // =demenotte @membre -> retire les menottes (staff)
      if (sub === "demenotte") {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("Réservé au staff (permission Gérer les salons).");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply("Mentionne un membre ! Exemple : `=demenotte @pseudo`");

        voiceHandcuffs.delete(target.id);
        await message.channel.send(`✅ ${target} n'est plus menotté.`);
        return;
      }

      // =vmall #salon1 #salon2 -> déplace tout le monde d'un salon à un autre (staff)
      if (sub === "vmall") {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("Réservé au staff (permission Gérer les salons).");
        }

        const channels = message.mentions.channels;
        if (channels.size < 2) {
          return message.reply("Utilise le format : `=vmall #salon1 #salon2`");
        }

        const [from, to] = [...channels.values()];
        if (from.type !== ChannelType.GuildVoice || to.type !== ChannelType.GuildVoice) {
          return message.reply("Les deux salons doivent être des salons vocaux.");
        }

        let moved = 0;
        for (const [, member] of from.members) {
          await member.voice.setChannel(to).catch(() => {});
          moved += 1;
        }

        await message.channel.send(`✅ ${moved} membre(s) déplacé(s) de **${from.name}** vers **${to.name}**.`);
        return;
      }

      // Aucune sous-commande reconnue -> on laisse passer (peut être un simple "=" dans une phrase)
    }

    // !aide / !commands / !help -> menu de commandes par catégorie
    if (message.content === "!aide" || message.content === "!commands" || message.content === "!help") {
      const defaultCategory = "moderation";
      const embed = buildHelpEmbed(defaultCategory);
      const row = buildHelpMenu(defaultCategory);

      await message.channel.send({ embeds: [embed], components: [row] });
      return;
    }

    // !support -> envoie l'embed dans le salon info-support
    if (message.content === "!support") {
      const supportChannel = message.guild.channels.cache.get(SUPPORT_CHANNEL_ID);
      if (supportChannel) {
        sendSupportEmbed(supportChannel);
      } else {
        message.reply("Salon info-support introuvable !");
      }
      return;
    }

    // !ticketpanel -> poste le menu de tickets (admin uniquement)
    if (message.content === "!ticketpanel") {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("Tu dois être administrateur pour faire ça.");
      }

      const embed = new EmbedBuilder()
        .setTitle("🎓 Ouvrez un ticket !")
        .setDescription(
          "> L'assistance est disponible 24h/24 et 7j/7. Une réponse instantanée vous sera donnée.\n\n" +
            "**Veuillez utiliser le menu déroulant ci-dessous.**\n\n" +
            "Sélectionnez la catégorie qui correspond à votre demande."
        )
        .setColor(0x2b2d31)
        .setFooter({ text: "Haven Support" });

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_menu")
        .setPlaceholder("Fais un choix")
        .addOptions([
          {
            label: "Gestion Staff",
            description: "Devenir staff, réclamer un rankup ou récupérer des rôles.",
            value: "staff",
            emoji: "🎓",
          },
          {
            label: "Gestion Abus",
            description: "En cas de conflit ou de problème avec un staff/membre.",
            value: "abus",
            emoji: "🛡️",
          },
          {
            label: "Animation",
            description: "Proposer des idées d'animations ou postuler pour rejoindre l'équipe.",
            value: "animation",
            emoji: "🎪",
          },
          {
            label: "Community Manager",
            description: "Faire une demande de partenariat avec Haven",
            value: "partenariat",
            emoji: "🤝",
          },
        ]);

      const row = new ActionRowBuilder().addComponents(menu);
      await message.channel.send({ embeds: [embed], components: [row] });
      await message.delete().catch(() => {});
      return;
    }

    // !rolesmenu -> poste les menus de rôles auto (admin uniquement)
    if (message.content === "!rolesmenu") {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("Tu dois être administrateur pour faire ça.");
      }

      const genreMenu = new StringSelectMenuBuilder()
        .setCustomId("role_genre")
        .setPlaceholder("Fais un choix")
        .addOptions([
          { label: "Homme", value: "homme", emoji: "👔" },
          { label: "Femme", value: "femme", emoji: "👗" },
        ]);

      const ageMenu = new StringSelectMenuBuilder()
        .setCustomId("role_age")
        .setPlaceholder("Fais un choix")
        .addOptions([
          { label: "Mineur", value: "mineur", emoji: "🍭" },
          { label: "Majeur", value: "majeur", emoji: "🚬" },
        ]);

      const situationMenu = new StringSelectMenuBuilder()
        .setCustomId("role_situation")
        .setPlaceholder("Fais un choix")
        .addOptions([
          { label: "Célibataire", value: "celibataire", emoji: "💔" },
          { label: "Couple", value: "couple", emoji: "💗" },
          { label: "Compliqué", value: "complique", emoji: "💨" },
        ]);

      await message.channel.send({
        content: "♂️ ➜ **Sélectionnez votre genre**",
        components: [new ActionRowBuilder().addComponents(genreMenu)],
      });
      await message.channel.send({
        content: "🍭 ➜ **Sélectionnez votre âge**",
        components: [new ActionRowBuilder().addComponents(ageMenu)],
      });
      await message.channel.send({
        content: "💗 ➜ **Sélectionnez votre situation amoureuse**",
        components: [new ActionRowBuilder().addComponents(situationMenu)],
      });

      await message.delete().catch(() => {});
      return;
    }

    // !soutiens -> poste l'embed de soutien au serveur (admin uniquement)
    if (message.content === "!soutiens") {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("Tu dois être administrateur pour faire ça.");
      }

      const soutiensEmbed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("SOUTIENS __HAVEN__")
        .setDescription(
          "tu aimes le serveur et tu souhaites nous aider à le faire avancer ? n'hésite pas à faire ce qu'il a dans cette liste pour nous aider !\n\n" +
          "▹  « /haven » ou « gg./haven » en statut pour avoir le role <@&1530187200027693217> & la perm image, et être haut dans l'affichage des membres\n\n" +
          "▹  deviens l'un des nôtres en faisant la propagande avec notre tag sur tout les serveurs !\n\n" +
          "▹  si tu boostes le serveur, tu peux obtenir <@&1529779987605880833> & tu peux obtenir un rôle perso en faisant un ticket ! ( ça vaut le coup nan ? )\n\n" +
          "•  et merci à tout ceux qui le feront ça compte beaucoup pour nous et nous vous en sommes très reconnaissants ☀️"
        );

      await message.channel.send({ embeds: [soutiensEmbed] });
      await message.delete().catch(() => {});
      return;
    }

    // !reglement -> poste le règlement du serveur (admin uniquement)
    if (message.content === "!reglement") {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("Tu dois être administrateur pour faire ça.");
      }

      const reglementEmbed = new EmbedBuilder()
        .setColor(0xfff2b2)
        .setTitle("RÈGLEMENT — HAVEN 🌙")
        .setDescription(
          "*En rejoignant le serveur, tu acceptes les règles suivantes* <a:may_yellowsparkles:1530254692007805118>\n\n" +
          "──────────────\n\n" +
          "**Chat** <a:00_bear_cheerlead_dance:1530251291878494310>\n\n" +
          "• Respect des autres\n" +
          "> Seront punis les insultes, discrimination, harcèlement ou comportement toxique sur le serveur et en dehors.\n\n" +
          "• Pas de spam\n" +
          "> Évite le flood, les messages répétitifs et les mentions abusives.\n\n" +
          "• Contenu interdit\n" +
          "> Le contenu NSFW, choquant ou inapproprié est interdit.\n\n" +
          "• Publicité\n" +
          `> Pas de pub en dehors des partenariats. (fais un ticket dans <#${TICKET_MENTION_ID}> pour demander un partenariat)\n\n` +
          "• Bonne ambiance\n" +
          "> Le ragebait si la personne s'en plaint peut être sanctionné, les provocations et conflits inutiles peuvent tout aussi l'être. (on reste gentil entre vous)\n\n" +
          "──────────────\n\n" +
          "**Salons Vocaux** <a:alienwhite:1530251179362095177>\n\n" +
          "• Salons Vocaux\n" +
          "> Respecte les autres : pas de cris, sons dérangeants ou troll (ils seront sanctionnés).\n\n" +
          "• Salons Privées\n" +
          "> Merci de ne pas rejoindre (à l'aide de perms) les privates complètes, ce comportement pourra être sanctionné.\n\n" +
          "──────────────\n\n" +
          "**Staff/Modération** <a:23584watchingmovie:1530251879135842344>\n\n" +
          "• Gestion\n" +
          "> Les sanctions du staff sont à respecter. (merci de pas insulter, agresser, harceler les gestions ou staff qui sanctionnent pour des comportements abusifs)\n\n" +
          "• Staff\n" +
          `> Les sanctions sans raisons seront évidemment sanctionnées, merci de faire un ticket dans <#${TICKET_MENTION_ID}> si c'est le cas.\n\n` +
          "──────────────\n\n" +
          "L'humour & le fun sont évidemment les bienvenus tant que personne n'est mis mal à l'aise."
        )
        .setImage("attachment://reglement.gif");

      const attachment = new AttachmentBuilder("./reglement.gif");

      await message.channel.send({ embeds: [reglementEmbed], files: [attachment] });
      await message.delete().catch(() => {});
      return;
    }

    // !dog-add @membre -> met un membre en laisse (version debug)
    if (message.content.startsWith("!dog-add")) {
      console.log("🐕 dog-add déclenché par", message.author.tag);

      if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply("Tu dois avoir la permission de gérer les rôles pour faire ça.");
      }

      let target = message.mentions.members.first();
      if (!target) {
        return message.reply("Tu dois mentionner quelqu'un ! Exemple : `!dog-add @pseudo`");
      }

      target = await message.guild.members.fetch({ user: target.id, force: true });

      console.log(
        "🐕 DEBUG nickname:", target.nickname,
        "| globalName:", target.user.globalName,
        "| username:", target.user.username
      );

      if (LEASH_ROLE_ID === "REMPLACE_PAR_ID_ROLE_LAISSE") {
        return message.reply("⚠️ Le rôle de laisse n'est pas configuré (LEASH_ROLE_ID).");
      }

      const leashRole = message.guild.roles.cache.get(LEASH_ROLE_ID);
      if (!leashRole) {
        return message.reply("❌ Le rôle de laisse configuré n'existe pas ou plus sur ce serveur.");
      }

      const botMember = message.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply("❌ Je n'ai pas la permission **Gérer les rôles** sur ce serveur.");
      }

      if (botMember.roles.highest.position <= leashRole.position) {
        return message.reply(
          `❌ Mon rôle le plus haut (**${botMember.roles.highest.name}**) est trop bas dans la hiérarchie ` +
            `pour attribuer **${leashRole.name}**.`
        );
      }

      try {
        await target.roles.add(LEASH_ROLE_ID);
      } catch (err) {
        return message.reply(`❌ Impossible d'ajouter le rôle : ${err.message}`);
      }

      const originalNickname = target.nickname || target.user.globalName || target.user.username;

      const modMember = await message.guild.members.fetch({ user: message.author.id, force: true });
      const modNickname = modMember.nickname || modMember.user.globalName || modMember.user.username;

      const newNickname = `${originalNickname} (🐕 de ${modNickname})`;

      try {
        await target.setNickname(newNickname);
      } catch (err) {
        console.error("❌ Erreur changement surnom:", err);
      }

      leashesData[target.id] = {
        by: message.author.id,
        date: Date.now(),
        originalNickname: originalNickname,
      };
      saveLeashes();

      const embed = new EmbedBuilder()
        .setDescription(`🐕 **${originalNickname}** a été mis en laisse par **${modNickname}** !`)
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !dog-del @membre -> retire la laisse d'un membre
    if (message.content.startsWith("!dog-del")) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply("Tu dois avoir la permission de gérer les rôles pour faire ça.");
      }

      const target = message.mentions.members.first();
      if (!target) {
        return message.reply("Tu dois mentionner quelqu'un ! Exemple : `!dog-del @pseudo`");
      }

      try {
        await target.roles.remove(LEASH_ROLE_ID);
      } catch (err) {
        console.error("❌ Erreur !dog-del :", err);
        return message.reply(`❌ Impossible de retirer le rôle : ${err.message}`);
      }

      // Récupère le surnom original sauvegardé
      const originalNickname = leashesData[target.id]?.originalNickname || target.displayName;

      // Restaure le surnom original
      try {
        await target.setNickname(originalNickname);
        console.log("🐕 surnom restauré à", originalNickname);
      } catch (err) {
        console.error("❌ Erreur restauration surnom:", err);
      }

      delete leashesData[target.id];
      saveLeashes();

      const embed = new EmbedBuilder()
        .setDescription(`✅ **${message.author.username}** a retiré la laisse de **${originalNickname}** !`)
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !dog-list -> affiche la liste des membres en laisse
    if (message.content === "!dog-list") {
      const entries = Object.entries(leashesData);

      if (entries.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle("🐕 Membres en laisse")
          .setDescription("Personne n'est en laisse pour l'instant.")
          .setColor(0x2b2d31);
        await message.channel.send({ embeds: [embed] });
        return;
      }

      const lines = [];
      for (const [userId, info] of entries) {
        const user = await client.users.fetch(userId).catch(() => null);
        const mod = await client.users.fetch(info.by).catch(() => null);
        const userName = info.originalNickname || (user ? user.username : "Inconnu");
        const modName = mod ? mod.username : "Inconnu";
        lines.push(`🐕 **${userName}** — mis en laisse par **${modName}** <t:${Math.floor(info.date / 1000)}:R>`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`🐕 Membres en laisse (${entries.length})`)
        .setDescription(lines.join("\n"))
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !doro @quelqu'un -> demande de calin doro
    if (message.content.startsWith("!doro")) {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("Tu dois mentionner quelqu'un ! Exemple : `!doro @pseudo`");
      }

      if (target.id === message.author.id) {
        return message.reply("Tu ne peux pas te faire un doro à toi-même 😅");
      }

      const yesButton = new ButtonBuilder()
        .setCustomId(`doro_yes_${target.id}_${message.author.id}`)
        .setLabel("Oui")
        .setStyle(ButtonStyle.Success);

      const noButton = new ButtonBuilder()
        .setCustomId(`doro_no_${target.id}_${message.author.id}`)
        .setLabel("Non")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(yesButton, noButton);

      await message.channel.send({
        content: `${target} , ${message.author} veut doro avec toi !`,
        components: [row],
      });
      return;
    }

    // !avatar @quelqu'un -> affiche l'avatar en grand
    if (message.content.startsWith("!avatar")) {
      const target = message.mentions.users.first() || message.author;

      const embed = new EmbedBuilder()
        .setTitle(`Avatar de ${target.username}`)
        .setImage(target.displayAvatarURL({ size: 1024, extension: "png" }))
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !userinfo @quelqu'un -> affiche les infos du membre
    if (message.content.startsWith("!userinfo")) {
      const target = message.mentions.members.first() || message.member;

      const roles = target.roles.cache
        .filter((r) => r.id !== message.guild.id)
        .map((r) => `${r}`)
        .join(", ") || "Aucun rôle";

      const embed = new EmbedBuilder()
        .setTitle(`Informations sur ${target.user.username}`)
        .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "👤 Utilisateur", value: `${target.user}`, inline: true },
          { name: "🆔 ID", value: target.id, inline: true },
          { name: "📅 Compte créé le", value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:D>`, inline: false },
          { name: "📥 A rejoint le serveur le", value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>`, inline: false },
          { name: `🎭 Rôles (${target.roles.cache.size - 1})`, value: roles, inline: false }
        )
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !serverinfo -> affiche les infos du serveur
    if (message.content === "!serverinfo") {
      const guild = message.guild;
      const owner = await guild.fetchOwner();

      const totalMembers = guild.memberCount;
      const humanCount = guild.members.cache.filter((m) => !m.user.bot).size;
      const botCount = guild.members.cache.filter((m) => m.user.bot).size;

      const embed = new EmbedBuilder()
        .setTitle(`📊 Informations sur ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
          { name: "👑 Propriétaire", value: `${owner.user.tag}`, inline: true },
          { name: "🆔 ID du serveur", value: guild.id, inline: true },
          { name: "📅 Créé le", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: false },
          { name: "👥 Membres", value: `${totalMembers} (${humanCount} humains, ${botCount} bots)`, inline: false },
          { name: "💬 Salons", value: `${guild.channels.cache.size}`, inline: true },
          { name: "🎭 Rôles", value: `${guild.roles.cache.size}`, inline: true },
          { name: "🚀 Boosts", value: `${guild.premiumSubscriptionCount || 0} (niveau ${guild.premiumTier})`, inline: true }
        )
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !uptime -> depuis combien de temps le bot tourne
    if (message.content === "!uptime") {
      const uptimeMs = Date.now() - startTime;
      const seconds = Math.floor((uptimeMs / 1000) % 60);
      const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
      const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
      const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));

      const embed = new EmbedBuilder()
        .setTitle("⏱️ Uptime du bot")
        .setDescription(`Je tourne depuis **${days}j ${hours}h ${minutes}m ${seconds}s**`)
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !ping -> latence du bot
    if (message.content === "!ping") {
      const sent = await message.channel.send("Calcul en cours...");
      const latency = sent.createdTimestamp - message.createdTimestamp;

      const embed = new EmbedBuilder()
        .setTitle("🏓 Pong !")
        .addFields(
          { name: "Latence message", value: `${latency}ms`, inline: true },
          { name: "Latence API", value: `${Math.round(client.ws.ping)}ms`, inline: true }
        )
        .setColor(0x2b2d31);

      await sent.edit({ content: null, embeds: [embed] });
      return;
    }

    // !clear <nombre> -> supprime en masse des messages (staff uniquement)
    if (message.content.startsWith("!clear")) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.reply("Tu dois avoir la permission de gérer les messages pour faire ça.");
      }

      const args = message.content.split(" ");
      const amount = parseInt(args[1]);

      if (!amount || amount < 1 || amount > 100) {
        return message.reply("Indique un nombre entre 1 et 100. Exemple : `!clear 20`");
      }

      await message.delete().catch(() => {});
      const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);

      if (!deleted) {
        return message.channel.send("Impossible de supprimer ces messages (trop vieux de 14 jours ?).");
      }

      const confirmMsg = await message.channel.send(`🧹 ${deleted.size} messages supprimés.`);
      setTimeout(() => confirmMsg.delete().catch(() => {}), 3000);
      return;
    }

    // !raidmode [on/off] -> active/désactive manuellement le mode anti-raid
    if (message.content.startsWith("!raidmode")) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("Tu dois être administrateur pour faire ça.");
      }

      const arg = message.content.split(" ")[1];

      if (arg === "on") {
        raidModeActive = true;
        raidModeAuto = false;
        if (raidModeTimeout) {
          clearTimeout(raidModeTimeout);
          raidModeTimeout = null;
        }
        await message.channel.send(
          "🔒 Mode anti-raid activé manuellement. Les comptes de moins de 7 jours seront expulsés automatiquement à l'arrivée."
        );
      } else if (arg === "off") {
        raidModeActive = false;
        raidModeAuto = false;
        if (raidModeTimeout) {
          clearTimeout(raidModeTimeout);
          raidModeTimeout = null;
        }
        await message.channel.send("✅ Mode anti-raid désactivé.");
      } else {
        const embed = new EmbedBuilder()
          .setTitle("🛡️ Statut anti-raid")
          .setDescription(
            `Mode actuel : **${raidModeActive ? "ACTIVÉ 🔒" : "Désactivé"}**${
              raidModeActive && raidModeAuto ? " (déclenché automatiquement)" : ""
            }\n\nUtilise \`!raidmode on\` ou \`!raidmode off\` pour le changer.`
          )
          .setColor(0x2b2d31);
        await message.channel.send({ embeds: [embed] });
      }
      return;
    }

    // !lock -> verrouille le salon (empêche @everyone d'écrire)
    if (message.content === "!lock") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return message.reply("Tu dois avoir la permission de gérer les salons pour faire ça.");
      }

      await message.channel.permissionOverwrites
        .edit(message.guild.roles.everyone, { SendMessages: false })
        .catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle("🔒 Salon verrouillé")
        .setDescription(`${message.author} a verrouillé ce salon.`)
        .setColor(0xff4500);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !unlock -> déverrouille le salon
    if (message.content === "!unlock") {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return message.reply("Tu dois avoir la permission de gérer les salons pour faire ça.");
      }

      await message.channel.permissionOverwrites
        .edit(message.guild.roles.everyone, { SendMessages: null })
        .catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle("🔓 Salon déverrouillé")
        .setDescription(`${message.author} a déverrouillé ce salon.`)
        .setColor(0x57f287);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !warnings [@user] -> affiche l'historique des avertissements
    if (message.content.startsWith("!warnings")) {
      const target = message.mentions.users.first() || message.author;
      const history = warningsData[target.id] || [];

      if (history.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(`⚠️ Avertissements de ${target.username}`)
          .setDescription("Aucun avertissement enregistré.")
          .setColor(0x2b2d31);
        await message.channel.send({ embeds: [embed] });
        return;
      }

      const lines = history
        .slice(-10)
        .map(
          (w, i) =>
            `**${i + 1}.** ${w.reason}\n> par ${w.moderator} • <t:${Math.floor(w.date / 1000)}:d>`
        )
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setTitle(`⚠️ Avertissements de ${target.username} (${history.length})`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setDescription(lines)
        .setColor(0xffa500);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !sondage <question> -> crée un sondage avec réactions
    if (message.content.startsWith("!sondage")) {
      const question = message.content.slice("!sondage".length).trim();

      if (!question) {
        return message.reply("Pose une question ! Exemple : `!sondage Est-ce qu'on fait un event ce soir ?`");
      }

      const embed = new EmbedBuilder()
        .setTitle("📊 Sondage")
        .setDescription(question)
        .setFooter({ text: `Sondage créé par ${message.author.username}` })
        .setColor(0x2b2d31);

      const pollMsg = await message.channel.send({ embeds: [embed] });
      await pollMsg.react("✅");
      await pollMsg.react("❌");
      await message.delete().catch(() => {});
      return;
    }

    // !suggestion <texte> -> poste une suggestion votable
    if (message.content.startsWith("!suggestion")) {
      const suggestion = message.content.slice("!suggestion".length).trim();

      if (!suggestion) {
        return message.reply("Écris ta suggestion ! Exemple : `!suggestion Ajouter un salon musique`");
      }

      const embed = new EmbedBuilder()
        .setTitle("💡 Nouvelle suggestion")
        .setDescription(suggestion)
        .setFooter({ text: `Proposée par ${message.author.username}` })
        .setThumbnail(message.author.displayAvatarURL())
        .setColor(0xfff2b2);

      const suggestionMsg = await message.channel.send({ embeds: [embed] });
      await suggestionMsg.react("👍");
      await suggestionMsg.react("👎");
      await message.delete().catch(() => {});
      return;
    }

    // !rappel <minutes> <message> -> programme un rappel
    if (message.content.startsWith("!rappel")) {
      const args = message.content.split(" ").slice(1);
      const minutes = parseFloat(args[0]);
      const rappelText = args.slice(1).join(" ");

      if (!minutes || minutes <= 0 || !rappelText) {
        return message.reply("Utilise le format : `!rappel 10 message` (rappel dans 10 minutes)");
      }

      if (minutes > 1440) {
        return message.reply("Le rappel maximum est de 1440 minutes (24h).");
      }

      await message.reply(`⏰ Rappel programmé dans ${minutes} minute(s) !`);

      setTimeout(() => {
        message.channel
          .send(`⏰ ${message.author}, rappel : **${rappelText}**`)
          .catch(() => {});
      }, minutes * 60 * 1000);

      return;
    }

    // !rank [@user] -> affiche le niveau et l'XP
    if (message.content.startsWith("!rank")) {
      const target = message.mentions.users.first() || message.author;
      const data = levelsData[target.id] || { xp: 0, level: 1 };
      const needed = xpForLevel(data.level);

      const embed = new EmbedBuilder()
        .setTitle(`📈 Niveau de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "Niveau", value: `${data.level}`, inline: true },
          { name: "XP", value: `${data.xp} / ${needed}`, inline: true }
        )
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !leaderboard -> classement des 10 membres les plus actifs
    if (message.content === "!leaderboard" || message.content === "!top") {
      const sorted = Object.entries(levelsData)
        .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)
        .slice(0, 10);

      if (sorted.length === 0) {
        return message.reply("Personne n'a encore gagné d'XP !");
      }

      const lines = await Promise.all(
        sorted.map(async ([id, data], index) => {
          const user = await client.users.fetch(id).catch(() => null);
          const name = user ? user.username : "Utilisateur inconnu";
          return `**${index + 1}.** ${name} — Niveau ${data.level} (${data.xp} XP)`;
        })
      );

      const embed = new EmbedBuilder()
        .setTitle("🏆 Classement XP")
        .setDescription(lines.join("\n"))
        .setColor(0xffd700);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !badges [@user] -> affiche les badges débloqués
    if (message.content.startsWith("!badges")) {
      const target = message.mentions.users.first() || message.author;
      const badges = getUserBadges(target.id);

      const embed = new EmbedBuilder()
        .setTitle(`🎖️ Badges de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setDescription(
          badges.length > 0
            ? badges.map((b) => `${b.emoji} **${b.name}**`).join("\n")
            : "Aucun badge débloqué pour l'instant. Continue de discuter pour monter de niveau !"
        )
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !profile [@user] -> génère une carte de profil (image)
    if (message.content.startsWith("!profile")) {
      const target = message.mentions.users.first() || message.author;
      const data = levelsData[target.id] || { xp: 0, level: 1 };
      const badges = getUserBadges(target.id);

      const partnerId = marriagesData[target.id];
      let partnerUsername = null;
      if (partnerId) {
        const partner = await client.users.fetch(partnerId).catch(() => null);
        partnerUsername = partner ? partner.username : null;
      }

      const loadingMsg = await message.channel.send("🖼️ Génération de la carte de profil...");

      try {
        const buffer = await buildProfileCard(target, data, badges, partnerUsername);
        const attachment = new AttachmentBuilder(buffer, { name: "profile.png" });

        const embed = new EmbedBuilder()
          .setTitle(`Carte de profil — ${target.username}`)
          .setImage("attachment://profile.png")
          .setColor(0x2b2d31);

        await loadingMsg.delete().catch(() => {});
        await message.channel.send({ embeds: [embed], files: [attachment] });
      } catch (err) {
        console.error("❌ Erreur !profile :", err);
        await loadingMsg.edit("Oups, impossible de générer la carte de profil pour le moment.").catch(() => {});
      }
      return;
    }

    // !marry @user -> demande en mariage
    if (message.content.startsWith("!marry")) {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("Tu dois mentionner quelqu'un ! Exemple : `!marry @pseudo`");
      }
      if (target.id === message.author.id) {
        return message.reply("Tu ne peux pas te marier avec toi-même 😅");
      }
      if (target.bot) {
        return message.reply("Tu ne peux pas épouser un bot 🤖");
      }
      if (marriagesData[message.author.id]) {
        return message.reply("Tu es déjà marié(e) ! Utilise `!divorce` d'abord si tu veux changer.");
      }
      if (marriagesData[target.id]) {
        return message.reply(`${target.username} est déjà marié(e) à quelqu'un d'autre !`);
      }

      const yesButton = new ButtonBuilder()
        .setCustomId(`marry_yes_${target.id}_${message.author.id}`)
        .setLabel("Oui, je le veux 💍")
        .setStyle(ButtonStyle.Success);

      const noButton = new ButtonBuilder()
        .setCustomId(`marry_no_${target.id}_${message.author.id}`)
        .setLabel("Non")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(yesButton, noButton);

      await message.channel.send({
        content: `💍 ${target} , ${message.author} te demande en mariage ! Qu'en dis-tu ?`,
        components: [row],
      });
      return;
    }

    // !divorce -> rompt le mariage actuel
    if (message.content === "!divorce") {
      const partnerId = marriagesData[message.author.id];

      if (!partnerId) {
        return message.reply("Tu n'es marié(e) à personne pour l'instant !");
      }

      delete marriagesData[message.author.id];
      delete marriagesData[partnerId];
      saveMarriages();

      await message.channel.send(`💔 ${message.author} vient de divorcer... un moment de silence.`);
      return;
    }

    // !married [@user] -> affiche le/la partenaire actuel(le)
    if (message.content.startsWith("!married")) {
      const target = message.mentions.users.first() || message.author;
      const partnerId = marriagesData[target.id];

      if (!partnerId) {
        await message.channel.send(`${target.username} n'est marié(e) à personne pour l'instant.`);
      } else {
        const partner = await client.users.fetch(partnerId).catch(() => null);
        await message.channel.send(
          `${target.username} est marié(e) avec **${partner ? partner.username : "quelqu'un"}** 💍`
        );
      }
      return;
    }

    // !couples -> liste les couples mariés du serveur
    if (message.content === "!couples") {
      const seen = new Set();
      const pairs = [];

      for (const [id1, id2] of Object.entries(marriagesData)) {
        const key = shipKey(id1, id2);
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([id1, id2]);
      }

      if (pairs.length === 0) {
        return message.reply("Personne n'est marié pour l'instant sur le serveur !");
      }

      const lines = await Promise.all(
        pairs.slice(0, 10).map(async ([id1, id2]) => {
          const u1 = await client.users.fetch(id1).catch(() => null);
          const u2 = await client.users.fetch(id2).catch(() => null);
          return `💍 **${u1 ? u1.username : "?"}** ❤️ **${u2 ? u2.username : "?"}**`;
        })
      );

      const embed = new EmbedBuilder()
        .setTitle("💑 Couples de Haven")
        .setDescription(lines.join("\n"))
        .setColor(0xff69b4);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !compliment @user -> envoie un compliment aléatoire
    if (message.content.startsWith("!compliment")) {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("Tu dois mentionner quelqu'un ! Exemple : `!compliment @pseudo`");
      }

      const phrase = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];

      const embed = new EmbedBuilder()
        .setDescription(`💖 **${target.username}** ${phrase}`)
        .setColor(0xffb6c1);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !insulte @user -> envoie une "insulte" gentille aléatoire
    if (message.content.startsWith("!insulte")) {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("Tu dois mentionner quelqu'un ! Exemple : `!insulte @pseudo`");
      }

      const phrase = INSULTES[Math.floor(Math.random() * INSULTES.length)];

      const embed = new EmbedBuilder()
        .setDescription(`😈 **${target.username}** ${phrase}`)
        .setColor(0xff4500);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !confession <texte> -> envoie une confession anonyme
    if (message.content.startsWith("!confession")) {
      const text = message.content.slice("!confession".length).trim();

      if (!text) {
        return message.reply("Écris ta confession ! Exemple : `!confession J'ai mangé le dernier gâteau...`");
      }

      const confessionsChannel = message.guild.channels.cache.get(CONFESSIONS_CHANNEL_ID);
      await message.delete().catch(() => {});

      if (!confessionsChannel) {
        return message.author.send("Salon confessions introuvable, contacte un admin !").catch(() => {});
      }

      confessionsCount += 1;
      saveConfessionsCount();

      const embed = new EmbedBuilder()
        .setTitle(`🤫 Confession anonyme #${confessionsCount}`)
        .setDescription(text)
        .setColor(0x2b2d31);

      await confessionsChannel.send({ embeds: [embed] });
      return;
    }

    // !poll <question> | <option1> | <option2> ... -> sondage à choix multiples
    if (message.content.startsWith("!poll")) {
      const raw = message.content.slice("!poll".length).trim();
      const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);

      if (parts.length < 3) {
        return message.reply(
          "Utilise le format : `!poll Question | Option 1 | Option 2 | ...` (2 à 10 options)"
        );
      }

      const question = parts[0];
      const choices = parts.slice(1, 11);
      const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

      const embed = new EmbedBuilder()
        .setTitle("📊 " + question)
        .setDescription(choices.map((c, i) => `${numberEmojis[i]} ${c}`).join("\n"))
        .setFooter({ text: `Sondage créé par ${message.author.username}` })
        .setColor(0x2b2d31);

      const pollMsg = await message.channel.send({ embeds: [embed] });
      for (let i = 0; i < choices.length; i++) {
        await pollMsg.react(numberEmojis[i]);
      }
      await message.delete().catch(() => {});
      return;
    }

    // !unban <id> -> débannit un membre par son ID
    if (message.content.startsWith("!unban")) {
      if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return message.reply("Tu dois avoir la permission de bannir pour faire ça.");
      }

      const id = message.content.split(" ")[1];
      if (!id) {
        return message.reply("Indique un ID ! Exemple : `!unban 123456789012345678`");
      }

      try {
        await message.guild.members.unban(id);
        await message.channel.send(`✅ L'utilisateur \`${id}\` a été débanni.`);
      } catch (err) {
        await message.reply("Impossible de débannir cet ID (déjà débanni ou ID invalide ?).");
      }
      return;
    }

    // !purge @user <nombre> -> supprime les X derniers messages d'une personne
    if (message.content.startsWith("!purge")) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.reply("Tu dois avoir la permission de gérer les messages pour faire ça.");
      }

      const target = message.mentions.members.first();
      const args = message.content.split(" ");
      const amount = parseInt(args[2]);

      if (!target || !amount || amount < 1 || amount > 100) {
        return message.reply("Utilise le format : `!purge @user <nombre entre 1 et 100>`");
      }

      await message.delete().catch(() => {});

      const fetched = await message.channel.messages.fetch({ limit: 100 });
      const userMessages = fetched.filter((m) => m.author.id === target.id).first(amount);

      const deleted = await message.channel.bulkDelete(userMessages, true).catch(() => null);

      if (!deleted) {
        return message.channel.send("Impossible de supprimer ces messages (trop vieux de 14 jours ?).");
      }

      const confirmMsg = await message.channel.send(`🧹 ${deleted.size} message(s) de ${target.user.tag} supprimé(s).`);
      setTimeout(() => confirmMsg.delete().catch(() => {}), 3000);
      return;
    }

    // !rps @user -> pierre-feuille-ciseaux en duel
    if (message.content.startsWith("!rps")) {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("Tu dois mentionner quelqu'un ! Exemple : `!rps @pseudo`");
      }
      if (target.id === message.author.id) {
        return message.reply("Tu ne peux pas jouer contre toi-même 😅");
      }
      if (target.bot) {
        return message.reply("Tu ne peux pas défier un bot 🤖");
      }

      const gameId = `${message.id}`;
      rpsGames.set(gameId, { players: [message.author.id, target.id], choices: {} });

      const pierreBtn = new ButtonBuilder().setCustomId(`rps_${gameId}_pierre`).setLabel("🪨 Pierre").setStyle(ButtonStyle.Secondary);
      const feuilleBtn = new ButtonBuilder().setCustomId(`rps_${gameId}_feuille`).setLabel("📄 Feuille").setStyle(ButtonStyle.Secondary);
      const ciseauxBtn = new ButtonBuilder().setCustomId(`rps_${gameId}_ciseaux`).setLabel("✂️ Ciseaux").setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(pierreBtn, feuilleBtn, ciseauxBtn);

      await message.channel.send({
        content: `🎮 **${message.author.username}** défie **${target.username}** à pierre-feuille-ciseaux !\nChoisissez en secret ci-dessous (30 secondes).`,
        components: [row],
      });

      setTimeout(() => {
        if (rpsGames.has(gameId)) rpsGames.delete(gameId);
      }, 30000);
      return;
    }

    // !tictactoe @user -> morpion avec boutons (version simplifiée, sans état côté bot)
    if (message.content.startsWith("!tictactoe") || message.content.startsWith("!ttt")) {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply("Tu dois mentionner quelqu'un ! Exemple : `!tictactoe @pseudo`");
      }
      if (target.id === message.author.id) {
        return message.reply("Tu ne peux pas jouer contre toi-même 😅");
      }
      if (target.bot) {
        return message.reply("Tu ne peux pas défier un bot 🤖");
      }

      const board = "_________";
      const rows = buildTttRows(board, message.author.id, target.id, "X");

      await message.channel.send({
        content: `❌⭕ **${message.author.username}** (❌) vs **${target.username}** (⭕)\nAu tour de **${message.author.username}** !`,
        components: rows,
      });
      return;
    }

    // !dice [NdN] -> lance un ou plusieurs dés
    if (message.content.startsWith("!dice")) {
      const arg = message.content.split(" ")[1];
      let sides = 6;
      let count = 1;

      if (arg) {
        const match = arg.match(/^(\d*)d(\d+)$/i);
        if (match) {
          count = match[1] ? parseInt(match[1]) : 1;
          sides = parseInt(match[2]);
        } else if (!isNaN(parseInt(arg))) {
          sides = parseInt(arg);
        }
      }

      count = Math.min(Math.max(count, 1), 10);
      if (sides < 2 || sides > 1000) sides = 6;

      const rolls = [];
      for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
      }
      const total = rolls.reduce((a, b) => a + b, 0);

      const embed = new EmbedBuilder()
        .setTitle("🎲 Lancer de dé")
        .setDescription(
          `**${message.author.username}** lance ${count}d${sides}\n\n` +
            `Résultat : ${rolls.join(" + ")}${count > 1 ? ` = **${total}**` : ""}`
        )
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !roulette <options séparées par virgules> -> vraie roue animée (GIF) qui tourne et s'arrête
    if (message.content.startsWith("!roulette")) {
      const argsText = message.content.slice("!roulette".length).trim();
      let options = argsText
        ? argsText.split(",").map((o) => o.trim()).filter(Boolean)
        : ["Pizza", "Burger", "Tacos", "Sushi", "Ramen", "Salade"];

      if (options.length < 2) {
        return message.reply(
          "Donne au moins 2 options séparées par des virgules ! Exemple : `!roulette pizza, burger, sushi`\n(ou laisse vide pour la roue par défaut)"
        );
      }
      if (options.length > 8) options = options.slice(0, 8);

      const loadingMsg = await message.channel.send("🎡 Préparation de la roue...");

      try {
        const size = 320;
        const hues = options.map((_, i) => Math.floor((360 / options.length) * i));

        const hslToRgb = (h, s, l) => {
          s /= 100;
          l /= 100;
          const k = (n) => (n + h / 30) % 12;
          const a = s * Math.min(l, 1 - l);
          const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
          return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
        };

        // Palette fixe : fond, doré (bordure/pointeur/anneau du bouton), texte blanc,
        // bleu-violet (cœur du bouton SPIN), contour noir + une couleur par case
        const paletteRgb = [
          [0x2b, 0x2d, 0x31],
          [0xff, 0xd7, 0x00],
          [0xff, 0xff, 0xff],
          [0x58, 0x65, 0xf2],
          [0x00, 0x00, 0x00],
          ...hues.map((h) => hslToRgb(h, 70, 78)),
        ];
        while (paletteRgb.length < 16) paletteRgb.push(paletteRgb[paletteRgb.length - 1]);
        const paletteInts = paletteRgb.map(([r, g, b]) => (r << 16) | (g << 8) | b);

        const nearestIndex = (r, g, b) => {
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < paletteRgb.length; i++) {
            const [pr, pg, pb] = paletteRgb[i];
            const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }
          return bestIdx;
        };

        const colors = hues.map((h) => `hsl(${h}, 70%, 78%)`);
        const sliceAngle = (2 * Math.PI) / options.length;

        const buildWheelUrl = (rotation) => {
          const config = {
            type: "pie",
            data: {
              labels: options,
              datasets: [
                {
                  backgroundColor: colors,
                  borderColor: "#FFFFFF",
                  borderWidth: 6,
                  data: options.map(() => 1),
                },
              ],
            },
            options: {
              layout: { padding: 0 },
              legend: { display: false },
              plugins: {
                datalabels: {
                  display: true,
                  color: "#2b2d31",
                  font: { size: 13, weight: "bold" },
                  anchor: "center",
                  align: "center",
                  clamp: true,
                  formatter: "__FORMATTER_PLACEHOLDER__",
                },
              },
              tooltips: { enabled: false },
              rotation: rotation,
              circumference: 2 * Math.PI,
              animation: false,
            },
          };

          const formatterFn =
            "function(value, context) { return context.chart.data.labels[context.dataIndex]; }";

          let configStr = JSON.stringify(config);
          configStr = configStr.replace('"__FORMATTER_PLACEHOLDER__"', formatterFn);

          return `https://quickchart.io/chart?c=${encodeURIComponent(
            configStr
          )}&width=${size}&height=${size}&backgroundColor=%232b2d31&devicePixelRatio=1`;
        };

        const drawPointerTop = (data, imgSize) => {
          const centerX = Math.floor(imgSize / 2);
          const baseY = 0;
          const apexY = 40;
          const maxHalfWidth = 18;

          const setPx = (x, y, r, g, b) => {
            if (x < 0 || x >= imgSize || y < 0 || y >= imgSize) return;
            const idx = (y * imgSize + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 0xff;
          };

          for (let y = baseY; y <= apexY; y++) {
            const progress = y / apexY;
            const halfWidth = maxHalfWidth * (1 - progress);
            const xStart = Math.round(centerX - halfWidth);
            const xEnd = Math.round(centerX + halfWidth);
            for (let x = xStart; x <= xEnd; x++) {
              if (x === xStart || x === xEnd || x === xStart + 1 || x === xEnd - 1) {
                setPx(x, y, 0x00, 0x00, 0x00);
              } else {
                setPx(x, y, 0xff, 0xd7, 0x00);
              }
            }
          }
        };

        const drawCenterButton = (data, imgSize, radius) => {
          const cx = imgSize / 2;
          const cy = imgSize / 2;
          const setPx = (x, y, r, g, b) => {
            if (x < 0 || x >= imgSize || y < 0 || y >= imgSize) return;
            const idx = (y * imgSize + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 0xff;
          };
          const minX = Math.max(0, Math.floor(cx - radius));
          const maxX = Math.min(imgSize - 1, Math.ceil(cx + radius));
          const minY = Math.max(0, Math.floor(cy - radius));
          const maxY = Math.min(imgSize - 1, Math.ceil(cy + radius));
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
              if (dist <= radius) {
                if (dist > radius - 5) {
                  setPx(x, y, 0xff, 0xd7, 0x00);
                } else if (dist > radius - 7) {
                  setPx(x, y, 0xff, 0xff, 0xff);
                } else {
                  setPx(x, y, 0x58, 0x65, 0xf2);
                }
              }
            }
          }
        };

        const buttonRadius = 46;
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

        const winningIndex = Math.floor(Math.random() * options.length);
        const result = options[winningIndex];

        let target = -Math.PI / 2 - (winningIndex + 0.5) * sliceAngle;
        target = ((target % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const endRotation = target + 4 * 2 * Math.PI;

        const numFrames = 14;
        const buf = Buffer.alloc(size * size * numFrames + 8192);
        const gifWriter = new GifWriter(buf, size, size, { loop: 0 });

        for (let i = 0; i < numFrames; i++) {
          const t = i / (numFrames - 1);
          const eased = 1 - Math.pow(1 - t, 3);
          const rotation = endRotation * eased;

          const res = await fetch(buildWheelUrl(rotation));
          const arrayBuf = await res.arrayBuffer();
          const image = await Jimp.read(Buffer.from(arrayBuf));

          drawPointerTop(image.bitmap.data, size);
          drawCenterButton(image.bitmap.data, size, buttonRadius);
          image.print(
            font,
            size / 2 - buttonRadius,
            size / 2 - 16,
            {
              text: "SPIN",
              alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
              alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
            },
            buttonRadius * 2,
            32
          );

          const pixelData = image.bitmap.data;
          const indexedPixels = new Uint8Array(size * size);
          for (let p = 0; p < size * size; p++) {
            const off = p * 4;
            indexedPixels[p] = nearestIndex(pixelData[off], pixelData[off + 1], pixelData[off + 2]);
          }

          const delayCs = i === numFrames - 1 ? 250 : 9;
          gifWriter.addFrame(0, 0, size, size, indexedPixels, {
            palette: paletteInts,
            delay: delayCs,
            disposal: 2,
          });
        }

        const finalSize = gifWriter.end();
        const gifBuffer = buf.slice(0, finalSize);

        const attachment = new AttachmentBuilder(gifBuffer, { name: "roulette.gif" });
        const embed = new EmbedBuilder()
          .setTitle("🎡 La roue tourne...")
          .setDescription(`Le repère ▶ va tomber sur un résultat !`)
          .setImage("attachment://roulette.gif")
          .setFooter({ text: `Roue lancée par ${message.author.username}` })
          .setColor(0xffd700);

        await loadingMsg.delete().catch(() => {});
        const finalMsg = await message.channel.send({ embeds: [embed], files: [attachment] });

        setTimeout(() => {
          finalMsg
            .edit({
              embeds: [
                EmbedBuilder.from(embed)
                  .setTitle("🎉 La roue s'est arrêtée !")
                  .setDescription(`Le repère tombe sur... **${result}** !`),
              ],
            })
            .catch(() => {});
        }, 3200);
      } catch (err) {
        console.error("❌ Erreur !roulette :", err);
        await loadingMsg.edit("Oups, impossible de générer la roue pour le moment, réessaie plus tard !").catch(() => {});
      }
      return;
    }

    // !quiz -> question à choix multiples avec réactions
    if (message.content === "!quiz") {
      const quiz = QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];
      const letters = ["🇦", "🇧", "🇨", "🇩"];

      const embed = new EmbedBuilder()
        .setTitle("❓ Quiz Time !")
        .setDescription(
          `${quiz.question}\n\n` +
            quiz.choices.map((c, i) => `${letters[i]} ${c}`).join("\n") +
            `\n\nRéagis avec la bonne réponse ! (15 secondes)`
        )
        .setColor(0x2b2d31);

      const quizMsg = await message.channel.send({ embeds: [embed] });
      for (const letter of letters) {
        await quizMsg.react(letter);
      }

      const filter = (reaction, user) => letters.includes(reaction.emoji.name) && !user.bot;
      const collector = quizMsg.createReactionCollector({ filter, time: 15000 });

      const answered = new Set();
      const correctUsers = [];

      collector.on("collect", (reaction, user) => {
        if (answered.has(user.id)) return;
        answered.add(user.id);
        if (letters.indexOf(reaction.emoji.name) === quiz.correct) {
          correctUsers.push(user.username);
        }
      });

      collector.on("end", () => {
        const resultEmbed = new EmbedBuilder()
          .setTitle("✅ Réponse")
          .setDescription(
            `La bonne réponse était : **${letters[quiz.correct]} ${quiz.choices[quiz.correct]}**\n\n` +
              (correctUsers.length > 0 ? `Bravo à : ${correctUsers.join(", ")} 🎉` : "Personne n'a trouvé... 😅")
          )
          .setColor(0x2b2d31);

        message.channel.send({ embeds: [resultEmbed] }).catch(() => {});
      });

      return;
    }

    // ----- Commandes fun avec gif aléatoire (calin, bisou, slap, pat) -----
    const funCommands = {
      "!calin": { endpoint: "hug", verbe: "fait un câlin à", color: 0xffb6c1 },
      "!bisou": { endpoint: "kiss", verbe: "fait un bisou à", color: 0xff69b4 },
      "!slap": { endpoint: "slap", verbe: "met une baffe à", color: 0xff4500 },
      "!pat": { endpoint: "pat", verbe: "fait une papouille à", color: 0xadd8e6 },
    };

    const usedCommand = Object.keys(funCommands).find((cmd) => message.content.startsWith(cmd));

    if (usedCommand) {
      const target = message.mentions.users.first();

      if (!target) {
        return message.reply(`Tu dois mentionner quelqu'un ! Exemple : \`${usedCommand} @pseudo\``);
      }

      const { endpoint, verbe, color } = funCommands[usedCommand];

      try {
        const imageUrl = await fetchNekoImage(endpoint);

        const embed = new EmbedBuilder()
          .setDescription(`**${message.author.username}** ${verbe} **${target.username}** !`)
          .setImage(imageUrl)
          .setColor(color);

        await message.channel.send({ content: `${target}`, embeds: [embed] });
      } catch (err) {
        console.error(err);
        message.reply("Oups, impossible de récupérer un gif pour le moment, réessaie plus tard !");
      }
      return;
    }

    // !ship @user1 [@user2] -> % de compatibilité aléatoire
    if (message.content.startsWith("!ship")) {
      const mentioned = message.mentions.users;
      const user1 = mentioned.first() || message.author;
      const user2 = mentioned.size > 1 ? mentioned.at(1) : message.author;

      if (user1.id === user2.id && mentioned.size < 2) {
        return message.reply("Mentionne au moins une personne ! Exemple : `!ship @pseudo1 @pseudo2`");
      }

      const key = shipKey(user1.id, user2.id);
      const alreadyMarried = marriagesData[user1.id] === user2.id;

      let percent;
      let isCached = false;

      if (alreadyMarried) {
        percent = 100;
      } else if (shipsData[key] !== undefined) {
        percent = shipsData[key];
        isCached = true;
      } else {
        percent = Math.floor(Math.random() * 101);
        shipsData[key] = percent;
        saveShips();
      }

      let commentaire;
      if (percent < 20) commentaire = "Aïe... rien à sauver ici. 💔";
      else if (percent < 40) commentaire = "Bof bof, ça part mal. 😬";
      else if (percent < 60) commentaire = "Ça pourrait marcher avec un peu d'effort. 🤔";
      else if (percent < 80) commentaire = "Ça sent bon pour vous deux ! 😊";
      else if (percent < 100) commentaire = "Waouh, presque parfait ! 💕";
      else commentaire = "MATCH PARFAIT ! Allez vous marier tout de suite ! 💖";

      const filledBlocks = Math.round(percent / 10);
      const bar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

      const embed = new EmbedBuilder()
        .setTitle("💘 Ship-o-mètre")
        .setDescription(
          `**${user1.username}** ❤️ **${user2.username}**\n\n` +
            `\`${bar}\` **${percent}%**\n\n${commentaire}`
        )
        .setColor(0xff69b4);

      if (alreadyMarried) {
        embed.setFooter({ text: "💍 Ce couple est marié — 100% garanti !" });
      } else if (isCached) {
        embed.setFooter({ text: "💾 Résultat enregistré pour ce couple." });
      }

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !8ball <question> -> boule magique
    if (message.content.startsWith("!8ball")) {
      const question = message.content.slice("!8ball".length).trim();

      if (!question) {
        return message.reply("Pose une question ! Exemple : `!8ball Est-ce que je vais réussir ?`");
      }

      const response = EIGHT_BALL_RESPONSES[Math.floor(Math.random() * EIGHT_BALL_RESPONSES.length)];

      const embed = new EmbedBuilder()
        .setTitle("🎱 Boule magique")
        .addFields(
          { name: "Question", value: question },
          { name: "Réponse", value: response }
        )
        .setColor(0x2b2d31);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !blague -> blague aléatoire (tolère du texte après la commande)
    if (message.content.startsWith("!blague")) {
      const blague = BLAGUES[Math.floor(Math.random() * BLAGUES.length)];

      const embed = new EmbedBuilder()
        .setDescription(`😂 ${blague}`)
        .setColor(0xffd700);

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // !meme -> meme aléatoire (reddit)
    if (message.content === "!meme") {
      try {
        const response = await fetch("https://meme-api.com/gimme");

        if (!response.ok) {
          throw new Error(`Réponse API invalide : ${response.status}`);
        }

        const data = await response.json();

        const embed = new EmbedBuilder()
          .setTitle(data.title)
          .setImage(data.url)
          .setFooter({ text: `r/${data.subreddit}` })
          .setColor(0x2b2d31);

        await message.channel.send({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        message.reply("Oups, impossible de récupérer un meme pour le moment, réessaie plus tard !");
      }
      return;
    }

    // ========== CRÉER LES SALONS VOCAUX (OWNER ONLY) ==========
    if (message.content === '=createvocs') {
      // Vérification: seulement l'owner du serveur
      if (message.author.id !== message.guild.ownerId) {
        return message.reply({
          content: '❌ Seul l\'owner du serveur peut utiliser cette commande !',
        });
      }

      try {
        await message.reply('⏳ Création des salons vocaux en cours...');

        // Chercher ou créer la catégorie "📊"
        let statsCategory = message.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '📊');
        
        if (!statsCategory) {
          statsCategory = await message.guild.channels.create({
            name: '📊',
            type: ChannelType.GuildCategory,
          });
        }

        // Créer le salon "👥 Total : [nombre]"
        let totalVocal = message.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name.startsWith('👥 Total'));
        
        if (!totalVocal) {
          totalVocal = await message.guild.channels.create({
            name: `👥 Total : ${message.guild.memberCount}`,
            type: ChannelType.GuildVoice,
            parent: statsCategory.id,
            permissionOverwrites: [
              {
                id: message.guild.id,
                deny: ['Connect'],
                allow: ['ViewChannel', 'Speak', 'Stream', 'UseVAD'],
              },
              {
                id: message.author.id,
                allow: ['Connect', 'ViewChannel', 'Speak'],
              }
            ],
          });
        }

        // Créer le salon "🧷・.gg/haven"
        let inviteVocal = message.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name.includes('.gg/haven'));
        
        if (!inviteVocal) {
          inviteVocal = await message.guild.channels.create({
            name: '🧷・.gg/haven',
            type: ChannelType.GuildVoice,
            parent: statsCategory.id,
            permissionOverwrites: [
              {
                id: message.guild.id,
                deny: ['Connect'],
                allow: ['ViewChannel', 'Speak', 'Stream', 'UseVAD'],
              },
              {
                id: message.author.id,
                allow: ['Connect', 'ViewChannel', 'Speak'],
              }
            ],
          });
        }

        await message.reply('✅ Les 2 salons vocaux ont été créés dans la catégorie 📊 !');
        logger.info('COMMAND', `=createvocs utilisée par ${message.author.tag}`);
      } catch (err) {
        logger.error('COMMAND', 'Erreur dans =createvocs', err);
        await message.reply('❌ Erreur lors de la création des salons vocaux: ' + err.message);
      }
      return;
    }

    // ========== STATS SERVEUR (OWNER ONLY) ==========
    if (message.content === '=stats') {
      // Vérification: seulement l'owner du serveur
      if (message.author.id !== message.guild.ownerId) {
        return message.reply({
          content: '❌ Seul l\'owner du serveur peut utiliser cette commande !',
          ephemeral: true
        });
      }

      try {
        const embed = await createServerStatsEmbed(message.guild);
        await message.reply({ embeds: [embed] });
        logger.info('COMMAND', `=stats utilisée par ${message.author.tag} (Owner)`);
      } catch (err) {
        logger.error('COMMAND', 'Erreur dans =stats', err);
        await message.reply('❌ Erreur lors de la récupération des stats');
      }
      return;
    }

    // ========== BLACKLIST ==========
    if (message.content.startsWith('=bl') || message.content.startsWith('=unbl') || message.content.startsWith('=blinfo')) {
      console.log('🚫 Commande Blacklist détectée');
      
      if (!message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return message.reply('❌ Pas de permission.');
      }

      // Détecter quelle commande
      let command = '';
      let argsStr = '';
      
      if (message.content.startsWith('=unbl ')) {
        command = 'unbl';
        argsStr = message.content.slice(6).trim();
      } else if (message.content.startsWith('=blinfo ')) {
        command = 'blinfo';
        argsStr = message.content.slice(8).trim();
      } else if (message.content.startsWith('=bl ')) {
        command = 'bl';
        argsStr = message.content.slice(4).trim();
      } else if (message.content === '=bl') {
        command = 'bl';
        argsStr = '';
      } else if (message.content === '=unbl') {
        command = 'unbl';
        argsStr = '';
      } else if (message.content === '=blinfo') {
        command = 'blinfo';
        argsStr = '';
      }

      const args = argsStr.split(/\s+/).filter(a => a);

      // =bl (affiche la liste)
      if (command === 'bl' && args.length === 0) {
        const blacklist = getServerBlacklist(message.guildId);
        if (Object.keys(blacklist).length === 0) {
          return message.reply('✅ La blacklist est vide.');
        }

        const embed = new EmbedBuilder()
          .setTitle('🚫 Blacklist du serveur')
          .setColor(0xff0000);

        let description = '';
        for (const [userId, data] of Object.entries(blacklist)) {
          description += `**${userId}** - ${data.reason}\n└ Blacklist par: <@${data.by}> le <t:${Math.floor(data.date / 1000)}:f>\n\n`;
        }

        if (description.length > 4096) {
          embed.setDescription(description.slice(0, 4096) + '\n... (liste trop longue)');
        } else {
          embed.setDescription(description || 'Aucun membre blacklisté.');
        }

        return message.reply({ embeds: [embed] });
      }

      // =unbl id (retire de la blacklist)
      if (command === 'unbl' && args[0]) {
        console.log('✅ UNBL ACTIVÉ! ID:', args[0]);
        const userId = args[0];
        const blacklist = getServerBlacklist(message.guildId);

        if (!blacklist[userId]) {
          return message.reply('❌ Cet ID n\'est pas blacklisté.');
        }

        try {
          // Débannir le membre
          await message.guild.bans.remove(userId, 'Retiré de la blacklist');

          // Retirer de la blacklist
          delete blacklist[userId];
          saveBlacklist(blacklistData);

          // Log l'action
          await logBlacklistAction(message.guild, 'remove', userId, message.author.id);

          message.reply(`✅ **${userId}** a été retiré de la blacklist et débanni.`);
        } catch (err) {
          console.error('❌ Erreur unblacklist:', err);
          message.reply('❌ Erreur lors du retrait de la blacklist.');
        }
        return;
      }

      // =blinfo id (affiche infos)
      if (command === 'blinfo' && args[0]) {
        const userId = args[0];
        const blacklist = getServerBlacklist(message.guildId);

        if (!blacklist[userId]) {
          return message.reply('❌ Cet ID n\'est pas blacklisté.');
        }

        const data = blacklist[userId];
        const embed = new EmbedBuilder()
          .setTitle(`📋 Infos Blacklist - ${userId}`)
          .addFields(
            { name: '🚫 Raison', value: data.reason || 'Non spécifiée', inline: false },
            { name: '👤 Blacklisté par', value: `<@${data.by}>`, inline: true },
            { name: '📅 Date', value: `<t:${Math.floor(data.date / 1000)}:F>`, inline: true }
          )
          .setColor(0xff0000);

        return message.reply({ embeds: [embed] });
      }

      // =bl id raison (ajoute à la blacklist)
      if (command === 'bl' && args.length > 0) {
        if (args.length < 2) {
          return message.reply('❌ Usage: `=bl <id> <raison>`');
        }

        const userId = args[0];
        const reason = args.slice(1).join(' ');

        // Vérifier si déjà blacklisté
        const blacklist = getServerBlacklist(message.guildId);
        if (blacklist[userId]) {
          return message.reply('❌ Cet ID est déjà blacklisté.');
        }

        try {
          // Bannir le membre
          await message.guild.bans.create(userId, { reason: `Blacklist: ${reason}` });

          // Ajouter à la blacklist
          blacklist[userId] = {
            by: message.author.id,
            date: Date.now(),
            reason: reason,
          };
          saveBlacklist(blacklistData);

          // Log l'action
          await logBlacklistAction(message.guild, 'add', userId, message.author.id, reason);

          message.reply(`✅ **${userId}** a été blacklisté et banni.`);
        } catch (err) {
          console.error('❌ Erreur blacklist add:', err);
          message.reply('❌ Erreur lors de la blacklist (ID invalide?)');
        }
        return;
      }

      // Si aucune sous-commande valide
      return message.reply('❌ Usage:\n`=bl` — Affiche la liste\n`=bl <id> <raison>` — Blacklist\n`=unbl <id>` — Retire\n`=blinfo <id>` — Infos');
    }

    // ========== INFOS MEMBRES/SALONS ==========
    if (message.content.startsWith('=ui')) {
      const user = message.mentions.users.first() || message.author;
      const embed = new EmbedBuilder()
        .setTitle(`👤 Profil - ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 512 }))
        .addFields(
          { name: 'ID', value: user.id, inline: true },
          { name: 'Créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
          { name: 'Bot?', value: user.bot ? 'Oui' : 'Non', inline: true }
        )
        .setColor(0x2b2d31);
      return message.reply({ embeds: [embed] });
    }

    if (message.content.startsWith('=avatar')) {
      const user = message.mentions.users.first() || message.author;
      const embed = new EmbedBuilder()
        .setTitle(`Avatar - ${user.username}`)
        .setImage(user.displayAvatarURL({ size: 512 }))
        .setColor(0x2b2d31);
      return message.reply({ embeds: [embed] });
    }

    if (message.content.startsWith('=banner')) {
      const user = message.mentions.users.first() || message.author;
      try {
        const fullUser = await client.users.fetch(user.id);
        const banner = fullUser.bannerURL({ size: 4096 });
        if (!banner) {
          return message.reply('❌ Pas de banner.');
        }
        const embed = new EmbedBuilder()
          .setTitle(`Banner - ${user.username}`)
          .setImage(banner)
          .setColor(0x2b2d31);
        return message.reply({ embeds: [embed] });
      } catch (err) {
        return message.reply('❌ Erreur en récupérant la banner.');
      }
    }

    if (message.content.startsWith('=roleinfo')) {
      const role = message.mentions.roles.first();
      if (!role) return message.reply('❌ Mention un rôle: `=roleinfo @role`');
      
      const embed = new EmbedBuilder()
        .setTitle(`🏷️ ${role.name}`)
        .addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Couleur', value: role.color ? `#${role.color.toString(16).toUpperCase().padStart(6, '0')}` : 'Par défaut', inline: true },
          { name: 'Créé le', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:F>`, inline: true },
          { name: 'Membres', value: `${role.members.size}`, inline: true }
        )
        .setColor(role.color || 0x2b2d31);
      return message.reply({ embeds: [embed] });
    }

    if (message.content.startsWith('=channelinfo')) {
      const channel = message.mentions.channels.first() || message.channel;
      const embed = new EmbedBuilder()
        .setTitle(`#️⃣ ${channel.name}`)
        .addFields(
          { name: 'ID', value: channel.id, inline: true },
          { name: 'Type', value: channel.type === 0 ? 'Texte' : 'Vocal', inline: true },
          { name: 'Créé le', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>`, inline: true },
          { name: 'Sujet', value: channel.topic || 'Aucun', inline: false }
        )
        .setColor(0x2b2d31);
      return message.reply({ embeds: [embed] });
    }

    // ========== SNIPE ==========
    if (message.content === '=snipe') {
      const sniped = snipeCache.get(message.guildId);
      if (!sniped || sniped.length === 0) {
        return message.reply('❌ Rien à snipe.');
      }
      const last = sniped[sniped.length - 1];
      const embed = new EmbedBuilder()
        .setAuthor({ name: last.author, iconURL: last.avatar })
        .setDescription(last.content)
        .setColor(0x2b2d31)
        .setFooter({ text: `Supprimé il y a quelques secondes` });
      return message.reply({ embeds: [embed] });
    }

    // ========== POLL ==========
    if (message.content.startsWith('=poll')) {
      const args = message.content.slice(6).trim();
      if (!args) return message.reply('❌ Usage: `=poll Question | Option1 | Option2 | ...`');
      
      const parts = args.split('|').map(p => p.trim());
      const question = parts[0];
      const options = parts.slice(1);
      
      if (options.length < 2) {
        return message.reply('❌ Au moins 2 options!');
      }

      const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
      let description = `**${question}**\n\n`;
      options.forEach((opt, i) => {
        description += `${reactions[i]} ${opt}\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle('📊 Sondage')
        .setDescription(description)
        .setColor(0x2b2d31);

      const msg = await message.reply({ embeds: [embed] });
      for (let i = 0; i < options.length; i++) {
        await msg.react(reactions[i]);
      }
      return;
    }

    // ========== INVITE-INFO ==========
    if (message.content.startsWith('=invite-info')) {
      const inviteLink = message.content.slice(13).trim();
      if (!inviteLink) {
        const invites = await message.guild.invites.fetch();
        const embed = new EmbedBuilder()
          .setTitle('🔗 Invites du serveur')
          .setColor(0x2b2d31);
        
        let desc = '';
        invites.forEach(inv => {
          desc += `**${inv.code}** - ${inv.uses} utilisations\n`;
        });
        
        embed.setDescription(desc || 'Aucune invite');
        return message.reply({ embeds: [embed] });
      }
      
      try {
        const invite = await client.fetchInvite(inviteLink);
        const embed = new EmbedBuilder()
          .setTitle('🔗 Infos Invite')
          .addFields(
            { name: 'Serveur', value: invite.guild?.name || 'Inconnu', inline: true },
            { name: 'Code', value: invite.code, inline: true },
            { name: 'Utilisations', value: String(invite.uses || 0), inline: true },
            { name: 'Créée par', value: invite.inviter?.tag || 'Inconnu', inline: true }
          )
          .setColor(0x2b2d31);
        return message.reply({ embeds: [embed] });
      } catch (err) {
        return message.reply('❌ Invite invalide.');
      }
    }

    // ========== STATS ==========
    if (message.content.startsWith('=stats')) {
      const user = message.mentions.users.first() || message.author;
      const guildStats = getGuildStats(message.guildId);
      const userStats = guildStats.members[user.id] || { messages: 0, voiceTime: 0 };

      const embed = new EmbedBuilder()
        .setTitle(`📊 Stats - ${user.username}`)
        .addFields(
          { name: '💬 Messages', value: String(userStats.messages), inline: true },
          { name: '🎤 Temps vocal', value: `${Math.floor(userStats.voiceTime / 60)} min`, inline: true }
        )
        .setThumbnail(user.displayAvatarURL())
        .setColor(0x2b2d31);
      return message.reply({ embeds: [embed] });
    }

    // ========== TOP ==========
    if (message.content === '=top') {
      const guildStats = getGuildStats(message.guildId);
      const sorted = Object.entries(guildStats.members)
        .sort((a, b) => b[1].messages - a[1].messages)
        .slice(0, 10);

      let desc = '';
      sorted.forEach((entry, i) => {
        desc += `**${i + 1}.** <@${entry[0]}> - ${entry[1].messages} messages\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle('🏆 Top 10 Messages')
        .setDescription(desc || 'Aucune donnée')
        .setColor(0xffd700);
      return message.reply({ embeds: [embed] });
    }

    // ========== TOP-VOCAL ==========
    if (message.content === '=top-vocal') {
      const guildStats = getGuildStats(message.guildId);
      const sorted = Object.entries(guildStats.members)
        .sort((a, b) => b[1].voiceTime - a[1].voiceTime)
        .slice(0, 10);

      let desc = '';
      sorted.forEach((entry, i) => {
        desc += `**${i + 1}.** <@${entry[0]}> - ${Math.floor(entry[1].voiceTime / 60)} min\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle('🎤 Top 10 Temps Vocal')
        .setDescription(desc || 'Aucune donnée')
        .setColor(0x00ff00);
      return message.reply({ embeds: [embed] });
    }

    // ========== HELP ==========
    if (message.content.startsWith('=help')) {
      const args = message.content.slice(6).trim();
      const categoryKey = args || 'moderation';
      
      if (!HELP_CATEGORIES[categoryKey]) {
        const categories = Object.keys(HELP_CATEGORIES).join(', ');
        return message.reply(`❌ Catégorie inconnue!\n\nDisponibles: ${categories}`);
      }

      const embed = buildHelpEmbed(categoryKey);
      const row = buildHelpMenu(categoryKey);

      return message.reply({ embeds: [embed], components: [row] });
    }

    // ========== CONFESSION ==========
    if (message.content.startsWith('=confession')) {
      // Vérifier que c'est dans le bon salon
      if (message.channelId !== '1529827912977481759') {
        await message.author.send('❌ La commande `=confession` fonctionne que dans <#1529827912977481759>!').catch(() => {});
        return;
      }

      const confessionText = message.content.slice(12).trim();
      
      if (!confessionText) {
        await message.author.send('❌ Usage: `=confession <texte>`').catch(() => {});
        return;
      }

      try {
        const confessionChannel = await message.guild.channels.fetch('1529827912977481759');
        if (!confessionChannel) {
          await message.author.send('❌ Salon confession introuvable.').catch(() => {});
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('🤫 Confession Anonyme')
          .setDescription(confessionText)
          .setColor(0x8b0000)
          .setFooter({ text: 'Confession anonyme' })
          .setTimestamp();

        await confessionChannel.send({ embeds: [embed] });
        
        // Confirme en DM
        await message.author.send('✅ Ta confession a été postée anonymement!').catch(() => {});
        
        // Supprime le message original
        await message.delete().catch(() => {});
      } catch (err) {
        console.error('❌ Erreur confession:', err);
        await message.author.send('❌ Erreur lors de l\'envoi de la confession.').catch(() => {});
      }
    }

    // ========== COIN ==========
    if (message.content === '=coin') {
      const result = Math.random() < 0.5 ? '🪙 Pile!' : '🪙 Face!';
      const embed = new EmbedBuilder()
        .setTitle('Résultat du Coin')
        .setDescription(result)
        .setColor(result.includes('Pile') ? 0x808080 : 0xffd700);
      return message.reply({ embeds: [embed] });
    }

    // ========== SUGGEST ==========
    if (message.content.startsWith('=suggest')) {
      // Vérifier que c'est dans le bon salon
      if (message.channelId !== '1531600993115181066') {
        await message.author.send('❌ La commande `=suggest` fonctionne que dans <#1531600993115181066>!').catch(() => {});
        return;
      }

      const suggestion = message.content.slice(8).trim();
      
      if (!suggestion) {
        await message.author.send('❌ Usage: `=suggest <votre suggestion>`').catch(() => {});
        return;
      }

      try {
        const suggestChannel = await message.guild.channels.fetch('1531600993115181066');
        if (!suggestChannel) {
          await message.author.send('❌ Salon suggestions introuvable.').catch(() => {});
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('💡 Nouvelle Suggestion')
          .setDescription(suggestion)
          .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
          .setColor(0x2b2d31)
          .setFooter({ text: 'Votez avec les réactions!' })
          .setTimestamp();

        const msg = await suggestChannel.send({ embeds: [embed] });
        await msg.react('👍');
        await msg.react('👎');
        
        // Confirme en DM (privé)
        await message.author.send('✅ Ta suggestion a été postée dans #suggestions!').catch(() => {});
        
        // Supprime le message original
        await message.delete().catch(() => {});
      } catch (err) {
        console.error('❌ Erreur suggestion:', err);
        await message.author.send('❌ Erreur lors de l\'envoi de la suggestion.').catch(() => {});
      }
    }

    // ========== AFFINITÉ ==========
    if (message.content.startsWith('=affinité')) {
      const user = message.mentions.users.first();
      if (!user) {
        return message.reply('❌ Mentionne quelqu\'un: `=affinité @user`');
      }

      if (user.id === message.author.id) {
        return message.reply('❌ Tu ne peux pas vérifier l\'affinité avec toi-même!');
      }

      // Génère un score basé sur les IDs (toujours pareil pour les mêmes personnes)
      const combined = (BigInt(message.author.id) + BigInt(user.id)).toString();
      const score = Math.abs(parseInt(combined.slice(-3))) % 101;

      const hearts = '❤️'.repeat(Math.ceil(score / 10));
      
      const embed = new EmbedBuilder()
        .setTitle('💕 Affinité')
        .setDescription(`${message.author} & ${user}\n\n**${score}%** ${hearts}`)
        .setColor(score > 70 ? 0xff69b4 : score > 40 ? 0xffa500 : 0x808080);

      return message.reply({ embeds: [embed] });
    }

    // ========== PROFILE ==========
    if (message.content.startsWith('=profile')) {
      const user = message.mentions.users.first() || message.author;
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      
      const joined = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'N/A';
      const roles = member ? member.roles.cache.filter(r => r.id !== message.guildId).map(r => r.name).join(', ').slice(0, 100) || 'Aucun' : 'N/A';

      const guildStats = getGuildStats(message.guildId);
      const userStats = guildStats.members[user.id] || { messages: 0, voiceTime: 0 };

      const embed = new EmbedBuilder()
        .setTitle(`👤 Profil - ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 512 }))
        .addFields(
          { name: 'Pseudo', value: user.username, inline: true },
          { name: 'ID', value: user.id, inline: true },
          { name: 'Compte créé', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
          { name: 'A rejoint', value: joined, inline: true },
          { name: 'Rôles', value: roles, inline: false },
          { name: '💬 Messages', value: String(userStats.messages), inline: true },
          { name: '🎤 Temps vocal', value: `${Math.floor(userStats.voiceTime / 60)} min`, inline: true }
        )
        .setColor(0x2b2d31)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

  } catch (err) {
    logger.error("MESSAGE_CREATE", "Erreur lors du traitement d'un message", err);
  }
});

// ==========================================
// GESTION DES INTERACTIONS (slash commands + menus + boutons)
// ==========================================
client.on("interactionCreate", async (interaction) => {
  try {
    // ==========================================
    // SLASH COMMANDS : /ban /kick /mute /warn
    // ==========================================
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      
      logger.info("SLASH_COMMAND", `Commande /${commandName} exécutée`, {
        user: interaction.user.tag,
        server: interaction.guild.name
      });

      if (commandName === "ban") {
        const target = interaction.options.getMember("membre");
        const reason = interaction.options.getString("raison") || "Aucune raison précisée";

        if (!target) return interaction.reply({ content: "Membre introuvable.", flags: 64 });

        logger.warn("MODERATION", `Membre banni`, {
          target: target.user.tag,
          targetId: target.id,
          moderator: interaction.user.tag,
          reason: reason
        });

        await target.ban({ reason }).catch(() => {});
        if (logChannel) logChannel.send(`🔨 ${target} a été **banni** pour \`${reason}\``);
        await interaction.reply(`✅ ${target.user.tag} a été banni.`);
      }

      if (commandName === "kick") {
        const target = interaction.options.getMember("membre");
        const reason = interaction.options.getString("raison") || "Aucune raison précisée";

        if (!target) return interaction.reply({ content: "Membre introuvable.", flags: 64 });

        logger.warn("MODERATION", `Membre expulsé`, {
          target: target.user.tag,
          targetId: target.id,
          moderator: interaction.user.tag,
          reason: reason
        });

        await target.kick(reason).catch(() => {});
        if (logChannel) logChannel.send(`👢 ${target} a été **expulsé** pour \`${reason}\``);
        await interaction.reply(`✅ ${target.user.tag} a été expulsé.`);
      }

      if (commandName === "mute") {
        const target = interaction.options.getMember("membre");
        const minutes = interaction.options.getInteger("duree");
        const reason = interaction.options.getString("raison") || "Aucune raison précisée";

        if (!target) return interaction.reply({ content: "Membre introuvable.", flags: 64 });

        logger.warn("MODERATION", `Membre mute`, {
          target: target.user.tag,
          targetId: target.id,
          moderator: interaction.user.tag,
          duration: `${minutes}m`,
          reason: reason
        });

        await target.timeout(minutes * 60 * 1000, reason).catch(() => {});
        if (logChannel)
          logChannel.send(`🔇 ${target} a été **mute** pendant \`${minutes} min\` pour \`${reason}\``);
        await interaction.reply(`✅ ${target.user.tag} a été mute pour ${minutes} minutes.`);
      }

      if (commandName === "warn") {
        const target = interaction.options.getMember("membre");
        const reason = interaction.options.getString("raison");

        if (!target) return interaction.reply({ content: "Membre introuvable.", flags: 64 });
        
        logger.warn("MODERATION", `Avertissement donné`, {
          target: target.user.tag,
          targetId: target.id,
          moderator: interaction.user.tag,
          reason: reason
        });

        if (!warningsData[target.id]) warningsData[target.id] = [];
        warningsData[target.id].push({
          reason,
          date: Date.now(),
          moderator: interaction.user.tag,
        });
        saveWarnings();

        if (logChannel) logChannel.send(`⚠️ ${target} a été **averti** pour \`${reason}\``);
        target.send(`⚠️ Tu as reçu un avertissement sur **Haven** pour : ${reason}`).catch(() => {});
        await interaction.reply(`✅ ${target.user.tag} a été averti. (Total : ${warningsData[target.id].length} avertissement(s))`);
      }

      return;
    }

    // ==========================================
    // MENU D'AIDE (!aide) — changement de catégorie
    // ==========================================
    if (interaction.isStringSelectMenu() && interaction.customId === "help_menu") {
      const categoryKey = interaction.values[0];
      const embed = buildHelpEmbed(categoryKey);
      const row = buildHelpMenu(categoryKey);

      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    // ==========================================
    // MENUS DE RÔLES AUTO (genre / âge / situation)
    // ==========================================
    if (
      interaction.isStringSelectMenu() &&
      ["role_genre", "role_age", "role_situation"].includes(interaction.customId)
    ) {
      const category =
        interaction.customId === "role_genre"
          ? "genre"
          : interaction.customId === "role_age"
          ? "age"
          : "situation";

      const choice = interaction.values[0];
      const roleId = SELF_ROLES[category][choice];
      const member = interaction.member;

      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        await interaction.reply({ content: "❌ Rôle retiré.", flags: 64 });
      } else {
        const otherRoleIds = Object.values(SELF_ROLES[category]);
        await member.roles.remove(otherRoleIds).catch(() => {});
        await member.roles.add(roleId);
        await interaction.reply({ content: "✅ Rôle ajouté.", flags: 64 });
      }
      return;
    }

    // --- Sélection dans le menu de tickets ---
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
      const choice = interaction.values[0];
      const category = TICKET_CATEGORIES[choice];
      if (!category) return;

      const guild = interaction.guild;

      const existing = guild.channels.cache.find(
        (c) => c.topic === `ticket-${interaction.user.id}-${choice}`
      );
      if (existing) {
        return interaction.reply({
          content: `Tu as déjà un ticket ouvert ici : ${existing}`,
          ephemeral: true,
        });
      }

      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ];

      if (category.roleId) {
        permissionOverwrites.push({
          id: category.roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      const ticketChannel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKET_PARENT_CATEGORY_ID,
        topic: `ticket-${interaction.user.id}-${choice}`,
        permissionOverwrites,
      });

      const embed = new EmbedBuilder()
        .setTitle(`${category.emoji} ${category.label}`)
        .setDescription(
          `Bienvenue ${interaction.user} !\nUn membre de l'équipe va s'occuper de toi rapidement.\n\nDécris ta demande en détail ci-dessous.`
        )
        .setColor(0x2b2d31);

      const closeButton = new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Fermer le ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒");

      const row = new ActionRowBuilder().addComponents(closeButton);

      await ticketChannel.send({
        content: category.roleId ? `<@&${category.roleId}>` : "",
        embeds: [embed],
        components: [row],
      });

      await interaction.reply({
        content: `Ton ticket a été créé : ${ticketChannel}`,
        flags: 64,
      });
    }

    // --- Fermeture du ticket ---
    if (interaction.isButton() && interaction.customId === "ticket_close") {
      await interaction.reply("🔒 Ce ticket sera fermé dans 5 secondes...");
      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }

    // --- Réponse à la demande en mariage ---
    if (interaction.isButton() && interaction.customId.startsWith("marry_")) {
      const [, choice, targetId, authorId] = interaction.customId.split("_");

      if (interaction.user.id !== targetId) {
        return interaction.reply({
          content: "Ce n'est pas ton choix à faire !",
          ephemeral: true,
        });
      }

      if (choice === "yes") {
        if (marriagesData[targetId] || marriagesData[authorId]) {
          return interaction.update({
            content: "❌ Trop tard, l'un de vous deux est déjà marié entre-temps !",
            components: [],
          });
        }

        marriagesData[targetId] = authorId;
        marriagesData[authorId] = targetId;
        saveMarriages();

        await interaction.update({
          content: `💍 ${interaction.user} a dit oui ! Félicitations à <@${authorId}> et <@${targetId}> !! 🎉`,
          components: [],
        });
      } else {
        await interaction.update({
          content: `💔 ${interaction.user} a refusé la demande de <@${authorId}>... courage.`,
          components: [],
        });
      }
      return;
    }

    // --- Choix Pierre-Feuille-Ciseaux ---
    if (interaction.isButton() && interaction.customId.startsWith("rps_")) {
      const [, gameId, choice] = interaction.customId.split("_");
      const game = rpsGames.get(gameId);

      if (!game) {
        return interaction.reply({ content: "Cette partie a expiré !", ephemeral: true });
      }
      if (!game.players.includes(interaction.user.id)) {
        return interaction.reply({ content: "Tu ne fais pas partie de cette partie !", ephemeral: true });
      }
      if (game.choices[interaction.user.id]) {
        return interaction.reply({ content: "Tu as déjà choisi !", ephemeral: true });
      }

      game.choices[interaction.user.id] = choice;
      await interaction.reply({ content: `Tu as choisi ${choice} !`, ephemeral: true });

      const [p1, p2] = game.players;
      if (game.choices[p1] && game.choices[p2]) {
        const beats = { pierre: "ciseaux", feuille: "pierre", ciseaux: "feuille" };
        const c1 = game.choices[p1];
        const c2 = game.choices[p2];

        let resultText;
        if (c1 === c2) {
          resultText = "🤝 Égalité !";
        } else if (beats[c1] === c2) {
          resultText = `🏆 <@${p1}> gagne !`;
        } else {
          resultText = `🏆 <@${p2}> gagne !`;
        }

        rpsGames.delete(gameId);

        await interaction.message.edit({
          content:
            `🎮 Partie terminée !\n\n` +
            `<@${p1}> a choisi **${c1}**\n<@${p2}> a choisi **${c2}**\n\n${resultText}`,
          components: [],
        });
      }
      return;
    }

    // --- Coups du morpion (état encodé directement dans le customId) ---
    if (interaction.isButton() && interaction.customId.startsWith("ttt_")) {
      const [, board, playerX, playerO, turn, cellStr] = interaction.customId.split("_");
      const cell = parseInt(cellStr);
      const expectedPlayer = turn === "X" ? playerX : playerO;

      if (interaction.user.id !== expectedPlayer) {
        return interaction.reply({ content: "Ce n'est pas ton tour !", ephemeral: true });
      }

      const newBoard = board.slice(0, cell) + turn + board.slice(cell + 1);
      const winner = checkTttWinner(newBoard);

      if (winner) {
        const rows = buildTttRows(newBoard, playerX, playerO, turn, true);
        const resultText =
          winner === "draw"
            ? "🤝 Match nul !"
            : `🏆 <@${winner === "X" ? playerX : playerO}> (${winner}) a gagné !`;
        await interaction.update({ content: resultText, components: rows });
        return;
      }

      const nextTurn = turn === "X" ? "O" : "X";
      const nextPlayer = nextTurn === "X" ? playerX : playerO;
      const rows = buildTttRows(newBoard, playerX, playerO, nextTurn);

      await interaction.update({
        content: `❌⭕ Au tour de <@${nextPlayer}> (${nextTurn}) !`,
        components: rows,
      });
      return;
    }

    // --- Réponse à une demande =join ---
    if (interaction.isButton() && interaction.customId.startsWith("vcjoin_")) {
      const [, choice, requesterId, channelId] = interaction.customId.split("_");
      const entry = tempVoiceChannels.get(channelId);

      if (!entry || interaction.user.id !== entry.ownerId) {
        return interaction.reply({ content: "Ce n'est pas ton choix à faire !", ephemeral: true });
      }

      const channel = interaction.guild.channels.cache.get(channelId);

      if (choice === "yes") {
        const requester = await interaction.guild.members.fetch(requesterId).catch(() => null);
        if (requester && requester.voice.channelId && channel) {
          await channel.permissionOverwrites.edit(requesterId, { Connect: true }).catch(() => {});
          await requester.voice.setChannel(channel).catch(() => {});
        }
        await interaction.update({
          content: `✅ ${interaction.user} a accepté <@${requesterId}> dans son salon.`,
          components: [],
        });
      } else {
        await interaction.update({
          content: `❌ ${interaction.user} a refusé la demande de <@${requesterId}>.`,
          components: [],
        });
      }
      return;
    }

    // --- Réponse au doro ---
    if (interaction.isButton() && interaction.customId.startsWith("doro_")) {
      const [, choice, targetId, authorId] = interaction.customId.split("_");

      if (interaction.user.id !== targetId) {
        return interaction.reply({
          content: "Ce n'est pas ton choix à faire !",
          ephemeral: true,
        });
      }

      if (choice === "yes") {
        const attachment = new AttachmentBuilder(path.join(__dirname, "./doro-oui.gif"));
        await interaction.update({
          content: `${interaction.user} a accepté de doro avec <@${authorId}> !!`,
          components: [],
          files: [attachment],
        });
      } else {
        const attachment = new AttachmentBuilder(path.join(__dirname, "./doro-non.gif"));
        await interaction.update({
          content: `${interaction.user} ne veut pas doro avec <@${authorId}>.. tu trouveras mieux`,
          components: [],
          files: [attachment],
        });
      }
    }
  } catch (err) {
    logger.error("INTERACTION", "Erreur lors du traitement d'une interaction", err);
  }
});

// ==========================================
// EVENT: messageDelete (pour snipe)
// ==========================================
client.on('messageDelete', (message) => {
  if (message.author.bot) return;
  if (!snipeCache.has(message.guildId)) {
    snipeCache.set(message.guildId, []);
  }
  
  const cache = snipeCache.get(message.guildId);
  cache.push({
    author: message.author.username,
    avatar: message.author.displayAvatarURL(),
    content: message.content || '(Pas de texte)',
  });
  
  if (cache.length > MAX_SNIPE) cache.shift();
});

// ==========================================
// EVENT: voiceStateUpdate (pour tracker temps vocal)
// ==========================================
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.member.id;
  const guildStats = getGuildStats(newState.guild.id);
  
  if (!guildStats.members[userId]) {
    guildStats.members[userId] = { messages: 0, voiceTime: 0 };
  }

  // Quand quelqu'un REJOINT un vocal
  if (!oldState.channel && newState.channel) {
    guildStats.members[userId].voiceJoinTime = Date.now();
    logger.debug("VOICE", `${newState.member.user.tag} a rejoint le vocal`, {
      channelName: newState.channel.name,
      guild: newState.guild.name
    });
  }

  // Quand quelqu'un QUITTE un vocal
  if (oldState.channel && !newState.channel) {
    if (guildStats.members[userId].voiceJoinTime) {
      const timeSpent = Date.now() - guildStats.members[userId].voiceJoinTime;
      guildStats.members[userId].voiceTime += timeSpent;
      saveStats(statsData);
      logger.debug("VOICE", `${newState.member.user.tag} a quitté le vocal`, {
        channelName: oldState.channel.name,
        timeSpentSeconds: Math.floor(timeSpent / 1000),
        guild: newState.guild.name
      });
    }
  }
});

// ==========================================
// EVENT: BOT PRÊT - Créer les salons vocaux
// ==========================================
client.on('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  logger.info("BOT", `✅ Bot connecté en tant que ${client.user.tag}`);

  try {
    const guild = client.guilds.cache.first();
    console.log(`📍 Serveur trouvé: ${guild ? guild.name : 'AUCUN'}`);
    
    if (!guild) {
      console.log("❌ Aucun serveur trouvé!");
      logger.warn("BOT", "Aucun serveur trouvé");
      return;
    }

    console.log(`🔍 Cherche la catégorie '📊'...`);
    
    // Chercher la catégorie "📊"
    let statsCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '📊');
    
    if (!statsCategory) {
      console.log("📁 Catégorie '📊' non trouvée, création...");
      logger.warn("BOT", "Catégorie '📊' non trouvée, création...");
      statsCategory = await guild.channels.create({
        name: '📊',
        type: ChannelType.GuildCategory,
      });
      console.log(`✅ Catégorie '📊' créée!`);
    } else {
      console.log(`✅ Catégorie '📊' trouvée!`);
    }

    console.log(`🎙️ Création des salons vocaux...`);
    
    // Créer/Récupérer salon vocal 1: "👥 Total : [nombre]"
    let totalVocal = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name.startsWith('👥 Total'));
    
    if (!totalVocal) {
      console.log(`📢 Création salon '👥 Total'...`);
      totalVocal = await guild.channels.create({
        name: `👥 Total : ${guild.memberCount}`,
        type: ChannelType.GuildVoice,
        parent: statsCategory.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ['Connect'],
            allow: ['ViewChannel', 'Speak', 'Stream', 'UseVAD'],
          },
          {
            id: guild.ownerId,
            allow: ['Connect', 'ViewChannel', 'Speak'],
          }
        ],
      });
      console.log(`✅ Salon vocal '👥 Total' créé!`);
      logger.info("BOT", "Salon vocal '👥 Total' créé");
    } else {
      console.log(`✅ Salon '👥 Total' existe déjà!`);
      // Mettre à jour les permissions si le salon existe
      await totalVocal.permissionOverwrites.set([
        {
          id: guild.id,
          deny: ['Connect'],
          allow: ['ViewChannel', 'Speak', 'Stream', 'UseVAD'],
        },
        {
          id: guild.ownerId,
          allow: ['Connect', 'ViewChannel', 'Speak'],
        }
      ]);
    }

    // Créer/Récupérer salon vocal 2: "🧷・.gg/haven"
    let inviteVocal = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name.includes('.gg/haven'));
    
    if (!inviteVocal) {
      console.log(`📢 Création salon '🧷・.gg/haven'...`);
      inviteVocal = await guild.channels.create({
        name: '🧷・.gg/haven',
        type: ChannelType.GuildVoice,
        parent: statsCategory.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ['Connect'],
            allow: ['ViewChannel', 'Speak', 'Stream', 'UseVAD'],
          },
          {
            id: guild.ownerId,
            allow: ['Connect', 'ViewChannel', 'Speak'],
          }
        ],
      });
      console.log(`✅ Salon vocal '🧷・.gg/haven' créé!`);
      logger.info("BOT", "Salon vocal '🧷・.gg/haven' créé");
    } else {
      console.log(`✅ Salon '🧷・.gg/haven' existe déjà!`);
      // Mettre à jour les permissions si le salon existe
      await inviteVocal.permissionOverwrites.set([
        {
          id: guild.id,
          deny: ['Connect'],
          allow: ['ViewChannel', 'Speak', 'Stream', 'UseVAD'],
        },
        {
          id: guild.ownerId,
          allow: ['Connect', 'ViewChannel', 'Speak'],
        }
      ]);
    }

    console.log(`✅ Tous les salons vocaux configurés!`);
    logger.info("BOT", "Salons vocaux configurés avec succès");
  } catch (err) {
    console.error(`❌ ERREUR: ${err.message}`);
    console.error(err);
    logger.error("BOT", "Erreur lors de la création des salons vocaux", err);
  }

  // Update le nombre de gens en ligne toutes les 30 secondes
  setInterval(async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) return;

      const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
      const totalVocal = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name.startsWith('👥 Total'));
      
      if (totalVocal) {
        await totalVocal.setName(`👥 Total : ${onlineMembers}`);
      }
    } catch (err) {
      console.error(`❌ Erreur update: ${err.message}`);
      logger.debug("BOT", "Erreur lors de l'update du nombre en ligne", err.message);
    }
  }, 30000); // Toutes les 30 secondes
});

logger.info("BOT", "Tentative de connexion au serveur Discord...");
client.login(process.env.DISCORD_TOKEN).catch(err => {
  logger.error("BOT", "Erreur lors de la connexion au serveur Discord", err);
  process.exit(1);
});
