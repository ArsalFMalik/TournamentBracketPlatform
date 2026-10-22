const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const gameTypes = [
        { name: 'Basketball', scoringFormat: 'single_score', config: null },
        { name: 'Football', scoringFormat: 'single_score', config: null },
        { name: 'Counter-Strike', scoringFormat: 'single_score', config: null },
        { name: 'Valorant', scoringFormat: 'single_score', config: null },
        { name: 'Chess', scoringFormat: 'binary_result', config: null },
        { name: 'Tekken', scoringFormat: 'binary_result', config: null },
        { name: 'Volleyball', scoringFormat: 'target_score', config: { defaultTarget: 25, defaultWinBy: 2 } },
        { name: 'Table Tennis', scoringFormat: 'target_score', config: { defaultTarget: 11, defaultWinBy: 2 } },
    ];

    for (const game of gameTypes) {
        const existing = await prisma.gameType.findFirst({
            where: { name: game.name, isCustom: false },
        });
        if (existing) {
            await prisma.gameType.update({
                where: { id: existing.id },
                data: { scoringFormat: game.scoringFormat, config: game.config },
            });
        } else {
            await prisma.gameType.create({ data: game });
        }
    }

    console.log('Game types seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });