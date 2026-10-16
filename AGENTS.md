<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Use TanStack server functions with owner authorization for all business data and Apify calls, because workspace credentials must never reach the browser.
- Keep actor normalization and website filtering in shared pure helpers, because lists and lead detail must present only returned data.
- Persist actor jobs, global business identities and per-search delivery records in Cloud, because asynchronous runs and batch deduplication must survive reloads.
- Manage the Apify credential through the project connector settings rather than runtime writes, because the app cannot mutate the project secret store safely.
- Use one auth-state subscriber in the root provider and a private owner role assigned transactionally on first registration, because this tool permits exactly one account.
- Restore the Busca screen from shown reserves in the database, with only the active search id kept in localStorage, because results must survive navigation and reloads.
- Generate WhatsApp messages via Lovable AI in server functions and re-validate every output with pure code validators, because model output is untrusted.
- Normalize numeric and Portuguese written cardinal claims in shared pure helpers and exempt only the specific digit occurrence in the duration phrase, because source-grounding must not depend on model compliance.
