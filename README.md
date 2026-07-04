# OsintFlow

> Panel de control centralizado de **OSINT** (Open Source Intelligence) con una interfaz minimalista en blanco y negro. Seis herramientas de investigación en una sola aplicación web, lista para levantar con un único comando de Docker.

---

## Tabla de contenidos

1. [¿Qué es OsintFlow?](#-qué-es-osintflow)
2. [¿Qué significa OSINT?](#-qué-significa-osint)
3. [Funcionalidades y casos de uso](#-funcionalidades-y-casos-de-uso)
   - [1. Búsqueda de Usuario](#1-búsqueda-de-usuario-sherlock-like)
   - [2. Análisis de Email](#2-análisis-de-email)
   - [3. Reconocimiento de IP y Dominio](#3-reconocimiento-de-ip-y-dominio)
   - [4. Búsqueda de Teléfono](#4-búsqueda-de-teléfono)
   - [5. Extractor de Metadatos EXIF](#5-extractor-de-metadatos-exif)
   - [6. Historial y Exportación](#6-historial-y-exportación)
4. [Requisitos previos (instalar Docker)](#-requisitos-previos-instalar-docker)
   - [Windows](#windows)
   - [macOS](#macos)
   - [Linux](#linux)
   - [Verificar la instalación](#verificar-la-instalación)
5. [Instalación paso a paso](#-instalación-paso-a-paso)
6. [Uso de la aplicación](#-uso-de-la-aplicación)
7. [Solución de problemas](#-solución-de-problemas)
8. [Aviso legal y ético](#-aviso-legal-y-ético)
9. [Tecnologías utilizadas](#-tecnologías-utilizadas)
10. [Licencia](#-licencia)

---

## ¿Qué es OsintFlow?

**OsintFlow** es una aplicación web que reúne en un único panel varias herramientas de **investigación de fuentes abiertas**. En lugar de abrir decenas de pestañas y recordar la dirección de cada red social o servicio WHOIS, OsintFlow te ofrece un punto de entrada único: escribes un alias, un correo, una IP, un dominio, un teléfono o subes una imagen, y la aplicación consulta automáticamente múltiples fuentes públicas y te devuelve los resultados ordenados.

La interfaz es **minimalista**, en **blanco y negro puro**, con un menú lateral para navegar entre las herramientas y un historial local que guarda todas tus investigaciones para que puedas exportarlas después en formato **JSON** o **CSV**.

Está pensada para:

- Estudiantes y profesionales de **ciberseguridad** que quieren practicar OSINT.
- Equipos de **red team / blue team** que necesitan reconocimiento rápido.
- Periodistas e investigadores que verifican identidades digitales.
- Cualquier persona curiosa que quiera entender **cuánta información pública existe sobre sí misma**.

---

## ¿Qué significa OSINT?

**OSINT** son las siglas en inglés de *Open Source Intelligence*, que en español se traduce como **Inteligencia de Fuentes Abiertas**.

La palabra clave es **"abiertas"**: se trata de información que **cualquier persona puede acceder legalmente** porque está publicada en internet, en redes sociales, en registros públicos, en metadatos de archivos, etc. No incluye hackeos, accesos no autorizados ni datos privados robados.

Algunos ejemplos de información OSINT:

- El perfil público de alguien en Instagram o GitHub.
- Los registros DNS de un dominio (públicos por diseño).
- La geolocalización aproximada de una dirección IP.
- Los metadatos EXIF de una foto que alguien subió a internet.
- La fecha de registro de un nombre de dominio (WHOIS).

OsintFlow **automatiza** la recogida de esta información para ahorrarte tiempo y centralizar los resultados en un único lugar.

---

## Funcionalidades y casos de uso

### 1. Búsqueda de Usuario (Sherlock-like)

**¿Qué hace?**

Escribes un alias o nickname (por ejemplo, `johndoe`) y OsintFlow comprueba, de forma simultánea, si existe un perfil público con ese nombre en **más de 30 plataformas**: GitHub, GitLab, Twitter/X, Instagram, TikTok, YouTube, Reddit, Twitch, Pinterest, Medium, Dev.to, Steam, Spotify, Telegram, Mastodon y muchas más.

Para cada plataforma, la aplicación construye la URL del perfil y comprueba si responde correctamente. Las que existen te las devuelve como **enlaces directos** en los que puedes hacer clic; las que no existen aparecen como "sin resultados".

**Caso de uso real:**

> Imagina que te llega un correo de alguien llamado "AlexDev" ofreciéndote un trabajo. Antes de responder, quieres verificar si esa persona es real. Escribes `AlexDev` en la Búsqueda de Usuario y descubres que tiene perfil en GitHub (con actividad reciente), en LinkedIn (a través de Linktree) y en Dev.to, pero no en ninguna red social personal. Eso te da una idea de su identidad digital y de si es creíble.

---

### 2. Análisis de Email

**¿Qué hace?**

Introduces un correo electrónico y OsintFlow:

1. **Valida** el formato del correo.
2. Extrae el **dominio** y consulta sus **registros MX** (los servidores que reciben el correo).
3. Comprueba si existe un **avatar público en Gravatar** (lo que indica uso en plataformas como WordPress o GitHub).
4. Revisa una **base de datos local de filtraciones conocidas** para ver si el dominio del correo aparece en breaches públicos (Adobe, Dropbox, LinkedIn, Yahoo, etc.).
5. Devuelve **observaciones** que te ayudan a interpretar los resultados.

**Caso de uso real:**

> Recibes un email de `contacto@empresa-desconocida.com`. Lo analizas y descubres que el dominio no tiene registros MX (no puede recibir correo, lo cual es sospechoso), no aparece en ninguna filtración conocida (es un dominio muy nuevo o pequeño) y no tiene Gravatar. La combinación de estas señales sugiere que podría ser un dominio creado recientemente para phishing.

---

### 3. Reconocimiento de IP y Dominio

**¿Qué hace?**

Introduces una **IP** o un **dominio** y OsintFlow detecta automáticamente cuál de los dos es. Luego:

- **Para una IP**: obtiene la **geolocalización aproximada** (país, región, ciudad, coordenadas), el **ISP**, la organización y el número de **sistema autónomo (AS)**, y hace un **reverse DNS**.
- **Para un dominio**: consulta los registros DNS (**A, MX, TXT, NS**), obtiene la información **WHOIS/RDAP** (registrar, fecha de creación, expiración, name servers, estado), geolocaliza la IP a la que apunta y **detecta si está protegido por Cloudflare u otro WAF** (Firewall de Aplicaciones Web) analizando tanto la IP resuelta como las cabeceras HTTP.

**Caso de uso real:**

> Estás analizando un sitio web sospechoso: `tienda-oferta-barata.com`. Lo introduces y descubres que el dominio se registró hace solo 3 días, está detrás de Cloudflare (lo que oculta el servidor real), sus registros TXT no incluyen SPF ni DKIM (configuración de correo deficiente) y la geolocalización de la IP de Cloudflare apunta a EE.UU. La combinación "dominio muy reciente + Cloudflare + mala configuración" es una señal clásica de tienda fraudulenta.

---

### 4. Búsqueda de Teléfono

**¿Qué hace?**

Introduces un número de teléfono **con prefijo internacional** (por ejemplo, `+34 612 345 678`) y OsintFlow:

1. **Parsea** el número con la librería `libphonenumber` (la misma que usa Google en Android).
2. Valida si el número es **correcto** según las reglas de cada país.
3. Identifica el **país**, el **código ISO**, el prefijo internacional y el **tipo** (móvil, fijo, VoIP...).
4. **Estima el operador** a partir del rango del número (es una estimación; la portabilidad puede alterar el operador real).
5. Genera un **enlace directo a WhatsApp** (`wa.me/...`) si el número tiene formato de móvil.

**Caso de uso real:**

> Encontraste un número de teléfono en un anuncio de segunda mano que te parece sospechoso: `+34 612 345 678`. Lo analizas y confirmas que es un número móvil español válido. El enlace a WhatsApp te permite abrir un chat sin añadir el número a tus contactos, para investigar más antes de comprometerte a una compra.

---

### 5. Extractor de Metadatos EXIF

**¿Qué hace?**

Arrastras o seleccionas una imagen (JPG, PNG, TIFF, HEIC) y OsintFlow extrae **todos los metadatos ocultos** que lleva incrustados:

- **GPS**: coordenadas exactas donde se tomó la foto (con enlace a OpenStreetMap).
- **Cámara**: marca, modelo, lente.
- **Fecha**: fecha y hora de captura (que puede diferir de la fecha del archivo).
- **Software**: programa con el que se editó (Photoshop, Lightroom, GIMP...).
- **Ajustes de exposición**: ISO, apertura, velocidad de obturación, distancia focal.
- **Metadatos IPTC y XMP**: copyright, autor, descripción.

**Caso de uso real:**

> Alguien te envía una foto por un foro diciendo "estoy en la playa". La subes al extractor y descubres que las coordenadas GPS apuntan a un edificio concreto en una ciudad del interior, la cámara es un modelo antiguo y la fecha de captura es de hace 3 años. La foto no se tomó hoy ni en una playa: era una foto antigua con metadatos que delataban su origen real.

> **Importante:** las redes sociales como Instagram, Facebook y Twitter **eliminan automáticamente** los metadatos EXIF al subir fotos. Esta herramienta es útil para imágenes originales recibidas por email, mensajería o descargadas de sitios que conservan los metadatos.

---

### 6. Historial y Exportación

**¿Qué hace?**

Cada búsqueda que realizas en cualquiera de las herramientas anteriores **se guarda automáticamente** en una base de datos local SQLite. Desde el panel de Historial puedes:

- **Ver** todas tus investigaciones pasadas, ordenadas por fecha.
- **Filtrar** por tipo de herramienta.
- **Hacer clic** en cualquier registro para ver los resultados completos.
- **Borrar** registros individuales o todo el historial.
- **Exportar** todo (o lo filtrado) en formato **JSON** (ideal para procesamiento posterior) o **CSV** (ideal para abrir en Excel o Google Sheets).

**Caso de uso real:**

> Estás haciendo un trabajo de investigación sobre un dominio sospechoso. A lo largo de varios días realizas búsquedas de IP, WHOIS y emails relacionados. Al final, exportas todo el historial a CSV y lo abres en Excel para entregárselo a tu equipo, con todas las fechas y resultados en una tabla ordenada.

---

## Requisitos previos (instalar Docker)

OsintFlow está diseñado para funcionar **100% dentro de Docker**. No necesitas instalar Node.js, Python, ni ninguna base de datos a mano: Docker se encarga de todo.

### ¿Qué es Docker?

**Docker** es un programa que permite "empaquetar" una aplicación junto con todas sus dependencias (librerías, base de datos, configuración) dentro de un **contenedor**. Un contenedor es como una caja cerrada y autónoma: funciona igual en cualquier ordenador, sin que tengas que preocuparte por instalar nada más.

La analogía más común: si una aplicación normal es una receta de cocina que requiere que tengas todos los ingredientes en tu nevera, Docker es como un plato precocinado que ya viene con todo dentro y solo necesitas calentarlo.

Para usar OsintFlow solo necesitas instalar **Docker** (y opcionalmente **Docker Compose**, que ya viene incluido en las versiones modernas de Docker).

### Windows

1. Descarga **Docker Desktop** desde la página oficial:
   👉 https://docs.docker.com/desktop/install/windows-install/
2. Ejecuta el instalador `Docker Desktop Installer.exe`.
3. Durante la instalación, asegúrate de marcar la opción **"Use WSL 2 instead of Hyper-V"** (recomendado).
4. Reinicia el equipo si te lo pide.
5. Abre **Docker Desktop** desde el menú Inicio. La primera vez puede pedirte instalar/actualizar **WSL 2**; sigue las instrucciones de la aplicación.
6. Cuando veas el icono de la ballena en la barra de tareas (abajo a la derecha) en verde, Docker está listo.

> **Requisito:** Windows 10 64-bit (versión 2004 o superior) o Windows 11. Debe estar activada la virtualización en la BIOS.

### macOS

1. Descarga **Docker Desktop** desde la página oficial:
   👉 https://docs.docker.com/desktop/install/mac-install/
2. Elige la versión correcta según tu procesador:
   - **Mac con chip Apple Silicon (M1/M2/M3/M4)**: descarga la versión "Apple Silicon".
   - **Mac con procesador Intel**: descarga la versión "Intel".
3. Abre el archivo `.dmg` descargado y arrastra el icono de Docker a la carpeta **Aplicaciones**.
4. Abre Docker desde Aplicaciones. Te pedirá privilegios de administrador la primera vez.
5. Cuando el icono de la ballena aparezca en la barra de menú superior, Docker está listo.

### Linux

En Linux, la instalación se hace por terminal. El método más limpio es usar el repositorio oficial de Docker.

**Ubuntu / Debian:**

```bash
# Actualizar paquetes e instalar dependencias
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Añadir la clave GPG oficial de Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Añadir el repositorio de Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker Engine + Docker Compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Permitir usar Docker sin "sudo" (opcional, cierra sesión después)
sudo usermod -aG docker $USER
```

Guías oficiales para otras distribuciones:

- **CentOS / RHEL / Fedora**: https://docs.docker.com/engine/install/
- **Arch Linux**: `sudo pacman -S docker docker-compose`
- **openSUSE**: `sudo zypper install docker docker-compose`

Tras instalar, activa el servicio:

```bash
sudo systemctl enable --now docker
```

### Verificar la instalación

Abre una terminal (o Símbolo del sistema / PowerShell en Windows) y ejecuta:

```bash
docker --version
docker compose version
```

Si ves algo como `Docker version 24.x.x` y `Docker Compose version v2.x.x`, todo está listo.

---

## Instalación paso a paso

### Paso 1: Instalar Git (si no lo tienes)

Git es el programa que descarga ("clona") el código desde GitHub.

- **Windows**: descárgalo de https://git-scm.com/download/win e instálalo con las opciones por defecto.
- **macOS**: en la terminal ejecuta `git --version`; si no está, el sistema te ofrecerá instalarlo automáticamente.
- **Linux**: `sudo apt install git` (Ubuntu/Debian) o el equivalente de tu distribución.

### Paso 2: Clonar el repositorio

Abre una terminal en la carpeta donde quieras guardar el proyecto y ejecuta:

```bash
git clone https://github.com/tu-usuario/osintflow.git
cd osintflow
```

> Sustituye `tu-usuario` por el nombre de usuario o la organización de GitHub donde hayas subido el proyecto. Si lo tienes en un ZIP, simplemente descomprímelo y entra en la carpeta.

### Paso 3: Levantar la aplicación con Docker

Desde dentro de la carpeta del proyecto, ejecuta:

```bash
docker compose up -d --build
```

**¿Qué hace este comando exactamente?**

- `docker compose`: llama a Docker Compose, la herramienta que lee el archivo `docker-compose.yml` y sabe qué contenedores debe crear.
- `up`: indica que quieres **levantar** (arrancar) los servicios definidos.
- `-d` (detached): ejecuta los contenedores **en segundo plano**, para que la terminal quede libre.
- `--build`: **construye** la imagen Docker a partir del `Dockerfile` (la primera vez es obligatorio; las siguientes veces Docker reutiliza la caché y es mucho más rápido).

La **primera vez** tardará unos minutos, porque Docker tiene que descargar la imagen base de Node.js, instalar las dependencias y compilar la aplicación. Verás muchas líneas de log; es normal.

Cuando termine, verás algo parecido a:

```
✔ Container osintflow  Started
```

### Paso 4: Comprobar que está funcionando

Abre el navegador y entra en:

👉 **http://localhost:3000**

Deberías ver el panel de OsintFlow con el menú lateral y las seis herramientas.

> Si el puerto 3000 ya está ocupado por otra aplicación, edita el archivo `docker-compose.yml` y cambia la línea `ports: - "3000:3000"` por, por ejemplo, `"8080:3000"`. Luego accede a `http://localhost:8080`.

---

## Uso de la aplicación

### Acceder

Una vez levantado el contenedor, abre tu navegador en **http://localhost:3000** (o el puerto que hayas configurado).

### Navegación

A la izquierda verás un **menú lateral** con las herramientas:

- **Panel**: pantalla de inicio con un resumen y acceso rápido a cada herramienta.
- **Búsqueda de Usuario**: escribe un alias y pulsa *Buscar*.
- **Análisis de Email**: escribe un correo y pulsa *Analizar*.
- **IP y Dominio**: escribe una IP o dominio y pulsa *Analizar*.
- **Teléfono**: escribe un número con prefijo internacional y pulsa *Analizar*.
- **Metadatos EXIF**: arrastra o selecciona una imagen.
- **Historial**: revisa, filtra y exporta tus investigaciones.

En móviles y tablets, el menú se convierte en una barra superior desplazable.

### Flujo de trabajo recomendado

1. **Realiza una búsqueda** en la herramienta que necesites.
2. **Revisa los resultados**: OsintFlow te los muestra organizados en tarjetas y tablas.
3. La búsqueda **se guarda automáticamente** en el Historial.
4. Cuando termines, ve al **Historial** para revisar todo lo que has investigado.
5. **Exporta** en JSON o CSV si necesitas compartir o procesar los resultados.

### Detener la aplicación

Para parar OsintFlow sin perder tus datos:

```bash
docker compose down
```

Los datos del historial se guardan en un **volumen Docker** persistente, así que estarán ahí la próxima vez que levantes el contenedor con `docker compose up -d`.

### Actualizar a una nueva versión

Si has descargado una nueva versión del código:

```bash
git pull
docker compose up -d --build
```

### Ver los logs del contenedor

Si necesitas diagnosticar algún problema:

```bash
docker compose logs -f osintflow
```

Pulsa `Ctrl+C` para salir.

---

## Solución de problemas

### El puerto 3000 ya está en uso

Edita `docker-compose.yml` y cambia `"3000:3000"` por otro puerto, por ejemplo `"8080:3000"`. Luego accede a `http://localhost:8080`.

### La primera construcción tarda mucho

Es normal la primera vez (3-10 minutos según tu conexión y equipo). Docker está descargando la imagen base y compilando. Las siguientes veces será mucho más rápido gracias a la caché.

### No puedo acceder a localhost

- Verifica que el contenedor está corriendo con `docker compose ps`.
- Revisa los logs con `docker compose logs osintflow`.
- En Linux, si usaste `sudo` para instalar Docker, puede que necesites ejecutar los comandos con `sudo` o añadir tu usuario al grupo `docker`.

### La búsqueda de usuario no encuentra nada

Algunas plataformas bloquean las peticiones automáticas o cambian su estructura. OsintFlow usa heurísticas para detectar perfiles existentes, pero ningún método es 100% preciso. Si una plataforma devuelve "sin resultados", puedes abrir la URL manualmente para confirmar.

### La base de datos se ha borrado

Si ejecutas `docker compose down -v` (con la opción `-v`), **se borra el volumen** y con él el historial. Usa `docker compose down` (sin `-v`) para conservar los datos.

### Quiero reiniciar el historial

Entra en la herramienta **Historial** dentro de la app y pulsa **"Borrar todo"**, o bien ejecuta:

```bash
docker compose down -v
docker compose up -d
```

---

## Aviso legal y ético

**OsintFlow es una herramienta educativa.** Está diseñada para enseñar conceptos de OSINT, ayudar a profesionales de la ciberseguridad en sus labores de reconocimiento y permitir a cualquier persona entender cuánta información pública existe sobre sí misma.

Al usar OsintFlow aceptas cumplir la legislación vigente de tu país, en particular:

- **RGPD** (Reglamento General de Protección de Datos) y la **LOPDGDD** en España y la UE.
- La **Ley Orgánica 10/1995** del Código Penal español, especialmente en lo relativo al descubrimiento y revelación de secretos.
- Cualquier normativa equivalente en tu jurisdicción.

### Uso permitido

- Investigar tu propia huella digital.
- Verificar identidades en contextos legítimos (por ejemplo, confirmar que un perfil profesional es real).
- Realizar reconocimientos de seguridad sobre sistemas que te pertenecen o para los que tienes autorización expresa.
- Docencia e investigación académica.

### Uso prohibido

- **Acosar, intimidar o vigilar** a personas sin su consentimiento.
- **Suplantar identidades** o cometer fraude.
- Acceder a información que no sea pública o eludir controles de acceso.
- Recopilar datos de menores sin autorización de sus tutores legales.
- Cualquier actividad que vulnere la privacidad o los derechos fundamentales de las personas.

### Responsabilidad

El desarrollador de OsintFlow **no se hace responsable** del uso indebido de esta herramienta. OsintFlow solo consulta **información públicamente accesible**; el hecho de que la información sea pública no implica que su uso sea ético o legal en todos los contextos.

**La existencia de una herramienta no justifica su uso indebido. Actúa con responsabilidad, criterio y respeto hacia los demás.**

---

## Tecnologías utilizadas

| Capa | Tecnología |
|------|-----------|
| Framework | **Next.js 16** (App Router, modo standalone) |
| Lenguaje | **TypeScript 5** |
| Frontend | **React 19**, **Tailwind CSS 4**, **shadcn/ui**, **Lucide Icons** |
| Base de datos | **SQLite** mediante **Prisma ORM** |
| Iconos | **lucide-react** |
| EXIF | **exifr** |
| Teléfonos | **libphonenumber-js** |
| DNS / WHOIS | `dns` nativo de Node.js + RDAP |
| Geolocalización IP | ip-api.com (API pública gratuita) |
| Empaquetado | **Docker** + **Docker Compose** |

---

## Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Puedes usarlo, modificarlo y distribuirlo libremente, manteniendo el aviso de copyright y el aviso legal sobre el uso ético de la herramienta.

```
MIT License

Copyright (c) 2025 OsintFlow

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

**OsintFlow** — Inteligencia de fuentes abiertas, simplificada. Úsala con responsabilidad.
