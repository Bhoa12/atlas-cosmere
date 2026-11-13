# Reading progress and spoiler gates

This module is infrastructure only.

It models ordered reading units supplied as explicit metadata, progress, and requirements for revealing content. It deliberately does **not** infer chapters, world membership, chronology, or narrative facts from titles, filenames, or inaccessible private EPUB content.

Visibility is fail-closed: malformed or incomplete requirements remain locked.

The supplied bibliography may populate future metadata layers, but this boundary stores no protected EPUB text and makes no claim that private passages were inspected.
