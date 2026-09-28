# Testes de falha

URL_BASE: https://avaliacao2-joaosied.pages.dev

Nenhum valor de cookie, state, nonce, code, code_verifier, code_challenge ou token foi registrado neste arquivo.

## Caso 1 — Retorno sem cookie temporário

**Preparação:** janela privativa nova, sem o cookie `__Host-oauth-tx`.

**Pedido enviado:** `GET URL_BASE/oauth/callback/google?code=[REMOVIDO]&state=[REMOVIDO]` sem o cookie `__Host-oauth-tx`.

**Resultado esperado:** HTTP 400 `Authentication failed`; nenhuma sessão criada; `/api/me` responde 401.

**Resultado observado:** HTTP 400 com corpo `Authentication failed` e `Cache-Control: no-store`. Nenhum cookie `__Host-session` foi emitido e `/api/me` continuou respondendo 401. (Executado em 28/09/2026 com um cliente HTTP sem cookies, equivalente à janela privativa.)

## Caso 2 — State alterado

**Preparação:** login GitHub iniciado em `/oauth/login/github`, parado na página de autorização do GitHub; um único caractere do parâmetro `state` alterado na barra de endereço.

**Pedido enviado:** `GET URL_BASE/oauth/callback/github?code=[REMOVIDO]&state=[REMOVIDO — alterado]` com o cookie `__Host-oauth-tx` válido.

**Resultado esperado:** HTTP 400 `Authentication failed` antes da troca do código; nenhuma sessão criada.

**Resultado observado:** Executado pelo fluxo do GitHub (o Google redirecionava automaticamente, sem parar na página do provedor, porque o consentimento já existia). Após autorizar com o `state` alterado em 1 caractere, o callback respondeu `Authentication failed` (HTTP 400) e nenhuma sessão foi criada.

## Caso 3 — Reutilização da transação

**Preparação:** login concluído com sucesso; URL do callback copiada no painel Network (Copy URL).

**Pedido enviado:** mesma `GET URL_BASE/oauth/callback/google?state=[REMOVIDO]&code=[REMOVIDO]` aberta novamente.

**Resultado esperado:** HTTP 400 `Authentication failed`, pois a transação foi apagada do D1 no primeiro uso (`DELETE ... RETURNING`) e o cookie temporário foi expirado.

**Resultado observado:** Após login Google bem-sucedido, a mesma URL de callback (copiada do painel Network) foi reaberta: HTTP 400 `Authentication failed`. A transação já havia sido removida do D1 no primeiro uso.

## Caso 4 — Sessão expirada

**Preparação:** sessão válida criada; no console D1 executado `UPDATE sessions SET expires_at = 0;`.

**Pedido enviado:** `GET URL_BASE/api/me` com o cookie `__Host-session` [REMOVIDO].

**Resultado esperado:** HTTP 401 `{"error":"unauthorized"}`; a página mostra "Nenhuma sessão neste navegador."

**Resultado observado:** Antes do UPDATE, `/api/me` respondia 200. Após `UPDATE sessions SET expires_at = 0;` no console D1, `/api/me` respondeu HTTP 401 `{"error":"unauthorized"}` e a página passou a mostrar "Nenhuma sessão neste navegador.".

## Caso 5 — Origin inválida no logout

**Preparação:** sessão válida em URL_BASE; outra aba aberta em `https://example.com`.

**Pedido enviado:** no console de example.com:
`fetch("URL_BASE/oauth/logout", { method: "POST", credentials: "include" })` — cabeçalho `Origin: https://example.com`.

**Resultado esperado:** HTTP 403 `Forbidden`; a sessão não é removida; ao voltar para URL_BASE, `/api/me` continua respondendo 200.

**Resultado observado:** O servidor respondeu HTTP 403 `Forbidden` (conferido no painel Network e repetido com `Origin: https://example.com` fora do navegador). No console de example.com o `fetch` terminou em "Failed to fetch", pois o navegador também bloqueia a leitura da resposta (CORS). De volta a URL_BASE, `/api/me` continuou respondendo 200 — a sessão original permaneceu válida.

## Caso 6 — Cookie revogado

**Preparação:** sessão válida criada; valor do cookie `__Host-session` copiado temporariamente pelas DevTools; logout executado pelo botão Sair.

**Pedido enviado:** cookie `__Host-session` restaurado com o valor antigo [REMOVIDO]; `GET URL_BASE/api/me`.

**Resultado esperado:** HTTP 401, pois a linha correspondente foi apagada do D1 no logout. A cópia do cookie foi apagada logo depois.

**Resultado observado:** Após o logout pelo botão Sair e a restauração manual do mesmo valor de `__Host-session` pelas DevTools, `/api/me` respondeu HTTP 401 `{"error":"unauthorized"}`. A cópia temporária do cookie foi apagada em seguida.

## Caminhos felizes (registro complementar)

- **Google:** login concluído, retorno para URL_BASE, `/api/me` → 200 `{provider: google, displayName, email}` com `Cache-Control: no-store`; localStorage e sessionStorage vazios; `document.cookie` vazio (cookie HttpOnly). No D1 a sessão foi gravada com `id_hash` de 43 caracteres (SHA-256 Base64URL) e duração de 28800 s. Logout pelo botão Sair → `/api/me` 401.
- **GitHub:** autorização com escopo "Public data only", retorno para URL_BASE, `/api/me` → 200 `{provider: github, displayName: joaosied, email: null}`. A OAuth App não aparece em Settings → Applications → Authorized OAuth Apps, confirmando a revogação (DELETE /applications/{client_id}/grant → 204) antes da criação da sessão.
