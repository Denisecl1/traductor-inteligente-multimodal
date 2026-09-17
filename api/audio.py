import json
import os

from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler

from openai import OpenAI


# =========================================
# CONFIGURACIÓN
# =========================================

TRANSCRIPTION_MODEL = os.getenv(
    "OPENAI_TRANSCRIPTION_MODEL",
    "gpt-4o-mini-transcribe"
)

TRANSLATION_MODEL = os.getenv(
    "OPENAI_TRANSLATION_MODEL",
    "gpt-5.6-luna"
)

TTS_MODEL = os.getenv(
    "OPENAI_TTS_MODEL",
    "gpt-4o-mini-tts"
)

TTS_VOICE = os.getenv(
    "OPENAI_TTS_VOICE",
    "coral"
)


# Vercel permite un cuerpo de solicitud
# de máximo 4.5 MB.
MAX_REQUEST_BYTES = 4_400_000

# Límite del archivo de audio original.
MAX_AUDIO_BYTES = 4 * 1024 * 1024

# Límite preventivo para texto enviado a TTS.
MAX_TTS_CHARACTERS = 4000


ALLOWED_EXTENSIONS = {
    "mp3",
    "wav",
    "m4a",
    "webm"
}


ALLOWED_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",

    "audio/wav",
    "audio/x-wav",

    "audio/mp4",
    "audio/x-m4a",

    "audio/webm",

    # Algunos navegadores pueden utilizarlo
    # aunque la extensión sea correcta.
    "application/octet-stream"
}


# =========================================
# EXCEPCIONES PERSONALIZADAS
# =========================================

class AudioContentError(Exception):
    """
    Error utilizado cuando el audio existe
    pero no contiene voz utilizable.
    """

    pass


# =========================================
# VALIDACIÓN DE AUDIO
# =========================================

class AudioValidator:

    @staticmethod
    def get_extension(filename):

        if not isinstance(filename, str):

            return ""


        parts = (
            filename
            .lower()
            .rsplit(".", 1)
        )


        if len(parts) != 2:

            return ""


        return parts[1]


    @staticmethod
    def validate(
        filename,
        mime_type,
        audio_bytes
    ):

        # ---------------------------------
        # VALIDAR NOMBRE
        # ---------------------------------

        if not filename:

            return (
                False,
                "El archivo de audio no tiene un nombre válido."
            )


        extension = (
            AudioValidator
            .get_extension(
                filename
            )
        )


        # ---------------------------------
        # VALIDAR EXTENSIÓN
        # ---------------------------------

        if (
            extension not in
            ALLOWED_EXTENSIONS
        ):

            return (
                False,
                "El formato de audio no está permitido."
            )


        # ---------------------------------
        # VALIDAR MIME TYPE
        # ---------------------------------

        if (
            mime_type and
            mime_type not in
            ALLOWED_MIME_TYPES
        ):

            return (
                False,
                "El tipo de contenido del audio no está permitido."
            )


        # ---------------------------------
        # VALIDAR CONTENIDO
        # ---------------------------------

        if (
            not isinstance(
                audio_bytes,
                bytes
            )
        ):

            return (
                False,
                "El archivo de audio recibido no es válido."
            )


        if (
            len(audio_bytes) == 0
        ):

            return (
                False,
                "El archivo de audio está vacío."
            )


        # ---------------------------------
        # VALIDAR TAMAÑO
        # ---------------------------------

        if (
            len(audio_bytes) >
            MAX_AUDIO_BYTES
        ):

            return (
                False,
                "El archivo de audio supera el límite de 4 MB."
            )


        return (
            True,
            "Audio válido."
        )


# =========================================
# PARSER MULTIPART
# =========================================

