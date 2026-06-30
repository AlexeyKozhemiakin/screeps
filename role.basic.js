//var profiler = require('screeps-profiler');



var roleBasic = {
    portalAvoidRange: 3,
    roomsToAvoid: ["E54S21", "E48S21", //"E51S21",
    "E51S31",
        //"E56S25" //invader
        
        "E57S26", "E58S27", "E56S28", "E56S29", "E54S29",
        "E53S28"

    ],

    getRouteWeight: function (roomName) {
        if (this.roomsToAvoid.indexOf(roomName) != -1)
            return Infinity;

        var roomRegex = /([WE])(\d+)([NS])(\d+)/;
        var match = roomName.match(roomRegex);
        var x = match ? parseInt(match[2]) : 0;
        var y = match ? parseInt(match[4]) : 0;

        // to avoid center rooms
        x %= 10;
        y %= 10;
        if ((x == 4 || x == 5 || x == 6) && (y == 4 || y == 5 || y == 6))
            return 7;

        // prefer highways
        if (x == 0 || y == 0)
            return 1;

        return 2;
    },

    getTargetPos: function (target) {
        if (!target)
            return undefined;

        if (target.pos)
            return target.pos;

        if (target.x != undefined && target.y != undefined && target.roomName)
            return target;

        return undefined;
    },

    getPositionByDirection: function (pos, direction) {
        if (!pos)
            return undefined;

        var deltas = {
            1: { x: 0, y: -1 },
            2: { x: 1, y: -1 },
            3: { x: 1, y: 0 },
            4: { x: 1, y: 1 },
            5: { x: 0, y: 1 },
            6: { x: -1, y: 1 },
            7: { x: -1, y: 0 },
            8: { x: -1, y: -1 }
        };

        var delta = deltas[direction];
        if (!delta)
            return undefined;

        var x = pos.x + delta.x;
        var y = pos.y + delta.y;

        if (x < 0 || x > 49 || y < 0 || y > 49)
            return undefined;

        return new RoomPosition(x, y, pos.roomName);
    },

    isDangerousHostile: function (creep) {
        if (!creep || !creep.owner)
            return false;

        if (creep.owner.username != 'Source Keeper')
            return true;

        return creep.getActiveBodyparts(ATTACK) > 0 ||
            creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
            creep.getActiveBodyparts(HEAL) > 0 ||
            creep.getActiveBodyparts(WORK) >= 4;
    },

    avoidDangerousHostilesInCosts: function (roomName, costs, target) {
        var room = Game.rooms[roomName];
        if (!room)
            return costs;

        var hostiles = room.find(FIND_HOSTILE_CREEPS, {
            filter: function (creep) {
                return roleBasic.isDangerousHostile(creep);
            }
        });

        var lairs = room.find(FIND_HOSTILE_STRUCTURES, {
            filter: function (structure) {
                return structure.structureType == STRUCTURE_KEEPER_LAIR &&
                    structure.ticksToSpawn != undefined &&
                    structure.ticksToSpawn < 5;
            }
        });

        if ((!hostiles || hostiles.length == 0) && (!lairs || lairs.length == 0))
            return costs;

        var targetPos = roleBasic.getTargetPos(target);
        var terrain = room.getTerrain();

        for (var i = 0; i < hostiles.length; i++) {
            var hostile = hostiles[i];
            var avoidRange = hostile.getActiveBodyparts(RANGED_ATTACK) > 0 ? 4 : 3;

            if (roomName == "E56S25")
                avoidRange = 3;

            if (roomName == "E55S24")
                avoidRange = 4;

            for (var dx = -avoidRange; dx <= avoidRange; dx++) {
                var x = hostile.pos.x + dx;
                if (x < 0 || x > 49)
                    continue;

                for (var dy = -avoidRange; dy <= avoidRange; dy++) {
                    var y = hostile.pos.y + dy;
                    if (y < 0 || y > 49)
                        continue;

                    if (targetPos &&
                        targetPos.roomName == roomName &&
                        targetPos.x == x &&
                        targetPos.y == y)
                        continue;

                    if (terrain.get(x, y) == TERRAIN_MASK_WALL)
                        continue;

                    costs.set(x, y, 0xff);
                }
            }
        }

        for (var lairIndex = 0; lairIndex < lairs.length; lairIndex++) {
            var lair = lairs[lairIndex];
            var lairAvoidRange = 4;

            for (var lairDx = -lairAvoidRange; lairDx <= lairAvoidRange; lairDx++) {
                var lairX = lair.pos.x + lairDx;
                if (lairX < 0 || lairX > 49)
                    continue;

                for (var lairDy = -lairAvoidRange; lairDy <= lairAvoidRange; lairDy++) {
                    var lairY = lair.pos.y + lairDy;
                    if (lairY < 0 || lairY > 49)
                        continue;

                    if (targetPos &&
                        targetPos.roomName == roomName &&
                        targetPos.x == lairX &&
                        targetPos.y == lairY)
                        continue;

                    if (terrain.get(lairX, lairY) == TERRAIN_MASK_WALL)
                        continue;

                    costs.set(lairX, lairY, 0xff);
                }
            }
        }

        return costs;
    },

    avoidCreepsInCosts: function (roomName, costs, target) {
        var room = Game.rooms[roomName];
        if (!room)
            return costs;

        var hostiles = room.find(FIND_CREEPS);

        if (!hostiles || hostiles.length == 0)
            return costs;

        for (var creep of hostiles) {
            costs.set(creep.pos.x, creep.pos.y, 0xff);
        }


        return costs;
    },


    avoidPortalsInCosts: function (roomName, costs, target) {
        var room = Game.rooms[roomName];
        if (!room)
            return costs;

        var portals = room.find(FIND_STRUCTURES, {
            filter: function (structure) {
                return structure.structureType == STRUCTURE_PORTAL;
            }
        });

        if (!portals || portals.length == 0)
            return costs;

        var targetPos = roleBasic.getTargetPos(target);
        var avoidRange = roleBasic.portalAvoidRange;

        for (var i = 0; i < portals.length; i++) {
            var portal = portals[i];
            for (var dx = -avoidRange; dx <= avoidRange; dx++) {
                var x = portal.pos.x + dx;
                if (x < 0 || x > 49)
                    continue;

                for (var dy = -avoidRange; dy <= avoidRange; dy++) {
                    var y = portal.pos.y + dy;
                    if (y < 0 || y > 49)
                        continue;

                    if (targetPos &&
                        targetPos.roomName == roomName &&
                        targetPos.x == x &&
                        targetPos.y == y)
                        continue;

                    if (room.getTerrain().get(x, y) == TERRAIN_MASK_WALL)
                        continue;

                    costs.set(x, y, 0xff);
                }
            }
        }

        return costs;
    },

    applyRoomStructureCosts: function (roomName, costs) {
        var room = Game.rooms[roomName];
        if (!room)
            return costs;

        var structures = room.find(FIND_STRUCTURES);
        var constructionSites = room.find(FIND_CONSTRUCTION_SITES);

        for (var i = 0; i < structures.length; i++) {
            var structure = structures[i];

            if (structure.structureType == STRUCTURE_ROAD) {
                costs.set(structure.pos.x, structure.pos.y, 1);
            }
            else if (structure.structureType != STRUCTURE_CONTAINER &&
                (structure.structureType != STRUCTURE_RAMPART || !structure.my)) {
                costs.set(structure.pos.x, structure.pos.y, 255);
            }
        }

        for (var j = 0; j < constructionSites.length; j++) {
            var site = constructionSites[j];

            if (site.structureType == STRUCTURE_ROAD)
                costs.set(site.pos.x, site.pos.y, 1);
        }

        return costs;
    },

    getFindPathOptions: function (target, range, extraOptions) {
        var options = {
            ignoreCreeps: true,
            costCallback: function (roomName, costs) {
                roleBasic.applyRoomStructureCosts(roomName, costs);
                roleBasic.avoidDangerousHostilesInCosts(roomName, costs, target);
                roleBasic.avoidCreepsInCosts(roomName, costs, target);
                return roleBasic.avoidPortalsInCosts(roomName, costs, target);
            }
        };

        if (range != undefined)
            options.range = range;

        if (extraOptions)
            _.assign(options, extraOptions);

        return options;
    },

    getMoveToOptions: function (target, stroke, range, extraOptions) {
        var options = this.getFindPathOptions(target, range, extraOptions);
        options.visualizePathStyle = { stroke: stroke };

        return options;
    },

    isRoomAvoided: function (roomName) {
        return this.roomsToAvoid.indexOf(roomName) != -1;
    },

    buildHostileAwareCostCallback: function (target, movingCreep, hardBlockTraffic) {
        return function (roomName, costs) {
            roleBasic.applyRoomStructureCosts(roomName, costs);
            roleBasic.avoidDangerousHostilesInCosts(roomName, costs, target);
            roleBasic.avoidPortalsInCosts(roomName, costs, target);

            if (movingCreep)
                return roleBasic.applyCreepTrafficCosts(roomName, costs, movingCreep, target, !!hardBlockTraffic);

            return costs;
        };
    },

    findClosestExitCandidate: function (creep, exits, target) {
        if (!exits || exits.length == 0)
            return undefined;

        return creep.pos.findClosestByPath(exits, this.getFindPathOptions(target, 0, {
            ignoreCreeps: true,
            maxRooms: 1
        })) || creep.pos.findClosestByRange(exits);
    },

    shouldLogPathDebug: function (creep) {
        if (!creep)
            return false;

        if (creep.memory && (creep.memory.debugPath || creep.memory.debugPathDetail))
            return true;

        return creep.memory && creep.name == 'deliverer61144';
    },

    debugPathSelection: function (creep, label, target) {
        if (!this.shouldLogPathDebug(creep))
            return;

        var targetPos = this.getTargetPos(target);
        var targetStr = targetPos ? targetPos.roomName + ':' + targetPos.x + ',' + targetPos.y : 'none';
        console.log('[path-debug]', creep.name, label,
            'room=' + creep.room.name,
            'pos=' + creep.pos.x + ',' + creep.pos.y,
            'target=' + targetStr);
    },

    debugPathDetail: function (creep, label, detail, target) {
        if (!this.shouldLogPathDebug(creep))
            return;

        var targetPos = this.getTargetPos(target);
        var targetStr = targetPos ? targetPos.roomName + ':' + targetPos.x + ',' + targetPos.y : 'none';
        console.log('[path-debug]', creep.name, label,
            detail,
            'room=' + creep.room.name,
            'pos=' + creep.pos.x + ',' + creep.pos.y,
            'target=' + targetStr);
    },

    clearCrossRoomPathCache: function (creep) {
        if (creep && creep.memory)
            delete creep.memory._crossRoomPath;
    },

    getCrossRoomPathCacheKey: function (fromPos, toPos, r, includeCreeps) {
        return fromPos.roomName + ':' + toPos.roomName + ':' + toPos.x + ':' + toPos.y + ':' + r + ':' + (includeCreeps ? 'traffic' : 'clear');
    },

    deserializePath: function (serializedPath) {
        if (!serializedPath || serializedPath.length == 0)
            return [];

        return _.map(serializedPath, function (step) {
            return new RoomPosition(step.x, step.y, step.roomName);
        });
    },

    serializePath: function (path) {
        if (!path || path.length == 0)
            return [];

        return _.map(path, function (step) {
            return {
                x: step.x,
                y: step.y,
                roomName: step.roomName
            };
        });
    },

    trimPathFromCurrentPos: function (creep, path) {
        if (!creep || !path || path.length == 0)
            return [];

        for (var i = 0; i < path.length; i++) {
            var step = path[i];
            if (step.roomName == creep.room.name && step.x == creep.pos.x && step.y == creep.pos.y)
                return path.slice(i + 1);
        }

        return path;
    },

    getCachedCrossRoomPath: function (creep, targetPos, r, includeCreeps) {
        if (!creep || !creep.memory || !creep.memory._crossRoomPath)
            return undefined;

        var cache = creep.memory._crossRoomPath;
        var fromPos = creep.pos;
        var cacheKey = this.getCrossRoomPathCacheKey(fromPos, targetPos, r, includeCreeps);
        if (cache.key != cacheKey)
            return undefined;

        if (cache.tick == undefined || Game.time - cache.tick > 10)
            return undefined;

        return this.trimPathFromCurrentPos(creep, this.deserializePath(cache.path));
    },

    saveCrossRoomPath: function (creep, targetPos, r, includeCreeps, path) {
        if (!creep || !creep.memory || !targetPos)
            return;

        creep.memory._crossRoomPath = {
            key: this.getCrossRoomPathCacheKey(creep.pos, targetPos, r, includeCreeps),
            tick: Game.time,
            path: this.serializePath(path)
        };
    },

    applyCreepTrafficCosts: function (roomName, costs, movingCreep, target, hardBlock) {
        var room = Game.rooms[roomName];
        if (!room)
            return costs;

        var targetPos = roleBasic.getTargetPos(target);
        var creeps = room.find(FIND_CREEPS);
        var blockedCount = 0;
        var blockedNames = [];

        for (var i = 0; i < creeps.length; i++) {
            var otherCreep = creeps[i];
            if (movingCreep && otherCreep.id == movingCreep.id)
                continue;

            if (targetPos && targetPos.roomName == roomName && targetPos.x == otherCreep.pos.x && targetPos.y == otherCreep.pos.y)
                continue;

            var currentCost = costs.get(otherCreep.pos.x, otherCreep.pos.y);
            if (currentCost >= 0xff)
                continue;

            if (hardBlock) {
                costs.set(otherCreep.pos.x, otherCreep.pos.y, 0xff);
                blockedCount++;
                if (blockedNames.length < 3)
                    blockedNames.push(otherCreep.name + '@' + otherCreep.pos.x + ',' + otherCreep.pos.y);
            }
            else if (currentCost <= 1)
                costs.set(otherCreep.pos.x, otherCreep.pos.y, 3);
            else
                costs.set(otherCreep.pos.x, otherCreep.pos.y, Math.max(currentCost, 10));
        }

        if (hardBlock && movingCreep && movingCreep.name == 'deliverer8115') {
            roleBasic.debugPathDetail(movingCreep,
                'traffic hardBlock',
                'roomName=' + roomName + ' blocked=' + blockedCount + ' sample=' + blockedNames.join('|'),
                target);
        }

        return costs;
    },

    isPositionNearDangerousHostile: function (roomName, pos, target) {
        var room = Game.rooms[roomName];
        if (!room || !pos)
            return false;

        var targetPos = roleBasic.getTargetPos(target);
        if (targetPos && targetPos.roomName == roomName && targetPos.x == pos.x && targetPos.y == pos.y)
            return false;

        var hostiles = room.find(FIND_HOSTILE_CREEPS, {
            filter: function (creep) {
                return roleBasic.isDangerousHostile(creep);
            }
        });

        for (var i = 0; i < hostiles.length; i++) {
            var hostile = hostiles[i];
            var avoidRange = hostile.getActiveBodyparts(RANGED_ATTACK) > 0 ? 4 : 3;
            if (Math.max(Math.abs(pos.x - hostile.pos.x), Math.abs(pos.y - hostile.pos.y)) <= avoidRange)
                return true;
        }

        return false;
    },

    updateMoveStuckState: function (creep, key) {
        if (!creep.memory._basicMoveState || creep.memory._basicMoveState.key != key) {
            creep.memory._basicMoveState = {
                key: key,
                x: creep.pos.x,
                y: creep.pos.y,
                roomName: creep.room.name,
                lastX: undefined,
                lastY: undefined,
                lastRoomName: undefined,
                stuckTicks: 0
            };

            return false;
        }

        var state = creep.memory._basicMoveState;
        var samePosition = state.x == creep.pos.x && state.y == creep.pos.y && state.roomName == creep.room.name;
        var oscillating = state.lastX == creep.pos.x && state.lastY == creep.pos.y && state.lastRoomName == creep.room.name;

        if (samePosition || oscillating) {
            state.stuckTicks = (state.stuckTicks || 0) + 1;
        }
        else {
            state.stuckTicks = 0;
        }

        state.lastX = state.x;
        state.lastY = state.y;
        state.lastRoomName = state.roomName;
        state.x = creep.pos.x;
        state.y = creep.pos.y;
        state.roomName = creep.room.name;

        return state.stuckTicks >= 2;
    },

    resetMoveStuckState: function (creep, key) {
        if (!creep.memory._basicMoveState)
            return;

        if (!key || creep.memory._basicMoveState.key == key)
            delete creep.memory._basicMoveState;
    },

    shouldLogMoveToRoomError: function (creep, roomToGo, code, isStuck) {
        if (code == OK) {
            delete creep.memory._moveToRoomErrorState;
            return false;
        }

        if (code == ERR_NO_PATH || code == ERR_BUSY || code == ERR_TIRED || code == ERR_NOT_FOUND) {
            var key = roomToGo + ':' + code;
            var state = creep.memory._moveToRoomErrorState;

            if (!state || state.key != key || state.lastTick != Game.time - 1) {
                state = {
                    key: key,
                    count: 1,
                    lastTick: Game.time
                };
            }
            else {
                state.count = (state.count || 0) + 1;
                state.lastTick = Game.time;
            }

            creep.memory._moveToRoomErrorState = state;

            // Creep traffic can produce short ERR_NO_PATH bursts that self-resolve.
            // Log only if the same error repeats for several consecutive ticks.
            var threshold = isStuck ? 4 : 3;
            return state.count >= threshold;
        }

        delete creep.memory._moveToRoomErrorState;
        return true;
    },

    getRoomRoute: function (fromRoomName, toRoomName) {
        if (!roleBasic._routeCache)
            roleBasic._routeCache = {};

        var avoidSignature = this.roomsToAvoid && this.roomsToAvoid.length > 0
            ? this.roomsToAvoid.join('|')
            : '';
        var cacheKey = fromRoomName + '>' + toRoomName + '>' + avoidSignature;
        var route = roleBasic._routeCache[cacheKey];

        if (route && route != ERR_NO_PATH) {
            for (var i = 0; i < route.length; i++) {
                if (this.isRoomAvoided(route[i].room)) {
                    route = undefined;
                    break;
                }
            }
        }

        if (!route) {
            route = Game.map.findRoute(fromRoomName, toRoomName, {
                routeCallback: function (roomName) {
                    return roleBasic.getRouteWeight(roomName);
                }
            });
            roleBasic._routeCache[cacheKey] = route;
        }

        return route;
    },

    clearRoomRouteCache: function (fromRoomName, toRoomName) {
        if (!roleBasic._routeCache)
            return;

        var prefix = fromRoomName + '>' + toRoomName + '>';
        for (var key in roleBasic._routeCache) {
            if (key.indexOf(prefix) == 0)
                delete roleBasic._routeCache[key];
        }
    },


    getPathMultiroom: function (from, to, r = 1, options) {
        var fromPos = this.getTargetPos(from);
        var toPos = this.getTargetPos(to);
        var includeCreeps = options && options.includeCreeps;
        var movingCreep = options && options.movingCreep;

        if (!fromPos || !toPos)
            return [];

        if (fromPos.roomName == toPos.roomName) {
            
            var oldOptions = {
                    ignoreCreeps: !includeCreeps,
                    costCallback: function (roomName, costs) {
                        roleBasic.applyRoomStructureCosts(roomName, costs);
                        roleBasic.avoidDangerousHostilesInCosts(roomName, costs, to);
                        if (includeCreeps)
                            roleBasic.applyCreepTrafficCosts(roomName, costs, movingCreep, to, true);
                        return roleBasic.avoidPortalsInCosts(roomName, costs, to);
                    }
                };

            var options = {ignoreCreeps: true, range: r};
            var sameRoomPath = fromPos.findPathTo(toPos, options);
                

            return _.map(sameRoomPath, function (step) {
                return new RoomPosition(step.x, step.y, fromPos.roomName);
            });
        }

        var roomRoute = this.getRoomRoute(fromPos.roomName, toPos.roomName);
        if (roomRoute === ERR_NO_PATH) {
            console.log('getPathMultiroom no route', from.id, fromPos.roomName, '->', to.id, toPos.roomName);
            return [];
        }

        var goals = [{ pos: toPos, range: r }];
        var allowedRooms = {};
        allowedRooms[fromPos.roomName] = true;
        allowedRooms[toPos.roomName] = true;

        for (var routeIndex = 0; routeIndex < roomRoute.length; routeIndex++) {
            allowedRooms[roomRoute[routeIndex].room] = true;
        }

        var callback = function (roomName) {
            if (!allowedRooms[roomName])
                return false;

            if (!Game.rooms[roomName])
                return;

            var costs = new PathFinder.CostMatrix();
            roleBasic.applyRoomStructureCosts(roomName, costs);
            if (options && options.avoidHostiles)
                roleBasic.avoidDangerousHostilesInCosts(roomName, costs, toPos);
            //if (includeCreeps)
            //    roleBasic.applyCreepTrafficCosts(roomName, costs, movingCreep, toPos, true);
            //roleBasic.avoidPortalsInCosts(roomName, costs, toPos);

            return costs;
        };

        var ret = PathFinder.search(fromPos, goals, {
            plainCost: 2,
            swampCost: 4,
            maxRooms: roomRoute.length + 1,
            maxOps: 12000,
            roomCallback: callback
        });

        if (ret.incomplete) {
            console.log('getPathMultiroom incomplete',
                from.id, fromPos.roomName + ':' + fromPos.x + ',' + fromPos.y,
                '->', to.id, toPos.roomName + ':' + toPos.x + ',' + toPos.y,
                'range=' + r,
                'pathLen=' + ret.path.length,
                'ops=' + ret.ops,
                'cost=' + ret.cost,
                'rooms=' + (roomRoute.length + 1));
        }

        return ret.path;
    },

    getVisibleRoomExitTarget: function (creep, roomToGo, exitDir, targetRoom, target) {
        var targetPos = this.getTargetPos(target);
        if (targetPos && targetRoom && targetPos.roomName == targetRoom.name) {
            var preferredExit = new RoomPosition(
                exitDir == FIND_EXIT_LEFT ? 0 : exitDir == FIND_EXIT_RIGHT ? 49 : targetPos.x,
                exitDir == FIND_EXIT_TOP ? 0 : exitDir == FIND_EXIT_BOTTOM ? 49 : targetPos.y,
                creep.room.name
            );

            var exits = creep.room.find(exitDir);
            if (!exits || exits.length == 0)
                return preferredExit;

            exits = _.sortBy(exits, function (pos) {
                return pos.getRangeTo(preferredExit);
            });

            var safeExits = _.filter(exits, function (pos) {
                return !roleBasic.isPositionNearDangerousHostile(creep.room.name, pos, targetPos);
            });

            var exitsToSearch = safeExits.length > 0 ? safeExits : exits;

            return creep.pos.findClosestByPath(exitsToSearch, this.getFindPathOptions(target, 0, {
                ignoreCreeps: true,
                maxRooms: 1
            })) || creep.pos.findClosestByRange(exitsToSearch) || preferredExit;
        }

        if (!targetRoom || !targetRoom.controller)
            return undefined;

        var targetExitDir = Game.map.findExit(targetRoom, creep.room);
        if (targetExitDir < 0)
            return this.findClosestExitAvoidingPortals(creep, exitDir, target);

        var targetExit = targetRoom.controller.pos.findClosestByPath(targetExitDir,
            this.getFindPathOptions(targetRoom.controller, 1, {
                ignoreCreeps: true,
                maxRooms: 1
            }));

        if (!targetExit)
            return this.findClosestExitAvoidingPortals(creep, exitDir, target);

        return new RoomPosition(
            exitDir == FIND_EXIT_LEFT ? 0 : exitDir == FIND_EXIT_RIGHT ? 49 : targetExit.x,
            exitDir == FIND_EXIT_TOP ? 0 : exitDir == FIND_EXIT_BOTTOM ? 49 : targetExit.y,
            creep.room.name
        );
    },

    getVisibleNextRouteTarget: function (creep, route, roomToGo) {
        if (!route || route.length == 0)
            return undefined;

        var nextRoomName = route[0].room;
        var nextRoom = Game.rooms[nextRoomName];
        if (!nextRoom)
            return undefined;

        if (route.length > 1) {
            var nextExitDir = Game.map.findExit(nextRoom, route[1].room);
            if (nextExitDir >= 0) {
                var nextExits = nextRoom.find(nextExitDir);
                if (nextExits && nextExits.length > 0) {
                    return creep.pos.findClosestByPath(nextExits, this.getFindPathOptions(undefined, 0, {
                        ignoreCreeps: true,
                        maxRooms: 2
                    }));
                }
            }

            return new RoomPosition(25, 25, nextRoomName);
        }

        var exitDir = Game.map.findExit(creep.room, roomToGo);
        if (exitDir < 0)
            return undefined;

        return this.getVisibleRoomExitTarget(creep, roomToGo, exitDir, nextRoom);
    },

    moveToVisibleRoomController: function (creep, roomToGo, target) {
        this.debugPathSelection(creep, 'moveToVisibleRoomController ' + roomToGo, target);

        var targetRoom = Game.rooms[roomToGo];
        if (!targetRoom || !targetRoom.controller) {
            this.debugPathDetail(creep,
                'moveToVisibleRoomController skip ' + roomToGo,
                'reason=noTargetRoomOrController',
                target);
            return undefined;
        }

        var route = this.getRoomRoute(creep.room.name, roomToGo);
        if (route == ERR_NO_PATH) {
            this.debugPathDetail(creep,
                'moveToVisibleRoomController skip ' + roomToGo,
                'reason=errNoRoute',
                target);
            return ERR_NO_PATH;
        }

        if (!route || route.length != 1 || route[0].room != roomToGo) {
            this.debugPathDetail(creep,
                'moveToVisibleRoomController skip ' + roomToGo,
                'reason=unexpectedRoute routeLen=' + (route ? route.length : 0),
                target);
            return undefined;
        }

        var exitDir = Game.map.findExit(creep.room, roomToGo);
        if (exitDir < 0) {
            this.debugPathDetail(creep,
                'moveToVisibleRoomController skip ' + roomToGo,
                'reason=invalidExitDir exitDir=' + exitDir,
                target);
            return undefined;
        }

        if ((exitDir == FIND_EXIT_LEFT && creep.pos.x == 0) ||
            (exitDir == FIND_EXIT_RIGHT && creep.pos.x == 49) ||
            (exitDir == FIND_EXIT_TOP && creep.pos.y == 0) ||
            (exitDir == FIND_EXIT_BOTTOM && creep.pos.y == 49)) {
            var edgeMoveCode = creep.move(exitDir);
            this.debugPathDetail(creep,
                'moveToVisibleRoomController edgeMove ' + roomToGo,
                'exitDir=' + exitDir + ' code=' + edgeMoveCode,
                target);
            return edgeMoveCode;
        }

        var moveTarget = this.getVisibleRoomExitTarget(creep, roomToGo, exitDir, targetRoom, target);
        if (!moveTarget) {
            this.debugPathDetail(creep,
                'moveToVisibleRoomController skip ' + roomToGo,
                'reason=noMoveTarget exitDir=' + exitDir,
                target);
            return ERR_NO_PATH;
        }

        this.debugPathDetail(creep,
            'moveToVisibleRoomController target ' + roomToGo,
            'exitDir=' + exitDir + ' moveTarget=' + moveTarget.roomName + ':' + moveTarget.x + ',' + moveTarget.y,
            target);

        var visibleMoveCode = creep.moveTo(moveTarget, this.getMoveToOptions(moveTarget, '#35bd1d', 0, {
            costCallback: this.buildHostileAwareCostCallback(moveTarget, creep, true),
            reusePath: 0,
            maxRooms: 1
        }));

        this.debugPathDetail(creep,
            'moveToVisibleRoomController result ' + roomToGo,
            'code=' + visibleMoveCode,
            moveTarget);

        return visibleMoveCode;
    },

    findClosestExitAvoidingPortals: function (creep, exitDir, target) {
        var exits = creep.room.find(exitDir);
        if (!exits || exits.length == 0)
            return undefined;

        var safeExitsByHostiles = _.filter(exits, function (pos) {
            return !roleBasic.isPositionNearDangerousHostile(creep.room.name, pos, target);
        });

        var portals = creep.room.find(FIND_STRUCTURES, {
            filter: function (structure) {
                return structure.structureType == STRUCTURE_PORTAL;
            }
        });

        if (!portals || portals.length == 0) {
            var exitsNoPortal = safeExitsByHostiles.length > 0 ? safeExitsByHostiles : exits;
            return this.findClosestExitCandidate(creep, exitsNoPortal, target);
        }

        var blocked = {};
        var avoidRange = this.portalAvoidRange;
        for (var i = 0; i < portals.length; i++) {
            var portal = portals[i];
            for (var dx = -avoidRange; dx <= avoidRange; dx++) {
                var x = portal.pos.x + dx;
                if (x < 0 || x > 49)
                    continue;

                for (var dy = -avoidRange; dy <= avoidRange; dy++) {
                    var y = portal.pos.y + dy;
                    if (y < 0 || y > 49)
                        continue;

                    blocked[x + ":" + y] = true;
                }
            }
        }

        var safeExits = _.filter(exits, function (pos) {
            return !blocked[pos.x + ":" + pos.y];
        });

        var safeExitsNoHostiles = _.filter(safeExits, function (pos) {
            return !roleBasic.isPositionNearDangerousHostile(creep.room.name, pos, target);
        });

        if (safeExitsNoHostiles.length > 0)
            safeExits = safeExitsNoHostiles;
        else if (safeExitsByHostiles.length > 0)
            safeExits = _.intersection(safeExits, safeExitsByHostiles);

        if (safeExits.length > 0)
            return this.findClosestExitCandidate(creep, safeExits, target);

        return this.findClosestExitCandidate(creep, exits, target);
    },

    moveToRoom: function (creep, roomToGo = undefined, target = undefined) {
        if (!roomToGo && creep.memory.toGo)
            roomToGo = creep.memory.toGo[0];

        if (!roomToGo)
            return true;

        this.debugPathSelection(creep, 'moveToRoom ' + roomToGo, target);

        var moveStateKey = 'room:' + roomToGo;

        if (roomToGo == creep.room.name) {
            this.resetMoveStuckState(creep, moveStateKey);

            //return true;
            //console.log(creep.name, " in the room");
            if (creep.pos.x == 0)
                creep.move(RIGHT);
            else if (creep.pos.x == 49)
                creep.move(LEFT);
            else if (creep.pos.y == 0)
                creep.move(BOTTOM);
            else if (creep.pos.y == 49)
                creep.move(TOP);

            this.debugPathSelection(creep, 'intheroom ' + roomToGo, target);

            return true;
        }

        var moveTarget;

        if (creep.fatigue > 0)
            return false;

        var isStuck = this.updateMoveStuckState(creep, moveStateKey);

        var visibleRoomCode = this.moveToVisibleRoomController(creep, roomToGo, target);
        if (visibleRoomCode == OK) {
            creep.say("Go2" + roomToGo);
            return false;
        }

        if (visibleRoomCode != undefined && visibleRoomCode != ERR_NO_PATH && visibleRoomCode != ERR_NOT_FOUND) {
            console.log("err", visibleRoomCode, " creep visible move to ", creep.name, " to ", roomToGo);
            creep.say("Go3" + roomToGo);
            return false;
        }

        //console.log(creep.name, " moving to room ", roomToGo);
        //var flag = creep.pos.findClosestByRange(FIND_FLAGS, {
        //            filter: flag => (flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_ORANGE)
        //       });

        var route = this.getRoomRoute(creep.room.name, roomToGo);

        if (route == ERR_NO_PATH) {
            console.log("no route from ", creep.room.name, " to ", roomToGo);
            return false;
        }
        //console.log(creep.name, " route to ", roomToGo, ":", JSON.stringify(route));
        const exitDir = Game.map.findExit(creep.room, route[0].room);
        if (exitDir < 0) {
            console.log("no exit from ", creep.room.name, " to ", route[0].room, " for ", creep.name);
            this.clearRoomRouteCache(creep.room.name, roomToGo);
            return false;
        }

        if (isStuck) {
            this.clearRoomRouteCache(creep.room.name, roomToGo);
            delete creep.memory._move;
        }

        moveTarget = this.getVisibleNextRouteTarget(creep, route, roomToGo);

        if (isStuck)
            moveTarget = this.findClosestExitAvoidingPortals(creep, exitDir, moveTarget || target);
        else if (!moveTarget)
            moveTarget = this.findClosestExitAvoidingPortals(creep, exitDir);

        this.debugPathDetail(creep,
            'moveToRoom fallback target ' + roomToGo,
            'routeLen=' + (route ? route.length : 0) +
            ' exitDir=' + exitDir +
            ' isStuck=' + isStuck +
            ' moveTarget=' + (moveTarget ? moveTarget.roomName + ':' + moveTarget.x + ',' + moveTarget.y : 'none'),
            target);

        var moveOptions = this.getMoveToOptions(moveTarget, '#35bd1d', 0, {
            reusePath: isStuck ? 0 : 10,
            maxRooms: moveTarget && moveTarget.roomName != creep.room.name ? 2 : 1
        });

        var code = creep.moveTo(moveTarget, moveTarget && moveTarget.roomName != creep.room.name ? moveOptions : this.getMoveToOptions(moveTarget, '#35bd1d', undefined, {
            reusePath: isStuck ? 0 : 10,
            maxRooms: 1
        }));

        if (code == ERR_NO_PATH || code == ERR_INVALID_TARGET) {
            var stepToExit = this.getPositionByDirection(creep.pos, exitDir);
            var stepToExitDanger = stepToExit && this.isPositionNearDangerousHostile(creep.room.name, stepToExit, moveTarget || target);

            if (!stepToExitDanger) {
                code = creep.move(exitDir);
                this.debugPathDetail(creep,
                    'moveToRoom fallback exitMove ' + roomToGo,
                    'code=' + code + ' stepDanger=false',
                    target);
            }
            else {
                var safeFallbackExit = this.findClosestExitAvoidingPortals(creep, exitDir, moveTarget || target);
                if (safeFallbackExit) {
                    code = creep.moveTo(safeFallbackExit, this.getMoveToOptions(safeFallbackExit, '#35bd1d', 0, {
                        reusePath: 0,
                        maxRooms: 1
                    }));

                    this.debugPathDetail(creep,
                        'moveToRoom fallback safeExit ' + roomToGo,
                        'code=' + code +
                        ' stepDanger=true safe=' + safeFallbackExit.roomName + ':' + safeFallbackExit.x + ',' + safeFallbackExit.y,
                        target);
                }
                else {
                    this.debugPathDetail(creep,
                        'moveToRoom fallback blocked ' + roomToGo,
                        'reason=noSafeExit stepDanger=true',
                        target);
                }
            }
        }

        if (code == ERR_NO_PATH && (creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49))
            code = creep.moveTo(25, 25, this.getMoveToOptions(new RoomPosition(25, 25, creep.room.name), '#35bd1d', undefined, {
                reusePath: 0,
                maxRooms: 1
            }));

        this.debugPathDetail(creep,
            'moveToRoom result ' + roomToGo,
            'code=' + code,
            target);

        if (code != OK && this.shouldLogMoveToRoomError(creep, roomToGo, code, isStuck))
            console.log("err", code, " creep move to ", creep.name, " to ", roomToGo, " target ", moveTarget);

        //console.log(creep.name, " moving to room ", roomToGo, " code ", code);

        creep.say("Go1" + roomToGo);

        return false;
    },

    recycleCreep: function (creep) {

        var spawn = creep.room.spawn;
        creep.memory.toGo = undefined;

        if (!spawn) {
            //console.log("no spawn in room ", creep.room.name, " for recycling" + creep.name);
            if (creep.memory.motherland)
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

    stepOutOf: function (creep, target) {
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

            creep.move(oppositeDir)
        }
    },

    avoidEnemies: function (creep) {

        var distance = 5;

        if (creep.room.name == "E56S25" || creep.room.name == "E55S24")
            distance = 5;



        var enemies = creep.pos.findInRange(FIND_HOSTILE_CREEPS, distance - 1, {
            filter: c => (c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0)
        });

        var lairs = creep.pos.findInRange(FIND_HOSTILE_STRUCTURES, distance - 1, {
            filter: s => s.structureType == STRUCTURE_KEEPER_LAIR &&
                s.ticksToSpawn && s.ticksToSpawn < 5
        });

        var closestEnemy = enemies[0] || lairs[0];

        if (!closestEnemy)
            return false;

        if (this.shouldLogPathDebug(creep)) {
            this.debugPathDetail(creep,
                'avoidEnemies trigger',
                'enemy=' + (closestEnemy.name || closestEnemy.structureType) +
                ' enemyPos=' + closestEnemy.pos.roomName + ':' + closestEnemy.pos.x + ',' + closestEnemy.pos.y +
                ' enemies=' + enemies.length + ' lairs=' + lairs.length + ' fleeRange=' + distance,
                closestEnemy);
        }

        creep.say("run");
        var path = PathFinder.search(creep.pos,
            { pos: closestEnemy.pos, range: distance + 1 },
            {
                flee: true,
                ignoreCreeps: false,
                maxRooms: 1,
                plainCost: 2,
                swampCost: 3
            });

        creep.moveByPath(path.path, { visualizePathStyle: { stroke: '#ff0000' } });

        return true;
    },

    leaveDangerousRoom: function (creep) {


        if (this.avoidEnemies(creep))
            return true;


        var targetRoomName = creep.memory.toGo && creep.memory.toGo[0];

        if (!targetRoomName)
            return false;

        var roomMemory = Memory.rooms && Memory.rooms[targetRoomName];
        var dangerous = roomMemory && roomMemory.dangerous;

        if (!dangerous)
            return false;

        var fallbackRoom = creep.memory.motherland;
        if (!fallbackRoom || fallbackRoom == targetRoomName)
            return true;

        creep.say("retreat");

        if (creep.room.name != fallbackRoom) {
            this.moveToRoom(creep, fallbackRoom);
            return true;
        }

        return true;
    },

    goTo: function (creep, target, r = 1, stroke = '#ffffff') {
        this.debugPathSelection(creep, 'goTo r=' + r, target);

        var targetPos = this.getTargetPos(target);
        if (!targetPos)
            return ERR_INVALID_TARGET;

        if (creep.fatigue > 0)
            return ERR_TIRED;


        if (targetPos.roomName != creep.room.name) {
            var distance = Game.map.getRoomLinearDistance(creep.room.name, targetPos.roomName);
            if (this.shouldLogPathDebug(creep)) {
                var inDangerNow = this.isPositionNearDangerousHostile(creep.room.name, creep.pos, targetPos);
                this.debugPathDetail(creep,
                    'goTo crossRoom enter',
                    'distance=' + distance + ' inDangerNow=' + inDangerNow,
                    target);
            }
            //if(creep.name == "deliverer7549")
            //    console.log("goTo target in different room", targetPos.roomName, " distance ", distance);

            if (distance <= 2) {
                if (this.isRoomAvoided(creep.room.name)) {
                    this.debugPathDetail(creep,
                        'goTo short bypass moveToRoom',
                        'reason=roomToAvoid room=' + creep.room.name,
                        target);
                    this.moveToRoom(creep, targetPos.roomName, target);
                    return OK;
                }

                var shortMoveStateKey = 'shortTarget:' + targetPos.roomName + ':' + targetPos.x + ':' + targetPos.y + ':' + r;
                var shortIsStuck = this.updateMoveStuckState(creep, shortMoveStateKey);
                var shortState = creep.memory && creep.memory._basicMoveState;

                this.debugPathDetail(creep,
                    'goTo short crossRoom state',
                    'shortIsStuck=' + shortIsStuck +
                    ' stuckTicks=' + (shortState && shortState.stuckTicks != undefined ? shortState.stuckTicks : 'na'),
                    target);

                if (shortIsStuck)
                    delete creep.memory._move;

                if (shortIsStuck) {
                    var forwardDir = creep.pos.getDirectionTo(targetPos);
                    var forwardPos = this.getPositionByDirection(creep.pos, forwardDir);

                    if (forwardPos) {
                        var blockers = forwardPos.lookFor(LOOK_CREEPS);
                        var blocker = blockers && blockers.length > 0 ? blockers[0] : undefined;
                        var forwardDanger = this.isPositionNearDangerousHostile(forwardPos.roomName, forwardPos, targetPos);

                        this.debugPathDetail(creep,
                            'goTo short forward',
                            'dir=' + forwardDir +
                            ' forward=' + forwardPos.roomName + ':' + forwardPos.x + ',' + forwardPos.y +
                            ' forwardDanger=' + forwardDanger +
                            ' blocker=' + (blocker ? blocker.name + ':' + blocker.my + ':fatigue=' + blocker.fatigue : 'none'),
                            target);

                        if (!forwardDanger &&
                            blocker && blocker.my && blocker.id != creep.id && blocker.fatigue == 0) {
                            var swapCode = blocker.move(blocker.pos.getDirectionTo(creep.pos));
                            this.debugPathDetail(creep,
                                'goTo short swap',
                                'blocker=' + blocker.name + ' swapCode=' + swapCode,
                                target);

                            if (swapCode == OK || swapCode == ERR_BUSY) {
                                var directMoveCode = creep.move(forwardDir);
                                this.debugPathDetail(creep,
                                    'goTo short directMove',
                                    'code=' + directMoveCode + ' forwardDanger=false',
                                    target);
                                if (directMoveCode == OK)
                                    return directMoveCode;
                            }
                        }
                        else if (forwardDanger) {
                            this.debugPathDetail(creep,
                                'goTo short directMove skip',
                                'reason=forwardDanger',
                                target);
                        }
                    }
                }

                var shortMoveOptions = this.getMoveToOptions(targetPos, stroke, r, {
                    ignoreCreeps: !shortIsStuck,
                    reusePath: shortIsStuck ? 0 : 10,
                    maxRooms: 2,
                    costCallback: this.buildHostileAwareCostCallback(targetPos, creep, shortIsStuck)
                });

                var code = creep.moveTo(targetPos, shortMoveOptions);

                this.debugPathDetail(creep,
                    'goTo short moveTo',
                    'code=' + code +
                    ' ignoreCreeps=' + (!shortIsStuck) +
                    ' hostileAware=true' +
                    ' hasMoveCache=' + (!!(creep.memory && creep.memory._move)),
                    target);

                if (code == ERR_NO_PATH || code == ERR_INVALID_TARGET) {
                    this.clearCrossRoomPathCache(creep);
                    // hostile costs blocked exit tiles — delegate to moveToRoom which targets
                    // specific exit tiles and handles hostile avoidance at room-exit granularity
                    this.debugPathDetail(creep, 'goTo short fallback moveToRoom', 'reason=noPath code=' + code, target);
                    this.moveToRoom(creep, targetPos.roomName, target);
                    return OK;
                }

                return code;
            }

            var moveStateKey = 'target:' + targetPos.roomName + ':' + targetPos.x + ':' + targetPos.y + ':' + r;
            var isStuck = this.updateMoveStuckState(creep, moveStateKey);
            var crossRoomPath = this.getCachedCrossRoomPath(creep, targetPos, r, true);

            if (!crossRoomPath || crossRoomPath.length == 0 || isStuck) {
                crossRoomPath = this.getPathMultiroom(creep, target, r, {
                    includeCreeps: true,
                    movingCreep: creep,
                    avoidHostiles: true
                });

                if (crossRoomPath && crossRoomPath.length > 0)
                    this.saveCrossRoomPath(creep, targetPos, r, true, crossRoomPath);
                else
                    this.clearCrossRoomPathCache(creep);
            }

            if (this.shouldLogPathDebug(creep) && crossRoomPath && crossRoomPath.length > 0) {
                var firstStep = crossRoomPath[0];
                var firstStepDanger = this.isPositionNearDangerousHostile(firstStep.roomName, firstStep, targetPos);
                this.debugPathDetail(creep,
                    'goTo crossRoom firstStep',
                    'first=' + firstStep.roomName + ':' + firstStep.x + ',' + firstStep.y +
                    ' danger=' + firstStepDanger,
                    target);
            }

            this.debugPathDetail(creep,
                'goTo crossRoom state',
                'isStuck=' + isStuck + ' pathLen=' + (crossRoomPath ? crossRoomPath.length : 0) + ' cached=' + (!!creep.memory._crossRoomPath),
                target);

            if (!crossRoomPath || crossRoomPath.length == 0) {
                this.debugPathDetail(creep, 'goTo fallback moveToRoom', 'reason=emptyCrossRoomPath', target);
                this.clearCrossRoomPathCache(creep);
                this.moveToRoom(creep, targetPos.roomName, target);
                return OK;
            }

            if (isStuck) {
                delete creep.memory._move;
            }

            var code = creep.moveByPath(crossRoomPath);
            if (code == ERR_NOT_FOUND && crossRoomPath[0])
                code = creep.move(creep.pos.getDirectionTo(crossRoomPath[0]));

            if (isStuck && (code == ERR_NOT_FOUND || code == ERR_BUSY || code == ERR_TIRED)) {
                this.clearCrossRoomPathCache(creep);
                code = creep.moveTo(targetPos, {
                    ignoreCreeps: false,
                    visualizePathStyle: { stroke: stroke },
                    range: r,
                    reusePath: 0,
                    maxRooms: 2
                });

                if (this.shouldLogPathDebug(creep)) {
                    var inDangerAfterFallback = this.isPositionNearDangerousHostile(creep.room.name, creep.pos, targetPos);
                    this.debugPathDetail(creep,
                        'goTo crossRoom fallbackMoveTo',
                        'fallbackCode=' + code + ' inDanger=' + inDangerAfterFallback,
                        target);
                }
            }

            this.debugPathDetail(creep, 'goTo moveByPath', 'code=' + code, target);

            if (code == ERR_NO_PATH || code == ERR_INVALID_TARGET) {
                this.clearCrossRoomPathCache(creep);
                this.debugPathDetail(creep, 'goTo fallback moveToRoom', 'reason=moveByPathCode:' + code, target);
                this.moveToRoom(creep, targetPos.roomName, target);
                return OK;
            }

            return code;
        }

        this.resetMoveStuckState(creep);

        // we start from far away and try to ignore creeps, if we got stuck we retry
        // closer we go the more we care about creeps
        var range = creep.pos.getRangeTo(target);
        var err = undefined;
        var sameRoomOptions = {
            ignoreCreeps: false,
            maxRooms: 1,
            reusePath: 10
        };

        if (range > 10) {

            var opts1 = this.getMoveToOptions(target, stroke, r, sameRoomOptions);
            err = creep.moveTo(target, opts1);
            creep.say("gt10");

            if (err == ERR_NO_PATH) {
                var opts = this.getMoveToOptions(target, stroke, r, {
                    maxRooms: 1,
                    reusePath: 0
                });

                err = creep.moveTo(target, opts);
            }
            else {
                if (err != OK)
                    creep.say(err);
            }
        }
        else if (range > 4) {
            err = creep.moveTo(target,
                this.getMoveToOptions(target, stroke, r, sameRoomOptions));

        }
        else {
            err = creep.moveTo(target,
                this.getMoveToOptions(target, stroke, undefined, sameRoomOptions));
        }

        return err;
    },

    runDropped: function (creep, range, resType, limit = 0) {
        if (creep.store.getFreeCapacity() == 0)
            return;

        var fRes = (res) => { return res.resourceType == resType && res.amount > limit; }
        if (!resType)
            fRes = (res) => { return res.amount > limit; }

        var dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: function (res) {
                return creep.pos.getRangeTo(res) <= range && fRes(res);
            }
        });

        if (!dropped) {
            var fTomb = (tomb) => { return tomb.store[resType] > limit; };
            if (!resType)
                fTomb = (tomb) => { return _.sum(tomb.store) > limit; };

            dropped = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                filter: function (tomb) {
                    return creep.pos.getRangeTo(tomb) <= range && fTomb(tomb);
                }
            });
        }


        //if(range > 1)
        //console.log("range", rangeToDrop , dropped, "rangeLimit", range, "creep.room", creep.room);
        if (!dropped) {
            return false;
        }

        //creep.say("see drop");
        //console.log("see drop" + " " + dropped + " " + dropped.amount + " " + dropped.room.name + " " + dropped.pos.x + " " + dropped.pos.y);
        if (!creep.pos.isNearTo(dropped)) {
            creep.moveTo(dropped, { visualizePathStyle: { stroke: '#ff00cc' } });
            return true;
        }

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
            return true;
        }

        else
            creep.say("oo1" + err);

        return false;
    }
    ,
    findSource: function (creep) {
        if (creep.memory.preferredSourceId) {
            return Game.getObjectById(creep.memory.preferredSourceId);
        }
        else {
            var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

            // stick creep to the source to avoid switching like headless chicken
            // but not always only in busy room - what can be a criteria

            // without this creeps run to remote part of room howevere there is source nearby
            var needToCacheSource = creep.room.controller && creep.room.controller.my && creep.room.controller.level <= 2;

            if (source && needToCacheSource)
                creep.memory.preferredSourceId = source.id;

            return source;
        }
    },

    runRenew: function (creep, options) {
        options = options || {};

        var spawn = options.spawn || creep.room.spawn;
        var nearbyRange = options.nearbyRange;
        var maxRenewCount = options.maxRenewCount != undefined ? options.maxRenewCount : 5;
        var ticksToLiveThreshold = options.ticksToLiveThreshold;
        var moveToSpawn = options.moveToSpawn !== false;

        if (!spawn)
            return false;

        if (spawn.spawning)
            return false;

        if (nearbyRange != undefined && creep.pos.getRangeTo(spawn) > nearbyRange)
            return false;

        if (creep.memory.renewCounter && creep.memory.renewCounter >= maxRenewCount)
            return false;

        if (ticksToLiveThreshold != undefined) {
            if (creep.ticksToLive >= ticksToLiveThreshold)
                return false;
        }
        else {
            // magic number from API reference
            var toRegen = Math.floor(600 / creep.body.length);
            if (creep.ticksToLive > CREEP_LIFE_TIME - toRegen)
                return false;
        }

        var creepCost = _.sum(creep.body, function (part) {
            return BODYPART_COST[part.type];
        });
        var bodySize = creep.body.length;
        var energyNeeded = Math.ceil(creepCost / 2.5 / bodySize);

        if ((spawn.store[RESOURCE_ENERGY] || 0) < energyNeeded)
            return false;

        creep.say("renew");

        if (creep.pos.isNearTo(spawn)) {
            var code = spawn.renewCreep(creep);
            if (code != OK) {
                creep.say("rn " + code);
                return false;
            }

            creep.memory.renewCounter = creep.memory.renewCounter ? creep.memory.renewCounter + 1 : 1;
            return true;
        }

        if (!moveToSpawn)
            return false;

        creep.moveTo(spawn);
        return true;
    },


    repairEmergency: function (creep, range = 1, N = 0.5) {

        if (creep.store.energy < 20)
            return false;

        return this.repair(creep, range, N);
    },

    repair: function (creep, range = 1, N = 0.5) {
        // Find all damaged roads/containers in the room, then filter by range
        var damagedBuild = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: function (s) {
                if ((s.structureType != STRUCTURE_ROAD && s.structureType != STRUCTURE_CONTAINER) ||
                    s.hits >= s.hitsMax * N ||
                    creep.pos.getRangeTo(s) > range) {
                    return false;
                }

                var flags = s.pos.lookFor(LOOK_FLAGS);
                for (var i = 0; i < flags.length; i++) {
                    if (flags[i].color == COLOR_PURPLE || flags[i].secondaryColor == COLOR_PURPLE)
                        return false;
                }

                return true;
            }
        });

        //if (damagedBuild)
        //    console.log("repairEmergency ", creep.name, creep.room.name, " found ",               damagedBuild, " damaged in range ", range);

        if (!damagedBuild)
            return false;

        if (creep.pos.getRangeTo(damagedBuild) > 3) {
            creep.moveTo(damagedBuild);
            return true;
        }

        creep.repair(damagedBuild);
        return true;
    }

};
//profiler.registerObject(roleBasic, 'basic');
module.exports = roleBasic;