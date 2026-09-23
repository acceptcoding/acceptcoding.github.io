# Primeros pasos (español)

## Ejecutar ACCEPT en local

1. Instala Node.js 20 o posterior y Git.
2. Clona el repositorio y entra en su directorio.
3. Ejecuta `npm test`.
4. Ejecuta `npm run build`.
5. Sirve el directorio con `python3 -m http.server 4173`.
6. Abre `http://localhost:4173/`.

Los módulos ES necesitan HTTP. Abrir `index.html` directamente no es un modo
local compatible.

## Archivos principales

- `index.html`: página del entrenamiento diario.
- `core.js`: reglas puras de fecha, selección, nivel y verificación.
- `js/app.js`: estado del navegador y renderizado del DOM.
- `js/codeforces.js`: único adaptador de la API de Codeforces.
- `js/i18n.js`: textos de usuario en PT, EN y ES.
- `data/runtime-corpus.js`: instantánea de problemas usada por el sitio.
- `styles.css`: sistema visual y diseño adaptable.
- `docs/`: arquitectura, selección, persistencia, publicación e idiomas.

## Hacer fork y personalizar

Haz un fork en GitHub. Cambia la marca pública en el HTML y los textos en
`js/i18n.js`. Mantén `core.js`, la sal del selector, la política de concursos
aprobados y las claves de persistencia, salvo que actualices también sus
pruebas y documentación.

## Publicar

GitHub Pages puede publicar la raíz del repositorio como sitio estático. No
hay backend ni secretos.

## Versionado

`package.json` es la fuente oficial de la versión. Usa versiones semánticas.
La base pública actual es alpha `0.0.1`. Cambia la versión y las notas de
versión en un cambio deliberado. Después ejecuta `npm test`, `npm run build` y
`git diff --check`.
