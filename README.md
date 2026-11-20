# Natural pool

Plans for a natural swimming pool in Talong

## Design summary

Current design, as modelled from `2d_top_view.svg`. Dimensions are indicative only: the drawing has no scale, so 1 mm = 10 cm was assumed to get a reasonable size.

### Layout

The pool is a rectangle, set on a slight hill with a level terrace around it. The uphill side has the dock and filter; the downhill side has the seat, spillway and drain, looking out over the slope.

Along its length the pool runs: **kids' entrance (shallow)** → **deep zone** → **planted shallow end**.

| Element | Size | Depth / height | Notes |
|---|---|---|---|
| Pool | 5.7 × 11.4 m (65 m²) | — | 25 cm walls with stone coping |
| Deep zone | full width × 5.1 m (29 m²) | 1.8 m floor, ~1.7 m water | in the middle of the pool |
| Shallow zones | full width, each end | 0.5 m floor, ~0.4 m water | vertical step down to the deep zone |
| Kids' entrance | open shallow area between the corner beds at one end | two entry steps from the edge | kept clear of plants so children can walk through to the deep zone |
| Planted beds | 4 corner beds 1.25 × 2.85 m, plus a 1 m strip along the far end wall (17 m², 27 % of surface) | bed surface 0.2 m below ground (~12 cm water) | reeds; lilies in the open shallow water at the planted end |
| Seat | 0.9 m wide, along the full length of the deep zone's downhill wall | 0.45 m below ground | underwater bench facing into the pool, backed by the spillway |
| Spillway | 4.2 × 0.43 m step at the back of the seat | top at water level, as is the wall behind it | infinity edge: water spills over into the drain; somewhere to rest your arms while looking out |
| Drain | 0.4 m wide, behind the spillway (4.2 m) | 0.3 m deep | outer kerb and the ground beyond sit below the spillway lip, so nothing rises above the water in the view |
| Dock | 3.4 × 2.15 m timber deck | 0.18 m above ground | uphill side, beside the deep zone, with a ladder into it |
| Filter | 2.8 × 2.15 m chamber | 0.35 m above ground | uphill side, next to the dock |
| Rock fountain | ~1.4 m across | ~0.8 m above water | small ornamental stack of rocks in the middle of the far-end planted strip; water bubbles from the top and trickles down into the pool |
| Border planting | band ~1.8 m wide around the outside of the pool | grasses and irises ~0.5–1 m, shrubs further back | softens the stone edge and screens the filter; kept off the downhill side (the view), the dock, the filter, the path to the dock and the kids' entrance |
| Trees | two, ~2.6 m canopy | — | uphill, as on the drawing |

Other figures: the water level is 8 cm below ground (set by the spillway lip), the site falls about 12 % towards the spillway, and the pool holds roughly 60 m³ (60,000 L).

### Water circulation

Water spills over the infinity-edge spillway into the drain. From there it is pumped back to the filter, which returns it into the pool. The pump and the underground pipework are not modelled.

### Open points

- **Drop-off at the kids' entrance:** the floor steps straight from 0.5 m to 1.8 m where the shallow entrance meets the deep zone. Consider a gentle slope, a step or a barrier.
- **Planting share:** the beds cover about 27 % of the surface. Unfiltered natural pools usually need far more, so water quality depends on the filter.
- **Edging beside the spillway:** the stone coping on either side of the spillway is 14 cm higher than the lip. It sits beside the view rather than in front of it, but it could be lowered, or the spillway extended along the whole seat.
- **Scale:** all sizes follow from the assumed drawing scale and still need confirming.

## 3D model

A parametric Three.js model of the pool, translated from the plan drawing `2d_top_view.svg` (taken at 1 mm = 10 cm, so roughly 5.7 × 11.4 m):

- a full-width **deep** swim zone in the middle, with **shallow** zones at each end
- one shallow end is the **entrance for kids**: kept clear of plants, with entry steps
- **planted beds** (reeds) in the four corners plus a strip along the far end wall; lilies in the open shallow water at that end
- a timber **dock** with a ladder and a **filter** chamber on the uphill side
- an underwater **seat** along the downhill wall of the deep zone, with an infinity-edge **spillway** step at its back spilling into a **drain** channel (kerb and ground beyond kept below the lip, so nothing rises above the water in the view), from which water is pumped back to the filter
- the site on a slight hill falling towards the spillway, levelled to a terrace around the pool
- a small **rock fountain** in the far-end planted strip
- **border planting** (grasses, irises, shrubs) around the outside, leaving the downhill view open
- two trees, labels matching the drawing

### Viewing

The page uses ES modules, so it must be served over HTTP rather than opened as a file:

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080>. Drag to orbit, scroll to zoom, right-drag to pan.

### Changing the design

- **Directly:** edit `src/config.js` (all values in metres, commented; origin at the pool centre, +x downhill) and reload.
- **Live:** use the "Pool design" sliders. "Copy settings" copies the current values in `config.js` format to paste back in.
- **Export:** "Export .glb" downloads the model for Blender, SketchUp etc.

The panel bottom-left shows the pool, deep-zone, shallow and planted areas, the water volume and the site fall.

### Files

- `index.html` — page shell and library imports (Three.js 0.160, lil-gui 0.19 from jsDelivr)
- `src/config.js` — design parameters
- `src/main.js` — scene construction, GUI and stats
