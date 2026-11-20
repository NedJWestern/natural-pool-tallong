// Natural swimming pool — design parameters, translated from 2d_top_view.svg
// (drawing scale taken as 1 mm = 10 cm).
//
// All distances are in metres. The origin is the centre of the pool's water surface.
//   x = across the pool's width; +x is DOWNHILL (spillway side), -x is uphill (dock side)
//   z = along the pool's length (matches "down the page" on the drawing)
//   y = height; ground level at the pool edge is 0
//
// Edit these values directly (then reload the page), or tweak them live with the
// sliders in the browser and use "Copy settings" to paste the result back here.

export const config = {
  pool: {
    width: 5.7,          // across (x)
    length: 11.4,        // along (z)
    wallThickness: 0.25,
    cornerRadius: 1.5,   // rounded corners (limited so the deep zone stays a straight band)
  },

  // Deep swim zone: spans the full width, between these z positions.
  deep: { from: -2.7, to: 2.4, depth: 1.8 },

  // Shallow zones fill each end of the pool beyond the deep zone.
  // The -z end is the children's entrance: kept clear of plants, with entry steps.
  shallow: { depth: 0.5, entrySteps: true },

  // Planted beds: one in each corner of the shallow zones, plus a strip along the
  // far (+z) end wall between the corner beds.
  plantBeds: {
    width: 1.25,         // across (x), from the side wall inwards
    length: 2.85,        // along (z), from the end wall towards the deep zone
    endStrip: 1.0,       // depth of the far-end strip (0 = none)
    cornerRadius: 0.5,   // rounding of each bed's inner corner
    topDepth: 0.2,       // bed surface below ground level (just under water)
  },

  // Underwater seat along the inside of the downhill (+x) wall, the full length of
  // the deep zone.
  seat: { width: 0.9, depth: 0.45 },

  // Spillway: a step at the back of the seat whose top, like the wall behind it, is at
  // water level (infinity edge), so water spills over into the drain.
  spillway: { centre: -0.1, length: 4.2, width: 0.43 },

  // Drain channel outside the downhill wall, behind the spillway. The water collected
  // here is pumped back to the filter (pipework not modelled).
  drain: { width: 0.4, depth: 0.3 },

  // Timber dock on the uphill side wall, beside the deep zone.
  dock: { centre: 0.75, length: 3.4, depth: 2.15 },

  // Filter chamber on the uphill side, next to the dock.
  filter: { centre: -2.5, length: 2.8, depth: 2.15, height: 0.35 },

  // Small ornamental rock fountain in the far-end planted strip (absolute position).
  fountain: { enabled: true, x: -0.05, z: 5.0, size: 1.4, height: 0.8 },

  // Planting outside the pool: grasses and irises by the edge, shrubs further back.
  // Kept off the downhill side so the view over the spillway stays open, and clear of
  // the dock, the filter, the path to the dock and the kids' entrance.
  border: { enabled: true, width: 1.8, plants: 60 },

  // Trees (absolute positions; radius is the canopy radius).
  trees: [
    { x: -6.35, z: -4.25, radius: 1.3 },
    { x: -7.15, z: 5.05, radius: 1.3 },
  ],

  site: {
    slope: 0.12,         // fall of the natural ground towards +x (0.12 = 12 %)
  },

  waterLevel: -0.08,     // set by the spillway lip

  planting: {
    reedsPerBed: 5,      // reed clumps in each planted bed
    lilyPads: 14,        // in the open shallow areas
    seed: 7,             // change to shuffle plant / stone placement
  },

  showLabels: true,      // labels matching the drawing
};
