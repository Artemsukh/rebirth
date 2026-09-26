# Birth Lottery

Be born again, at random, as one of the 132.5 million babies of 2026. The country and sex are drawn in proportion to the real makeup of births, and the page shows that child's starting line (the chance of being born in that country, GDP per head, development tier and life expectancy) side by side with the world as a whole.

**Try it now: https://artemsukh.github.io/rebirth/**

## Features

- **Coverage:** All 236 countries and areas in the UN World Population Prospects 2024. Only the Holy See, with fewer than 1,000 people, is left out. Kosovo uses UN code 412.
- **Draw:** There is one basis, 2026 births. A country is picked in proportion to its number of births, then the sex is set by that country's sex ratio at birth. Random numbers take 53 bits from `crypto.getRandomValues`.
- **Measures:** Chance of being born in this country, GDP per head (at market exchange rates and at purchasing power parity), development tier and life expectancy.
- **Ranks:** Ranks count people, not countries. "Top 7%" means that among the babies of the same sex born in the same year, about 7% are born in a country that does better on that measure than this one.
- **Result screen:** Styled like a space-probe scanner. The screen's accent color is the GDP-per-head band color of the drawn country (see "Color" below). The planet in the middle is a dot-matrix globe painted in that one color. Brightness is shown only through dot opacity: the drawn country is the brightest, and its border glows white. On a draw, the camera pulls back to the whole globe, then turns toward the country and zooms in. So that small countries stay visible, the angle away from the center is stretched up to 22× before being wrapped back onto the sphere. The GDP-per-head readout panel has a nine-step band ladder under the large number; only the country's band lights up, with a label beside it such as "Band 3/9 · $3,000–7,000". The development tier panel shows the tier with pips (3, 2 or 1 bars) and the tier name. Numbers spin once like a slot machine before stopping, and turn into plain text when they stop. With the reduced-motion setting, all motion is turned off.
- **Frame rules:** So that a phone left open on the page does not heat up, it draws only while something is moving. On the idle screen the globe turns 0.75° eight times a second, and stops when the planet is off screen or the tab is hidden. The draw flight renders at no more than 30 frames per second, and drawing stops once the result settles. The only things that keep turning are the two HUD rings, each on its own composited layer, so they never repaint the planet. The map's birth pulses are drawn on a canvas laid over the map, and only while the map is visible. No translucent blur (`backdrop-filter`) or filter animations are used.
- **Map:** Uses Natural Earth 1:50m boundaries. To match UN statistical units, the French overseas regions and the Caribbean Netherlands are split off from their parent countries. Circle size is the number of births; color is the GDP-per-head band. The legend shows the nine bands and "no data" as bars with ranges, in one row at 1000px wide or more and in two rows of five below that.
- **Languages:** English, 日本語, Español, 한국어, Русский. English is the default. Picking a language in the bar at the very top slides the highlight to it, and without a reload all text, number formatting (1억 3,250만 / 132.5 million / 1億3,250万 / 132,5 millones / 132,5 млн), dates and country names change. On phones (under 480px wide) the bar divides the screen width into five cells.

## Color

Color on screen means one thing only: **the nine bands of GDP per head (US dollars at market exchange rates, `gdpN`)**. The large number in the readout panel and the ranks use this value, so the color follows the same basis as the number on screen. Fallback values marked with `gdpNNote` (UN 2023, World Bank years) are used as they are.

- **Band edges:** Defined in one place only, `BAND_EDGES = [1000, 3000, 7000, 15000, 30000, 50000, 75000, 100000]` in `src/app.js`. An edge value belongs to the upper band (lower bound inclusive, upper bound exclusive): $999 is band 1, $1,000 is band 2. Each country's band is computed once, when `LOCS` is built at startup (`l.band`, 0–9), and is not stored.
- **No data:** The 18 places without `gdpN` (Kosovo, Réunion, Western Sahara, Mayotte, Jersey and others) are band 0 (`--band-0`). They are not filled in with PPP values. The idle screen uses this color too.
- **Palette:** Neon colors on a dark background (`#050716`). It runs from rose for the poorest band through orange, amber, yellow, yellow-green, teal, sky blue and indigo, and $100,000 and over is a near-white platinum.

