# Page Change Monitor: detect text changes on any web page

Give it a list of page addresses and, if you want, a CSS selector. It keeps the last text of each page and tells you on every run whether the page changed, with the lines that were added and the lines that were removed.

## How it works
- The first run for an address stores its text and reports `first read`.
- Each later run fetches the page again, compares it with the stored text, reports `changed` or `not changed`, and stores the new text.
- With a CSS selector (for example `main` or `#pricing`) only that part of the page is compared. Without one, the whole page text is.
- Scripts and styles are ignored. The text is split into lines at block elements (paragraphs, list items, headings, table rows).
- The stored text is kept in the named key-value store `page-change-monitor-state`, so it survives between runs. Run the actor on a schedule to watch a page over time.
- The run log ends with a summary line, for example: `SUMMARY: 1 pages: 0 first read, 1 changed, 0 not changed, 0 errors.`

## Input
| Field | Meaning |
|---|---|
| `urls` | Page addresses, one per line |
| `selector` | Optional CSS selector; empty means the whole page |

## Output
One dataset row per address: `url`, `status` (`first read`, `changed`, `not changed` or `error`), `added`, `removed`, `lineCount`, `checkedAt`.

Example from two real runs against one address that changes every second (a clock API):
```json
{
  "url": "https://timeapi.io/api/time/current/zone?timeZone=UTC",
  "status": "changed",
  "added": ["{\"year\":2026,\"month\":11,\"day\":13,\"hour\":9,\"minute\":7,\"seconds\":36, ... }"],
  "removed": ["{\"year\":2026,\"month\":11,\"day\":13,\"hour\":9,\"minute\":7,\"seconds\":30, ... }"],
  "lineCount": 1,
  "checkedAt": "2026-11-13T09:07:35.582Z"
}
```
The run before it returned `"status": "first read"`. A second run on `https://example.com` returned `"status": "not changed"`.

## Run it locally
Needs Node.js 18 or newer.
```bash
git clone https://github.com/20vision/page-change-monitor.git
cd page-change-monitor
npm install
mkdir -p storage/key_value_stores/default
echo '{"urls":["https://example.com"],"selector":"main"}' > storage/key_value_stores/default/INPUT.json
npm start
```
Rows are written to `storage/datasets/default/`. The summary line is printed at the end of the run.

## Run it on Apify
The actor is public: https://apify.com/20vision/page-change-monitor. To deploy your own copy: `npm install -g apify-cli`, `apify login`, `apify push`.

## Limits
- Reads the HTML a plain request receives; text that a script adds after loading is not seen.
- Pages behind a login are not reached.
- The comparison is by line: a line that moves is not reported, a line that is edited shows once as removed and once as added.
- A page that shows dates, counters or random items will report a change on every run; use a selector to leave them out.
- Pages that answer with an error status, or where the selector matches nothing, are reported with status `error`.

## License
MIT, see `LICENSE`.

---
Need the same job behind a login, or with several steps? MyClawn gives an agent its own cloud computer: https://www.myclawn.com/check-a-web-page-for-changes?utm_source=github&utm_medium=repo&utm_campaign=page-change-monitor
