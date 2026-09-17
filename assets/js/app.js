"use strict";


const API_URL =
    "https://traductor-inteligente-multimodal.vercel.app/api/chat";


/* =========================================
   ADMINISTRADOR DE MENSAJES DE ESTADO
========================================= */

class StatusManager {

    static show(containerId, type, message) {

        const container =
            document.getElementById(containerId);

        if (!container) {
            return;
        }


        const icons = {
            success: "✓",
            warning: "⚠",
            error: "✕",
            loading: "⏳"
        };


        container.innerHTML = "";


        const messageElement =
            document.createElement("div");


        messageElement.className =
            `status-message status-${type}`;


        messageElement.textContent =
            `${icons[type] || ""} ${message}`;


        container.appendChild(
            messageElement
        );

    }


    static clear(containerId) {

        const container =
            document.getElementById(containerId);


        if (container) {

            container.innerHTML = "";

        }

    }

}


/* =========================================
   MÓDULO DEL CHAT
========================================= */

class ChatModule {

    constructor() {

        this.form =
            document.getElementById(
                "chatForm"
            );


        this.messageInput =
            document.getElementById(
                "messageInput"
            );


        this.characterCounter =
            document.getElementById(
                "characterCounter"
            );


        this.participantSelect =
            document.getElementById(
                "participantSelect"
            );


        this.messages =
            document.getElementById(
                "chatMessages"
            );


        this.sendButton =
            document.getElementById(
                "sendMessageButton"
            );


        this.clearChatButton =
            document.getElementById(
                "clearChatButton"
            );


        this.maxCharacters = 1000;


        /*
         * Clave utilizada para guardar
         * la conversación en sessionStorage.
         */

        this.storageKey =
            "translatorChatHistory";


        /*
         * Historial de mensajes de
         * la sesión actual.
         */

        this.history = [];


        this.init();

    }


    init() {

        if (
            !this.form ||
            !this.messageInput ||
            !this.messages
        ) {

            return;

        }


        /*
         * Contador de caracteres
         */

        this.messageInput.addEventListener(
            "input",
            () =>
                this.updateCharacterCounter()
        );


        /*
         * Envío del formulario
         */

        this.form.addEventListener(
            "submit",
            (event) =>
                this.handleSubmit(event)
        );


        /*
         * Limpiar conversación
         */

        if (this.clearChatButton) {

            this.clearChatButton.addEventListener(
                "click",
                () => this.clearChat()
            );

        }


        /*
         * Recuperar conversación guardada
         * durante la sesión.
         */

        this.loadHistory();

    }


    /* =====================================
       CONTADOR DE CARACTERES
    ===================================== */

    updateCharacterCounter() {

        const currentLength =
            this.messageInput.value.length;


        this.characterCounter.textContent =
            currentLength;

    }


    /* =====================================
       ENVIAR MENSAJE
    ===================================== */

