// Autonomous factory manager (no creep needed - runs per room like role.tower)
//
// Memory contract:
//   room.memory.factoryDemand = {
//       factoryId : string          -- id of the factory structure
//       type      : string          -- resource type deliverers should bring in
//       amount    : number          -- desired fill level for that resource in the factory
//   }
//   (null/undefined when factory has nothing to do)
//
// Deliverers read room.memory.factoryDemand using the same pattern as lab.mineralDemand

// Map of raw mineral -> tier-0 bar product.
// Values match the COMMODITIES constant keys used by factory.produce().
var MINERAL_TO_BAR = {
    'U': 'utrium_bar',
    'L': 'lemergium_bar',
    'K': 'keanium_bar',
    'Z': 'zynthium_bar',
    'O': 'oxidant',
    'H': 'reductant',
    'X': 'purifier',
    'G': 'ghodium_melt'
};

// Minimum combined storage+terminal amount of a raw mineral before we start
// converting it to bars.
var PRODUCTION_THRESHOLD = 50000;

// How much of the ingredient we want inside the factory at one time.
// 500 is one batch; keeping 1500 keeps the factory busy through two cooldowns.
var FACTORY_INGREDIENT_WATERMARK = 1500;

// Minimum energy in storage before we start making batteries (fallback when no mineral qualifies).
var BATTERY_ENERGY_THRESHOLD = 500000;
// Each battery batch needs 600 energy; keep ~5 batches loaded.
var FACTORY_BATTERY_ENERGY_WATERMARK = 3000;

var roleFactory = {

    // -----------------------------------------------------------------------
    // Core entry point - call once per room per tick from main.js
    // -----------------------------------------------------------------------
    run: function (room) {
        if (!room.controller || !room.controller.my)
            return;

        var factory = this.getFactory(room);
        if (!factory) {
            return;
        }
        if (!factory.isActive()) {
            return;
        }

        var selected = this.selectProduction(room, factory);

        if (!selected) {
            room.memory.factoryDemand = null;
            return;
        }

        // Keep demand fresh so deliverers know what to bring
        this.updateDemand(room, factory, selected);

        // Attempt to produce every tick; factory ignores ERR_BUSY/cooldown
        this.attemptProduce(factory, selected.product);
    },

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    getFactory: function (room) {
        var factories = room.find(FIND_MY_STRUCTURES, {
            filter: function (s) { return s.structureType === STRUCTURE_FACTORY; }
        });
        return factories.length > 0 ? factories[0] : null;
    },

    // Return { mineral, product } for the first raw mineral that is above the
    // production threshold, or null if nothing qualifies.
    selectProduction: function (room, factory) {
        var storage  = room.storage;
        var terminal = room.terminal;

        for (var mineral in MINERAL_TO_BAR) {
            var total = 0;
            if (storage)  total += storage.store[mineral]  || 0;
            if (terminal) total += terminal.store[mineral] || 0;
            // also count what is already in the factory
            total += factory.store[mineral] || 0;

            if (total < PRODUCTION_THRESHOLD)
                continue;

            var product = MINERAL_TO_BAR[mineral];

            // Make sure the COMMODITIES entry exists (factory level check not
            // needed for tier-0 bars, but guard anyway).
            if (!COMMODITIES || !COMMODITIES[product])
                continue;

            return { mineral: mineral, product: product };
        }

        // Fallback: convert excess energy to batteries
        if (COMMODITIES && COMMODITIES['battery']) {
            var energyTotal = 0;
            if (storage)  energyTotal += storage.store[RESOURCE_ENERGY]  || 0;
            if (terminal) energyTotal += terminal.store[RESOURCE_ENERGY] || 0;
            if (energyTotal >= BATTERY_ENERGY_THRESHOLD)
                return { mineral: RESOURCE_ENERGY, product: 'battery' };
        }

        return null;
    },

    // Write factoryDemand so deliverers know which resource to bring in.
    updateDemand: function (room, factory, selected) {
        var watermark = selected.mineral === RESOURCE_ENERGY
            ? FACTORY_BATTERY_ENERGY_WATERMARK
            : FACTORY_INGREDIENT_WATERMARK;
        room.memory.factoryDemand = {
            factoryId : factory.id,
            type      : selected.mineral,
            amount    : watermark
        };
    },

    // Call factory.produce() if ingredients are available.
    attemptProduce: function (factory, product) {
        if (factory.cooldown > 0)
            return;

        var components = COMMODITIES[product] && COMMODITIES[product].components;
        if (!components)
            return;

        // Verify the factory has all required components
        for (var resType in components) {
            var needed = components[resType];
            if ((factory.store[resType] || 0) < needed)
                return; // wait for deliverer to top up
        }

        var result = factory.produce(product);
        if (result !== OK && result !== ERR_BUSY && result !== ERR_TIRED && result !== ERR_NOT_ENOUGH_RESOURCES) {
            console.log('[factory] produce error in ' + factory.room.name + ' (' + product + '): ' + result);
        }
    }
};

module.exports = roleFactory;
