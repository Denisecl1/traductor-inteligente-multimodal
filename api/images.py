import base64
import json
import os
import re

from http.server import BaseHTTPRequestHandler
from openai import OpenAI


# =========================================
# CONFIGURACIÓN
# =========================================

VISION_MODEL = os.getenv(
    "OPENAI_VISION_MODEL",
    "gpt-5.6-sol"
)

TRANSLATION_MODEL = os.getenv(
    "OPENAI_TRANSLATION_MODEL",
    "gpt-5.6-luna"
)


# El frontend admite imágenes originales
# de máximo 3 MB.
MAX_IMAGE_BYTES = 3 * 1024 * 1024

# La imagen enviada como Base64 ocupa más
# espacio que el archivo original.
MAX_REQUEST_BYTES = 4_400_000


ALLOWED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp"
}


# =========================================
# VALIDACIÓN DE IMÁGENES
# =========================================

class ImageValidator:

    @staticmethod
    def validate_image_data(image_data):

        # ---------------------------------
        # VALIDAR EXISTENCIA
        # ---------------------------------

        if not isinstance(image_data, str):

            return (
                False,
                "La imagen recibida no es válida."
            )


        if not image_data.strip():

            return (
                False,
                "No se recibió ninguna imagen."
            )


        # ---------------------------------
        # VALIDAR DATA URL
        # ---------------------------------

        pattern = (
            r"^data:"
            r"(image\/(?:png|jpeg|webp));"
            r"base64,"
        )


        match = re.match(
            pattern,
            image_data,
            re.IGNORECASE
        )


        if not match:

            return (
                False,
                "El formato de imagen no está permitido."
            )


        mime_type = (
            match
            .group(1)
            .lower()
        )


        if mime_type not in ALLOWED_IMAGE_TYPES:

            return (
                False,
                "El formato de imagen no está permitido."
            )


        # ---------------------------------
        # EXTRAER BASE64
        # ---------------------------------

        try:

            base64_content = (
                image_data
                .split(",", 1)[1]
            )


            decoded_image = (
                base64.b64decode(
                    base64_content,
                    validate=True
                )
            )

        except (
            IndexError,
            ValueError,
            base64.binascii.Error
        ):

            return (
                False,
                "El contenido de la imagen no es válido."
            )


        # ---------------------------------
        # VALIDAR ARCHIVO VACÍO
        # ---------------------------------

        if len(decoded_image) == 0:

            return (
                False,
                "La imagen seleccionada está vacía."
            )


        # ---------------------------------
        # VALIDAR TAMAÑO REAL
        # ---------------------------------

        if (
            len(decoded_image) >
            MAX_IMAGE_BYTES
        ):

            return (
                False,
                "La imagen supera el límite de 3 MB."
            )


        return (
            True,
            image_data
        )


# =========================================
# SERVICIO DE TRADUCCIÓN DE IMÁGENES
# =========================================

