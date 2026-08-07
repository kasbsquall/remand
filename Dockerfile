# Remand · imagen de la aplicación
#
# Construye el frontend del monorepo y lo sirve en modo producción. El contrato
# Stylus no entra aquí: ya está desplegado en Arbitrum y la aplicación lo lee.
#
# La imagen no lleva ninguna clave. Las credenciales se pasan al arrancar el
# contenedor, de modo que la imagen se puede reconstruir y mover sin arrastrar
# secretos.

FROM node:22-bookworm-slim AS build

WORKDIR /app

# Yarn 3 vive en el repositorio, así que se copia antes que nada para que la
# instalación pueda resolverse sin descargar un gestor distinto.
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn
COPY packages/nextjs/package.json ./packages/nextjs/
COPY packages/stylus/package.json ./packages/stylus/

# El postinstall del repositorio instala hooks de git, que no existen dentro de
# la imagen. Se desactiva para que la instalación no falle por eso.
RUN corepack enable && yarn install --immutable --mode=skip-build || yarn install

COPY packages/nextjs ./packages/nextjs
COPY packages/stylus/deployments ./packages/stylus/deployments

# La compilación descarga las tipografías y las deja embebidas, así que el
# contenedor en ejecución no depende de Google Fonts.
RUN yarn workspace @ss/nextjs build

# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# No corre como root. Un proceso de aplicación no necesita esos permisos, y si
# alguien lo compromete no hereda el contenedor.
RUN groupadd -r remand && useradd -r -g remand remand

COPY --from=build /app /app
RUN chown -R remand:remand /app

USER remand
EXPOSE 3000

CMD ["yarn", "workspace", "@ss/nextjs", "serve"]
