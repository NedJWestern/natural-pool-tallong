# Natural pool

Plans for a natural swimming pool in Talong

## 3D model

A parametric Three.js model of the pool: rectangular swim zone, shallow planted regeneration zone with an organic outline, submerged separating wall, timber deck, ladder, reeds, water lilies, edge stones, grasses and trees.

### Viewing

The page uses ES modules, so it must be served over HTTP rather than opened as a file:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Drag to orbit, scroll to zoom, right-drag to pan.

### Changing the design

- **Directly:** edit `src/config.js` (all values in metres, commented) and reload.
- **Live:** use the "Pool design" sliders. "Copy settings" copies the current values in `config.js` format to paste back in.
- **Export:** "Export .glb" downloads the model for Blender, SketchUp etc.

The panel bottom-left shows areas, water volume and the regeneration : swim area ratio.

### Files

- `index.html` — page shell and library imports (Three.js 0.160, lil-gui 0.19 from jsDelivr)
- `src/config.js` — design parameters
- `src/main.js` — scene construction, GUI and stats
