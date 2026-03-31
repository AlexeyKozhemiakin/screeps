# SPEC-001: Observer visibility orchestration

- **Status:** Draft
- **Priority:** P1
- **Owner Module:** `role.observer.js`
- **Related Backlog Item:** `TBD - add observer visibility orchestration`
- **Scope:** Owned `STRUCTURE_OBSERVER` scheduling, remote room visibility refresh

## Problem
Make use of StructureObserver with goals
1) scout remote harvesting rooms
2) scout in rooms to claim
3) scout potentials rooms around to update next rooms to claim
4) scout highways for power bank, hostile attackers, creep trains with precious minerals and deposits

## limitations
Observation range is limited to OBSERVER_RANGE=10 so given all my rooms are tightly packed they will intersect a lot in observation channel

## suggested appraoch

introduce global additional memory object with observed room results and each observer scanning as much around him as possible.