var roleHarvester = require('role.harvester');
var roleMineralHarvester = require('role.mineralHarvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleDeliverer = require('role.deliverer');
var roleClaim = require('role.claim');
var roleAttack = require('role.attack');
var roleReserve = require('role.reserve');
var roleScout = require('role.scout');

roomProcess = {
    roomMove: function (room) {

        var funcMap = {
            'harvester': roleHarvester,
            'upgrader': roleUpgrader,
            'builder': roleBuilder,
            'deliverer': roleDeliverer,
            'delivererLight': roleDeliverer,
            'claim': roleClaim,
            'reserve': roleReserve,
            'mineralHarvester': roleMineralHarvester,
            'attack': roleAttack,
            'scout': roleScout,
        }

        var roomCreeps = _.filter(Game.creeps, c => c.room.name == room.name);

        for (var creepId in roomCreeps) {
            var creep = roomCreeps[creepId];
            if (creep.spawning)
                continue;

            try {
                var role = creep.memory.role;
                var obj = funcMap[role];

                obj.run(creep);
            }
            catch (err) {
                const errorInfo = {
                    room: room.name,
                    creep: creep.name,
                    role: creep.memory.role,
                    message: err.message || err.toString(),
                    fileName: err.fileName,
                    lineNumber: err.lineNumber,
                    stack: err.stack
                };

                console.log("  room:", errorInfo.room);
                console.log("  creep:", errorInfo.creep);
                console.log("  role:", errorInfo.role);
                console.log("  message:", errorInfo.message);
                console.log("  fileName:", errorInfo.fileName);
                console.log("  lineNumber:", errorInfo.lineNumber);
                console.log("  stack:", errorInfo.stack);

                creep.memory.err = err.toString ? err.toString() : String(err);

            }
        }
    }
};

module.exports = roomProcess;
