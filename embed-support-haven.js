const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

/**
 * Envoie l'embed d'information support dans le salon fourni.
 * @param {import("discord.js").TextChannel} channel
 */
async function sendSupportEmbed(channel) {
  const embed = new EmbedBuilder()
    .setTitle("📩 Support Haven")
    .setDescription(
      "Bienvenue dans le salon d'informations support !\n\n" +
      "**Comment ouvrir un ticket ?**\n" +
      "> Rendez-vous dans le salon dédié et utilisez le menu déroulant pour sélectionner la catégorie correspondant à votre demande.\n\n" +
      "**Catégories disponibles :**\n" +
      "🎓 **Gestion Staff** — Devenir staff, rankup ou récupérer des rôles\n" +
      "🛡️ **Gestion Abus** — Conflit ou problème avec un staff/membre\n" +
      "🎪 **Animation** — Idées d'animations ou rejoindre l'équipe\n" +
      "🤝 **Community Manager** — Demande de partenariat avec Haven\n\n" +
      "*L'assistance est disponible 24h/24 et 7j/7.*"
    )
    .setColor(0x2b2d31)
    .setFooter({ text: "Haven Support • Ticket system" })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("❌ Erreur lors de l'envoi de l'embed support :", err);
  }
}

module.exports = { sendSupportEmbed };
