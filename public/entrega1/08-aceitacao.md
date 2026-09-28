# Critérios de aceitação

URL_BASE: https://avaliacao2-joaosied.pages.dev

- [x] o site é servido pelo endereço pages.dev atribuído
- [x] os arquivos estáticos e as Functions compartilham a mesma origem
- [x] o projeto foi publicado por integração com GitHub
- [x] não foi instalado nem executado Node.js, npm, npx ou Wrangler no projeto
- [x] D1 ligado com o binding `DB`
- [x] cada provedor usa uma URL de retorno própria e exata
- [x] os pedidos de autorização usam código e PKCE S256
- [x] a Function apresenta o Client Secret correto somente na troca de tokens (secrets apenas no servidor)
- [x] o retorno recusa uma transação ausente, expirada, alterada ou reutilizada
- [x] o id_token do Google só produz uma sessão depois da validação criptográfica e semântica
- [x] o access_token do GitHub é usado somente para consultar /user e a autorização é revogada antes da criação da sessão
- [x] caminhos felizes Google e GitHub testados
- [x] seis falhas testadas
- [x] o cookie de sessão é opaco, Secure, HttpOnly, SameSite=Strict e não possui Domain
- [x] o D1 guarda o resumo do cookie, não seu valor bruto
- [x] /api/me devolve somente o perfil necessário
- [x] o logout confere Origin, remove a sessão e expira o cookie
- [x] um cookie revogado não restaura a sessão
- [x] tokens e segredos não aparecem no HTML, nas URLs salvas, no armazenamento Web ou nos registros
- [x] os arquivos estáticos em public permanecem públicos (a sessão protege só as rotas dinâmicas); o aluno sabe explicar por quê

Assinatura: João Siedlarczyk Data: 28/09/2026
