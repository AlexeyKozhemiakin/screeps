var basic = require("role.basic");
var roleReserve = {

    /** @param {Creep} creep **/
    run: function (creep) {
        if (basic.leaveDangerousRoom(creep))
            return;

        if (!basic.moveToRoom(creep)) {
            return;
        }

        var target = creep.room.controller;

        if (target) {
            //creep.signController(creep.room.controller, "Zenga is here - Spawn More Overlords");

            if(!creep.pos.isNearTo(target))
            {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
                return;
            }

            var code = OK;

            if (target.reservation && target.reservation.username != creep.owner.username)
                code = creep.attackController(target);
            else
                code = creep.reserveController(target);

            if (OK != code) {
                console.log("reserve" + code);
            }
        }
    }
}

module.exports = roleReserve;