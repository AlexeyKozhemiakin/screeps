var basic = require("role.basic");
var roleReserve = {

    /** @param {Creep} creep **/
    run: function (creep) {
        var target;

        if (!basic.moveToRoom(creep)) {
            return;
        }

        /*
        var needReserve = function (roomName) 
        {
            var room = Game.rooms[roomName];
            return true;
        }
        
        var targetRoom =_.filter(creep.memory.toGo, needReserve)[0];
        */

        var target = creep.room.controller;

        if (target) {
            creep.signController(creep.room.controller, "Zenga is here - Spawn More Overlords");

            var code = OK;

            if (target.reservation && target.reservation.username != creep.owner.username)
                code = creep.attackController(target);
            else
                code = creep.reserveController(target);

            if (OK == code) {
                //creep.say(target.reservation.ticksToEnd);
            }
            else if (code == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
            }
            else {
                console.log("reserve" + code);
            }
        }
        else {
            //console.log("controller not visible yet", targetRoom);
            creep.signController(creep.room.controller, "Zenga is here - Spawn More Overlords");
            //creep.moveTo(new RoomPosition(10, 10, "W59S36"),{visualizePathStyle: {stroke: '#ff00f0'}})
            // should not happen;   
        }
    }
}

module.exports = roleReserve;