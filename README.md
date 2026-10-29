# Bedrock Mods

Buscador de addons de Minecraft Bedrock con datos de CurseForge. Sin anuncios; el archivo se descarga directo a la carpeta de Descargas del celular.

## Puesta en marcha (una sola vez)

1. Solicita una API key gratis en https://console.curseforge.com (enlace "Apply for an API Key" en CurseForge).
2. Sube esta carpeta a un repositorio de GitHub.
3. Crea un "Web Service" de Node en un hosting gratuito (por ejemplo Render):
   - Build command: (vacío)
   - Start command: `npm start`
   - Variable de entorno: `CURSEFORGE_API_KEY` = tu key
4. Abre el link que te dé el hosting en el celular y elige "Añadir a pantalla de inicio".

Si la búsqueda sale vacía, agrega la variable `GAME_ID` con el ID de Minecraft Bedrock que aparece en tu consola de CurseForge.