class MultipartAudioParser:

    @staticmethod
    def parse(
        content_type,
        raw_body
    ):

        """
        Extrae el archivo enviado mediante:

        FormData()
        formData.append("audio", file)
        """


        # Construimos un mensaje MIME válido
        # para utilizar el parser estándar
        # de Python.

        mime_message = (

            (
                f"Content-Type: {content_type}\r\n"
                f"MIME-Version: 1.0\r\n"
                f"\r\n"
            )
            .encode("utf-8")

            +

            raw_body
        )


        try:

            message = (
                BytesParser(
                    policy=default
                )
                .parsebytes(
                    mime_message
                )
            )

        except Exception:

            raise ValueError(
                "No fue posible interpretar "
                "el archivo enviado."
            )


        if not message.is_multipart():

            raise ValueError(
                "La solicitud multipart no es válida."
            )


        # ---------------------------------
        # BUSCAR CAMPO "audio"
        # ---------------------------------

        for part in message.iter_parts():

            disposition = (
                part
                .get_content_disposition()
            )


            if disposition != "form-data":

                continue


            field_name = (
                part.get_param(
                    "name",
                    header="content-disposition"
                )
            )


            if field_name != "audio":

                continue


            filename = (
                part.get_filename()
                or
                "audio"
            )


            mime_type = (
                part.get_content_type()
            )


            audio_bytes = (
                part.get_payload(
                    decode=True
                )
                or
                b""
            )


            return (
                filename,
                mime_type,
                audio_bytes
            )


        raise ValueError(
            "No se encontró el archivo de audio."
        )


# =========================================
# SERVICIO DE AUDIO
# =========================================

