# Real catalogue import report

Source workbook: Exhibition Product List.xlsx. Uploaded ZIP: Pictures.zip (the file supplied for the Pictures(1).zip request). Source hashes and detailed findings are in catalogue-import-report.json.

| Result | Count |
| --- | ---: |
| Products imported | 220 |
| Categories | 6 |
| Images uploaded and matched | 220 |
| Missing images after corrections | 0 |
| Unmatched images after corrections | 0 |
| Products with Price on Request | 14 |
| Duplicate product codes | 0 |
| Duplicate image filenames | 0 |
| Ambiguous mappings after approved corrections | 0 |
| Malformed rows | 0 |
| Invalid prices | 0 |
| Invalid image files | 0 |

## Category totals

| Category | Products |
| --- | ---: |
| Instruments | 91 |
| Arthroscopy | 51 |
| Instrument Set | 7 |
| Consumables | 14 |
| Equipments | 7 |
| Trauma Implants | 50 |

## Intentional filename corrections

Before correction: 219 exact matches, TI-049 missing and TI-051.jpeg unmatched. The owner explicitly confirmed:

- TI-049 — Bipolar Hip Prosthesis (Non-Fenestrated): use TI-050.jpeg.
- TI-050 — Bipolar Hip Prosthesis (Fenestrated): use TI-051.jpeg.

The exact product names in PostgreSQL retain the workbook spelling and whitespace. The corrections affect image assignment only and are tied to the exact source ZIP hash. No unresolved mapping decisions remain.

## Price on Request

These blank-price products remain pre-bookable. Their price and full booking total remain unknown until the team supplies a quote.

| Code | Exact product name | Category |
| --- | --- | --- |
| AR-006 | Endo Button Continous Loop 40 mm | Arthroscopy |
| AR-008 | Tibial Attachable Disk with Adjustable Loop 14 mm | Arthroscopy |
| AR-009 | Tibial Attachable Disk with Adjustable Loop 20 mm | Arthroscopy |
| AR-016 | Suture Anchor Loaded with Needle 3.5 mm | Arthroscopy |
| AR-018 | Suture Anchor Loaded with Needle 6.5 mm | Arthroscopy |
| AR-019 | Syndesmosis Repair System | Arthroscopy |
| AR-020 | Endo Button | Arthroscopy |
| AR-021 | Round ABS Disk 14 mm | Arthroscopy |
| AR-022 | Round ABS Disk 20 mm | Arthroscopy |
| AR-023 | Anchor Screw 2.8 mm | Arthroscopy |
| AR-024 | Anchor Screw 3.0 mm | Arthroscopy |
| AR-025 | Anchor Screw 3.5 mm | Arthroscopy |
| AR-026 | Anchor Screw 5.0 mm | Arthroscopy |
| AR-027 | Anchor Screw 6.5 mm | Arthroscopy |

## Verification and sample booking

Every database code, name, category and price was compared to its Excel row. All 220 image objects were checked in the configured storage.
Sample booking reference: `cmv58hgsk0000eclw3bvu85dl`. It contains INS-001 × 2 at 8,000 CFA each and AR-006 × 1 at Price on Request. The priced subtotal is 16,000 CFA; the full total is unknown. It was verified in the central admin dashboard and is marked SAMPLE ONLY — do not contact or fulfil.

The current database and storage are development services. Real Railway and private object-storage credentials have not been supplied. Do not treat these development image URLs as a production deployment. Run the source importer against Railway and the real storage bucket during deployment; do not copy localhost image URLs into production.
