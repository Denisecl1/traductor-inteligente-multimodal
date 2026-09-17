"use strict";


/* =========================================
   ENDPOINTS DEL BACKEND
========================================= */

const CHAT_API_URL =
    "https://traductor-inteligente-multimodal.vercel.app/api/chat";

const IMAGE_API_URL =
    "https://traductor-inteligente-multimodal.vercel.app/api/images";


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

        this.storageKey =
            "translatorChatHistory";

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


        this.messageInput.addEventListener(
            "input",
            () =>
                this.updateCharacterCounter()
        );


        this.form.addEventListener(
            "submit",
            (event) =>
                this.handleSubmit(event)
        );


        if (this.clearChatButton) {

            this.clearChatButton.addEventListener(
                "click",
                () =>
                    this.clearChat()
            );
        }


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


        if (!message) {

            StatusManager.show(
                "chatStatus",
                "warning",
                "Escribe un mensaje antes de enviarlo."
            );

            this.messageInput.focus();

            return;
        }


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

            this.setLoading(true);


            StatusManager.show(
                "chatStatus",
                "loading",
                "Traduciendo mensaje..."
            );


            const response =
                await fetch(
                    CHAT_API_URL,
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


            try {

                data =
                    await response.json();

            } catch {

                throw new Error(
                    "El servidor devolvió una respuesta no válida."
                );
            }


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "No fue posible realizar la traducción."
                );
            }


            this.addMessage(
                participant,
                data.original,
                data.translation,
                data.source_language,
                data.target_language
            );


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


            this.messageInput.value = "";


            this.updateCharacterCounter();


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
       MOSTRAR MENSAJE
    ===================================== */

    addMessage(
        participant,
        originalText,
        translatedText,
        sourceLanguage,
        targetLanguage
    ) {

        const placeholder =
            this.messages.querySelector(
                ".text-center.text-secondary"
            );


        if (placeholder) {
            placeholder.remove();
        }


        const messageContainer =
            document.createElement("div");


        messageContainer.classList.add(
            "chat-message"
        );


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


        /* PARTICIPANTE */

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


        /* ORIGINAL */

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


        /* TRADUCCIÓN */

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


        /* BOTÓN COPIAR */

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


        /* CONSTRUIR MENSAJE */

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


        this.messages.appendChild(
            messageContainer
        );


        this.messages.scrollTop =
            this.messages.scrollHeight;
    }


    /* =====================================
       NOMBRE DE IDIOMA
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
       BOTÓN CARGANDO
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
       GUARDAR HISTORIAL
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


        const confirmClear =
            window.confirm(
                "¿Deseas eliminar toda la conversación de esta sesión?"
            );


        if (!confirmClear) {
            return;
        }


        this.history = [];


        sessionStorage.removeItem(
            this.storageKey
        );


        this.messages.innerHTML = `
            <div class="text-center text-secondary py-4">
                La conversación aparecerá aquí.
            </div>
        `;


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

            await navigator.clipboard.writeText(
                translation
            );


            const originalText =
                button.textContent;


            button.textContent =
                "✓ Copiado";


            button.classList.add(
                "copied"
            );


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
   CLASE BASE PARA MANEJO DE ARCHIVOS
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

        this.previewUrl =
            null;


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

        if (!file) {

            return {
                valid: false,

                message:
                    "Selecciona un archivo."
            };
        }


        const extension =
            this.getExtension(
                file.name
            );


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


        if (!file) {

            this.resetFileName();

            this.hidePreview();

            return;
        }


        const validation =
            this.validateFile(
                file
            );


        if (!validation.valid) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );


            this.input.value =
                "";


            this.resetFileName();


            this.hidePreview();


            return;
        }


        if (this.fileName) {

            this.fileName.textContent =
                file.name;
        }


        StatusManager.show(
            this.statusId,
            "success",
            "Archivo seleccionado correctamente."
        );


        if (this.preview) {

            this.showImagePreview(
                file
            );
        }
    }


    /* =====================================
       ENVÍO GENÉRICO
    ===================================== */

    handleSubmit(event) {

        event.preventDefault();


        const file =
            this.input.files[0];


        if (!file) {

            StatusManager.show(
                this.statusId,
                "warning",
                "Selecciona un archivo antes de continuar."
            );

            return;
        }


        const validation =
            this.validateFile(
                file
            );


        if (!validation.valid) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );

            return;
        }


        StatusManager.show(
            this.statusId,
            "success",
            "Archivo válido y listo para procesarse."
        );
    }


    /* =====================================
       VISTA PREVIA
    ===================================== */

    showImagePreview(file) {

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
        }


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
       RESTAURAR NOMBRE
    ===================================== */

    resetFileName() {

        if (this.fileName) {

            this.fileName.textContent =
                "Ningún archivo seleccionado";
        }
    }

}


/* =========================================
   MÓDULO ESPECÍFICO DE IMÁGENES
========================================= */

class ImageModule extends FileModule {

