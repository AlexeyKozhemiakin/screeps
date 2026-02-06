var roleHarvester = require('role.harvester');
var roleMineralHarvester = require('role.mineralHarvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleDeliverer = require('role.deliverer');
var roleClaim = require('role.claim');
var roleAttack = require('role.attack');
var roleReserve = require('role.reserve');
var roleScout = require('role.scout');

const RICH_ROOM_ENERGY = 8000;

var utils = {

    roomGetSpawnOrders: function (requestedRooms) {

        // add safemode calculation threshold

        var roomsNotClaimed = _.filter(requestedRooms, roomName => {
            var room = Game.rooms[roomName];
            if (!room)
                return false; // need visibility first

            //console.log(roomName," controller is ", Game.rooms[roomName].controller.my);
            var mine = room.controller.my;
            var lvl = room.controller.level;
            //console.log(room.name, mine, lvl, CONTROLLER_DOWNGRADE[lvl] ,room.controller.ticksToDowngrade );
            if (room.controller.safeMode)
                return true;

            if (room.controller.my)
                return false;

            if (room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[lvl] * 0.9)
                return false;

            return true;

        });

        var roomsNeedScout = _.filter(requestedRooms, roomName => {
            var room = Game.rooms[roomName];

            if (room) {
                // no need to scout owned rooms
                if (room.controller && room.controller.my)
                    return false;

                //  need to scout with agressive scout rooms with walls around controller
                var walls = room.controller.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType == STRUCTURE_WALL });
                if (walls.length > 0) {
                    room.memory.dangerous = true;
                    return true;
                }
                // need to scout rooms with owner different than us until it becomes neutral
                if (room.controller.owner && room.controller.username != "Zenga") {
                    // downgrade not yet ready need to wait
                    room.memory.dangerous = room.find(FIND_HOSTILE_CREEPS).length > 0;

                    room.memory.timeWhenDowngrade = Game.time + room.controller.ticksToDowngrade;
                    room.memory.ungradeBlockedUntil = Game.time + room.controller.upgradeBlocked;
                    return true;
                }

                return false;
            }

            return true;
        });


        //console.log("needScout", roomsNeedScout, "notClaimed", roomsNotClaimed);

        var spawnOrder = new Object();

        for (var i in requestedRooms) {
            var roomName = requestedRooms[i];
            var room = Game.rooms[roomName];

            var bigRooms = _.filter(Game.rooms,
                r => r.controller && r.controller.my && r.name != roomName &&
                    r.storage && r.storage.store.energy >= 10000);

            var sponsorRoom = _.min(bigRooms,
                r => Game.map.getRoomLinearDistance(r.name, roomName));

            if (sponsorRoom == undefined) {
                console.log("No sponsor room found for ", roomName);
                continue;
            }

            spawnOrder.sponsorRoomName = sponsorRoom.name;
            //console.log(bigRooms.map(r => r.name).join(", "));
            //console.log("sponsorRoom for ", roomName, " is ", sponsorRoom.name);
            var scouts = _.filter(Game.creeps, c => c.memory.role == "scout" &&
                (c.memory.toGo && c.memory.toGo[0] == roomName));
            var numScout = 1;

            if (roomsNeedScout.includes(roomName)) {
                if (scouts.length < numScout) {
                    spawnOrder.scoutRoom = roomName;
                    return spawnOrder;
                }
                continue; // to next room
            }

            var claimers = _.filter(Game.creeps, c => c.memory.role == "claim" && (c.memory.toGo && c.memory.toGo[0] == roomName));
            var numClaim = 1;
            if (roomsNotClaimed.includes(roomName) && claimers.length < numClaim) {
                spawnOrder.claimRoom = roomName;
                return spawnOrder;
            }

            var room = Game.rooms[roomName];
            if (!room)
                continue;

            if (!room.controller) // in what meaning? same as above? visibility check?
                continue;

            if (room.controller.safeMode) {
                console.log("room", roomName, " in safe mode for ", room.controller.safeModeCooldown);
                room.safeMode = room.controller.safeModeCooldown;
                continue;
            }

            // ok to build check condition
            if (!room.controller.my && room.controller.upgradeBlocked > 100) {
                console.log("room", roomName, " upgrade blocked for ", room.controller.upgradeBlocked);
                room.upgradeBlocked = room.controller.upgradeBlocked;
                continue;
            }
            // if(!room.controller.my)
            //   continue; 


            // build only spawns in remote rooms for now
            var roomSpawns = _.filter(Game.spawns, s => s.room.name == roomName);
            var spawnExists = roomSpawns.length > 0;
            if (spawnExists)
                continue;

            var constructionSites = room.find(FIND_CONSTRUCTION_SITES);
            var builders = _.filter(Game.creeps, c => c.memory.role == "builder" && (c.memory.toGo && c.memory.toGo[0] == roomName));
            var remoteBuildersLimit = 2;

            if (constructionSites.length > 0 && builders.length < remoteBuildersLimit) {
                console.log("needbuild external ", roomName);
                spawnOrder.buildRoom = roomName;
                return spawnOrder;
            }

            var enemyCreeps = room.find(FIND_HOSTILE_CREEPS);
            var enemyStructures = room.controller.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: object => (
                    object.structureType == STRUCTURE_WALL)
            });
            var attackers = _.filter(Game.creeps, c => c.memory.role == "attack" && (c.memory.toGo && c.memory.toGo[0] == roomName));
            var numAttack = 1;

            if (enemyCreeps.length > 0 && attackers.length < numAttack) {
                console.log("needAttack", roomName);
                spawnOrder.attackRoom = roomName;
                return spawnOrder;
            }
        }
    },

    roomAutoBuild: function (room) {
        var flags = room.find(FIND_FLAGS, { filter: f => (f.color == COLOR_PURPLE) });

        for (var flagNo in flags) {
            var flag = flags[flagNo];
            var strType;

            switch (flag.secondaryColor) {
                case COLOR_GREEN:
                    strType = STRUCTURE_EXTENSION;
                    break;
                case COLOR_ORANGE:
                    strType = STRUCTURE_STORAGE;
                    break;
                case COLOR_YELLOW:
                    strType = STRUCTURE_CONTAINER;
                    break;
                case COLOR_RED:
                    strType = STRUCTURE_TOWER;
                    break;
            }

            if (!strType)
                continue;

            var code = room.createConstructionSite(flag.pos, strType);

            if (OK == code) {
                flag.remove();
                return; // one at a time
            }
            else {
                //console.log("Cant build", strType, "in", room.name, ":", utils.getError(code));
            }
        }

    },

    tryBuild: function (structureType, pos, room) {
        if (room.lookForAt(LOOK_CONSTRUCTION_SITES, pos).length > 0)
            return false;

        var code = room.createConstructionSite(pos, structureType);
        if (OK == code) {
            return true;
        }
        else {
            //console.log("Cant build", structureType, "in", room.name, ":", utils.getError(code));
            return false;
        }
    },

    drawPath(roadPath, room, stroke = 'yellow') {
        for (var step of roadPath) {
            room.visual.circle(step.x, step.y,
                { fill: 'transparent', radius: 0.1, stroke: stroke });
        }
    },   

    tryRoad(from, to, room, range = 1, buildEnabled = false, buildLink = false) {
        if (from == undefined || to == undefined)
            return;


        var nearByLink = to.pos.findInRange(FIND_STRUCTURES, range + 1, {
            filter: s => s.structureType == STRUCTURE_LINK
        })[0];

 
        var nearByContainer = to.pos.findInRange(FIND_STRUCTURES, range + 1, {
            filter: s => s.structureType == STRUCTURE_CONTAINER
        })[0];

        if (nearByContainer == undefined)
            nearByContainer = to.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: s => s.structureType == STRUCTURE_CONTAINER
            })[0];

        var roadPath = from.pos.findPathTo(to, { range: range, ignoreCreeps: true, swampCost: 5 });
        this.drawPath(roadPath, room);
        // build only after container exists?
        if (nearByContainer) {
            if (buildEnabled) {
                for (var step of roadPath) {
                    this.tryBuild(STRUCTURE_ROAD, new RoomPosition(step.x, step.y, room.name), room);
                }
            }
        }

        // need to repair roads still
        if (nearByContainer && !buildLink)
            return;

        if (nearByLink && nearByContainer) {
            nearByContainer.destroy();
        }

        if (nearByLink)
            return;
        

        roadPath = roadPath.reverse();

        // if building nearby make 1 stp further, this is for containers
        // old fashioned way in some old rooms, this causing diagonal placement
        // and not efficient harvesting in the beginning and issues with placing of 
        var tick = 0;

        //container in 1st step
        if (roadPath.length > 1) {
            var containerPos = new RoomPosition(roadPath[tick].x, roadPath[tick].y, room.name);
            room.visual.circle(containerPos, { fill: 'transparent', radius: 0.3, stroke: 'blue' });

            // for links
            if (buildLink) {
                // look at area +- 1 step around roadPath[0] for plain\swamp but not road
                // check vertical and horizontal first
                // build in first which is not road and not container and not wall
                var rp = roadPath[0];
                var options = [
                    new RoomPosition(rp.x, rp.y - 1, room.name),
                    new RoomPosition(rp.x, rp.y + 1, room.name),
                    new RoomPosition(rp.x + 1, rp.y, room.name),
                    new RoomPosition(rp.x - 1, rp.y, room.name)
                ];
                for (var optNo in options) {
                    var optPos = options[optNo];
                    if (optPos.x < 1 || optPos.x > 48 || optPos.y < 1 || optPos.y > 48)
                        continue;

                    var lookAround = room.lookAt(optPos);
                    //console.log(room, JSON.stringify(lookAround));
                    var canBuildLink = lookAround.some(o => o.type == 'terrain' && (o.terrain == 'plain' || o.terrain == 'swamp')) &&
                        !lookAround.some(oo => oo.type == 'structure' &&
                            (oo.structure.structureType == STRUCTURE_ROAD ||
                                oo.structure.structureType == STRUCTURE_CONTAINER));

                    if (canBuildLink) {
                        room.visual.circle(optPos, { fill: 'transparent', radius: 0.3, stroke: 'orange' });
                        if (buildEnabled)
                            this.tryBuild(STRUCTURE_LINK, optPos, room);

                        break;
                    }
                }
            }


            if (buildEnabled && !nearByContainer && !buildLink)
                this.tryBuild(STRUCTURE_CONTAINER, containerPos, room);


        }
    },

    tryExtensions: function (room, point, buildEnabled = false) {
        var pos = point.pos;
        // 2D pattern array - each cell represents a position relative to spawn
        // e - ExtensionP - spawn ( reference point)
        // s - Storage t - tower c - container . - empty space l - link


        var pattern1 = [
            ".........",
            ".........",
            ".........",
            "....r....",
            "....P....",
            ".........",
            ".........",
            "........."
        ];

        var pattern2 = [
            ".........",
            "...r.r...",
            "..r.c.r..",
            "..erPre..",
            "..eere...",
            ".........",
            ".........",
            "........."
        ];

        var pattern3 = [
            "...r.r...",
            "..r.c.rt.",
            "..erPre..",
            "..eeree..",
            "..erere..",
            ".........",
            ".........",
            "........."
        ];

        var pattern4 = [
            ".........",
            ".........",
            "...r.r...",
            "..rsr.rt.",
            "..erPrer.",
            ".eeereee.",
            "..e.e.e..",
            "...eee...",
            "....e...."
        ];

        var pattern5 = [
            ".............",
            ".............",
            ".....r.r.....",
            "...trsrlrt...",
            "...rerPrer...",
            "..reeereeer..",
            "...rerererer.",
            "....reeereeer",
            "...r.rer.rer.",
            "..r...r...r.."
        ];

        // for 1
        const patterns = [pattern5, pattern1, pattern2, pattern3, pattern4, pattern5];

        var pattern = patterns[room.controller.level];
        // find spawn or spawn construction site at pos 
        var showAll = room.spawns.length == 0;
        if (!pattern || showAll)
            pattern = pattern5; // default to max

        // no spawns yet build only it
        if (showAll)
            buildEnabled = false;

        var terrain = room.getTerrain();

        // Find 'P' position in pattern to use as center reference
        var centerY = -1;
        var centerX = -1;
        for (var y = 0; y < pattern.length; y++) {
            var pIndex = pattern[y].indexOf('P');
            if (pIndex != -1) {
                centerY = y;
                centerX = pIndex;
                break;
            }
        }



        // Scan pattern array
        for (var y = 0; y < pattern.length; y++) {
            var row = pattern[y];
            for (var x = 0; x < row.length; x++) {
                var cell = row[x];

                if (cell == '.') // empty space
                    continue;

                if (cell == 'P') // skip spawn position - just for reference
                    continue;

                // Calculate world position
                var dx = x - centerX;
                var dy = y - centerY;
                var worldX = pos.x + dx;
                var worldY = pos.y + dy;


                // Check bounds
                if (worldX < 1 || worldX > 48 || worldY < 1 || worldY > 48)
                    continue;

                // Check terrain
                if (terrain.get(worldX, worldY) == TERRAIN_MASK_WALL)
                    continue;

                var checkPos = new RoomPosition(worldX, worldY, room.name);


                // Determine structure type and color based on cell letter
                var structureType = STRUCTURE_EXTENSION;

                if (cell == 'e') {
                    structureType = STRUCTURE_EXTENSION;
                }
                else if (cell == 's') {
                    structureType = STRUCTURE_STORAGE;
                }
                else if (cell == 't') {
                    structureType = STRUCTURE_TOWER;
                }
                else if (cell == 'c') {
                    structureType = STRUCTURE_CONTAINER;
                }
                else if (cell == 'r') {
                    structureType = STRUCTURE_ROAD;
                }
                else if (cell == 'l') {
                    structureType = STRUCTURE_LINK;
                }
                else {
                    console.log("Unknown cell type ", cell, " at ", worldX, ",", worldY);
                    continue; // unknown cell type
                }

                var color = 'red';
                var structures = checkPos.lookFor(LOOK_STRUCTURES);
                if (structures.some(s => s.structureType == structureType))
                    color = 'green';

                //console.log("Planned ", structureType, " at ", checkPos, " for cell ", cell, room.name);

                // Draw circle for visualization
                var needDraw = color != 'green';
                if (needDraw) {
                    room.visual.circle(checkPos, {
                        fill: 'transparent',
                        radius: 0.3,
                        stroke: color
                    });

                    room.visual.text(cell, checkPos.x, checkPos.y + 0.5 * 0.25,
                        { color: 'black', font: 0.5, opacity: 0.9, align: 'center', backgroundPadding: 20 });
                }
                // Build if enabled
                if (buildEnabled) {
                    this.tryBuild(structureType, checkPos, room);
                }
            }
        }
    }
    ,
    roomPlan: function (room) {

        if (room.name == "W51S24")
            this.tryRoad(room.storage, room.mineral, room, 1, false);


        var planEnabled = room.find(FIND_FLAGS, { filter: f => (f.name.includes("plan")) }).length > 0;
        if (!planEnabled)
            return;

        if (!room.controller)
            return;

        //console.log("Auto planning for room ", room.name, room.controller);
        var buildEnabled = room.find(FIND_FLAGS, { filter: f => (f.name.includes("build")) }).length > 0;

        var spawnPoint = room.find(FIND_FLAGS, { filter: f => (f.name.includes("spawn")) })[0];

        if (!spawnPoint && !room.spawn) {
            console.log("No spawn flag in ", room.name);
            return;
        }

        // if there is no flag and spawn already exists use it
        if (!spawnPoint)
            spawnPoint = room.spawn;


        var sources = room.find(FIND_SOURCES).sort(
            (a, b) => a.pos.getRangeTo(spawnPoint) - b.pos.getRangeTo(spawnPoint)
        );

        var linkUnlocked = room.controller.level >= 5;

        this.tryRoad(spawnPoint, sources[0], room, 1, buildEnabled);
        this.tryRoad(spawnPoint, sources[1], room, 1, buildEnabled, buildLink = linkUnlocked);

        this.tryRoad(spawnPoint, room.controller, room, 3, buildEnabled);
        this.tryExtensions(room, spawnPoint, buildEnabled);


        if (buildEnabled) {
            //remove roads under non-walkable structures
            var structures = room.find(FIND_STRUCTURES, {
                filter: s => (s.structureType != STRUCTURE_ROAD && s.structureType != STRUCTURE_CONTAINER)
            });

            for (var sNo in structures) {
                var struct = structures[sNo];
                var roads = struct.pos.findInRange(FIND_STRUCTURES, 0, {
                    filter: s => s.structureType == STRUCTURE_ROAD
                });

                for (var rNo in roads) {
                    roads[rNo].destroy();
                }
            }
        }


        if (room.controller.level >= 6 &&
            room.mineral)// && 
        //room.storage && room.storage.store.energy > RICH_ROOM_ENERGY * 3) {
        {
            if (!room.extractor) {
                this.tryBuild(STRUCTURE_EXTRACTOR, room.mineral, room);
            }

            this.tryRoad(room.storage, room.mineral, room, 1, buildEnabled);
        }

    },
    roomDraw: function (room) {
        //room.visual.clear();

        room.spawns.forEach(spawn => {
            if (spawn.spawning) {
                var spawningCreep = Game.creeps[spawn.spawning.name];
                spawn.room.visual.text(
                    '🛠️' + spawningCreep.memory.role,
                    spawn.pos.x + 1,
                    spawn.pos.y,
                    { align: 'left', opacity: 0.8 });
            }
        });

        var debugFlag = room.find(FIND_FLAGS, { filter: f => (f.name.includes("debug")) })[0];

        if (debugFlag) {


            var ignoreKeys = ["controllerProcessStats", "controllerEfficiency"];
            var messages = Object.keys(room.memory).map(key => {
                var value = room.memory[key];
                if( ignoreKeys.includes(key))
                    return;
                if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                return key + ": " + value;
            });

            for (var i = 0; i < messages.length; i++) {
                room.visual.text(messages[i],
                    debugFlag.pos.x + 1,
                    debugFlag.pos.y + 0.5 + i * 0.6,
                    {
                        align: 'left',
                        opacity: 0.8, font: 0.5, color: 'white'
                    });
            }

        }
        /*
        if(room.mineral) { 
            room.visual.text(
                '⏱️' + room.mineral.ticksToRegeneration,
                room.mineral.pos.x + 1, 
                room.mineral.pos.y, 
                {align: 'left', opacity: 0.8});
        }
        */

        /*
        var labs = room.find(FIND_STRUCTURES, {
                        filter: (lab) => {
                            return ((lab.structureType == STRUCTURE_LAB) && lab.isActive
                            && lab.mineralDemand);
                            }
                         });
                         
        _.forEach(labs, lab=>
            {
                //console.log("!!! ", lab);
                room.visual.text(
                        lab.mineralDemand,
                        lab.pos.x, 
                        lab.pos.y+0.22, 
                        {align: 'center', color:"#000000", opacity: 1});
            });
            
            
        */
    },

    roomMove: function (room) {
        //var isRoaded = (this.isRoaded(room.spawn, room.controller.container, room));
        //console.log("Room ", room.name, " roading to controller: ", isRoaded);

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
    },

    roomSpawn: function (room, spawnOrders) {
        

        var spawn = room.spawns.find(s => !s.spawning);

        if (spawn == undefined) {
            //console.log("no available spawn in room ", room.name);
            return;
        }

        var roomCreeps = _.filter(Game.creeps, cr => cr.room.name == room.name); // cannot use FIND_MY_CREEPS cause it's use spawning

        var harvesters = _.filter(roomCreeps, (creep) => creep.memory.role == 'harvester');
        var upgraders = _.filter(roomCreeps, (creep) => creep.memory.role == 'upgrader');
        var builders = _.filter(roomCreeps, (creep) => creep.memory.role == 'builder');
        var deliverers = _.filter(roomCreeps, (creep) => creep.memory.role == 'deliverer');
        var mineralHarvesters = _.filter(roomCreeps, (creep) => creep.memory.role == 'mineralHarvester');

        var extensions = _.filter(room.find(FIND_STRUCTURES), s => s.structureType == STRUCTURE_EXTENSION);

        var isEarlyGame = extensions.length < 5;
        room.memory.isEarlyGame = isEarlyGame;

        var mem = Object();
        var repl;
        var oldest;

        // replacement prep
        if (roomCreeps.length > 0 && room.controller.level >= 4) {
            var ups = _.filter(roomCreeps, (cr) =>
                (cr.memory.role == "harvester") &&
                (cr.getActiveBodyparts(WORK) >= 5) &&
                cr.memory.replaced != true
                && !cr.spawning);

            //console.log(room.name, ups);

            // to makesure number of workers is allowed, like numUpd for example


            oldest = _.sortBy(ups, ['ticksToLive'], ['asc'])[0];

            if (oldest && oldest.ticksToLive < 100) {
                var ticksToCreate = CREEP_SPAWN_TIME * oldest.body.length;

                var speed = 1.0; //TODO:calc based on parts - we assume it's roaded always
                var ticksToTravel = oldest.pos.findPathTo(spawn.pos, { ignoreCreeps: true }).length * speed;
                var estimate = oldest.ticksToLive - ticksToCreate - ticksToTravel;

                //if(estimate < 100)
                room.memory.planReplace = ticksToCreate + " + toTravel=" + ticksToTravel + " oldest=" + oldest.ticksToLive + " to replace " + oldest.name + " in=" + estimate;

                if (oldest.ticksToLive <= ticksToCreate + ticksToTravel) {
                    console.log("Preparing replacement for", oldest.name, oldest.ticksToLive);
                    //console.log(oldest.memory);
                    repl = Object.assign({}, oldest.memory); // shallow copy of current mem
                }
            }
            else {
                //console.log(room.name, " nothing matches replacement criteria");
            }
        }

        var externalSources = [];

        if (room.config.remoteHarvest) {
            room.config.remoteHarvest.forEach(roomName => {
                var remoteRoom = Game.rooms[roomName];
                if (!remoteRoom)
                    return; // need reserve it?

                var remoteSources = remoteRoom.find(FIND_SOURCES);

                if (remoteSources)
                    externalSources = externalSources.concat(remoteSources);
            }
            );
        }

        var reserveToGo = [];
        if (room.config.remoteHarvest) {
            room.config.remoteHarvest.forEach(roomName => {
                var remoteRoom = Game.rooms[roomName];
                var needReserve = false;

                if (remoteRoom && remoteRoom.controller.reservation) {
                    if (remoteRoom.controller.reservation.ticksToEnd < 1000) {
                        needReserve = true;
                    }
                }
                else {
                    needReserve = true;
                }

                var reservers = _.filter(Game.creeps, c => c.memory.role == "reserve" && c.memory.toGo && c.memory.toGo.includes(roomName));
                //console.log(room.name, needReserve, reservers);
                if (reservers.length == 0 && needReserve) {
                    reserveToGo.push(roomName);
                }

            });
        }

        var sources = room.find(FIND_SOURCES).concat(externalSources);

        var sortedSources = _.sortBy(sources, function (source) {
            var path = source.pos.findPathTo(spawn.pos, { ignoreCreeps: true }); // TODO:interoom path
            //console.log(path.length);
            return path.length;
        });



        for (var source of sortedSources) {
            const sourceId = source.id;

            // Get all attached harvesters for this source
            var attachedCreeps = _.filter(Game.creeps, function (cr) {
                return cr.memory.role == 'harvester' && cr.memory.preferredSourceId == sourceId;
            });

            // Sum the WORK parts of all attached creeps
            var attachedWorkParts = _.sum(attachedCreeps, cr => cr.getActiveBodyparts(WORK));

            //var source = sources[sourceIdx];
            var slots = source.slots();
            if (slots > 2)
                slots = 2;

            // for highly developed rooms - what?
            if (room.controller.level >= 3)
                slots = 1;

            // focus on builders before first extensions
            if (isEarlyGame)
                slots = 1;

            // Instead of checking creep count, check total WORK parts capacity
            // Assume we need 5 WORK parts per source when it's in one creep

            //console.log("Source ", sourceId, " has ", attachedWorkParts, " work parts attached, slots=", slots, " creepsCount=", attachedCreeps.length, " in room ", room.name);
            var hasContainer = source.container || source.storage || source.link;

            var needMore = attachedWorkParts < 4 && attachedCreeps.length < slots;
            //var needMore2 = !hasContainer && attachedCreeps.length < 2 * slots;


            if (needMore) {
                var pathLen = source.pos.findPathTo(spawn.pos, { ignoreCreeps: true }).length;

                if (pathLen > 15 && (!source.container && !source.link)) {
                    //console.log("skip harvesting long location without container. dist = ", pathLen, source.room);
                    room.visual.circle(source.pos, { fill: 'transparent', radius: 0.5, stroke: 'red' });
                    continue;
                }

                mem.role = 'harvester';
                mem.parts = this.getBodyParts(room.energyAvailable, hasContainer ? "harvesterContainer" : "harvester");

                if (source.room.name != room.name)
                    mem.parts = this.getBodyParts(1000, "remoteHarvester");

                mem.preferredSourceId = sourceId;

                // prefill preferred target id intead of logic in harvester
                break;
            }
        }


        // BUILDER PLANNING
        var buildSize = _.sum(room.find(FIND_CONSTRUCTION_SITES), site => site.progressTotal - site.progress);
        var needBuild = buildSize > 0;
        var numBld = 1;
        //console.log("Room ", room.name, " build size ", buildSize);
        // Why? priority to building instead of updating
        if (room.controller.level <= 4 && sources.length == 2) {
            numBld = 3;
        }

        // Why? - Increased building ok
        if (room.storage && room.storage.store.energy > RICH_ROOM_ENERGY && buildSize > 10000) {
            numBld = 2;
        }



        // UPGRADER PLANNING
        var numUpd = 2; // for 2 sources 

        if(room.name == "E56S23")
            numUpd = 1; // very harsh room, only 1 upgrader to save energy for building and harvesting
        
        if (sources.length == 1)
            numUpd = 1;

        /*
        if (room.basecontainer && room.basecontainer.store.energy > 1500 &&
            room.controller.level <= 3) {
            numUpd = 3;
        }
            */
        //console.log("Controller enery", room.controller.container ? room.controller.container.store.energy : 0);



        // do not upgrade if need build for small levels 
        // in reality it has to be more complex - check actual energy capacity
        // building is really killing rooms dont increaase it PLEASE
        var hasNoEnergy =
            (room.controller.container && room.controller.container.store.energy < 1000) ||
            (room.spawn.container && room.spawn.container.store.energy < 1000) ||
            (room.storage && room.storage.store.energy < 2000);

        var hasLotsOfEnergy =
            (room.controller.container && room.controller.container.store.energy > 1500) ||
            (room.spawn.container && room.spawn.container.store.energy > 1500) ||
            (room.storage && room.storage.store.energy > 15000);
        
        room.memory.hasNoEnergy = hasNoEnergy;
        room.memory.hasLotsOfEnergy = hasLotsOfEnergy;

        // do not upgrade if need build for poor rooms
        if (hasNoEnergy && needBuild &&
            room.controller.ticksToDowngrade > 2 * CREEP_LIFE_TIME) {
            numUpd = 0;
        }

        var hasEnoughSlots = room.name != "E52S22";
        if (hasLotsOfEnergy && hasEnoughSlots && !needBuild)
            numUpd += 1;


        // always upgrade to level 2
        if (room.controller.level == 1)
            numUpd = 1;




        // around spawn local deliverer
        // TODO: refactor spec delivers 1) change value to dynamic calculation
        if (mem.role == null) {
            var specDelivers = _.filter(deliverers, d => !d.memory.preferredSourceId);
            var size = 50; // rough estimage

            if (room.controller.level == 1)
                size = 0;

            if (room.controller.level >= 3)
                size = 100;

            if (room.controller.level >= 5)
                size = 200;

            // spawn
            // spawn.container
            // room.storage
            // room.terminal

            if (room.basecontainer || room.storage)
                if (specDelivers.length < 1) {
                    var roomSwpawnRoaded = room.controller.level >= 3;
                    if (roomSwpawnRoaded)
                        mem.parts = utils.getBodyParts(size * 1.5, "delivererLight");
                    else
                        mem.parts = utils.getBodyParts(size * 2, "deliverer");

                    mem.role = 'deliverer';
                }
        }

        // EXTERNAL SOURCE DELIVERER
        if (mem.role == null) {
            // TODO: only single!
            externalSources.forEach(externalSource => {
                var amnt = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME; // 3000/300 = 10 per sec

                //console.log("externalCoutnainer Ready", externalSource.container);
                if (externalSource && externalSource.container && !externalSource.link) {
                    var res = this.createDeliverer(externalSource.container.id, room.storage.id, amnt, RESOURCE_ENERGY);

                    if (res != null) {
                        mem = res;
                    }
                }
            });
        }

        // FROM SOURCE CONTAINER TO BASE
        if (mem.role == null) {
            sources.forEach(source => {
                if (source.isNearBase || !source.container || source.link) {
                    return;
                }

                // do not double deliver from controller container
                //console.log(room.controller.container, source.id);
                if (room.controller.container && source.container.id == room.controller.container.id)
                    return;

                var amnt = 5 * HARVEST_POWER;
                //console.log("externalCoutnainer Ready", externalSource.container);
                // reduce for small rooms cause harvesting is small


                // optimizations for small room -cause only 4 harvest parts can fit in 550 energy
                if (room.controller.level <= 2)
                    amnt = 4 * HARVEST_POWER;

                // optimizations for small room - for 2nd level even less is possible, maybe do not create deliverers at all 
                if (room.controller.level <= 2 && room.energyCapacityAvailable < 550)
                    amnt *= 0.5;


                // sometimes becuase of traffic deliverers fall behind and containers are overfilled
                // temporarily increase delivery amount
                if (source.container.store.energy > 1800)
                    amnt *= 1.2;

                var tgt;

                if (room.storage)
                    tgt = room.storage.id;
                else if (room.spawn.container)
                    tgt = room.spawn.container.id;
                else
                    tgt = room.spawn.id;

                var res = this.createDeliverer(source.container.id, tgt, amnt, RESOURCE_ENERGY);

                if (res && room.spawn && tgt == room.spawn.id)
                    res.preferredTargetId = undefined;

                if(res && room.spawn.container && tgt == room.spawn.container.id) 
                    res.preferredTargetId = undefined;

                
                if (res != null) {
                    mem = res;
                }
            });

        }

        // FROM BASE TO CONTROLLER

        if (mem.role == null && numUpd > 0) {
            if (room.controller.container &&
                (room.spawn.container || room.storage) &&
                !room.controller.storage &&
                !room.controller.link &&
                room.controller.container.store[RESOURCE_ENERGY] < 500) {

                // 
                var amnt = numUpd * 5 * UPGRADE_CONTROLLER_POWER;

                if (room.controller.pos.findInRange(FIND_SOURCES, 3).length > 0)
                    amnt = 5 * UPGRADE_CONTROLLER_POWER; // reduce if near source

                // if not two sources are active (have containers or links)

                var src;

                if (room.storage)
                    src = room.storage.id;
                else if (room.basecontainer)
                    src = room.basecontainer.id;

                var res = this.createDeliverer(src, room.controller.container.id, amnt, RESOURCE_ENERGY);


                //console.log("Created ", amnt, " for controller deliver", " room=", room.name, " src=", src, " target=", room.controller.container.id);

                if (res != null) {
                    mem = res;
                }
            }
        }


        // MINERAL HARVESTER
        var needMinerals = roleMineralHarvester.needHarvester(room) && 
                        room.storage.store[RESOURCE_ENERGY] > RICH_ROOM_ENERGY;

        room.memory.needMineralHarvester = needMinerals;
        
        // MINERAL deliverer
        if (mem.role == null) {
            if (mineralHarvesters.length > 0 &&
                 (_.sum(room.extractor.container.store) > CONTAINER_CAPACITY * 0.5)) {
                var amountPerSec = _.sum(_.map(mineralHarvesters, m => m.getActiveBodyparts(WORK))) * HARVEST_MINERAL_POWER / EXTRACTOR_COOLDOWN;

                var targetId = room.storage.id;
                var terminalWatermark = 0.8;
                if (room.terminal && _.sum(room.terminal.store) < terminalWatermark * room.terminal.storeCapacity)
                    targetId = room.terminal.id;

                var res = this.createDeliverer(room.extractor.container.id, targetId, amountPerSec);

                if (res != null)
                    mem = res;
            }
        }

        var needAttack = room.find(FIND_HOSTILE_CREEPS).length > 0 && room.towers.length == 0;
        var largeEnemies = room.find(FIND_HOSTILE_CREEPS,
            {
                filter: (c => c.getActiveBodyparts(ATTACK) > 10 ||
                    c.getActiveBodyparts(RANGED_ATTACK) > 10 && (c.owner.username != ""))
            });
        if (largeEnemies.length > 0)
            needAttack = true;

        if (room.config.remoteHarvest) {
            room.config.remoteHarvest.forEach(roomName => {
                var remoteRoom = Game.rooms[roomName];
                if (!remoteRoom)
                    return; // need reserve it?

                var enemies = remoteRoom.find(FIND_HOSTILE_CREEPS,
                    { filter: (c => c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) && (c.owner.username != "")) });
                var attackers = _.filter(Game.creeps, c => c.memory.role == "attack" && c.memory.toGo && c.memory.toGo.includes(roomName));

                if (enemies.length > 0 && attackers.length == 0) {
                    if (!attackToGo)
                        attackToGo = [];

                    attackToGo.push(roomName);
                }
            }
            );
        }

        // only builders allowed in early game
        if (isEarlyGame) {
            mem = new Object();
            if (builders.length < 6)
                mem.role = "builder";

            if (upgraders.length < 1 && mem.role == null) {
                mem.role = "upgrader";
            }
        }
        else if (needAttack) {
            mem = new Object();
            mem.role = "attack";
        }
        else if (spawnOrders && spawnOrders.attackRoom) {
            mem = new Object();
            mem.role = "attack";
            mem.toGo = [spawnOrders.attackRoom];
        }
        else if (mem.role != null) {
            // parts already created where?
        }
        else if (upgraders.length == 0 && upgraders.length < numUpd) {
            mem.role = 'upgrader';
            //if(room.energyCapacityAvailable >= 1800) // lightmovevemtn of upgrader
            //    mem.parts = this.getBodyParts(1800, 'upgraderLight2');
        }
        else if (needBuild && builders.length < numBld) {
            mem.role = "builder";
            // limit builder size to 1000 for better spawn times
            //mem.parts = this.getBodyParts(1000, 'builder');
        }
        else if (upgraders.length < numUpd) {
            mem.role = 'upgrader';

            if (this.isRoaded(spawn, room.controller.container, room)) {
                console.log("Upgrader light for roading in ", room.name);
                mem.parts = utils.getBodyParts(room.energyCapacityAvailable, "upgraderLight");
            }

            //if(room.energyCapacityAvailable >= 1800) // lightmovevemtn of upgrader
            //    mem.parts = this.getBodyParts(1800, 'upgraderLight2');
        }
        else if (mineralHarvesters.length < 1 && needMinerals) {
            mem.role = 'mineralHarvester';
        }
        else if (spawnOrders && spawnOrders.scoutRoom) {
            mem.role = 'scout';
            mem.parts = [MOVE];

            var scoutRoom = Game.rooms[spawnOrders.scoutRoom];
            var needAggressiveScout = scoutRoom && scoutRoom.memory.dangerous;
            if (needAggressiveScout)
                mem.parts = [MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK];

            mem.toGo = [spawnOrders.scoutRoom];
        }
        else if (repl) {
            console.log("creating replacement");
            mem = repl;
        }
        else if (spawnOrders && spawnOrders.claimRoom) {
            mem.role = "claim";
            mem.toGo = [spawnOrders.claimRoom];
        }
        else if (spawnOrders && spawnOrders.buildRoom) {
            mem.role = "builder";
            //mem.parts = this.getBodyParts(room.energyCapacityAvailable, 'remoteBuilder');
            mem.toGo = [spawnOrders.buildRoom];
        }
        else if (reserveToGo && reserveToGo.length > 0) {
            mem.role = "reserve";
            mem.toGo = reserveToGo;
        }

        var energyBudget = room.energyCapacityAvailable; // max possible

        if (room.energyAvailable <= 300 && !isEarlyGame) {

            room.memory.coldStart = true;

            if (mem.role == "deliverer" && deliverers.length == 0 && room.controller.level <= 6 && room.energyAvailable < 300) {

                // more proper amount
                mem.parts = [CARRY, MOVE]
                console.log(room.name, " low deliverer budget=", energyBudget);

            }

            if (roomCreeps.length < 3 || harvesters.length == 0) { //TODO poor harvester condition{
                energyBudget = room.energyAvailable; // use as min energy in start as possible
                console.log(room.name, " low creeps budget=", energyBudget);
                //mem.parts = [CARRY,  CARRY, MOVE, MOVE]
            }

            if (room.storage && room.storage.store[RESOURCE_ENERGY] > 1000 && deliverers.length == 0) {
                console.log(room.name, " low creeps budget deliverer=", energyBudget);
                energyBudget = room.energyAvailable;

                // create small local deliverer
                mem.role = "deliverer";
                mem.parts = [CARRY, CARRY, MOVE, MOVE];
                mem.preferredSourceId = undefined;
            }
        }
        else
            room.memory.coldStart = false;


        if (isEarlyGame)
            console.log(room.name, " Early game spawn plan: ", mem.role, " parts=", mem.parts);

        var string = "numUpd=" + numUpd +
            " numBld=" + numBld +
            " energyAvailable=" + room.energyAvailable +
            " energyCapacity=" + room.energyCapacityAvailable +
            " role=" + mem.role +

            " memory=" + JSON.stringify(mem);

        room.memory.planning = string;
        if (mem.role != undefined && !spawn.spawning) {
            //console.log(energyBudget);

            var parts = mem.parts;
            if (parts == undefined)
                parts = utils.getBodyParts(energyBudget, mem.role);

            mem.parts = parts;
            if (parts.length != 0) {
                var name = mem.role + Math.floor(Math.random()*10000);

                console.log(room.name, 'Spawning new creep: ', mem.role, name, " with parts ", parts, " energyBudget=", energyBudget);
                var code = spawn.spawnCreep(parts, name, { memory: mem });

                if (OK == code) {
                    //console.log(spawn.name + ' is spawning new : ' + mem.role + " with " + parts + " - " + code);
                    if (repl && oldest) {
                        oldest.memory.replaced = true;
                    }
                }
                else {
                    console.log(room.name, 'Spawn error: ' + utils.getError(code), " for ", mem.role, " parts=", parts);
                }
            }
            else {
                console.log(room.name, 'not enough money yet for ' + mem.role, " budget=", energyBudget);
            }
        }
    },

    isRoaded(from, target, room) {
        if (target == undefined || from == undefined)
            return false;


        //console.log("checking roading from ", pos, " to ", target);
        var path = from.pos.findPathTo(target, { range: 1, ignoreCreeps: true });



        return this.isPathRoaded(path, room)
    },


    isPathRoaded: function (path, room) {
        if (path.length <= 2)
            return true;

        //this.drawPath(path, room, 'blue');

        var roaded = _.every(path, p => {
            var look = room.lookForAt(LOOK_STRUCTURES, p.x, p.y);
            var yesRoad = look.some(s => s.structureType == STRUCTURE_ROAD)
            return yesRoad;
        });

        //sconsole.log("isPathRoaded =", roaded, " for ", path.length, " steps");
        return roaded;
    },

    getPathMultiroom: function (from, to, r = 1) {
        if (from.room.name == to.room.name)
            return to.pos.findPathTo(from.pos, { range: r, ignoreCreeps: true });

        let goals = _.map([to], function (s) {
            return { pos: s.pos, range: r };
        });

        let ret = PathFinder.search(from.pos, goals, {});

        return ret.path;
    }
    ,
    createDeliverer: function (fromId, toId, energyPerTick, resType) {
        if (fromId == toId)
            return null;

        var existing = _.filter(Game.creeps,
            d => d.memory.role == "deliverer" &&
                d.memory.preferredSourceId == fromId);

        // there are cases when we specify only source not target, to deliver everywhere on base
        //&&
        //d.memory.preferredTargetId == toId);

        var existingCapacity = _.sum(_.map(existing, e => e.getActiveBodyparts(CARRY) * CARRY_CAPACITY));

        var from = Game.getObjectById(fromId);
        var to = Game.getObjectById(toId);

        if (!from || !to) {
            console.log('deliverer: TO or FROM not exist', fromId, '->', toId);
            return null;
        }

        var path = this.getPathMultiroom(from, to);

        //console.log("cost analysis path", path);
        if (!path || path.length == 0) {
            console.log('deliverer cannot find path ', from.room, ' ', fromId, '->', toId);

            return null;
        }

        // -1 because path includes starting pos
        // +2 is turnaround delay tbd to remove it (currently 0)
        var travelTime = (path.length - 1) * 2 + 1;

        var pathRoaded = this.isPathRoaded(path, from.room);

        if (pathRoaded) {
            //console.log('deliverer all roaded ', fromId, '->', toId);
        }
        // travelTime += pathRoaded.length; // 1 tick per non-road
        var requiredCapacity = travelTime * energyPerTick;

        var remainingCapacity = requiredCapacity - existingCapacity;


        //if(requiredCapacity > existingCapacity)
        //console.log('deliverer capacity diff', fromId, '->', toId, ' required=', requiredCapacity, ' existing=', existingCapacity, ' remaining=', remainingCapacity);

        if (remainingCapacity <= 50 && resType == RESOURCE_ENERGY) {
            //console.log('deliverer already exists between ', fromId, '->', toId);
            return null;
        }

        var carryParts = Math.ceil(remainingCapacity / CARRY_CAPACITY);
        var moveParts = carryParts

        var parts = "deliverer";
        if (pathRoaded) {
            carryParts += carryParts % 2; // round up for roaded
            moveParts = Math.ceil(carryParts / 2);
            parts = "delivererLight";
        }

        var bodyPartsEnergy = carryParts * BODYPART_COST[CARRY] +
            moveParts * BODYPART_COST[MOVE];

        const room = to.room;

        if (bodyPartsEnergy > room.energyCapacityAvailable) {
            console.log("limiting data from to", bodyPartsEnergy, "->", room.energyCapacityAvailable);
            bodyPartsEnergy = room.energyCapacityAvailable;
        }

        console.log('deliverer creating new between ', fromId, '->', toId, ' carryParts=', carryParts, ' moveParts=', moveParts, ' bodyPartsEnergy=', bodyPartsEnergy, ' travelTime=', travelTime);
        var mem = new Object();
        mem.parts = utils.getBodyParts(bodyPartsEnergy, parts);
        mem.role = "deliverer";
        mem.preferredSourceId = fromId;
        mem.preferredTargetId = toId;
        mem.travelTime = travelTime;
        if (resType)
            mem.preferredResourceType = resType;

        return mem;
    }
    ,
    getError2: function (code) {
        var objprops = Object.getOwnPropertyNames(this).filter(n = n.startsWith("ERR_"));
    },

    getError: function (code) {
        switch (code) {
            case OK:
                // 0
                return "OK";
            case ERR_NOT_OWNER:
                // -1
                return "ERR_NOT_OWNER";
            case ERR_NO_PATH:
                // -2
                return "ERR_NO_PATH";
            case ERR_NAME_EXISTS:
                // -3
                return "ERR_NAME_EXISTS";
            case ERR_BUSY:
                //-4
                return "ERR_BUSY";
            case ERR_NOT_FOUND:
                // -5
                return "ERR_NOT_FOUND";
            case ERR_NOT_ENOUGH_ENERGY:
            case ERR_NOT_ENOUGH_RESOURCES:
            case ERR_NOT_ENOUGH_EXTENSIONS:
                // -6
                return "ERR_NOT_ENOUGH_";
            case ERR_INVALID_TARGET:
                // -7
                return "ERR_INVALID_TARGET";
            case ERR_FULL:
                // -8
                return "ERR_FULL";
            case ERR_NOT_IN_RANGE:
                // -9
                return "ERR_NOT_IN_RANGE";
            case ERR_INVALID_ARGS:
                // -10
                return "ERR_INVALID_ARGS";
            case ERR_TIRED:
                // -11
                return "ERR_TIRED";
            case ERR_NO_BODYPART:
                // -12
                return "ERR_NO_BODYPART";
            case ERR_RCL_NOT_ENOUGH:
                // -14
                return "ERR_RCL_NOT_ENOUGH";
        }
        return code + " code not found";
    }
    ,

    getBodyParts: function (currentEnergy, role) {
        console.log("getBodyParts for role ", role, " with energy ", currentEnergy);

        if (role == "claim")
            return [CLAIM, MOVE];

        if (role == "reserve")
            return [CLAIM, CLAIM, MOVE, MOVE];

        if (role == "upgraderLight2")
            return [WORK, WORK, WORK, WORK, WORK,
                WORK, WORK, WORK, WORK, WORK,
                WORK, WORK, WORK, WORK, WORK,
                CARRY, MOVE,
                MOVE, MOVE,
                MOVE, MOVE
            ];

        if (role == "remoteBuilder")
            return [
                [CARRY, MOVE,
                    CARRY, MOVE,
                    WORK, MOVE],
                [WORK, MOVE, WORK, MOVE]];

        var attackParts =
            [MOVE, ATTACK, ATTACK, ATTACK, TOUGH, TOUGH, TOUGH,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];

        var deliverParts = [
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY],
            [MOVE, CARRY]];

        var deliverLightParts = [
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY],
            [MOVE, CARRY, CARRY]];


        //var upgraderParts       = [MOVE, CARRY, WORK ,WORK ,WORK, WORK, WORK, MOVE, MOVE ,MOVE,MOVE];
        var upgraderParts = [
            [CARRY, MOVE],
            [WORK, MOVE],
            [WORK, MOVE],
            [WORK, WORK],
            [WORK, MOVE],
            [WORK, MOVE]];

        var upgraderLightParts = [CARRY, MOVE, WORK, WORK, WORK, WORK, WORK];

        var harvesterParts = [
            [CARRY, MOVE],
            [WORK, MOVE],
            [WORK, MOVE],
            [WORK, WORK],
            [WORK, MOVE],
            [WORK, MOVE]
        ];

        var harvesterContainerParts = [CARRY, MOVE, WORK, WORK, WORK, WORK, WORK,
            MOVE, MOVE];

        var remoteHarvesterParts = [MOVE, CARRY, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE];
        var mineralHarvesterParts = [MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];

        var parts = [MOVE, CARRY, WORK, WORK, WORK,
            MOVE, MOVE, CARRY, WORK, WORK,
            MOVE];

        // additional work would benefit on early game
        var builderParts = [
            [MOVE, WORK, MOVE, CARRY],
            [MOVE, WORK], [MOVE, CARRY],
            [MOVE, WORK], [MOVE, CARRY],
            [MOVE, WORK], [MOVE, CARRY],
            [MOVE, WORK], [MOVE, CARRY]
        ];

        if (role == 'attack') {
            parts = attackParts;
        }
        if (role == 'builder')
            parts = builderParts;

        if (role == "deliverer")
            parts = deliverParts;

        if (role == "upgraderLight")
            parts = upgraderLightParts;

        if (role == "delivererLight")
            parts = deliverLightParts;

        if (role == "mineralHarvester") {
            parts = mineralHarvesterParts;
            currentEnergy = this.getPartsCost(mineralHarvesterParts);
        }

        if (role == "remoteHarvester") {
            parts = remoteHarvesterParts;
            currentEnergy = this.getPartsCost(remoteHarvesterParts);
        }

        if (role == "upgrader") {
            parts = upgraderParts;
            if (currentEnergy > this.getPartsCost(upgraderParts))
                currentEnergy = this.getPartsCost(upgraderParts);
        }

        if (role == "harvester") {
            parts = harvesterParts;
            if (currentEnergy >= this.getPartsCost(harvesterParts)) {
                currentEnergy = this.getPartsCost(harvesterParts);
            }
        }

        if (role == "harvesterContainer") {

            parts = harvesterContainerParts;
        }

        // why? ok only with deliverer?
        if (currentEnergy < 300 && role != "deliverer" && role != "delivererLight")
            return [];

        console.log(role, ' get part for ' + currentEnergy, " ");
        return this.prefillParts(currentEnergy, parts);
    },

    prefillParts: function (budget, parts) {
        var res = [];

        // clone parts so we don't mutate caller's template arrays
        parts = parts.slice();

        while (budget > 0) {
            var next = parts[0];
            if (!next)
                break;

            // next can be either a single part (e.g. MOVE) or an array of parts (group)
            var partCost = 0;
            if (Array.isArray(next)) {
                for (var i = 0; i < next.length; i++) {
                    var p = next[i];
                    partCost += BODYPART_COST[p.toLowerCase()];
                }
            } else {
                partCost = BODYPART_COST[next.toLowerCase()];
            }

            if (budget < partCost)
                break;

            budget -= partCost;

            if (Array.isArray(next)) {
                // push all parts from the group in order
                for (var j = 0; j < next.length; j++) {
                    res.push(next[j]);
                }
            } else {
                res.push(next);
            }

            parts.shift();
        }
        console.log("  -> created parts: ", res, " total cost=", this.getPartsCost(res));
        return res.sort().reverse();
    },

    getPartsCost: function (parts) {
        var costs = _.map(parts, p => {
            // If p is an array (group of parts), sum the cost of each part in the group
            if (Array.isArray(p)) {
                return _.sum(_.map(p, part => BODYPART_COST[part.toLowerCase()]));
            } else {
                // If p is a single part, get its cost
                return BODYPART_COST[p.toLowerCase()];
            }
        });

        return _.sum(costs);
    },


};

module.exports = utils;

