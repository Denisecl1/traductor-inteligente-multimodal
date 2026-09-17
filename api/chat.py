import json
import os

from http.server import BaseHTTPRequestHandler
from openai import OpenAI


# =========================================
# CONFIGURACIÓN
# =========================================

MAX_MESSAGE_LENGTH = 1000
MAX_REQUEST_BYTES = 16 * 1024

MODEL = os.getenv(
    "OPENAI_MODEL",
    "gpt-5.6-luna"
)


# =========================================
# VALIDACIÓN
# =========================================

class RequestValidator:

    @staticmethod
    def validate_message(message):

        if not isinstance(message, str):
            return False, "El mensaje debe ser texto."

        message = message.strip()

        if not message:
            return False, "Escribe un mensaje antes de enviarlo."

        if len(message) > MAX_MESSAGE_LENGTH:
            return (
                False,
                f"El mensaje no puede superar "
                f"{MAX_MESSAGE_LENGTH} caracteres."
            )

        return True, message


# =========================================
# SERVICIO DE TRADUCCIÓN
# =========================================

class TranslationService:

    def __init__(self):

        api_key = os.getenv("OPENAI_API_KEY")

        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY no está configurada."
            )

        self.client = OpenAI(
            api_key=api_key
        )


    def translate(self, message):

        instructions = """
Eres un traductor profesional bilingüe especializado
exclusivamente en español e inglés.

Tu tarea es:

1. Detectar si el mensaje está principalmente en español
   o en inglés.

2. Si está en español, traducirlo al inglés.

3. Si está en inglés, traducirlo al español.

4. Mantener el significado y producir una traducción
   natural y comprensible.

5. Conservar correctamente nombres propios, cifras,
   fechas, unidades, términos técnicos y siglas.

6. No inventar información que no aparezca en el
   mensaje original.

7. Si no puedes determinar razonablemente que el texto
   está en español o inglés, indícalo como unsupported.

Devuelve SOLAMENTE un objeto JSON válido con esta forma:

{
    "source_language": "es",
    "target_language": "en",
    "translation": "texto traducido",
    "warning": ""
}

source_language solamente puede ser:
"es", "en" o "unsupported".

target_language solamente puede ser:
"es", "en" o "".

No incluyas Markdown.
No incluyas bloques de código.
No incluyas explicaciones fuera del JSON.
"""

        response = self.client.responses.create(
            model=MODEL,
            instructions=instructions,
            input=message,
            reasoning={
                "effort": "none"
            },
            max_output_tokens=1200,
            store=False
        )

        output = response.output_text.strip()

        return self._parse_response(output)


    def _parse_response(self, output):

        # Protección adicional por si el modelo
        # devuelve accidentalmente ```json ... ```

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

            data = json.loads(output)

        except json.JSONDecodeError:

            raise ValueError(
                "La respuesta de la IA "
                "no tiene el formato esperado."
            )


        source_language = data.get(
            "source_language"
        )

        target_language = data.get(
            "target_language"
        )

        translation = data.get(
            "translation",
            ""
        )

        warning = data.get(
            "warning",
            ""
        )


        if source_language not in [
            "es",
            "en",
            "unsupported"
        ]:

            raise ValueError(
                "Idioma detectado no válido."
            )


        if source_language == "unsupported":

            return {
                "supported": False,
                "warning":
                    warning
                    or
                    "Solo se admiten mensajes "
                    "en español o inglés."
            }


        expected_target = (
            "en"
            if source_language == "es"
            else "es"
        )


        if target_language != expected_target:

            raise ValueError(
                "El idioma destino recibido "
                "no es válido."
            )


        if not isinstance(
            translation,
            str
        ) or not translation.strip():

            raise ValueError(
                "La traducción recibida está vacía."
            )


        return {
            "supported": True,
            "source_language": source_language,
            "target_language": target_language,
            "translation": translation.strip()
        }


# =========================================
# ENDPOINT DE VERCEL
# =========================================

class handler(BaseHTTPRequestHandler):

    # -------------------------------------
    # ORIGEN PERMITIDO
    # -------------------------------------

    def _origin_allowed(self):

        allowed_origin = os.getenv(
            "ALLOWED_ORIGIN",
            ""
        ).rstrip("/")

        request_origin = self.headers.get(
            "Origin",
            ""
        ).rstrip("/")

        if not allowed_origin:
            return False

        return request_origin == allowed_origin


    # -------------------------------------
    # HEADERS CORS
    # -------------------------------------

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


    # -------------------------------------
    # RESPUESTA JSON
    # -------------------------------------

    def _send_json(
        self,
        status_code,
        data
    ):

        body = json.dumps(
            data,
            ensure_ascii=False
        ).encode("utf-8")


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
            str(len(body))
        )

        self.end_headers()

        self.wfile.write(body)


    # -------------------------------------
    # PREFLIGHT CORS
    # -------------------------------------

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


        self.send_response(204)

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


    # -------------------------------------
    # POST /api/chat
    # -------------------------------------

    def do_POST(self):

        # Verificar origen

        if not self._origin_allowed():

            self._send_json(
                403,
                {
                    "error":
                        "Origen no autorizado."
                }
            )

            return


        # Verificar Content-Type

        content_type = (
            self.headers
            .get("Content-Type", "")
            .split(";")[0]
            .strip()
            .lower()
        )


        if content_type != "application/json":

            self._send_json(
                415,
                {
                    "error":
                        "El contenido debe enviarse "
                        "como application/json."
                }
            )

            return


        # Verificar tamaño de solicitud

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


        if content_length > MAX_REQUEST_BYTES:

            self._send_json(
                413,
                {
                    "error":
                        "La solicitud supera "
                        "el tamaño permitido."
                }
            )

            return


        # Leer JSON

        try:

            raw_body = self.rfile.read(
                content_length
            )

            body = json.loads(
                raw_body.decode("utf-8")
            )

        except (
            json.JSONDecodeError,
            UnicodeDecodeError
        ):

            self._send_json(
                400,
                {
                    "error":
                        "El contenido JSON "
                        "no es válido."
                }
            )

            return


        # Validar mensaje

        is_valid, result = (
            RequestValidator
            .validate_message(
                body.get("message")
            )
        )


        if not is_valid:

            self._send_json(
                400,
                {
                    "error": result
                }
            )

            return


        message = result


        # Traducir con OpenAI

        try:

            translator = (
                TranslationService()
            )

            translation = (
                translator.translate(
                    message
                )
            )


            if not translation[
                "supported"
            ]:

                self._send_json(
                    422,
                    {
                        "error":
                            translation[
                                "warning"
                            ]
                    }
                )

                return


            self._send_json(
                200,
                {
                    "original":
                        message,

                    "translation":
                        translation[
                            "translation"
                        ],

                    "source_language":
                        translation[
                            "source_language"
                        ],

                    "target_language":
                        translation[
                            "target_language"
                        ]
                }
            )


        except ValueError:

            self._send_json(
                502,
                {
                    "error":
                        "La respuesta del servicio "
                        "de Inteligencia Artificial "
                        "no pudo procesarse."
                }
            )


        except Exception as error:

            # El detalle queda únicamente
            # en los logs del servidor.
            # Nunca se envía al navegador.

            print(
                "Error interno en chat:",
                type(error).__name__
            )

            self._send_json(
                500,
                {
                    "error":
                        "No fue posible realizar "
                        "la traducción en este momento."
                }
            )


    # -------------------------------------
    # OTROS MÉTODOS
    # -------------------------------------

    def do_GET(self):

        self._send_json(
            405,
            {
                "error":
                    "Método no permitido."
            }
        )