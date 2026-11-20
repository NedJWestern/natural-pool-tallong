// Natural swimming pool — design parameters.
// All distances are in metres. Ground level is y = 0; negative values are below ground.
// Edit these values directly (then reload the page), or tweak them live with the
// sliders in the browser and use "Copy settings" to paste the result back here.

export const config = {
  // The swim zone: a clean, unplanted rectangular basin.
  // Its origin (x = 0) is the deck end; it extends along +x.
  swim: {
    length: 8,          // along the long axis
    width: 4,
    depth: 1.8,         // floor depth below ground
    wallThickness: 0.25,
    wallTopDepth: 0.3,  // how far below ground the submerged separating wall stops,
                        // letting water flow over it between the zones
  },

  // The regeneration zone: shallow, planted area that cleans the water.
  regen: {
    endLength: 5,       // how far it extends beyond the far end of the swim zone
    sideWidth: 2,       // width of the planted strips along each long side
    depth: 0.5,         // floor depth below ground
    wobble: 0.4,        // how irregular / organic the outline is (0 = smooth)
  },

  waterLevel: -0.1,     // water surface height (just below ground level)

  deck: {
    enabled: true,
    depth: 2.5,         // how far the timber deck extends back from the swim zone
    extraWidth: 1.5,    // how far it extends beyond each side of the swim zone
  },

  planting: {
    reedClusters: 18,
    lilyPads: 30,
    edgeStones: true,
    edgeGrasses: true,
    trees: 4,
    seed: 7,            // change to shuffle plant / stone placement and outline wobble
  },
};
