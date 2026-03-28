var basic = require("role.basic");
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

            basic.stepOutOf(creep, target);
        }
    }
}

module.exports = roleScout;