class ImageTranslationService:

    def __init__(self):

        api_key = os.getenv(
            "OPENAI_API_KEY"
        )


        if not api_key:

            raise RuntimeError(
                "OPENAI_API_KEY no está configurada."
            )


        self.client = OpenAI(
            api_key=api_key
        )


    # =====================================
    # PROCESO PRINCIPAL
    # =====================================

    def translate_image(
        self,
        image_data
    ):

        # ---------------------------------
        # PASO 1
        # TRANSCRIBIR LA IMAGEN
        # ---------------------------------

        transcription = (
            self._transcribe_image(
                image_data
            )
        )


        # Si la imagen no pudo leerse,
        # se detiene el proceso.

        if (
            transcription["status"]
            != "success"
        ):

            return transcription


        detected_text = (
            transcription[
                "detected_text"
            ]
        )


        source_language = (
            transcription[
                "source_language"
            ]
        )


        # ---------------------------------
        # PASO 2
        # TRADUCIR EL TEXTO TRANSCRITO
        # ---------------------------------

        translation = (
            self._translate_text(
                detected_text,
                source_language
            )
        )


        target_language = (
            "en"
            if source_language == "es"
            else "es"
        )


        return {

            "status":
                "success",

            "source_language":
                source_language,

            "target_language":
                target_language,

            "detected_text":
                detected_text,

            "translation":
                translation
        }


    # =====================================
    # PASO 1
    # TRANSCRIPCIÓN VISUAL
    # =====================================

    def _transcribe_image(
        self,
        image_data
    ):

        instructions = """
Eres un sistema especializado en lectura visual
de texto contenido en imágenes.

En esta etapa NO debes traducir.

Tu única tarea es TRANSCRIBIR con la mayor fidelidad
posible el texto realmente visible en la imagen.

REGLAS IMPORTANTES:

1. Lee cuidadosamente el texto carácter por carácter.

2. detected_text debe contener el texto tal como
   aparece visualmente en la imagen.

3. Conserva:
   - nombres
   - apodos
   - palabras informales
   - mayúsculas y minúsculas
   - números
   - signos de puntuación
   - repeticiones expresivas de letras
   - posibles errores ortográficos del texto original

4. NO corrijas automáticamente las palabras.

5. NO reemplaces una palabra por otra solamente
   porque parezca más lógica.

6. NO traduzcas el texto todavía.

7. Revisa nuevamente cada palabra antes de responder.

8. Si una palabra importante no puede distinguirse
   con suficiente confianza, NO la adivines.
   Devuelve status "unreadable".

9. Si la imagen no contiene texto legible,
   devuelve status "no_text".

10. Determina si el texto está principalmente
    en español o en inglés.

11. Si no está principalmente en español ni inglés,
    devuelve status "unsupported".

Devuelve SOLAMENTE un objeto JSON válido.

Si la lectura es correcta:

{
    "status": "success",
    "source_language": "es",
    "detected_text": "texto exactamente identificado",
    "message": ""
}

Los únicos valores permitidos para status son:

"success"
"no_text"
"unreadable"
"unsupported"

source_language solamente puede ser:

"es"
"en"
""

Para no_text, unreadable o unsupported,
detected_text puede ser una cadena vacía.

No utilices Markdown.
No utilices bloques de código.
No escribas explicaciones fuera del JSON.
"""


        response = (
            self.client.responses.create(

                model=
                    VISION_MODEL,

                instructions=
                    instructions,

                input=[
                    {
                        "role":
                            "user",

                        "content": [

                            {
                                "type":
                                    "input_text",

                                "text":
                                    (
                                        "Transcribe exactamente todo "
                                        "el texto visible de esta imagen. "
                                        "No traduzcas, no corrijas y no "
                                        "adivines palabras dudosas."
                                    )
                            },

                            {
                                "type":
                                    "input_image",

                                "image_url":
                                    image_data,

                                "detail":
                                    "high"
                            }

                        ]
                    }
                ],

                reasoning={
                    "effort":
                        "low"
                },

                max_output_tokens=
                    1200,

                store=False
            )
        )


        output = (
            response
            .output_text
            .strip()
        )


        return (
            self._parse_transcription(
                output
            )
        )


    # =====================================
    # INTERPRETAR TRANSCRIPCIÓN
    # =====================================

    def _parse_transcription(
        self,
        output
    ):

        # Protección por si el modelo
        # devuelve ```json ... ```

        if output.startswith("```"):

            output = output.replace(
                "```json",
                "",
                1
            )


            output = output.replace(
                "```",
                ""
            )


            output = output.strip()


        try:

            data = json.loads(
                output
            )

        except json.JSONDecodeError:

            raise ValueError(
                "La respuesta visual no tiene "
                "el formato esperado."
            )


        status = data.get(
            "status"
        )


        allowed_status = [
            "success",
            "no_text",
            "unreadable",
            "unsupported"
        ]


        if status not in allowed_status:

            raise ValueError(
                "El estado visual recibido "
                "no es válido."
            )


        # ---------------------------------
        # SIN TEXTO
        # ---------------------------------

        if status == "no_text":

            return {

                "status":
                    "no_text",

                "message":
                    data.get(
                        "message"
                    )
                    or
                    "No se encontró texto legible en la imagen."
            }


        # ---------------------------------
        # TEXTO POCO CONFIABLE
        # ---------------------------------

        if status == "unreadable":

            return {

                "status":
                    "unreadable",

                "message":
                    data.get(
                        "message"
                    )
                    or
                    (
                        "La calidad de la imagen no permite "
                        "identificar el texto con suficiente "
                        "confianza."
                    )
            }


        # ---------------------------------
        # IDIOMA NO ADMITIDO
        # ---------------------------------

        if status == "unsupported":

            return {

                "status":
                    "unsupported",

                "message":
                    data.get(
                        "message"
                    )
                    or
                    (
                        "El texto visible debe estar "
                        "principalmente en español o inglés."
                    )
            }


        # ---------------------------------
        # TRANSCRIPCIÓN CORRECTA
        # ---------------------------------

        detected_text = (
            data.get(
                "detected_text",
                ""
            )
        )


        source_language = (
            data.get(
                "source_language",
                ""
            )
        )


        if (
            not isinstance(
                detected_text,
                str
            )
            or
            not detected_text.strip()
        ):

            raise ValueError(
                "La transcripción recibida está vacía."
            )


        if source_language not in [
            "es",
            "en"
        ]:

            raise ValueError(
                "El idioma detectado no es válido."
            )


        return {

            "status":
                "success",

            "source_language":
                source_language,

            "detected_text":
                detected_text.strip()
        }


    # =====================================
    # PASO 2
    # TRADUCCIÓN DEL TEXTO
    # =====================================

    def _translate_text(
        self,
        text,
        source_language
    ):

        if source_language == "es":

            target_language_name = (
                "inglés"
            )

        else:

            target_language_name = (
                "español"
            )


        instructions = f"""
Eres un traductor profesional bilingüe
especializado en español e inglés.

El texto recibido ya fue transcrito desde una imagen.

Debes traducirlo al {target_language_name}.

REGLAS:

1. Traduce únicamente el texto recibido.

2. Mantén el significado original.

3. Produce una traducción natural y comprensible.

4. Conserva nombres propios, apodos, cifras,
   fechas, precios, unidades, siglas y términos
   técnicos cuando corresponda.

5. NO modifiques ni corrijas primero el texto
   de origen.

6. Si existen repeticiones expresivas de letras,
   intenta mantener razonablemente esa intención
   en la traducción.

7. No inventes información.

Devuelve SOLAMENTE la traducción.

No utilices Markdown.
No agregues explicaciones.
"""


        response = (
            self.client.responses.create(

                model=
                    TRANSLATION_MODEL,

                instructions=
                    instructions,

                input=
                    text,

                reasoning={
                    "effort":
                        "none"
                },

                max_output_tokens=
                    1200,

                store=False
            )
        )


        translation = (
            response
            .output_text
            .strip()
        )


        if not translation:

            raise ValueError(
                "La traducción recibida está vacía."
            )


        return translation


