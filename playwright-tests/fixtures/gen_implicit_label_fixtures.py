import json
from pathlib import Path
from markdown_test_tools import notebook, md_cell

base = Path(".")
base.mkdir(parents=True, exist_ok=True)

fixtures = {
    "single_cell_single_section.ipynb": [
        md_cell("## My Heading\n")
    ],
    "single_cell_section_and_subsection.ipynb": [
        md_cell("## First Section\n\n### Subsection\n")
    ],
    "single_cell_implicit_reference_same_cell.ipynb": [
        md_cell("## Introduction\n\nSee #introduction.\n")
    ],
    "single_cell_multiple_sections.ipynb": [
        md_cell("## One\n\n### One One\n\n## Two\n")
    ],
    "single_cell_implicit_unresolved.ipynb": [
        md_cell("## Introduction\n\nSee #does_not_exist.\n")
    ],
    "single_cell_implicit_duplicate.ipynb": [
        md_cell("## Intro\n\n## Intro\n")
    ],
    "multi_cell_implicit_reference.ipynb": [
        md_cell("## Introduction\n"),
        md_cell("See ##introduction.\n")
    ],
    "multi_cell_top_level_sections.ipynb": [
        md_cell("## First\n"),
        md_cell("## Second\n")
    ],
    "multi_cell_sections_and_subsections.ipynb": [
        md_cell("## First\n"),
        md_cell("### Details\n"),
        md_cell("### More Details\n"),
        md_cell("## Second\n")
    ],
    "multi_cell_subsection_reset.ipynb": [
        md_cell("## First\n"),
        md_cell("### First Child\n"),
        md_cell("## Second\n"),
        md_cell("### Second Child\n")
    ],
    "multi_cell_deep_hierarchy.ipynb": [
        md_cell("## A\n"),
        md_cell("### B\n"),
        md_cell("#### C\n")
    ],
    "multi_cell_implicit_forward_reference.ipynb": [
        md_cell("See #discussion.\n"),
        md_cell("## Discussion\n")
    ],
    "multi_cell_implicit_unresolved.ipynb": [
        md_cell("## Introduction\n"),
        md_cell("See #missing_section.\n")
    ],
    "multi_cell_with_title_and_sections.ipynb": [
        md_cell("# My Title\n"),
        md_cell("## Introduction\n"),
        md_cell("See #missing_section.\n")
    ],
    "multi_cell_implicit_duplicate.ipynb": [
        md_cell("## Intro\n"),
        md_cell("## Intro\n")
    ],
    "multi_cell_multiple_implicit_references.ipynb": [
        md_cell("## Intro\n"),
        md_cell("## Methods\n"),
        md_cell("See #intro and #methods.\n")
    ]
}

for filename, cells in fixtures.items():
    path = base / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(notebook(cells), f, ensure_ascii=False, indent=2)


print(f"Created {len(fixtures)} notebooks in {base}")

