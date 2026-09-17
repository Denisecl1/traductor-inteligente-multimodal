import json
import os
import re

from http.server import BaseHTTPRequestHandler
from openai import OpenAI


# =========================================
# CONFIGURACIÓN
# =========================================

MODEL = os.getenv(
    "OPENAI_MODEL",
    "gpt-5.6-luna"
)

# El frontend limita la imagen original a 3 MB.
# Al convertirse a Base64 aumenta de tamaño,
# por eso el cuerpo JSON puede acercarse a 4 MB.
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

        # Comprobar que exista y sea texto
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


        # Validar formato Data URL:
        # data:image/png;base64,...
        # data:image/jpeg;base64,...
        # data:image/webp;base64,...

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
            match.group(1)
            .lower()
        )


        if mime_type not in ALLOWED_IMAGE_TYPES:

            return (
                False,
                "El formato de imagen no está permitido."
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


    def translate_image(
        self,
        image_data
    ):

        instructions = """
Eres un traductor profesional especializado
exclusivamente en español e inglés.

Debes analizar cuidadosamente la imagen proporcionada.

Tu tarea es:

1. Identificar únicamente el texto realmente visible
   y legible en la imagen.

2. Detectar si ese texto está principalmente en
   español o en inglés.

3. Si el texto está en español, traducirlo al inglés.

4. Si el texto está en inglés, traducirlo al español.

5. Mantener correctamente nombres propios, cifras,
   fechas, precios, unidades, siglas y términos
   técnicos según el contexto.

6. Producir una traducción natural y comprensible.

7. No inventar palabras ni contenido que no esté
   visible en la imagen.

8. Si la imagen no contiene texto legible,
   devuelve status "no_text".

9. Si parece existir texto pero la calidad de la
   imagen impide interpretarlo de forma confiable,
   devuelve status "unreadable".

10. Si el texto visible no está principalmente en
    español ni en inglés, devuelve status
    "unsupported".

Devuelve SOLAMENTE un objeto JSON válido.

Cuando todo funcione correctamente:

{
    "status": "success",
    "source_language": "es",
    "target_language": "en",
    "detected_text": "texto encontrado",
    "translation": "texto traducido",
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

target_language solamente puede ser:

"es"
"en"
""

No utilices Markdown.
No utilices bloques de código.
No escribas explicaciones fuera del objeto JSON.
"""


        response = (
            self.client.responses.create(

                model=MODEL,

                instructions=instructions,

                input=[
                    {
                        "role": "user",

                        "content": [

                            {
                                "type":
                                    "input_text",

                                "text":
                                    "Analiza el texto visible de esta imagen y tradúcelo al idioma contrario."
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

                max_output_tokens=1800,

                store=False
            )
        )


        output = (
            response.output_text
            .strip()
        )


        return (
            self._parse_response(
                output
            )
        )


    # =====================================
    # INTERPRETAR RESPUESTA DE OPENAI
    # =====================================

    def _parse_response(
        self,
        output
    ):

        # Protección adicional por si el modelo
        # llegara a devolver ```json ... ```

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
                "La respuesta de la IA "
                "no tiene el formato esperado."
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
                "El estado recibido "
                "no es válido."
            )


        # =================================
        # CASOS SIN TRADUCCIÓN
        # =================================

        if status != "success":

            return {
                "status":
                    status,

                "message":
                    data.get(
                        "message",
                        ""
                    )
            }


        # =================================
        # CASO EXITOSO
        # =================================

        source_language = data.get(
            "source_language"
        )


        target_language = data.get(
            "target_language"
        )


        detected_text = data.get(
            "detected_text",
            ""
        )


        translation = data.get(
            "translation",
            ""
        )


        # Validar idioma de origen

        if source_language not in [
            "es",
            "en"
        ]:

            raise ValueError(
                "Idioma de origen inválido."
            )


        # Determinar cuál debería ser
        # el idioma contrario

        expected_target = (
            "en"
            if source_language == "es"
            else "es"
        )


        if (
            target_language !=
            expected_target
        ):

            raise ValueError(
                "Idioma de destino inválido."
            )


        # Validar texto detectado

        if (
            not isinstance(
                detected_text,
                str
            )
            or
            not detected_text.strip()
        ):

            raise ValueError(
                "No se recibió texto detectado."
            )


        # Validar traducción

        if (
            not isinstance(
                translation,
                str
            )
            or
            not translation.strip()
        ):

            raise ValueError(
                "No se recibió traducción."
            )


        return {

            "status":
                "success",

            "source_language":
                source_language,

            "target_language":
                target_language,

            "detected_text":
                detected_text.strip(),

            "translation":
                translation.strip()
        }


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
    # HEADERS CORS
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
    # ENVIAR RESPUESTA JSON
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
                        "El contenido debe enviarse como application/json."
                }
            )

            return


        # ---------------------------------
        # VALIDAR TAMAÑO DE PETICIÓN
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
                        "La imagen supera el tamaño permitido."
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
                        "El contenido JSON no es válido."
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
        # ENVIAR A OPENAI
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
            # SIN TEXTO
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
                            "No se encontró texto legible en la imagen."
                    }
                )

                return


            # -----------------------------
            # IMAGEN ILEGIBLE
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
                            "La calidad de la imagen no permite obtener un resultado confiable."
                    }
                )

                return


            # -----------------------------
            # OTRO IDIOMA
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
                            "El texto visible debe estar principalmente en español o inglés."
                    }
                )

                return


            # -----------------------------
            # ÉXITO
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

        except ValueError:

            self._send_json(
                502,
                {
                    "error":
                        "La respuesta del servicio de Inteligencia Artificial no pudo procesarse."
                }
            )


        # ---------------------------------
        # ERROR INTERNO
        # ---------------------------------

        except Exception as error:

            # Solo mostramos el tipo
            # de error en logs.
            # No enviamos detalles sensibles
            # al navegador.

            print(
                "Error interno en imágenes:",
                type(error).__name__
            )


            self._send_json(
                500,
                {
                    "error":
                        "No fue posible analizar la imagen en este momento."
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