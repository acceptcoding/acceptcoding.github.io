# Primeiros passos (Português do Brasil)

## Executar o ACCEPT localmente

1. Instale Node.js 20 ou mais recente e Git.
2. Faça o clone do repositório e entre no diretório.
3. Execute `npm test`.
4. Execute `npm run build`.
5. Sirva o diretório com `python3 -m http.server 4173`.
6. Abra `http://localhost:4173/`.

Os módulos ES precisam de HTTP. Abrir `index.html` diretamente não é um modo
local suportado.

## Arquivos principais

- `index.html`: página do treino diário.
- `core.js`: regras puras de data, seleção, nível e verificação.
- `js/app.js`: estado do navegador e renderização do DOM.
- `js/codeforces.js`: único adaptador da API do Codeforces.
- `js/i18n.js`: textos de usuário em PT, EN e ES.
- `data/runtime-corpus.js`: retrato versionado de problemas usado no site.
- `styles.css`: sistema visual e layout responsivo.
- `docs/`: arquitetura, seleção, persistência, publicação e idiomas.

## Fazer fork e personalizar

Faça um fork no GitHub. Altere a marca pública no HTML e os textos em
`js/i18n.js`. Mantenha `core.js`, o salt do seletor, a política de contests
aprovados e as chaves de persistência, salvo se os testes e a documentação
forem atualizados junto.

## Publicar

O GitHub Pages pode publicar a raiz do repositório como site estático. Não há
backend nem segredo.

## Versionamento

`package.json` é a fonte oficial da versão. Use versões semânticas. A base
pública atual é a alpha `0.0.1`. Altere a versão e as notas de release em uma
mudança deliberada. Depois execute `npm test`, `npm run build` e `git diff
--check`.
