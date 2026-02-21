var utils = require("utils");

var roomPlanning = {
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

            var code = room.createConstructionSite(flag.pos, strType, "spawn_" + Game.time);

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


        var name = undefined;

        if (structureType == STRUCTURE_SPAWN)
            name = "spawn_" + Game.time;

        //if (room.name == "E48S23")
        //    console.log("Trying to build ", structureType, " in ", room.name, " at ", pos, " with name ", name);

        var code = pos.createConstructionSite(structureType, name);

        if (OK == code) {
            return true;
        }
        else {

            //if (room.name == "E48S23")
            //    console.log("Cant build", structureType, "in", room.name, " at ", pos, ":", utils.getError(code));

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


        var nearByContainer = to.pos.findInRange(FIND_STRUCTURES, range + 1, {
            filter: s => s.structureType == STRUCTURE_CONTAINER
        })[0];


        var nearByContainerSite = to.pos.findInRange(FIND_CONSTRUCTION_SITES, range + 1, {
            filter: s => s.structureType == STRUCTURE_CONTAINER
        })[0];


        //this.drawPath(roadPath, room);

        // build only after container exists?
        if (nearByContainer) {
            if (buildEnabled) {
                // i want more stable roads so need to see if there is a construction site of
                //  road and if exists in +1 range do not build new
                var newRoad = from.pos.findPathTo(nearByContainer, { ignoreCreeps: true, heuristicWeight: 1.1 });

                for (var step of newRoad) {
                    this.tryBuild(STRUCTURE_ROAD, new RoomPosition(step.x, step.y, room.name), room);
                }
            }
        }

        var nearByLink = to.pos.findInRange(FIND_STRUCTURES, range + 1, {
            filter: s => s.structureType == STRUCTURE_LINK
        })[0];


        if (nearByLink && nearByContainer) {
            nearByContainer.destroy();
        }

        if (nearByLink)
            return;

        // need to repair roads still
        if ((nearByContainer || nearByContainerSite) && !buildLink)
            return;


        var roadPath = utils.getPathMultiroom(from, to, range);
        //var roadPath = from.pos.findPathTo(to, { range: range, ignoreCreeps: true });
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
        // e - Extension P - spawn ( reference point)
        // s - Storage t - tower c - container . - empty space l - link
        // b - lab m - terminal

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
            "...ere...",
            "....e....",
            ".........",
            "........."
        ];

        var pattern3 = [
            "...r.r...",
            "..r.c.rt.",
            "..erPre..",
            "..eeree..",
            "..erere..",
            "....e....",
            ".........",
            "........."
        ];

        var pattern4 = [
            "...........",
            "...........",
            "....r.r....",
            "...rsr.rt..",
            "...erPrer..",
            "..eeereeer.",
            "...ererere.",
            "...reeeree.",
            "....rer.r.."
        ];

        var pattern5 = [
            ".............",
            "..r.......r..",
            ".rer.r.r.rer.",
            "reetrsrlrteer",
            ".rererPrerer.",
            "..reeereeer..",
            "...rerererer.",
            "....reeereeer",
            "...r.rer.rer.",
            "..r...r...r.."
        ];

        var pattern6 = [
            ".............",
            "..r...rbb.r..",
            ".rer.rmrbrer.",
            "reetrsrlrteer",
            ".rererPrerer.",
            "..reeereeer..",
            ".rererererer.",
            "reeereeereeer",
            ".rer.rer.rer.",
            "..r...r...r.."
        ];

        // for 1
        const patterns = [pattern5, pattern1, pattern2, pattern3, pattern4, pattern5, pattern6];

        var pattern = patterns[room.controller.level];
        // find spawn or spawn construction site at pos 
        var showAll = !buildEnabled;
        if (!pattern || showAll)
            pattern = patterns[patterns.length - 1]; // default to max

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

                // Check for purple flag
                var flags = checkPos.lookFor(LOOK_FLAGS);
                if (flags.some(f => f.color == COLOR_PURPLE))
                    continue;



                // Determine structure type and color based on cell letter
                const cellMap = {
                    'P': STRUCTURE_SPAWN,
                    'e': STRUCTURE_EXTENSION,
                    's': STRUCTURE_STORAGE,
                    't': STRUCTURE_TOWER,
                    'c': STRUCTURE_CONTAINER,
                    'r': STRUCTURE_ROAD,
                    'l': STRUCTURE_LINK,
                    'b': STRUCTURE_LAB,
                    'm': STRUCTURE_TERMINAL
                };
                var structureType = cellMap[cell];

                if (!structureType) {

                    console.log("Unknown cell type ", cell, " at ", worldX, ",", worldY);
                    room.visual.circle(checkPos, {
                        radius: 0.7,
                        stroke: 'red'
                    });

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


        // to do - fix container definition in range 2 not 4 which is too far away and can cause bad beahviour
        // plus we mean here
        if (buildEnabled) {
            if (room.storage && room.storage.container)
                room.storage.container.destroy();


            //room.links.forEach(link => { if (link.container) link.destroy(); });

        }


    }
    ,
    roomPlan: function (room) {


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



        this.tryExtensions(room, spawnPoint, buildEnabled);

        if (room.controller.level >= 2) {
            var sources = room.find(FIND_SOURCES).sort(
                (a, b) => a.pos.getRangeTo(spawnPoint) - b.pos.getRangeTo(spawnPoint)
            );

            var linkUnlocked = room.controller.level >= 5;


            this.tryRoad(spawnPoint, sources[0], room, 1, buildEnabled);
            this.tryRoad(spawnPoint, sources[1], room, 1, buildEnabled, buildLink = linkUnlocked);

            this.tryRoad(spawnPoint, room.controller, room, 3, buildEnabled);
        }




        if (buildEnabled) {
            //remove roads under non-walkable structures

            var structures = room.find(FIND_STRUCTURES, {
                filter: s => (
                    s.structureType != STRUCTURE_ROAD &&
                    s.structureType != STRUCTURE_CONTAINER &&
                    s.structureType != STRUCTURE_RAMPART
                )
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

    }
};


module.exports = roomPlanning;