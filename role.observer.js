var roleObserver = {
    run: function (room) {
        var globalMemory = this.getGlobalMemory();
        this.prepareTickState(globalMemory);
        this.runRoom(room, globalMemory);
    },

    runRoom: function (room, globalMemory) {
        if (!room)
            return;

        if (!room.controller || !room.controller.my)
            return;

        if (!globalMemory)
            globalMemory = this.getGlobalMemory();

        this.prepareTickState(globalMemory);

        var observer = room.observer;
        if (!observer)
            return;

        var memory = this.getMemory(room);
        if (memory.enabled === false)
            return;

        this.flushObservationResult(room.name, memory, globalMemory);

        var observableRooms = this.getObservableRooms(room, memory);
        if (observableRooms.length === 0)
            return;

        var nextObservation = this.getNextObservation(room.name, observableRooms, memory.rotationIndex || 0, globalMemory);
        if (!nextObservation)
            return;

        var targetRoomName = nextObservation.targetRoomName;
        globalMemory.assignments[targetRoomName] = room.name;

        //console.log("Observer in room ", room.name, " is observing room ", targetRoomName, " at tick ", Game.time);

        var result = observer.observeRoom(targetRoomName);

        memory.lastAttemptedRoomName = targetRoomName;
        memory.lastAttemptedTick = Game.time;
        memory.lastObservationResult = result;

        if (result === OK) {
            memory.pendingRoomName = targetRoomName;
            memory.pendingTick = Game.time;
            memory.rotationIndex = nextObservation.nextIndex;
        }
        else {
            delete globalMemory.assignments[targetRoomName];
        }
    },

    getMemory: function (room) {
        if (!room.memory.observer)
            room.memory.observer = {};

        return room.memory.observer;
    },

    getGlobalMemory: function () {
        var observerMemory = Memory.observer;
        if (!observerMemory) {
            observerMemory = {};
            Memory.observer = observerMemory;
        }

        if (!observerMemory.rooms)
            observerMemory.rooms = {};

        if (!observerMemory.assignments)
            observerMemory.assignments = {};

        return observerMemory;
    },

    prepareTickState: function (globalMemory) {
        if (globalMemory.currentTick == Game.time)
            return;

        globalMemory.currentTick = Game.time;
        globalMemory.assignments = {};
    },

    flushObservationResult: function (observedByRoomName, memory, globalMemory) {
        var pendingRoomName = memory.pendingRoomName;
        if (!pendingRoomName)
            return;

        if (memory.pendingTick >= Game.time)
            return;

        var observedRoom = Game.rooms[pendingRoomName];
        if (observedRoom) {
            globalMemory.rooms[pendingRoomName] = this.summarizeRoom(observedRoom, observedByRoomName);
            memory.lastObservedRoomName = pendingRoomName;
            memory.lastObservedTick = Game.time;
        }

        delete memory.pendingRoomName;
        delete memory.pendingTick;
    },

    summarizeRoom: function (room, observedBy) {
        var summary = {
            roomName: room.name,
            observedAt: Game.time,
            observedBy: observedBy,
            sourceCount: room.find(FIND_SOURCES).length,
            hostileCount: 0,
            hostileAttackers: 0,
            lootCreeps: 0,
            lootResources: [],
            deposits: [],
            powerBank: null,
            hasInvaderCore: false
        };

        if (room.controller) {
            summary.controller = {
                my: room.controller.my,
                level: room.controller.level,
                owner: room.controller.owner ? room.controller.owner.username : null,
                reservationUsername: room.controller.reservation ? room.controller.reservation.username : null,
                reservationTicksToEnd: room.controller.reservation ? room.controller.reservation.ticksToEnd : null,
                safeMode: room.controller.safeMode || 0
            };
        }

        var minerals = room.find(FIND_MINERALS);
        if (minerals.length > 0)
            summary.mineralType = minerals[0].mineralType;

        var hostiles = room.find(FIND_HOSTILE_CREEPS, {
            filter: function (c) {
                return c.owner && c.owner.username != "";
            }
        });

        summary.hostileCount = hostiles.length;

        var lootResources = {};
        for (var i = 0; i < hostiles.length; i++) {
            var hostile = hostiles[i];
            if (hostile.getActiveBodyparts(ATTACK) > 0 ||
                hostile.getActiveBodyparts(RANGED_ATTACK) > 0 ||
                hostile.getActiveBodyparts(HEAL) > 0 ||
                hostile.getActiveBodyparts(WORK) >= 4) {
                summary.hostileAttackers++;
            }

            var hostileStore = hostile.store;
            if (!hostileStore)
                continue;

            var hasLoot = false;
            for (var resourceType in hostileStore) {
                var amount = hostileStore[resourceType];
                if (!amount || resourceType == RESOURCE_ENERGY)
                    continue;

                hasLoot = true;
                lootResources[resourceType] = true;
            }

            if (hasLoot)
                summary.lootCreeps++;
        }

        summary.lootResources = Object.keys(lootResources);

        var structures = room.find(FIND_STRUCTURES);
        for (var j = 0; j < structures.length; j++) {
            var structure = structures[j];
            if (structure.structureType == STRUCTURE_POWER_BANK) {
                summary.powerBank = {
                    id: structure.id,
                    hits: structure.hits,
                    power: structure.power,
                    ticksToDecay: structure.ticksToDecay
                };
            }
            else if (structure.structureType == STRUCTURE_INVADER_CORE) {
                summary.hasInvaderCore = true;
            }
        }

        var deposits = room.find(FIND_DEPOSITS);
        for (var k = 0; k < deposits.length; k++) {
            summary.deposits.push({
                id: deposits[k].id,
                depositType: deposits[k].depositType,
                cooldown: deposits[k].lastCooldown,
                ticksToDecay: deposits[k].ticksToDecay
            });
        }

        return summary;
    },

    getObservableRooms: function (room, memory) {
        if (!memory.observableRooms || !memory.observableRooms.length)
            memory.observableRooms = this.buildObservableRooms(room.name);

        return memory.observableRooms || [];
    },

    buildObservableRooms: function (roomName) {
        var parsed = this.parseRoomName(roomName);
        if (!parsed)
            return [];

        var rooms = [];
        for (var dx = -OBSERVER_RANGE; dx <= OBSERVER_RANGE; dx++) {
            for (var dy = -OBSERVER_RANGE; dy <= OBSERVER_RANGE; dy++) {
                if (dx === 0 && dy === 0)
                    continue;

                if (!this.isHighwayRoom(parsed.x + dx, parsed.y + dy))
                    continue;

                rooms.push(this.formatRoomName(parsed.x + dx, parsed.y + dy));
            }
        }

        return _.sortBy(rooms, function (targetRoomName) {
            return targetRoomName;
        });
    },

    getNextObservation: function (sourceRoomName, observableRooms, startIndex, globalMemory) {
        if (!observableRooms || observableRooms.length === 0)
            return null;

        var length = observableRooms.length;
        var safeIndex = startIndex % length;
        if (safeIndex < 0)
            safeIndex = 0;

        var bestCandidate = null;

        for (var offset = 0; offset < length; offset++) {
            var index = (safeIndex + offset) % length;
            var targetRoomName = observableRooms[index];

            if (!targetRoomName || targetRoomName == sourceRoomName)
                continue;

            if (!this.isInRange(sourceRoomName, targetRoomName))
                continue;

            var distance = Game.map.getRoomLinearDistance(sourceRoomName, targetRoomName);

            if (globalMemory.assignments[targetRoomName])
                continue;

            var observedRoom = globalMemory.rooms[targetRoomName];
            var observedAt = observedRoom && observedRoom.observedAt != null ? observedRoom.observedAt : -1;

            var candidate = {
                targetRoomName: targetRoomName,
                nextIndex: (index + 1) % length,
                observedAt: observedAt,
                distance: distance,
                offset: offset
            };

            if (!bestCandidate || this.isBetterObservationCandidate(candidate, bestCandidate))
                bestCandidate = candidate;
        }

        return bestCandidate;
    },

    isBetterObservationCandidate: function (candidate, currentBest) {
        if (candidate.observedAt != currentBest.observedAt)
            return candidate.observedAt < currentBest.observedAt;

        if (candidate.distance != currentBest.distance)
            return candidate.distance < currentBest.distance;

        if (candidate.offset != currentBest.offset)
            return candidate.offset < currentBest.offset;

        return candidate.targetRoomName < currentBest.targetRoomName;
    },

    isInRange: function (sourceRoomName, targetRoomName) {
        return Game.map.getRoomLinearDistance(sourceRoomName, targetRoomName) <= OBSERVER_RANGE;
    },

    parseRoomName: function (roomName) {
        var match = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName);
        if (!match)
            return null;

        var x = parseInt(match[2], 10);
        var y = parseInt(match[4], 10);

        if (match[1] == 'W')
            x = -x - 1;

        if (match[3] == 'N')
            y = -y - 1;

        return { x: x, y: y };
    },

    isHighwayRoom: function (x, y) {
        var sectorX = x >= 0 ? x : -x - 1;
        var sectorY = y >= 0 ? y : -y - 1;
        return sectorX % 10 === 0 || sectorY % 10 === 0;
    },

    formatRoomName: function (x, y) {
        var horizontal = x >= 0 ? 'E' + x : 'W' + (-x - 1);
        var vertical = y >= 0 ? 'S' + y : 'N' + (-y - 1);
        return horizontal + vertical;
    }
};

module.exports = roleObserver;
