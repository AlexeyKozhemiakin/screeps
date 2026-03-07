// Autonomous factory manager (no creep needed - runs per room like role.tower)
//
// Memory contract:
//   room.memory.factoryDemand = {
//       factoryId   : string          -- id of the factory structure
//       type        : string          -- resource type deliverers should bring in next
//       amount      : number          -- desired fill level for that resource in the factory
//       ingredients : [string]|undef  -- (multi-ingredient only) all input types to protect from egress
//   }
//   room.memory.factoryProductionTarget = string|null
//       Locks the factory onto one product (e.g. a bar) until the target
//       stock threshold is reached, preventing flip-flopping between minerals.
//       Same pattern as room.memory.productionTarget for labs.
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

// ---------- Higher-tier production ----------
// Recipes, component lists, levels and amounts are read from the runtime
// COMMODITIES constant — never hardcode recipe details.

// Minimum of each non-energy ingredient in storage+terminal+factory
// before we start producing a higher-tier product.
var HIGHER_TIER_INGREDIENT_THRESHOLD = 500;

// Target fill level per ingredient inside the factory (keeps ~several batches loaded).
var HIGHER_TIER_INGREDIENT_WATERMARK = 500;

// Products to attempt in priority order (highest tier first).
// Each entry: product key from COMMODITIES.
var HIGHER_TIER_PRODUCTS = ['composite'];