class AudioTranslationService:

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

    def process_audio(
        self,
        filename,
        mime_type,
        audio_bytes
    ):

        # ---------------------------------
        # PASO 1
        # TRANSCRIBIR AUDIO
        # ---------------------------------

        transcription = (
            self.transcribe(
                filename,
                mime_type,
                audio_bytes
            )
        )


        # ---------------------------------
        # PASO 2
        # DETECTAR IDIOMA + TRADUCIR
        # ---------------------------------

        translation = (
            self.translate(
                transcription
            )
        )


        return {

            "transcription":
                transcription,

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


    # =====================================
    # TRANSCRIPCIÓN
    # =====================================

    def transcribe(
        self,
        filename,
        mime_type,
        audio_bytes
    ):

        try:

            response = (
                self.client
                .audio
                .transcriptions
                .create(

                    model=
                        TRANSCRIPTION_MODEL,

                    file=(
                        filename,
                        audio_bytes,
                        mime_type
                    ),

                    response_format=
                        "json"
                )
            )

        except Exception:

            raise


        transcription = (
            getattr(
                response,
                "text",
                ""
            )
            or
            ""
        )


        transcription = (
            transcription
            .strip()
        )


        # ---------------------------------
        # AUDIO SIN CONTENIDO ÚTIL
        # ---------------------------------

        if not transcription:

            raise AudioContentError(
                "No se detectó contenido hablado utilizable en el audio."
            )


        return transcription


    # =====================================
    # DETECTAR IDIOMA Y TRADUCIR
    # =====================================

    def translate(
        self,
        transcription
    ):

        instructions = """
Eres un traductor profesional especializado
exclusivamente en español e inglés.

Recibirás la transcripción de un archivo de audio.

Tu tarea es:

1. Detectar si la transcripción está
   principalmente en español o inglés.

2. Si está en español, traducirla al inglés.

3. Si está en inglés, traducirla al español.

4. Mantener el significado original.

5. Producir una traducción natural y comprensible.

6. Conservar correctamente:
   - nombres propios
   - cifras
   - fechas
   - cantidades
   - unidades
   - términos técnicos
   - siglas

7. No inventar contenido que no aparezca
   en la transcripción.

8. Si el texto no está principalmente en español
   ni en inglés, utiliza "unsupported".

Devuelve SOLAMENTE JSON válido:

{
    "source_language": "es",
    "target_language": "en",
    "translation": "texto traducido",
    "warning": ""
}

source_language solamente puede ser:

"es"
"en"
"unsupported"

target_language solamente puede ser:

"es"
"en"
""

No utilices Markdown.
No utilices bloques de código.
No agregues explicaciones fuera del JSON.
"""


        response = (
            self.client
            .responses
            .create(

                model=
                    TRANSLATION_MODEL,

                instructions=
                    instructions,

                input=
                    transcription,

                max_output_tokens=
                    1500,

                store=False
            )
        )


        output = (
            response
            .output_text
            .strip()
        )


        # ---------------------------------
        # LIMPIAR POSIBLE BLOQUE MARKDOWN
        # ---------------------------------

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


        # ---------------------------------
        # CONVERTIR JSON
        # ---------------------------------

        try:

            data = json.loads(
                output
            )

        except json.JSONDecodeError:

            raise ValueError(
                "La respuesta de traducción "
                "no tiene el formato esperado."
            )


        source_language = (
            data.get(
                "source_language"
            )
        )


        target_language = (
            data.get(
                "target_language"
            )
        )


        translated_text = (
            data.get(
                "translation",
                ""
            )
        )


        warning = (
            data.get(
                "warning",
                ""
            )
        )


        # ---------------------------------
        # VALIDAR IDIOMA
        # ---------------------------------

        if source_language not in [
            "es",
            "en",
            "unsupported"
        ]:

            raise ValueError(
                "El idioma detectado no es válido."
            )


        # ---------------------------------
        # IDIOMA NO COMPATIBLE
        # ---------------------------------

        if (
            source_language ==
            "unsupported"
        ):

            return {

                "supported":
                    False,

                "warning":
                    warning
                    or
                    (
                        "El audio debe contener "
                        "principalmente español o inglés."
                    )
            }


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
                "El idioma destino recibido "
                "no es válido."
            )


        if (
            not isinstance(
                translated_text,
                str
            )
            or
            not translated_text.strip()
        ):

            raise ValueError(
                "La traducción recibida está vacía."
            )


        return {

            "supported":
                True,

            "source_language":
                source_language,

            "target_language":
                target_language,

            "translation":
                translated_text.strip()
        }


    # =====================================
    # GENERAR VOZ TRADUCIDA
    # =====================================

    def synthesize(
        self,
        text,
        target_language
    ):

        if target_language == "es":

            language_name = (
                "Spanish"
            )

        elif target_language == "en":

            language_name = (
                "English"
            )

        else:

            raise ValueError(
                "El idioma de voz no es válido."
            )


        if (
            not isinstance(
                text,
                str
            )
            or
            not text.strip()
        ):

            raise ValueError(
                "El texto para generar voz está vacío."
            )


        text = (
            text
            .strip()
        )


        if (
            len(text) >
            MAX_TTS_CHARACTERS
        ):

            raise ValueError(
                "El texto es demasiado largo "
                "para generar audio."
            )


        instructions = (
            f"Speak clearly and naturally in {language_name}. "
            f"Use a neutral, professional and easy-to-understand tone."
        )


        # Utilizamos streaming para no escribir
        # archivos temporales en Vercel.

        with (
            self.client
                .audio
                .speech
                .with_streaming_response
                .create(

                    model=
                        TTS_MODEL,

                    voice=
                        TTS_VOICE,

                    input=
                        text,

                    instructions=
                        instructions,

                    response_format=
                        "mp3"

                )
        ) as response:

            audio_bytes = (
                response.read()
            )


        if not audio_bytes:

            raise ValueError(
                "No fue posible generar "
                "el audio traducido."
            )


        return audio_bytes


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

        origin = (
            self.headers
            .get(
                "Origin",
                ""
            )
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
    # RESPUESTA DE AUDIO
    # =====================================

    def _send_audio(
        self,
        audio_bytes
    ):

        self.send_response(
            200
        )


        self._add_cors_headers()


        self.send_header(
            "Content-Type",
            "audio/mpeg"
        )


        self.send_header(
            "Content-Disposition",
            'inline; filename="translation.mp3"'
        )


        self.send_header(
            "Cache-Control",
            "no-store"
        )


        self.send_header(
            "Content-Length",
            str(
                len(audio_bytes)
            )
        )


        self.end_headers()


        self.wfile.write(
            audio_bytes
        )


    # =====================================
    # LEER BODY
    # =====================================

    def _read_body(self):

        try:

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    "0"
                )
            )

        except ValueError:

            raise ValueError(
                "El tamaño de la solicitud no es válido."
            )


        if content_length <= 0:

            raise ValueError(
                "La solicitud está vacía."
            )


        if (
            content_length >
            MAX_REQUEST_BYTES
        ):

            raise OverflowError(
                "La solicitud supera "
                "el tamaño permitido."
            )


        return (
            self.rfile.read(
                content_length
            )
        )


    # =====================================
    # OPTIONS
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
    # POST /api/audio
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


        content_type_header = (
            self.headers
            .get(
                "Content-Type",
                ""
            )
        )


        media_type = (
            content_type_header
            .split(";")[0]
            .strip()
            .lower()
        )


        # =================================
        # AUDIO → TEXTO → TRADUCCIÓN
        # =================================

        if (
            media_type ==
            "multipart/form-data"
        ):

            self._process_audio_request(
                content_type_header
            )

            return


        # =================================
        # TRADUCCIÓN → VOZ
        # =================================

        if (
            media_type ==
            "application/json"
        ):

            self._process_speech_request()

            return


        # =================================
        # TIPO NO PERMITIDO
        # =================================

        self._send_json(
            415,
            {
                "error":
                    (
                        "El tipo de contenido "
                        "de la solicitud no está permitido."
                    )
            }
        )


    # =====================================
    # PROCESAR AUDIO SUBIDO
    # =====================================

    def _process_audio_request(
        self,
        content_type_header
    ):

        try:

            # -----------------------------
            # LEER PETICIÓN
            # -----------------------------

            raw_body = (
                self._read_body()
            )


            # -----------------------------
            # EXTRAER AUDIO
            # -----------------------------

            (
                filename,
                mime_type,
                audio_bytes

            ) = (
                MultipartAudioParser
                .parse(
                    content_type_header,
                    raw_body
                )
            )


            # -----------------------------
            # VALIDAR
            # -----------------------------

            is_valid, message = (
                AudioValidator
                .validate(
                    filename,
                    mime_type,
                    audio_bytes
                )
            )


            if not is_valid:

                self._send_json(
                    400,
                    {
                        "error":
                            message
                    }
                )

                return


            # -----------------------------
            # PROCESAR CON OPENAI
            # -----------------------------

            service = (
                AudioTranslationService()
            )


            result = (
                service
                .process_audio(
                    filename,
                    mime_type,
                    audio_bytes
                )
            )


            # -----------------------------
            # RESPUESTA
            # -----------------------------

            self._send_json(
                200,
                result
            )


        # ---------------------------------
        # SOLICITUD DEMASIADO GRANDE
        # ---------------------------------

        except OverflowError as error:

            self._send_json(
                413,
                {
                    "error":
                        str(error)
                }
            )


        # ---------------------------------
        # AUDIO SIN VOZ
        # ---------------------------------

        except AudioContentError as error:

            self._send_json(
                422,
                {
                    "error":
                        str(error)
                }
            )


        # ---------------------------------
        # RESPUESTA INESPERADA
        # ---------------------------------

        except ValueError as error:

            print(
                "Error de audio:",
                type(error).__name__
            )


            self._send_json(
                400,
                {
                    "error":
                        str(error)
                }
            )


        # ---------------------------------
        # ERROR INTERNO
        # ---------------------------------

        except Exception as error:

            print(
                "Error interno en audio:",
                type(error).__name__
            )


            self._send_json(
                500,
                {
                    "error":
                        (
                            "No fue posible procesar "
                            "el audio en este momento."
                        )
                }
            )


    # =====================================
    # GENERAR VOZ TRADUCIDA
    # =====================================

    def _process_speech_request(self):

        try:

            raw_body = (
                self._read_body()
            )


            try:

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
            # VALIDAR ACCIÓN
            # ---------------------------------

            if (
                body.get("action")
                !=
                "speech"
            ):

                self._send_json(
                    400,
                    {
                        "error":
                            "La acción solicitada no es válida."
                    }
                )

                return


            text = (
                body.get(
                    "text"
                )
            )


            target_language = (
                body.get(
                    "target_language"
                )
            )


            service = (
                AudioTranslationService()
            )


            audio_bytes = (
                service
                .synthesize(
                    text,
                    target_language
                )
            )


            self._send_audio(
                audio_bytes
            )


        except OverflowError as error:

            self._send_json(
                413,
                {
                    "error":
                        str(error)
                }
            )


        except ValueError as error:

            self._send_json(
                400,
                {
                    "error":
                        str(error)
                }
            )


        except Exception as error:

            print(
                "Error interno generando voz:",
                type(error).__name__
            )


            self._send_json(
                500,
                {
                    "error":
                        (
                            "No fue posible generar "
                            "la voz traducida."
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