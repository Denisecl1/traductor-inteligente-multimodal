# Traductor Inteligente Multimodal

Aplicación web de traducción inteligente **Español ↔ Inglés** que integra cuatro modalidades de entrada: **chat, audio, documentos e imágenes**. La solución utiliza Inteligencia Artificial mediante la API de OpenAI para detectar el idioma, traducir contenido y, en el caso del audio, generar una salida hablada en el idioma de destino.

## Problema que resuelve

En muchas situaciones, una persona necesita traducir información que no se encuentra únicamente en texto escrito. El contenido puede llegar como una conversación, una grabación de voz, un documento o una imagen con texto visible.

Este proyecto centraliza estas necesidades en una sola aplicación web, permitiendo traducir contenido entre español e inglés desde distintos formatos sin utilizar herramientas separadas para cada tipo de entrada.

## Funcionalidades implementadas

### Chat
- Traducción bidireccional Español ↔ Inglés.
- Detección automática del idioma.
- Identificación de participantes.
- Visualización del texto original y su traducción.
- Historial de conversación durante la sesión.
- Botones para copiar el texto original y la traducción.
- Opción para limpiar la conversación.
- Validación de mensajes vacíos y longitud máxima.

### Audio
- Carga de archivos de audio.
- Transcripción automática de voz.
- Detección del idioma de la transcripción.
- Traducción al idioma contrario.
- Generación de voz con el texto traducido.
- Reproductor para escuchar la traducción.
- Botones para copiar la transcripción y la traducción.
- Opción para limpiar el módulo.
- Validación de formato, tamaño y contenido.

### Documentos
- Traducción de archivos PDF, DOCX y TXT.
- Extracción del contenido textual.
- Detección del idioma.
- Traducción Español ↔ Inglés.
- Presentación separada del contenido original y traducido.
- Botones para copiar ambos textos.
- Opción para limpiar el módulo.
- Validaciones de archivo, formato, tamaño y contenido.

### Imágenes
- Carga de imágenes con texto visible.
- Vista previa de la imagen seleccionada.
- Identificación del texto mediante capacidades multimodales.
- Detección automática del idioma.
- Traducción del texto detectado.
- Botones para copiar el texto identificado y la traducción.
- Opción para limpiar resultados y vista previa.
- Validación de formato, tamaño y contenido legible.

## Tecnologías utilizadas

### Frontend
- HTML5
- CSS3
- JavaScript
- Bootstrap 5
- GitHub Pages

### Backend
- Python
- Vercel Functions
- OpenAI API

### Librerías
- `openai`
- `pypdf`
- `python-docx`

### Control de versiones y despliegue
- Git
- GitHub
- GitHub Pages
- Vercel

## Arquitectura general de la solución

La aplicación utiliza una arquitectura cliente-servidor.

```text
Usuario
   │
   ▼
Frontend
HTML + CSS + JavaScript + Bootstrap
GitHub Pages
   │
   │ Solicitudes HTTPS
   ▼
Backend
Python + Vercel Functions
   │
   ├── /api/chat
   ├── /api/audio
   ├── /api/documents
   └── /api/images
   │
   ▼
OpenAI API
   │
   ▼
Respuesta procesada
   │
   ▼
Frontend
```

El frontend se encarga de la interacción con el usuario, selección de archivos, validaciones iniciales, estados de carga y presentación de resultados.

El backend recibe las solicitudes, valida los datos, procesa los archivos cuando es necesario, se comunica con la API de OpenAI y devuelve respuestas controladas en formato JSON o audio.

## Uso de la API de OpenAI

La API de OpenAI se utiliza para las funciones de Inteligencia Artificial de la aplicación.

### Chat
El texto enviado por el usuario se procesa para:
1. Detectar si el contenido está principalmente en español o inglés.
2. Traducirlo al idioma contrario.
3. Conservar nombres propios, cifras, fechas, unidades, términos técnicos y siglas.
4. Evitar inventar información que no se encuentre en el texto original.

### Audio
El procesamiento se divide en varias etapas:
1. El archivo de audio se transcribe.
2. La transcripción se analiza para detectar el idioma.
3. El texto se traduce al idioma contrario.
4. La traducción se convierte nuevamente en audio mediante síntesis de voz.

### Documentos
El backend extrae primero el contenido textual del documento y posteriormente envía el texto a la API para su detección de idioma y traducción.

### Imágenes
La imagen se procesa mediante capacidades multimodales para identificar texto visible. Después se detecta el idioma y se genera la traducción correspondiente.

