# Haven Discord Bot

A feature-rich Discord bot for the **Haven** server, written in JavaScript (discord.js v14).

## Features

- 🛡️ **Modération** — ban, kick, mute, warn, clear, purge, lock, slowmode, blacklist
- 🎟️ **Tickets** — système de tickets catégorisés (staff, abus, animation, partenariat)
- 🎉 **Bienvenue** — message de bienvenue avec GIF lors de l'arrivée d'un membre
- 📊 **Niveaux / XP** — système d'expérience avec annonce de level-up
- 💍 **Mariage & Ships** — commandes sociales (!marier, !ship, !divorce)
- 🔊 **Voicemaster** — salons vocaux temporaires
- 🚨 **Anti-raid** — détection et protection automatique contre les raids
- 📋 **Logs** — journalisation dans des salons dédiés (messages, modération, membres, etc.)
- 🎮 **Fun** — !8ball, !blague, !snipe, !roulette, !doro, !confess, !leash
- 📈 **Stats** — suivi du temps vocal et des messages par membre

## Project Structure

```
index.js                 — fichier principal du bot
embed-support-haven.js   — embed d'information support
blacklist.json           — (auto-généré) liste noire des membres
stats.json               — (auto-généré) statistiques des membres
levels.json              — (auto-généré) données XP/niveaux
marriages.json           — (auto-généré) données de mariages
ships.json               — (auto-généré) données de ships
leashes.json             — (auto-généré) données de laisses
warnings.json            — (auto-généré) avertissements
confessions.json         — (auto-généré) compteur de confessions
```

## Asset Files Required

Place these GIF files in the project root:
- `welcome.gif` — affiché lors de l'arrivée d'un nouveau membre
- `levelup.gif` — affiché lors d'un passage de niveau
- `reglement.gif` — affiché avec la commande `!reglement`
- `doro-oui.gif` — affiché quand la commande !doro est acceptée
- `doro-non.gif` — affiché quand la commande !doro est refusée

## Environment Variables

- `DISCORD_TOKEN` — Token du bot Discord (stocké en secret Replit)

## Running

The bot starts with `node index.js`. Configure the workflow to use this command.

## User Preferences

- Language: French (bot comments/logs are in French)