    constructor(config) {

        super(config);


        this.apiUrl =
            config.apiUrl;


        this.submitButton =
            document.getElementById(
                config.submitButtonId
            );


        this.resultContainer =
            document.getElementById(
                config.resultContainerId
            );


        this.originalText =
            document.getElementById(
                config.originalTextId
            );


        this.translatedText =
            document.getElementById(
                config.translatedTextId
            );
    }


    /* =====================================
       SELECCIONAR NUEVA IMAGEN
    ===================================== */

    handleFileSelection() {

        /*
         * Ocultar resultado anterior
         * cuando el usuario cambia de imagen.
         */

        this.hideResult();


        /*
         * Utilizar validaciones y preview
         * de la clase FileModule.
         */

        super.handleFileSelection();
    }


    /* =====================================
       TRADUCIR IMAGEN
    ===================================== */

    async handleSubmit(event) {

        event.preventDefault();


        const file =
            this.input.files[0];


        if (!file) {

            StatusManager.show(
                this.statusId,
                "warning",
                "Selecciona una imagen antes de continuar."
            );

            return;
        }


        const validation =
            this.validateFile(
                file
            );


        if (!validation.valid) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );

            return;
        }


        try {

            /*
             * Ocultar resultados anteriores
             */

            this.hideResult();


            /*
             * Bloquear botón
             */

            this.setLoading(true);


            StatusManager.show(
                this.statusId,
                "loading",
                "Analizando y traduciendo la imagen..."
            );


            /*
             * Convertir imagen a Data URL
             */

            const imageData =
                await this.fileToDataURL(
                    file
                );


            /*
             * Enviar imagen al backend
             */

            const response =
                await fetch(
                    this.apiUrl,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            image_data:
                                imageData
                        })
                    }
                );


            let data = {};


            try {

                data =
                    await response.json();

            } catch {

                throw new Error(
                    "El servidor devolvió una respuesta no válida."
                );
            }


            /*
             * Error controlado por backend
             */

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "No fue posible analizar la imagen."
                );
            }


            /*
             * Mostrar texto detectado
             */

            this.originalText.textContent =
                data.detected_text;


            /*
             * Mostrar traducción
             */

            this.translatedText.textContent =
                data.translation;


            /*
             * Mostrar contenedor resultado
             */

            this.resultContainer
                .classList
                .remove(
                    "d-none"
                );


            StatusManager.show(
                this.statusId,
                "success",
                `Imagen traducida correctamente: ${this.getLanguageName(data.source_language)} → ${this.getLanguageName(data.target_language)}.`
            );

        } catch (error) {

            console.error(
                "Error al traducir imagen:",
                error
            );


            this.hideResult();


            StatusManager.show(
                this.statusId,
                "error",
                error.message ||
                "No fue posible conectar con el servicio de traducción de imágenes."
            );

        } finally {

            this.setLoading(false);
        }
    }


    /* =====================================
       CONVERTIR ARCHIVO A DATA URL
    ===================================== */

    fileToDataURL(file) {

        return new Promise(
            (resolve, reject) => {

                const reader =
                    new FileReader();


                reader.onload =
                    () => {

                        resolve(
                            reader.result
                        );
                    };


                reader.onerror =
                    () => {

                        reject(
                            new Error(
                                "No fue posible leer la imagen seleccionada."
                            )
                        );
                    };


                reader.readAsDataURL(
                    file
                );
            }
        );
    }


    /* =====================================
       OCULTAR RESULTADO
    ===================================== */

    hideResult() {

        if (this.resultContainer) {

            this.resultContainer
                .classList
                .add(
                    "d-none"
                );
        }


        if (this.originalText) {

            this.originalText.textContent =
                "";
        }


        if (this.translatedText) {

            this.translatedText.textContent =
                "";
        }
    }


    /* =====================================
       CARGANDO
    ===================================== */

    setLoading(isLoading) {

        if (!this.submitButton) {
            return;
        }


        this.submitButton.disabled =
            isLoading;


        this.submitButton.textContent =
            isLoading
                ? "Traduciendo..."
                : "Traducir imagen";
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

}


/* =========================================
   APLICACIÓN PRINCIPAL
========================================= */

class TranslatorApp {

    constructor() {

        this.chat =
            null;

        this.audio =
            null;

        this.documents =
            null;

        this.images =
            null;
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

                maxSizeMB:
                    4
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

                maxSizeMB:
                    4
            });


        /* =================================
           IMÁGENES
        ================================= */

        this.images =
            new ImageModule({

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

                /*
                 * Imágenes: máximo 3 MB.
                 */

                maxSizeMB:
                    3,

                previewContainerId:
                    "imagePreviewContainer",

                previewId:
                    "imagePreview",

                submitButtonId:
                    "translateImageButton",

                resultContainerId:
                    "imageResult",

                originalTextId:
                    "imageOriginalText",

                translatedTextId:
                    "imageTranslatedText",

                apiUrl:
                    IMAGE_API_URL
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