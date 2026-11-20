# Natural pool

Plans for a natural swimming pool in Talong

## 3D model

A parametric Three.js model of the pool, translated from the plan drawing `2d_top_view.svg` (taken at 1 mm = 10 cm, so roughly 5.7 × 11.4 m):

- a full-width **deep** swim zone in the middle, with **shallow** zones at each end
- one shallow end is the **entrance for kids**: kept clear of plants, with entry steps
- **planted beds** (reeds) in the four corners plus a strip along the far end wall; lilies in the open shallow water at that end
- a timber **dock** with a ladder and a **filter** chamber on the uphill side
- a **seat** inside the downhill wall; above it the wall is lowered as a **spillway** into a **drain** channel, which empties through a pipe down the bank
- the site on a slight hill falling towards the spillway, levelled to a terrace around the pool
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

The panel bottom-left shows areas, water volume and the regeneration : swim area ratio.

### Files

- `index.html` — page shell and library imports (Three.js 0.160, lil-gui 0.19 from jsDelivr)
- `src/config.js` — design parameters
- `src/main.js` — scene construction, GUI and stats
