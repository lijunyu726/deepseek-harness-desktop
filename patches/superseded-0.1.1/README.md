# superseded 0.1.1-rc.2 overlays

These are the 0.1.1-rc.2 full-file overlays, kept **for reference only**.

The 0.1.5 line split the packages they targeted, so they can no longer be
applied as-is:

| 0.1.1 file | 0.1.5 target(s) | status |
| --- | --- | --- |
| `apiproxy-index.js` | `dsh-api-session-controller` + `dsh-api-workspace-controller` | prompt/admission ported to `patches/session-controller-index.js`; permanent session/workspace deletion still to port |
| `conversation-client.js` | `dsh-client-ui-chat` + `dsh-client-ui-conversation` | not yet ported |

`scripts/apply-upload-enhancements.mjs` never reads this directory. Use these
files only to recover the original desktop delta when porting a remaining
concern.