    async handleSubmit(event) {

        event.preventDefault();


        const message =
            this.messageInput.value.trim();


        /*
         * Validar mensaje vacío
         */

        if (!message) {

            StatusManager.show(
                "chatStatus",
                "warning",
                "Escribe un mensaje antes de enviarlo."
            );


            this.messageInput.focus();


            return;

        }


        /*
         * Validar longitud
         */

        if (
            message.length >
            this.maxCharacters
        ) {

            StatusManager.show(
                "chatStatus",
                "error",
                `El mensaje no puede superar ${this.maxCharacters} caracteres.`
            );


            return;

        }


        const participant =
            this.participantSelect.value;


        try {

            /*
             * Estado de carga
             */

            this.setLoading(true);


            StatusManager.show(
                "chatStatus",
                "loading",
                "Traduciendo mensaje..."
            );


            /*
             * Solicitud al backend de Vercel
             */

            const response =
                await fetch(
                    API_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            message: message
                        })
                    }
                );


            let data = {};


            /*
             * Convertir respuesta a JSON
             */

            try {

                data =
                    await response.json();

            } catch {

                throw new Error(
                    "El servidor devolvió una respuesta no válida."
                );

            }


            /*
             * Verificar respuesta HTTP
             */

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "No fue posible realizar la traducción."
                );

            }


            /*
             * Mostrar mensaje en pantalla
             */

            this.addMessage(
                participant,
                data.original,
                data.translation,
                data.source_language,
                data.target_language
            );


            /*
             * Guardar mensaje en historial
             */

            this.saveMessage({
                participant:
                    participant,

                original:
                    data.original,

                translation:
                    data.translation,

                sourceLanguage:
                    data.source_language,

                targetLanguage:
                    data.target_language
            });


            /*
             * Limpiar textarea
             */

            this.messageInput.value = "";


            this.updateCharacterCounter();


            /*
             * Mostrar éxito
             */

            StatusManager.show(
                "chatStatus",
                "success",
                "Mensaje traducido correctamente."
            );


            this.messageInput.focus();

        } catch (error) {

            console.error(
                "Error al traducir:",
                error
            );


            StatusManager.show(
                "chatStatus",
                "error",
                error.message ||
                "No fue posible conectar con el servicio de traducción."
            );

        } finally {

            this.setLoading(false);

        }

    }


    /* =====================================
       MOSTRAR MENSAJE EN EL CHAT
    ===================================== */

    addMessage(
        participant,
        originalText,
        translatedText,
        sourceLanguage,
        targetLanguage
    ) {

        /*
         * Eliminar mensaje inicial
         */

        const placeholder =
            this.messages.querySelector(
                ".text-center.text-secondary"
            );


        if (placeholder) {

            placeholder.remove();

        }


        /*
         * Contenedor principal
         */

        const messageContainer =
            document.createElement("div");


        messageContainer.classList.add(
            "chat-message"
        );


        /*
         * Aplicar estilo según participante
         */

        if (
            participant ===
            "participant1"
        ) {

            messageContainer.classList.add(
                "participant-1"
            );

        } else {

            messageContainer.classList.add(
                "participant-2"
            );

        }


        /*
         * Nombre del participante
         */

        const participantElement =
            document.createElement("div");


        participantElement.classList.add(
            "message-participant"
        );


        participantElement.textContent =
            participant ===
                "participant1"
                ? "Participante 1"
                : "Participante 2";


        /*
         * Texto original
         */

        const originalElement =
            document.createElement("div");


        originalElement.classList.add(
            "message-original"
        );


        const originalLabel =
            document.createElement("strong");


        originalLabel.textContent =
            `Original (${this.getLanguageName(sourceLanguage)}):`;


        originalElement.appendChild(
            originalLabel
        );


        originalElement.appendChild(
            document.createElement("br")
        );


        originalElement.appendChild(
            document.createTextNode(
                originalText
            )
        );


        /*
         * Traducción
         */

        const translationElement =
            document.createElement("div");


        translationElement.classList.add(
            "message-translation"
        );


        const translationLabel =
            document.createElement("strong");


        translationLabel.textContent =
            `Traducción (${this.getLanguageName(targetLanguage)}):`;


        translationElement.appendChild(
            translationLabel
        );


        translationElement.appendChild(
            document.createElement("br")
        );


        translationElement.appendChild(
            document.createTextNode(
                translatedText
            )
        );


        /*
         * Botón para copiar traducción
         */

        const copyButton =
            document.createElement("button");


        copyButton.type =
            "button";


        copyButton.classList.add(
            "copy-translation-button"
        );


        copyButton.textContent =
            "📋 Copiar traducción";


        copyButton.addEventListener(
            "click",
            () =>
                this.copyTranslation(
                    translatedText,
                    copyButton
                )
        );


        /*
         * Construir mensaje
         */

        messageContainer.appendChild(
            participantElement
        );


        messageContainer.appendChild(
            originalElement
        );


        messageContainer.appendChild(
            translationElement
        );


        messageContainer.appendChild(
            copyButton
        );


        /*
         * Agregar mensaje al chat
         */

        this.messages.appendChild(
            messageContainer
        );


        /*
         * Llevar scroll al último mensaje
         */

        this.messages.scrollTop =
            this.messages.scrollHeight;

    }


    /* =====================================
       NOMBRE DEL IDIOMA
    ===================================== */

    getLanguageName(language) {

        const languages = {
            es: "Español",
            en: "Inglés"
        };


        return (
            languages[language] ||
            language
        );

    }


    /* =====================================
       ESTADO DEL BOTÓN
    ===================================== */

    setLoading(isLoading) {

        if (!this.sendButton) {

            return;

        }


        this.sendButton.disabled =
            isLoading;


        this.sendButton.textContent =
            isLoading
                ? "Traduciendo..."
                : "Traducir y enviar";

    }


    /* =====================================
       GUARDAR MENSAJE EN SESSION STORAGE
    ===================================== */

    saveMessage(message) {

        this.history.push(
            message
        );


        try {

            sessionStorage.setItem(
                this.storageKey,
                JSON.stringify(
                    this.history
                )
            );

        } catch (error) {

            console.error(
                "No fue posible guardar el historial:",
                error
            );

        }

    }


    /* =====================================
       CARGAR HISTORIAL
    ===================================== */

    loadHistory() {

        const savedHistory =
            sessionStorage.getItem(
                this.storageKey
            );


        if (!savedHistory) {

            return;

        }


        try {

            const parsedHistory =
                JSON.parse(
                    savedHistory
                );


            /*
             * Verificar que realmente
             * sea un arreglo.
             */

            if (
                !Array.isArray(
                    parsedHistory
                )
            ) {

                this.history = [];

                sessionStorage.removeItem(
                    this.storageKey
                );


                return;

            }


            this.history =
                parsedHistory;


            /*
             * Reconstruir los mensajes
             * guardados en pantalla.
             */

            this.history.forEach(
                (message) => {

                    this.addMessage(
                        message.participant,
                        message.original,
                        message.translation,
                        message.sourceLanguage,
                        message.targetLanguage
                    );

                }
            );

        } catch (error) {

            console.error(
                "No fue posible cargar el historial:",
                error
            );


            this.history = [];


            sessionStorage.removeItem(
                this.storageKey
            );

        }

    }


    /* =====================================
       LIMPIAR CONVERSACIÓN
    ===================================== */

    clearChat() {

        /*
         * Si no hay mensajes
         */

        if (
            this.history.length === 0
        ) {

            StatusManager.show(
                "chatStatus",
                "warning",
                "La conversación ya está vacía."
            );


            return;

        }


        /*
         * Confirmar antes de eliminar
         */

        const confirmClear =
            window.confirm(
                "¿Deseas eliminar toda la conversación de esta sesión?"
            );


        if (!confirmClear) {

            return;

        }


        /*
         * Vaciar historial
         */

        this.history = [];


        sessionStorage.removeItem(
            this.storageKey
        );


        /*
         * Restaurar contenedor
         */

        this.messages.innerHTML = `
            <div class="text-center text-secondary py-4">
                La conversación aparecerá aquí.
            </div>
        `;


        /*
         * Limpiar estado anterior
         */

        StatusManager.show(
            "chatStatus",
            "success",
            "La conversación se eliminó correctamente."
        );


        this.messageInput.focus();

    }


    /* =====================================
       COPIAR TRADUCCIÓN
    ===================================== */

    async copyTranslation(
        translation,
        button
    ) {

        try {

            /*
             * Copiar al portapapeles
             */

            await navigator.clipboard.writeText(
                translation
            );


            const originalText =
                button.textContent;


            /*
             * Mostrar confirmación
             */

            button.textContent =
                "✓ Copiado";


            button.classList.add(
                "copied"
            );


            /*
             * Restaurar botón después
             * de 1.5 segundos.
             */

            setTimeout(
                () => {

                    button.textContent =
                        originalText;


                    button.classList.remove(
                        "copied"
                    );

                },
                1500
            );

        } catch (error) {

            console.error(
                "Error al copiar:",
                error
            );


            StatusManager.show(
                "chatStatus",
                "error",
                "No fue posible copiar la traducción."
            );

        }

    }

}


