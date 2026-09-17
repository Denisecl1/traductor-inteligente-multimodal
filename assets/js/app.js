"use strict";


/* =========================================
   ADMINISTRADOR DE MENSAJES DE ESTADO
========================================= */

class StatusManager {

    static show(containerId, type, message) {

        const container = document.getElementById(containerId);

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

        const messageElement = document.createElement("div");

        messageElement.className = `status-message status-${type}`;

        messageElement.textContent =
            `${icons[type] || ""} ${message}`;

        container.appendChild(messageElement);
    }


    static clear(containerId) {

        const container = document.getElementById(containerId);

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
            document.getElementById("chatForm");

        this.messageInput =
            document.getElementById("messageInput");

        this.characterCounter =
            document.getElementById("characterCounter");

        this.maxCharacters = 1000;

        this.init();
    }


    init() {

        if (!this.form || !this.messageInput) {
            return;
        }

        this.messageInput.addEventListener(
            "input",
            () => this.updateCharacterCounter()
        );

        this.form.addEventListener(
            "submit",
            (event) => this.handleSubmit(event)
        );

    }


    updateCharacterCounter() {

        const currentLength =
            this.messageInput.value.length;

        this.characterCounter.textContent =
            currentLength;

    }


    handleSubmit(event) {

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


        if (message.length > this.maxCharacters) {

            StatusManager.show(
                "chatStatus",
                "error",
                `El mensaje no puede superar ${this.maxCharacters} caracteres.`
            );

            return;
        }


        /*
         * Por ahora solamente validamos el mensaje.
         * La comunicación con Vercel y OpenAI
         * se agregará posteriormente.
         */

        StatusManager.show(
            "chatStatus",
            "success",
            "Mensaje válido y listo para traducir."
        );

    }

}


/* =========================================
   CLASE PARA MANEJO DE ARCHIVOS
========================================= */

class FileModule {

    constructor(config) {

        this.form =
            document.getElementById(config.formId);

        this.input =
            document.getElementById(config.inputId);

        this.fileName =
            document.getElementById(config.fileNameId);

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

        if (!this.input || !this.form) {
            return;
        }

        this.input.addEventListener(
            "change",
            () => this.handleFileSelection()
        );

        this.form.addEventListener(
            "submit",
            (event) => this.handleSubmit(event)
        );

    }


    getExtension(fileName) {

        const parts =
            fileName.toLowerCase().split(".");

        return parts.length > 1
            ? parts.pop()
            : "";

    }


    validateFile(file) {

        if (!file) {

            return {
                valid: false,
                message: "Selecciona un archivo."
            };

        }


        const extension =
            this.getExtension(file.name);


        if (
            !this.allowedExtensions.includes(extension)
        ) {

            return {
                valid: false,
                message:
                    "El formato del archivo no está permitido."
            };

        }


        const maxBytes =
            this.maxSizeMB * 1024 * 1024;


        if (file.size > maxBytes) {

            return {
                valid: false,
                message:
                    `El archivo supera el límite de ${this.maxSizeMB} MB.`
            };

        }


        if (file.size === 0) {

            return {
                valid: false,
                message:
                    "El archivo seleccionado está vacío."
            };

        }


        return {
            valid: true,
            message: "Archivo válido."
        };

    }


    handleFileSelection() {

        StatusManager.clear(this.statusId);

        const file =
            this.input.files[0];


        if (!file) {

            this.resetFileName();

            this.hidePreview();

            return;

        }


        const validation =
            this.validateFile(file);


        if (!validation.valid) {

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


        this.fileName.textContent =
            file.name;


        StatusManager.show(
            this.statusId,
            "success",
            "Archivo seleccionado correctamente."
        );


        if (this.preview) {

            this.showImagePreview(file);

        }

    }


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
            this.validateFile(file);


        if (!validation.valid) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );

            return;

        }


        /*
         * Todavía no se envía el archivo.
         * La conexión con el backend se
         * implementará posteriormente.
         */

        StatusManager.show(
            this.statusId,
            "success",
            "Archivo válido y listo para procesarse."
        );

    }


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
            URL.createObjectURL(file);


        this.preview.src =
            this.previewUrl;


        this.previewContainer.classList.remove(
            "d-none"
        );

    }


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

            this.previewUrl = null;

        }


        this.preview.removeAttribute("src");


        this.previewContainer.classList.add(
            "d-none"
        );

    }


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

        /*
         * CHAT
         */

        this.chat =
            new ChatModule();


        /*
         * AUDIO
         */

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


        /*
         * DOCUMENTOS
         */

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


        /*
         * IMÁGENES
         */

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