# PhymilyTree

An in-progress academic genealogy and institutional graph for condensed matter physics, quantum materials and related fields, with emphasis on US and Singapore institutions.

## Data

- `PhD/PI关系图/`: Obsidian Markdown graph, including faculty profiles, institutions, research topics, school tables, citations and backlinks. Open the repository as an Obsidian vault to navigate the graph.
- `data/records.json`: school-affiliation records exported from the local SQLite database. A person may have multiple records.
- `data/typed_relation_events.json`: structured, sourced relationship events, including stage and relationship type.
- `data/identity_assertion_events.json`: identity assertions across records; assertions and candidate relationships require review.
- `PhD/PI关系图/自动化/`: original research and graph-maintenance scripts. Many one-off scripts refer to local caches, queue state or files outside this repository and are kept for provenance, not as a turnkey pipeline.

The investigation is incomplete. Explicit PhD advisors, postdoctoral advisors, stage mentors, group leaders and candidates are distinct; coauthorship or institutional overlap alone does not establish formal supervision. Consult each record and its cited primary sources.

## Privacy and reproducibility

This snapshot excludes the original SQLite queue, raw web captures, downloaded PDFs, search outputs, and logs. The JSON exports contain structured records and relation events, not the full queue or evidence archive; they cannot resume the original queue. Expiring signed URL query strings have been removed. The working vault and its automation state remain local.

The scripts use Node.js (some require the built-in `node:sqlite`) and in some cases Python or PowerShell. They were developed against a larger local vault; inspect paths and dependencies before running.

Candidate matching uses the April 2026 [Academic Family Tree / Physics Tree data snapshot](https://doi.org/10.5281/zenodo.19739198), distributed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Matched identities and candidate rows are derived annotations. See the separately sourced relationship events for reviewed evidence.

Snapshot: 2026-11-18.