| Band | Range | Color | Places | 2026 births |
|---|---|---|---|---|
| 1 | Under $1,000 | `#FB0374` | 19 | 15.99% |
| 2 | $1,000–3,000 | `#D27430` | 33 | 42.93% |
| 3 | $3,000–7,000 | `#EEAB4E` | 39 | 17.19% |
| 4 | $7,000–15,000 | `#FFEB1C` | 36 | 13.32% |
| 5 | $15,000–30,000 | `#B3FF9F` | 35 | 2.76% |
| 6 | $30,000–50,000 | `#5FDAC9` | 25 | 2.57% |
| 7 | $50,000–75,000 | `#72A4F9` | 18 | 2.18% |
| 8 | $75,000–100,000 | `#796EF5` | 6 | 2.90% |
| 9 | $100,000 and over | `#EEEAFD` | 7 | 0.11% |
| 0 | No data | `#76829C` | 18 | 0.05% |

- **Accent color:** `data-band` (0–9) is set on five parts (the language bar, the header, the result screen, the map and the 100 babies section), and inside them the CSS variable `--acc` becomes the band color. The color changes instantly, with no transition, filter or blur. The planet is painted from `--band-0` to `--band-9`. Band 9's platinum is already close to white, so the drawn country's white glowing border would not stand out; for this band only, the opacity of the rest of the land is lowered to 0.55× (`LAND_DIM`).
- **Development tiers have no color.** A tier is shown by pips (3 for advanced, 2 for developing, 1 for least developed) and its name. Bars, strips and legends that show several tiers side by side are painted in three grays of the same hue as `--band-0` (`--lvl-3` `#D3D8E3`, `--lvl-2` `#A2A9BA`, `--lvl-1` `#707A8E`), with advanced the brightest, in the same order as the pip count. Only the elements that highlight the currently drawn country (the lit pips, the tier name, the current cell of the tier bar) use that country's band color.
- **Changing the palette:** The band colors and "no data" must have a contrast ratio of at least 4.5:1 against `#050716`, and a color difference (CAM02-UCS ΔE) of at least 10 between any two colors, under normal vision and under color vision deficiency simulations (Machado 2009, protanomaly, deuteranomaly and tritanomaly at 100% severity). The tier grays must keep their brightness order, and even the darkest must reach at least 3:1. `python3 pipeline/check_palette.py` (`pip install colorspacious`) checks these conditions. The current palette has contrast ratios of 5.1–17.0:1 (no data 5.2:1), and minimum color differences of 17.7 for normal vision, 14.2 for deuteranomaly, 13.2 for protanomaly and 11.1 for tritanomaly. For reference, measured with CIEDE2000 they are 14.4, 10.4, 11.7 and 8.6; under tritanomaly, bands 1 and 2 are the closest pair.
- **Changing the bands:** Update `BAND_EDGES` together with the expected values in `pipeline/check_bands.js`. If the number of bands changes, also adjust the `--band-*`, `[data-band]` and `.b-*` rules in `style.css`.

## How the planet is drawn

The planet is a single canvas. The globe is divided into a grid of radius R cells, and on every frame each cell's latitude and longitude are found by inverse projection and looked up in a land raster as sea (0), land (1) or the drawn country (2). There are two rasters: a world mask (1024×512), built once at startup, and a finer window around the drawn country, built once per draw. The cell image is drawn on a small canvas at one pixel per cell, then scaled up and clipped with a dot pattern.

- The dot pitch is `DOT_PITCH` (3.6 CSS px). Each dot occupies k×k device pixels (k an integer), and the canvas is aligned to the device pixel grid.
- Boundary data is decoded directly by `src/topo.js`, without d3. The rings of Russia and Fiji, which cross the date line, have their longitudes unwrapped so they stay continuous.
- While the globe turns on the idle screen, each cell's latitude and its longitude relative to the center do not change, so they are computed once and only the center longitude is added each frame.
- The sphere body, orbit rings, targeting brackets and HUD text are all static HTML and SVG.

## Development tiers

| Tier | Basis |
|---|---|
| Advanced | The 43 advanced economies in Table B of the Statistical Appendix to the IMF World Economic Outlook (April 2026), and their territories |
| Least developed | The 44 countries on the UN list of least developed countries (LDCs) as of December 19, 2024. A country becomes developing once its graduation date has passed |
| Developing | Everything else |

