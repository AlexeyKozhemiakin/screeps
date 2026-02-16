// Structure Prototypes
StructureContainer.prototype.isOperating = function () {
    var dels = _.filter(Game.creeps, d => d.memory.role == "deliverer" && d.memory.preferredTargetId == this.id);
    var dels2 = _.filter(Game.creeps, d => d.memory.role == "deliverer" && d.memory.preferredSourceId == this.id);
    var value = dels.length > 0 || dels2.length > 0

    return value || this.store[RESOURCE_ENERGY] > 1000;
};

StructureLink.prototype.isOperating = function () {
    return true;
};

StructureStorage.prototype.isOperating = function () {
    return true;
};

Source.prototype.isOperating = function () {
    var dels = _.filter(Game.creeps, d => d.memory.role == "harvester" && d.memory.preferredSourceId == this.id);

    return dels.length > 0;
};

Source.prototype.slots = function () {
    var array = this.room.lookForAtArea(LOOK_TERRAIN, this.pos.y - 1, this.pos.x - 1, this.pos.y + 1, this.pos.x + 1, true);

    var len = _.filter(array, p => p.terrain != 'wall').length;

    return len;
};

// Room Prototypes
Object.defineProperty(Room.prototype, 'extractor', {
    get: function () {
        return this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR } })
        [0];
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(RoomObject.prototype, 'isNearBase', {
    get: function () {
        return this.pos.findInRange(FIND_MY_STRUCTURES, 2, {
            filter: s => (s.structureType == STRUCTURE_EXTENSION ||
                s.structureType == STRUCTURE_SPAWN || s.structureType == STRUCTURE_STORAGE)
        }).length > 0;
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'links', {
    get: function () {
        return this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_LINK } });
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'labs', {
    get: function () {
        return this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } });
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'extensions', {
    get: function () {
        return this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } });
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'spawn', {
    get: function () {
        return this.spawns[0];
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'spawns', {
    get: function () {
        return this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } });
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'towers', {
    get: function () {
        return this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'config', {
    get: function () {
        if (!Memory.rooms[this.name].config)
            Memory.rooms[this.name].config = new Object();

        return Memory.rooms[this.name].config;
    },

    set: function (conf) {
        return Memory.rooms[this.name].config = conf;
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(RoomObject.prototype, 'container', {
    get: function () {
        var closest = this.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER } })[0]

        if (closest == undefined)
            closest = this.pos.findInRange(FIND_STRUCTURES, 3, { filter: { structureType: STRUCTURE_CONTAINER } })[0]

        if (closest == undefined)
            closest = this.pos.findInRange(FIND_STRUCTURES, 4, { filter: { structureType: STRUCTURE_CONTAINER } })[0]

        return closest
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(RoomObject.prototype, 'storage', {
    get: function () {
        return this.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_STORAGE } })
        [0];
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'mineral', {

    get: function () {
        return this.find(FIND_MINERALS)[0];
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'basecontainer', {

    get: function () {
        return this.spawn.pos.findInRange(FIND_STRUCTURES, 4, { filter: { structureType: STRUCTURE_CONTAINER } })
        [0];
    },

    enumerable: false,
    configurable: true
});


Object.defineProperty(StructureController.prototype, "storage", {

    get: function () {
        return this.pos.findInRange(FIND_STRUCTURES, 4, { filter: { structureType: STRUCTURE_STORAGE } })
        [0];
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(StructureController.prototype, "link", {

    get: function () {
        return this.pos.findInRange(FIND_STRUCTURES, 3, { filter: { structureType: STRUCTURE_LINK } })
        [0];
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(RoomObject.prototype, "link", {

    get: function () {
        return this.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_LINK } })
        [0];
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(StructureLab.prototype, 'mineralDemand', {

    get: function () {
        if (!this.room.memory.labDemand) {
            this.room.memory.labDemand = {};
        }
        return this.room.memory.labDemand[this.id] || null;
    },

    set: function (mineral) {
        if (!this.room.memory.labDemand) {
            this.room.memory.labDemand = {};
        }
        this.room.memory.labDemand[this.id] = mineral;
    },

    enumerable: false,
    configurable: true
});