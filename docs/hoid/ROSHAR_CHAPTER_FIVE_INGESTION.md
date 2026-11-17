# Roshar chapter-five ingestion

## Scope

Run 118 inspected one chapter-five XHTML document in each of the three private Roshar EPUBs currently available in the Library. The files were materialized locally for inspection only. No EPUB, XHTML body, extracted passage or image was added to the repository.

## Edition-bound source records

| Work | Edition | Chapter document | Chapter-body SHA-256 |
|---|---|---|---|
| El camino de los reyes | `roshar-omnibus-v1` | `OEBPS/Text/L1-017.xhtml` | `1cc47f030de9132acec9b6eaca0310e325f4eb34d49bac7294611d09080d68d8` |
| Danzante del Filo | `edgedancer-epub-v1` | `OEBPS/Text/005.xhtml` | `89da9c44aceb5254d8b29d63f9db940f0d13f6de03dc682883670fefd03dc83e` |
| Esquirla del amanecer | `dawnshard-epub-v1` | `OEBPS/Text/5.xhtml` | `3aefc41eadb2b580c80d738552b3d10e1f93fd7c8755cf98b824e6922a9df515` |

The chapter locators are resolved against the already verified navigation digests for each edition. The sparse document allowlist now contains chapters one through five for these three works; it does not imply that any other chapter body has been inspected.

## Original editorial summaries

Three Spanish summaries were written from the inspected chapter documents and added to `editorialDrafts.ts`:

- `twok.chapter-005.shallan-jasnah-assessment`
- `edgedancer.chapter-005.lift-remembering-forgotten`
- `dawnshard.chapter-005.rysn-lopen-fabrial-demonstration`

Each summary has an independent UTF-8 SHA-256 digest and remains `pending-review`.

## Spoiler thresholds

Every summary requires completion through chapter five of its own work. Opening chapter six satisfies that threshold; opening chapter five does not. Progress in another work cannot unlock these summaries.

## Current staging inventory

- 17 original summaries in staging.
- 17 individually inspected chapter-body documents.
- 0 approved summaries.
- 0 new production claims or aliases.

The inventory consists of chapters one through five for the three Roshar works, plus the two previously inspected chapters of El Imperio Final.

## Source availability

The Library listing for this run exposed duplicate copies of the three Roshar EPUBs but did not expose `cosmere.epub`. No new Mistborn or other Cosmere chapter was inspected. Existing Cosmere navigation metadata and the two previously verified El Imperio Final chapter-body hashes remain unchanged.

## Copyright boundary

The repository contains only source identifiers, edition metadata, relative locators, SHA-256 digests and original summaries. It contains no EPUB bytes, XHTML body text, copied passages or source images.