- Territories and freely associated states (Cook Islands, Niue) follow the tier of their sovereign state. The sovereign state is recorded as an M49 code in the `sov` field of `appdata.json`.
- Monaco is not a territory but a sovereign state outside the IMF, so neither rule covers it. It is given the same tier as France (advanced).
- Western Sahara, Palestine and Kosovo are not territories of an advanced economy, so they are developing.
- Tiers are **computed at run time from the viewing date.** Countries scheduled to graduate (Bangladesh, Laos and Nepal on November 24, 2026; Solomon Islands on December 13, 2027; Cambodia and Senegal on December 19, 2029) are least developed until their graduation date and developing from that day on. If the schedule changes, update the dates in `pipeline/classify.py` together with the expected values below them (`EXPECT`), then run it again.
- As of September 24, 2026, there are 80 advanced places (7.37% of births), 112 developing (64.29%) and 44 least developed (28.34%). The three shares are rounded with the largest remainder method so that they add up to 100%.

## Languages

- **Initial language:** Chosen in this order: `?lang=en|ja|es|ko|ru` in the URL, then the language picked last time (localStorage `rebirth-simulator-lang`). If neither exists, the page opens in English. The browser language is not consulted, so every first-time visitor sees English. Changing the language in the bar saves the choice, and if the URL has `?lang=`, updates that value too. To send someone straight to the Korean page, use a URL with `?lang=ko`.
- **Order:** The order of the bar must match between `LANGS` (`en ja es ko ru`) in `src/i18n.js` and the order of the buttons in `body.html`, because the highlight cell is 1/(number of `LANGS`) wide and moves by the language's index.
- **Text:** Every sentence on screen lives in `src/i18n.js`, under the same keys for each language. Fixed text in `body.html` points to keys with `data-t` (text), `data-th` (markup) and `data-tp` (input placeholder). Numbers and dates are formatted by `app.js` in that language's `Intl` format (ko-KR, en-US, ja-JP, es-ES, ru-RU) before being passed in. In Russian, a noun after a number takes one of three forms (1 раз, 2 раза, 5 раз), so `ruPl` in `i18n.js` picks the right one, and the sovereign state of a territory ("Территория Франции") and continents ("в Азии") are kept in tables in the correct grammatical case. To change a sentence or add a language, edit only this file and rebuild.
- **Names:** Korean and English country names use the original `ko` and `en` fields. Japanese, Spanish and Russian names (the `ja`, `es` and `ru` fields) and continent and subregion names (`NAMES`) are taken by `pipeline/names.py` from Unicode CLDR (the ICU bundled with Node). Long official names such as those of Hong Kong, Macao, the two Congos, Myanmar and Palestine, abbreviations in the Russian CLDR ("о-ва" → "острова") and names commonly used in Russia (США, ЮАР, Южная Корея) are replaced with values set in the script.
- **Search:** Country search in the table matches names and aliases in all five languages, whatever the screen language, and ignores accents and the ё/е difference (`japon` → Japón, `сша` → США).
- **Fonts:** The stylesheet for the Japanese font (IBM Plex Sans JP) alone is over 90 KB, so it is loaded only when Japanese is chosen. Orbit and Chakra Petch have no Cyrillic, so when Russian is chosen, the page loads IBM Plex Sans for body text and Jura, a thin geometric typeface similar to Orbit, for titles and names. Until they load, system fonts are shown.

## Data

