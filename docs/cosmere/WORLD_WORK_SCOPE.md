# World work scope

`resolveWorldWorkScope` validates an explicitly declared catalog boundary:

`declared worlds + declared works + explicit work → world links`

The result is **valid** only when every link remains inside both declared sets. Links outside the scope are preserved diagnostically and the result is blocked.

This module is structural. It does not infer worlds from titles, add editorial metadata, establish chronology, or authorize spoiler-sensitive content. A valid link only means that the relationship was explicitly supplied to this technical model.

This keeps expansion for Scadrial, Sel, Nalthis, Taldain, Roshar and future worlds auditable without claiming access to narrative passages or private EPUB text.