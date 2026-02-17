var basic = require("role.basic");
var attack = require("role.attack");
const ROOM_SIGN_MESSAGE = "Zenga was here - Spawn More Overlords";

var roleScout = {

    /** @param {Creep} creep **/
    run: function (creep) {
        if (!basic.moveToRoom(creep))
            return;

        var target = creep.room.controller;
        if (!target) {
            creep.say("NoCtrl");
            return;
        }

        if (creep.room.controller.sign == null || creep.room.controller.sign.text != ROOM_SIGN_MESSAGE) {
            var err = creep.signController(target, ROOM_SIGN_MESSAGE);

            if (err == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
            }
            else if (OK != err) {
                console.log("sign error " + err);
            }
        }
        else {

            if (creep.pos.isNearTo(target)) {
                var path = creep.pos.findPathTo(target.pos, { ignoreCreeps: true });

                const directionOpposites = {
                    [TOP]: BOTTOM,
                    [TOP_RIGHT]: BOTTOM_LEFT,
                    [RIGHT]: LEFT,
                    [BOTTOM_RIGHT]: TOP_LEFT,
                    [BOTTOM]: TOP,
                    [BOTTOM_LEFT]: TOP_RIGHT,
                    [LEFT]: RIGHT,
                    [TOP_LEFT]: BOTTOM_RIGHT
                };

                var oppositeDir = directionOpposites[path[0].direction];

                console.log("oppositeDir ", oppositeDir, " creep ", creep.name);
                creep.move(oppositeDir)
            }
        }

    }
}

module.exports = roleScout;