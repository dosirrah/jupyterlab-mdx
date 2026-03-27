import json
from pathlib import Path
from markdown_test_tools import notebook, md_cell, code_cell

base = Path(".")
base.mkdir(parents=True, exist_ok=True)


def bib_cell(src: str) -> dict:
    return md_cell(f"::: bibliography\nsrc: {src}\n:::\n")


fixtures = {
    # Minimal bibliography-free fixtures
    "single_cell_single_citation.ipynb": [
        md_cell("See ^lamport1994.\n")
    ],
    "single_cell_no_citations.ipynb": [
        md_cell("Plain paragraph text only.\n")
    ],
    "single_cell_bibliography_directive_no_src.ipynb": [
        md_cell("::: bibliography\n:::\n")
    ],

    # Bibliography directive syntax fixtures
    "single_cell_bibliography_directive_only.ipynb": [
        bib_cell("multiple_entries.bib")
    ],
    "single_cell_multiple_bibliography_directives.ipynb": [
        md_cell(
            "::: bibliography\nsrc: single_entry.bib\n:::\n\n"
            "Some text.\n\n"
            "::: bibliography\nsrc: multiple_entries.bib\n:::\n"
        )
    ],
    "single_cell_bibliography_directive_in_code.ipynb": [
        md_cell("```\n::: bibliography\nsrc: multiple_entries.bib\n:::\n```\n")
    ],
    "single_cell_bibliography_directive_in_comment.ipynb": [
        md_cell("<!--\n::: bibliography\nsrc: multiple_entries.bib\n:::\n-->\n")
    ],
    "single_cell_bibliography_directive_outside_comment.ipynb": [
        md_cell(
            "<!--\n::: bibliography\nsrc: ignored.bib\n:::\n-->\n\n"
            "::: bibliography\nsrc: single_entry.bib\n:::\n"
        )
    ],

    # Core citation notebooks with bibliography cells
    "single_cell_single_citation_with_bibliography.ipynb": [
        md_cell("See ^lamport1994.\n"),
        bib_cell("single_entry.bib")
    ],
    "single_cell_multiple_citations_with_bibliography.ipynb": [
        md_cell("See ^lamport1994 and ^knuth1984 and ^turing1936.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "single_cell_repeated_citation_with_bibliography.ipynb": [
        md_cell("See ^lamport1994 and then ^lamport1994 again.\n"),
        bib_cell("single_entry.bib")
    ],
    "multi_cell_single_citation_with_bibliography.ipynb": [
        md_cell("See ^lamport1994.\n"),
        bib_cell("single_entry.bib")
    ],
    "multi_cell_multiple_unique_citations_with_bibliography.ipynb": [
        md_cell("See ^lamport1994.\n"),
        md_cell("See ^knuth1984.\n"),
        md_cell("See ^turing1936.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_repeated_citation_with_bibliography.ipynb": [
        md_cell("See ^lamport1994.\n"),
        md_cell("See ^knuth1984.\n"),
        md_cell("See ^lamport1994 again.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_mixed_citations_with_bibliography.ipynb": [
        md_cell("See ^lamport1994 and ^knuth1984.\n"),
        md_cell("See ^knuth1984 and ^turing1936.\n"),
        md_cell("See ^lamport1994 again.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_with_plain_markdown_between_citations_with_bibliography.ipynb": [
        md_cell("See ^lamport1994.\n"),
        md_cell("This cell has no citations.\n"),
        md_cell("See ^knuth1984.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_with_multiple_plain_markdown_cells_with_bibliography.ipynb": [
        md_cell("Intro text only.\n"),
        md_cell("See ^lamport1994.\n"),
        md_cell("More discussion with no citations.\n"),
        md_cell("See ^knuth1984 and ^turing1936.\n"),
        md_cell("Conclusion without citations.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_leading_and_trailing_plain_markdown_with_bibliography.ipynb": [
        md_cell("Opening text without citations.\n"),
        md_cell("See ^lamport1994.\n"),
        md_cell("Closing text without citations.\n"),
        bib_cell("single_entry.bib")
    ],
    "multi_cell_with_code_cell_between_citations_with_bibliography.ipynb": [
        md_cell("See ^lamport1994.\n"),
        code_cell("print('hello world')\n"),
        md_cell("See ^knuth1984.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_with_code_cell_containing_caret_text_with_bibliography.ipynb": [
        md_cell("See ^lamport1994.\n"),
        code_cell("x = '^knuth1984'\nprint(x)\n"),
        md_cell("See ^turing1936.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_code_cells_only_one_markdown_citation_with_bibliography.ipynb": [
        code_cell("print('^lamport1994')\n"),
        md_cell("See ^knuth1984.\n"),
        code_cell("y = '^turing1936'\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_markdown_and_code_mixed_with_bibliography.ipynb": [
        md_cell("Opening text.\n"),
        code_cell("print('no citation here')\n"),
        md_cell("See ^lamport1994 and ^knuth1984.\n"),
        code_cell("ref = '^turing1936'\n"),
        md_cell("Plain markdown.\n"),
        md_cell("See ^turing1936.\n"),
        bib_cell("multiple_entries.bib")
    ],

    # Bibliography-focused notebooks
    "multi_cell_with_bibliography_directive.ipynb": [
        md_cell("See ^lamport1994 and ^knuth1984.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_bibliography_with_plain_markdown_and_code.ipynb": [
        md_cell("Intro text.\n"),
        code_cell("print('setup')\n"),
        md_cell("See ^lamport1994.\n"),
        md_cell("Plain markdown.\n"),
        bib_cell("single_entry.bib")
    ],
    "multi_cell_bibliography_with_code_cell_containing_fake_directive.ipynb": [
        md_cell("See ^lamport1994.\n"),
        code_cell("text = '::: bibliography\\nsrc: fake.bib\\n:::'\n"),
        bib_cell("single_entry.bib")
    ],

    # Playwright bibliography fixture variants
    "multi_cell_with_bibliography_directive_single_entry.ipynb": [
        md_cell("See ^lamport1994.\n"),
        bib_cell("single_entry.bib")
    ],
    "multi_cell_with_bibliography_directive_multiple_entries.ipynb": [
        md_cell("See ^lamport1994 and ^knuth1984.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_with_bibliography_directive_subset_of_multiple_entries.ipynb": [
        md_cell("See ^lamport1994 and ^knuth1984.\n"),
        bib_cell("multiple_entries.bib")
    ],
    "multi_cell_with_bibliography_directive_mixed_entry_types.ipynb": [
        md_cell("See ^lamport1994 and ^knuth1984 and ^aho2006.\n"),
        bib_cell("mixed_entry_types.bib")
    ],
}

for filename, cells in fixtures.items():
    path = base / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(notebook(cells), f, ensure_ascii=False, indent=2)

print(f"Created {len(fixtures)} notebooks in {base}")