La clave `OPENAI_API_KEY` se almacena únicamente como variable de entorno en Vercel y nunca se incluye en el código del frontend.

## Programación Orientada a Objetos

El proyecto aplica Programación Orientada a Objetos tanto para organizar responsabilidades como para reutilizar código.

En el frontend se utilizan clases como:

- `StatusManager`: administra mensajes de estado.
- `AppUtils`: concentra funciones auxiliares.
- `ChatModule`: controla la traducción conversacional.
- `FileModule`: clase base para funcionalidades comunes de archivos.
- `AudioModule`: hereda de `FileModule` y gestiona el procesamiento de audio.
- `DocumentModule`: hereda de `FileModule` y gestiona documentos.
- `ImageModule`: hereda de `FileModule` y gestiona imágenes.
- `TranslatorApp`: inicializa y coordina los diferentes módulos.

Esta estructura permite aplicar conceptos como:
- Clases.
- Encapsulamiento.
- Herencia.
- Reutilización de código.
- Separación de responsabilidades.

En el backend también se utilizan clases para separar validación, procesamiento y comunicación con servicios externos.

## Seguridad y privacidad

La aplicación considera las siguientes medidas:

- La API Key de OpenAI se almacena únicamente en variables de entorno del backend.
- La clave nunca se expone en JavaScript ni en las herramientas del navegador.
- Se utiliza CORS para permitir solicitudes únicamente desde el origen autorizado.
- El backend valida tipos de contenido, extensiones, tamaños y datos recibidos.
- Se utilizan códigos HTTP para responder de forma controlada ante errores.
- Los errores internos no muestran claves, trazas ni detalles sensibles al usuario.
- La aplicación incluye un aviso de privacidad.
- Se recomienda no cargar información personal, confidencial o sensible.
- Los mensajes y archivos pueden enviarse a servicios de Inteligencia Artificial para su procesamiento.

## Códigos de respuesta y manejo de errores

La aplicación utiliza respuestas HTTP controladas, entre ellas:

- `200` — Solicitud procesada correctamente.
- `400` — Solicitud o datos inválidos.
- `403` — Origen no autorizado.
- `405` — Método HTTP no permitido.
- `413` — Archivo o solicitud demasiado grande.
- `415` — Tipo de contenido no permitido.
- `422` — Contenido recibido pero no procesable, por ejemplo texto no legible, audio sin contenido útil o idioma no soportado.
- `500` — Error interno controlado.
- `502` — Respuesta inesperada del servicio de Inteligencia Artificial, cuando aplica.

## Formatos de archivos soportados

### Audio
- MP3
- WAV
- M4A
- WEBM

Límite de archivo: **4 MB**.

### Documentos
- PDF
- DOCX
- TXT

Límite de archivo: **4 MB**.

### Imágenes
- PNG
- JPG
- JPEG
- WEBP

Límite de archivo: **3 MB**.

## Limitaciones conocidas

- La aplicación está diseñada exclusivamente para traducción entre español e inglés.
- La calidad de la transcripción depende de la claridad del audio.
- Audios con ruido excesivo, voz poco clara o sin contenido hablado pueden no procesarse correctamente.
- El reconocimiento de texto en imágenes depende de la calidad, iluminación, resolución y legibilidad.
- La escritura manual puede generar resultados menos precisos que el texto impreso.
- Las imágenes sin texto legible no pueden traducirse.
- Los archivos PDF basados únicamente en imágenes o escaneos pueden no contener texto extraíble mediante el módulo de documentos.
- La traducción conserva el contenido textual, pero no reconstruye de manera exacta el diseño original de un PDF o DOCX.
- El servicio depende de la disponibilidad de Internet, Vercel y la API de OpenAI.
- Los límites de tamaño se establecen para mantener solicitudes compatibles con el entorno de despliegue.

## Estructura principal del proyecto

```text
traductor-inteligente-multimodal/
│
├── api/
│   ├── chat.py
│   ├── audio.py
│   ├── documents.py
│   └── images.py
│
├── assets/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── app.js
│
├── index.html
├── requirements.txt
├── .python-version
├── .gitignore
├── vercel.json
└── README.md
```

## Autor

**Diana Denise Campos Lozano**

Instituto Tecnológico de Pachuca  
Ingeniería en Tecnologías de la Información y Comunicaciones

## Aplicación pública

La aplicación está disponible en:

**https://denisecl1.github.io/traductor-inteligente-multimodal/**

## Repositorio

**https://github.com/Denisecl1/traductor-inteligente-multimodal.git**

---

Proyecto académico desarrollado para la materia de **Inteligencia Artificial** · 2026.
