//var profiler = require('screeps-profiler');



var roleBasic = {
    moveToRoom: function (creep, roomToGo = undefined) {
        if (!roomToGo && creep.memory.toGo)
            roomToGo = creep.memory.toGo[0];
        
        if(!roomToGo)
            return true;

        if (roomToGo == creep.room.name) {
            //console.log(creep.name, " in the room");
            if (creep.pos.x == 0)
                creep.move(RIGHT);
            else if (creep.pos.x == 49)
                creep.move(LEFT);
            else if (creep.pos.y == 0)
                creep.move(BOTTOM);
            else if (creep.pos.y == 49)
                creep.move(TOP);

            return true;
        }

        var moveTarget;

        //var flag = creep.pos.findClosestByRange(FIND_FLAGS, {
        //            filter: flag => (flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_ORANGE)
        //       });

        // Use runtime cache for routes (NOT Memory) because Game.map.findRoute() returns
        // RoomPosition objects which cannot be serialized
        if (!roleBasic._routeCache)
            roleBasic._routeCache = {};

        var cacheKey = creep.room + roomToGo;
        var route = roleBasic._routeCache[cacheKey];
        // this was for case when there were consturcted walls on the way
        var roomsToAvoid = ["E52S24", "E54S23"];

        if (!route) {
            route = Game.map.findRoute(creep.room, roomToGo, {
                routeCallback(roomName) {

                    if (roomsToAvoid.includes(roomName))
                        return Infinity;

                    // W10N40
                    var roomRegex = /([WE])(\d+)([NS])(\d+)/;
                    var match = roomName.match(roomRegex);
                    var x = match ? parseInt(match[2]) : 0;
                    var y = match ? parseInt(match[4]) : 0;

                    //console.log(creep.name, roomName, x, y);

                    // to avoid center rooms
                    x %= 10;
                    y %= 10;
                    if ((x == 4 || x == 5 || x == 6) && (y == 4 || y == 5 || y == 6))
                        return Infinity;

                    return 1;
                }
            });
            roleBasic._routeCache[cacheKey] = route;
        }

        //console.log(creep.name, " route to ", roomToGo, ":", JSON.stringify(route));
        const exitDir = Game.map.findExit(creep.room, route[0].room);
        moveTarget = creep.pos.findClosestByPath(exitDir, { ignoreCreeps: true });

        if (creep.fatigue > 0)
            return false;

        var code = creep.moveTo(moveTarget, { visualizePathStyle: { stroke: '#ff0000' } });
        if (code != OK)
            console.log("err", code, " creep move to ", creep.name, " to ", roomToGo, " target ", moveTarget);


        // very strange case when creep is at the edge but exitDir doesn't return proper target
        // happens when multiple creeps exist
        if (code == ERR_NO_PATH)
            code = creep.moveTo(5, 5);

        //console.log(creep.name, " moving to room ", roomToGo, " code ", code);

        creep.say("Go" + roomToGo);

        return false;
    },

    recycleCreep: function (creep) {
        
        var spawn = creep.room.spawn;
        if (!spawn) {
            if(creep.memory.motherland)
                this.moveToRoom(creep, creep.memory.motherland);
            
            return;
        }

        creep.say("recycle");        
        
        if (creep.pos.inRangeTo(spawn, 1)) {
            var code = spawn.recycleCreep(creep);
        }
        else {
            creep.moveTo(creep.room.spawn);
        }
    },

    goTo: function (creep, target, r = 1, stroke = '#ffffff') {

        // we start from far away and try to ignore creeps, if we got stuck we retry
        // closer we go the more we care about creeps
        var range = creep.pos.getRangeTo(target);
        var err = undefined;

        if (range > 10) {
            err = creep.moveTo(target, {
                visualizePathStyle: { stroke: stroke },
                ignoreCreeps: false, range: r
            });

            if (err == ERR_NO_PATH) {
                err = creep.moveTo(target, {
                    visualizePathStyle: { stroke: stroke },
                    range: r,
                    ignoreCreeps: false
                });
            }
            else {
                if (err != OK)
                    creep.say(err);
            }
        }
        else if (range > 4) {
            err = creep.moveTo(target, {
                visualizePathStyle: { stroke: stroke },
                ignoreCreeps: false, range: r
            });

        }
        else {
            err = creep.moveTo(target, {
                visualizePathStyle: { stroke: stroke },
                ignoreCreeps: false
            });
        }
        return err;

    },

    runDropped: function (creep, range, resType, limit = 0) {

        if (creep.store.getFreeCapacity() == 0)
            return;

  
        var fRes = (res) => { return res.resourceType == resType && res.amount > limit; }
        if (!resType)
            fRes = (res) => { return res.amount > limit; }

        var dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, { filter: fRes });

        if (dropped == undefined) {
            var fTomb = (tomb) => { return tomb.store[resType] > limit; };
            if (!resType)
                fTomb = (tomb) => { return _.sum(tomb.store) > limit; };

            dropped = creep.pos.findClosestByRange(FIND_TOMBSTONES, { filter: fTomb });
        }

        var rangeToDrop = creep.pos.getRangeTo(dropped);
        //if(range > 1)
        //console.log("range", rangeToDrop , dropped, "rangeLimit", range, "creep.room", creep.room);
        if (!dropped || rangeToDrop > range) {
            return false;
        }

        //creep.say("see drop");
        //console.log("see drop" + " " + dropped + " " + dropped.amount + " " + dropped.room.name + " " + dropped.pos.x + " " + dropped.pos.y);

        var err;
        if (dropped instanceof Resource)
            err = creep.pickup(dropped);
        else if (dropped instanceof Tombstone) {
            if (resType == undefined) {
                var keys = _.findKey(dropped.store, f => f > 0);
                if (keys)
                    resType = keys;
            }
            err = creep.withdraw(dropped, resType);
        }
        else
            console.log("typeof dropped ", typeof dropped);

        if (err == OK) {
            creep.say("picked");
        }
        else if (err == ERR_NOT_IN_RANGE) {
            if (creep.fatigue == 0) {
                var err1 = creep.moveTo(dropped, { visualizePathStyle: { stroke: '#ff0000' } });
            }
        }
        else
            creep.say("oo1" + err);

        return true;
    }
    ,
    findSource: function (creep) {
        if (creep.memory.preferredSourceId) {
            return Game.getObjectById(creep.memory.preferredSourceId);
        }
        else {
            var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

            // stick creep to the source to avoid switching like headless chicken
            if (source)
                creep.memory.preferredSourceId = source.id;

            return source;
        }
    },
    runRenew: function (creep) {
        var spawn = creep.room.spawn;
        if (!spawn) {
            return;
        }

        // magic number from API reference
        var toRegen = Math.floor(600 / creep.body.length);
        if (creep.ticksToLive > CREEP_LIFE_TIME - toRegen)
            return;

        creep.say("renew");
        if (creep.pos.isNearTo(spawn)) {
            var code = spawn.renewCreep(creep);
            if (code != OK)
                creep.say("rn " + code);
        }
        else {
            creep.moveTo(creep.room.spawn);
        }
    },

    repairEmergency: function (creep, range = 1) {
        var N = 0.5;
        if(creep.store.energy < 20)
            return false;

        // Find all damaged roads/containers in the room, then filter by range
        var damagedBuild = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s =>
                (s.structureType == STRUCTURE_ROAD || s.structureType == STRUCTURE_CONTAINER) &&
                s.hits < s.hitsMax * N &&
                creep.pos.getRangeTo(s) <= range
        });

        if (damagedBuild)
            console.log("repairEmergency ", creep.name, creep.room.name, " found ",
                damagedBuild, " damaged in range ", range);

        if (!damagedBuild)
            return false;

        if (!creep.pos.isNearTo(damagedBuild)) {
            creep.moveTo(damagedBuild);
            return true;
        }

        creep.repair(damagedBuild);
        return true;
    }

};
//profiler.registerObject(roleBasic, 'basic');
module.exports = roleBasic;