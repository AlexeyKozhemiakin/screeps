var roleHarvester = require('role.harvester');
var roleDepositHarvester = require('role.depositHarvester');
var roleMineralHarvester = require('role.mineralHarvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleDeliverer = require('role.deliverer');
var roleClaim = require('role.claim');
var roleAttack = require('role.attack');
var roleReserve = require('role.reserve');
var roleScout = require('role.scout');

roomProcess = {
    roomMove: function (room, addCpuValue) {

        var profileStep = function (label, cpuStart) {
            if (!addCpuValue)
                return;

            addCpuValue('roomProcess.' + label, Game.cpu.getUsed() - cpuStart);
        };

        var cpuStep = Game.cpu.getUsed();

        var funcMap = {
            'harvester': roleHarvester,
            'depositHarvester': roleDepositHarvester,
            'upgrader': roleUpgrader,
            'builder': roleBuilder,
            'deliverer': roleDeliverer,
            'delivererLight': roleDeliverer,
            'claim': roleClaim,
            'reserve': roleReserve,
            'mineralHarvester': roleMineralHarvester,
            'attack': roleAttack,
            'healer': roleAttack,
            'scout': roleScout,
        }
        profileStep('funcMap', cpuStep);

        cpuStep = Game.cpu.getUsed();
        var roomCreeps = _.filter(Game.creeps, c => c.room.name == room.name);
        profileStep('filterRoomCreeps', cpuStep);

        cpuStep = Game.cpu.getUsed();
        var roleCpu = {};

        for (var creepId in roomCreeps) {
            var creep = roomCreeps[creepId];
            if (creep.spawning)
                continue;

            try {
                var role = creep.memory.role;
                var obj = funcMap[role];

                var roleCpuStart = Game.cpu.getUsed();

                obj.run(creep);

                var roleDelta = Game.cpu.getUsed() - roleCpuStart;
                roleCpu[role] = (roleCpu[role] || 0) + roleDelta;
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

        profileStep('runCreeps', cpuStep);

        if (addCpuValue) {
            for (var roleName in roleCpu) {
                addCpuValue('roomProcess.role.' + roleName, roleCpu[roleName]);
            }
        }
    }
};

module.exports = roomProcess;
