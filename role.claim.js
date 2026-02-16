var basic = require("role.basic");

const signMessage = "Zenga was here - Spawn More Overlords";


var roleClaim = {

    /** @param {Creep} creep **/
    run: function (creep) {
        if (!basic.moveToRoom(creep))
            return;

        var target = creep.room.controller;

        if (!target)
            return;

        if (target.upgradeBlocked)
            return;


        if (!creep.pos.isNearTo(target.pos)) {
            var err = creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });

            if (err != OK) {
                console.log(creep.room.name, " ", creep.name, " move err" + err);
            }
            return;
        }

        var err;

        if(target.reservation && target.reservation.username != "Zenga") {
            err = creep.claimController(target);
        } else if (target.owner) {
            err = creep.attackController(target);
        } else {
            err = creep.claimController(target);
        }
        if (OK == err) {
            creep.signController(target, signMessage);
        }
        else {
            console.log(creep.room.name, " ", creep.name, " claim err" + err);
        }

    }
}

module.exports = roleClaim;