/* =========================================
   CLASE PARA MANEJO DE ARCHIVOS
========================================= */

class FileModule {

    constructor(config) {

        this.form =
            document.getElementById(
                config.formId
            );


        this.input =
            document.getElementById(
                config.inputId
            );


        this.fileName =
            document.getElementById(
                config.fileNameId
            );


        this.statusId =
            config.statusId;


        this.allowedExtensions =
            config.allowedExtensions;


        this.maxSizeMB =
            config.maxSizeMB;


        this.previewContainer =
            config.previewContainerId
                ? document.getElementById(
                    config.previewContainerId
                )
                : null;


        this.preview =
            config.previewId
                ? document.getElementById(
                    config.previewId
                )
                : null;


        this.previewUrl = null;


        this.init();

    }


    init() {

        if (
            !this.input ||
            !this.form
        ) {

            return;

        }


        this.input.addEventListener(
            "change",
            () =>
                this.handleFileSelection()
        );


        this.form.addEventListener(
            "submit",
            (event) =>
                this.handleSubmit(event)
        );

    }


    /* =====================================
       OBTENER EXTENSIÓN
    ===================================== */

    getExtension(fileName) {

        const parts =
            fileName
                .toLowerCase()
                .split(".");


        return (
            parts.length > 1
                ? parts.pop()
                : ""
        );

    }


