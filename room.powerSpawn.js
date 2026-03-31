module.exports = {

    run: function (room) {
        if (!room)
            return;
        if (!room.controller || !room.controller.my)
            return;

        var powerSpawn = room.powerSpawn;

        if (!powerSpawn || !powerSpawn.isActive())
            return;

        if ((powerSpawn.store[RESOURCE_POWER] || 0) <= 0) {
            return;
        }

        if ((powerSpawn.store[RESOURCE_ENERGY] || 0) < POWER_SPAWN_ENERGY_RATIO)
            return;

        const RICH_ROOM_ENERGY_THRESHOLD = 30000;
        if(room.storage && room.storage.store[RESOURCE_ENERGY] < RICH_ROOM_ENERGY_THRESHOLD)
            return;

        powerSpawn.processPower();
    }
};