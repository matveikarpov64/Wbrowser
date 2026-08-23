<div align="center">

# 🤖 Wbrowser

**Dale a tu IA un asiento en tu propio Chrome — no un navegador aparte.**

Esto no es un navegador con IA. Es tu Chrome de siempre, con tus sesiones ya dentro,
que un asistente puede manejar *mientras tú miras y usas la misma ventana*.

Sin claves de API. Sin integraciones. Sin volver a iniciar sesión. Cierra la ventana y se acabó.

[English](../README.md) · [한국어](README.ko.md) · [中文](README.zh.md) · [Español](README.es.md)

[![check](https://github.com/w-partners/Wbrowser/actions/workflows/check.yml/badge.svg)](https://github.com/w-partners/Wbrowser/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)
![Platforms](https://img.shields.io/badge/macOS%20%C2%B7%20Linux%20%C2%B7%20WSL%20%C2%B7%20Windows-verified-success)


</div>

---

## Por qué existe

Los navegadores con IA tienen todos la misma forma: instalas un *navegador nuevo* con
un asistente dentro — **Aside**, **Comet**, **Dia**. Esa forma cuesta tres cosas:

| Su forma | Lo que cuesta |
|---|---|
| Un navegador nuevo que instalar | Perfil nuevo, sesiones nuevas, ajustes nuevos |
| El asistente vive dentro | Tus sesiones quedan en **la compilación de otro** |
| La plataforma la eligen ellos | Aside y Dia son solo para macOS hoy |

**Nosotros tomamos el arreglo opuesto.** Ningún navegador nuevo — tu Chrome de siempre,
tus sesiones de siempre, y el asistente trabaja *en la ventana que ya estás mirando*.
Ves aterrizar cada clic y puedes recuperar el ratón a mitad de tarea. Nada que migrar,
nada que entregar.

Esa decisión es también la razón de que funcione en Windows, macOS, Linux y WSL:
**no tuvimos que construir un navegador para cada uno, así que no había plataforma que elegir.**

> **¿Lo necesitas? Constrúyelo.**
>
> Esa es la idea completa. No un producto que espera la hoja de ruta de otro,
> sino una herramienta pequeña que es tuya, en la máquina que ya usas, dentro
> del navegador donde ya iniciaste sesión. Unas 2.600 líneas entre JavaScript, Python y shell —
> se leen en una tarde. Léela, cámbiala, hazla tuya.

Wbrowser apunta a **Windows, macOS, Linux y WSL**. Medido en macOS, Linux nativo, WSL2 y Windows nativo — aunque no todas las
comprobaciones se ejecutaron en todas las plataformas (ver tabla). Porque
*"¿qué sistema operativo usas?"* nunca debería ser la razón por la que no puedes
automatizar tu propio navegador.

---

## ¿Qué es esto?

La mayoría de las herramientas de automatización le dan a tu IA un navegador **nuevo y vacío**.
Así que no puede ver tu correo, tus paneles, ni nada que esté detrás de un inicio de sesión —
a menos que entregues contraseñas o configures integraciones de API para cada servicio.

Wbrowser hace lo contrario: **inicias sesión una vez, a mano, en una ventana normal de Chrome.**
Después, tu terminal (o tu asistente de IA) controla esa misma ventana — ya autenticada,
en todas partes.

```bash
./wb go https://mail.example.com   # se abre en TU sesión iniciada
./wb read                          # te dice qué hay en pantalla
./wb click '#compose'              # hace clic
```

**Wbrowser nunca ve tus contraseñas.** Tú las escribes, Chrome las guarda, y Wbrowser
solo controla la ventana que ya está abierta.

---

### Un inicio de sesión abre muchos sitios

Esta es la parte que hace que valga la pena configurarlo. Inicia sesión en Google
**una vez** en esa ventana y:

```
Google en sí          google.com · youtube.com · tus apps de Workspace
Sitios con Google SSO  todo lo que alcance "Iniciar sesión con Google" —
                       sistemas internos, reservas, paneles de control
Todo lo demás         inicia sesión a mano una vez; se mantiene
```

Medido en un perfil real: **un solo inicio de sesión de Google** trajo consigo YouTube
y **dos sistemas internos en los que nunca se inició sesión por separado** (usan Google SSO).
El resto (GitHub, Reddit, etc.) se inició a mano una vez y sigue activo.

Así que el coste inicial es: *un inicio de sesión de Google, más uno por cada sitio
que no use Google.* Después de eso, tu agente llega a todos.

🔴 La otra cara es el mismo hecho: **quien pueda manejar este navegador puede actuar
en todos esos sitios como tú.** Consulta [Seguridad](#seguridad).

## Inicio rápido

```bash
git clone https://github.com/<tu-usuario>/Wbrowser.git
cd Wbrowser
# Wbrowser usa el Chrome *del sistema*, así que la descarga del navegador
# de Playwright es innecesaria — omítela y ahorra ~400MB:
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install

node launch.js       # 1. abre una ventana de Chrome dedicada
                     # 2. inicia sesión en tus sitios en esa ventana (¡a mano!)
node engine.js       # 3. inicia el motor de control
./wb go https://example.com
```

Eso es todo. **El paso 2 es lo único que haces manualmente.**

> **Si `./wb` dice "Permission denied"** — el bit de ejecución se perdió al clonar.
> Se arregla una sola vez:
> ```bash
> chmod +x wb install.sh autostart.sh sync-session.sh
> ```

> **Servidores sin pantalla:** si no hay `$DISPLAY`, Wbrowser lanza Chrome en modo
> headless automáticamente. Fuérzalo con `WBROWSER_HEADLESS=1` o `=0`.
> 🔵 Sin pantalla no puedes iniciar sesión a mano — usa `./sync-session.sh export`
> en un equipo de escritorio y luego `import` aquí.

---

## ¿Por qué una ventana de Chrome separada?

Desde **Chrome 136** (marzo de 2025), `--remote-debugging-port` se **ignora** en el
directorio de perfil predeterminado de Chrome. Google hizo este cambio porque los atacantes
usaban la depuración remota para robar cookies.

Por eso ahora es **obligatorio** un `--user-data-dir` no predeterminado. Wbrowser crea uno
en `~/.wbrowser` e inicia Chrome allí.

**Esto significa que tus sesiones actuales no se transfieren.** Inicias sesión una vez en
la ventana nueva y desde entonces se mantienen.

> ⚠️ **Copiar la carpeta de perfil de Chrome no funciona.** Lo intentamos: 685 cookies
> quedaron en **3**, y todas las cookies de sesión se perdieron. Chrome invalida los
> perfiles que no reconoce. Inicia sesión de nuevo — toma un minuto y sí funciona.

---

## Comandos

```bash
./wb go <url>              abre una página y devuelve su estructura
./wb read                  resume la página actual
./wb click <selector>      hace clic en un elemento
./wb type <selector> <texto>   rellena un campo
./wb press Enter           pulsa una tecla
./wb eval '<js>'           ejecuta JavaScript en la página
./wb console [regex]       registros de consola + excepciones no capturadas
./wb network               peticiones fallidas (4xx/5xx, CORS, timeouts)
./wb shot [archivo.png]    captura de pantalla
./wb tabs                  pestañas abiertas, agrupadas por agente
./wb close                 cierra solo las pestañas que tú abriste
./wb status                ¿todo funcionando? ¿qué perfil?
./wb show                  trae la ventana del navegador al frente
```

### No adivines los selectores

`./wb read` devuelve los elementos **reales** de la página:

```
inputs(1):
  - #searchbox_input  (Buscar sin ser rastreado)
buttons(3): Buscar, Iniciar sesión, Ajustes
```

Copia de ahí.

> Caso real: adivinamos `input[name=q]` para un campo de búsqueda y falló — era un
> `textarea`. `read` tenía la respuesta correcta desde el principio.

---

## Úsalo desde un asistente de IA (MCP)

Wbrowser habla [Model Context Protocol](https://modelcontextprotocol.io),
así que cualquier asistente compatible con MCP puede controlar tu navegador.

**Local (stdio):**
```json
{
  "mcpServers": {
    "wbrowser": {
      "command": "node",
      "args": ["/ruta/a/Wbrowser/mcp-server.js"]
    }
  }
}
```

**Remoto (HTTP):**
```bash
export WBROWSER_MCP_TOKEN=$(openssl rand -hex 32)
node mcp-server.js --http --port 7982 --host 127.0.0.1
```

Luego simplemente háblale a tu asistente:

> *"Abre mi panel y resume los números de hoy."*
> *"¿Qué hay en mi carrito de esa tienda?"*

> 🔴 **El servidor remoto se niega a arrancar sin un token.** No es opcional —
> controla un navegador que contiene todas tus sesiones. Quien alcance ese puerto
> se convierte en ti.

---

## Tareas programadas (cron)

Crea `jobs/revision-matutina.json`:

```json
{
  "schedule": "0 9 * * 1-5",
  "tab": "morning",
  "steps": [
    { "goto": "https://dashboard.example.com", "wait": 2000 },
    { "eval": "document.querySelector('.total').innerText" },
    { "shot": true }
  ]
}
```

```bash
node cron.js list      qué está registrado
node cron.js next      cuándo se ejecuta cada tarea
node cron.js run <nombre>   ejecutar una vez, ahora
node cron.js daemon    ejecutar según el horario
```

`0 9 * * 1-5` = **minuto 0, hora 9, días laborables.** Cron estándar de 5 campos:
`minuto hora día mes día-semana`.

### Las acciones irreversibles se bloquean por defecto

La automatización desatendida significa que **nadie está mirando cuando algo sale mal.**
Por eso los pasos que parecen enviar / pagar / eliminar se **rechazan**:

```
⛔ paso 2 bloqueado — parece irreversible (click: #submit-payment)
   Si es intencional, añade "allowIrreversible": true al archivo de la tarea.
```

La autorización es **por tarea**, no global.

---

## ¿Quién está controlando? (indicador visual)

Cuando un agente controla el navegador, lo ves:

- **Un borde translúcido** con una etiqueta: `🤖 mi-agente en control`
- **El título de la pestaña** lleva prefijo: `[mi-agente] Panel`

El borde se desvanece tras 6 segundos de inactividad, así que "en control" significa
realmente **ahora mismo**. Los colores derivan del nombre del agente, de modo que varios
agentes se distinguen de un vistazo.

El prefijo de la pestaña **sobrevive a la navegación** — un `MutationObserver` lo vuelve
a aplicar cada vez que la página reescribe su propio título (algo que las SPA hacen
constantemente).

---

## Varias cuentas

Abre varios perfiles de Chrome en la misma ventana y Wbrowser puede dirigirse a
cada uno por separado:

```bash
./wb -a work@example.com go https://mail.example.com
./wb windows                    # lista los perfiles abiertos
```

O asigna sitios a cuentas en `accounts.json`:

```json
{
  "sites": {
    "mail.example.com": { "account": "work@example.com" }
  }
}
```

> 🔴 **Si nombras una cuenta que no está abierta, Wbrowser falla** en lugar de adivinar.
> Enviar correo desde la cuenta equivocada es peor que un mensaje de error.

---

## Notas de plataforma

| SO | Detección automática de Chrome |
|---|---|
| **Windows** | `Program Files`, `AppData`, Edge |
| **macOS** | `/Applications/Google Chrome.app`, Chromium, Edge |
| **Linux** | `google-chrome`, `chromium`, snap, Edge |
| **WSL** | Chrome de Windows primero (el navegador que realmente usas) |

Si la detección falla, usa `WBROWSER_CHROME=/ruta/a/chrome`.

> **Probado en hardware real** (2026-08-24):
>
> | Plataforma | Chrome | Verificado por | Qué se midió allí |
> |---|---|---|---|
> | macOS 15 | 151 | revisor independiente | arranque · motor · CLI · rutas de estado |
> | Linux (nativo, sin pantalla) | 148 | revisor independiente | lo anterior + **revisión de seguridad** |
> | WSL2 + Chrome de Windows | 151 | mantenedor | lo anterior |
> | Windows 10 (nativo) | 151 | revisor independiente | lo anterior + **prueba de extremo a extremo** |
>
> 🔵 **No todas las comprobaciones se ejecutaron en todas las plataformas.** La revisión de
> seguridad (rechazo sin token confirmado con `ss`, motor inalcanzable fuera de loopback) se
> hizo en Linux. La prueba de extremo a extremo (`/health` → `/act` → extracción real) se hizo
> en Windows. Las rutas UNC (`\\wsl.localhost\...`) también funcionan — medido, en contra de lo que esperábamos.
>
> La seguridad se revisó por separado en Linux: sin token el servidor MCP HTTP
> termina y **nunca abre un socket** (verificado con `ss`); el motor escucha solo
> en `127.0.0.1` y no es alcanzable por la red interna.

---

## Seguridad

Esta herramienta controla un navegador que contiene **todas tus sesiones**. Trátala en consecuencia.

- 🔴 **`127.0.0.1` no es una valla — significa "cualquier proceso que corra como tú entra".**
  El puerto de depuración de Chrome (9222) **no tiene autenticación**. Cualquier proceso
  local de esa máquina — otra app, un hook de npm, un script suelto — puede conectarse y
  manejar todas las sesiones en las que iniciaste sesión. Medido: un proceso ajeno listó
  las pestañas abiertas vía `GET http://127.0.0.1:9222/json/list` sin credenciales.
  Úsalo solo en una máquina donde confíes en todo lo que corre como tu usuario.
- El motor escucha **solo en `127.0.0.1`**. Nunca lo expongas directamente.
- 🔴 `mcp-server.js --host 0.0.0.0` existe y **se enlazará a todas las interfaces**. El
  código imprime una advertencia, pero para entonces el puerto ya está abierto. Usa
  `127.0.0.1` salvo que estés en una red privada de confianza (VPN/tailnet), y siempre con token.
- El servidor MCP HTTP **exige un token** y se niega a arrancar sin él.
- `./wb type` **no registra** lo que se escribió — podría ser una contraseña.
- Los valores de las cookies **nunca** se imprimen, registran ni devuelven.
- 🔴 **No la uses** para introducir contraseñas, números de tarjeta o documentos de identidad.
  Inicia sesión a mano; Wbrowser reutiliza esa sesión.

### Copia de seguridad de la sesión

```bash
./sync-session.sh export   cookies → almacenamiento cifrado
./sync-session.sh import   restaurar en otra máquina
./sync-session.sh status   qué hay respaldado
```

> 🔴 **Las cookies son tan sensibles como las contraseñas** — *son* el inicio de sesión.
> El script se niega a escribir si el destino no está realmente cifrado.

---

## Variables de entorno

| Variable | Predeterminado | Propósito |
|---|---|---|
| `WBROWSER_CHROME` | autodetección | Ruta al ejecutable de Chrome |
| `WBROWSER_PROFILE_DIR` | `~/.wbrowser` | Directorio de perfil |
| `WBROWSER_PROFILE` | `Default` | Nombre del perfil dentro de él |
| `WBROWSER_CDP_PORT` | `9222` | Puerto de depuración de Chrome |
| `WBROWSER_PORT` | `7981` | Puerto del motor de control |
| `WBROWSER_AGENT` | automático | Nombre mostrado en el borde y la pestaña |
| `WBROWSER_MCP_TOKEN` | — | **Obligatorio** para MCP remoto |
| `WBROWSER_NOTES` | — | Directorio para registros de trabajo (opcional) |

---

## Ejecutar al arrancar

```bash
# Linux / WSL (servicio de usuario systemd)
./install.sh
systemctl --user status wbrowser
```

El motor arranca automáticamente. El **navegador** todavía hay que abrirlo — es un
proceso de escritorio, y cuándo se abre debería ser decisión tuya.

---

## Limitaciones conocidas

- **No incluye un bucle de lenguaje natural.** El agente elige los selectores; `read`
  le da los reales, así que no tiene que adivinar.
- **Solo Chrome/Chromium.** Firefox no tiene CDP.
- **Un puerto CDP = un proceso de Chrome.** Los perfiles abiertos desde esa ventana son
  visibles; un Chrome lanzado por separado no lo es.

---

## Contribuir · seguridad

- [CONTRIBUTING.md](../CONTRIBUTING.md) — las reglas que dieron forma a este código y cómo probarlo
- [SECURITY.md](../SECURITY.md) — 🔴 el modelo de amenazas. Léelo antes de usarlo en una
  máquina compartida: el puerto de depuración de Chrome **no tiene autenticación**, así que
  cualquier proceso local que corra como tú puede manejar tus sesiones.

¿Encontraste un problema de seguridad? Abre un
[aviso privado](https://github.com/w-partners/Wbrowser/security/advisories/new) en vez de un issue público.

## Licencia

MIT — consulta [LICENSE](../LICENSE).