    /* =====================================
       VALIDAR ARCHIVO
    ===================================== */

    validateFile(file) {

        /*
         * Archivo no seleccionado
         */

        if (!file) {

            return {
                valid: false,

                message:
                    "Selecciona un archivo."
            };

        }


        /*
         * Obtener extensión
         */

        const extension =
            this.getExtension(
                file.name
            );


        /*
         * Validar formato
         */

        if (
            !this.allowedExtensions.includes(
                extension
            )
        ) {

            return {
                valid: false,

                message:
                    "El formato del archivo no está permitido."
            };

        }


        /*
         * Validar tamaño
         */

        const maxBytes =
            this.maxSizeMB *
            1024 *
            1024;


        if (
            file.size >
            maxBytes
        ) {

            return {
                valid: false,

                message:
                    `El archivo supera el límite de ${this.maxSizeMB} MB.`
            };

        }


        /*
         * Archivo vacío
         */

        if (
            file.size === 0
        ) {

            return {
                valid: false,

                message:
                    "El archivo seleccionado está vacío."
            };

        }


        return {
            valid: true,

            message:
                "Archivo válido."
        };

    }


    /* =====================================
       ARCHIVO SELECCIONADO
    ===================================== */

    handleFileSelection() {

        StatusManager.clear(
            this.statusId
        );


        const file =
            this.input.files[0];


        /*
         * Si se cancela la selección
         */

        if (!file) {

            this.resetFileName();

            this.hidePreview();

            return;

        }


        /*
         * Validar archivo
         */

        const validation =
            this.validateFile(
                file
            );


        if (
            !validation.valid
        ) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );


            this.input.value = "";


            this.resetFileName();


            this.hidePreview();


