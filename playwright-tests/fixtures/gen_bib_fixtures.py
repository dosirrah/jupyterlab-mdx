from pathlib import Path
from markdown_test_tools import bib_entry, bib_file

base = Path(".")
base.mkdir(parents=True, exist_ok=True)

fixtures = {
    "single_entry.bib": bib_file([
        bib_entry(
            "lamport1994",
            entry_type="article",
            author="Leslie Lamport",
            title="LaTeX: A Document Preparation System",
            journal="Software: Practice and Experience",
            year="1994",
        )
    ]),

    "multiple_entries.bib": bib_file([
        bib_entry(
            "lamport1994",
            entry_type="article",
            author="Leslie Lamport",
            title="LaTeX: A Document Preparation System",
            journal="Software: Practice and Experience",
            year="1994",
        ),
        bib_entry(
            "knuth1984",
            entry_type="article",
            author="Donald E. Knuth",
            title="Literate Programming",
            journal="The Computer Journal",
            year="1984",
        ),
        bib_entry(
            "turing1936",
            entry_type="article",
            author="Alan M. Turing",
            title="On Computable Numbers, with an Application to the Entscheidungsproblem",
            journal="Proceedings of the London Mathematical Society",
            year="1936",
        ),
    ]),

    "mixed_entry_types.bib": bib_file([
        bib_entry(
            "lamport1994",
            entry_type="article",
            author="Leslie Lamport",
            title="LaTeX: A Document Preparation System",
            journal="Software: Practice and Experience",
            year="1994",
            volume="15",
            number="3",
            pages="1--23",
        ),
        bib_entry(
            "knuth1984",
            entry_type="inproceedings",
            author="Donald E. Knuth",
            title="Literate Programming",
            booktitle="Proceedings of the ACM Symposium on Text Manipulation",
            year="1984",
            pages="1--10",
        ),
        bib_entry(
            "aho2006",
            entry_type="book",
            author="Alfred V. Aho and Monica S. Lam and Ravi Sethi and Jeffrey D. Ullman",
            title="Compilers: Principles, Techniques, and Tools",
            year="2006",
            publisher="Pearson",
        ),
        bib_entry(
            "mccarthy1960",
            entry_type="misc",
            author="John McCarthy",
            title="Recursive Functions of Symbolic Expressions and Their Computation by Machine",
            year="1960",
            note="Classic AI paper",
        ),
    ]),
}

for filename, content in fixtures.items():
    path = base / filename
    path.write_text(content, encoding="utf-8")

print(f"Created {len(fixtures)} .bib files in {base}")