# =========================================
# ENDPOINT DE VERCEL
# =========================================

class handler(
    BaseHTTPRequestHandler
):

    # =====================================
    # VALIDAR ORIGEN
    # =====================================

    def _origin_allowed(self):

        allowed_origin = os.getenv(
            "ALLOWED_ORIGIN",
            ""
        ).rstrip("/")


        request_origin = (
            self.headers
            .get(
                "Origin",
                ""
            )
            .rstrip("/")
        )


        if not allowed_origin:

            return False


        return (
            request_origin ==
            allowed_origin
        )


    # =====================================
    # AGREGAR HEADERS CORS
    # =====================================

    def _add_cors_headers(self):

        origin = self.headers.get(
            "Origin",
            ""
        )


        if self._origin_allowed():

            self.send_header(
                "Access-Control-Allow-Origin",
                origin
            )


            self.send_header(
                "Vary",
                "Origin"
            )


    # =====================================
    # RESPUESTA JSON
    # =====================================

    def _send_json(
        self,
        status_code,
        data
    ):

        body = json.dumps(
            data,
            ensure_ascii=False
        ).encode(
            "utf-8"
        )


        self.send_response(
            status_code
        )


        self._add_cors_headers()


        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )


        self.send_header(
            "Content-Length",
            str(
                len(body)
            )
        )


        self.end_headers()


        self.wfile.write(
            body
        )


    # =====================================
    # PREFLIGHT CORS
    # =====================================

    def do_OPTIONS(self):

        if not self._origin_allowed():

            self._send_json(
                403,
                {
                    "error":
                        "Origen no autorizado."
                }
            )

            return


        self.send_response(
            204
        )


        self._add_cors_headers()


        self.send_header(
            "Access-Control-Allow-Methods",
            "POST, OPTIONS"
        )


        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )


        self.send_header(
            "Access-Control-Max-Age",
            "86400"
        )


        self.end_headers()


    # =====================================
    # POST /api/images
    # =====================================

    def do_POST(self):

        # ---------------------------------
        # VALIDAR ORIGEN
        # ---------------------------------

        if not self._origin_allowed():

            self._send_json(
                403,
                {
                    "error":
                        "Origen no autorizado."
                }
            )

            return


        # ---------------------------------
        # VALIDAR CONTENT-TYPE
        # ---------------------------------

        content_type = (
            self.headers
            .get(
                "Content-Type",
                ""
            )
            .split(";")[0]
            .strip()
            .lower()
        )


        if (
            content_type !=
            "application/json"
        ):

            self._send_json(
                415,
                {
                    "error":
                        (
                            "El contenido debe enviarse "
                            "como application/json."
                        )
                }
            )

            return


        # ---------------------------------
        # OBTENER TAMAÑO DE PETICIÓN
        # ---------------------------------

        try:

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    "0"
                )
            )

        except ValueError:

            self._send_json(
                400,
                {
                    "error":
                        "Solicitud inválida."
                }
            )

            return


        if content_length <= 0:

            self._send_json(
                400,
                {
                    "error":
                        "La solicitud está vacía."
                }
            )

            return


        if (
            content_length >
            MAX_REQUEST_BYTES
        ):

            self._send_json(
                413,
                {
                    "error":
                        (
                            "La imagen supera "
                            "el tamaño permitido."
                        )
                }
            )

            return


        # ---------------------------------
        # LEER JSON
        # ---------------------------------

        try:

            raw_body = (
                self.rfile.read(
                    content_length
                )
            )


            body = json.loads(
                raw_body.decode(
                    "utf-8"
                )
            )

        except (
            json.JSONDecodeError,
            UnicodeDecodeError
        ):

            self._send_json(
                400,
                {
                    "error":
                        (
                            "El contenido JSON "
                            "no es válido."
                        )
                }
            )

            return


        # ---------------------------------
        # VALIDAR IMAGEN
        # ---------------------------------

        is_valid, result = (
            ImageValidator
            .validate_image_data(
                body.get(
                    "image_data"
                )
            )
        )


        if not is_valid:

            self._send_json(
                400,
                {
                    "error":
                        result
                }
            )

            return


        image_data = result


        # ---------------------------------
        # PROCESAR CON OPENAI
        # ---------------------------------

        try:

            translator = (
                ImageTranslationService()
            )


            result = (
                translator
                .translate_image(
                    image_data
                )
            )


            # -----------------------------
            # NO HAY TEXTO
            # -----------------------------

            if (
                result["status"] ==
                "no_text"
            ):

                self._send_json(
                    422,
                    {
                        "error":
                            result.get(
                                "message"
                            )
                            or
                            (
                                "No se encontró texto "
                                "legible en la imagen."
                            )
                    }
                )

                return


            # -----------------------------
            # TEXTO ILEGIBLE
            # -----------------------------

            if (
                result["status"] ==
                "unreadable"
            ):

                self._send_json(
                    422,
                    {
                        "error":
                            result.get(
                                "message"
                            )
                            or
                            (
                                "La calidad de la imagen "
                                "no permite obtener un "
                                "resultado confiable."
                            )
                    }
                )

                return


            # -----------------------------
            # IDIOMA NO ADMITIDO
            # -----------------------------

            if (
                result["status"] ==
                "unsupported"
            ):

                self._send_json(
                    422,
                    {
                        "error":
                            result.get(
                                "message"
                            )
                            or
                            (
                                "El texto visible debe "
                                "estar principalmente en "
                                "español o inglés."
                            )
                    }
                )

                return


            # -----------------------------
            # RESPUESTA CORRECTA
            # -----------------------------

            self._send_json(
                200,
                {
                    "detected_text":
                        result[
                            "detected_text"
                        ],

                    "translation":
                        result[
                            "translation"
                        ],

                    "source_language":
                        result[
                            "source_language"
                        ],

                    "target_language":
                        result[
                            "target_language"
                        ]
                }
            )


        # ---------------------------------
        # RESPUESTA IA INESPERADA
        # ---------------------------------

        except ValueError as error:

            print(
                "Error de respuesta IA:",
                type(error).__name__
            )


            self._send_json(
                502,
                {
                    "error":
                        (
                            "La respuesta del servicio "
                            "de Inteligencia Artificial "
                            "no pudo procesarse."
                        )
                }
            )


        # ---------------------------------
        # ERROR INTERNO
        # ---------------------------------

        except Exception as error:

            # No enviamos trazas ni
            # información sensible al navegador.

            print(
                "Error interno en imágenes:",
                type(error).__name__
            )


            self._send_json(
                500,
                {
                    "error":
                        (
                            "No fue posible analizar "
                            "la imagen en este momento."
                        )
                }
            )


    # =====================================
    # GET NO PERMITIDO
    # =====================================

    def do_GET(self):

        self._send_json(
            405,
            {
                "error":
                    "Método no permitido."
            }
        )