            return;

        }


        /*
         * Mostrar nombre
         */

        if (this.fileName) {

            this.fileName.textContent =
                file.name;

        }


        /*
         * Mostrar estado
         */

        StatusManager.show(
            this.statusId,
            "success",
            "Archivo seleccionado correctamente."
        );


        /*
         * Mostrar vista previa
         * si se trata de imagen.
         */

        if (this.preview) {

            this.showImagePreview(
                file
            );

        }

    }


    /* =====================================
       FORMULARIO DEL ARCHIVO
    ===================================== */

    handleSubmit(event) {

        event.preventDefault();


        const file =
            this.input.files[0];


        /*
         * Sin archivo
         */

        if (!file) {

            StatusManager.show(
                this.statusId,
                "warning",
                "Selecciona un archivo antes de continuar."
            );


            return;

        }


        /*
         * Validar nuevamente
         */

        const validation =
            this.validateFile(
                file
            );


        if (
            !validation.valid
        ) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );


            return;

        }


        /*
         * Todavía no se envía el archivo.
         * Esto se conectará posteriormente
         * con cada endpoint de Vercel.
         */

        StatusManager.show(
            this.statusId,
            "success",
            "Archivo válido y listo para procesarse."
        );

    }


    /* =====================================
       VISTA PREVIA DE IMAGEN
    ===================================== */

    showImagePreview(file) {

        if (
            !this.preview ||
            !this.previewContainer
        ) {

            return;

        }


        /*
         * Liberar URL anterior
         */

        if (this.previewUrl) {

            URL.revokeObjectURL(
                this.previewUrl
            );

        }


        /*
         * Crear nueva URL temporal
         */

        this.previewUrl =
            URL.createObjectURL(
                file
            );


        this.preview.src =
            this.previewUrl;


        this.previewContainer
            .classList
            .remove(
                "d-none"
            );

    }


    /* =====================================
       OCULTAR VISTA PREVIA
    ===================================== */

    hidePreview() {

        if (
            !this.preview ||
            !this.previewContainer
        ) {

            return;

        }


        if (this.previewUrl) {

            URL.revokeObjectURL(
                this.previewUrl
            );


            this.previewUrl =
                null;

        }


        this.preview.removeAttribute(
            "src"
        );


        this.previewContainer
            .classList
            .add(
                "d-none"
            );

    }


    /* =====================================
       RESTAURAR NOMBRE DEL ARCHIVO
    ===================================== */

    resetFileName() {

        if (this.fileName) {

            this.fileName.textContent =
                "Ningún archivo seleccionado";

        }

    }

}


/* =========================================
   APLICACIÓN PRINCIPAL
========================================= */

class TranslatorApp {

    constructor() {

        this.chat = null;

        this.audio = null;

        this.documents = null;

        this.images = null;

    }


    init() {

        /* =================================
           CHAT
        ================================= */

        this.chat =
            new ChatModule();


        /* =================================
           AUDIO
        ================================= */

        this.audio =
            new FileModule({

                formId:
                    "audioForm",

                inputId:
                    "audioInput",

                fileNameId:
                    "audioFileName",

                statusId:
                    "audioStatus",

                allowedExtensions: [
                    "mp3",
                    "wav",
                    "m4a",
                    "webm"
                ],

                maxSizeMB: 4

            });


        /* =================================
           DOCUMENTOS
        ================================= */

        this.documents =
            new FileModule({

                formId:
                    "documentForm",

                inputId:
                    "documentInput",

                fileNameId:
                    "documentFileName",

                statusId:
                    "documentStatus",

                allowedExtensions: [
                    "pdf",
                    "docx",
                    "txt"
                ],

                maxSizeMB: 4

            });


        /* =================================
           IMÁGENES
        ================================= */

        this.images =
            new FileModule({

                formId:
                    "imageForm",

                inputId:
                    "imageInput",

                fileNameId:
                    "imageFileName",

                statusId:
                    "imageStatus",

                allowedExtensions: [
                    "png",
                    "jpg",
                    "jpeg",
                    "webp"
                ],

                maxSizeMB: 4,

                previewContainerId:
                    "imagePreviewContainer",

                previewId:
                    "imagePreview"

            });

    }

}


/* =========================================
   INICIAR APLICACIÓN
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const app =
            new TranslatorApp();


        app.init();

    }
);