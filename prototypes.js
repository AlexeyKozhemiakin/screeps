Source.prototype.slots = function () {
    var array = this.room.lookForAtArea(LOOK_TERRAIN, this.pos.y - 1, this.pos.x - 1, this.pos.y + 1, this.pos.x + 1, true);

    var len = _.filter(array, p => p.terrain != 'wall').length;

    return len;
};

// Room Prototypes
Object.defineProperty(Room.prototype, 'extractor', {
    get: function () {
        if (this._extractorTick !== Game.time) {
            this._extractor = this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR } })[0];
            this._extractorTick = Game.time;
        }
        return this._extractor;
    },

    enumerable: false,
    configurable: true
});

// Room Prototypes
Object.defineProperty(Room.prototype, 'terminal', {
    get: function () {
        if (this._terminalTick !== Game.time) {
            this._terminal = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TERMINAL } })[0];
            this._terminalTick = Game.time;
        }
        return this._terminal;
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(RoomObject.prototype, 'isNearBase', {
    get: function () {
        if (this._isNearBaseTick !== Game.time) {
            this._isNearBase = this.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                filter: s => (s.structureType == STRUCTURE_EXTENSION ||
                    s.structureType == STRUCTURE_SPAWN || s.structureType == STRUCTURE_STORAGE)
            }).length > 0;
            this._isNearBaseTick = Game.time;
        }
        return this._isNearBase;
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'links', {
    get: function () {
        if (this._linksTick !== Game.time) {
            this._links = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK } });
            this._linksTick = Game.time;
        }
        return this._links;
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'labs', {
    get: function () {
        if (!this._labs || this._labsTick !== Game.time) {
            this._labs = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } });
            this._labsTick = Game.time;
        }
        return this._labs;
    },
    enumerable: false,
    configurable: true
});

Room.prototype.getResourceAmount = function (resourceType) {
    var total = 0;

    if (!resourceType) return total;

    if (this.terminal) {
        total += this.terminal.store.getUsedCapacity(resourceType) || 0;
    }

    if (this.storage) {
        total += this.storage.store.getUsedCapacity(resourceType) || 0;
    }

    total += _.sum(this.labs, function (lab) {
        return lab.store.getUsedCapacity(resourceType) || 0;
    });

    var creeps = this.find(FIND_MY_CREEPS, {
        filter: function (creep) {
            return creep.memory.role === 'deliverer' && creep.store.getUsedCapacity(resourceType) > 0;
        }
    });

    total += _.sum(creeps, function (creep) {
        return creep.store.getUsedCapacity(resourceType) || 0;
    });

    return total;
};

Object.defineProperty(Room.prototype, 'extensions', {
    get: function () {
        if (this._extensionsTick !== Game.time) {
            this._extensions = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } });
            this._extensionsTick = Game.time;
        }
        return this._extensions;
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
        if (this._spawnsTick !== Game.time) {
            this._spawns = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } });
            this._spawnsTick = Game.time;
        }
        return this._spawns;
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'towers', {
    get: function () {
        if (this._towersTick !== Game.time) {
            this._towers = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
            this._towersTick = Game.time;
        }
        return this._towers;
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'config', {
    get: function () {
        if (!Memory.rooms[this.name])
            Memory.rooms[this.name] = {};
        if (!Memory.rooms[this.name].config)
            Memory.rooms[this.name].config = new Object();

        return Memory.rooms[this.name].config;
    },

    set: function (conf) {
        if (!Memory.rooms[this.name])
            Memory.rooms[this.name] = {};
        return Memory.rooms[this.name].config = conf;
    },
    enumerable: false,
    configurable: true
});

Object.defineProperty(RoomObject.prototype, 'container', {
    get: function () {
        if (this._containerTick !== Game.time) {
            this._container = this.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER } })[0];
            this._containerTick = Game.time;
        }
        return this._container;
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(StructureController.prototype, 'container', {
    get: function () {
        if (this._containerTick !== Game.time) {
            var closest = this.pos.findInRange(FIND_STRUCTURES, 4, { filter: { structureType: STRUCTURE_CONTAINER } })[0]

            if (closest == undefined)
                closest = this.pos.findInRange(FIND_STRUCTURES, 3, { filter: { structureType: STRUCTURE_CONTAINER } })[0]

            if (closest == undefined)
                closest = this.pos.findInRange(FIND_STRUCTURES, 4, { filter: { structureType: STRUCTURE_CONTAINER } })[0]

            this._container = closest;
            this._containerTick = Game.time;
        }
        return this._container;
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(RoomObject.prototype, 'storage', {
    get: function () {
        if (this._storageTick !== Game.time) {
            this._storage = this.pos.findInRange(FIND_MY_STRUCTURES, 2, { filter: { structureType: STRUCTURE_STORAGE } })[0];
            this._storageTick = Game.time;
        }
        return this._storage;
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(Room.prototype, 'mineral', {

    get: function () {
        if (this._mineralTick !== Game.time) {
            this._mineral = this.find(FIND_MINERALS)[0];
            this._mineralTick = Game.time;
        }
        return this._mineral;
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(StructureController.prototype, "storage", {

    get: function () {
        if (this._storageTick !== Game.time) {
            this._storage = this.pos.findInRange(FIND_MY_STRUCTURES, 4, { filter: { structureType: STRUCTURE_STORAGE } })[0];
            this._storageTick = Game.time;
        }
        return this._storage;
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(StructureController.prototype, "link", {

    get: function () {
        if (this._linkTick !== Game.time) {
            var link = this.pos.findInRange(FIND_MY_STRUCTURES, 2, { filter: { structureType: STRUCTURE_LINK } })[0];

            if (link == undefined)
                link = this.pos.findInRange(FIND_MY_STRUCTURES, 4, { filter: { structureType: STRUCTURE_LINK } })[0];

            this._link = link;
            this._linkTick = Game.time;
        }
        return this._link;
    },

    enumerable: false,
    configurable: true
});

Object.defineProperty(RoomObject.prototype, "link", {

    get: function () {
        if (this._linkTick !== Game.time) {
            this._link = this.pos.findInRange(FIND_MY_STRUCTURES, 2, { filter: { structureType: STRUCTURE_LINK } })[0];
            this._linkTick = Game.time;
        }
        return this._link;
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