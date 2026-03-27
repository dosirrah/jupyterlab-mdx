import json
from pathlib import Path
from markdown_test_tools import notebook, md_cell, code_cell

base = Path(".")
base.mkdir(parents=True, exist_ok=True)

fixtures = {
    "single_cell_single_citation.ipynb": [
        md_cell("See ^lamport1994.\n")
    ],
    "single_cell_multiple_citations.ipynb": [
        md_cell("See ^lamport1994 and ^knuth1984 and ^turing1936.\n")
    ],
    "single_cell_repeated_citation.ipynb": [
        md_cell("See ^lamport1994 and then ^lamport1994 again.\n")
    ],
    "single_cell_mixed_repeated_citations.ipynb": [
        md_cell("See ^lamport1994, ^knuth1984, and ^lamport1994 again.\n")
    ],
    "single_cell_no_citations.ipynb": [
        md_cell("Plain paragraph text only.\n")
    ],
    "single_cell_citation_in_inline_code.ipynb": [
        md_cell("Use `^lamport1994` literally.\n")
    ],
    "single_cell_citation_in_fenced_code.ipynb": [
        md_cell("```\n^lamport1994\n^knuth1984\n```\n")
    ],
    "single_cell_citation_in_html_comment.ipynb": [
        md_cell("<!-- ^lamport1994 should be ignored -->\nActual text here.\n")
    ],
    "single_cell_citation_outside_comment.ipynb": [
        md_cell("<!-- ^lamport1994 should be ignored -->\nSee ^knuth1984 here.\n")
    ],
    "single_cell_multiline_citations.ipynb": [
        md_cell("First cite ^lamport1994.\n\nThen ^knuth1984.\nThen ^turing1936.\n")
    ],
    "single_cell_citation_keys_with_digits_and_underscores.ipynb": [
        md_cell("See ^foo_2 and ^bar99.\n")
    ],
    "multi_cell_single_citation.ipynb": [
        md_cell("See ^lamport1994.\n")
    ],
    "multi_cell_multiple_unique_citations.ipynb": [
        md_cell("See ^lamport1994.\n"),
        md_cell("See ^knuth1984.\n"),
        md_cell("See ^turing1936.\n")
    ],
    "multi_cell_repeated_citation.ipynb": [
        md_cell("See ^lamport1994.\n"),
        md_cell("See ^knuth1984.\n"),
        md_cell("See ^lamport1994 again.\n")
    ],
    "multi_cell_mixed_citations.ipynb": [
        md_cell("See ^lamport1994 and ^knuth1984.\n"),
        md_cell("See ^knuth1984 and ^turing1936.\n"),
        md_cell("See ^lamport1994 again.\n")
    ],
    "multi_cell_with_plain_markdown_between_citations.ipynb": [
        md_cell("See ^lamport1994.\n"),
        md_cell("This cell has no citations.\n"),
        md_cell("See ^knuth1984.\n")
    ],
    "multi_cell_with_multiple_plain_markdown_cells.ipynb": [
        md_cell("Intro text only.\n"),
        md_cell("See ^lamport1994.\n"),
        md_cell("More discussion with no citations.\n"),
        md_cell("See ^knuth1984 and ^turing1936.\n"),
        md_cell("Conclusion without citations.\n")
    ],
    "multi_cell_leading_and_trailing_plain_markdown.ipynb": [
        md_cell("Opening text without citations.\n"),
        md_cell("See ^lamport1994.\n"),
        md_cell("Closing text without citations.\n")
    ],
    "multi_cell_with_code_cell_between_citations.ipynb": [
        md_cell("See ^lamport1994.\n"),
        code_cell("print('hello world')\n"),
        md_cell("See ^knuth1984.\n")
    ],
    "multi_cell_with_code_cell_containing_caret_text.ipynb": [
        md_cell("See ^lamport1994.\n"),
        code_cell("x = '^knuth1984'\nprint(x)\n"),
        md_cell("See ^turing1936.\n")
    ],
    "multi_cell_code_cells_only_one_markdown_citation.ipynb": [
        code_cell("print('^lamport1994')\n"),
        md_cell("See ^knuth1984.\n"),
        code_cell("y = '^turing1936'\n")
    ],
    "multi_cell_markdown_and_code_mixed.ipynb": [
        md_cell("Opening text.\n"),
        code_cell("print('no citation here')\n"),
        md_cell("See ^lamport1994 and ^knuth1984.\n"),
        code_cell("ref = '^turing1936'\n"),
        md_cell("Plain markdown.\n"),
        md_cell("See ^turing1936.\n")
    ],
    "multi_cell_with_bibliography_directive.ipynb": [
        md_cell("See ^lamport1994 and ^knuth1984.\n"),
        md_cell("::: bibliography\nsrc: refs.bib\n:::\n")
    ],
    "single_cell_bibliography_directive_only.ipynb": [
        md_cell("::: bibliography\nsrc: refs.bib\n:::\n")
    ],
    "single_cell_bibliography_directive_no_src.ipynb": [
        md_cell("::: bibliography\n:::\n")
    ],
    "single_cell_multiple_bibliography_directives.ipynb": [
        md_cell(
            "::: bibliography\nsrc: a.bib\n:::\n\n"
            "Some text.\n\n"
            "::: bibliography\nsrc: b.bib\n:::\n"
        )
    ],
    "single_cell_bibliography_directive_in_code.ipynb": [
        md_cell("```\n::: bibliography\nsrc: refs.bib\n:::\n```\n")
    ],
    "single_cell_bibliography_directive_in_comment.ipynb": [
        md_cell("<!--\n::: bibliography\nsrc: refs.bib\n:::\n-->\n")
    ],
    "single_cell_bibliography_directive_outside_comment.ipynb": [
        md_cell(
            "<!--\n::: bibliography\nsrc: ignored.bib\n:::\n-->\n\n"
            "::: bibliography\nsrc: used.bib\n:::\n"
        )
    ],
    "multi_cell_bibliography_with_plain_markdown_and_code.ipynb": [
        md_cell("Intro text.\n"),
        code_cell("print('setup')\n"),
        md_cell("See ^lamport1994.\n"),
        md_cell("Plain markdown.\n"),
        md_cell("::: bibliography\nsrc: refs.bib\n:::\n")
    ],
    "multi_cell_bibliography_with_code_cell_containing_fake_directive.ipynb": [
        md_cell("See ^lamport1994.\n"),
        code_cell("text = '::: bibliography\\nsrc: fake.bib\\n:::'\n"),
        md_cell("::: bibliography\nsrc: refs.bib\n:::\n")
    ],
}

for filename, cells in fixtures.items():
    path = base / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(notebook(cells), f, ensure_ascii=False, indent=2)

print(f"Created {len(fixtures)} notebooks in {base}")
