# gen_named_enumerations_fixtures.py

import json
from pathlib import Path
from markdown_test_tools import notebook, md_cell

base = Path(".")
base.mkdir(parents=True, exist_ok=True)

fixtures = {
    # ================================================================
    # VALID FIXTURES
    # ================================================================

    # ----------------------------------------------------------------
    # Single-cell valid fixtures
    # ----------------------------------------------------------------

    "single_cell_named_fig_label.ipynb": [
        md_cell("Figure @fig:architecture shows the system.\n")
    ],

    "single_cell_named_fig_reference_same_cell.ipynb": [
        md_cell(
            "Figure @fig:architecture shows the system.\n\n"
            "See #fig:architecture.\n"
        )
    ],

    "single_cell_multiple_fig_labels.ipynb": [
        md_cell(
            "Figure @fig:first shows the first system.\n\n"
            "Figure @fig:second shows the second system.\n"
        )
    ],

    "single_cell_multiple_named_enumerations.ipynb": [
        md_cell(
            "Figure @fig:architecture shows the system.\n\n"
            "Figure @fig:pipeline shows the pipeline.\n\n"
            "$$\n"
            "\\int_{x=0}^t x^2 dx   @eq:integral\n"
            "$$\n\n"
            "See #fig:architecture and #eq:integral.\n"
        )
    ],

    "single_cell_eq_block_dollars.ipynb": [
        md_cell(
            "$$\n"
            "\\int_{x=0}^t x^2 dx   @eq:foo\n"
            "$$\n"
        )
    ],

    "single_cell_eq_block_brackets.ipynb": [
        md_cell(
            "\\[\n"
            "\\int_{x=0}^t x^2 dx   @eq:foo\n"
            "\\]\n"
        )
    ],

    "single_cell_eq_reference_same_cell.ipynb": [
        md_cell(
            "$$\n"
            "E = mc^2   @eq:energy\n"
            "$$\n\n"
            "See #eq:energy.\n"
        )
    ],

    "single_cell_fig_and_eq_same_member_name.ipynb": [
        md_cell(
            "Figure @fig:one shows the architecture.\n\n"
            "$$\n"
            "E = mc^2   @eq:one\n"
            "$$\n\n"
            "See #fig:one and #eq:one.\n"
        )
    ],

    "single_cell_global_and_named_same_member_name.ipynb": [
        md_cell(
            "Step @one. Prepare the input.\n\n"
            "Figure @fig:one shows the pipeline.\n\n"
            "See #one and #fig:one.\n"
        )
    ],

    # ----------------------------------------------------------------
    # Multi-cell valid fixtures: same named enumeration across cells
    # ----------------------------------------------------------------

    "multi_cell_fig_label_then_reference.ipynb": [
        md_cell("Figure @fig:architecture shows the system.\n"),
        md_cell("See #fig:architecture.\n"),
    ],

    "multi_cell_fig_reference_then_label_forward.ipynb": [
        md_cell("See #fig:architecture.\n"),
        md_cell("Figure @fig:architecture shows the system.\n"),
    ],

    "multi_cell_multiple_figs_with_later_references.ipynb": [
        md_cell("Figure @fig:first shows the first architecture.\n"),
        md_cell("Figure @fig:second shows the second architecture.\n"),
        md_cell("See #fig:first and #fig:second.\n"),
    ],

    "multi_cell_eq_label_then_reference_dollars.ipynb": [
        md_cell(
            "$$\n"
            "\\int_{x=0}^t x^2 dx   @eq:foo\n"
            "$$\n"
        ),
        md_cell("See #eq:foo.\n"),
    ],

    "multi_cell_eq_label_then_reference_brackets.ipynb": [
        md_cell(
            "\\[\n"
            "\\int_{x=0}^t x^2 dx   @eq:foo\n"
            "\\]\n"
        ),
        md_cell("See #eq:foo.\n"),
    ],

    "multi_cell_eq_reference_then_label_forward.ipynb": [
        md_cell("See #eq:foo.\n"),
        md_cell(
            "$$\n"
            "\\int_{x=0}^t x^2 dx   @eq:foo\n"
            "$$\n"
        ),
    ],

    "multi_cell_fig_and_eq_cross_references.ipynb": [
        md_cell("Figure @fig:architecture shows the system.\n"),
        md_cell(
            "$$\n"
            "E = mc^2   @eq:energy\n"
            "$$\n"
        ),
        md_cell("See #fig:architecture and #eq:energy.\n"),
    ],

    "multi_cell_same_member_name_different_enumerations.ipynb": [
        md_cell("Figure @fig:one shows the architecture.\n"),
        md_cell(
            "$$\n"
            "E = mc^2   @eq:one\n"
            "$$\n"
        ),
        md_cell("See #fig:one and #eq:one.\n"),
    ],

    "multi_cell_global_and_named_same_member_name.ipynb": [
        md_cell("Step @one. Prepare the input.\n"),
        md_cell("Figure @fig:one shows the pipeline.\n"),
        md_cell("See #one and #fig:one.\n"),
    ],

    # ----------------------------------------------------------------
    # Multi-cell valid fixtures mixing sections and named enumerations
    # ----------------------------------------------------------------

    "multi_cell_sections_figures_and_equations.ipynb": [
        md_cell("# Notebook Title\n"),
        md_cell("## Introduction\n\nFigure @fig:architecture shows the system.\n"),
        md_cell(
            "## Methods\n\n"
            "$$\n"
            "\\int_{x=0}^t x^2 dx   @eq:integral\n"
            "$$\n"
        ),
        md_cell("See #fig:architecture in #introduction and #eq:integral in #methods.\n"),
    ],

    "multi_cell_named_enumerations_with_section_references.ipynb": [
        md_cell("## Overview\n"),
        md_cell("Figure @fig:system shows the full system.\n"),
        md_cell(
            "$$\n"
            "a^2 + b^2 = c^2   @eq:pythagoras\n"
            "$$\n"
        ),
        md_cell("In #overview, see #fig:system and #eq:pythagoras.\n"),
    ],

    # ================================================================
    # INVALID FIXTURES
    # ================================================================

    # ----------------------------------------------------------------
    # Reserved namespace misuse: eq outside display math
    # These should trigger ReservedEnumerationMisuseError
    # ----------------------------------------------------------------

    "single_cell_eq_misuse_in_text.ipynb": [
        md_cell("This is invalid: @eq:foo outside display math.\n")
    ],

    "single_cell_eq_misuse_in_heading.ipynb": [
        md_cell("## @eq:foo Methods\n")
    ],

    "single_cell_eq_misuse_inline_math.ipynb": [
        md_cell("This is invalid inline math: $x^2 + 1 @eq:foo$.\n")
    ],

    "single_cell_eq_misuse_in_list_item.ipynb": [
        md_cell("- This is invalid: @eq:foo in a list item outside display math.\n")
    ],

    "multi_cell_eq_misuse_in_text_then_reference.ipynb": [
        md_cell("This is invalid: @eq:foo outside display math.\n"),
        md_cell("See #eq:foo.\n"),
    ],

    "multi_cell_eq_misuse_in_heading_then_reference.ipynb": [
        md_cell("## @eq:foo Methods\n"),
        md_cell("See #eq:foo.\n"),
    ],

    # ----------------------------------------------------------------
    # Duplicate labels within the same named enumeration
    # These should trigger DuplicateLabelError
    # ----------------------------------------------------------------

    "single_cell_duplicate_named_fig.ipynb": [
        md_cell(
            "Figure @fig:one shows the first architecture.\n\n"
            "Figure @fig:one shows the second architecture.\n"
        )
    ],

    "single_cell_duplicate_named_eq.ipynb": [
        md_cell(
            "$$\n"
            "x = y + z   @eq:one\n"
            "$$\n\n"
            "$$\n"
            "a = b + c   @eq:one\n"
            "$$\n"
        )
    ],

    "multi_cell_duplicate_named_fig.ipynb": [
        md_cell("Figure @fig:one shows the first architecture.\n"),
        md_cell("Figure @fig:one shows the second architecture.\n"),
    ],

    "multi_cell_duplicate_named_eq.ipynb": [
        md_cell(
            "$$\n"
            "x = y + z   @eq:one\n"
            "$$\n"
        ),
        md_cell(
            "$$\n"
            "a = b + c   @eq:one\n"
            "$$\n"
        ),
    ],

    # ----------------------------------------------------------------
    # Duplicate labels within same named enumeration in headings/body
    # These should trigger DuplicateLabelError if non-eq named labels
    # are allowed in headings.
    # ----------------------------------------------------------------

    "single_cell_enumeration_context_and_duplicate_error.ipynb": [
        md_cell(
            "## @fig:overview Overview\n\n"
            "Figure @fig:overview shows the system.\n"
        )
    ],

    "multi_cell_enumeration_context_and_duplicate_error.ipynb": [
        md_cell("## @fig:overview Overview\n"),
        md_cell("Figure @fig:overview shows the system.\n"),
    ],
}

for filename, cells in fixtures.items():
    path = base / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(notebook(cells), f, ensure_ascii=False, indent=2)

print(f"Created {len(fixtures)} notebooks in {base}")