// Rooms allowed to produce higher-tier products. Empty array = all rooms allowed.
var HIGHER_TIER_ROOMS = ['E51S24'];

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

        console.log('[factory] ' + room.name + ' selected: ' + selected.product
            + ' | demand: ' + JSON.stringify(room.memory.factoryDemand));

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

    // Return { mineral, product } or { ingredients, product } for the best
    // recipe the factory should work on, or null if nothing qualifies.
    selectProduction: function (room, factory) {
        // --- Higher-tier products (composite, etc.) ---
        var higherResult = this.selectHigherTier(room, factory);
        if (higherResult)
            return higherResult;

        // --- Prerequisite bars for higher-tier ---
        // If the room is whitelisted for higher-tier production, prioritize
        // producing the bar ingredients that are below threshold before
        // falling through to the generic tier-0 loop.
        var prereqResult = this.selectPrerequisiteBar(room, factory);
        if (prereqResult)
            return prereqResult;

        // --- Tier-0: Raw mineral -> bar ---
        // Uses factoryProductionTarget to lock onto one bar until the raw
        // mineral drops below threshold (same pattern as lab productionTarget).
        var storage  = room.storage;
        var terminal = room.terminal;

        // Check locked target first
        var locked = room.memory.factoryProductionTarget;
        if (locked && MINERAL_TO_BAR[locked]) {
            // locked is a raw mineral key (e.g. 'U')
            var lockedMineral = locked;
            var lockedProduct = MINERAL_TO_BAR[lockedMineral];
            var lockedTotal = 0;
            if (storage)  lockedTotal += storage.store[lockedMineral]  || 0;
            if (terminal) lockedTotal += terminal.store[lockedMineral] || 0;
            lockedTotal += factory.store[lockedMineral] || 0;

            if (lockedTotal >= PRODUCTION_THRESHOLD && COMMODITIES && COMMODITIES[lockedProduct]) {
                return { mineral: lockedMineral, product: lockedProduct };
            }
            // Threshold no longer met — clear lock
            room.memory.factoryProductionTarget = null;
        }

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

            // Lock onto this mineral
            room.memory.factoryProductionTarget = mineral;
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

    // Try each product in HIGHER_TIER_PRODUCTS (priority order).
    // Recipe data comes entirely from the runtime COMMODITIES constant.
    // Returns { ingredients, product } or null.
    selectHigherTier: function (room, factory) {
        if (!COMMODITIES)
            return null;

        // Room whitelist check
        if (HIGHER_TIER_ROOMS.length > 0 && HIGHER_TIER_ROOMS.indexOf(room.name) === -1)
            return null;

        var storage  = room.storage;
        var terminal = room.terminal;

        for (var p = 0; p < HIGHER_TIER_PRODUCTS.length; p++) {
            var product = HIGHER_TIER_PRODUCTS[p];
            var recipe  = COMMODITIES[product];
            if (!recipe || !recipe.components)
                continue;

            // Check factory level requirement
            if (recipe.level && (!factory.level || factory.level < recipe.level))
                continue;

            // Verify every non-energy ingredient meets the threshold
            var components = recipe.components;
            var ingredientKeys = Object.keys(components);
            var viable = true;
            for (var i = 0; i < ingredientKeys.length; i++) {
                var ing = ingredientKeys[i];
                if (ing === RESOURCE_ENERGY)
                    continue; // energy is assumed available
                var total = 0;
                if (storage)  total += storage.store[ing]  || 0;
                if (terminal) total += terminal.store[ing] || 0;
                total += factory.store[ing] || 0;
                if (total < HIGHER_TIER_INGREDIENT_THRESHOLD) {
                    viable = false;
                    break;
                }
            }
            if (!viable)
                continue;

            return {
                ingredients: ingredientKeys,
                product: product
            };
        }

        return null;
    },

    // When a higher-tier product is targeted but some bar ingredients are
    // below threshold, produce the missing bar.
    // Uses room.memory.factoryProductionTarget to lock onto one bar until
    // it reaches the threshold (same pattern as lab productionTarget).
    // Returns { mineral, product } or null.
    selectPrerequisiteBar: function (room, factory) {
        if (!COMMODITIES)
            return null;

        // Only for whitelisted rooms
        if (HIGHER_TIER_ROOMS.length > 0 && HIGHER_TIER_ROOMS.indexOf(room.name) === -1)
            return null;

        var storage  = room.storage;
        var terminal = room.terminal;

        // If we have a locked target, check if it's still valid
        var locked = room.memory.factoryProductionTarget;
        if (locked) {
            var lockedTotal = 0;
            if (storage)  lockedTotal += storage.store[locked]  || 0;
            if (terminal) lockedTotal += terminal.store[locked] || 0;
            lockedTotal += factory.store[locked] || 0;

            if (lockedTotal >= HIGHER_TIER_INGREDIENT_THRESHOLD) {
                // Target reached — clear lock and re-evaluate
                room.memory.factoryProductionTarget = null;
                locked = null;
            } else {
                // Still producing locked target — find its raw mineral
                var barRecipe = COMMODITIES[locked];
                if (barRecipe && barRecipe.components) {
                    var rawMineral = null;
                    for (var comp in barRecipe.components) {
                        if (comp !== RESOURCE_ENERGY) {
                            rawMineral = comp;
                            break;
                        }
                    }
                    if (rawMineral) {
                        console.log('[factory] ' + room.name + ' prereq (locked): producing ' + locked
                            + ' from ' + rawMineral + ' (bar stock: ' + lockedTotal + ')');
                        return { mineral: rawMineral, product: locked };
                    }
                }
                // Lock invalid — clear it
                room.memory.factoryProductionTarget = null;
                locked = null;
            }
        }

        // No lock — find the bar with the lowest stock below threshold
        var bestBar     = null;
        var bestMineral = null;
        var lowestTotal = Infinity;

        for (var p = 0; p < HIGHER_TIER_PRODUCTS.length; p++) {
            var product = HIGHER_TIER_PRODUCTS[p];
            var recipe  = COMMODITIES[product];
            if (!recipe || !recipe.components)
                continue;

            var components = recipe.components;
            for (var ing in components) {
                if (ing === RESOURCE_ENERGY)
                    continue;

                var total = 0;
                if (storage)  total += storage.store[ing]  || 0;
                if (terminal) total += terminal.store[ing] || 0;
                total += factory.store[ing] || 0;

                if (total >= HIGHER_TIER_INGREDIENT_THRESHOLD)
                    continue;

                var barRecipe2 = COMMODITIES[ing];
                if (!barRecipe2 || !barRecipe2.components)
                    continue;

                var rawMineral2 = null;
                for (var comp2 in barRecipe2.components) {
                    if (comp2 !== RESOURCE_ENERGY) {
                        rawMineral2 = comp2;
                        break;
                    }
                }
                if (!rawMineral2)
                    continue;

                if (total < lowestTotal) {
                    lowestTotal = total;
                    bestBar     = ing;
                    bestMineral = rawMineral2;
                }
            }
        }

        if (bestBar && bestMineral) {
            // Lock onto this bar
            room.memory.factoryProductionTarget = bestBar;
            console.log('[factory] ' + room.name + ' prereq (new lock): producing ' + bestBar
                + ' from ' + bestMineral + ' (bar stock: ' + lowestTotal + ')');
            return { mineral: bestMineral, product: bestBar };
        }
        return null;
    },

    // Write factoryDemand so deliverers know which resource to bring in.
    // For multi-ingredient recipes (composite), cycle through whichever
    // ingredient the factory is lowest on.
    updateDemand: function (room, factory, selected) {
        // --- Multi-ingredient path (composite etc.) ---
        if (selected.ingredients) {
            var lowestType  = null;
            var lowestRatio = Infinity;
            for (var i = 0; i < selected.ingredients.length; i++) {
                var ing = selected.ingredients[i];
                var cur = factory.store[ing] || 0;
                var ratio = cur / HIGHER_TIER_INGREDIENT_WATERMARK;
                if (ratio < lowestRatio) {
                    lowestRatio = ratio;
                    lowestType  = ing;
                }
            }
            room.memory.factoryDemand = {
                factoryId   : factory.id,
                type        : lowestType,
                amount      : HIGHER_TIER_INGREDIENT_WATERMARK,
                ingredients : selected.ingredients
            };
            return;
        }

        // --- Single-ingredient path (bars / battery) ---
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
