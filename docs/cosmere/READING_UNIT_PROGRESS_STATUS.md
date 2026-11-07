# Reading unit progress status

`resolveReadingUnitProgressStatus` converts validated reading-unit progress into one of four presentation-safe states:

- `blocked`: the declared structure or progress is invalid or ambiguous;
- `not-started`: declared units exist and none are completed;
- `in-progress`: a contiguous prefix is completed;
- `complete`: every declared unit is completed.

The resolver delegates structural validation to `hasConsistentReadingUnitProgress` and deliberately fails closed. It does not create units, infer chapters, inspect EPUB text, or establish editorial facts. A `complete` status only describes the supplied declared unit set; it is not evidence that an entire work has been editorially verified.