| Item | Source |
|---|---|
| Births, population, sex ratio, life expectancy, total fertility rate | UN World Population Prospects 2024, medium scenario, 2026 (CC BY 3.0 IGO) |
| GDP per head | IMF World Economic Outlook, April 2026 edition, 2025 estimates (via a Worldometers table). Where there is no IMF value, a World Bank or UN value is used and marked as such |
| Development tier | IMF WEO April 2026 Statistical Appendix Table B, UN list of least developed countries |
| Flags | 4:3 SVGs from [flag-icons](https://github.com/lipis/flag-icons) 7.5.0 (MIT license, `vendor/flag-icons.LICENSE`) |
| Japanese, Spanish and Russian country names | Unicode CLDR 48 (the ICU in Node 22), with some replaced in `pipeline/names.py` |
| Map | Natural Earth (public domain), via world-atlas |

GDP per head is shown as two values. The large number is in US dollars converted at market exchange rates, and ranks are based on it. The small number is in international dollars at purchasing power parity (PPP), which removes price differences. For example, South Korea has $36,227 and Int$65,405, and India $2,675 and Int$11,789.

## Folder structure

```
index.html        Build output. Everything except the flags is in this one file.
build.py          Combines src/ and data/ into a single index.html.
src/              body.html (structure), style.css (appearance), i18n.js (text in five languages), app.js (behavior), topo.js (TopoJSON decoding)
data/             appdata.json (processed population, economic and classification data), world.topo.json (map)
assets/flags/     Flag SVGs for the 236 places (loaded on demand from the same origin as index.html)
vendor/           flag-icons license, topojson-client 3.1.0 (for cross-checking src/topo.js, ISC)
pipeline/         Scripts that produced the data
```

`LOC` in `data/appdata.json` has 236 rows, and the field names of each row are listed in `LOC_FIELDS` (`code ko en cont sub lat lng births pop srb e0M e0F tfr med gdp gdpNote e0B gdpN gdpNNote iso2 sov ja es ru`). The other keys are `CONT` and `SUB` (Korean continent and subregion names), `NAMES` (English, Japanese, Spanish and Russian names in the same order), `WORLD` and `CLASS` (development tiers).

### pipeline/

| Script | What it does |
|---|---|
| `build_final.py`, `add_nominal.py` | The scripts that first built the data. They need the raw UN data (the wpp2024 R package) to run. They have been updated to output the v2 format. |
| `migrate_v2.py` | Removes the population-based mode data and the mortality and survival measures from a v1 `appdata.json`, and converts it to the `LOC_FIELDS` format. If the file is already v2, it only runs the checks. |
| `classify.py` | Adds the development tier lists (`CLASS`) and sovereign states (`sov`), and checks the number of places and share of births in each tier. |
| `build_iso.py` | Fills in the two-letter ISO codes (`iso2`), copies the flags from flag-icons and shrinks them with svgo. Needs `pip install pycountry` and npm. |
| `names.py` | Adds the Japanese, Spanish and Russian country names (`ja`, `es`, `ru`) and the continent and subregion names (`NAMES`). Needs Node. Running it again gives the same result. |
| `check_topo.js` | Checks that `src/topo.js` decodes the map exactly as topojson-client does. |
| `check_bands.js` | Applies `BAND_EDGES` and the band logic from `src/app.js` to the data, and checks the number of places and share of births per band, sample countries and edge values. |
| `check_palette.py` | Checks that the band colors and tier grays in `src/style.css` meet the contrast and color vision deficiency color-difference conditions. Needs `pip install colorspacious`. |

## Rebuilding after changes

```bash
python3 build.py
```

The build strips only comments and indentation from the CSS and JS. The only things loaded from outside are d3 7.9.0 (from cdnjs, falling back to jsDelivr) and Google Fonts (Orbit, Chakra Petch and IBM Plex Sans KR, plus IBM Plex Sans JP when Japanese is chosen, and IBM Plex Sans and Jura when Russian is chosen). d3 is used only for the map at the bottom. If d3 fails to load, the draw, readouts, table and planet keep working, and a notice appears in place of the map. If a flag file is missing, a chip with the two-letter code is shown instead.

Records are stored only in the browser's localStorage (`rebirth-simulator-v2`). If data in the old format (`dasi-taeeonandamyeon-v1`) exists, it is migrated once on first open: birth-based statistics and records are carried over, population-based records are dropped, and serial numbers continue where they left off.

## Publishing with GitHub Pages

In the repository's Settings → Pages, set Source to "Deploy from a branch", Branch to `main` and the folder to `/ (root)`, and the site will open at https://artemsukh.github.io/rebirth/. The flags are served from `assets/flags/` on the same origin, so they must be published along with `index.html`. On a free account, the repository must be public for Pages to be turned on.

## Limitations

- All 2026 values are projections. Wars or disasters that happened after the projections were made may not be reflected.
- National averages hide the gaps within a country. Even in the same country, the starting line varies widely by region and income, and between city and countryside.
- GDP per head is only average output and says nothing about how it is distributed. At market exchange rates, 18 places such as Kosovo, Réunion and Jersey have no IMF value and are left blank.
- Development tiers are administrative classifications from international organizations. LDC graduation dates can be postponed by decisions of the UN General Assembly (Bangladesh and Nepal have asked for a delay until 2029).
- The planet's zoom is an exaggeration meant to make shapes visible, and cannot be used to compare areas. For small countries whose outline is too coarse or that show up as only a few dots, a targeting marker (a crosshair and four dots) is placed at their location.
